#!/usr/bin/env python3
"""Build the Descent HD environment kit from the approved ImageGen atlas."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Callable

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps, __version__ as PILLOW_VERSION


EXPECTED_SOURCE_SHA256 = "95d42f7402d5e8be87d9739069b090fd6c9f3269a6e0adb3e28565da065883d2"
EXPECTED_COMMON_PORTAL_SOURCE_SHA256 = "f6420fc18542af41f35b21b665f5800ae0abfd76240341766bfc163ee4c739d7"
EXPECTED_SOURCE_SIZE = (1254, 1254)
BRAZIER_SOURCE_SIZE = (1448, 1086)
EXPECTED_BRAZIER_SOURCE_SHA256 = "8fc0f572ac5155ee0832eeaf65a48017694b23c5c89b493a42279f7835950cd4"
EXPECTED_CLASSIC_FLOOR_SHA256 = "2d768e27bcbd08a5402a79551af67b2e18c523ece31b2e1245d8942c38413b79"
EXPECTED_HAZARD_SPIKES_SOURCE_SHA256 = "792cd2cbdc4a705d36c433f091e274663d4b103576d1ca3078a086b48635c29b"
EXPECTED_HAZARD_MINE_SOURCE_SHA256 = "064236cc6c46eef1b4c008e01dcbc33543c68b7a4cdecd905c20b800606fcaaa"
EXPECTED_SHRINE_ACTIVE_SOURCE_SHA256 = "36810b1f2bc89932405413565f0a8e07034462d21b105b68a2eb9dda32a54c53"
EXPECTED_SHRINE_INACTIVE_SOURCE_SHA256 = "41426e6040ee672ea418042981c596957e6175a8eeccb8da58347f7016ecc7fe"
SUPPORTED_PILLOW_VERSION = "12.1.1"
EXPECTED_HELPER_SHA256 = "7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea"
PIPELINE_SCHEMA = 2
ATLAS_SIZE = (1024, 1024)
SLOT_SIZE = 256
KEY_RGB = (255, 0, 255)
NEAR_KEY_MAX_ALPHA = 128
NEAR_KEY_DISTANCE = 48
RESAMPLE = Image.Resampling.LANCZOS
FLOOR_VARIANT_FILENAMES = (
    "floor-base.png",
    "floor-b.png",
    "floor-c.png",
    "floor-skull.png",
    "floor-crack-cross.png",
    "floor-var3.png",
    "floor-var4.png",
)


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_toolchain(helper: Path) -> str:
    if PILLOW_VERSION != SUPPORTED_PILLOW_VERSION:
        raise RuntimeError(
            f"unsupported Pillow version: expected {SUPPORTED_PILLOW_VERSION}, received {PILLOW_VERSION}; "
            "install requirements-hd-assets.txt"
        )
    if not helper.is_file():
        raise FileNotFoundError(f"installed chroma helper does not exist: {helper}")
    actual_helper_hash = sha256(helper)
    if actual_helper_hash.lower() != EXPECTED_HELPER_SHA256:
        raise RuntimeError(
            f"chroma helper SHA256 mismatch: expected {EXPECTED_HELPER_SHA256}, "
            f"received {actual_helper_hash}, path={helper}"
        )
    return actual_helper_hash


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False, compress_level=9)


def verify_source(source: Path, expected_hash: str) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"source atlas does not exist: {source}")
    actual_hash = sha256(source)
    if expected_hash and actual_hash.lower() != expected_hash.lower():
        raise ValueError(f"source SHA256 mismatch: expected {expected_hash}, received {actual_hash}")
    with Image.open(source) as image:
        if image.size != EXPECTED_SOURCE_SIZE:
            raise ValueError(
                f"source dimensions must be {EXPECTED_SOURCE_SIZE[0]}x{EXPECTED_SOURCE_SIZE[1]}, "
                f"received {image.width}x{image.height}"
            )


def brazier_source_path() -> Path:
    return project_root() / "art/source/portal-brazier-hd/brazier-atlas-source-original.png"


def verify_brazier_source(source: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"brazier source atlas does not exist: {source}")
    actual_hash = sha256(source)
    if actual_hash.lower() != EXPECTED_BRAZIER_SOURCE_SHA256:
        raise ValueError(
            f"brazier source SHA256 mismatch: expected {EXPECTED_BRAZIER_SOURCE_SHA256}, received {actual_hash}"
        )
    with Image.open(source) as image:
        if image.size != BRAZIER_SOURCE_SIZE or image.mode != "RGB":
            raise ValueError(f"brazier source must be untouched {BRAZIER_SOURCE_SIZE} RGB: {source}")


def classic_floor_source_path() -> Path:
    return project_root() / "assets/sprite/tileset.png"


def verify_classic_floor_source(source: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"Classic floor source does not exist: {source}")
    actual_hash = sha256(source)
    if actual_hash.lower() != EXPECTED_CLASSIC_FLOOR_SHA256:
        raise ValueError(
            f"Classic floor source SHA256 mismatch: expected {EXPECTED_CLASSIC_FLOOR_SHA256}, "
            f"received {actual_hash}"
        )
    with Image.open(source) as image:
        if image.size != (64, 64) or image.mode != "RGBA":
            raise ValueError(f"Classic floor source must remain an untouched 64x64 RGBA sheet: {source}")


def key_brazier_atlas(source: Path, destination: Path, helper: Path) -> Image.Image:
    destination.parent.mkdir(parents=True, exist_ok=True)
    run_chroma_helper(source, destination, helper)
    with Image.open(destination) as image:
        keyed = image.convert("RGBA")
    return keyed


def build_brazier_assets(keyed_atlas: Image.Image, theme_row: int) -> list[Image.Image]:
    """Build one fixed floor-brazier base with three flame-only composites."""
    if keyed_atlas.size != BRAZIER_SOURCE_SIZE or theme_row not in (0, 1, 2):
        raise ValueError("invalid brazier atlas or theme row")
    cell = 362
    row_top = theme_row * cell
    cells = [
        keyed_atlas.crop((column * cell, row_top, (column + 1) * cell, row_top + cell)).resize(
            (64, 64), RESAMPLE
        )
        for column in range(4)
    ]
    base = cells[0].convert("RGBA")
    results = [base]
    for lit in cells[1:]:
        overlay = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        source_pixels = lit.convert("RGBA").load()
        overlay_pixels = overlay.load()
        for y in range(35):
            for x in range(64):
                red, green, blue, alpha = source_pixels[x, y]
                if alpha <= 8:
                    continue
                if theme_row == 0:
                    flame = red >= 115 and green >= 42 and red >= blue + 35
                elif theme_row == 1:
                    flame = (green >= 90 and blue >= 75 and (green >= red + 22 or blue >= red + 25))
                else:
                    flame = blue >= 85 and blue >= red + 22 and blue >= green + 10
                if flame:
                    overlay_pixels[x, y] = (red, green, blue, alpha)
        composite = base.copy()
        composite.alpha_composite(overlay)
        results.append(composite)
    return results


def theme_hazard(source: Image.Image, theme: str) -> Image.Image:
    """Color-grade one neutral hazard housing for the active biome."""
    if theme not in ("descent", "corruption", "abyss"):
        raise ValueError(f"unknown hazard theme: {theme}")
    multipliers = {
        "descent": (0.92, 0.96, 1.02, (8, 8, 10)),
        "corruption": (0.62, 0.88, 0.66, (2, 10, 4)),
        "abyss": (0.70, 0.62, 1.02, (7, 3, 15)),
    }
    red_scale, green_scale, blue_scale, lift = multipliers[theme]
    result = source.convert("RGBA").copy()
    pixels = []
    for red, green, blue, alpha in result.get_flattened_data():
        pixels.append((
            max(0, min(255, round(red * red_scale) + lift[0])),
            max(0, min(255, round(green * green_scale) + lift[1])),
            max(0, min(255, round(blue * blue_scale) + lift[2])),
            alpha,
        ))
    result.putdata(pixels)
    return result


def build_mine_assets(source: Image.Image, theme: str = "descent") -> tuple[Image.Image, Image.Image]:
    """Return a closed dormant mine and the same housing with an energized shutter."""
    unarmed = theme_hazard(source, theme)
    if unarmed.size != (64, 64):
        raise ValueError(f"normalized mine must be 64x64, received {unarmed.size}")
    armed = unarmed.copy()
    pixels = armed.load()
    center_x, center_y, radius = 32, 31, 11
    accent = {
        "descent": (255, 126, 34),
        "corruption": (101, 224, 118),
        "abyss": (170, 82, 255),
    }[theme]
    for y in range(center_y - radius, center_y + radius + 1):
        for x in range(center_x - radius, center_x + radius + 1):
            distance_sq = (x - center_x) ** 2 + (y - center_y) ** 2
            if distance_sq > radius ** 2:
                continue
            red, green, blue, alpha = pixels[x, y]
            if alpha <= 0:
                continue
            distance = distance_sq ** 0.5
            strength = max(0.12, (1.0 - distance / radius) * 0.72)
            pixels[x, y] = (
                round(red * (1 - strength) + accent[0] * strength),
                round(green * (1 - strength) + accent[1] * strength),
                round(blue * (1 - strength) + accent[2] * strength),
                alpha,
            )
    if unarmed.getchannel("A").tobytes() != armed.getchannel("A").tobytes():
        raise ValueError("mine state derivation changed the static housing silhouette")
    return unarmed, armed


def normalize_atlas(source: Path, destination: Path) -> Image.Image:
    with Image.open(source) as image:
        normalized = image.convert("RGB").resize(ATLAS_SIZE, RESAMPLE)
    save_png(normalized, destination)
    return normalized


def crop_slots(atlas: Image.Image, slots_root: Path) -> list[Path]:
    slots: list[Path] = []
    for row in range(4):
        for column in range(4):
            index = row * 4 + column + 1
            left = column * SLOT_SIZE
            top = row * SLOT_SIZE
            crop = atlas.crop((left, top, left + SLOT_SIZE, top + SLOT_SIZE))
            destination = slots_root / f"slot-{index:02d}.png"
            save_png(crop, destination)
            slots.append(destination)
    return slots


def is_exact_chroma(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha > 0 and (red, green, blue) == KEY_RGB


def is_near_key_fringe(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    distance_squared = (red - KEY_RGB[0]) ** 2 + green ** 2 + (blue - KEY_RGB[2]) ** 2
    return (
        0 < alpha <= NEAR_KEY_MAX_ALPHA
        and distance_squared <= NEAR_KEY_DISTANCE ** 2
        and red - green >= 96
        and blue - green >= 96
        and abs(red - blue) <= 64
    )


def chroma_policy_metrics(image: Image.Image) -> tuple[int, int, int, int]:
    exact_alphas: list[int] = []
    fringe_alphas: list[int] = []
    for pixel in image.convert("RGBA").get_flattened_data():
        if is_exact_chroma(pixel):
            exact_alphas.append(pixel[3])
        if is_near_key_fringe(pixel):
            fringe_alphas.append(pixel[3])
    return (
        len(exact_alphas),
        max(exact_alphas, default=0),
        len(fringe_alphas),
        max(fringe_alphas, default=0),
    )


def validate_chroma_policy(image: Image.Image, path: Path) -> None:
    exact_count, exact_max_alpha, fringe_count, fringe_max_alpha = chroma_policy_metrics(image)
    if exact_count:
        raise ValueError(
            f"exact chroma remains in {path}: count={exact_count}, maxAlpha={exact_max_alpha}"
        )
    if fringe_count:
        raise ValueError(
            f"near-key fringe remains in {path}: count={fringe_count}, maxAlpha={fringe_max_alpha}"
        )


def remove_residual_chroma(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            pixel = pixels[x, y]
            if is_exact_chroma(pixel) or is_near_key_fringe(pixel):
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def run_chroma_helper(
    slot_path: Path,
    destination: Path,
    helper: Path,
    *,
    run_fn: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> None:
    command = [
        sys.executable,
        str(helper),
        "--input", str(slot_path),
        "--out", str(destination),
        "--auto-key", "border",
        "--soft-matte",
        "--transparent-threshold", "12",
        "--opaque-threshold", "220",
        "--despill",
        "--force",
    ]
    if slot_path.name in {"slot-10.png", "slot-11.png"}:
        command.extend(["--edge-contract", "1"])
    try:
        run_fn(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(
            f"chroma helper failed for slot/input {slot_path}; helper={helper}; "
            f"return code {error.returncode}; stdout={str(error.stdout or error.output or '')}; "
            f"stderr={str(error.stderr or '')}"
        ) from error


def key_slots(slot_paths: list[Path], keyed_root: Path, helper: Path) -> list[Image.Image]:
    keyed_images: list[Image.Image] = []
    for slot_path in slot_paths:
        destination = keyed_root / slot_path.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        run_chroma_helper(slot_path, destination, helper)
        with Image.open(destination) as image:
            keyed = image.convert("RGBA")
        if slot_path.name in {"slot-10.png", "slot-11.png"}:
            with Image.open(slot_path) as original:
                keyed = restore_intended_magic(original.convert("RGB"), keyed)
        keyed = remove_residual_chroma(keyed)
        validate_chroma_policy(keyed, slot_path)
        save_png(keyed, destination)
        keyed_images.append(keyed)
    return keyed_images


def restore_intended_magic(original: Image.Image, keyed: Image.Image) -> Image.Image:
    """Restore saturated non-key violet magic softened by magenta despill."""
    original_pixels = original.load()
    keyed_pixels = keyed.load()
    for y in range(original.height):
        for x in range(original.width):
            red, green, blue = original_pixels[x, y]
            distance = max(abs(red - KEY_RGB[0]), abs(green), abs(blue - KEY_RGB[2]))
            violet = blue >= 72 and red >= 38 and blue >= green + 36 and red >= green + 20
            if not violet or distance < 72:
                continue
            alpha = min(255, max(keyed_pixels[x, y][3], int((distance - 48) * 6)))
            keyed_pixels[x, y] = (red, green, blue, alpha)
    return keyed


def alpha_component_sizes(image: Image.Image, *, alpha_threshold: int = 16) -> list[int]:
    alpha = image.convert("RGBA").getchannel("A")
    pixels = alpha.load()
    seen: set[tuple[int, int]] = set()
    sizes: list[int] = []
    for y in range(alpha.height):
        for x in range(alpha.width):
            if pixels[x, y] <= alpha_threshold or (x, y) in seen:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            size = 0
            while stack:
                current_x, current_y = stack.pop()
                size += 1
                for next_x in range(current_x - 1, current_x + 2):
                    for next_y in range(current_y - 1, current_y + 2):
                        if next_x == current_x and next_y == current_y:
                            continue
                        if not (0 <= next_x < alpha.width and 0 <= next_y < alpha.height):
                            continue
                        if (next_x, next_y) in seen or pixels[next_x, next_y] <= alpha_threshold:
                            continue
                        seen.add((next_x, next_y))
                        stack.append((next_x, next_y))
            sizes.append(size)
    return sorted(sizes, reverse=True)


def keep_largest_alpha_component(image: Image.Image, *, alpha_threshold: int = 16) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    pixels = alpha.load()
    seen: set[tuple[int, int]] = set()
    components: list[set[tuple[int, int]]] = []
    for y in range(alpha.height):
        for x in range(alpha.width):
            if pixels[x, y] <= alpha_threshold or (x, y) in seen:
                continue
            component: set[tuple[int, int]] = set()
            stack = [(x, y)]
            seen.add((x, y))
            while stack:
                current_x, current_y = stack.pop()
                component.add((current_x, current_y))
                for next_x in range(current_x - 1, current_x + 2):
                    for next_y in range(current_y - 1, current_y + 2):
                        if next_x == current_x and next_y == current_y:
                            continue
                        if not (0 <= next_x < alpha.width and 0 <= next_y < alpha.height):
                            continue
                        if (next_x, next_y) in seen or pixels[next_x, next_y] <= alpha_threshold:
                            continue
                        seen.add((next_x, next_y))
                        stack.append((next_x, next_y))
            components.append(component)
    if not components:
        raise ValueError("source segment contains no visible alpha component")
    largest = max(components, key=len)
    keep = Image.new("L", rgba.size, 0)
    keep_pixels = keep.load()
    for x, y in largest:
        keep_pixels[x, y] = 255
    keep = keep.filter(ImageFilter.MaxFilter(5))
    rgba.putalpha(ImageChops.multiply(alpha, keep))
    return rgba


def split_horizontal(image: Image.Image) -> tuple[Image.Image, Image.Image]:
    return image.crop((0, 0, 256, 128)), image.crop((0, 128, 256, 256))


def split_vertical(image: Image.Image) -> tuple[Image.Image, Image.Image]:
    return image.crop((0, 0, 128, 256)), image.crop((128, 0, 256, 256))


def split_quadrants(image: Image.Image) -> tuple[Image.Image, Image.Image, Image.Image, Image.Image]:
    return (
        image.crop((0, 0, 128, 128)),
        image.crop((128, 0, 256, 128)),
        image.crop((0, 128, 128, 256)),
        image.crop((128, 128, 256, 256)),
    )


def trim_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    mask = rgba.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError("source segment contains no visible pixels after chroma removal")
    return rgba.crop(bbox)


def contained(
    image: Image.Image,
    size: tuple[int, int],
    *,
    anchor: str = "center",
    margin: int = 2,
    scale: float | None = None,
) -> Image.Image:
    trimmed = trim_alpha(image)
    available_width = size[0] - margin * 2
    available_height = size[1] - margin * 2
    if scale is None:
        scale = min(available_width / trimmed.width, available_height / trimmed.height)
    width = max(1, min(available_width, round(trimmed.width * scale)))
    height = max(1, min(available_height, round(trimmed.height * scale)))
    resized = trimmed.resize((width, height), RESAMPLE)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))

    horizontal = "center"
    vertical = "center"
    if "west" in anchor:
        horizontal = "west"
    elif "east" in anchor:
        horizontal = "east"
    if "north" in anchor:
        vertical = "north"
    elif "south" in anchor or "bottom" in anchor:
        vertical = "south"

    x = margin if horizontal == "west" else size[0] - margin - width if horizontal == "east" else (size[0] - width) // 2
    y = margin if vertical == "north" else size[1] - margin - height if vertical == "south" else (size[1] - height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def normalized_group(
    images: list[Image.Image],
    size: tuple[int, int],
    *,
    anchor: str,
    margin: int,
) -> list[Image.Image]:
    trimmed = [trim_alpha(image) for image in images]
    max_width = max(image.width for image in trimmed)
    max_height = max(image.height for image in trimmed)
    scale = min((size[0] - margin * 2) / max_width, (size[1] - margin * 2) / max_height)
    return [contained(image, size, anchor=anchor, margin=margin, scale=scale) for image in images]


def portal_source_canvas(
    source: Image.Image,
    *,
    aperture: tuple[float, float],
    center: tuple[int, int] = (64, 64),
    margin: int = 3,
) -> Image.Image:
    """Fit a complete portal around its aperture instead of its asymmetric platform."""
    rgba = source.convert("RGBA")
    bounds = rgba.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("portal source has no visible pixels")
    left, top, right, bottom = bounds
    ax, ay = aperture
    if not (left < ax < right and top < ay < bottom):
        raise ValueError(f"portal aperture {aperture} must be inside visible bounds {bounds}")
    cx, cy = center
    scale = min(
        (cx - margin) / (ax - left),
        (127 - margin - cx) / (right - ax),
        (cy - margin) / (ay - top),
        (127 - margin - cy) / (bottom - ay),
    )
    crop = rgba.crop(bounds)
    resized = crop.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        RESAMPLE,
    )
    destination = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    paste_x = round(cx - (ax - left) * scale)
    paste_y = round(cy - (ay - top) * scale)
    destination.alpha_composite(resized, (paste_x, paste_y))
    return destination


def recenter_alpha_texture(texture: Image.Image, center: tuple[int, int]) -> Image.Image:
    """Align an energy layer's alpha centroid to the rotation pivot."""
    rgba = texture.convert("RGBA")
    alpha = rgba.getchannel("A")
    weights = list(alpha.get_flattened_data())
    total = sum(weights)
    if total <= 0:
        return rgba
    width = rgba.width
    centroid_x = sum((index % width) * value for index, value in enumerate(weights)) / total
    centroid_y = sum((index // width) * value for index, value in enumerate(weights)) / total
    offset = (round(center[0] - centroid_x), round(center[1] - centroid_y))
    result = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    result.alpha_composite(rgba, offset)
    return result


def fixed_shell_animation(
    frames: list[Image.Image],
    motion_shapes: list[tuple[str, tuple[int, int, int, int]]],
) -> list[Image.Image]:
    """Keep frame zero immutable outside explicit animation regions."""
    if not frames:
        raise ValueError("fixed-shell animation requires at least one frame")
    size = frames[0].size
    if any(frame.size != size for frame in frames):
        raise ValueError("fixed-shell animation frames must share one canvas")
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for kind, bounds in motion_shapes:
        if kind == "ellipse":
            draw.ellipse(bounds, fill=255)
        elif kind == "rectangle":
            draw.rectangle(bounds, fill=255)
        else:
            raise ValueError(f"unsupported animation mask shape: {kind}")
    shell = frames[0].convert("RGBA")
    results: list[Image.Image] = []
    for frame in frames:
        result = shell.copy()
        result.paste(frame.convert("RGBA"), (0, 0), mask)
        results.append(result)
    return results


def portal_layer_animation(
    normalized_frames: list[Image.Image],
    *,
    center: tuple[int, int],
    radius: int,
    radius_y: int | None = None,
    void_tint: tuple[int, int, int],
    phase_count: int = 8,
    stabilize_texture: bool = False,
    energy_source: Image.Image | None = None,
    energy_tint: tuple[int, int, int] | None = None,
) -> tuple[Image.Image, list[Image.Image], list[Image.Image]]:
    """Split one complete portal pose into a fixed frame and rotating swirl layers."""
    if len(normalized_frames) < 2:
        raise ValueError("portal layers require inactive and active source frames")
    if phase_count < 3:
        raise ValueError("portal animation requires at least three phases")
    cx, cy = center
    radius_y = radius if radius_y is None else radius_y
    size = normalized_frames[1].size
    if size != (128, 128):
        raise ValueError(f"portal layer canvas must be 128x128, received {size}")

    active_source = normalized_frames[1].convert("RGBA")
    energy_source = (energy_source or active_source).convert("RGBA")
    if energy_source.size != size:
        raise ValueError(f"portal energy source must be 128x128, received {energy_source.size}")
    frame = active_source.copy()
    swirl_radius = radius + 1
    swirl_radius_y = radius_y + 1
    texture = Image.new("RGBA", size, (0, 0, 0, 0))
    source_pixels = active_source.load()
    energy_pixels = energy_source.load()
    frame_pixels = frame.load()
    texture_pixels = texture.load()
    for y in range(size[1]):
        for x in range(size[0]):
            dx, dy = x - cx, y - cy
            normalized_distance = ((dx / radius) ** 2 + (dy / radius_y) ** 2) ** 0.5
            if normalized_distance > 1 + 1 / radius:
                continue
            red, green, blue, alpha = source_pixels[x, y]
            # Suppress the baked source vortex into a stable, textured dark void.
            blend = max(0.0, min(1.0, (1 + 2 / radius - normalized_distance) / (4 / radius)))
            luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
            dark = tuple(min(255, round(channel + luminance * 0.07)) for channel in void_tint)
            frame_pixels[x, y] = (
                round(red * (1.0 - blend) + dark[0] * blend),
                round(green * (1.0 - blend) + dark[1] * blend),
                round(blue * (1.0 - blend) + dark[2] * blend),
                alpha,
            )
            # Retain only luminous vortex energy; dark cavity pixels stay transparent.
            energy_red, energy_green, energy_blue, source_alpha = energy_pixels[x, y]
            energy_alpha = max(1, min(source_alpha, round(max(0, max(energy_red, energy_green, energy_blue) - 28) * 2.35)))
            if normalized_distance > 1 - 1 / radius:
                energy_alpha = max(1, round(energy_alpha * max(0.0, (1 + 1 / radius - normalized_distance) * radius)))
            if energy_tint is None:
                energy_color = (energy_red, energy_green, energy_blue)
            else:
                intensity = max(energy_red, energy_green, energy_blue) / 255.0
                highlight = max(0.0, intensity - 0.62) * 180.0
                energy_color = tuple(
                    min(255, round(channel * intensity + highlight)) for channel in energy_tint
                )
            texture_pixels[x, y] = (*energy_color, energy_alpha)

    if stabilize_texture:
        texture = recenter_alpha_texture(texture, center)
        opposite = texture.rotate(180, resample=Image.Resampling.BICUBIC, center=center)
        texture = Image.alpha_composite(texture, opposite)

    swirls: list[Image.Image] = []
    composites: list[Image.Image] = []
    for phase in range(phase_count):
        angle = -(360.0 * phase / phase_count)
        if radius_y == radius:
            swirl = texture.rotate(angle, resample=Image.Resampling.BICUBIC, center=center)
        else:
            ellipse_box = (
                cx - swirl_radius,
                cy - swirl_radius_y,
                cx + swirl_radius + 1,
                cy + swirl_radius_y + 1,
            )
            ellipse_texture = texture.crop(ellipse_box)
            circular_texture = ellipse_texture.resize(
                (ellipse_texture.width, ellipse_texture.width), Image.Resampling.BICUBIC
            )
            circular_texture = circular_texture.rotate(angle, resample=Image.Resampling.BICUBIC)
            ellipse_texture = circular_texture.resize(ellipse_texture.size, Image.Resampling.BICUBIC)
            swirl = Image.new("RGBA", size, (0, 0, 0, 0))
            swirl.alpha_composite(ellipse_texture, ellipse_box[:2])
        if stabilize_texture:
            swirl = recenter_alpha_texture(swirl, center)
            opposite = swirl.rotate(180, resample=Image.Resampling.BICUBIC, center=center)
            swirl = Image.alpha_composite(swirl, opposite)
        swirl_pixels = swirl.load()
        for y in range(size[1]):
            for x in range(size[0]):
                ellipse_distance = ((x - cx) / swirl_radius) ** 2 + ((y - cy) / swirl_radius_y) ** 2
                if ellipse_distance > 1:
                    swirl_pixels[x, y] = (0, 0, 0, 0)
                elif swirl_pixels[x, y][3] == 0:
                    red, green, blue, _alpha = swirl_pixels[x, y]
                    swirl_pixels[x, y] = (red, green, blue, 1)
        composite = Image.new("RGBA", size, (0, 0, 0, 0))
        composite.alpha_composite(frame)
        composite.alpha_composite(swirl)
        swirls.append(swirl)
        composites.append(composite)
    return frame, swirls, composites


def compose_wall_corner(
    horizontal: Image.Image,
    vertical: Image.Image,
    detail: Image.Image,
    corner: str,
) -> Image.Image:
    """Join canonical wall arms and retain detail only in the physical outer corner."""
    boxes = {
        "northwest": (0, 0, 36, 36),
        "northeast": (28, 0, 63, 36),
        "southwest": (0, 28, 36, 63),
        "southeast": (28, 28, 63, 63),
    }
    if corner not in boxes:
        raise ValueError(f"unknown wall corner: {corner}")
    result = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    result.alpha_composite(horizontal.convert("RGBA"))
    result.alpha_composite(vertical.convert("RGBA"))
    mask = Image.new("L", (64, 64), 0)
    ImageDraw.Draw(mask).rectangle(boxes[corner], fill=255)
    outer_detail = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    outer_detail.paste(detail.convert("RGBA"), (0, 0), mask)
    result.alpha_composite(outer_detail)
    return result


def make_floor_tile(image: Image.Image) -> Image.Image:
    trimmed = trim_alpha(image).convert("RGB")
    square = ImageOps.fit(trimmed, (64, 64), method=RESAMPLE, centering=(0.5, 0.5))
    offset = ImageChops.offset(square, 32, 32)
    blurred = offset.filter(ImageFilter.GaussianBlur(radius=1.5))
    mask = Image.new("L", (64, 64), 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle((27, 0, 37, 63), fill=255)
    draw.rectangle((0, 27, 63, 37), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=2.0))
    return Image.composite(blurred, offset, mask).convert("RGB")


def _scaled_alpha(image: Image.Image, scale: float) -> Image.Image:
    result = image.convert("RGBA")
    alpha = result.getchannel("A").point(lambda value: round(value * scale))
    result.putalpha(alpha)
    return result


def _floor_composite(base: Image.Image, overlay: Image.Image) -> Image.Image:
    result = base.convert("RGBA")
    result.alpha_composite(overlay.convert("RGBA"))
    return result.convert("RGB")


def _classic_skull_overlay(classic_tileset: Image.Image, theme: str) -> Image.Image:
    """Extract the real Classic skull pixels as a restrained carved-floor mask."""
    tile = classic_tileset.convert("RGBA").crop((16, 16, 32, 32)).resize((44, 44), RESAMPLE)
    mask = Image.new("L", tile.size, 0)
    mask.putdata([
        max(0, min(210, (red - blue) * 7 + (red - green) * 3 - 18))
        for red, green, blue, alpha in tile.get_flattened_data()
    ])
    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.45))
    placed = Image.new("L", (64, 64), 0)
    placed.paste(mask, (10, 10))
    shadow_mask = Image.new("L", (64, 64), 0)
    shadow_mask.paste(placed, (1, 1))
    highlight_mask = Image.new("L", (64, 64), 0)
    highlight_mask.paste(placed, (-1, -1))
    colors = {
        "descent": ((18, 14, 12), (126, 105, 73)),
        "corruption": ((12, 20, 15), (96, 126, 78)),
        "abyss": ((10, 8, 18), (105, 91, 146)),
    }
    dark, light = colors[theme]
    result = Image.new("RGBA", (64, 64), (*dark, 0))
    result.putalpha(shadow_mask.point(lambda value: round(value * 0.78)))
    highlight = Image.new("RGBA", (64, 64), (*light, 0))
    highlight.putalpha(highlight_mask.point(lambda value: round(value * 0.48)))
    result.alpha_composite(highlight)
    return result


