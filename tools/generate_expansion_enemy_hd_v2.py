from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter
import math
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/source/expansion-hd-v2"
STAGING = SOURCE / "staging"
DIRECTIONS = ("south", "north", "east", "west")
SEED_INDEX = {"south": "01.png", "north": "02.png", "east": "03.png", "west": "04.png"}
CLIPS = {"idle": 4, "move": 4, "attack": 4, "hit": 2, "death": 2}


def paste_center_bottom(canvas, sprite, dx=0, dy=0):
    x = (canvas.width - sprite.width) // 2 + dx
    y = canvas.height - sprite.height + dy
    canvas.alpha_composite(sprite, (x, y))


def tint(sprite, color, strength):
    overlay = Image.new("RGBA", sprite.size, color)
    mixed = Image.blend(sprite, ImageChops.multiply(sprite, overlay), strength)
    mixed.putalpha(sprite.getchannel("A"))
    return mixed


def transform(sprite, scale=1.0, angle=0.0, alpha=1.0):
    if scale != 1.0:
        sprite = sprite.resize((max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))), Image.Resampling.LANCZOS)
    if angle:
        sprite = sprite.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    if alpha != 1.0:
        channel = sprite.getchannel("A").point(lambda value: round(value * alpha))
        sprite.putalpha(channel)
    return sprite


def prepare_seed(seed):
    """Favor broad readable forms over painterly micro-noise at game scale."""
    alpha = seed.getchannel("A")
    rgb = seed.convert("RGB").filter(ImageFilter.SMOOTH_MORE)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.10)
    rgb = ImageEnhance.Color(rgb).enhance(1.08)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.15, percent=145, threshold=5))
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return result


def idle_aura(kind, size, frame):
    layer = Image.new("RGBA", size)
    draw = ImageDraw.Draw(layer)
    pulse = (24, 42, 64, 38)[frame]
    color = (103, 205, 255) if kind == "riftweaver" else (151, 104, 245)
    cx, cy = size[0] // 2, round(size[1] * (0.45 if kind == "riftweaver" else 0.56))
    radius = (22, 25, 29, 25)[frame] if kind == "riftweaver" else (28, 31, 34, 31)[frame]
    draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), outline=(*color, pulse), width=3)
    return layer.filter(ImageFilter.GaussianBlur(2.0))


