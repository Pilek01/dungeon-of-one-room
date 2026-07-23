#!/usr/bin/env python3
"""Generate deterministic pixel-art placeholder VFX for the Vault Guardian v0.8.1 patch."""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw

BASE = 16
SCALE = 4
HD = BASE * SCALE

TRANSPARENT = (0, 0, 0, 0)
GOLD = (231, 193, 83, 255)
GOLD_HI = (255, 238, 158, 255)
GOLD_DARK = (120, 78, 23, 255)
CYAN = (91, 221, 244, 255)
CYAN_HI = (210, 251, 255, 255)
CYAN_DARK = (31, 96, 130, 255)
RED = (222, 66, 78, 255)
RED_HI = (255, 142, 105, 255)
RED_DARK = (98, 24, 35, 255)
WOOD = (104, 58, 37, 255)
WOOD_HI = (171, 105, 54, 255)
SMOKE = (80, 66, 69, 190)
CHAR = (38, 25, 26, 255)


def canvas() -> Image.Image:
    return Image.new("RGBA", (BASE, BASE), TRANSPARENT)


def set_px(draw: ImageDraw.ImageDraw, x: int, y: int, color, w: int = 1, h: int = 1) -> None:
    draw.rectangle((x, y, x + w - 1, y + h - 1), fill=color)


def ring(draw: ImageDraw.ImageDraw, inset: int, color, gaps: int = 0, phase: int = 0) -> None:
    x0, y0, x1, y1 = inset, inset, BASE - 1 - inset, BASE - 1 - inset
    points = []
    for x in range(x0, x1 + 1):
        points.extend([(x, y0), (x, y1)])
    for y in range(y0 + 1, y1):
        points.extend([(x0, y), (x1, y)])
    if gaps <= 0:
        for x, y in points:
            set_px(draw, x, y, color)
        return
    for i, (x, y) in enumerate(points):
        if (i + phase) % gaps not in (0,):
            set_px(draw, x, y, color)


