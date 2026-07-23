from __future__ import annotations

import math
import random
import shutil
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art-source" / "traps-hd"
HD = ROOT / "assets" / "hd" / "hazards" / "expansion"
CLASSIC = ROOT / "assets" / "sprite" / "expansion" / "hazards" / "expansion"
WORK = SOURCE / "pipeline"
SCALE = 4


def fit_seed(path: Path, size: int = 64, footprint: int = 52) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    alpha = alpha.point(lambda value: 255 if value > 12 else 0)
    box = alpha.getbbox()
    if not box:
        raise ValueError(f"No visible pixels in {path}")
    image = image.crop(box)
    ratio = min(footprint / image.width, footprint / image.height)
    resized = image.resize(
        (max(1, round(image.width * ratio)), max(1, round(image.height * ratio))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size))
    canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas


def supersampled(size: int, painter) -> Image.Image:
    canvas = Image.new("RGBA", (size * SCALE, size * SCALE))
    painter(canvas, ImageDraw.Draw(canvas, "RGBA"), SCALE)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def glow(size: int, center: tuple[float, float], radius: float, color: tuple[int, int, int], alpha: int) -> Image.Image:
    layer = Image.new("RGBA", (size, size))
    mask = Image.new("L", (size, size))
    draw = ImageDraw.Draw(mask)
    x, y = center
    draw.ellipse((x - radius * 0.42, y - radius * 0.42, x + radius * 0.42, y + radius * 0.42), fill=alpha)
    mask = mask.filter(ImageFilter.GaussianBlur(max(1, radius * 0.46)))
    layer.paste((*color, 255), (0, 0, size, size), mask)
    return layer


def tint(image: Image.Image, color: tuple[int, int, int], strength: float) -> Image.Image:
    wash = Image.new("RGBA", image.size, (*color, 255))
    wash.putalpha(image.getchannel("A"))
    return Image.blend(image, wash, strength)


def flame_marks(intensity: float, phase: float = 0.0) -> Image.Image:
    def paint(_canvas, draw, s):
        cx = cy = 32 * s
        hot = (255, 189, 76, int(205 * intensity))
        ember = (231, 69, 20, int(190 * intensity))
        for angle in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
            wobble = math.sin(phase + angle * 2.0) * 0.8 * s
            inner = 5.5 * s
            outer = (11.0 + 2.5 * intensity) * s
            ux, uy = math.cos(angle), math.sin(angle)
            px, py = -uy, ux
            p1 = (cx + ux * inner + px * 1.5 * s, cy + uy * inner + py * 1.5 * s)
            p2 = (cx + ux * outer + px * wobble, cy + uy * outer + py * wobble)
            p3 = (cx + ux * inner - px * 1.5 * s, cy + uy * inner - py * 1.5 * s)
            draw.polygon((p1, p2, p3), fill=ember)
            draw.line((cx + ux * 6 * s, cy + uy * 6 * s, cx + ux * (9 + 2 * intensity) * s, cy + uy * (9 + 2 * intensity) * s), fill=hot, width=max(1, round(1.2 * s)))
        draw.ellipse((cx - 4 * s, cy - 4 * s, cx + 4 * s, cy + 4 * s), outline=hot, width=max(1, round(1.1 * s)))

    return supersampled(64, paint)


def local_flame_burst(progress: float, seed: int) -> Image.Image:
    rng = random.Random(seed)

    def paint(_canvas, draw, s):
        cx = cy = 32 * s
        reach = (10 + 18 * math.sin(math.pi * progress)) * s
        width = (3.5 + 3 * math.sin(math.pi * progress)) * s
        for direction in range(8):
            angle = direction * math.pi / 4 + rng.uniform(-0.07, 0.07)
            ux, uy = math.cos(angle), math.sin(angle)
            px, py = -uy, ux
            start = 5 * s
            end = reach * rng.uniform(0.8, 1.08)
            outer = [
                (cx + ux * start + px * width, cy + uy * start + py * width),
                (cx + ux * end + px * width * 0.18, cy + uy * end + py * width * 0.18),
                (cx + ux * (end + 4 * s), cy + uy * (end + 4 * s)),
                (cx + ux * end - px * width * 0.18, cy + uy * end - py * width * 0.18),
                (cx + ux * start - px * width, cy + uy * start - py * width),
            ]
            draw.polygon(outer, fill=(181, 35, 12, int(205 * (1 - 0.35 * progress))))
            inner_end = end * 0.73
            draw.polygon(
                (
                    (cx + ux * start + px * width * 0.38, cy + uy * start + py * width * 0.38),
                    (cx + ux * inner_end, cy + uy * inner_end),
                    (cx + ux * start - px * width * 0.38, cy + uy * start - py * width * 0.38),
                ),
                fill=(255, 174, 48, int(235 * (1 - 0.28 * progress))),
            )
        for _ in range(9):
            angle = rng.random() * math.tau
            distance = rng.uniform(13, 29) * math.sin(math.pi * progress) * s
            radius = rng.uniform(0.45, 1.1) * s
            x, y = cx + math.cos(angle) * distance, cy + math.sin(angle) * distance
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 202, 88, int(220 * (1 - progress * 0.55))))

    sharp = supersampled(64, paint)
    aura = sharp.filter(ImageFilter.GaussianBlur(3.2))
    aura.putalpha(aura.getchannel("A").point(lambda value: round(value * 0.48)))
    aura.alpha_composite(sharp)
    return aura


