#!/usr/bin/env python3
"""Build four approved directional HD boss profiles from sixteen source sheets."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile

from PIL import Image, ImageDraw, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parents[1]
PLAYER_BUILDER = ROOT / "scripts/build-player-animation-assets.py"
PLAYER_BUILDER_SHA256 = "3ada7d7ea2fd12ecbce752a7cdab0c0acb168eb0537bbe725f0dc2cd7e22bf70"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


if not PLAYER_BUILDER.is_file() or sha256(PLAYER_BUILDER) != PLAYER_BUILDER_SHA256:
    raise RuntimeError("pinned player builder identity mismatch before import")
_SPEC = importlib.util.spec_from_file_location("_boss_player_asset_pipeline", PLAYER_BUILDER)
if _SPEC is None or _SPEC.loader is None:
    raise RuntimeError("cannot load the pinned player sprite pipeline")
PIPE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(PIPE)

SCHEMA_VERSION = 1
SUPPORTED_PILLOW_VERSION = "12.1.1"
HELPER_SHA256 = "7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea"
KEY = (255, 0, 255)
DIRECTIONS = ("south", "north", "east", "west")
SLOTS = tuple(f"R{row}C{column}" for row in range(1, 5) for column in range(1, 5))
MEANINGFUL_AREA = 500
PROFILES = {
    "vault-guardian": {
        "type": "guardian", "phase": None, "action": "attack", "size": 128,
        "rationale": "A two-tile 128 px frame preserves the monumental vault sentinel silhouette while retaining a bottom-center gameplay root.",
    },
    "warden-biome-descent": {
        "type": "warden", "key": "warden.descent", "biome": "descent", "phase": None, "action": "cast", "size": 160,
        "rationale": "The broad weaponless Descent Warden uses the existing 160 px milestone-boss footprint and shared bottom-center gameplay root.",
    },
    "warden-biome-corruption": {
        "type": "warden", "key": "warden.corruption", "biome": "corruption", "phase": None, "action": "cast", "size": 160,
        "rationale": "The rooted Corruption Warden uses the existing 160 px milestone-boss footprint and shared bottom-center gameplay root.",
    },
    "warden-biome-abyss": {
        "type": "warden", "key": "warden.abyss", "biome": "abyss", "phase": None, "action": "cast", "size": 160,
        "rationale": "The void-crystal Abyss Warden uses the existing 160 px milestone-boss footprint and shared bottom-center gameplay root.",
    },
    "blacksmith-guardian": {
        "type": "blacksmith_guardian", "phase": None, "action": "attack", "size": 128,
        "rationale": "A two-tile 128 px frame keeps the forge hammer, furnace armor and barrier-adjacent silhouette readable without changing collision.",
    },
    "warden/phase-1": {
        "type": "warden", "phase": 1, "action": "cast", "size": 160,
        "rationale": "A 160 px frame gives the first Warden phase controlled overhang for crown, mantle and ritual casts while anchoring to its tile.",
    },
    "warden/phase-2": {
        "type": "warden", "phase": 2, "action": "cast", "size": 192,
        "rationale": "A three-tile 192 px frame communicates the transformed final phase and Void Aegis scale while preserving the original logical position.",
    },
}
CLIP_ROWS = (("idle", 4, 4, True), ("move", 4, 8, True), ("action", 4, 10, False), ("hit", 2, 10, False), ("death", 2, 6, False))
LOCK_REL = "art/source/boss-hd/boss-animation-assets.lock.json"
LAYOUT_REL = "art/source/boss-hd/boss-animation-source-layout.json"
CONTACT_REL = "art/source/boss-hd/boss-animation-contact-sheet.png"


def slug(profile: str) -> str:
    return profile.replace("/", "-")


def write_json(value: object, path: Path, *, sort_keys: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=sort_keys) + "\n", encoding="utf8", newline="\n")


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False, compress_level=9)


def verify_toolchain(helper: Path) -> dict[str, str]:
    if PILLOW_VERSION != SUPPORTED_PILLOW_VERSION:
        raise RuntimeError(f"unsupported Pillow {PILLOW_VERSION}; expected {SUPPORTED_PILLOW_VERSION}")
    if not helper.is_file() or sha256(helper) != HELPER_SHA256:
        raise RuntimeError(f"chroma helper identity mismatch: {helper}")
    if not PLAYER_BUILDER.is_file() or sha256(PLAYER_BUILDER) != PLAYER_BUILDER_SHA256:
        raise RuntimeError("pinned player builder identity mismatch")
    return {"chromaHelperSha256": HELPER_SHA256, "playerBuilderSha256": PLAYER_BUILDER_SHA256}


def source_rel(profile: str, direction: str) -> str:
    name = slug(profile)
    return f"art/source/boss-hd/{name}/{name}-animation-{direction}-source-1024.png"


def normalized_rel(profile: str, direction: str) -> str:
    name = slug(profile)
    return f"art/source/boss-hd/{name}/{name}-animation-{direction}-normalized-1024.png"


def manifest_rel(profile: str) -> str:
    return f"assets/hd/bosses/{profile}/boss-manifest.json"


def clips_for(profile: str):
    action = str(PROFILES[profile]["action"])
    return tuple((action if name == "action" else name, count, fps, loop) for name, count, fps, loop in CLIP_ROWS)


def frame_records(profile: str | None = None) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for name in ((profile,) if profile else tuple(PROFILES)):
        spec = PROFILES[name]
        phase_part = f".phase{spec['phase']}" if spec["phase"] else ""
        visual_key = str(spec.get("key") or f"{spec['type']}{phase_part}")
        for direction in DIRECTIONS:
            slot = 0
            for clip, count, _fps, _loop in clips_for(name):
                for frame in range(1, count + 1):
                    suffix = f"{frame:02d}"
                    records.append({
                        "profile": name, "type": spec["type"], "phase": spec["phase"], "direction": direction,
                        "clip": clip, "frame": frame, "slot": slot,
                        "key": f"boss.{visual_key}.{direction}.{clip}.{suffix}",
                        "src": f"assets/hd/bosses/{name}/frames/{direction}-{clip}-{suffix}.png",
                    })
                    slot += 1
    return records


def verify_source_files() -> list[str]:
    paths = [source_rel(profile, direction) for profile in PROFILES for direction in DIRECTIONS]
    missing = [relative for relative in paths if not (ROOT / relative).is_file()]
    if missing:
        raise FileNotFoundError("missing future boss source sheets; generation must finish before building:\n" + "\n".join(missing))
    for relative in paths:
        with Image.open(ROOT / relative) as source:
            if source.mode != "RGB" or source.width != source.height or not (1024 <= source.width <= 2048):
                raise ValueError(f"{relative}: expected square 1024..2048 RGB source")
    return paths


def clean_small(image: Image.Image):
    components = PIPE.connected_components(image)
    meaningful = [item for item in components if int(item["area"]) >= MEANINGFUL_AREA]
    small = [item for item in components if int(item["area"]) < MEANINGFUL_AREA]
    cleaned = image.copy()
    pixels = cleaned.load()
    for component in small:
        for index in component["points"]:
            pixels[index % cleaned.width, index // cleaned.width] = (0, 0, 0, 0)
    return cleaned, components, meaningful, small


def analyze_sheet(label: str, image: Image.Image, detected_key: str):
    cleaned, components, meaningful, small = clean_small(image)
    # A weapon may be visually detached in a death pose while still belonging to
    # one unambiguous semantic cell. The contract is exactly sixteen poses, not
    # necessarily sixteen connected islands. Multiple islands are accepted only
    # when they cluster into one occupied slot and never cross a slot boundary.
    if len(meaningful) < 16:
        raise ValueError(f"{label}: expected exactly 16 meaningful components or a validated detached equipment component, received {len(meaningful)}")
    cell_width = cleaned.width / 4
    cell_height = cleaned.height / 4
    column_centers = [(column + 0.5) * cell_width for column in range(4)]
    row_centers = [(row + 0.5) * cell_height for row in range(4)]
    column_assignment: dict[int, int] = {}
    row_assignment: dict[int, int] = {}
    for index, component in enumerate(meaningful):
        left, top, right, bottom = component["bounds"]
        cx, cy = (left + right) / 2, (top + bottom) / 2
        column_assignment[index] = min(3, max(0, int(cx / cell_width)))
        row_assignment[index] = min(3, max(0, int(cy / cell_height)))
    slots = {name: [] for name in SLOTS}
    for index, component in enumerate(meaningful):
        row, column = row_assignment[index], column_assignment[index]
        left, top, right, bottom = component["bounds"]
        cx, cy = (left + right) / 2, (top + bottom) / 2
        column_edge_distance = min(cx % cell_width, cell_width - (cx % cell_width))
        row_edge_distance = min(cy % cell_height, cell_height - (cy % cell_height))
        if column_edge_distance < 8 or row_edge_distance < 8:
            raise ValueError(f"{label}: ambiguous component centroid in semantic grid")
        slots[f"R{row + 1}C{column + 1}"].append(component)
    invalid = [name for name, values in slots.items() if len(values) < 1]
    if invalid:
        raise ValueError(f"{label}: expected one semantic pose per slot: {invalid}")
    crossing = []
    for index, component in enumerate(meaningful):
        row, column = row_assignment[index], column_assignment[index]
        left_edge, right_edge = column * cell_width, (column + 1) * cell_width
        top_edge, bottom_edge = row * cell_height, (row + 1) * cell_height
        outside = sum(
            1 for point in component["points"]
            if not (left_edge <= point % cleaned.width < right_edge and top_edge <= point // cleaned.width < bottom_edge)
        )
        if outside / max(1, int(component["area"])) > 0.15:
            crossing.append(component)
    if crossing:
        raise ValueError(f"{label}: {len(crossing)} components materially cross semantic slot bounds")
    crops: list[Image.Image] = []
    slot_report: dict[str, object] = {}
    for name in SLOTS:
        slot_components = slots[name]
        left = min(component["bounds"][0] for component in slot_components)
        top = min(component["bounds"][1] for component in slot_components)
        right = max(component["bounds"][2] for component in slot_components)
        bottom = max(component["bounds"][3] for component in slot_components)
        isolated = Image.new("RGBA", cleaned.size, (0, 0, 0, 0))
        source_pixels, target_pixels = cleaned.load(), isolated.load()
        for component in slot_components:
            for index in component["points"]:
                x, y = index % cleaned.width, index // cleaned.width
                target_pixels[x, y] = source_pixels[x, y]
        crops.append(isolated.crop((max(0, left - 12), max(0, top - 12), min(cleaned.width, right + 13), min(cleaned.height, bottom + 13))))
        slot_report[name] = {
            "area": sum(int(component["area"]) for component in slot_components),
            "bounds": [left, top, right, bottom],
            "componentCount": len(slot_components),
        }
    return crops, {
        "helperDetectedKey": detected_key, "semanticLayout": "4x4", "rawComponentCount": len(components),
        "meaningfulComponentCount": len(meaningful), "semanticPoseCount": 16,
        "detachedEquipmentComponentCount": max(0, len(meaningful) - 16),
        "removedSmallComponentCount": len(small), "crossingComponentCount": 0,
        "columnCenters": [round(value, 3) for value in column_centers], "rowCenters": [round(value, 3) for value in row_centers], "slots": slot_report,
    }


def composite_normalized(crops: list[Image.Image], destination: Path) -> None:
    sheet = Image.new("RGB", (1024, 1024), KEY)
    for index, crop in enumerate(crops):
        bounds = crop.getchannel("A").getbbox()
        if bounds is None:
            raise ValueError(f"normalized source slot {index + 1} is empty")
        silhouette = crop.crop(bounds)
        scale = min(224 / silhouette.width, 224 / silhouette.height)
        size = (max(1, round(silhouette.width * scale)), max(1, round(silhouette.height * scale)))
        resized = silhouette.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")
        cell = Image.new("RGB", (256, 256), KEY)
        cell.paste(resized.convert("RGB"), ((256 - size[0]) // 2, (256 - size[1]) // 2), resized.getchannel("A"))
        row, column = divmod(index, 4)
        sheet.paste(cell, (column * 256, row * 256))
    save_png(sheet, destination)


def clean_final(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            near = red >= 240 and blue >= 240 and green <= 20
            soft_near = alpha <= 128 and (red - 255) ** 2 + green ** 2 + (blue - 255) ** 2 <= 48 ** 2
            if alpha == 0 or (red, green, blue) == KEY or near or soft_near:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def reject_near_chroma(label: str, image: Image.Image) -> None:
    exact = near = 0
    for red, green, blue, alpha in image.get_flattened_data():
        exact += int(alpha > 0 and (red, green, blue) == KEY)
        near += int(alpha > 0 and red >= 240 and blue >= 240 and green <= 20)
    if exact or near:
        raise ValueError(f"{label}: near chroma residue exact={exact} near={near}")


def normalize_profile_frames(profile: str, crops_by_direction: dict[str, list[Image.Image]], staged: Path) -> dict[str, object]:
    frame_size = int(PROFILES[profile]["size"])
    root = (frame_size // 2, frame_size - 4)
    maximum = frame_size - 10
    bounds: dict[tuple[str, int], tuple[int, int, int, int]] = {}
    max_width = max_height = 0
    for direction, crops in crops_by_direction.items():
        for index, crop in enumerate(crops):
            box = crop.getchannel("A").getbbox()
            if box is None:
                raise ValueError(f"{profile}/{direction}/slot-{index + 1}: empty")
            bounds[(direction, index)] = box
            max_width = max(max_width, box[2] - box[0])
            max_height = max(max_height, box[3] - box[1])
    scale = min(maximum / max_width, maximum / max_height)
    metrics = []
    for record in frame_records(profile):
        direction, slot = str(record["direction"]), int(record["slot"])
        silhouette = crops_by_direction[direction][slot].crop(bounds[(direction, slot)])
        width, height = max(1, round(silhouette.width * scale)), max(1, round(silhouette.height * scale))
        resized = silhouette.convert("RGBa").resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
        frame = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
        frame.alpha_composite(resized, (root[0] - width // 2, root[1] - height + 1))
        frame = clean_final(frame)
        reject_near_chroma(str(record["key"]), frame)
        visible = frame.getchannel("A").getbbox()
        if visible is None or visible[3] < frame_size - 8:
            raise ValueError(f"{record['key']}: bottom-center root drift {visible}")
        save_png(frame, staged / str(record["src"]))
        metrics.append({"key": record["key"], "bounds": list(visible)})
    return {"sharedScale": scale, "bottomCenterRoot": list(root), "sourceMaxBounds": [max_width, max_height], "frames": metrics}


def source_identity(profile: str) -> dict[str, object]:
    sheets = {direction: {"path": source_rel(profile, direction), "sha256": sha256(ROOT / source_rel(profile, direction))} for direction in DIRECTIONS}
    aggregate = hashlib.sha256("".join(str(sheets[direction]["sha256"]) for direction in DIRECTIONS).encode("ascii")).hexdigest()
    return {"sha256": aggregate, "sheets": sheets}


def write_manifest(profile: str, staged: Path) -> str:
    spec = PROFILES[profile]
    relative = manifest_rel(profile)
    frames = []
    for record in frame_records(profile):
        item = {key: record[key] for key in ("type", "direction", "clip", "frame", "key", "src")}
        if spec["phase"]:
            item["phase"] = spec["phase"]
        frames.append(item | {"group": "bosses", "critical": True})
    payload = {
        "schemaVersion": 1, "profile": profile, "type": spec["type"], "frameSize": [spec["size"], spec["size"]],
        "renderSize": [spec["size"], spec["size"]], "renderSizeRationale": spec["rationale"], "anchor": [0.5, 1],
        "group": "bosses", "clips": [{"name": name, "frameCount": count, "fps": fps, "loop": loop} for name, count, fps, loop in clips_for(profile)],
        "source": source_identity(profile), "frames": frames,
    }
    if spec["phase"]:
        payload["phase"] = spec["phase"]
    if spec.get("biome"):
        payload["biome"] = spec["biome"]
    write_json(payload, staged / relative)
    return relative


def overlay_frame(name: str, index: int) -> Image.Image:
    image = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")
    pulse = (0, 5, 10, 5)[index]
    if name == "blacksmith-barrier":
        draw.ellipse((20 - pulse, 62 - pulse, 172 + pulse, 188), outline=(255, 153, 54, 170), width=5)
        draw.arc((30, 72, 162, 184), 190 + index * 12, 350 + index * 12, fill=(255, 226, 150, 120), width=8)
        draw.polygon(((34, 144), (50, 94), (64, 170)), fill=(196, 78, 30, 90))
        draw.polygon(((158, 144), (142, 94), (128, 170)), fill=(196, 78, 30, 90))
    else:
        draw.ellipse((18 - pulse, 42 - pulse, 174 + pulse, 190), outline=(127, 76, 255, 180), width=6)
        draw.arc((30, 54, 162, 184), 15 + index * 18, 185 + index * 18, fill=(207, 175, 255, 135), width=8)
        draw.ellipse((60, 104, 132, 180), fill=(66, 23, 119, 45), outline=(174, 113, 255, 95), width=3)
    return image


def write_overlays(staged: Path) -> list[str]:
    outputs: list[str] = []
    overlays = {
        "blacksmith-barrier": "boss.blacksmith_guardian.overlay.barrier",
        "warden-void-aegis": "boss.warden.overlay.voidaegis",
    }
    for name, prefix in overlays.items():
        frames = []
        for index in range(4):
            suffix = f"{index + 1:02d}"
            relative = f"assets/hd/bosses/overlays/frames/{name}-{suffix}.png"
            frame = overlay_frame(name, index)
            reject_near_chroma(f"{name}-{suffix}", frame)
            save_png(frame, staged / relative)
            outputs.append(relative)
            frames.append({"key": f"{prefix}.{suffix}", "src": relative, "group": "bosses", "critical": False})
        manifest = f"assets/hd/bosses/overlays/{name}-manifest.json"
        write_json({"schemaVersion": 1, "name": name, "frameSize": [192, 192], "renderSize": [192, 192], "anchor": [0.5, 1], "group": "bosses", "frames": frames}, staged / manifest)
        outputs.append(manifest)
    return outputs


def render_contacts(staged: Path) -> list[str]:
    outputs: list[str] = []
    combined = Image.new("RGBA", (16 * 96, len(PROFILES) * 4 * 96), (18, 14, 25, 255))
    for profile_index, profile in enumerate(PROFILES):
        profile_contact = Image.new("RGBA", (16 * 96, 4 * 96), (18, 14, 25, 255))
        for index, record in enumerate(frame_records(profile)):
            with Image.open(staged / str(record["src"])) as source:
                frame = source.convert("RGBA")
            frame.thumbnail((92, 92), Image.Resampling.LANCZOS)
            row, column = divmod(index, 16)
            position = (column * 96 + (96 - frame.width) // 2, row * 96 + 96 - frame.height)
            profile_contact.alpha_composite(frame, position)
            combined.alpha_composite(frame, (position[0], profile_index * 4 * 96 + position[1]))
        relative = f"art/source/boss-hd/{slug(profile)}/{slug(profile)}-animation-contact-sheet.png"
        save_png(profile_contact, staged / relative)
        outputs.append(relative)
    save_png(combined, staged / CONTACT_REL)
    outputs.append(CONTACT_REL)
    return outputs


def publish(pairs: list[tuple[Path, Path]], work: Path) -> None:
    backups: dict[Path, Path] = {}
    created: set[Path] = set()
    replaced: list[Path] = []
    backup_root = work / "backups"
    backup_root.mkdir(parents=True, exist_ok=True)
    try:
        for index, (_source, target) in enumerate(pairs):
            if target.exists():
                backup = backup_root / f"{index:04d}-{target.name}"
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
    parser.add_argument("--helper", type=Path, default=Path.home() / ".codex/skills/.system/imagegen/scripts/remove_chroma_key.py")
    args = parser.parse_args()
    if args.check and args.update_lock:
        parser.error("--check and --update-lock are mutually exclusive")
    return args


def main() -> int:
    args = parse_args()
    source_paths = verify_source_files()
    toolchain = verify_toolchain(args.helper)
    work_parent = ROOT / "art/work/boss-animation-build"
    work_parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix=f"{os.getpid()}-", dir=work_parent))
    staged = work / "staged"
    try:
        def key_one(relative: str):
            label = Path(relative).stem
            return relative, PIPE.key_source(ROOT / relative, work / f"{label}-keyed.png", args.helper)
        with ThreadPoolExecutor(max_workers=4) as executor:
            keyed_sources = dict(executor.map(key_one, source_paths))
        layout: dict[str, object] = {"schemaVersion": 1, "sources": {}}
        metrics: dict[str, object] = {}
        output_rels: list[str] = []
        for profile in PROFILES:
            crops_by_direction: dict[str, list[Image.Image]] = {}
            for direction in DIRECTIONS:
                relative = source_rel(profile, direction)
                keyed, detected = keyed_sources[relative]
                crops, report = analyze_sheet(f"{profile}/{direction}", keyed, detected)
                report["identity"] = {"path": relative, "sha256": sha256(ROOT / relative)}
                layout["sources"][f"{profile}/{direction}"] = report
                crops_by_direction[direction] = crops
                normalized = normalized_rel(profile, direction)
                composite_normalized(crops, staged / normalized)
                output_rels.append(normalized)
            metrics[profile] = normalize_profile_frames(profile, crops_by_direction, staged)
            output_rels.extend(str(record["src"]) for record in frame_records(profile))
            output_rels.append(write_manifest(profile, staged))
        write_json(layout, staged / LAYOUT_REL)
        output_rels.append(LAYOUT_REL)
        output_rels.extend(write_overlays(staged))
        output_rels.extend(render_contacts(staged))
        next_lock = {
            "schemaVersion": SCHEMA_VERSION, "chromaKey": "#ff00ff", "pillowVersion": PILLOW_VERSION,
            "toolchain": toolchain, "sourceSheets": {relative: sha256(ROOT / relative) for relative in source_paths},
            "profiles": {profile: {"frameSize": [spec["size"], spec["size"]], "anchor": [0.5, 1], "actionClip": spec["action"], "metrics": metrics[profile]} for profile, spec in PROFILES.items()},
            "normalization": {"semanticLayout": "strict 4x4/16", "globalScaleAndRootPerProfile": True, "meaningfulComponentArea": MEANINGFUL_AREA, "nearChromaPolicy": "zero visible exact or near #ff00ff"},
            "outputs": {relative: sha256(staged / relative) for relative in output_rels},
        }
        lock_path = ROOT / LOCK_REL
        if args.update_lock:
            write_json(next_lock, staged / LOCK_REL, sort_keys=True)
            publish([(staged / relative, ROOT / relative) for relative in output_rels] + [(staged / LOCK_REL, lock_path)], work)
            print(f"Published {len(frame_records())} boss frames, eight procedural overlays, manifests and immutable source/build lock")
            return 0
        if not lock_path.is_file():
            raise FileNotFoundError(f"missing {LOCK_REL}; use --update-lock intentionally")
        expected = json.loads(lock_path.read_text(encoding="utf8"))
        if next_lock != expected:
            raise ValueError("rebuilt boss animation assets do not match committed lock")
        for relative, digest in expected["outputs"].items():
            if not (ROOT / relative).is_file() or sha256(ROOT / relative) != digest:
                raise ValueError(f"published boss output changed: {relative}")
        print("Boss animation lock verification passed")
        return 0
    finally:
        shutil.rmtree(work, ignore_errors=True)
        try:
            work_parent.rmdir()
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
