#!/usr/bin/env python3
"""Build deterministic layered HD protection effects from the Classic color identities."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import sys
import uuid

from PIL import Image, ImageDraw, ImageFilter, __version__ as PILLOW_VERSION


SUPPORTED_PILLOW_VERSION = "12.1.1"
PIPELINE_SCHEMA = 1
SUPERSAMPLE = 4
FRAME_COUNT = 8
ROOT = Path(__file__).resolve().parents[1]
LOCK_PATH = ROOT / "art/source/protection-vfx-hd/protection-vfx-assets.lock.json"
STAGING_PARENT = ROOT / ".asset-staging/protection-vfx"
CLASSIC_SOURCES = {
    "shield": ("assets/sprite/shield/shield.png", "953e7fe0e492a3f96da7bf6e0f2e00713d3ef5d74239e10687e816953fba2d48"),
    "barrier": ("assets/sprite/shield/barrier.png", "7ed2afaf5ee81113a8c2ea72cb1499d46d06c46bcba3f81f7e705c8d21b07613"),
    "aegis": ("assets/sprite/shield/voidaegis.png", "261972fe3dad253b6914467f99f7feee5a34b6a9063551d0292910f511d6e017"),
}
PROFILES = {
    "player-shield": {
        "size": 128, "center": (64, 70), "radius": (45, 48),
        "base": (240, 178, 48), "bright": (255, 242, 157), "dark": (129, 77, 20),
        "geometry": "hex-sphere", "source": "shield",
    },
    "player-barrier": {
        "size": 128, "center": (64, 68), "radius": (52, 55),
        "base": (44, 195, 244), "bright": (191, 244, 255), "dark": (20, 82, 143),
        "geometry": "crystal-shell", "source": "barrier",
    },
    "blacksmith-barrier": {
        "size": 256, "center": (128, 148), "radius": (91, 99),
        "base": (244, 101, 25), "bright": (255, 221, 103), "dark": (75, 27, 18),
        "geometry": "iron-dome", "source": "barrier",
    },
    "warden-aegis": {
        "size": 256, "center": (128, 139), "radius": (104, 110),
        "base": (116, 70, 244), "bright": (221, 190, 255), "dark": (39, 12, 92),
        "geometry": "counter-rings", "source": "aegis",
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_inputs() -> None:
    if PILLOW_VERSION != SUPPORTED_PILLOW_VERSION:
        raise RuntimeError(f"Pillow {SUPPORTED_PILLOW_VERSION} required, received {PILLOW_VERSION}")
    for name, (relative, expected_hash) in CLASSIC_SOURCES.items():
        source = ROOT / relative
        if not source.is_file():
            raise FileNotFoundError(f"missing Classic {name} reference: {source}")
        actual = sha256(source)
        if actual != expected_hash:
            raise ValueError(f"Classic {name} reference changed: expected {expected_hash}, received {actual}")
        with Image.open(source) as image:
            if image.size != (64, 16) or image.mode not in ("RGBA", "P"):
                raise ValueError(f"Classic {name} reference must remain a 64x16 sprite strip")


def scaled_box(box: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(round(value * SUPERSAMPLE) for value in box)


def scaled_points(points: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(round(x * SUPERSAMPLE), round(y * SUPERSAMPLE)) for x, y in points]


def polar(cx: float, cy: float, rx: float, ry: float, angle: float) -> tuple[float, float]:
    radians = math.radians(angle)
    return cx + math.cos(radians) * rx, cy + math.sin(radians) * ry


def arc(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], start: float, end: float, color: tuple[int, int, int, int], width: float) -> None:
    draw.arc(scaled_box(box), start=start, end=end, fill=color, width=max(1, round(width * SUPERSAMPLE)))


def line(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], color: tuple[int, int, int, int], width: float, joint: str = "curve") -> None:
    draw.line(scaled_points(points), fill=color, width=max(1, round(width * SUPERSAMPLE)), joint=joint)


def ellipse(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], fill: tuple[int, int, int, int] | None = None, outline: tuple[int, int, int, int] | None = None, width: float = 1) -> None:
    draw.ellipse(scaled_box(box), fill=fill, outline=outline, width=max(1, round(width * SUPERSAMPLE)))


def dashed_ellipse(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], phase: float, color: tuple[int, int, int, int], width: float, segments: int = 12, span: float = 16) -> None:
    step = 360 / segments
    for index in range(segments):
        start = phase + index * step
        arc(draw, box, start, start + span, color, width)


def composite_glow(image: Image.Image, glow: Image.Image, radius: float) -> None:
    blurred = glow.filter(ImageFilter.GaussianBlur(radius * SUPERSAMPLE))
    image.alpha_composite(blurred)
    image.alpha_composite(glow)


def draw_fixed_shell(image: Image.Image, profile: dict[str, object], layer: str) -> None:
    cx, cy = profile["center"]
    rx, ry = profile["radius"]
    base = profile["base"]
    bright = profile["bright"]
    box = (cx - rx, cy - ry, cx + rx, cy + ry)
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow, "RGBA")
    arc(glow_draw, box, 0, 359.9, (*base, 24), 0.9)
    if layer == "rear":
        arc(glow_draw, box, 184, 356, (*base, 75), 4.4)
        arc(glow_draw, box, 195, 345, (*bright, 125), 1.8)
    else:
        arc(glow_draw, box, 4, 176, (*base, 105), 5.0)
        arc(glow_draw, box, 15, 165, (*bright, 180), 2.0)
    composite_glow(image, glow, 2.2 if profile["size"] == 128 else 3.2)


def draw_rear_field(image: Image.Image, profile: dict[str, object]) -> None:
    cx, cy = profile["center"]
    rx, ry = profile["radius"]
    base = profile["base"]
    draw = ImageDraw.Draw(image, "RGBA")
    for ring in range(12, 0, -1):
        fraction = ring / 12
        ellipse(
            draw,
            (cx - rx * fraction, cy - ry * fraction, cx + rx * fraction, cy + ry * fraction),
            fill=(*base, 2 if ring > 5 else 3),
        )


def draw_hex_sphere(image: Image.Image, profile: dict[str, object], layer: str, frame: int) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    cx, cy = profile["center"]
    rx, ry = profile["radius"]
    base, bright, dark = profile["base"], profile["bright"], profile["dark"]
    phase = frame * 45
    if layer == "rear":
        draw_rear_field(image, profile)
        for offset in (-18, 0, 18):
            y = cy + offset
            half = rx * math.sqrt(max(0.0, 1 - (offset / ry) ** 2))
            line(draw, [(cx - half * 0.76, y), (cx + half * 0.76, y)], (*dark, 42), 0.8)
        points = [polar(cx, cy, rx * 0.72, ry * 0.72, phase + index * 60) for index in range(7)]
        line(draw, points, (*base, 80), 1.0)
        dashed_ellipse(draw, (cx-rx+5, cy-ry+5, cx+rx-5, cy+ry-5), phase, (*bright, 145), 1.5, 8, 18)
        marker_x, marker_y = polar(cx, cy, rx * 0.58, ry * 0.58, 205 + frame * 31)
        ellipse(draw, (marker_x-2.0, marker_y-2.0, marker_x+2.0, marker_y+2.0), fill=(*bright, 190))
    else:
        dashed_ellipse(draw, (cx-rx+3, cy-ry+3, cx+rx-3, cy+ry-3), -phase * 0.65, (*bright, 205), 2.2, 10, 13)
        for angle in (28 + phase, 92 + phase, 152 + phase):
            x, y = polar(cx, cy, rx * 0.83, ry * 0.83, angle)
            ellipse(draw, (x-1.7, y-1.7, x+1.7, y+1.7), fill=(*bright, 220))


def draw_crystal_shell(image: Image.Image, profile: dict[str, object], layer: str, frame: int) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    cx, cy = profile["center"]
    rx, ry = profile["radius"]
    base, bright, dark = profile["base"], profile["bright"], profile["dark"]
    phase = frame * 45
    if layer == "rear":
        draw_rear_field(image, profile)
        for angle in range(205, 336, 26):
            outer = polar(cx, cy, rx * 0.91, ry * 0.91, angle)
            inner = polar(cx, cy, rx * 0.63, ry * 0.63, angle + (frame % 2) * 3)
            line(draw, [outer, inner], (*dark, 105), 2.0)
        dashed_ellipse(draw, (cx-rx+7, cy-ry+7, cx+rx-7, cy+ry-7), phase, (*bright, 145), 1.6, 9, 19)
    else:
        for angle in range(15, 166, 25):
            left = polar(cx, cy, rx * 0.98, ry * 0.98, angle - 7)
            tip = polar(cx, cy, rx * 0.82, ry * 0.72, angle)
            right = polar(cx, cy, rx * 0.98, ry * 0.98, angle + 7)
            draw.polygon(scaled_points([left, tip, right]), fill=(*dark, 115), outline=(*base, 175))
        dashed_ellipse(draw, (cx-rx+4, cy-ry+4, cx+rx-4, cy+ry-4), -phase, (*bright, 220), 2.1, 12, 11)
        angle = 35 + phase
        for offset in range(3):
            x, y = polar(cx, cy, rx * (0.68 + offset * 0.08), ry * (0.68 + offset * 0.08), angle + offset * 41)
            ellipse(draw, (x-1.5, y-1.5, x+1.5, y+1.5), fill=(*bright, 220))


def draw_iron_dome(image: Image.Image, profile: dict[str, object], layer: str, frame: int) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    cx, cy = profile["center"]
    rx, ry = profile["radius"]
    base, bright, dark = profile["base"], profile["bright"], profile["dark"]
    phase = frame * 45
    if layer == "rear":
        draw_rear_field(image, profile)
        for angle in range(205, 336, 22):
            outer = polar(cx, cy, rx * 0.95, ry * 0.95, angle)
            inner = polar(cx, cy, rx * 0.50, ry * 0.52, angle)
            line(draw, [outer, inner], (*dark, 185), 5.0)
            line(draw, [outer, inner], (*base, 120), 1.4)
        dashed_ellipse(draw, (cx-rx+10, cy-ry+10, cx+rx-10, cy+ry-10), phase, (*bright, 155), 3.0, 10, 18)
        marker_x, marker_y = polar(cx, cy, rx * 0.63, ry * 0.63, 202 + frame * 29)
        ellipse(draw, (marker_x-3.2, marker_y-3.2, marker_x+3.2, marker_y+3.2), fill=(*bright, 210))
    else:
        for angle in range(12, 169, 23):
            outer = polar(cx, cy, rx * 0.96, ry * 0.96, angle)
            inner = polar(cx, cy, rx * 0.58, ry * 0.58, angle)
            line(draw, [outer, inner], (*dark, 210), 6.0)
            line(draw, [outer, inner], (*base, 190), 2.0)
        dashed_ellipse(draw, (cx-rx+6, cy-ry+6, cx+rx-6, cy+ry-6), -phase * 0.8, (*bright, 225), 3.2, 12, 13)
        for index in range(5):
            angle = 18 + ((frame * 37 + index * 31) % 145)
            radius = 0.63 + index * 0.055
            x, y = polar(cx, cy, rx * radius, ry * radius, angle)
            ellipse(draw, (x-2.2, y-2.2, x+2.2, y+2.2), fill=(*bright, 205))


def draw_counter_rings(image: Image.Image, profile: dict[str, object], layer: str, frame: int) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    cx, cy = profile["center"]
    rx, ry = profile["radius"]
    base, bright, dark = profile["base"], profile["bright"], profile["dark"]
    phase = frame * 45
    if layer == "rear":
        draw_rear_field(image, profile)
        dashed_ellipse(draw, (cx-rx+12, cy-ry+9, cx+rx-12, cy+ry-9), phase, (*bright, 165), 3.2, 10, 20)
        dashed_ellipse(draw, (cx-rx+25, cy-ry+22, cx+rx-25, cy+ry-22), -phase * 1.25, (*base, 145), 2.3, 8, 25)
        for index in range(6):
            angle = 200 + ((index * 25 + frame * 17) % 140)
            outer = polar(cx, cy, rx * 0.84, ry * 0.84, angle)
            inner = polar(cx, cy, rx * 0.55, ry * 0.55, angle + 7)
            line(draw, [outer, inner], (*dark, 120), 2.1)
    else:
        dashed_ellipse(draw, (cx-rx+8, cy-ry+8, cx+rx-8, cy+ry-8), -phase, (*bright, 225), 3.4, 12, 12)
        dashed_ellipse(draw, (cx-rx+22, cy-ry+20, cx+rx-22, cy+ry-20), phase * 1.3, (*base, 185), 2.6, 9, 18)
        for index in range(5):
            angle = 16 + ((frame * 29 + index * 29) % 150)
            x, y = polar(cx, cy, rx * (0.72 - index * 0.07), ry * (0.72 - index * 0.07), angle)
            radius = 2.2 - index * 0.22
            ellipse(draw, (x-radius, y-radius, x+radius, y+radius), fill=(*bright, 215))


DRAWERS = {
    "hex-sphere": draw_hex_sphere,
    "crystal-shell": draw_crystal_shell,
    "iron-dome": draw_iron_dome,
    "counter-rings": draw_counter_rings,
}


def render_frame(profile: dict[str, object], layer: str, frame: int) -> Image.Image:
    size = int(profile["size"])
    high = Image.new("RGBA", (size * SUPERSAMPLE, size * SUPERSAMPLE), (0, 0, 0, 0))
    draw_fixed_shell(high, profile, layer)
    DRAWERS[str(profile["geometry"])](high, profile, layer, frame)
    result = high.resize((size, size), Image.Resampling.LANCZOS)
    pixels = result.load()
    for y in range(size):
        for x in range(size):
            red, green, blue, alpha = pixels[x, y]
            if alpha <= 2:
                pixels[x, y] = (0, 0, 0, 0)
    return result


def validate_frame(image: Image.Image, profile: dict[str, object], relative: str) -> None:
    size = int(profile["size"])
    if image.mode != "RGBA" or image.size != (size, size):
        raise ValueError(f"invalid protection frame geometry: {relative}")
    corners = [image.getpixel(point)[3] for point in ((0, 0), (size-1, 0), (0, size-1), (size-1, size-1))]
    if any(alpha > 8 for alpha in corners):
        raise ValueError(f"protection frame corners are not transparent: {relative}")
    pixels = list(image.get_flattened_data())
    if sum(1 for _r, _g, _b, alpha in pixels if alpha > 0) < size * 2:
        raise ValueError(f"protection frame lost coverage: {relative}")
    if any(alpha > 0 and (red, green, blue) == (255, 0, 255) for red, green, blue, alpha in pixels):
        raise ValueError(f"protection frame contains chroma key: {relative}")


def save_png(image: Image.Image, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, format="PNG", optimize=False, compress_level=9)


def build(staging: Path) -> list[str]:
    outputs: list[str] = []
    for name, profile in PROFILES.items():
        for layer in ("rear", "front"):
            bounds = []
            for frame in range(FRAME_COUNT):
                relative = f"assets/hd/vfx/protection/{name}/{layer}-{frame + 1:02d}.png"
                image = render_frame(profile, layer, frame)
                validate_frame(image, profile, relative)
                bounds.append(image.getchannel("A").getbbox())
                save_png(image, staging / relative)
                outputs.append(relative)
            if any(bound != bounds[0] for bound in bounds[1:]):
                raise ValueError(f"{name} {layer} alpha bounds drift across frames: {bounds}")
    return outputs


def lock_data(staging: Path, outputs: list[str]) -> dict[str, object]:
    return {
        "pipelineSchema": PIPELINE_SCHEMA,
        "pillowVersion": PILLOW_VERSION,
        "sources": {
            name: {"path": relative, "sha256": expected_hash}
            for name, (relative, expected_hash) in sorted(CLASSIC_SOURCES.items())
        },
        "profiles": {
            name: {
                "size": profile["size"],
                "center": list(profile["center"]),
                "radius": list(profile["radius"]),
                "geometry": profile["geometry"],
                "frames": FRAME_COUNT,
                "layers": ["rear", "front"],
            }
            for name, profile in sorted(PROFILES.items())
        },
        "assets": {relative: sha256(staging / relative) for relative in sorted(outputs)},
    }


def write_json(payload: dict[str, object], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def publish(pairs: list[tuple[Path, Path]], work: Path) -> None:
    backup = work / "backup"
    published: list[tuple[Path, Path | None]] = []
    try:
        for index, (source, target) in enumerate(pairs):
            target.parent.mkdir(parents=True, exist_ok=True)
            prior: Path | None = None
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
    args = parser.parse_args()
    verify_inputs()
    STAGING_PARENT.mkdir(parents=True, exist_ok=True)
    work = STAGING_PARENT / uuid.uuid4().hex
    staged = work / "staged"
    try:
        outputs = build(staged)
        payload = lock_data(staged, outputs)
        if args.check:
            if not LOCK_PATH.is_file():
                raise FileNotFoundError(f"missing protection VFX lock: {LOCK_PATH}")
            expected = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
            if expected != payload:
                raise ValueError("staged protection VFX do not match the committed lock")
            print(f"Protection VFX lock verification passed: {LOCK_PATH}")
            return 0
        staged_lock = staged / "art/source/protection-vfx-hd/protection-vfx-assets.lock.json"
        write_json(payload, staged_lock)
        pairs = [(staged / relative, ROOT / relative) for relative in outputs]
        pairs.append((staged_lock, LOCK_PATH))
        publish(pairs, work)
        print(f"Published {len(outputs)} layered protection VFX assets")
        print(f"Updated protection VFX lock: {LOCK_PATH}")
        return 0
    finally:
        shutil.rmtree(work, ignore_errors=True)
        try:
            STAGING_PARENT.rmdir()
        except OSError:
            pass


if __name__ == "__main__":
    sys.exit(main())