def cross_burst(progress: float, seed: int) -> Image.Image:
    rng = random.Random(seed)

    def paint(_canvas, draw, s):
        cx = cy = 96 * s
        length = (24 + 68 * math.sin(math.pi * progress)) * s
        width = (10 + 15 * math.sin(math.pi * progress)) * s
        fade = 1 - 0.42 * progress
        for angle in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
            ux, uy = math.cos(angle), math.sin(angle)
            px, py = -uy, ux
            flame = [
                (cx + px * width, cy + py * width),
                (cx + ux * length * 0.70 + px * width * 0.55, cy + uy * length * 0.70 + py * width * 0.55),
                (cx + ux * length, cy + uy * length),
                (cx + ux * length * 0.70 - px * width * 0.55, cy + uy * length * 0.70 - py * width * 0.55),
                (cx - px * width, cy - py * width),
            ]
            draw.polygon(flame, fill=(168, 31, 9, int(215 * fade)))
            draw.line((cx, cy, cx + ux * length * 0.82, cy + uy * length * 0.82), fill=(255, 167, 38, int(240 * fade)), width=max(1, round(width * 0.68)))
            draw.line((cx, cy, cx + ux * length * 0.62, cy + uy * length * 0.62), fill=(255, 222, 126, int(225 * fade)), width=max(1, round(width * 0.25)))
        for _ in range(34):
            direction = rng.choice((0, math.pi / 2, math.pi, 3 * math.pi / 2))
            distance = rng.uniform(16, max(17, length / s)) * s
            scatter = rng.uniform(-8, 8) * s
            ux, uy = math.cos(direction), math.sin(direction)
            px, py = -uy, ux
            x, y = cx + ux * distance + px * scatter, cy + uy * distance + py * scatter
            rr = rng.uniform(0.5, 1.35) * s
            draw.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(255, 186, 65, int(210 * fade)))

    sharp = supersampled(192, paint)
    aura = sharp.filter(ImageFilter.GaussianBlur(5.0))
    aura.putalpha(aura.getchannel("A").point(lambda value: round(value * 0.42)))
    aura.alpha_composite(sharp)
    return aura


def frost_sigil(intensity: float, radius: float, phase: float) -> Image.Image:
    def paint(_canvas, draw, s):
        cx = cy = 32 * s
        cyan = (126, 226, 255, int(235 * intensity))
        pale = (217, 247, 255, int(245 * intensity))
        points = []
        for index in range(8):
            angle = -math.pi / 2 + index * math.pi / 4
            rr = radius * (1.0 if index % 2 == 0 else 0.62) * s
            points.append((cx + math.cos(angle) * rr, cy + math.sin(angle) * rr))
        draw.line(points + [points[0]], fill=cyan, width=max(1, round(1.25 * s)), joint="curve")
        for angle in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
            ux, uy = math.cos(angle), math.sin(angle)
            draw.line((cx + ux * 4 * s, cy + uy * 4 * s, cx + ux * radius * 0.9 * s, cy + uy * radius * 0.9 * s), fill=pale, width=max(1, round(0.85 * s)))
        ring = (radius + 2.0 + math.sin(phase) * 0.7) * s
        draw.ellipse((cx - ring, cy - ring, cx + ring, cy + ring), outline=(86, 184, 233, int(135 * intensity)), width=max(1, round(0.7 * s)))

    sharp = supersampled(64, paint)
    aura = sharp.filter(ImageFilter.GaussianBlur(2.4))
    aura.putalpha(aura.getchannel("A").point(lambda value: round(value * 0.52)))
    aura.alpha_composite(sharp)
    return aura