def _mean_luminance(image: Image.Image) -> float:
    pixels = image.convert("RGB").get_flattened_data()
    values = (0.2126 * red + 0.7152 * green + 0.0722 * blue for red, green, blue in pixels)
    return sum(values) / (image.width * image.height)


def tune_abyss_midtones(image: Image.Image, target: float = 57.0) -> Image.Image:
    """Lift cool midtones to a stable target while retaining true black cracks."""
    rgb = image.convert("RGB")
    low, high = 0.35, 1.0
    result = rgb
    for _iteration in range(14):
        gamma = (low + high) / 2
        table = [round(255 * ((value / 255) ** gamma)) for value in range(256)]
        result = rgb.point(table * 3)
        if _mean_luminance(result) > target:
            low = gamma
        else:
            high = gamma
    return result


def build_floor_variants(
    floor_source: Image.Image,
    crack: Image.Image,
    stains: list[Image.Image],
    classic_tileset: Image.Image,
    theme: str,
) -> dict[str, Image.Image]:
    """Build seven full deterministic tiles solely from approved source material."""
    if theme not in ("descent", "corruption", "abyss") or len(stains) < 2:
        raise ValueError("invalid floor-variant inputs")
    base = make_floor_tile(floor_source)
    raw = {
        "base": base,
        "b": ImageOps.mirror(base),
        "c": ImageOps.flip(base),
        "skull": _floor_composite(base, _classic_skull_overlay(classic_tileset, theme)),
        "crack-cross": _floor_composite(base, _scaled_alpha(crack, 0.82)),
        "var3": _floor_composite(ImageChops.offset(base, 16, 0), _scaled_alpha(stains[0], 0.42)),
        "var4": _floor_composite(ImageChops.offset(base, 0, 16), _scaled_alpha(ImageOps.mirror(stains[1]), 0.38)),
    }
    if theme == "abyss":
        raw = {name: tune_abyss_midtones(image) for name, image in raw.items()}
    hashes = {sha256_image(image) for image in raw.values()}
    if len(hashes) != len(FLOOR_VARIANT_FILENAMES):
        raise ValueError(f"{theme} floor variants are not visually unique")
    return raw