def draw_chest(draw: ImageDraw.ImageDraw, broken: float = 0.0) -> None:
    # Compact 16x16 chest silhouette, centered low in the tile.
    if broken < 0.85:
        set_px(draw, 3, 8, WOOD, 10, 5)
        set_px(draw, 3, 7, WOOD_HI, 10, 2)
        set_px(draw, 4, 6, WOOD, 8, 1)
        set_px(draw, 7, 8, GOLD_HI, 2, 3)
        set_px(draw, 3, 10, GOLD_DARK, 10, 1)
    if broken > 0.15:
        spread = min(4, max(1, int(round(broken * 4))))
        shards = [(4 - spread, 11), (11 + spread // 2, 10), (6, 13 + spread // 2), (10, 13)]
        for idx, (x, y) in enumerate(shards):
            color = WOOD_HI if idx % 2 == 0 else GOLD
            if 0 <= x < BASE and 0 <= y < BASE:
                set_px(draw, x, y, color, 2 if idx == 1 else 1, 1)


def frame_chest_lock(index: int, count: int) -> Image.Image:
    img = canvas(); d = ImageDraw.Draw(img)
    draw_chest(d)
    phase = index % 4
    ring(d, 1, (*GOLD[:3], 120 + phase * 30), gaps=4, phase=phase)
    # Chain bars and padlock.
    set_px(d, 2 + phase % 2, 9, GOLD_DARK, 12 - (phase % 2) * 2, 1)
    set_px(d, 7, 2, GOLD, 2, 4)
    set_px(d, 6, 4, GOLD_HI, 4, 4)
    set_px(d, 7, 6, GOLD_DARK, 2, 2)
    return img


def frame_sentence_mark(index: int, count: int) -> Image.Image:
    img = canvas(); d = ImageDraw.Draw(img)
    draw_chest(d)
    t = index / max(1, count - 1)
    inset = max(0, 3 - int(round(t * 3)))
    ring(d, inset, RED_HI if index >= count - 2 else GOLD, gaps=5, phase=index)
    # Rotating corner sigils.
    corners = [(2, 2), (13, 2), (13, 13), (2, 13)]
    for n, (x, y) in enumerate(corners):
        if (n + index) % 2 == 0:
            set_px(d, x, y, RED if t > 0.45 else GOLD_HI)
    # Central warning diamond above chest.
    cy = 3 + (index % 2)
    for x, y in [(8, cy), (7, cy + 1), (9, cy + 1), (8, cy + 2)]:
        set_px(d, x, y, RED_HI if t > 0.55 else GOLD_HI)
    return img


def frame_sentence_destroy(index: int, count: int) -> Image.Image:
    img = canvas(); d = ImageDraw.Draw(img)
    t = index / max(1, count - 1)
    draw_chest(d, broken=t)
    if t < 0.35:
        ring(d, 1, RED_HI, gaps=3, phase=index)
    else:
        radius = min(7, 1 + int(round((t - 0.3) * 10)))
        cx, cy = 8, 9
        for ray in range(12):
            angle = ray * math.pi * 2 / 12 + index * 0.11
            r0 = max(1, radius - 2)
            r1 = radius
            x0 = int(round(cx + math.cos(angle) * r0))
            y0 = int(round(cy + math.sin(angle) * r0))
            x1 = int(round(cx + math.cos(angle) * r1))
            y1 = int(round(cy + math.sin(angle) * r1))
            if 0 <= x0 < BASE and 0 <= y0 < BASE: set_px(d, x0, y0, RED_HI)
            if 0 <= x1 < BASE and 0 <= y1 < BASE: set_px(d, x1, y1, GOLD)
        if t > 0.65:
            for x, y in [(4, 5), (7, 3), (10, 4), (12, 7), (3, 9)]:
                set_px(d, x, y, SMOKE)
    return img


def frame_lockdown_node(index: int, count: int) -> Image.Image:
    img = canvas(); d = ImageDraw.Draw(img)
    pulse = index / max(1, count - 1)
    inset = 3 - (index % 3)
    ring(d, max(1, inset), CYAN if index % 2 == 0 else GOLD_HI, gaps=4, phase=index)
    # Cross security node.
    length = 3 + int(round(pulse * 3))
    set_px(d, 8, 8 - length, CYAN_HI, 1, length * 2 + 1)
    set_px(d, 8 - length, 8, CYAN_HI, length * 2 + 1, 1)
    set_px(d, 6, 6, CYAN_DARK, 5, 5)
    set_px(d, 7, 7, GOLD_HI, 3, 3)
    return img


def frame_lockdown_blast(index: int, count: int) -> Image.Image:
    img = canvas(); d = ImageDraw.Draw(img)
    t = index / max(1, count - 1)
    cx = cy = 8
    if t < 0.25:
        frame = frame_lockdown_node(index, count)
        return frame
    arm = min(8, 1 + int(round((t - 0.2) * 10)))
    thickness = 1 if t < 0.65 else 2
    alpha_color = CYAN_HI if index % 2 == 0 else GOLD_HI
    set_px(d, cx - thickness + 1, max(0, cy - arm), alpha_color, thickness, min(BASE, arm * 2 + 1))
    set_px(d, max(0, cx - arm), cy - thickness + 1, alpha_color, min(BASE, arm * 2 + 1), thickness)
    set_px(d, 6, 6, CYAN, 5, 5)
    set_px(d, 7, 7, (255, 255, 255, 255), 3, 3)
    for n in range(8):
        angle = n * math.pi / 4 + index * 0.18
        r = 3 + int(round(t * 5))
        x = int(round(cx + math.cos(angle) * r))
        y = int(round(cy + math.sin(angle) * r))
        if 0 <= x < BASE and 0 <= y < BASE:
            set_px(d, x, y, GOLD if n % 2 else CYAN)
    if t > 0.8:
        # Fade to sparse sparks at the final frame.
        overlay = Image.new("RGBA", img.size, (0, 0, 0, int(100 * (t - 0.8) / 0.2)))
        img = Image.alpha_composite(img, overlay)
    return img


SETS: dict[str, tuple[int, int, Callable[[int, int], Image.Image], str]] = {
    "vault-chest-lock": (4, 140, frame_chest_lock, "Looping lock/chain overlay while the Vault Guardian is alive."),
    "hoard-sentence-mark": (6, 120, frame_sentence_mark, "Looping condemned-chest mark; countdown number remains procedural."),
    "hoard-sentence-destroy": (8, 75, frame_sentence_destroy, "One-shot destruction burst when a condemned chest expires."),
    "lockdown-pulse-node": (6, 105, frame_lockdown_node, "Looping anchor rune drawn over each selected chest."),
    "lockdown-pulse-blast": (8, 70, frame_lockdown_blast, "One-shot cyan/gold cross detonation."),
}


def save_set(root: Path, name: str, frame_count: int, duration_ms: int, builder, description: str) -> dict:
    classic_dir = root / "classic" / name
    hd_dir = root / "hd" / name
    classic_dir.mkdir(parents=True, exist_ok=True)
    hd_dir.mkdir(parents=True, exist_ok=True)
    classic_frames: list[Image.Image] = []
    hd_frames: list[Image.Image] = []
    for index in range(frame_count):
        classic = builder(index, frame_count)
        hd = classic.resize((HD, HD), Image.Resampling.NEAREST)
        classic_frames.append(classic)
        hd_frames.append(hd)
        classic.save(classic_dir / f"frame-{index + 1:02d}.png")
        hd.save(hd_dir / f"frame-{index + 1:02d}.png")

    classic_strip = Image.new("RGBA", (BASE * frame_count, BASE), TRANSPARENT)
    hd_strip = Image.new("RGBA", (HD * frame_count, HD), TRANSPARENT)
    for index, frame in enumerate(classic_frames):
        classic_strip.alpha_composite(frame, (index * BASE, 0))
    for index, frame in enumerate(hd_frames):
        hd_strip.alpha_composite(frame, (index * HD, 0))
    classic_strip.save(classic_dir / "strip.png")
    hd_strip.save(hd_dir / "strip.png")
    return {
        "id": name,
        "description": description,
        "frames": frame_count,
        "frameDurationMs": duration_ms,
        "loop": name not in {"hoard-sentence-destroy", "lockdown-pulse-blast"},
        "classicFrameSize": [BASE, BASE],
        "hdFrameSize": [HD, HD],
        "classicPath": f"classic/{name}/frame-{{frame:02d}}.png",
        "hdPath": f"hd/{name}/frame-{{frame:02d}}.png",
        "classicStrip": f"classic/{name}/strip.png",
        "hdStrip": f"hd/{name}/strip.png",
        "anchor": "tile-center"
    }


def make_preview(root: Path, manifest: list[dict]) -> None:
    scale = 2
    cell_w = HD * 8
    cell_h = HD + 38
    width = cell_w
    height = cell_h * len(manifest)
    preview = Image.new("RGBA", (width, height), (20, 17, 24, 255))
    d = ImageDraw.Draw(preview)
    for row, entry in enumerate(manifest):
        y = row * cell_h
        d.rectangle((0, y, width - 1, y + cell_h - 1), outline=(66, 54, 73, 255), width=2)
        d.text((10, y + 8), f"{entry['id']}  |  {entry['frames']} frames @ {entry['frameDurationMs']} ms", fill=(238, 221, 177, 255))
        for index in range(entry["frames"]):
            frame = Image.open(root / "hd" / entry["id"] / f"frame-{index + 1:02d}.png").convert("RGBA")
            preview.alpha_composite(frame, (index * HD, y + 30))
    preview.save(root / "preview-vault-guardian-vfx.png")


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    root = args.output
    root.mkdir(parents=True, exist_ok=True)
    manifest = [save_set(root, name, *spec) for name, spec in SETS.items()]
    (root / "manifest.json").write_text(json.dumps({
        "pack": "Dungeon v0.8.1 Vault Guardian placeholder VFX",
        "version": 1,
        "pixelArt": True,
        "transparent": True,
        "sets": manifest
    }, indent=2), encoding="utf-8")
    make_preview(root, manifest)


if __name__ == "__main__":
    main()
