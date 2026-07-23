#!/usr/bin/env python3
"""Prepare immutable Task 7 enemy seeds and 4x4 ImageGen edit canvases."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, __version__ as PILLOW_VERSION


SCHEMA_VERSION = 1
SUPPORTED_PILLOW_VERSION = "12.1.1"
HELPER_SHA256 = "7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea"
KEY = (255, 0, 255)
FRAME_SIZE = 64
FRAME_ROOT = (32, 60)
SOURCE_SIZE = (1254, 1254)
SOURCE_MODE = "RGB"
DIRECTIONS = ("south", "north", "east", "west")
ROSTER = ("slime", "skeleton", "brute", "acolyte", "skitter", "totem", "otter")
SOURCE_SHA256 = {
    "slime": "2d2ae351f3bb0f164c2ea3bf9bbd9ccbaced0f49830c970a903dbb66a1ba2ca1",
    "skeleton": "9f91dd5f623f43d54104cfc194d49cf7c4ca1c9c22f98707d20ce50aadcc94ae",
    "brute": "b78c700899430fe2d53b440b7bfc50ffcff269a51ceaa288590e9f73e246859e",
    "acolyte": "f6ea1677b38b08ad353e5b7453b2f20f65e58c81ad0afec422fc9bc2d5d755cf",
    "skitter": "bee13c818e6c7bd52ebc4c49cf203ba381869c768ec97fb13ae1b538ecf09226",
    "totem": "fddec3716f813899ae5276a02d6e3ee7292cdfff7a53cbcf006dbcbb7caa9a12",
    "otter": "e0a8f617973ae1f1945eb13ceca86cc2ba82b58cc50a6393d2531dfa1c5bab77",
}
MAX_BOUNDS = {
    "slime": (56, 34), "skeleton": (42, 56), "brute": (60, 56),
    "acolyte": (44, 58), "skitter": (58, 38), "totem": (46, 58), "otter": (46, 56),
}
SEED_REL = {type_: f"art/source/enemy-hd/{type_}-south-idle-seed.png" for type_ in ROSTER}
KEYED_REL = {type_: f"art/source/enemy-hd/{type_}/{type_}-south-idle-keyed.png" for type_ in ROSTER}
PREVIEW_REL = {type_: f"art/source/enemy-hd/{type_}/{type_}-south-idle-preview-64.png" for type_ in ROSTER}
CANVAS_REL = {
    (type_, direction): f"art/source/enemy-hd/{type_}/{type_}-animation-{direction}-edit-canvas-1024.png"
    for type_ in ROSTER for direction in (("base",) if type_ == "totem" else DIRECTIONS)
}
PROMPTS_REL = "art/briefs/enemy-hd-direction-prompts.json"
CONTACT_REL = "art/source/enemy-hd/enemy-seed-contact-sheet-64.png"
LOCK_REL = "art/source/enemy-hd/enemy-seed-prep.lock.json"


def root() -> Path:
    return Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False, compress_level=9)


def write_json(value: object, path: Path, *, sorted_keys: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=sorted_keys) + "\n", encoding="utf8", newline="\n")


def verify_toolchain(helper: Path) -> str:
    if PILLOW_VERSION != SUPPORTED_PILLOW_VERSION:
        raise RuntimeError(f"unsupported Pillow {PILLOW_VERSION}; expected {SUPPORTED_PILLOW_VERSION}")
    if not helper.is_file() or sha256(helper) != HELPER_SHA256:
        raise RuntimeError(f"chroma helper identity mismatch: {helper}")
    return HELPER_SHA256


def verify_seeds(project: Path) -> None:
    for type_ in ROSTER:
        source = project / SEED_REL[type_]
        if not source.is_file() or sha256(source) != SOURCE_SHA256[type_]:
            raise ValueError(f"immutable {type_} seed identity mismatch: {source}")
        with Image.open(source) as image:
            if image.size != SOURCE_SIZE or image.mode != SOURCE_MODE:
                raise ValueError(f"{type_} seed must be 1254x1254 RGB")


def parse_key(stdout: str) -> str:
    match = re.search(r"^Key color:\s*(#[0-9a-fA-F]{6})\s*$", stdout, flags=re.MULTILINE)
    if not match:
        raise RuntimeError("chroma helper omitted its detected key diagnostic")
    return match.group(1).lower()


def clean_chroma(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            near = (
                0 < alpha <= 128
                and (red - 255) ** 2 + green ** 2 + (blue - 255) ** 2 <= 48 ** 2
                and red - green >= 96 and blue - green >= 96 and abs(red - blue) <= 64
            )
            if alpha == 0 or (red, green, blue) == KEY or near:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def key_seed(source: Path, destination: Path, helper: Path) -> tuple[Image.Image, str]:
    raw = destination.with_name(destination.stem + "-helper.png")
    raw.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run([
        sys.executable, os.fspath(helper), "--input", os.fspath(source), "--out", os.fspath(raw),
        "--auto-key", "border", "--soft-matte", "--transparent-threshold", "12",
        "--opaque-threshold", "220", "--despill", "--force",
    ], capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout or f"chroma helper failed for {source}")
    with Image.open(raw) as image:
        keyed = clean_chroma(image)
    raw.unlink(missing_ok=True)
    bounds = keyed.getchannel("A").getbbox()
    if bounds is None or keyed.getpixel((0, 0))[3] or keyed.getpixel((keyed.width - 1, keyed.height - 1))[3]:
        raise ValueError(f"invalid keyed seed silhouette: {source}")
    save_png(keyed, destination)
    return keyed, parse_key(result.stdout)


def normalize(type_: str, keyed: Image.Image, destination: Path) -> tuple[Image.Image, dict[str, object]]:
    bounds = keyed.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError(f"{type_} seed has no visible pixels")
    crop = keyed.crop(bounds)
    max_width, max_height = MAX_BOUNDS[type_]
    scale = min(max_width / crop.width, max_height / crop.height)
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    resized = clean_chroma(crop.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA"))
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    left = FRAME_ROOT[0] - size[0] // 2
    top = FRAME_ROOT[1] - size[1] + 1
    frame.alpha_composite(resized, (left, top))
    final_bounds = frame.getchannel("A").getbbox()
    if final_bounds is None or final_bounds[2] > 63 or final_bounds[3] < 58 or final_bounds[3] > 62:
        raise ValueError(f"{type_} normalized anchor drift: {final_bounds}")
    save_png(frame, destination)
    return frame, {"bounds": list(final_bounds), "visiblePixels": sum(a > 0 for a in frame.getchannel("A").get_flattened_data())}


def build_canvas(frame: Image.Image, destination: Path) -> dict[str, object]:
    canvas = Image.new("RGB", (1024, 1024), KEY)
    anchor = frame.resize((256, 256), Image.Resampling.NEAREST)
    canvas.paste(anchor.convert("RGB"), (0, 0), anchor.getchannel("A"))
    save_png(canvas, destination)
    non_key_outside = sum(
        canvas.getpixel((x, y)) != KEY
        for y in range(1024) for x in range(1024)
        if x >= 256 or y >= 256
    )
    if non_key_outside:
        raise ValueError(f"edit canvas polluted outside R1C1: {destination}")
    return {"width": 1024, "height": 1024, "mode": "RGB", "sha256": sha256(destination)}


def direction_text(direction: str) -> str:
    return {
        "south": "face south toward screen-bottom; show the front anatomy and equipment",
        "north": "face north away from the viewer; show the back anatomy and equipment",
        "east": "face east toward screen-right in every pose",
        "west": "face west toward screen-left in every pose",
        "base": "remain stationary and front-readable in every pose",
    }[direction]


def prompt(type_: str, direction: str) -> str:
    row2 = "awaken01, awaken02, awaken03, awaken04" if type_ == "totem" else "move01, move02, move03, move04"
    row3 = "cast01, cast02, cast03, cast04" if type_ == "totem" else "attack01, attack02, attack03, attack04"
    return f"""Use case: stylized-concept
