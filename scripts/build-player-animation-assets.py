#!/usr/bin/env python3
"""Build the approved four-sheet player animation set deterministically."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image, __version__ as PILLOW_VERSION


PIPELINE_SCHEMA = 1
SUPPORTED_PILLOW_VERSION = "12.1.1"
HELPER_SHA256 = "7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea"
DIRECTIONS = ("south", "north", "east", "west")
SOURCE_SHA256 = {
    "south": "8945c8f41ea083cf5717072058466fd9ec19c8ebee77653956e1fcaea04e66d3",
    "north": "ff130a2efd2677d758048a14bf697f7e0714d3167d0571444b9fcb648d74c861",
    "east": "19da543aea6592de7cbdd398bcf6be551abef96eb1c323906f0338eb39a6fe40",
    "west": "25f525a787acf7dca43b62fb51c31a1406d0e9f30da876cffb3ddaca7324db24",
}
SOURCE_SIZE = (1254, 1254)
SOURCE_MODE = "RGB"
KEY = (255, 0, 255)
ALPHA_THRESHOLD = 16
MEANINGFUL_COMPONENT_AREA = 500
FRAME_SIZE = 64
FRAME_ROOT = (32, 60)
MAX_FRAME_BOUNDS = (58, 56)
SOURCE_RELS = {
    direction: f"art/source/player-hd/player-animation-{direction}-source-1024.png"
    for direction in DIRECTIONS
}
NORMALIZED_RELS = {
    direction: f"art/source/player-hd/player-animation-{direction}-normalized-1024.png"
    for direction in DIRECTIONS
}
LAYOUT_REL = "art/source/player-hd/player-animation-source-layout.json"
CONTACT_REL = "art/source/player-hd/player-animation-contact-sheet.png"
MANIFEST_REL = "assets/hd/actors/player/player-manifest.json"
LOCK_REL = "art/source/player-hd/player-animation-assets.lock.json"
CLIPS = (
    ("idle", 4, 4, True),
    ("move", 4, 8, True),
    ("attack", 4, 12, False),
    ("hit", 2, 10, False),
    ("death", 2, 6, False),
)
SLOT_NAMES = tuple(f"R{row}C{column}" for row in range(1, 5) for column in range(1, 5))


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def save_png(image: Image.Image, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, format="PNG", optimize=False, compress_level=9)


def write_json(payload: object, destination: Path, *, sort_keys: bool = False) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(payload, indent=2, sort_keys=sort_keys) + "\n",
        encoding="utf8",
        newline="\n",
    )


def verify_toolchain(helper: Path) -> str:
    if PILLOW_VERSION != SUPPORTED_PILLOW_VERSION:
        raise RuntimeError(
            f"unsupported Pillow version: expected {SUPPORTED_PILLOW_VERSION}, received {PILLOW_VERSION}"
        )
    if not helper.is_file():
        raise FileNotFoundError(f"installed chroma helper does not exist: {helper}")
    helper_hash = sha256(helper)
    if helper_hash != HELPER_SHA256:
        raise RuntimeError(f"chroma helper SHA256 mismatch: {helper_hash}")
    return helper_hash


def verify_sources(root: Path) -> None:
    for direction in DIRECTIONS:
        source = root / SOURCE_RELS[direction]
        if not source.is_file():
            raise FileNotFoundError(f"missing player source sheet: {source}")
        digest = sha256(source)
        if digest != SOURCE_SHA256[direction]:
            raise ValueError(f"{direction} source SHA256 mismatch: {digest}")
        with Image.open(source) as image:
            if image.size != SOURCE_SIZE or image.mode != SOURCE_MODE:
                raise ValueError(f"{direction} source must be 1254x1254 RGB")


def parse_helper_key(stdout: str) -> str:
    for line in stdout.splitlines():
        if line.lower().startswith("key color:"):
            value = line.split(":", 1)[1].strip().lower()
            if len(value) == 7 and value.startswith("#"):
                return value
    raise RuntimeError("chroma helper did not report Key color")


def key_source(source: Path, destination: Path, helper: Path) -> tuple[Image.Image, str]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            os.fspath(Path(os.sys.executable)), os.fspath(helper),
            "--input", os.fspath(source),
            "--out", os.fspath(destination),
            "--auto-key", "border",
            "--soft-matte",
            "--transparent-threshold", "12",
            "--opaque-threshold", "220",
            "--despill",
            "--force",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout or "chroma helper failed")
    detected_key = parse_helper_key(result.stdout)
    with Image.open(destination) as image:
        image.load()
        rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
            elif (
                alpha <= 128
                and (red - 255) ** 2 + green ** 2 + (blue - 255) ** 2 <= 48 ** 2
                and red - green >= 96
                and blue - green >= 96
                and abs(red - blue) <= 64
            ):
                pixels[x, y] = (0, 0, 0, 0)
    return rgba, detected_key


def connected_components(image: Image.Image) -> list[dict[str, object]]:
    alpha = image.getchannel("A")
    width, height = image.size
    mask = bytearray(1 if value > ALPHA_THRESHOLD else 0 for value in alpha.get_flattened_data())
    components: list[dict[str, object]] = []
    for start in range(width * height):
        if not mask[start]:
            continue
        mask[start] = 0
        stack = [start]
        points: list[int] = []
        left = right = start % width
        top = bottom = start // width
        while stack:
            index = stack.pop()
            points.append(index)
            x = index % width
            y = index // width
            left = min(left, x)
            right = max(right, x)
            top = min(top, y)
            bottom = max(bottom, y)
            if x > 0 and mask[index - 1]:
                mask[index - 1] = 0
                stack.append(index - 1)
            if x + 1 < width and mask[index + 1]:
                mask[index + 1] = 0
                stack.append(index + 1)
            if y > 0 and mask[index - width]:
                mask[index - width] = 0
                stack.append(index - width)
            if y + 1 < height and mask[index + width]:
                mask[index + width] = 0
                stack.append(index + width)
        components.append({
            "area": len(points),
            "bounds": [left, top, right, bottom],
            "points": points,
        })
    return components


def cluster_axis(components: list[dict[str, object]], axis: int) -> tuple[list[float], dict[int, int]]:
    ordered = []
    for component_index, component in enumerate(components):
        left, top, right, bottom = component["bounds"]
        center = (left + right) / 2 if axis == 0 else (top + bottom) / 2
        ordered.append((center, component_index))
    ordered.sort()
    groups: list[list[tuple[float, int]]] = []
    for value, component_index in ordered:
        if not groups or value - groups[-1][-1][0] > 80:
            groups.append([])
        groups[-1].append((value, component_index))
    if len(groups) != 4:
        raise ValueError(f"expected four semantic clusters, received {len(groups)}")
    centers = [sum(value for value, _index in group) / len(group) for group in groups]
    assignment = {
        component_index: group_index
        for group_index, group in enumerate(groups)
        for _value, component_index in group
    }
    return centers, assignment


def find_crossing_components(
    slot_components: dict[str, list[dict[str, object]]],
) -> list[dict[str, object]]:
    """Return components from adjacent semantic slots whose occupied extents overlap."""
    offenders: dict[int, dict[str, object]] = {}
    for row in range(1, 5):
        for column in range(1, 4):
            left_slot = slot_components[f"R{row}C{column}"]
            right_slot = slot_components[f"R{row}C{column + 1}"]
            if not left_slot or not right_slot:
                continue
            if max(component["bounds"][2] for component in left_slot) >= min(
                component["bounds"][0] for component in right_slot
            ):
                for component in (*left_slot, *right_slot):
                    offenders[id(component)] = component
    for column in range(1, 5):
        for row in range(1, 4):
            upper_slot = slot_components[f"R{row}C{column}"]
            lower_slot = slot_components[f"R{row + 1}C{column}"]
            if not upper_slot or not lower_slot:
                continue
            if max(component["bounds"][3] for component in upper_slot) >= min(
                component["bounds"][1] for component in lower_slot
            ):
                for component in (*upper_slot, *lower_slot):
                    offenders[id(component)] = component
    return list(offenders.values())


def clean_and_analyze(
    direction: str,
    image: Image.Image,
    detected_key: str,
) -> tuple[Image.Image, dict[str, object], list[Image.Image]]:
    components = connected_components(image)
    meaningful = [component for component in components if component["area"] >= MEANINGFUL_COMPONENT_AREA]
    small = [component for component in components if component["area"] < MEANINGFUL_COMPONENT_AREA]
    cleaned = image.copy()
    pixels = cleaned.load()
    for component in small:
        for index in component["points"]:
            pixels[index % cleaned.width, index // cleaned.width] = (0, 0, 0, 0)

    column_centers, column_assignment = cluster_axis(meaningful, 0)
    row_centers, row_assignment = cluster_axis(meaningful, 1)
    slot_components: dict[str, list[dict[str, object]]] = {name: [] for name in SLOT_NAMES}
    for component_index, component in enumerate(meaningful):
        row = row_assignment[component_index]
        column = column_assignment[component_index]
        slot_components[f"R{row + 1}C{column + 1}"].append(component)
    if any(not components_in_slot for components_in_slot in slot_components.values()):
        empty = [name for name, values in slot_components.items() if not values]
        raise ValueError(f"{direction} has empty semantic slots: {empty}")
    crossing = find_crossing_components(slot_components)
    if crossing:
        raise ValueError(
            f"{direction} has {len(crossing)} meaningful components crossing slot boundaries: "
            f"{[(component['area'], component['bounds']) for component in crossing]}"
        )

    slots: dict[str, object] = {}
    crops: list[Image.Image] = []
    for index, name in enumerate(SLOT_NAMES):
        components_in_slot = slot_components[name]
        left = max(0, min(component["bounds"][0] for component in components_in_slot) - 12)
        top = max(0, min(component["bounds"][1] for component in components_in_slot) - 12)
        right = min(cleaned.width, max(component["bounds"][2] for component in components_in_slot) + 13)
        bottom = min(cleaned.height, max(component["bounds"][3] for component in components_in_slot) + 13)
        box = (left, top, right, bottom)
        crop = cleaned.crop(box)
        crops.append(crop)
        alpha = crop.getchannel("A")
        meaningful_pixels = sum(value > ALPHA_THRESHOLD for value in alpha.get_flattened_data())
        slots[name] = {
            "meaningfulPixels": meaningful_pixels,
            "meaningfulComponentCount": len(components_in_slot),
            "componentAreas": [component["area"] for component in components_in_slot],
            "componentBounds": [component["bounds"] for component in components_in_slot],
        }
        if direction == "north" and name == "R4C4" and len(components_in_slot) == 2:
            slots[name]["detachedProp"] = "sword"

    report = {
        "identity": {
            "path": SOURCE_RELS[direction],
            "sha256": SOURCE_SHA256[direction],
            "width": SOURCE_SIZE[0],
            "height": SOURCE_SIZE[1],
            "mode": SOURCE_MODE,
        },
        "helperDetectedKey": detected_key,
        "semanticLayout": "4x4",
        "columnCenters": [round(value, 3) for value in column_centers],
        "rowCenters": [round(value, 3) for value in row_centers],
        "occupiedSlotCount": sum(bool(values) for values in slot_components.values()),
        "rawComponentCount": len(components),
        "meaningfulComponentCount": len(meaningful),
        "removedSmallComponentCount": len(small),
        "removedSmallComponentAreas": sorted((component["area"] for component in small), reverse=True),
        "crossingComponentCount": len(crossing),
        "slots": slots,
    }
    return cleaned, report, crops


def composite_normalized_sheet(crops: list[Image.Image], destination: Path) -> None:
    sheet = Image.new("RGB", (1024, 1024), KEY)
    for index, crop in enumerate(crops):
        scale = min(240 / crop.width, 240 / crop.height)
        width = max(1, round(crop.width * scale))
        height = max(1, round(crop.height * scale))
        rgba = crop.convert("RGBa").resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
        rgb = Image.new("RGB", (256, 256), KEY)
        left = (256 - width) // 2
        top = (256 - height) // 2
        rgb.paste(rgba.convert("RGB"), (left, top), rgba.getchannel("A"))
        row, column = divmod(index, 4)
        sheet.paste(rgb, (column * 256, row * 256))
    save_png(sheet, destination)


def frame_records() -> list[dict[str, object]]:
    records = []
    for direction in DIRECTIONS:
        slot = 0
        for clip, count, _fps, _loop in CLIPS:
            for frame in range(1, count + 1):
                suffix = f"{frame:02d}"
                records.append({
                    "direction": direction,
                    "clip": clip,
                    "frame": frame,
                    "slot": slot,
                    "key": f"actor.player.{direction}.{clip}.{suffix}",
                    "src": f"assets/hd/actors/player/frames/{direction}-{clip}-{suffix}.png",
                })
                slot += 1
    return records


def normalize_frames(crops_by_direction: dict[str, list[Image.Image]], staged_root: Path) -> list[dict[str, object]]:
    bounds: dict[tuple[str, int], tuple[int, int, int, int]] = {}
    max_width = max_height = 0
    for direction in DIRECTIONS:
        for index, crop in enumerate(crops_by_direction[direction]):
            box = crop.getchannel("A").getbbox()
            if box is None:
                raise ValueError(f"{direction} slot {index + 1} has no visible pixels")
            bounds[(direction, index)] = box
            max_width = max(max_width, box[2] - box[0])
            max_height = max(max_height, box[3] - box[1])
    scale = min(MAX_FRAME_BOUNDS[0] / max_width, MAX_FRAME_BOUNDS[1] / max_height)

    metrics = []
    for record in frame_records():
        direction = str(record["direction"])
        index = int(record["slot"])
        crop = crops_by_direction[direction]
        source = crop[index]
        box = bounds[(direction, index)]
        silhouette = source.crop(box)
        width = max(1, round(silhouette.width * scale))
        height = max(1, round(silhouette.height * scale))
        resized = silhouette.convert("RGBa").resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
        canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        left = FRAME_ROOT[0] - width // 2
        top = FRAME_ROOT[1] - height + 1
        canvas.alpha_composite(resized, (left, top))
        pixels = canvas.load()
        for y in range(FRAME_SIZE):
            for x in range(FRAME_SIZE):
                red, green, blue, alpha = pixels[x, y]
                if alpha == 0:
                    pixels[x, y] = (0, 0, 0, 0)
                elif (red, green, blue) == KEY:
                    pixels[x, y] = (0, 0, 0, 0)
        exact_chroma = 0
        near_chroma = 0
        for red, green, blue, alpha in canvas.get_flattened_data():
            exact_chroma += int(alpha > 0 and (red, green, blue) == KEY)
            near_chroma += int(
                0 < alpha <= 128
                and (red - 255) ** 2 + green ** 2 + (blue - 255) ** 2 <= 48 ** 2
                and red - green >= 96
                and blue - green >= 96
                and abs(red - blue) <= 64
            )
        if exact_chroma or near_chroma:
            raise ValueError(
                f"{record['key']} retains chroma: exact={exact_chroma}, near={near_chroma}"
            )
        destination = staged_root / str(record["src"])
        save_png(canvas, destination)
        visible_box = canvas.getchannel("A").getbbox()
        metrics.append({
            "key": record["key"],
            "src": record["src"],
            "bounds": [visible_box[0], visible_box[1], visible_box[2] - 1, visible_box[3] - 1],
            "visiblePixels": sum(value > 0 for value in canvas.getchannel("A").get_flattened_data()),
        })
    return [{"sharedScale": scale, "sourceMaxBounds": [max_width, max_height]}, *metrics]


def write_manifest(destination: Path) -> None:
    records = frame_records()
    payload = {
        "schemaVersion": 1,
        "actor": "player",
        "frameSize": [64, 64],
        "anchor": [0.5, 1],
        "directions": list(DIRECTIONS),
        "clips": [
            {"name": name, "frameCount": count, "fps": fps, "loop": loop}
            for name, count, fps, loop in CLIPS
        ],
        "frames": [
            {key: record[key] for key in ("direction", "clip", "frame", "key", "src")}
            for record in records
        ],
    }
    write_json(payload, destination)


def render_contact_sheet(staged_root: Path, destination: Path) -> None:
    canvas = Image.new("RGBA", (1024, 256), (18, 14, 25, 255))
    records = frame_records()
    for index, record in enumerate(records):
        with Image.open(staged_root / str(record["src"])) as frame:
            row, column = divmod(index, 16)
            canvas.alpha_composite(frame.convert("RGBA"), (column * 64, row * 64))
    save_png(canvas, destination)


def output_rels() -> list[str]:
    return [
        LAYOUT_REL,
        CONTACT_REL,
        *(NORMALIZED_RELS[direction] for direction in DIRECTIONS),
        *(str(record["src"]) for record in frame_records()),
        MANIFEST_REL,
    ]


def create_lock(staged_root: Path, helper: Path, helper_hash: str, metrics: list[dict[str, object]]) -> dict[str, object]:
    return {
        "pipelineSchema": PIPELINE_SCHEMA,
        "pillowVersion": PILLOW_VERSION,
        "helper": {"path": helper.name, "sha256": helper_hash},
        "sourceOrder": list(DIRECTIONS),
        "sources": {
            direction: {
                "path": SOURCE_RELS[direction],
                "sha256": SOURCE_SHA256[direction],
                "width": SOURCE_SIZE[0],
                "height": SOURCE_SIZE[1],
                "mode": SOURCE_MODE,
            }
            for direction in DIRECTIONS
        },
        "normalization": {
            "frameSize": [FRAME_SIZE, FRAME_SIZE],
            "bottomCenterRoot": list(FRAME_ROOT),
            "maxFrameBounds": list(MAX_FRAME_BOUNDS),
            "meaningfulComponentArea": MEANINGFUL_COMPONENT_AREA,
        },
        "metrics": metrics,
        "outputs": {relative: sha256(staged_root / relative) for relative in output_rels()},
    }


def publish(pairs: list[tuple[Path, Path]], work_root: Path) -> None:
    backup_root = work_root / "backups"
    backup_root.mkdir(parents=True, exist_ok=True)
    backups: dict[Path, Path] = {}
    created: set[Path] = set()
    replaced: list[Path] = []
    try:
        for index, (_source, target) in enumerate(pairs):
            if target.exists():
                backup = backup_root / f"{index:03d}-{target.name}"
                shutil.copy2(target, backup)
                backups[target] = backup
            else:
                created.add(target)
        for source, target in pairs:
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(source, target)
            replaced.append(target)
    except Exception:
        for target in reversed(replaced):
            if target in backups:
                os.replace(backups[target], target)
            elif target in created:
                target.unlink(missing_ok=True)
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--update-lock", action="store_true")
    parser.add_argument(
        "--helper",
        type=Path,
        default=Path.home() / ".codex" / "skills" / ".system" / "imagegen" / "scripts" / "remove_chroma_key.py",
    )
    args = parser.parse_args()
    if args.check and args.update_lock:
        parser.error("--check and --update-lock are mutually exclusive")
    return args


def main() -> int:
    args = parse_args()
    root = project_root()
    work_parent = root / "art/work/player-animation-build"
    work_parent.mkdir(parents=True, exist_ok=True)
    work_root = Path(tempfile.mkdtemp(prefix=f"{os.getpid()}-", dir=work_parent))
    staged_root = work_root / "staged"
    try:
        verify_sources(root)
        helper_hash = verify_toolchain(args.helper)
        layout = {"schemaVersion": 1, "directionOrder": list(DIRECTIONS), "sources": {}}
        crops_by_direction: dict[str, list[Image.Image]] = {}
        for direction in DIRECTIONS:
            keyed, detected_key = key_source(
                root / SOURCE_RELS[direction],
                work_root / f"{direction}-keyed.png",
                args.helper,
            )
            _cleaned, report, crops = clean_and_analyze(direction, keyed, detected_key)
            layout["sources"][direction] = report
            crops_by_direction[direction] = crops
            composite_normalized_sheet(crops, staged_root / NORMALIZED_RELS[direction])
        write_json(layout, staged_root / LAYOUT_REL)
        frame_metrics = normalize_frames(crops_by_direction, staged_root)
        write_manifest(staged_root / MANIFEST_REL)
        render_contact_sheet(staged_root, staged_root / CONTACT_REL)
        next_lock = create_lock(staged_root, args.helper, helper_hash, frame_metrics)

        lock_path = root / LOCK_REL
        if args.update_lock:
            write_json(next_lock, staged_root / LOCK_REL, sort_keys=True)
            pairs = [(staged_root / relative, root / relative) for relative in output_rels()]
            pairs.append((staged_root / LOCK_REL, lock_path))
            publish(pairs, work_root)
            print(f"Published 64 player frames and updated {LOCK_REL}")
            return 0

        if not lock_path.is_file():
            raise FileNotFoundError(f"player animation lock is missing: {lock_path}; use --update-lock intentionally")
        expected = json.loads(lock_path.read_text(encoding="utf8"))
        if next_lock != expected:
            raise ValueError("rebuilt player animation assets do not match the committed lock")
        for relative, digest in expected["outputs"].items():
            target = root / relative
            if not target.is_file() or sha256(target) != digest:
                raise ValueError(f"published player output does not match lock: {relative}")
        print("Player animation lock verification passed")
        return 0
    finally:
        shutil.rmtree(work_root, ignore_errors=True)
        try:
            work_parent.rmdir()
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
