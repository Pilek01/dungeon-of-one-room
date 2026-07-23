#!/usr/bin/env python3
"""Build deterministic HD Gothic status emblems from two approved source atlases."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid

from PIL import Image, ImageDraw, __version__ as PILLOW_VERSION


PIPELINE_SCHEMA = 1
SUPPORTED_PILLOW_VERSION = "12.1.1"
HELPER_SHA256 = "7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea"
SOURCE_SIZE = (1254, 1254)
SOURCE_MODE = "RGB"
NORMALIZED_SIZE = (1024, 1024)
CELL_SIZE = 256
FINAL_SIZE = 64
SAFE_EXTENT = 56
ALPHA_THRESHOLD = 8

ROOT = Path(__file__).resolve().parents[1]
WORK_PARENT = ROOT / "art/work/status-emblems-hd"
LOCK_REL = "art/source/status-emblems-hd/status-emblems.lock.json"
CONTACT_REL = "art/source/status-emblems-hd/status-emblems-contact-sheet.png"
METADATA_REL = "assets/hd/ui/status/status-emblems.json"
LOCK_PATH = ROOT / LOCK_REL

SOURCES = {
    "combat": {
        "path": "art/source/status-emblems-hd/combat-status-atlas-source-original-v2.png",
        "sha256": "c35798a2584da1891da96bf92954ff2a66bb8223b4674fbc26ae9b35e640c85f",
    },
    "special": {
        "path": "art/source/status-emblems-hd/special-affix-atlas-source-original-v2.png",
        "sha256": "d58436ea48dbf29d40606539bb5abf6f91bc80a326c52cc4d2df51c008488016",
    },
}

COMBAT = (
    ("bleed", "harmful", "Bleed"),
    ("poison", "harmful", "Poison"),
    ("burn", "harmful", "Burn"),
    ("freeze", "harmful", "Freeze"),
    ("disorient", "harmful", "Disorient"),
    ("enemy_buff", "arcane", "Enemy Buff"),
    ("fury", "positive", "Fury"),
    ("attack_up", "positive", "Attack Up"),
    ("armor_up", "positive", "Armor Up"),
    ("max_hp_up", "positive", "Max HP Up"),
    ("lifesteal", "positive", "Lifesteal"),
    ("elixir", "positive", "Elixir"),
    ("shield", "protection", "Shield"),
    ("barrier", "protection", "Barrier"),
    ("second_chance", "positive", "Second Chance"),
    ("shrine_blessing", "positive", "Shrine Blessing"),
)
SPECIAL = (
    ("chaos", "special", "Chaos"),
    ("pact", "special", "Pact"),
    ("hunger", "harmful", "Hunger"),
    ("swap", "special", "Swap"),
    ("noise", "harmful", "Noise"),
    ("soul_harvest", "special", "Soul Harvest"),
    ("storm_sigil", "special", "Storm Sigil"),
    ("quickloader", "positive", "Quickloader"),
    ("chest_upgrade", "positive", "Chest Upgrade"),
    ("last_stand", "positive", "Last Stand"),
    ("elite", "elite", "Elite"),
    ("relentless", "affix", "Relentless"),
    ("juggernaut", "affix", "Juggernaut"),
    ("blooddrinker", "affix", "Blooddrinker"),
    ("thorned", "affix", "Thorned"),
    ("volatile", "affix", "Volatile"),
)
FAMILIES = {"combat": COMBAT, "special": SPECIAL}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def asset_filename(identifier: str) -> str:
    return identifier.replace("_", "-") + ".png"


def save_png(image: Image.Image, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, format="PNG", optimize=False, compress_level=9)


def write_json(payload: object, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf8",
        newline="\n",
    )


def verify_toolchain(helper: Path) -> str:
    if PILLOW_VERSION != SUPPORTED_PILLOW_VERSION:
        raise RuntimeError(
            f"Pillow {SUPPORTED_PILLOW_VERSION} required, received {PILLOW_VERSION}"
        )
    if not helper.is_file():
        raise FileNotFoundError(f"installed chroma helper does not exist: {helper}")
    actual = sha256(helper)
    if actual != HELPER_SHA256:
        raise RuntimeError(f"chroma helper SHA256 mismatch: {actual}")
    return actual


def verify_sources() -> None:
    for family, record in SOURCES.items():
        source = ROOT / record["path"]
        if not source.is_file():
            raise FileNotFoundError(f"missing {family} source atlas: {source}")
        actual = sha256(source)
        if actual != record["sha256"]:
            raise ValueError(f"{family} source SHA256 mismatch: {actual}")
        with Image.open(source) as image:
            if image.size != SOURCE_SIZE or image.mode != SOURCE_MODE:
                raise ValueError(
                    f"{family} source must remain {SOURCE_SIZE[0]}x{SOURCE_SIZE[1]} {SOURCE_MODE}"
                )


def key_atlas(source: Path, work: Path, helper: Path) -> Image.Image:
    normalized_path = work / f"{source.stem}-normalized-1024.png"
    keyed_path = work / f"{source.stem}-keyed.png"
    with Image.open(source) as image:
        normalized = image.convert("RGB").resize(NORMALIZED_SIZE, Image.Resampling.LANCZOS)
        save_png(normalized, normalized_path)
    result = subprocess.run(
        [
            os.fspath(Path(sys.executable)), os.fspath(helper),
            "--input", os.fspath(normalized_path),
            "--out", os.fspath(keyed_path),
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
    with Image.open(keyed_path) as image:
        keyed = image.convert("RGBA")
        keyed.load()
    pixels = keyed.load()
    for y in range(keyed.height):
        for x in range(keyed.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha <= 2 or (red >= 220 and green <= 48 and blue >= 220 and abs(red - blue) <= 48):
                pixels[x, y] = (0, 0, 0, 0)
    return keyed


def meaningful_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0).getbbox()


def detect_boundaries(atlas: Image.Image, axis: str) -> list[int]:
    alpha = atlas.getchannel("A")
    width, height = atlas.size
    length = width if axis == "x" else height
    cross = height if axis == "x" else width
    occupancy = []
    for primary in range(length):
        count = 0
        for secondary in range(cross):
            point = (primary, secondary) if axis == "x" else (secondary, primary)
            if alpha.getpixel(point) > ALPHA_THRESHOLD:
                count += 1
        occupancy.append(count)

    boundaries = [0]
    search_radius = CELL_SIZE // 3
    for nominal in (CELL_SIZE, CELL_SIZE * 2, CELL_SIZE * 3):
        start = max(boundaries[-1] + 16, nominal - search_radius)
        end = min(length - 16, nominal + search_radius)
        runs: list[tuple[int, int]] = []
        run_start = None
        for position in range(start, end + 1):
            if occupancy[position] == 0:
                if run_start is None:
                    run_start = position
            elif run_start is not None:
                runs.append((run_start, position))
                run_start = None
        if run_start is not None:
            runs.append((run_start, end + 1))
        if not runs:
            raise ValueError(f"no transparent {axis}-axis gutter near {nominal}")
        widest = max(
            runs,
            key=lambda run: (run[1] - run[0], -abs(((run[0] + run[1]) // 2) - nominal)),
        )
        if widest[1] - widest[0] < 8:
            raise ValueError(f"{axis}-axis gutter near {nominal} is too narrow: {widest}")
        boundaries.append((widest[0] + widest[1]) // 2)
    boundaries.append(length)
    return boundaries


def split_atlas(family: str, atlas: Image.Image) -> tuple[list[dict[str, object]], dict[str, list[int]]]:
    x_boundaries = detect_boundaries(atlas, "x")
    y_boundaries = detect_boundaries(atlas, "y")
    slots: list[dict[str, object]] = []
    for index, (identifier, tone, label) in enumerate(FAMILIES[family]):
        row, column = divmod(index, 4)
        box = (x_boundaries[column], y_boundaries[row], x_boundaries[column + 1], y_boundaries[row + 1])
        cell = atlas.crop(box)
        bbox = meaningful_bbox(cell)
        if bbox is None:
            raise ValueError(f"{identifier} source cell is blank")
        left, top, right, bottom = bbox
        if left < 4 or top < 4 or right > cell.width - 4 or bottom > cell.height - 4:
            raise ValueError(f"{identifier} meaningful alpha touches its source-cell boundary: {bbox}")
        slots.append({
            "id": identifier,
            "tone": tone,
            "label": label,
            "family": family,
            "row": row + 1,
            "column": column + 1,
            "cell": cell,
            "sourceCell": box,
            "sourceBounds": bbox,
        })
    return slots, {"x": x_boundaries, "y": y_boundaries}


def normalize_slots(slots: list[dict[str, object]]) -> float:
    maximum_extent = max(
        max(record["sourceBounds"][2] - record["sourceBounds"][0], record["sourceBounds"][3] - record["sourceBounds"][1])
        for record in slots
    )
    shared_scale = SAFE_EXTENT / maximum_extent
    for record in slots:
        left, top, right, bottom = record["sourceBounds"]
        crop = record["cell"].crop((left, top, right, bottom))
        width = max(1, round(crop.width * shared_scale))
        height = max(1, round(crop.height * shared_scale))
        resized = crop.resize((width, height), Image.Resampling.LANCZOS)
        final = Image.new("RGBA", (FINAL_SIZE, FINAL_SIZE), (0, 0, 0, 0))
        x = (FINAL_SIZE - width) // 2
        y = (FINAL_SIZE - height) // 2
        final.alpha_composite(resized, (x, y))
        final_pixels = final.load()
        for py in range(FINAL_SIZE):
            for px in range(FINAL_SIZE):
                red, green, blue, alpha = final_pixels[px, py]
                if alpha <= 2 or (red >= 220 and green <= 48 and blue >= 220 and abs(red - blue) <= 48):
                    final_pixels[px, py] = (0, 0, 0, 0)
        record["final"] = final
        record["finalBounds"] = meaningful_bbox(final)
    return shared_scale


def validate_final(record: dict[str, object]) -> None:
    image = record["final"]
    identifier = record["id"]
    if image.mode != "RGBA" or image.size != (FINAL_SIZE, FINAL_SIZE):
        raise ValueError(f"{identifier} final geometry is invalid")
    pixels = list(image.get_flattened_data())
    visible = [pixel for pixel in pixels if pixel[3] > ALPHA_THRESHOLD]
    coverage = len(visible) / (FINAL_SIZE * FINAL_SIZE)
    if not 0.04 <= coverage <= 0.8:
        raise ValueError(f"{identifier} alpha coverage is invalid: {coverage:.4f}")
    corners = [image.getpixel(point)[3] for point in ((0, 0), (63, 0), (0, 63), (63, 63))]
    if any(corners):
        raise ValueError(f"{identifier} corners are not transparent")
    if any(red >= 238 and green <= 22 and blue >= 238 for red, green, blue, _alpha in visible):
        raise ValueError(f"{identifier} retains near-key magenta")
    small = image.resize((20, 20), Image.Resampling.LANCZOS)
    if len(set(small.get_flattened_data())) < 12:
        raise ValueError(f"{identifier} collapses at 20px")


def build_contact_sheet(slots: list[dict[str, object]]) -> Image.Image:
    columns, rows = 8, 4
    cell_width, cell_height = 220, 150
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), (13, 11, 20))
    draw = ImageDraw.Draw(sheet)
    themes = ((34, 31, 35), (48, 27, 37), (21, 24, 38))
    for index, record in enumerate(slots):
        column, row = index % columns, index // columns
        left, top = column * cell_width, row * cell_height
        draw.rectangle((left, top, left + cell_width - 1, top + cell_height - 1), outline=(70, 62, 78))
        draw.text((left + 8, top + 7), f"{index + 1:02d} {record['id']}", fill=(228, 218, 196))
        final = record["final"]
        for theme_index, color in enumerate(themes):
            swatch_x = left + 8 + theme_index * 68
            swatch_y = top + 29
            swatch = Image.new("RGBA", (64, 64), (*color, 255))
            swatch.alpha_composite(final)
            sheet.paste(swatch.convert("RGB"), (swatch_x, swatch_y))
        preview = final.resize((20, 20), Image.Resampling.LANCZOS)
        preview_back = Image.new("RGBA", (28, 28), (*themes[2], 255))
        preview_back.alpha_composite(preview, (4, 4))
        sheet.paste(preview_back.convert("RGB"), (left + 8, top + 106))
        draw.text((left + 43, top + 112), "20 px", fill=(166, 155, 177))
    return sheet


def build(staged: Path, helper: Path, helper_hash: str) -> tuple[list[str], dict[str, object]]:
    keyed: dict[str, Image.Image] = {}
    for family, source in SOURCES.items():
        keyed[family] = key_atlas(ROOT / source["path"], staged / "work" / family, helper)
    split_results = {family: split_atlas(family, keyed[family]) for family in ("combat", "special")}
    slots = [record for family in ("combat", "special") for record in split_results[family][0]]
    layouts = {family: split_results[family][1] for family in ("combat", "special")}
    shared_scale = normalize_slots(slots)
    output_relatives: list[str] = []
    hashes: set[str] = set()
    metadata_records: list[dict[str, object]] = []
    for record in slots:
        validate_final(record)
        relative = f"assets/hd/ui/status/{asset_filename(record['id'])}"
        destination = staged / relative
        save_png(record["final"], destination)
        digest = sha256(destination)
        if digest in hashes:
            raise ValueError(f"duplicate final pixel/file identity: {record['id']}")
        hashes.add(digest)
        output_relatives.append(relative)
        metadata_records.append({
            "id": record["id"],
            "file": asset_filename(record["id"]),
            "tone": record["tone"],
            "label": record["label"],
            "sourceAtlas": record["family"],
            "row": record["row"],
            "column": record["column"],
            "sourceCell": list(record["sourceCell"]),
            "sourceBounds": list(record["sourceBounds"]),
            "alphaBounds": list(record["finalBounds"]),
            "sharedScale": round(shared_scale, 8),
        })
    metadata = {
        "schema": PIPELINE_SCHEMA,
        "size": [FINAL_SIZE, FINAL_SIZE],
        "sharedScale": round(shared_scale, 8),
        "detectedLayout": layouts,
        "emblems": metadata_records,
    }
    write_json(metadata, staged / METADATA_REL)
    output_relatives.append(METADATA_REL)
    save_png(build_contact_sheet(slots), staged / CONTACT_REL)
    output_relatives.append(CONTACT_REL)
    lock = {
        "pipelineSchema": PIPELINE_SCHEMA,
        "pillowVersion": PILLOW_VERSION,
        "helper": {"path": helper.name, "sha256": helper_hash},
        "sourceSize": list(SOURCE_SIZE),
        "normalizedSize": list(NORMALIZED_SIZE),
        "finalSize": [FINAL_SIZE, FINAL_SIZE],
        "sharedScale": round(shared_scale, 8),
        "sources": {
            family: {"path": source["path"], "sha256": source["sha256"]}
            for family, source in sorted(SOURCES.items())
        },
        "outputs": {relative: sha256(staged / relative) for relative in sorted(output_relatives)},
    }
    return output_relatives, lock


def publish(pairs: list[tuple[Path, Path]], work: Path) -> None:
    backup = work / "backup"
    published: list[tuple[Path, Path | None]] = []
    try:
        for index, (source, target) in enumerate(pairs):
            target.parent.mkdir(parents=True, exist_ok=True)
            prior = None
            if target.exists():
                prior = backup / f"{index:04d}-{target.name}"
                prior.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, prior)
            shutil.copy2(source, target)
            published.append((target, prior))
    except BaseException:
        for target, prior in reversed(published):
            if prior is None:
                target.unlink(missing_ok=True)
            else:
                shutil.copy2(prior, target)
        raise


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--update-lock", action="store_true")
    parser.add_argument(
        "--helper",
        type=Path,
        default=Path.home() / ".codex/skills/.system/imagegen/scripts/remove_chroma_key.py",
    )
    args = parser.parse_args()

    verify_sources()
    helper_hash = verify_toolchain(args.helper)
    WORK_PARENT.mkdir(parents=True, exist_ok=True)
    work = WORK_PARENT / uuid.uuid4().hex
    staged = work / "staged"
    try:
        output_relatives, payload = build(staged, args.helper, helper_hash)
        if args.check:
            if not LOCK_PATH.is_file():
                raise FileNotFoundError(f"missing status emblem lock: {LOCK_PATH}")
            expected = json.loads(LOCK_PATH.read_text(encoding="utf8"))
            if expected != payload:
                raise ValueError("staged status emblems do not match the committed lock")
            print(f"Status emblem lock verification passed: {LOCK_PATH}")
            return 0

        staged_lock = staged / LOCK_REL
        write_json(payload, staged_lock)
        pairs = [(staged / relative, ROOT / relative) for relative in output_relatives]
        pairs.append((staged_lock, LOCK_PATH))
        publish(pairs, work)
        print("Published 32 HD status emblems, metadata, and contact sheet")
        print(f"Updated status emblem lock: {LOCK_PATH}")
        return 0
    finally:
        shutil.rmtree(work, ignore_errors=True)
        try:
            WORK_PARENT.rmdir()
        except OSError:
            pass


if __name__ == "__main__":
    sys.exit(main())