Asset type: one whole {type_} {direction} animation sheet for a 64 px top-down browser game
Input image 1 is the immutable approved {type_} identity seed. Input image 2 is the exact edit canvas and layout target. Preserve identity, anatomy, materials, palette, proportions, equipment, upper-left key light, and Abyssal Gothic HD rendering. Edit the entire second image into exactly sixteen isolated poses of the same subject, generated together, not frame-by-frame. Use an invisible exact 4x4 grid with equal logical slots and one shared bottom-center root. Direction: {direction_text(direction)}.
Rows: R1 idle01, idle02, idle03, idle04; R2 {row2}; R3 {row3}; R4 hit01, hit02, death01, death02. Restrained compact motion readable at 64 px; no implied gameplay delay, reach, hitbox, anticipation, or recovery changes.
Keep one perfectly flat uniform #ff00ff background. No grid lines, labels, text, scenery, floor, shadow, reflection, particles, aura, cross-slot effects, extra subject, detached decorative debris, UI, or watermark. Nothing crosses a slot boundary. Do not use magenta inside the subject. Output only the square completed sheet."""


def output_rels() -> list[str]:
    return [
        *(KEYED_REL[type_] for type_ in ROSTER), *(PREVIEW_REL[type_] for type_ in ROSTER),
        *(CANVAS_REL[key] for key in CANVAS_REL), PROMPTS_REL, CONTACT_REL,
    ]