def sha256_image(image: Image.Image) -> str:
    return hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest()


def theme_spike(common_spike: Image.Image, theme: str) -> Image.Image:
    """Apply the shared biome palette to the neutral spike housing."""
    return theme_hazard(common_spike, theme)


def write_asset(image: Image.Image, output_root: Path, relative: str) -> None:
    output = remove_residual_chroma(image) if image.mode == "RGBA" else image
    save_png(output, output_root / Path(relative))


def build_assets(
    keyed: list[Image.Image],
    output_root: Path,
    brazier_atlas: Image.Image,
    classic_tileset: Image.Image,
    common_portal: Image.Image,
    hazard_spike_source: Image.Image,
    hazard_mine_source: Image.Image,
    shrine_sources: list[Image.Image],
) -> list[Path]:
    written: list[Path] = []

    def write(image: Image.Image, relative: str) -> None:
        write_asset(image, output_root, relative)
        written.append(output_root / Path(relative))

    crack_asset = contained(keyed[4], (64, 64), margin=2)
    stain_assets = [contained(keyed[index], (64, 64), margin=2) for index in (13, 14, 15)]
    floor_variants = build_floor_variants(keyed[0], crack_asset, stain_assets, classic_tileset, "descent")
    for filename in FLOOR_VARIANT_FILENAMES:
        name = filename.removeprefix("floor-").removesuffix(".png")
        write(floor_variants[name], f"environment/descent/{filename}")

    north, south = split_horizontal(keyed[1])
    west, east = split_vertical(keyed[2])
    wall_assets = {
        "north": contained(north, (64, 64), anchor="north", margin=0),
        "south": contained(south, (64, 64), anchor="south", margin=0),
        "west": contained(west, (64, 64), anchor="west", margin=0),
        "east": contained(east, (64, 64), anchor="east", margin=0),
    }
    for direction in ("north", "south", "west", "east"):
        write(wall_assets[direction], f"environment/descent/wall-{direction}.png")

    corner_sources = [keep_largest_alpha_component(source) for source in split_quadrants(keyed[3])]
    corner_assets = [
        contained(source, (64, 64), anchor=anchor, margin=0)
        for source, anchor in zip(
            corner_sources,
            ["northwest", "northeast", "southwest", "southeast"],
            strict=True,
        )
    ]
    corner_arms = {
        "northwest": ("north", "west"),
        "northeast": ("north", "east"),
        "southwest": ("south", "west"),
        "southeast": ("south", "east"),
    }
    for detail, name in zip(
        corner_assets,
        ["northwest", "northeast", "southwest", "southeast"],
        strict=True,
    ):
        horizontal, vertical = corner_arms[name]
        image = compose_wall_corner(wall_assets[horizontal], wall_assets[vertical], detail, name)
        write(image, f"environment/descent/wall-corner-{name}.png")

    write(crack_asset, "environment/descent/decal-crack.png")
    write(contained(keyed[5], (64, 64), margin=2), "environment/descent/grate.png")
    write(contained(keyed[6], (64, 64), anchor="bottom", margin=2), "environment/descent/rubble.png")

    torch_assets = build_brazier_assets(brazier_atlas, 0)
    for image, name in zip(torch_assets, ["unlit", "lit-01", "lit-02", "lit-03"], strict=True):
        write(image, f"objects/common/torch-{name}.png")

    write(contained(keyed[8], (64, 64), anchor="bottom", margin=2), "objects/common/chest-normal.png")

    shrine_assets = normalized_group(shrine_sources, (128, 128), anchor="bottom", margin=4)
    write(shrine_assets[0], "objects/common/shrine-active.png")
    write(shrine_assets[1], "objects/common/shrine-inactive.png")

    portal_active = portal_source_canvas(common_portal, aperture=(512, 461), center=(64, 61))
    portal_assets = [portal_active, portal_active]
    portal_frame, portal_swirls, portal_composites = portal_layer_animation(
        portal_assets,
        center=(64, 61),
        radius=34,
        radius_y=33,
        void_tint=(9, 5, 18),
        stabilize_texture=True,
    )
    write(portal_frame, "objects/common/portal-inactive.png")
    for image, name in zip(
        (portal_composites[0], portal_composites[3], portal_composites[6]),
        ("active-01", "active-02", "active-03"),
        strict=True,
    ):
        write(image, f"objects/common/portal-{name}.png")
    write(portal_frame, "objects/common/portal-frame.png")
    for index, image in enumerate(portal_swirls, start=1):
        write(image, f"objects/common/portal-swirl-{index:02d}.png")

    common_spike = contained(hazard_spike_source, (64, 64), margin=4)
    write(common_spike, "hazards/common/spikes-armed.png")
    write(theme_spike(common_spike, "descent"), "hazards/descent/spikes-armed.png")
    mine_source = contained(hazard_mine_source, (64, 64), margin=4)
    mine_unarmed, mine_armed = build_mine_assets(mine_source, "descent")
    write(mine_unarmed, "hazards/common/mine-unarmed.png")
    write(mine_armed, "hazards/common/mine-armed.png")
    write(mine_unarmed, "hazards/descent/mine-unarmed.png")
    write(mine_armed, "hazards/descent/mine-armed.png")
    for image, name in zip(stain_assets, ("01", "02", "03"), strict=True):
        write(image, f"environment/descent/decal-stain-{name}.png")
    return written