def frost_burst(progress: float, seed: int) -> Image.Image:
    rng = random.Random(seed)

    def paint(_canvas, draw, s):
        cx = cy = 32 * s
        extent = (11 + 19 * math.sin(math.pi * progress)) * s
        alpha = int(235 * (1 - 0.50 * progress))
        for index in range(12):
            angle = index * math.tau / 12 + rng.uniform(-0.08, 0.08)
            ux, uy = math.cos(angle), math.sin(angle)
            px, py = -uy, ux
            base = 7 * s
            tip = extent * rng.uniform(0.76, 1.12)
            width = rng.uniform(1.1, 2.2) * s
            draw.polygon(
                (
                    (cx + ux * base + px * width, cy + uy * base + py * width),
                    (cx + ux * tip, cy + uy * tip),
                    (cx + ux * base - px * width, cy + uy * base - py * width),
                ),
                fill=(170, 235, 255, alpha),
            )
            draw.line((cx + ux * base, cy + uy * base, cx + ux * tip * 0.92, cy + uy * tip * 0.92), fill=(235, 252, 255, alpha), width=max(1, round(0.55 * s)))
        for _ in range(14):
            angle = rng.random() * math.tau
            distance = rng.uniform(13, 30) * math.sin(math.pi * progress) * s
            rr = rng.uniform(0.35, 0.9) * s
            x, y = cx + math.cos(angle) * distance, cy + math.sin(angle) * distance
            draw.polygon(((x, y - rr * 1.8), (x + rr, y), (x, y + rr * 1.8), (x - rr, y)), fill=(218, 249, 255, alpha))

    sharp = supersampled(64, paint)
    aura = sharp.filter(ImageFilter.GaussianBlur(3.0))
    aura.putalpha(aura.getchannel("A").point(lambda value: round(value * 0.55)))
    aura.alpha_composite(sharp)
    return aura


def freeze_overlay(progress: float, seed: int) -> Image.Image:
    rng = random.Random(seed)

    def paint(_canvas, draw, s):
        cx = cy = 48 * s
        radius = (20 + 18 * math.sin(math.pi * progress)) * s
        alpha = int(248 * (1 - 0.26 * progress))
        for index in range(16):
            angle = index * math.tau / 16 + rng.uniform(-0.08, 0.08)
            ux, uy = math.cos(angle), math.sin(angle)
            px, py = -uy, ux
            inner = radius * rng.uniform(0.68, 0.82)
            outer = radius * rng.uniform(0.98, 1.18)
            width = rng.uniform(2.7, 5.0) * s
            draw.polygon(
                (
                    (cx + ux * inner + px * width, cy + uy * inner + py * width),
                    (cx + ux * outer, cy + uy * outer),
                    (cx + ux * inner - px * width, cy + uy * inner - py * width),
                ),
                fill=(181, 236, 252, alpha),
            )
            draw.line((cx + ux * inner, cy + uy * inner, cx + ux * outer * 0.96, cy + uy * outer * 0.96), fill=(239, 253, 255, alpha), width=max(1, round(0.55 * s)))
        ring = radius * 0.74
        draw.ellipse((cx - ring, cy - ring, cx + ring, cy + ring), outline=(116, 216, 248, int(alpha * 0.82)), width=max(1, round(2.0 * s)))

    sharp = supersampled(96, paint)
    aura = sharp.filter(ImageFilter.GaussianBlur(4.0))
    aura.putalpha(aura.getchannel("A").point(lambda value: round(value * 0.44)))
    aura.alpha_composite(sharp)
    return aura


def smoke(progress: float) -> Image.Image:
    layer = Image.new("RGBA", (64, 64))
    for index in range(3):
        x = 27 + index * 5 + math.sin(progress * math.tau + index) * 2
        y = 31 - progress * 12 - index * 4
        puff = glow(64, (x, y), 7 + index * 2, (63, 57, 60), int(76 * (1 - progress * 0.35)))
        layer.alpha_composite(puff)
    return layer


def composite(base: Image.Image, *layers: Image.Image) -> Image.Image:
    out = base.copy()
    for layer in layers:
        out.alpha_composite(layer)
    return out


def write_frames(root: Path, names: list[str], frames: list[Image.Image]) -> None:
    root.mkdir(parents=True, exist_ok=True)
    for name, frame in zip(names, frames, strict=True):
        frame.save(root / name, optimize=True)


def strip(frames: list[Image.Image], path: Path) -> None:
    canvas = Image.new("RGBA", (frames[0].width * len(frames), frames[0].height))
    for index, frame in enumerate(frames):
        canvas.alpha_composite(frame, (index * frame.width, 0))
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, optimize=True)


