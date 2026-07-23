#!/usr/bin/env python3
"""Prepare the approved player seed for review and whole-sheet ImageGen editing."""

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

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


PIPELINE_SCHEMA = 2
SUPPORTED_PILLOW_VERSION = "12.1.1"
EXPECTED_HELPER_SHA256 = "7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea"
EXPECTED_SOURCE_SHA256 = "c890fc3c09eb7537faa2350793a1d6919f64dc31a6a85d2232d3d37ae46f474d"
EXPECTED_REJECTED_SHA256 = "3ae0de590ca039525d1db721c1539df146affc57a90939631cfccbc667d96d64"
EXPECTED_SOURCE_SIZE = (1254, 1254)
EXPECTED_SOURCE_MODE = "RGB"
KEY_RGB = (255, 0, 255)
NEAR_KEY_MAX_ALPHA = 128
NEAR_KEY_DISTANCE = 48
FRAME_SIZE = 64
FRAME_ROOT = (32, 60)
FRAME_MAX_BOUNDS = (56, 56)
EDIT_CANVAS_SIZE = 1024
EDIT_SLOT_SIZE = 256
REJECTED_ALPHA_THRESHOLD = 16
REJECTED_COMPONENT_MIN_AREA = 500
DIRECTIONS = ("south", "north", "east", "west")

SOURCE_REL = "art/source/player-hd/player-south-idle-seed.png"
KEYED_REL = "art/source/player-hd/player-south-idle-keyed.png"
NORMALIZED_REL = "art/source/player-hd/player-south-idle-preview-64.png"
COMPARISON_REL = "art/source/player-hd/player-seed-comparison.png"
REJECTED_REL = "art/source/player-hd/player-animation-atlas-rejected-layout.png"
REJECTED_ANALYSIS_REL = "art/source/player-hd/player-animation-rejected-layout-analysis.json"
REJECTED_PREVIEW_REL = "art/source/player-hd/player-animation-rejected-layout-components.png"
DIRECTION_PREVIEW_REL = "art/source/player-hd/player-direction-anchor-comparison.png"
PROMPTS_REL = "art/briefs/player-hd-direction-prompts.json"
DIRECTION_ANCHOR_RELS = {
    "south": NORMALIZED_REL,
    "north": "art/source/player-hd/player-north-idle-anchor-preview-64.png",
    "east": "art/source/player-hd/player-east-idle-anchor-preview-64.png",
    "west": "art/source/player-hd/player-west-idle-anchor-preview-64.png",
}
EDIT_CANVAS_RELS = {
    direction: f"art/source/player-hd/player-animation-{direction}-edit-canvas-1024.png"
    for direction in DIRECTIONS
}
SOURCE_SHEET_RELS = {
    direction: f"art/source/player-hd/player-animation-{direction}-source-1024.png"
    for direction in DIRECTIONS
}
LOCK_REL = "art/source/player-hd/player-seed-prep.lock.json"
OUTPUT_RELS = (
    KEYED_REL,
    NORMALIZED_REL,
    COMPARISON_REL,
    REJECTED_ANALYSIS_REL,
    REJECTED_PREVIEW_REL,
    DIRECTION_PREVIEW_REL,
    PROMPTS_REL,
    DIRECTION_ANCHOR_RELS["north"],
    DIRECTION_ANCHOR_RELS["east"],
    DIRECTION_ANCHOR_RELS["west"],
    *(EDIT_CANVAS_RELS[direction] for direction in DIRECTIONS),
)


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


def verify_image_identity(source: Path, expected_hash: str, label: str) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"{label} does not exist: {source}")
    actual_hash = sha256(source)
    if actual_hash != expected_hash:
        raise ValueError(
            f"{label} SHA256 mismatch: expected {expected_hash}, received {actual_hash}"
        )
    with Image.open(source) as image:
        if image.size != EXPECTED_SOURCE_SIZE or image.mode != EXPECTED_SOURCE_MODE:
            raise ValueError(
                f"{label} identity mismatch: expected "
                f"{EXPECTED_SOURCE_SIZE[0]}x{EXPECTED_SOURCE_SIZE[1]} {EXPECTED_SOURCE_MODE}, "
                f"received {image.width}x{image.height} {image.mode}"
            )


def verify_source(source: Path) -> None:
    verify_image_identity(source, EXPECTED_SOURCE_SHA256, "approved player seed")


def verify_toolchain(helper: Path) -> str:
    if PILLOW_VERSION != SUPPORTED_PILLOW_VERSION:
        raise RuntimeError(
            f"unsupported Pillow version: expected {SUPPORTED_PILLOW_VERSION}, "
            f"received {PILLOW_VERSION}; install requirements-hd-assets.txt"
        )
    if not helper.is_file():
        raise FileNotFoundError(f"installed chroma helper does not exist: {helper}")
    actual_hash = sha256(helper)
    if actual_hash != EXPECTED_HELPER_SHA256:
        raise RuntimeError(
            f"chroma helper SHA256 mismatch: expected {EXPECTED_HELPER_SHA256}, "
            f"received {actual_hash}, path={helper}"
        )
    return actual_hash


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


