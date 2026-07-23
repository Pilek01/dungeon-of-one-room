#!/usr/bin/env python3
"""Build locked Beyond room backgrounds and pit autotiles from approved ImageGen sources."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "art/source/beyond-hd"
OUTPUT_ROOT = ROOT / "assets/hd"
LOCK_PATH = SOURCE_ROOT / "beyond-assets.lock.json"
SUPPORTED_PILLOW_VERSION = "12.1.1"
SOURCES = {
    "beyond-room-01-source-original.png": "c16427a95cd1272bf8985acba3446ee658f3b3b2edadacaae8fcef95ed51c117",
    "beyond-room-02-source-original.png": "82a50738b051803d8ba753dfd8d1b8da7f8c582a658ab63c23537c66c7110b74",
    "beyond-room-03-source-original.png": "7f0b1ede4331cc70521dc3b958e9ea1c31fd89a8958f9e041b9b3c9ed0cf2924",
    "beyond-boss-room-source-original.png": "7efd28ec198b26b4c5165b9273358ca9751b4d0630eb395968483028bd960bd7",
    "beyond-pit-atlas-v2-source-original.png": "1805a6c8e0526fe9788c0870da81ea022dfdd7699bc592353388ccd586795c98",
}
HAZARD_SOURCES = {
    "assets/hd/hazards/abyss/spikes-armed.png": "e10d3572a29ad418cb32b4aa696900dd41b056a9499283ac4079791f4708090e",
    "assets/hd/hazards/abyss/mine-unarmed.png": "94575354531633baa2b260491459e1618944b68bf89ff9d4f620eb7ee404e324",
    "assets/hd/hazards/abyss/mine-armed.png": "04e0ebe0f5fe07e12e8b9cef3b4e60911e01e774636022344e91f2390e1cdb9f",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_png(image: Image.Image, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, format="PNG", optimize=False, compress_level=9)


def validate_sources() -> None:
    if PILLOW_VERSION != SUPPORTED_PILLOW_VERSION:
        raise RuntimeError(f"Pillow {SUPPORTED_PILLOW_VERSION} required, found {PILLOW_VERSION}")
    for name, expected in SOURCES.items():
        source = SOURCE_ROOT / name
        if not source.is_file() or sha256(source) != expected:
            raise ValueError(f"source hash mismatch: {name}")
        with Image.open(source) as image:
            if image.size != (1254, 1254) or image.mode != "RGB":
                raise ValueError(f"source must be untouched 1254x1254 RGB: {name}")
    for relative, expected in HAZARD_SOURCES.items():
        source = ROOT / relative
        if not source.is_file() or sha256(source) != expected:
            raise ValueError(f"hazard source hash mismatch: {relative}")


def remove_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    output = []
    for red, green, blue, _alpha in rgba.get_flattened_data():
        keyed = red >= 215 and blue >= 215 and green <= 90 and abs(red - blue) <= 55
        output.append((red, green, blue, 0 if keyed else 255))
    rgba.putdata(output)
    return rgba


def contained(image: Image.Image, size: int = 64) -> Image.Image:
    alpha = image.getchannel("A")
    box = alpha.getbbox()
    if not box:
        raise ValueError("empty pit atlas slot")
    subject = image.crop(box)
    subject.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((size - subject.width) // 2, (size - subject.height) // 2))
    return canvas


def merge_open_connectors(tile: Image.Image, mask: int, void_texture: Image.Image) -> Image.Image:
    """Remove internal rims broadly enough that adjacent pit tiles read as one chasm."""
    connector = Image.new("L", tile.size, 0)
    draw = ImageDraw.Draw(connector)
    if mask & 1:  # top
        draw.rectangle((8, 0, 56, 46), fill=255)
    if mask & 2:  # right
        draw.rectangle((18, 8, 63, 56), fill=255)
    if mask & 4:  # bottom
        draw.rectangle((8, 18, 56, 63), fill=255)
    if mask & 8:  # left
        draw.rectangle((0, 8, 46, 56), fill=255)
    return Image.composite(void_texture, tile, connector)


def tint_beyond(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    output = []
    for red, green, blue, alpha in rgba.get_flattened_data():
        output.append((
            min(255, round(red * 0.78 + blue * 0.08)),
            min(255, round(green * 0.88 + blue * 0.05)),
            min(255, round(blue * 1.16 + 7)),
            alpha
        ))
    rgba.putdata(output)
    return rgba


def build(staged: Path) -> list[str]:
    outputs: list[str] = []
    normalized_root = staged / "art/source/beyond-hd"
    for index in range(1, 4):
        name = f"beyond-room-{index:02d}-source-original.png"
        with Image.open(SOURCE_ROOT / name) as image:
            normalized = image.resize((1024, 1024), Image.Resampling.LANCZOS)
            save_png(normalized, normalized_root / name.replace("original", "1024"))
            room = normalized.resize((576, 576), Image.Resampling.LANCZOS).convert("RGBA")
            relative = f"assets/hd/environment/beyond/room-{index:02d}.png"
            save_png(room, staged / relative)
            outputs.append(relative)
    with Image.open(SOURCE_ROOT / "beyond-boss-room-source-original.png") as image:
        normalized = image.resize((1024, 1024), Image.Resampling.LANCZOS)
        save_png(normalized, normalized_root / "beyond-boss-room-source-1024.png")
        relative = "assets/hd/environment/beyond/boss-room.png"
        save_png(normalized.resize((576, 576), Image.Resampling.LANCZOS).convert("RGBA"), staged / relative)
        outputs.append(relative)
    with Image.open(SOURCE_ROOT / "beyond-pit-atlas-v2-source-original.png") as image:
        atlas = image.resize((1024, 1024), Image.Resampling.LANCZOS)
        save_png(atlas, normalized_root / "beyond-pit-atlas-v2-source-1024.png")
        keyed = remove_magenta(atlas)
        tiles = []
        for mask in range(16):
            column, row = mask % 4, mask // 4
            slot = keyed.crop((column * 256, row * 256, (column + 1) * 256, (row + 1) * 256))
            tiles.append(contained(slot))
        void_texture = tiles[15].crop((20, 20, 44, 44)).resize((64, 64), Image.Resampling.BICUBIC)
        for mask, tile in enumerate(tiles):
            relative = f"assets/hd/hazards/beyond/pit-{mask:02d}.png"
            save_png(merge_open_connectors(tile, mask, void_texture), staged / relative)
            outputs.append(relative)
    for relative in HAZARD_SOURCES:
        with Image.open(ROOT / relative) as image:
            filename = Path(relative).name
            output_relative = f"assets/hd/hazards/beyond/{filename}"
            save_png(tint_beyond(image), staged / output_relative)
            outputs.append(output_relative)
    return outputs


def lock_payload(outputs: list[str], staged: Path) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "pillowVersion": PILLOW_VERSION,
        "sources": {name: digest for name, digest in sorted(SOURCES.items())},
        "hazardSources": {name: digest for name, digest in sorted(HAZARD_SOURCES.items())},
        "outputs": {relative: sha256(staged / relative) for relative in sorted(outputs)},
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--update-lock", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    validate_sources()
    with tempfile.TemporaryDirectory(prefix="beyond-assets-") as temporary:
        staged = Path(temporary)
        outputs = build(staged)
        payload = lock_payload(outputs, staged)
        if args.check:
            current = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
            if current != payload:
                raise ValueError("Beyond asset lock mismatch")
            for relative, digest in payload["outputs"].items():
                target = ROOT / relative
                if not target.is_file() or sha256(target) != digest:
                    raise ValueError(f"published output mismatch: {relative}")
            print("Beyond asset verification passed")
            return 0
        if not args.update_lock:
            parser.error("use --update-lock or --check")
        for relative in outputs:
            target = ROOT / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(staged / relative, target)
        for normalized in (staged / "art/source/beyond-hd").glob("*.png"):
            shutil.copy2(normalized, SOURCE_ROOT / normalized.name)
        LOCK_PATH.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"Published {len(outputs)} Beyond assets and immutable lock")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