def publish(pairs: list[tuple[Path, Path]], work: Path) -> None:
    backup = work / "backup"
    backup.mkdir(parents=True, exist_ok=True)
    old: dict[Path, Path] = {}
    created: set[Path] = set()
    replaced: list[Path] = []
    try:
        for index, (_, target) in enumerate(pairs):
            if target.exists():
                saved = backup / f"{index:03d}-{target.name}"
                shutil.copy2(target, saved)
                old[target] = saved
            else:
                created.add(target)
        for source, target in pairs:
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(source, target)
            replaced.append(target)
    except Exception:
        for target in reversed(replaced):
            if target in old:
                os.replace(old[target], target)
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
    project = root()
    work_parent = project / "art/work/enemy-seed-prep"
    work_parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix=f"{os.getpid()}-", dir=work_parent))
    staged = work / "staged"
    try:
        verify_seeds(project)
        helper_hash = verify_toolchain(args.helper)
        seed_records: dict[str, object] = {}
        previews: dict[str, Image.Image] = {}
        detected: dict[str, str] = {}
        canvas_records: dict[str, object] = {}
        for type_ in ROSTER:
            keyed, detected[type_] = key_seed(project / SEED_REL[type_], staged / KEYED_REL[type_], args.helper)
            preview, metrics = normalize(type_, keyed, staged / PREVIEW_REL[type_])
            previews[type_] = preview
            seed_records[type_] = {
                "path": SEED_REL[type_], "sha256": SOURCE_SHA256[type_],
                "width": SOURCE_SIZE[0], "height": SOURCE_SIZE[1], "mode": SOURCE_MODE,
                "preview": PREVIEW_REL[type_], "metrics": metrics,
            }
            for direction in (("base",) if type_ == "totem" else DIRECTIONS):
                relative = CANVAS_REL[(type_, direction)]
                canvas_records[relative] = build_canvas(preview, staged / relative)

        prompt_payload = {
            "schemaVersion": 1,
            "inputOrder": ["type seed", "direction edit canvas"],
            "prompts": {
                type_: {direction: prompt(type_, direction) for direction in (("base",) if type_ == "totem" else DIRECTIONS)}
                for type_ in ROSTER
            },
        }
        write_json(prompt_payload, staged / PROMPTS_REL)
        contact = Image.new("RGBA", (len(ROSTER) * 64, 64), (18, 14, 25, 255))
        for index, type_ in enumerate(ROSTER):
            contact.alpha_composite(previews[type_], (index * 64, 0))
        save_png(contact, staged / CONTACT_REL)

        next_lock = {
            "schemaVersion": SCHEMA_VERSION, "chromaKey": "#ff00ff",
            "pillowVersion": PILLOW_VERSION,
            "helper": {"path": args.helper.name, "sha256": helper_hash},
            "seeds": seed_records, "helperDetectedKeys": detected,
            "editCanvases": canvas_records,
            "outputs": {relative: sha256(staged / relative) for relative in output_rels()},
        }
        lock_path = project / LOCK_REL
        if args.update_lock:
            write_json(next_lock, staged / LOCK_REL)
            publish([(staged / relative, project / relative) for relative in output_rels()] + [(staged / LOCK_REL, lock_path)], work)
            print("Published seven enemy seed previews and 25 edit canvases; lock updated")
            return 0
        if not lock_path.is_file():
            raise FileNotFoundError(f"missing {LOCK_REL}; use --update-lock intentionally")
        expected = json.loads(lock_path.read_text(encoding="utf8"))
        if next_lock != expected:
            raise ValueError("enemy seed preparation differs from committed lock")
        for relative, digest in expected["outputs"].items():
            if not (project / relative).is_file() or sha256(project / relative) != digest:
                raise ValueError(f"published seed output differs from lock: {relative}")
        print("Enemy seed preparation lock verification passed")
        return 0
    finally:
        shutil.rmtree(work, ignore_errors=True)
        try:
            work_parent.rmdir()
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