def remove_residual_chroma(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            pixel = pixels[x, y]
            if is_exact_chroma(pixel) or is_near_key_fringe(pixel):
                pixels[x, y] = (0, 0, 0, 0)
            elif pixel[3] == 0:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def chroma_metrics(image: Image.Image) -> tuple[int, int]:
    exact = 0
    near = 0
    for pixel in image.convert("RGBA").get_flattened_data():
        exact += int(is_exact_chroma(pixel))
        near += int(is_near_key_fringe(pixel))
    return exact, near


def visible_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    bounds = image.convert("RGBA").getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("prepared player seed has no visible silhouette")
    left, top, right_exclusive, bottom_exclusive = bounds
    return left, top, right_exclusive - 1, bottom_exclusive - 1


def validate_keyed_seed(image: Image.Image, label: Path) -> dict[str, object]:
    rgba = image.convert("RGBA")
    exact, near = chroma_metrics(rgba)
    if exact or near:
        raise ValueError(f"chroma remains in {label}: exact={exact}, near={near}")
    visible = sum(pixel[3] > 0 for pixel in rgba.get_flattened_data())
    if visible < 250_000 or visible > 650_000:
        raise ValueError(f"implausible keyed player coverage in {label}: {visible}")
    corners = [
        rgba.getpixel((0, 0))[3],
        rgba.getpixel((rgba.width - 1, 0))[3],
        rgba.getpixel((0, rgba.height - 1))[3],
        rgba.getpixel((rgba.width - 1, rgba.height - 1))[3],
    ]
    if corners != [0, 0, 0, 0]:
        raise ValueError(f"keyed player corners are not transparent in {label}: {corners}")
    return {"visible": visible, "bounds": list(visible_bounds(rgba)), "exact": exact, "near": near}


def validate_normalized_seed(image: Image.Image, label: Path) -> dict[str, object]:
    rgba = image.convert("RGBA")
    if rgba.size != (FRAME_SIZE, FRAME_SIZE):
        raise ValueError(f"normalized player seed must be 64x64: {label}")
    exact, near = chroma_metrics(rgba)
    if exact or near:
        raise ValueError(f"chroma remains in normalized seed {label}: exact={exact}, near={near}")
    visible = sum(pixel[3] > 0 for pixel in rgba.get_flattened_data())
    bounds = visible_bounds(rgba)
    left, top, right, bottom = bounds
    if not 700 <= visible <= 2200:
        raise ValueError(f"implausible normalized player coverage in {label}: {visible}")
    if not 2 <= top <= 10 or not 59 <= bottom <= 61:
        raise ValueError(f"normalized player anchor/padding drift in {label}: bounds={bounds}")
    if not 30 <= (left + right) / 2 <= 34 or right - left + 1 > 58:
        raise ValueError(f"normalized player center/scale drift in {label}: bounds={bounds}")
    return {"visible": visible, "bounds": list(bounds), "exact": exact, "near": near}


def parse_helper_key(output: str) -> str:
    match = re.search(r"^Key color:\s*(#[0-9a-fA-F]{6})\s*$", str(output), flags=re.MULTILINE)
    if not match:
        raise RuntimeError("chroma helper output did not contain a `Key color: #RRGGBB` diagnostic")
    return match.group(1).lower()


def run_chroma_helper(source: Path, destination: Path, helper: Path) -> str:
    command = [
        sys.executable,
        str(helper),
        "--input", str(source),
        "--out", str(destination),
        "--auto-key", "border",
        "--soft-matte",
        "--transparent-threshold", "12",
        "--opaque-threshold", "220",
        "--despill",
        "--force",
    ]
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(
            f"chroma helper failed for player seed/input {source}; helper={helper}; "
            f"return code {error.returncode}; stdout={str(error.stdout or error.output or '')}; "
            f"stderr={str(error.stderr or '')}"
        ) from error
    return parse_helper_key(result.stdout)


def key_seed(source: Path, destination: Path, helper: Path) -> tuple[Image.Image, dict[str, object], str]:
    helper_output = destination.with_name("helper-output.png")
    detected_key = run_chroma_helper(source, helper_output, helper)
    with Image.open(helper_output) as opened:
        keyed = remove_residual_chroma(opened)
    metrics = validate_keyed_seed(keyed, destination)
    save_png(keyed, destination)
    helper_output.unlink(missing_ok=True)
    return keyed, metrics, detected_key


def normalize_seed(keyed: Image.Image, destination: Path) -> tuple[Image.Image, dict[str, object]]:
    left, top, right, bottom = visible_bounds(keyed)
    crop = keyed.crop((left, top, right + 1, bottom + 1))
    scale = min(FRAME_MAX_BOUNDS[0] / crop.width, FRAME_MAX_BOUNDS[1] / crop.height)
    width = max(1, round(crop.width * scale))
    height = max(1, round(crop.height * scale))
    resized = crop.convert("RGBa").resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
    resized = remove_residual_chroma(resized)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = round(FRAME_ROOT[0] - width / 2)
    y = FRAME_ROOT[1] - height + 1
    frame.alpha_composite(resized, (x, y))
    metrics = validate_normalized_seed(frame, destination)
    save_png(frame, destination)
    return frame, metrics


def detect_components(
    image: Image.Image,
    *,
    alpha_threshold: int = REJECTED_ALPHA_THRESHOLD,
) -> list[dict[str, object]]:
    alpha = image.convert("RGBA").getchannel("A")
    width, height = alpha.size
    pixels = alpha.load()
    seen = bytearray(width * height)
    components: list[dict[str, object]] = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if seen[index] or pixels[x, y] <= alpha_threshold:
                continue
            seen[index] = 1
            stack = [(x, y)]
            area = 0
            total_x = 0
            total_y = 0
            left = right = x
            top = bottom = y
            while stack:
                current_x, current_y = stack.pop()
                area += 1
                total_x += current_x
                total_y += current_y
                left = min(left, current_x)
                right = max(right, current_x)
                top = min(top, current_y)
                bottom = max(bottom, current_y)
                for next_y in range(max(0, current_y - 1), min(height, current_y + 2)):
                    row_offset = next_y * width
                    for next_x in range(max(0, current_x - 1), min(width, current_x + 2)):
                        next_index = row_offset + next_x
                        if seen[next_index] or pixels[next_x, next_y] <= alpha_threshold:
                            continue
                        seen[next_index] = 1
                        stack.append((next_x, next_y))
            components.append({
                "area": area,
                "bounds": [left, top, right, bottom],
                "centroid": [total_x / area, total_y / area],
            })
    return components


def cluster_values(values: list[float], gap: float = 55.0) -> list[dict[str, object]]:
    ordered = sorted(values)
    groups: list[list[float]] = [[ordered[0]]]
    for value in ordered[1:]:
        if value - groups[-1][-1] > gap:
            groups.append([value])
        else:
            groups[-1].append(value)
    return [
        {
            "index": index + 1,
            "count": len(group),
            "center": round(sum(group) / len(group), 3),
            "minimum": round(min(group), 3),
            "maximum": round(max(group), 3),
        }
        for index, group in enumerate(groups)
    ]


def analyze_rejected_atlas(
    keyed: Image.Image,
    helper_detected_key: str,
) -> tuple[dict[str, object], list[dict[str, object]]]:
    raw_components = detect_components(keyed)
    meaningful = [
        component for component in raw_components
        if int(component["area"]) >= REJECTED_COMPONENT_MIN_AREA
    ]
    column_clusters = cluster_values([float(component["centroid"][0]) for component in meaningful])
    row_clusters = cluster_values([float(component["centroid"][1]) for component in meaningful])
    for component in meaningful:
        centroid_x, centroid_y = component["centroid"]
        component["column"] = min(column_clusters, key=lambda cluster: abs(float(cluster["center"]) - centroid_x))["index"]
        component["row"] = min(row_clusters, key=lambda cluster: abs(float(cluster["center"]) - centroid_y))["index"]
    meaningful.sort(key=lambda component: (int(component["row"]), int(component["column"])))
    for index, component in enumerate(meaningful, start=1):
        component["component"] = index
        component["centroid"] = [round(value, 3) for value in component["centroid"]]

    anchors = {
        "north": {
            "grid": [3, 1],
            "confidence": "high",
            "rationale": "unmistakable back-facing helmet, cape, shoulders, and no visible chest front",
        },
        "east": {
            "grid": [4, 1],
            "confidence": "high",
            "rationale": "unmistakable screen-right helmet, torso, feet, and sword orientation",
        },
        "west": {
            "grid": [6, 1],
            "confidence": "high",
            "rationale": "unmistakable screen-left helmet, torso, feet, and sword orientation",
        },
    }
    for anchor in anchors.values():
        row, column = anchor["grid"]
        component = next(
            candidate for candidate in meaningful
            if candidate["row"] == row and candidate["column"] == column
        )
        anchor["component"] = component["component"]
        anchor["bounds"] = component["bounds"]
        anchor["area"] = component["area"]

    analysis = {
        "schemaVersion": 1,
        "source": {
            "path": REJECTED_REL,
            "sha256": EXPECTED_REJECTED_SHA256,
            "width": EXPECTED_SOURCE_SIZE[0],
            "height": EXPECTED_SOURCE_SIZE[1],
            "mode": EXPECTED_SOURCE_MODE,
        },
        "helperDetectedKey": helper_detected_key,
        "alphaThreshold": REJECTED_ALPHA_THRESHOLD,
        "minimumMeaningfulArea": REJECTED_COMPONENT_MIN_AREA,
        "rawComponentCount": len(raw_components),
        "componentCount": len(meaningful),
        "detectedLayout": f"{len(column_clusters)}x{len(row_clusters)}",
        "requiredLayout": "8x8",
        "shippable": False,
        "rejectionReason": (
            "Detected 70 meaningful poses in a 10x7 layout, not 64 poses in the required 8x8 layout; "
            "six surplus poses and shifted row/column clusters prevent exact semantic slot mapping."
        ),
        "columnClusters": column_clusters,
        "rowClusters": row_clusters,
        "directionAnchors": anchors,
        "components": meaningful,
    }
    if len(raw_components) != 72 or len(meaningful) != 70:
        raise ValueError(
            f"rejected-atlas evidence changed: raw={len(raw_components)}, meaningful={len(meaningful)}"
        )
    if len(column_clusters) != 10 or any(cluster["count"] != 7 for cluster in column_clusters):
        raise ValueError(f"rejected-atlas column clustering changed: {column_clusters}")
    if len(row_clusters) != 7 or any(cluster["count"] != 10 for cluster in row_clusters):
        raise ValueError(f"rejected-atlas row clustering changed: {row_clusters}")
    return analysis, meaningful


def normalize_anchor_crops(
    keyed: Image.Image,
    analysis: dict[str, object],
    destinations: dict[str, Path],
) -> tuple[dict[str, Image.Image], dict[str, dict[str, object]]]:
    crops: dict[str, Image.Image] = {}
    for direction in ("north", "east", "west"):
        left, top, right, bottom = analysis["directionAnchors"][direction]["bounds"]
        crops[direction] = keyed.crop((left, top, right + 1, bottom + 1))
    max_width = max(crop.width for crop in crops.values())
    max_height = max(crop.height for crop in crops.values())
    shared_scale = min(FRAME_MAX_BOUNDS[0] / max_width, FRAME_MAX_BOUNDS[1] / max_height)
    frames: dict[str, Image.Image] = {}
    metrics: dict[str, dict[str, object]] = {}
    for direction, crop in crops.items():
        width = max(1, round(crop.width * shared_scale))
        height = max(1, round(crop.height * shared_scale))
        resized = crop.convert("RGBa").resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
        resized = remove_residual_chroma(resized)
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        x = round(FRAME_ROOT[0] - width / 2)
        y = FRAME_ROOT[1] - height + 1
        frame.alpha_composite(resized, (x, y))
        frame_metrics = validate_normalized_seed(frame, destinations[direction])
        frame_metrics["sharedScale"] = round(shared_scale, 8)
        frame_metrics["sourceGrid"] = analysis["directionAnchors"][direction]["grid"]
        frame_metrics["confidence"] = analysis["directionAnchors"][direction]["confidence"]
        save_png(frame, destinations[direction])
        frames[direction] = frame
        metrics[direction] = frame_metrics
    return frames, metrics


def checkerboard(size: int, cell: int = 8) -> Image.Image:
    image = Image.new("RGBA", (size, size), (41, 43, 51, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size, cell):
        for x in range(0, size, cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(65, 68, 78, 255))
    return image


def render_rejected_component_preview(
    keyed: Image.Image,
    components: list[dict[str, object]],
    destination: Path,
) -> Image.Image:
    canvas = Image.new("RGBA", (1400, 1400), (16, 17, 23, 255))
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.load_default(size=22)
    label_font = ImageFont.load_default(size=11)
    draw.text((24, 16), "REJECTED: detected 70 poses / 10 columns x 7 rows; required 64 / 8x8", font=title_font, fill=(255, 214, 116, 255))
    draw.text((24, 46), "Boxes show connected components at alpha > 16; labels are detected R#C# clusters.", font=label_font, fill=(220, 218, 229, 255))
    offset_x = 73
    offset_y = 86
    background = checkerboard(1254, 24)
    canvas.alpha_composite(background, (offset_x, offset_y))
    canvas.alpha_composite(keyed, (offset_x, offset_y))
    colors = {
        "south": (211, 146, 255, 255),
        "north": (99, 220, 255, 255),
        "east": (255, 187, 91, 255),
        "west": (130, 238, 152, 255),
    }
    for component in components:
        row = int(component["row"])
        column = int(component["column"])
        direction = "south" if row <= 2 else "north" if row == 3 else "east" if row <= 5 else "west"
        color = colors[direction]
        left, top, right, bottom = component["bounds"]
        box = (left + offset_x, top + offset_y, right + offset_x, bottom + offset_y)
        draw.rectangle(box, outline=color, width=2)
        draw.rectangle((box[0], box[1], box[0] + 38, box[1] + 13), fill=(12, 12, 18, 220))
        draw.text((box[0] + 2, box[1] + 1), f"R{row}C{column}", font=label_font, fill=color)
    draw.text((24, 1362), "Direction evidence: R1-2 south, R3 north, R4-5 east, R6-7 west. Reference only; not shippable.", font=label_font, fill=(232, 226, 238, 255))
    save_png(canvas, destination)
    return canvas


def render_direction_anchor_preview(frames: dict[str, Image.Image], destination: Path) -> Image.Image:
    canvas = Image.new("RGBA", (1120, 320), (18, 19, 25, 255))
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.load_default(size=20)
    label_font = ImageFont.load_default(size=16)
    draw.text((24, 14), "Direction anchor review - generation references only, shared 64 px root", font=title_font, fill=(236, 232, 242, 255))
    for index, direction in enumerate(DIRECTIONS):
        x = 24 + index * 272
        draw.text((x, 52), f"{direction.upper()} / confidence: high", font=label_font, fill=(210, 204, 220, 255))
        panel = checkerboard(256, 32)
        enlarged = frames[direction].resize((256, 256), Image.Resampling.NEAREST)
        panel.alpha_composite(enlarged)
        canvas.alpha_composite(panel, (x, 78))
    save_png(canvas, destination)
    return canvas


def corruption_swatch() -> Image.Image:
    image = Image.new("RGBA", (64, 64), (43, 54, 46, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, 64, 8):
        draw.line((0, y, 63, y + 3), fill=(54, 68, 57, 255), width=2)
    draw.line((7, 0, 23, 18, 17, 37, 35, 63), fill=(72, 103, 63, 255), width=2)
    draw.line((49, 0, 42, 17, 57, 33, 45, 63), fill=(31, 41, 35, 255), width=2)
    draw.ellipse((45, 12, 50, 17), fill=(99, 127, 71, 255))
    return image


def abyss_swatch() -> Image.Image:
    image = Image.new("RGBA", (64, 64), (20, 17, 29, 255))
    draw = ImageDraw.Draw(image)
    for offset in range(-32, 96, 16):
        draw.line((offset, 0, offset - 28, 63), fill=(31, 25, 43, 255), width=5)
        draw.line((offset + 6, 0, offset - 22, 63), fill=(14, 13, 20, 255), width=2)
    draw.line((3, 51, 19, 42, 28, 49, 48, 33, 62, 38), fill=(63, 41, 83, 255), width=1)
    return image


def render_comparison(frame: Image.Image, descent_path: Path, destination: Path) -> Image.Image:
    if not descent_path.is_file():
        raise FileNotFoundError(f"real Descent floor is missing: {descent_path}")
    with Image.open(descent_path) as opened:
        descent = opened.convert("RGBA")
    if descent.size != (64, 64):
        raise ValueError(f"real Descent floor must be 64x64: {descent_path}")

    canvas = Image.new("RGBA", (1440, 360), (18, 19, 25, 255))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=16)
    title_font = ImageFont.load_default(size=20)
    draw.text((24, 12), "Nameless Delver seed review - exact 64 px and 4x nearest-neighbor", font=title_font, fill=(232, 229, 239, 255))

    panels: list[tuple[int, str, Image.Image, int]] = [
        (24, "1x / transparent", checkerboard(64), 1),
        (208, "4x / transparent", checkerboard(256, 32), 4),
        (496, "4x / Descent real floor", descent.resize((256, 256), Image.Resampling.NEAREST), 4),
        (784, "4x / Corruption swatch", corruption_swatch().resize((256, 256), Image.Resampling.NEAREST), 4),
        (1072, "4x / Abyss swatch", abyss_swatch().resize((256, 256), Image.Resampling.NEAREST), 4),
    ]
    for x, label, background, scale in panels:
        draw.text((x, 52), label, font=font, fill=(201, 195, 214, 255))
        content_y = 82
        if scale == 1:
            panel = Image.new("RGBA", (160, 256), (27, 28, 35, 255))
            panel.alpha_composite(background, (48, 96))
            panel.alpha_composite(frame, (48, 96))
        else:
            panel = background.copy()
            enlarged = frame.resize((256, 256), Image.Resampling.NEAREST)
            panel.alpha_composite(enlarged)
        canvas.alpha_composite(panel, (x, content_y))
    save_png(canvas, destination)
    return canvas


def build_edit_canvas(frame: Image.Image, destination: Path) -> Image.Image:
    canvas = Image.new("RGB", (EDIT_CANVAS_SIZE, EDIT_CANVAS_SIZE), KEY_RGB)
    enlarged = frame.resize((EDIT_SLOT_SIZE, EDIT_SLOT_SIZE), Image.Resampling.NEAREST)
    canvas.paste(enlarged.convert("RGB"), (0, 0), enlarged.getchannel("A"))
    save_png(canvas, destination)
    return canvas


def validate_edit_canvas(image: Image.Image, label: Path) -> dict[str, object]:
    if image.mode != "RGB" or image.size != (EDIT_CANVAS_SIZE, EDIT_CANVAS_SIZE):
        raise ValueError(f"edit canvas must be 1024x1024 RGB: {label}")
    outside_non_key = 0
    inside_points: list[tuple[int, int]] = []
    for y in range(EDIT_CANVAS_SIZE):
        for x in range(EDIT_CANVAS_SIZE):
            pixel = image.getpixel((x, y))
            if x < EDIT_SLOT_SIZE and y < EDIT_SLOT_SIZE:
                if pixel != KEY_RGB:
                    inside_points.append((x, y))
            elif pixel != KEY_RGB:
                outside_non_key += 1
    if outside_non_key:
        raise ValueError(f"unused edit-canvas slots are not flat #ff00ff: {outside_non_key} pixels")
    if not 10_000 <= len(inside_points) <= 40_000:
        raise ValueError(f"edit-canvas R1C1 coverage is implausible: {len(inside_points)}")
    xs = [point[0] for point in inside_points]
    ys = [point[1] for point in inside_points]
    bounds = (min(xs), min(ys), max(xs), max(ys))
    left, top, right, bottom = bounds
    if not 8 <= top <= 40 or not 238 <= bottom <= 246:
        raise ValueError(f"edit-canvas seed anchor/padding drift: bounds={bounds}")
    if not 120 <= (left + right) / 2 <= 136 or left < 8 or right > 247:
        raise ValueError(f"edit-canvas seed center/padding drift: bounds={bounds}")
    return {"insideNonKey": len(inside_points), "outsideNonKey": outside_non_key, "bounds": list(bounds)}


def direction_camera_contract(direction: str) -> str:
    return {
        "south": "Face south toward the screen-bottom/viewer; show the chest-front armor read and front of the helmet consistently.",
        "north": "Face north away from the viewer; show the back of helmet, shoulders, mantle, and cape with no chest-front or visible face.",
        "east": "Face east toward screen-right in every pose; helmet, torso, feet, sword hand, and travel direction must all read screen-right.",
        "west": "Face west toward screen-left in every pose; helmet, torso, feet, sword hand, and travel direction must all read screen-left.",
    }[direction]


def build_direction_prompt(direction: str) -> str:
    return f"""Use case: stylized-concept
Asset type: one {direction}-facing direction animation sheet for a 64 px top-down 2D browser-game player

Input images in mandatory order:
- Image 1: {SOURCE_REL} — immutable approved Nameless Delver identity reference. Preserve the cold worn steel armor, dark iron and leather, restrained dark-purple mantle/cape, practical helmet with shadowed face, sword, materials, palette, and silhouette family.
- Image 2: {REJECTED_REL} — rejected multi-direction style and pose reference only. Use it to understand the same character from multiple angles and compact action language. Do not reproduce, trace, or imitate its incorrect 10-column by 7-row layout and do not copy its extra poses.
- Image 3: {EDIT_CANVAS_RELS[direction]} — mandatory edit target and exact layout reference. Edit Image 3, preserving its square canvas, flat chroma background, R1C1 anchor scale, and invisible logical slots.

Primary request:
Complete Image 3 as one coherent whole-direction edit containing exactly 16 isolated full-body poses of the same Nameless Delver in one {direction}-facing direction. Generate the complete sheet together, not frame-by-frame. Use an invisible exact 4-column by 4-row grid with equal 256 px logical slots after normalization. Keep every pose entirely inside its slot with generous padding and one shared bottom-center root.

Direction and camera:
{direction_camera_contract(direction)} Use a strict top-down/three-quarter orthographic dungeon-game camera, compact readable 64 px silhouette, and no portrait/front-camera or perspective drift. Preserve identity, handedness, armor construction, cape shape, palette, proportions, center of mass, and scale across all 16 poses. R1C1 is the direction anchor and must remain recognizable.

Exact row layout:
- R1: idle01, idle02, idle03, idle04.
- R2: move01, move02, move03, move04.
- R3: attack01, attack02, attack03, attack04.
- R4: hit01, hit02, death01, death02.

Motion:
Idle is a restrained breath and weight shift. Move is one compact grounded walk cycle. Attack is one quick readable short-sword bump attack without a large trail. Hit is a controlled two-frame recoil. Death is a restrained two-frame collapse. Motion must read at 64 px and must not imply added gameplay anticipation, delay, reach, hitbox size, or recovery.

Backdrop and exclusions:
Keep one perfectly flat, uniform solid #ff00ff chroma-key background everywhere outside the character, matching Image 3. No gradients, texture, lighting variation, fake transparency, checkerboard, floor, floor plane, cast/contact shadow, reflection, fog, particles, aura, cross-slot effects, scenery, text, labels, borders, grid lines, UI, or watermark. Do not use #ff00ff or magenta key-color detail in the character. No bright gold, modern equipment, firearm, oversized weapon, huge pauldrons, large glow, or bloom.

Output:
Output only the completed square {direction} direction sheet in the exact Image 3 layout. Output destination after generation: {SOURCE_SHEET_RELS[direction]}
"""


def write_json(payload: object, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf8", newline="\n")


def write_direction_prompts(destination: Path) -> dict[str, object]:
    payload = {
        "schemaVersion": 1,
        "inputOrder": [SOURCE_REL, REJECTED_REL, "directionEditCanvas"],
        "prompts": {direction: build_direction_prompt(direction) for direction in DIRECTIONS},
    }
    write_json(payload, destination)
    return payload


def create_lock(output_root: Path, helper: Path, helper_hash: str, metrics: dict[str, object]) -> dict[str, object]:
    return {
        "pipelineSchema": PIPELINE_SCHEMA,
        "pillowVersion": PILLOW_VERSION,
        "helper": {"path": helper.name, "sha256": helper_hash},
        "source": {
            "path": SOURCE_REL,
            "sha256": EXPECTED_SOURCE_SHA256,
            "width": EXPECTED_SOURCE_SIZE[0],
            "height": EXPECTED_SOURCE_SIZE[1],
            "mode": EXPECTED_SOURCE_MODE,
        },
        "rejectedSource": {
            "path": REJECTED_REL,
            "sha256": EXPECTED_REJECTED_SHA256,
            "width": EXPECTED_SOURCE_SIZE[0],
            "height": EXPECTED_SOURCE_SIZE[1],
            "mode": EXPECTED_SOURCE_MODE,
        },
        "normalization": {
            "frameSize": [FRAME_SIZE, FRAME_SIZE],
            "bottomCenterRoot": list(FRAME_ROOT),
            "maxBounds": list(FRAME_MAX_BOUNDS),
            "editCanvasSize": [EDIT_CANVAS_SIZE, EDIT_CANVAS_SIZE],
            "editGrid": [4, 4],
            "logicalSlotSize": EDIT_SLOT_SIZE,
        },
        "metrics": metrics,
        "outputs": {relative: sha256(output_root / relative) for relative in OUTPUT_RELS},
    }


def load_lock(lock_path: Path) -> dict[str, object]:
    if not lock_path.is_file():
        raise FileNotFoundError(f"seed preparation lock is missing: {lock_path}; use --update-lock intentionally")
    return json.loads(lock_path.read_text(encoding="utf8"))


def write_lock(lock: dict[str, object], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(lock, indent=2, sort_keys=True) + "\n", encoding="utf8", newline="\n")


def publish_transaction(pairs: list[tuple[Path, Path]], work_root: Path) -> None:
    backups = work_root / "backups"
    existing: dict[Path, Path] = {}
    created: set[Path] = set()
    replaced: list[Path] = []
    backups.mkdir(parents=True, exist_ok=True)
    try:
        for index, (_source, target) in enumerate(pairs):
            if target.exists():
                backup = backups / f"{index:02d}-{target.name}"
                shutil.copy2(target, backup)
                existing[target] = backup
            else:
                created.add(target)
        for source, target in pairs:
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(source, target)
            replaced.append(target)
    except Exception:
        for target in reversed(replaced):
            if target in existing:
                os.replace(existing[target], target)
            elif target in created:
                target.unlink(missing_ok=True)
        raise


def parse_args() -> argparse.Namespace:
    root = project_root()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="rebuild in isolation and verify the committed lock")
    parser.add_argument("--update-lock", action="store_true", help="publish outputs and intentionally replace the lock")
    parser.add_argument(
        "--helper",
        type=Path,
        default=Path.home() / ".codex" / "skills" / ".system" / "imagegen" / "scripts" / "remove_chroma_key.py",
    )
    args = parser.parse_args()
    if args.check and args.update_lock:
        parser.error("--check and --update-lock are mutually exclusive")
    args.root = root
    return args


def main() -> int:
    args = parse_args()
    root: Path = args.root
    source = root / SOURCE_REL
    rejected_source = root / REJECTED_REL
    lock_path = root / LOCK_REL
    work_parent = root / "art/work/player-seed-prep"
    work_parent.mkdir(parents=True, exist_ok=True)
    work_root = Path(tempfile.mkdtemp(prefix=f"{os.getpid()}-", dir=work_parent))
    staged_root = work_root / "staged"

    try:
        verify_source(source)
        verify_image_identity(rejected_source, EXPECTED_REJECTED_SHA256, "rejected player atlas evidence")
        helper_hash = verify_toolchain(args.helper)
        keyed, keyed_metrics, seed_detected_key = key_seed(source, staged_root / KEYED_REL, args.helper)
        frame, frame_metrics = normalize_seed(keyed, staged_root / NORMALIZED_REL)
        comparison = render_comparison(
            frame,
            root / "assets/hd/environment/descent/floor-base.png",
            staged_root / COMPARISON_REL,
        )
        if comparison.mode != "RGBA" or comparison.size != (1440, 360):
            raise ValueError("comparison preview must be 1440x360 RGBA")

        rejected_keyed, rejected_keyed_metrics, rejected_detected_key = key_seed(
            rejected_source,
            work_root / "rejected-keyed.png",
            args.helper,
        )
        rejected_analysis, rejected_components = analyze_rejected_atlas(
            rejected_keyed,
            rejected_detected_key,
        )
        write_json(rejected_analysis, staged_root / REJECTED_ANALYSIS_REL)
        rejected_preview = render_rejected_component_preview(
            rejected_keyed,
            rejected_components,
            staged_root / REJECTED_PREVIEW_REL,
        )
        if rejected_preview.mode != "RGBA" or rejected_preview.size != (1400, 1400):
            raise ValueError("rejected component preview must be 1400x1400 RGBA")

        anchor_destinations = {
            direction: staged_root / DIRECTION_ANCHOR_RELS[direction]
            for direction in ("north", "east", "west")
        }
        direction_frames, direction_metrics = normalize_anchor_crops(
            rejected_keyed,
            rejected_analysis,
            anchor_destinations,
        )
        all_frames = {"south": frame, **direction_frames}
        direction_preview = render_direction_anchor_preview(
            all_frames,
            staged_root / DIRECTION_PREVIEW_REL,
        )
        if direction_preview.mode != "RGBA" or direction_preview.size != (1120, 320):
            raise ValueError("direction anchor preview must be 1120x320 RGBA")

        edit_metrics: dict[str, dict[str, object]] = {}
        for direction in DIRECTIONS:
            destination = staged_root / EDIT_CANVAS_RELS[direction]
            edit_canvas = build_edit_canvas(all_frames[direction], destination)
            edit_metrics[direction] = validate_edit_canvas(edit_canvas, destination)
        write_direction_prompts(staged_root / PROMPTS_REL)

        metrics = {
            "keyed": keyed_metrics,
            "seedHelperDetectedKey": seed_detected_key,
            "normalized": frame_metrics,
            "rejectedKeyed": rejected_keyed_metrics,
            "rejectedLayout": {
                "rawComponentCount": rejected_analysis["rawComponentCount"],
                "componentCount": rejected_analysis["componentCount"],
                "detectedLayout": rejected_analysis["detectedLayout"],
            },
            "directionAnchors": direction_metrics,
            "editCanvases": edit_metrics,
        }
        next_lock = create_lock(staged_root, args.helper, helper_hash, metrics)

        if args.update_lock:
            staged_lock = staged_root / LOCK_REL
            write_lock(next_lock, staged_lock)
            pairs = [(staged_root / relative, root / relative) for relative in OUTPUT_RELS]
            pairs.append((staged_lock, lock_path))
            publish_transaction(pairs, work_root)
            print(f"Published prepared player seed outputs and updated {LOCK_REL}")
        else:
            committed_lock = load_lock(lock_path)
            if next_lock != committed_lock:
                raise ValueError(
                    f"prepared player seed outputs do not match lock: {lock_path}; "
                    "use --update-lock only for an intentional source/pipeline revision"
                )
            if args.check:
                print("Seed preparation lock verification passed")
            else:
                pairs = [(staged_root / relative, root / relative) for relative in OUTPUT_RELS]
                publish_transaction(pairs, work_root)
                print("Published prepared player seed outputs verified by the committed lock")

        print(f"Verified Pillow version: {PILLOW_VERSION}")
        print(f"Verified helper SHA256: {helper_hash}")
        print(f"Verified source SHA256: {EXPECTED_SOURCE_SHA256}")
        print(f"Verified rejected source SHA256: {EXPECTED_REJECTED_SHA256}")
        print(f"Keyed metrics: {json.dumps(keyed_metrics, sort_keys=True)}")
        print(f"64 px metrics: {json.dumps(frame_metrics, sort_keys=True)}")
        print(
            "Rejected layout metrics: "
            f"raw={rejected_analysis['rawComponentCount']}, "
            f"meaningful={rejected_analysis['componentCount']}, "
            f"layout={rejected_analysis['detectedLayout']}"
        )
        print(f"Direction anchor metrics: {json.dumps(direction_metrics, sort_keys=True)}")
        print(f"Edit canvas metrics: {json.dumps(edit_metrics, sort_keys=True)}")
        return 0
    finally:
        if work_root.exists():
            shutil.rmtree(work_root)
        try:
            work_parent.rmdir()
        except OSError:
            # Another isolated invocation may still own a sibling staging tree.
            pass


if __name__ == "__main__":
    raise SystemExit(main())
