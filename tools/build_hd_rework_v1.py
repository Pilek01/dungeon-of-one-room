from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
import math

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/source/hd-rework-v1"
DIRECTIONS = ("south", "north", "east", "west")
LAYOUT = (
    ("idle", 1), ("idle", 2), ("idle", 3), ("idle", 4),
    ("move", 1), ("move", 2), ("move", 3), ("move", 4),
    ("action", 1), ("action", 2), ("action", 3), ("action", 4),
    ("hit", 1), ("hit", 2), ("death", 1), ("death", 2),
)

def polish(frame):
    alpha = frame.getchannel("A")
    rgb = ImageEnhance.Contrast(frame.convert("RGB")).enhance(1.05)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=0.6, percent=125, threshold=3))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out

def atlas_cells(path, columns=4, rows=4):
    sheet = Image.open(path).convert("RGBA")
    sheet = sheet.resize((columns * 256, rows * 256), Image.Resampling.LANCZOS)
    return [sheet.crop((column * 256, row * 256, (column + 1) * 256, (row + 1) * 256))
            for row in range(rows) for column in range(columns)]

def effect_frame(source, size, rotation=0, opacity=1.0, scale=1.0, brightness=1.0):
    frame = source.rotate(rotation, resample=Image.Resampling.BICUBIC, expand=False)
    frame = ImageEnhance.Brightness(frame).enhance(brightness)
    scaled = max(1, round(size * scale))
    frame = frame.resize((scaled, scaled), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size))
    canvas.alpha_composite(frame, ((size - scaled) // 2, (size - scaled) // 2))
    if opacity < 1:
        canvas.putalpha(canvas.getchannel("A").point(lambda value: round(value * opacity)))
    return polish(canvas)

def save_effect(source, path, size, **kwargs):
    path.parent.mkdir(parents=True, exist_ok=True)
    effect_frame(source, size, **kwargs).save(path, optimize=True)

def direction_rotation(direction):
    return {"east": 0, "south": 90, "west": 180, "north": 270}[direction]
def alpha_centroid_x(frame):
    alpha = frame.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        return frame.width / 2
    weight = weighted_x = 0
    pixels = alpha.load()
    for y in range(bounds[1], bounds[3]):
        for x in range(bounds[0], bounds[2]):
            value = pixels[x, y]
            weight += value
            weighted_x += x * value
    return weighted_x / weight if weight else frame.width / 2


def align_effect_horizontally(frames):
    aligned = []
    for frame in frames:
        offset_x = round(frame.width / 2 - alpha_centroid_x(frame))
        canvas = Image.new("RGBA", frame.size)
        canvas.alpha_composite(frame, (offset_x, 0))
        aligned.append(canvas)
    return aligned
def bottom_anchor_x(frame, band_height=None):
    alpha = frame.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        return frame.width / 2
    band_height = band_height or max(1, round(frame.height * 0.25))
    top = max(bounds[1], bounds[3] - band_height)
    weight = weighted_x = 0
    pixels = alpha.load()
    for y in range(top, bounds[3]):
        for x in range(bounds[0], bounds[2]):
            value = pixels[x, y]
            weight += value
            weighted_x += x * value
    return weighted_x / weight if weight else frame.width / 2


def align_actor_horizontally(frames):
    aligned = []
    for frame in frames:
        offset_x = round(frame.width / 2 - bottom_anchor_x(frame))
        canvas = Image.new("RGBA", frame.size)
        canvas.alpha_composite(frame, (offset_x, 0))
        aligned.append(canvas)
    return aligned



def build_sheet_frames(source_folder, target_folder, size, action_name, anchored_clips=()):
    target_folder.mkdir(parents=True, exist_ok=True)
    for direction in DIRECTIONS:
        sheet = Image.open(source_folder / f"{direction}-sheet-alpha.png").convert("RGBA")
        sheet = sheet.resize((1024, 1024), Image.Resampling.LANCZOS)
        for index, (clip, number) in enumerate(LAYOUT):
            column, row = index % 4, index // 4
            frame = sheet.crop((column * 256, row * 256, (column + 1) * 256, (row + 1) * 256))
            clip = action_name if clip == "action" else clip
            polish(frame.resize((size, size), Image.Resampling.LANCZOS)).save(
                target_folder / f"{direction}-{clip}-{number:02d}.png", optimize=True
            )
        for clip in anchored_clips:
            clip_frames = sorted(target_folder.glob(f"{direction}-{clip}-*.png"))
            aligned = align_actor_horizontally([Image.open(path).convert("RGBA") for path in clip_frames])
            for path, frame in zip(clip_frames, aligned):
                frame.save(path, optimize=True)

def energy_overlay(size, progress, color, seed=0):
    layer = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(layer)
    cx, cy = size // 2, round(size * 0.52)
    radius = size * (0.12 + progress * 0.34)
    for width, alpha in ((18, 28), (9, 68), (3, 180)):
        inset = radius + width
        draw.ellipse((cx-inset, cy-inset, cx+inset, cy+inset), outline=(*color, alpha), width=max(1, round(width * size / 192)))
    for index in range(14):
        angle = index * math.tau / 14 + progress * 1.7 + seed
        inner, outer = radius * 0.45, radius * (1.05 + (index % 4) * 0.08)
        draw.line((cx + math.cos(angle)*inner, cy + math.sin(angle)*inner,
                   cx + math.cos(angle)*outer, cy + math.sin(angle)*outer),
                  fill=(*color, round(70 + progress*130)), width=max(1, size // 96))
    return layer.filter(ImageFilter.GaussianBlur(max(0.7, size / 256)))

def build_warden_extras():
    root = ROOT / "assets/hd/bosses/warden/phase-2-reborn"
    phase1 = ROOT / "assets/hd/bosses/warden/phase-1/frames"
    for folder in (root / "transformation", root / "final-death"):
        folder.mkdir(parents=True, exist_ok=True)
    for direction in DIRECTIONS:
        old = Image.open(phase1 / f"{direction}-idle-01.png").convert("RGBA").resize((192, 192), Image.Resampling.LANCZOS)
        new = Image.open(root / "frames" / f"{direction}-idle-01.png").convert("RGBA")
        for index in range(8):
            progress = (index + 1) / 8
            frame = Image.blend(old, new, progress)
            frame.alpha_composite(energy_overlay(192, progress, (190, 55, 255), index * 0.11))
            frame.save(root / "transformation" / f"{direction}-transform-{index+1:02d}.png", optimize=True)
        death1 = Image.open(root / "frames" / f"{direction}-death-01.png").convert("RGBA")
        death2 = Image.open(root / "frames" / f"{direction}-death-02.png").convert("RGBA")
        for index in range(8):
            progress = index / 7
            frame = Image.blend(death1, death2, progress)
            frame.putalpha(frame.getchannel("A").point(lambda value, p=progress: round(value * (1-p*0.72))))
            frame.alpha_composite(energy_overlay(192, 1-progress, (151, 51, 238), index*0.17))
            frame.save(root / "final-death" / f"{direction}-final-death-{index+1:02d}.png", optimize=True)

def build_forge_transition():
    root = ROOT / "assets/hd/bosses/blacksmith-guardian/overheat"
    base = ROOT / "assets/hd/bosses/blacksmith-guardian/frames"
    (root / "transition").mkdir(parents=True, exist_ok=True)
    for direction in DIRECTIONS:
        old = Image.open(base / f"{direction}-idle-01.png").convert("RGBA").resize((128, 128), Image.Resampling.LANCZOS)
        new = Image.open(root / "frames" / f"{direction}-idle-01.png").convert("RGBA")
        for index in range(6):
            progress = (index + 1) / 6
            frame = Image.blend(old, new, progress)
            frame.alpha_composite(energy_overlay(128, progress, (255, 104, 25), index*0.19))
            frame.save(root / "transition" / f"{direction}-overheat-{index+1:02d}.png", optimize=True)

def build_riftweaver_vfx():
    cells = atlas_cells(SOURCE / "vfx/rift-spatial-atlas-alpha.png", rows=3)
    root = ROOT / "assets/hd/vfx/expansion/riftweaver/spatial-rift"
    telegraph_frames = align_effect_horizontally(cells[:4])
    detonation_frames = align_effect_horizontally(cells[4:12])
    for index, frame in enumerate(telegraph_frames):
        save_effect(frame, root / "telegraph" / f"telegraph-{index+1:02d}.png", 192)
    for index, frame in enumerate(detonation_frames):
        save_effect(frame, root / "detonation" / f"detonation-{index+1:02d}.png", 192)
def build_bulwark_vfx():
    cells = atlas_cells(SOURCE / "vfx/bulwark-atlas-alpha.png")
    root = ROOT / "assets/hd/vfx/expansion/bulwark"
    for direction in DIRECTIONS:
        rotation = direction_rotation(direction)
        for index in range(4):
            save_effect(cells[index], root / "guard" / direction / f"guard-{index+1:02d}.png", 80, rotation=rotation)
        for index, source_index in enumerate((4, 5, 6, 7, 8, 9)):
            save_effect(cells[source_index], root / "shield-bash" / direction / f"bash-{index+1:02d}.png", 128, rotation=rotation)
    for index in range(4):
        save_effect(cells[8 + index], root / "blocked-hit" / f"blocked-{index+1:02d}.png", 64)
        save_effect(cells[12 + index], root / "backstab-hit" / f"backstab-{index+1:02d}.png", 64)

def save_pulse_sequence(source, folder, stem, count, size, start_scale=.72, end_scale=1.08):
    for index in range(count):
        progress = index / max(1, count - 1)
        save_effect(source, folder / f"{stem}-{index+1:02d}.png", size,
                    scale=start_scale + (end_scale - start_scale) * progress,
                    opacity=.58 + .42 * math.sin((progress * .78 + .12) * math.pi),
                    brightness=.82 + .34 * progress)

def build_warden_vfx():
    cells = atlas_cells(SOURCE / "vfx/warden-atlas-alpha.png")
    root = ROOT / "assets/hd/vfx/expansion/warden"
    for index in range(4):
        save_effect(cells[index], root / "rift-lattice/horizontal" / f"horizontal-{index+1:02d}.png", 64)
        save_effect(cells[index], root / "rift-lattice/vertical" / f"vertical-{index+1:02d}.png", 64, rotation=90)
        save_effect(cells[4 + index], root / "rift-lattice/intersection" / f"intersection-{index+1:02d}.png", 64)
    for index, source_index in enumerate((4, 5, 6, 7, 6, 7)):
        save_effect(cells[source_index], root / "rift-lattice/burst" / f"burst-{index+1:02d}.png", 64,
                    scale=.76 + index * .055, opacity=1 if index < 4 else .72)
    save_pulse_sequence(cells[8], root / "void-step/vanish", "vanish", 6, 192, .58, 1.12)
    save_pulse_sequence(cells[10], root / "void-step/arrival", "arrival", 6, 192, .55, 1.08)
    for index in range(4):
        save_effect(cells[9], root / "void-step/afterimage" / f"afterimage-{index+1:02d}.png", 192,
                    scale=.96 + index * .025, opacity=.72 - index * .13)
    save_pulse_sequence(cells[12], root / "doom-sigil/charge", "charge", 4, 64, .72, 1.04)
    save_pulse_sequence(cells[13], root / "doom-sigil/explosion", "explosion", 8, 192, .46, 1.16)
    hook, impact = cells[14], cells[15]
    for direction in DIRECTIONS:
        rotation = direction_rotation(direction)
        for index in range(4):
            save_effect(hook, root / "soul-chain/hook" / direction / f"hook-{index+1:02d}.png", 64,
                        rotation=rotation, scale=.72 + index * .095, opacity=.7 + index * .1)
    for index in range(4):
        save_effect(hook, root / "soul-chain/segment/horizontal" / f"segment-{index+1:02d}.png", 64,
                    scale=.82 + index * .04, brightness=.82 + index * .08)
        save_effect(hook, root / "soul-chain/segment/vertical" / f"segment-{index+1:02d}.png", 64,
                    rotation=90, scale=.82 + index * .04, brightness=.82 + index * .08)
        save_effect(impact, root / "soul-chain/pull" / f"pull-{index+1:02d}.png", 96,
                    scale=.78 + index * .08, opacity=.9 - index * .08)
    save_pulse_sequence(impact, root / "soul-chain/impact", "impact", 6, 96, .62, 1.1)

def build_forge_vfx():
    cells = atlas_cells(SOURCE / "vfx/forge-atlas-alpha.png")
    root = ROOT / "assets/hd/vfx/expansion/forge-guardian"
    for direction in DIRECTIONS:
        rotation = direction_rotation(direction)
        for index in range(4):
            save_effect(cells[index], root / "chain-hook/hook" / direction / f"hook-{index+1:02d}.png", 64, rotation=rotation)
    for index in range(4):
        save_effect(cells[4 + index], root / "chain-hook/segment/horizontal" / f"segment-{index+1:02d}.png", 64)
        save_effect(cells[4 + index], root / "chain-hook/segment/vertical" / f"segment-{index+1:02d}.png", 64, rotation=90)
        save_effect(cells[10], root / "chain-hook/pull" / f"pull-{index+1:02d}.png", 96,
                    scale=.78 + index * .075, opacity=.94 - index * .08)
        save_effect(cells[12 + index], root / "overheat-aura" / f"aura-{index+1:02d}.png", 192)
    for index, source_index in enumerate((8, 9, 10, 11, 9, 8)):
        save_effect(cells[source_index], root / "chain-hook/impact" / f"impact-{index+1:02d}.png", 96,
                    scale=.72 + index * .06, opacity=1 if index < 4 else .7)

def build_room_art():
    room_root = ROOT / "assets/hd/environment/expansion/rooms"
    room_root.mkdir(parents=True, exist_ok=True)
    for slug in ("crossroads", "blood-arena", "ambush", "horde", "duel"):
        overlay = Image.open(SOURCE / "rooms" / f"{slug}-overlay-alpha.png").convert("RGBA")
        polish(overlay.resize((576, 576), Image.Resampling.LANCZOS)).save(room_root / f"{slug}-overlay.png", optimize=True)
    cells = atlas_cells(SOURCE / "rooms/props-atlas-alpha.png")
    object_root = ROOT / "assets/hd/objects/expansion"
    vfx_root = ROOT / "assets/hd/vfx/expansion/rooms/crossroads"
    for shrine, base_index in (("power", 0), ("mercy", 4)):
        for index in range(4):
            save_effect(cells[base_index], object_root / "crossroads" / shrine / f"idle-{index+1:02d}.png", 128,
                        scale=.93 + index * .018, brightness=.88 + index * .06)
            save_effect(cells[base_index + 2], object_root / "crossroads" / shrine / f"selected-{index+1:02d}.png", 128,
                        scale=.91 + index * .025, brightness=.9 + index * .08)
        save_effect(cells[base_index + 3], object_root / "crossroads" / shrine / "used-01.png", 128)
    for shrine, source_index in (("power", 14), ("mercy", 15)):
        save_pulse_sequence(cells[source_index], vfx_root / shrine, "choice", 6, 192, .58, 1.1)
    arena = object_root / "blood-arena"
    save_effect(cells[8], arena / "gate/closed-01.png", 128, brightness=.9)
    save_effect(cells[8], arena / "gate/closed-02.png", 128, brightness=1.05)
    for index, source_index in enumerate((9, 9, 10, 10)):
        save_effect(cells[source_index], arena / "gate" / f"open-{index+1:02d}.png", 128,
                    brightness=.88 + index * .07)
    save_effect(cells[11], arena / "banner/banner-01.png", 64, brightness=.9)
    save_effect(cells[11], arena / "banner/banner-02.png", 64, brightness=1.08, scale=1.03)
    save_effect(cells[12], arena / "reward-chest/closed-01.png", 96)
    save_effect(cells[13], arena / "reward-chest/open-01.png", 96)
    for index in range(4):
        save_effect(cells[13], arena / "reward-chest" / f"glow-{index+1:02d}.png", 96,
                    scale=.92 + index * .03, brightness=.9 + index * .1, opacity=.78 + index * .06)
def main():
    build_sheet_frames(SOURCE / "warden-reborn", ROOT / "assets/hd/bosses/warden/phase-2-reborn/frames", 192, "cast", anchored_clips=("idle",))
    build_sheet_frames(SOURCE / "forge-overheat", ROOT / "assets/hd/bosses/blacksmith-guardian/overheat/frames", 128, "attack")
    build_warden_extras()
    build_forge_transition()
    build_riftweaver_vfx()
    build_bulwark_vfx()
    build_warden_vfx()
    build_forge_vfx()
    build_room_art()
    print("Built expansion HD actors, VFX, boss phases, rooms, and props")

if __name__ == "__main__":
    main()