def validate_outputs(paths: list[Path]) -> None:
    if len(paths) != 47:
        raise ValueError(f"expected 47 final assets, wrote {len(paths)}")
    magic_turquoise_total = 0
    for path in paths:
        with Image.open(path) as image:
            rgba = image.convert("RGBA")
            if image.width % 64 != 0 or image.height % 64 != 0:
                raise ValueError(f"asset is not an exact 64 px tile multiple: {path}")
            if not path.name.startswith("floor-"):
                if image.mode != "RGBA":
                    raise ValueError(f"overlay/object/hazard must be encoded RGBA: {path}")
                corners = [rgba.getpixel((0, 0))[3], rgba.getpixel((image.width - 1, 0))[3], rgba.getpixel((0, image.height - 1))[3], rgba.getpixel((image.width - 1, image.height - 1))[3]]
                if "wall-" not in path.name and any(alpha > 16 for alpha in corners):
                    raise ValueError(f"transparent asset corners are not clear: {path}")
            if image.mode == "RGBA":
                validate_chroma_policy(rgba, path)
                pixels = list(rgba.get_flattened_data())
                visible = sum(alpha > 0 for _red, _green, _blue, alpha in pixels)
                if visible < image.width * image.height * 0.15:
                    raise ValueError(f"asset lost meaningful alpha coverage ({visible} pixels): {path}")
                if "shrine-" in path.name or "portal-" in path.name:
                    violet = sum(
                        1 for red, green, blue, alpha in pixels
                        if alpha >= 64 and blue >= 80 and red >= 40
                        and blue >= green + 24 and red >= green + 12
                        and (red - 255) ** 2 + green ** 2 + (blue - 255) ** 2 > 100 ** 2
                    )
                    magic_turquoise_total += sum(
                        1 for red, green, blue, alpha in pixels
                        if alpha >= 64 and green >= 70 and blue >= 70
                        and green >= red + 20 and blue >= red + 20
                    )
                    unique_visible = len({
                        (red, green, blue)
                        for red, green, blue, alpha in pixels if alpha >= 64
                    })
                    is_inactive_portal = path.name in ("portal-inactive.png", "portal-frame.png")
                    is_inactive_magic = path.name == "shrine-inactive.png" or is_inactive_portal
                    minimum_unique = 2000 if is_inactive_magic else 750 if "portal-swirl-" in path.name else 3000
                    minimum_violet = 0 if path.name == "shrine-inactive.png" else 125 if is_inactive_portal else 200 if "shrine-" in path.name else 250
                    if violet < minimum_violet or unique_visible < minimum_unique:
                        raise ValueError(
                            f"asset lost intended magic coverage/entropy: {path}; "
                            f"violet={violet}, unique={unique_visible}"
                        )
            if "wall-corner-" in path.name or ("portal-" in path.name and "portal-swirl-" not in path.name):
                components = alpha_component_sizes(rgba)
                if len(components) > 1 and components[1] >= max(24, round(components[0] * 0.04)):
                    raise ValueError(f"asset retains a disconnected neighboring subslot fragment: {path}")
    if magic_turquoise_total < 400:
        raise ValueError(f"shrine/portal kit lost intended turquoise magic: {magic_turquoise_total}")