def build() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    flame = fit_seed(SOURCE / "flame-vent-seed.png")
    frost = fit_seed(SOURCE / "frost-rune-seed.png")

    flame_idle = [
        composite(flame, flame_marks(0.24, 0.0)),
        composite(flame, glow(64, (32, 32), 14, (241, 75, 18), 54), flame_marks(0.34, 1.7)),
    ]
    flame_heating = [
        composite(flame, glow(64, (32, 32), 14 + i * 2, (244, 70, 15), 68 + i * 26), flame_marks(0.44 + i * 0.18, i * 0.8))
        for i in range(3)
    ]
    flame_warning = [
        composite(flame, glow(64, (32, 32), 20, (255, 82, 10), 132), flame_marks(0.92, 0.2)),
        composite(flame, glow(64, (32, 32), 24, (255, 116, 18), 178), flame_marks(1.0, 1.8)),
    ]
    eruption_progress = [0.08, 0.28, 0.52, 0.72, 0.88, 0.98]
    flame_eruption = [composite(flame, glow(64, (32, 32), 25, (255, 74, 9), 155), local_flame_burst(p, 80 + i)) for i, p in enumerate(eruption_progress)]
    flame_cooldown = [
        composite(ImageEnhance.Brightness(flame).enhance(0.78), smoke(0.25), flame_marks(0.18, 0.5)),
        composite(ImageEnhance.Brightness(flame).enhance(0.84), smoke(0.78), flame_marks(0.09, 1.3)),
    ]
    flame_cross = [cross_burst(p, 120 + i) for i, p in enumerate(eruption_progress)]

    frost_idle = [
        composite(frost, frost_sigil(0.28, 12.5, 0.0)),
        composite(frost, glow(64, (32, 32), 15, (80, 191, 238), 46), frost_sigil(0.36, 12.8, 1.2)),
    ]
    pulse_intensity = [0.40, 0.68, 0.92, 0.54]
    frost_pulse = [
        composite(frost, glow(64, (32, 32), 16 + i * 2, (79, 200, 245), 52 + i * 18), frost_sigil(value, 13.5 + i * 1.3, i * 0.9))
        for i, value in enumerate(pulse_intensity)
    ]
    frost_trigger = [composite(frost, glow(64, (32, 32), 23, (92, 211, 255), 144), frost_burst(p, 220 + i)) for i, p in enumerate(eruption_progress)]
    spent = ImageEnhance.Color(frost).enhance(0.18)
    spent = ImageEnhance.Brightness(spent).enhance(0.60)
    spent = composite(spent, tint(frost_sigil(0.12, 12.0, 0.0), (70, 100, 112), 0.72))
    frozen = [freeze_overlay(p, 320 + i) for i, p in enumerate(eruption_progress)]

    flame_root = HD / "flame-vent"
    frost_root = HD / "frost-rune"
    write_frames(flame_root, ["idle-01.png", "idle-02.png"], flame_idle)
    write_frames(flame_root, [f"heating-{i:02}.png" for i in range(1, 4)], flame_heating)
    write_frames(flame_root, ["warning-01.png", "warning-02.png"], flame_warning)
    write_frames(flame_root, [f"eruption-{i:02}.png" for i in range(1, 7)], flame_eruption)
    write_frames(flame_root, ["cooldown-01.png", "cooldown-02.png"], flame_cooldown)
    write_frames(flame_root / "cross-eruption", [f"cross-eruption-{i:02}.png" for i in range(1, 7)], flame_cross)

    write_frames(frost_root, ["idle-01.png", "idle-02.png"], frost_idle)
    write_frames(frost_root, [f"pulse-{i:02}.png" for i in range(1, 5)], frost_pulse)
    write_frames(frost_root, [f"trigger-{i:02}.png" for i in range(1, 7)], frost_trigger)
    write_frames(frost_root, ["spent-01.png"], [spent])
    write_frames(frost_root / "freeze-overlay", [f"freeze-{i:02}.png" for i in range(1, 7)], frozen)

    strip(flame_idle, WORK / "flame-idle-strip.png")
    strip(flame_heating, WORK / "flame-heating-strip.png")
    strip(flame_warning, WORK / "flame-warning-strip.png")
    strip(flame_eruption, WORK / "flame-eruption-strip.png")
    strip(flame_cooldown, WORK / "flame-cooldown-strip.png")
    strip(frost_idle, WORK / "frost-idle-strip.png")
    strip(frost_pulse, WORK / "frost-pulse-strip.png")
    strip(frost_trigger, WORK / "frost-trigger-strip.png")

    for source_root, target_root in ((flame_root, CLASSIC / "flame-vent"), (frost_root, CLASSIC / "frost-rune")):
        target_root.mkdir(parents=True, exist_ok=True)
        for source in source_root.rglob("*.png"):
            target = target_root / source.relative_to(source_root)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)


if __name__ == "__main__":
    build()