def rift_glow(size, frame):
    layer = Image.new("RGBA", size)
    draw = ImageDraw.Draw(layer)
    cx, cy = size[0] // 2, round(size[1] * 0.43)
    radius = (18, 23, 30, 20)[frame]
    for extra, alpha in ((14, 22), (8, 42), (3, 95)):
        draw.ellipse((cx-radius-extra, cy-radius-extra, cx+radius+extra, cy+radius+extra), outline=(112, 55, 255, alpha), width=max(1, extra // 4))
    for ray in range(10):
        angle = ray * math.tau / 10 + frame * 0.17
        inner = radius + 3
        outer = radius + 14 + (ray % 3) * 5
        draw.line((cx+math.cos(angle)*inner, cy+math.sin(angle)*inner, cx+math.cos(angle)*outer, cy+math.sin(angle)*outer), fill=(95, 220, 255, 175), width=2)
    return layer.filter(ImageFilter.GaussianBlur(0.7))


def animation_frame(kind, direction, clip, frame, seed):
    canvas = Image.new("RGBA", (256, 256))
    forward = {"south": (0, 1), "north": (0, -1), "east": (1, 0), "west": (-1, 0)}[direction]
    # Direction seeds touch their source canvas; inset before motion so helmets and feet never crop.
    sprite = transform(prepare_seed(seed.copy()), scale=0.88)
    dx = dy = 0
    if clip == "idle":
        # Bottom-anchored breathing remains legible after 256 -> 64 px normalization.
        dy = (0, -6, -11, -5)[frame]
        sprite = transform(sprite, scale=(1.0, 1.022, 1.04, 1.018)[frame])
    elif clip == "move":
        phase = (-1, 0, 1, 0)[frame]
        dx = forward[0] * (frame * 2) + (forward[1] != 0) * phase * 2
        dy = forward[1] * (frame * 2) - abs(phase) * 3
        sprite = transform(sprite, angle=(-1.5, 0, 1.5, 0)[frame])
    elif clip == "attack":
        lunge = (0, 3, 9, 2)[frame]
        dx, dy = forward[0] * lunge, forward[1] * lunge
        sprite = transform(sprite, scale=(1.0, 1.02, 1.045, 1.01)[frame])
    elif clip == "hit":
        recoil = (3, 8)[frame]
        dx, dy = -forward[0] * recoil, -forward[1] * recoil
        sprite = tint(sprite, (225, 100, 255, 255), (0.18, 0.34)[frame])
    elif clip == "death":
        if frame == 1:
            angle = 72 if direction in ("south", "east") else -72
            sprite = transform(sprite, scale=0.78, angle=angle, alpha=0.66)
            dy = 28
    paste_center_bottom(canvas, sprite, int(dx), int(dy))
    if clip == "idle":
        canvas.alpha_composite(idle_aura(kind, canvas.size, frame))
    if kind == "riftweaver" and clip == "attack":
        canvas.alpha_composite(rift_glow(canvas.size, frame))
    if kind == "bulwark" and clip == "attack":
        arc = Image.new("RGBA", canvas.size)
        draw = ImageDraw.Draw(arc)
        cx, cy = 128 + forward[0] * 28, 150 + forward[1] * 20
        radius = 28 + frame * 7
        draw.arc((cx-radius, cy-radius, cx+radius, cy+radius), 205, 335, fill=(174, 112, 255, 45 + frame * 35), width=5 + frame)
        canvas.alpha_composite(arc.filter(ImageFilter.GaussianBlur(1.2)))
    return canvas


def write_character_strips(kind):
    seed_dir = SOURCE / kind / "direction-seeds"
    out = STAGING / kind / "raw-strips"
    out.mkdir(parents=True, exist_ok=True)
    for direction in DIRECTIONS:
        seed = Image.open(seed_dir / SEED_INDEX[direction]).convert("RGBA")
        for clip, count in CLIPS.items():
            frames = [animation_frame(kind, direction, clip, index, seed) for index in range(count)]
            strip = Image.new("RGBA", (256 * count, 256))
            for index, frame in enumerate(frames):
                strip.alpha_composite(frame, (index * 256, 0))
            strip.save(out / f"{direction}-{clip}.png")



def polish_normalized_frames():
    """Final 64 px pass used after normalize_sprite_strip.py."""
    for kind in ("riftweaver", "bulwark"):
        root = STAGING / kind / "normalized"
        for path in root.glob("*.png"):
            image = Image.open(path).convert("RGBA")
            alpha = image.getchannel("A")
            rgb = ImageEnhance.Contrast(image.convert("RGB")).enhance(1.07)
            rgb = rgb.filter(ImageFilter.UnsharpMask(radius=0.65, percent=175, threshold=3))
            result = rgb.convert("RGBA")
            result.putalpha(alpha)
            result.save(path, optimize=True)


def glow_ring(size, progress, color, spokes=0):
    image = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(image)
    center = size / 2
    radius = max(3, progress * size * 0.42)
    for width, alpha in ((14, 30), (7, 72), (3, 190)):
        draw.ellipse((center-radius, center-radius, center+radius, center+radius), outline=(*color, alpha), width=max(1, round(width * size / 192)))
    for index in range(spokes):
        angle = index * math.tau / spokes + progress * 0.7
        inner, outer = radius * 0.45, radius * 1.2
        draw.line((center+math.cos(angle)*inner, center+math.sin(angle)*inner, center+math.cos(angle)*outer, center+math.sin(angle)*outer), fill=(128, 225, 255, 150), width=max(1, size // 96))
    return image.filter(ImageFilter.GaussianBlur(max(0.5, size / 256)))


def directional_arc(size, direction, progress, color):
    image = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(image)
    angles = {"east": (-65, 65), "south": (25, 155), "west": (115, 245), "north": (205, 335)}[direction]
    inset = round(size * (0.34 - progress * 0.16))
    draw.arc((inset, inset, size-inset, size-inset), *angles, fill=(*color, round(80 + progress * 150)), width=max(2, round(size * (0.035 + progress * 0.025))))
    return image.filter(ImageFilter.GaussianBlur(0.7))


def write_vfx():
    root = STAGING / "vfx"
    for index in range(4):
        progress = (index + 1) / 4
        path = root / "riftweaver/spatial-rift/telegraph"; path.mkdir(parents=True, exist_ok=True)
        glow_ring(192, 0.42 + progress * 0.12, (117, 58, 255), 8).save(path / f"telegraph-{index+1:02d}.png")
    for index in range(8):
        progress = (index + 1) / 8
        path = root / "riftweaver/spatial-rift/detonation"; path.mkdir(parents=True, exist_ok=True)
        glow_ring(192, min(1, progress * 1.25), (166, 72, 255), 12).save(path / f"detonation-{index+1:02d}.png")
    for name, color in (("blocked-hit", (126, 190, 255)), ("backstab-hit", (232, 76, 255))):
        path = root / f"bulwark/{name}"; path.mkdir(parents=True, exist_ok=True)
        prefix = "blocked" if name == "blocked-hit" else "backstab"
        for index in range(4):
            glow_ring(64, (index + 1) / 5, color, 5).save(path / f"{prefix}-{index+1:02d}.png")
    for direction in DIRECTIONS:
        guard = root / f"bulwark/guard/{direction}"; guard.mkdir(parents=True, exist_ok=True)
        bash = root / f"bulwark/shield-bash/{direction}"; bash.mkdir(parents=True, exist_ok=True)
        for index in range(4): directional_arc(80, direction, 0.35 + index * 0.12, (120, 105, 240)).save(guard / f"guard-{index+1:02d}.png")
        for index in range(6): directional_arc(128, direction, (index + 1) / 6, (184, 112, 255)).save(bash / f"bash-{index+1:02d}.png")


if __name__ == "__main__":
    if "--polish-normalized" in sys.argv:
        polish_normalized_frames()
    else:
        write_character_strips("riftweaver")
        write_character_strips("bulwark")
        write_vfx()
        print(STAGING)
