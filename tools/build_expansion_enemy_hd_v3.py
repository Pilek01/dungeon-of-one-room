from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter
from statistics import median


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/source/expansion-hd-v3"
OUTPUT = ROOT / "assets/hd/enemies"
DIRECTIONS = ("south", "north", "east", "west")
LAYOUT = (
    ("idle", 1), ("idle", 2), ("idle", 3), ("idle", 4),
    ("move", 1), ("move", 2), ("move", 3), ("move", 4),
    ("attack", 1), ("attack", 2), ("attack", 3), ("attack", 4),
    ("hit", 1), ("hit", 2), ("death", 1), ("death", 2),
)


def polish(frame):
    alpha = frame.getchannel("A")
    rgb = ImageEnhance.Contrast(frame.convert("RGB")).enhance(1.06)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=0.55, percent=135, threshold=3))
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return result


def lower_body_anchor(frame):
    alpha = frame.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        return 32.0, bounds
    lower_top = max(bounds[1], bounds[3] - max(14, round((bounds[3] - bounds[1]) * 0.32)))
    weight = weighted_x = 0
    pixels = alpha.load()
    for y in range(lower_top, bounds[3]):
        for x in range(bounds[0], bounds[2]):
            value = pixels[x, y]
            weight += value
            weighted_x += x * value
    return (weighted_x / weight if weight else (bounds[0] + bounds[2]) / 2), bounds


def translate_frame(frame, dx, dy):
    result = Image.new("RGBA", frame.size)
    result.alpha_composite(frame, (dx, dy))
    return result


def normalize_bulwark_clip(frames, clip):
    anchors = [lower_body_anchor(frame) for frame in frames]
    horizontal_target = median(anchor for anchor, _bounds in anchors)
    if clip != "death":
        safe_min = max(anchor - bounds[0] for anchor, bounds in anchors if bounds)
        safe_max = min(anchor + frame.width - bounds[2] for frame, (anchor, bounds) in zip(frames, anchors) if bounds)
        horizontal_target = min(max(horizontal_target, safe_min), safe_max)
    normalized = []
    for frame, (anchor, bounds) in zip(frames, anchors):
        if not bounds:
            normalized.append(frame)
            continue
        dx = 0 if clip == "death" else round(horizontal_target - anchor)
        dy = frame.height - bounds[3]
        normalized.append(translate_frame(frame, dx, dy))
    return normalized


def build_enemy(kind):
    target = OUTPUT / kind / "frames"
    target.mkdir(parents=True, exist_ok=True)
    for direction in DIRECTIONS:
        source = Image.open(SOURCE / kind / f"{direction}-sheet-alpha.png").convert("RGBA")
        sheet = source.resize((1024, 1024), Image.Resampling.LANCZOS)
        prepared = []
        for index, (clip, frame_number) in enumerate(LAYOUT):
            column, row = index % 4, index // 4
            frame = sheet.crop((column * 256, row * 256, (column + 1) * 256, (row + 1) * 256))
            prepared.append((clip, frame_number, polish(frame.resize((64, 64), Image.Resampling.LANCZOS))))
        if kind == "bulwark":
            for clip in {entry[0] for entry in prepared}:
                clip_indices = [index for index, entry in enumerate(prepared) if entry[0] == clip]
                normalized = normalize_bulwark_clip([prepared[index][2] for index in clip_indices], clip)
                for index, frame in zip(clip_indices, normalized):
                    prepared[index] = (prepared[index][0], prepared[index][1], frame)
        for clip, frame_number, frame in prepared:
            frame.save(target / f"{direction}-{clip}-{frame_number:02d}.png", optimize=True)

if __name__ == "__main__":
    build_enemy("riftweaver")
    build_enemy("bulwark")
    print("Built Riftweaver and Abyss Bulwark HD v3 frames")