def project_relative(path: Path) -> str:
    return path.resolve().relative_to(project_root().resolve()).as_posix()


def create_lock_data(
    source: Path,
    normalized_atlas: Path,
    portal_source: Path,
    normalized_portal: Path,
    staged_assets: list[Path],
    staged_output_root: Path,
    helper: Path,
    helper_hash: str,
    brazier_source: Path,
    classic_floor_source: Path,
    hazard_spikes_source: Path,
    normalized_hazard_spikes: Path,
    hazard_mine_source: Path,
    normalized_hazard_mine: Path,
    shrine_active_source: Path,
    normalized_shrine_active: Path,
    shrine_inactive_source: Path,
    normalized_shrine_inactive: Path,
) -> dict[str, object]:
    assets = {
        f"assets/hd/{asset.relative_to(staged_output_root).as_posix()}": sha256(asset)
        for asset in sorted(staged_assets)
    }
    return {
        "pipelineSchema": PIPELINE_SCHEMA,
        "pillowVersion": PILLOW_VERSION,
        "helper": {"path": helper.name, "sha256": helper_hash},
        "source": {"path": project_relative(source), "sha256": sha256(source)},
        "portalSource": {"path": project_relative(portal_source), "sha256": sha256(portal_source)},
        "brazierSource": {"path": project_relative(brazier_source), "sha256": sha256(brazier_source)},
        "classicFloorSource": {
            "path": project_relative(classic_floor_source),
            "sha256": sha256(classic_floor_source),
        },
        "hazardSpikesSource": {"path": project_relative(hazard_spikes_source), "sha256": sha256(hazard_spikes_source)},
        "hazardMineSource": {"path": project_relative(hazard_mine_source), "sha256": sha256(hazard_mine_source)},
        "shrineActiveSource": {"path": project_relative(shrine_active_source), "sha256": sha256(shrine_active_source)},
        "shrineInactiveSource": {"path": project_relative(shrine_inactive_source), "sha256": sha256(shrine_inactive_source)},
        "normalizedAtlas": {
            "path": "art/source/abyssal-gothic-hd/descent-environment-source-1024.png",
            "sha256": sha256(normalized_atlas),
        },
        "normalizedPortalSource": {
            "path": "art/source/abyssal-gothic-hd/common-portal-source-1024.png",
            "sha256": sha256(normalized_portal),
        },
        "normalizedHazardSpikesSource": {
            "path": "art/source/abyssal-gothic-hd/hazard-spikes-source-1024.png",
            "sha256": sha256(normalized_hazard_spikes),
        },
        "normalizedHazardMineSource": {
            "path": "art/source/abyssal-gothic-hd/hazard-mine-source-1024.png",
            "sha256": sha256(normalized_hazard_mine),
        },
        "normalizedShrineActiveSource": {
            "path": "art/source/abyssal-gothic-hd/shrine-active-3d-source-1024.png",
            "sha256": sha256(normalized_shrine_active),
        },
        "normalizedShrineInactiveSource": {
            "path": "art/source/abyssal-gothic-hd/shrine-inactive-3d-source-1024.png",
            "sha256": sha256(normalized_shrine_inactive),
        },
        "assets": assets,
    }


