#!/usr/bin/env python3
"""Prepare immutable Task 9 boss seeds and sixteen 4x4 ImageGen canvases."""

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

from PIL import Image, ImageEnhance, ImageOps, __version__ as PILLOW_VERSION


SCHEMA_VERSION = 1
SUPPORTED_PILLOW_VERSION = "12.1.1"
HELPER_SHA256 = "7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea"
KEY = (255, 0, 255)
DIRECTIONS = ("south", "north", "east", "west")
ANCHOR_SIZE = 256
ANCHOR_ROOT = (128, 244)
PROFILES = {
    "vault-guardian": {
        "seed": "art/source/boss-hd/vault-guardian-south-idle-seed.png",
        "sha256": "03f1658588e8e3f99308b3036b96cbbb0909cb28a63770cb88362f087ea52bbb",
        "size": (1254, 1254), "finalSize": 128, "action": "attack",
        "identity": "the cathedral vault guardian: monumental armored sentinel, stone and tarnished gold, shield-and-weapon silhouette",
    },
    "blacksmith-guardian": {
        "seed": "art/source/boss-hd/blacksmith-guardian-south-idle-seed.png",
        "sha256": "72c5ca6f3ebdbf51ce458fe32ab4e532f990dd680401b954a2b401b0ee5a4521",
        "size": (1061, 1483), "finalSize": 128, "action": "attack",
        "identity": "the blacksmith guardian: furnace-lit armored smith, heavy hammer and scorched iron silhouette",
    },
    "warden/phase-1": {
        "seed": "art/source/boss-hd/warden-phase-1-south-idle-seed.png",
        "sha256": "f7e3bedffc8e117efe8ebba1ba31aa86028065cf28c12cc94b04ce2e3f7e24f5",
        "size": (1024, 1536), "finalSize": 160, "action": "cast",
        "identity": "the Warden phase one: imposing abyssal knight-mage, restrained void regalia and ritual weapon",
    },
    "warden/phase-2": {
        "seed": "art/source/boss-hd/warden-phase-2-south-idle-seed.png",
        "sha256": "e189ebe0f2b5d3bcb02e451e83a9dbc1b62ecd5a590ea0549878d1c3a8193224",
        "size": (1254, 1254), "finalSize": 192, "action": "cast",
        "identity": "the Warden phase two: transformed sovereign abyssal form, expanded crown, mantle and void-armored silhouette",
    },
}
PROMPTS_REL = "art/briefs/boss-hd-prompts.json"
CONTACT_REL = "art/source/boss-hd/boss-seed-contact-sheet-256.png"
LOCK_REL = "art/source/boss-hd/boss-seed-prep.lock.json"


def root() -> Path:
    return Path(__file__).resolve().parents[1]


def slug(profile: str) -> str:
    return profile.replace("/", "-")


def keyed_rel(profile: str) -> str:
    name = slug(profile)
    return f"art/source/boss-hd/{name}/{name}-south-idle-keyed.png"


def anchor_rel(profile: str, direction: str) -> str:
    name = slug(profile)
    return f"art/source/boss-hd/{name}/{name}-animation-{direction}-anchor-256.png"


def canvas_rel(profile: str, direction: str) -> str:
    name = slug(profile)
    return f"art/source/boss-hd/{name}/{name}-animation-{direction}-edit-canvas-1024.png"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
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
    for profile, spec in PROFILES.items():
        source = project / str(spec["seed"])
        if not source.is_file() or sha256(source) != spec["sha256"]:
            raise ValueError(f"immutable {profile} seed identity mismatch: {source}")
        with Image.open(source) as image:
            if image.size != spec["size"] or image.mode != "RGB":
                raise ValueError(f"{profile} seed must be {spec['size']} RGB")


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
    if bounds is None or any(keyed.getpixel(point)[3] for point in ((0, 0), (keyed.width - 1, 0), (0, keyed.height - 1), (keyed.width - 1, keyed.height - 1))):
        raise ValueError(f"invalid keyed seed silhouette: {source}")
    save_png(keyed, destination)
    return keyed, parse_key(result.stdout)