def write_lock(lock_data: dict[str, object], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(lock_data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def verify_lock(lock_data: dict[str, object], lock_path: Path) -> None:
    if not lock_path.is_file():
        raise FileNotFoundError(
            f"asset lock does not exist: {lock_path}; use --update-lock for an intentional revision"
        )
    expected = json.loads(lock_path.read_text(encoding="utf-8"))
    if expected != lock_data:
        raise ValueError(
            f"staged HD assets do not match lock: {lock_path}; "
            "use --update-lock only for an intentional reviewed asset revision"
        )


def publish_transaction(
    staged_to_target: list[tuple[Path, Path]],
    transaction_root: Path,
    *,
    replace_fn: Callable[[Path, Path], object] = os.replace,
) -> None:
    backups_root = transaction_root / "backups"
    backups: dict[Path, Path | None] = {}
    published: list[Path] = []
    try:
        backups_root.mkdir(parents=True, exist_ok=True)
        for index, (_staged, target) in enumerate(staged_to_target):
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                backup = backups_root / f"{index:02d}-{target.name}"
                shutil.copy2(target, backup)
                backups[target] = backup
            else:
                backups[target] = None
        for staged, target in staged_to_target:
            replace_fn(staged, target)
            published.append(target)
    except BaseException as publish_error:
        rollback_errors: list[str] = []
        for target in reversed(published):
            backup = backups[target]
            try:
                if backup is None:
                    target.unlink(missing_ok=True)
                else:
                    os.replace(backup, target)
            except BaseException as rollback_error:
                rollback_errors.append(f"{target}: {rollback_error}")
        if rollback_errors:
            raise RuntimeError(
                f"publish failed ({publish_error}); rollback also failed: {'; '.join(rollback_errors)}"
            ) from publish_error
        raise
    finally:
        if transaction_root.exists():
            shutil.rmtree(transaction_root)


def parse_args() -> argparse.Namespace:
    root = project_root()
    default_helper = Path.home() / ".codex" / "skills" / ".system" / "imagegen" / "scripts" / "remove_chroma_key.py"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=root / "art/source/abyssal-gothic-hd/descent-environment-source-original-1254.png")
    parser.add_argument("--atlas", type=Path, default=root / "art/source/abyssal-gothic-hd/descent-environment-source-1024.png")
    parser.add_argument("--output-root", type=Path, default=root / "assets/hd")
    parser.add_argument("--work-root", type=Path, default=root / "art/work/descent-environment")
    parser.add_argument("--helper", type=Path, default=default_helper)
    parser.add_argument(
        "--lock",
        type=Path,
        default=root / "art/source/abyssal-gothic-hd/descent-environment-assets.lock.json",
    )
    parser.add_argument("--expected-sha256", default=EXPECTED_SOURCE_SHA256)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="build and verify the lock without publishing")
    mode.add_argument(
        "--update-lock",
        action="store_true",
        help="intentionally publish staged outputs and replace the committed artifact lock",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    verify_source(args.source, args.expected_sha256)
    portal_source = project_root() / "art/source/abyssal-gothic-hd/common-portal-source-original-1254.png"
    verify_source(portal_source, EXPECTED_COMMON_PORTAL_SOURCE_SHA256)
    brazier_source = brazier_source_path()
    verify_brazier_source(brazier_source)
    classic_floor_source = classic_floor_source_path()
    verify_classic_floor_source(classic_floor_source)
    hazard_spikes_source = project_root() / "art/source/abyssal-gothic-hd/hazard-spikes-source-original.png"
    hazard_mine_source = project_root() / "art/source/abyssal-gothic-hd/hazard-mine-source-original.png"
    shrine_active_source = project_root() / "art/source/abyssal-gothic-hd/shrine-active-3d-source-original.png"
    shrine_inactive_source = project_root() / "art/source/abyssal-gothic-hd/shrine-inactive-3d-source-original.png"
    verify_source(hazard_spikes_source, EXPECTED_HAZARD_SPIKES_SOURCE_SHA256)
    verify_source(hazard_mine_source, EXPECTED_HAZARD_MINE_SOURCE_SHA256)
    verify_source(shrine_active_source, EXPECTED_SHRINE_ACTIVE_SOURCE_SHA256)
    verify_source(shrine_inactive_source, EXPECTED_SHRINE_INACTIVE_SOURCE_SHA256)
    helper_hash = verify_toolchain(args.helper)
    work_root = args.work_root.resolve()
    allowed_work_parent = (project_root() / "art/work").resolve()
    if allowed_work_parent not in work_root.parents:
        raise ValueError(f"work root must stay inside {allowed_work_parent}")
    if work_root.exists():
        shutil.rmtree(work_root)
    try:
        staged_root = work_root / "staged"
        staged_atlas = staged_root / "art/source/abyssal-gothic-hd/descent-environment-source-1024.png"
        staged_portal = staged_root / "art/source/abyssal-gothic-hd/common-portal-source-1024.png"
        staged_hazard_spikes = staged_root / "art/source/abyssal-gothic-hd/hazard-spikes-source-1024.png"
        staged_hazard_mine = staged_root / "art/source/abyssal-gothic-hd/hazard-mine-source-1024.png"
        staged_shrine_active = staged_root / "art/source/abyssal-gothic-hd/shrine-active-3d-source-1024.png"
        staged_shrine_inactive = staged_root / "art/source/abyssal-gothic-hd/shrine-inactive-3d-source-1024.png"
        staged_output_root = staged_root / "assets/hd"
        slots_root = work_root / "intermediate/slots"
        keyed_root = work_root / "intermediate/keyed"
        keyed_brazier_path = work_root / "intermediate/brazier-atlas-keyed.png"

        atlas = normalize_atlas(args.source, staged_atlas)
        portal_rgb = normalize_atlas(portal_source, staged_portal)
        keyed_portal_path = work_root / "intermediate/common-portal-keyed.png"
        run_chroma_helper(staged_portal, keyed_portal_path, args.helper)
        with Image.open(keyed_portal_path) as keyed_source:
            common_portal = remove_residual_chroma(keyed_source.convert("RGBA"))
        common_portal = restore_intended_magic(portal_rgb, common_portal)
        common_portal = remove_residual_chroma(common_portal)
        validate_chroma_policy(common_portal, keyed_portal_path)
        hazard_sources: dict[str, Image.Image] = {}
        for name, source, normalized in (
            ("spikes", hazard_spikes_source, staged_hazard_spikes),
            ("mine", hazard_mine_source, staged_hazard_mine),
        ):
            normalize_atlas(source, normalized)
            keyed_path = work_root / f"intermediate/hazard-{name}-keyed.png"
            run_chroma_helper(normalized, keyed_path, args.helper)
            with Image.open(keyed_path) as keyed_source:
                hazard = remove_residual_chroma(keyed_source.convert("RGBA"))
            validate_chroma_policy(hazard, keyed_path)
            hazard_sources[name] = hazard
        shrine_sources: list[Image.Image] = []
        for name, source, normalized in (
            ("active", shrine_active_source, staged_shrine_active),
            ("inactive", shrine_inactive_source, staged_shrine_inactive),
        ):
            shrine_rgb = normalize_atlas(source, normalized)
            keyed_path = work_root / f"intermediate/shrine-{name}-keyed.png"
            run_chroma_helper(normalized, keyed_path, args.helper)
            with Image.open(keyed_path) as keyed_source:
                shrine = remove_residual_chroma(keyed_source.convert("RGBA"))
            shrine = restore_intended_magic(shrine_rgb, shrine)
            shrine = remove_residual_chroma(shrine)
            validate_chroma_policy(shrine, keyed_path)
            shrine_sources.append(shrine)
        slot_paths = crop_slots(atlas, slots_root)
        keyed = key_slots(slot_paths, keyed_root, args.helper)
        brazier_atlas = key_brazier_atlas(brazier_source, keyed_brazier_path, args.helper)
        with Image.open(classic_floor_source) as source:
            classic_tileset = source.convert("RGBA")
        written = build_assets(
            keyed,
            staged_output_root,
            brazier_atlas,
            classic_tileset,
            common_portal,
            hazard_sources["spikes"],
            hazard_sources["mine"],
            shrine_sources,
        )
        validate_outputs(written)
        lock_data = create_lock_data(
            args.source,
            staged_atlas,
            portal_source,
            staged_portal,
            written,
            staged_output_root,
            args.helper,
            helper_hash,
            brazier_source,
            classic_floor_source,
            hazard_spikes_source,
            staged_hazard_spikes,
            hazard_mine_source,
            staged_hazard_mine,
            shrine_active_source,
            staged_shrine_active,
            shrine_inactive_source,
            staged_shrine_inactive,
        )

        staged_lock: Path | None = None
        if args.update_lock:
            staged_lock = staged_root / "lock/descent-environment-assets.lock.json"
            write_lock(lock_data, staged_lock)
        else:
            verify_lock(lock_data, args.lock)

        if args.check:
            print(f"Verified Pillow version: {PILLOW_VERSION}")
            print(f"Verified helper SHA256: {helper_hash}")
            print(f"Lock verification passed: {args.lock}")
            return

        publish_pairs: list[tuple[Path, Path]] = [
            (staged_atlas, args.atlas),
            (staged_portal, project_root() / "art/source/abyssal-gothic-hd/common-portal-source-1024.png"),
            (staged_hazard_spikes, project_root() / "art/source/abyssal-gothic-hd/hazard-spikes-source-1024.png"),
            (staged_hazard_mine, project_root() / "art/source/abyssal-gothic-hd/hazard-mine-source-1024.png"),
            (staged_shrine_active, project_root() / "art/source/abyssal-gothic-hd/shrine-active-3d-source-1024.png"),
            (staged_shrine_inactive, project_root() / "art/source/abyssal-gothic-hd/shrine-inactive-3d-source-1024.png"),
        ]
        publish_pairs.extend(
            (asset, args.output_root / asset.relative_to(staged_output_root))
            for asset in written
        )
        if staged_lock is not None:
            publish_pairs.append((staged_lock, args.lock))
        publish_transaction(publish_pairs, work_root)

        print(f"Verified Pillow version: {PILLOW_VERSION}")
        print(f"Verified helper SHA256: {helper_hash}")
        print(f"Verified source SHA256: {sha256(args.source)}")
        print(f"Published normalized atlas: {args.atlas}")
        print(f"Published {len(written)} final Descent assets under: {args.output_root}")
        if args.update_lock:
            print(f"Intentionally updated asset lock: {args.lock}")
        else:
            print(f"Lock verification passed before publish: {args.lock}")
    finally:
        if work_root.exists():
            shutil.rmtree(work_root)


if __name__ == "__main__":
    main()