def normalized_south(keyed: Image.Image) -> Image.Image:
    bounds = keyed.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("empty keyed boss seed")
    crop = keyed.crop(bounds)
    scale = min(220 / crop.width, 228 / crop.height)
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    resized = clean_chroma(crop.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA"))
    frame = Image.new("RGBA", (ANCHOR_SIZE, ANCHOR_SIZE), (0, 0, 0, 0))
    frame.alpha_composite(resized, (ANCHOR_ROOT[0] - size[0] // 2, ANCHOR_ROOT[1] - size[1] + 1))
    return frame


def direction_anchor(south: Image.Image, direction: str) -> tuple[Image.Image, str]:
    if direction == "south":
        return south.copy(), "approved front-facing identity reference"
    bounds = south.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("empty normalized boss seed")
    crop = south.crop(bounds)
    if direction in ("east", "west"):
        side = crop.resize((max(1, round(crop.width * 0.86)), crop.height), Image.Resampling.LANCZOS)
        if direction == "west":
            side = ImageOps.mirror(side)
        result = Image.new("RGBA", south.size, (0, 0, 0, 0))
        result.alpha_composite(clean_chroma(side), (ANCHOR_ROOT[0] - side.width // 2, ANCHOR_ROOT[1] - side.height + 1))
        return result, "deterministic side silhouette guide; west mirrors east; prompt owns true facing semantics"
    north = ImageOps.mirror(crop)
    rgb = ImageEnhance.Brightness(north.convert("RGB")).enhance(0.88)
    rgb.putalpha(north.getchannel("A"))
    result = Image.new("RGBA", south.size, (0, 0, 0, 0))
    result.alpha_composite(clean_chroma(rgb), (ANCHOR_ROOT[0] - north.width // 2, ANCHOR_ROOT[1] - north.height + 1))
    return result, "deterministic posterior silhouette guide; prompt requires a true readable back view"


def build_canvas(anchor: Image.Image, destination: Path) -> dict[str, object]:
    canvas = Image.new("RGB", (1024, 1024), KEY)
    canvas.paste(anchor.convert("RGB"), (0, 0), anchor.getchannel("A"))
    if any(canvas.getpixel((x, y)) != KEY for y in range(1024) for x in range(1024) if x >= 256 or y >= 256):
        raise ValueError(f"edit canvas polluted outside R1C1: {destination}")
    save_png(canvas, destination)
    return {"width": 1024, "height": 1024, "mode": "RGB", "r1c1Only": True, "sha256": sha256(destination)}


def direction_text(direction: str) -> str:
    return {
        "south": "face south toward screen-bottom; show the approved front anatomy and equipment",
        "north": "face north away from the viewer in a true readable back view; show posterior armor, mantle and equipment, never a mirrored front",
        "east": "face east toward screen-right in every pose; preserve a strict side-readable silhouette",
        "west": "face west toward screen-left in every pose; mirror the east-facing anatomy and equipment consistently",
    }[direction]


def prompt(profile: str, direction: str) -> str:
    spec = PROFILES[profile]
    action = spec["action"]
    return f"""Use case: stylized-concept
Asset type: one whole {profile} {direction} animation sheet for a 64 px top-down browser game
Input image 1 is the immutable approved identity seed for {spec['identity']}. Input image 2 is the exact edit canvas, shared scale, bottom-center root and 4x4 layout target. Preserve the same boss identity, anatomy, materials, palette, proportions, equipment, upper-left key light and Abyssal Gothic HD rendering. Edit the entire second image into exactly sixteen isolated poses of the same subject, generated together, not frame-by-frame. Use an invisible exact 4x4 grid with equal logical slots and one shared bottom-center root. The R1C1 guide establishes scale and root; obey this direction over any front-view detail in that guide: {direction_text(direction)}.
Rows: R1 idle01, idle02, idle03, idle04; R2 move01, move02, move03, move04; R3 {action}01, {action}02, {action}03, {action}04; R4 hit01, hit02, death01, death02. Restrained compact motion readable at the final {spec['finalSize']} px render size; no implied gameplay delay, reach, hitbox, anticipation or recovery changes.
Keep one perfectly flat uniform #ff00ff background. No grid lines, labels, text, scenery, floor, shadow, reflection, barrier, aura, particles, cross-slot effects, extra subject, detached decorative debris, UI or watermark. Nothing crosses a slot boundary. Do not use magenta inside the subject. Output only the square completed sheet."""


def output_rels() -> list[str]:
    result = [PROMPTS_REL, CONTACT_REL]
    for profile in PROFILES:
        result.append(keyed_rel(profile))
        for direction in DIRECTIONS:
            result.extend((anchor_rel(profile, direction), canvas_rel(profile, direction)))
    return result


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
    work_parent = project / "art/work/boss-seed-prep"
    work_parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix=f"{os.getpid()}-", dir=work_parent))
    staged = work / "staged"
    try:
        verify_seeds(project)
        helper_hash = verify_toolchain(args.helper)
        seed_records: dict[str, object] = {}
        anchor_records: dict[str, object] = {}
        canvas_records: dict[str, object] = {}
        detected: dict[str, str] = {}
        contact = Image.new("RGBA", (1024, 1024), (18, 14, 25, 255))
        for row, (profile, spec) in enumerate(PROFILES.items()):
            keyed, detected[profile] = key_seed(project / str(spec["seed"]), staged / keyed_rel(profile), args.helper)
            south = normalized_south(keyed)
            seed_records[profile] = {
                "path": spec["seed"], "sha256": spec["sha256"], "width": spec["size"][0],
                "height": spec["size"][1], "mode": "RGB", "finalSize": spec["finalSize"],
            }
            for column, direction in enumerate(DIRECTIONS):
                anchor, policy = direction_anchor(south, direction)
                anchor_path = staged / anchor_rel(profile, direction)
                save_png(anchor, anchor_path)
                anchor_records[anchor_rel(profile, direction)] = {
                    "width": 256, "height": 256, "mode": "RGBA", "root": list(ANCHOR_ROOT),
                    "policy": policy, "sha256": sha256(anchor_path),
                }
                canvas_records[canvas_rel(profile, direction)] = build_canvas(anchor, staged / canvas_rel(profile, direction))
                contact.alpha_composite(anchor, (column * 256, row * 256))
        save_png(contact, staged / CONTACT_REL)
        prompt_payload = {
            "schemaVersion": 1,
            "inputOrder": ["immutable profile identity seed", "direction edit canvas"],
            "sourceSheet": {"layout": "4x4", "logicalSlotSize": [256, 256], "chromaKey": "#ff00ff", "sharedRoot": "bottom-center"},
            "profiles": {
                profile: {"finalSize": spec["finalSize"], "actionClip": spec["action"], "prompts": {direction: prompt(profile, direction) for direction in DIRECTIONS}}
                for profile, spec in PROFILES.items()
            },
        }
        write_json(prompt_payload, staged / PROMPTS_REL)
        next_lock = {
            "schemaVersion": SCHEMA_VERSION, "chromaKey": "#ff00ff", "pillowVersion": PILLOW_VERSION,
            "helper": {"path": args.helper.name, "sha256": helper_hash}, "seeds": seed_records,
            "helperDetectedKeys": detected, "directionAnchors": anchor_records, "editCanvases": canvas_records,
            "outputs": {relative: sha256(staged / relative) for relative in output_rels()},
        }
        lock_path = project / LOCK_REL
        if args.update_lock:
            write_json(next_lock, staged / LOCK_REL)
            publish([(staged / relative, project / relative) for relative in output_rels()] + [(staged / LOCK_REL, lock_path)], work)
            print("Published four keyed boss identities, sixteen direction anchors and sixteen exact edit canvases; lock updated")
            return 0
        if not lock_path.is_file():
            raise FileNotFoundError(f"missing {LOCK_REL}; use --update-lock intentionally")
        expected = json.loads(lock_path.read_text(encoding="utf8"))
        if next_lock != expected:
            raise ValueError("boss seed preparation differs from committed lock")
        for relative, digest in expected["outputs"].items():
            if not (project / relative).is_file() or sha256(project / relative) != digest:
                raise ValueError(f"published seed output differs from lock: {relative}")
        print("Boss seed preparation lock verification passed")
        return 0
    finally:
        shutil.rmtree(work, ignore_errors=True)
        try:
            work_parent.rmdir()
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
