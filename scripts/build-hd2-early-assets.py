"""Package generated 8x4 sprite sheets; requires Pillow, no generation or gameplay edits.

One scale per actor, shared foot anchor, real RGBA, deterministic output.
Sources and prompts live separately from the protected HD1 asset locks.
"""
import hashlib
import json
from collections import deque
from pathlib import Path
from statistics import median
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/source/early-v2'
DEST = ROOT / 'assets/hd/early-v2'
DIRECTIONS = ['south', 'north', 'east', 'west']
SIZE = 128


def extract(path):
    image = Image.open(path).convert('RGBA')
    pixels = []
    for r, g, b, a in image.getdata():
        # The generated technical background is saturated magenta. Dark purple
        # clothing stays opaque; edge spill is removed only in the key hue.
        if min(r, b) - g > 65 and r > 150 and b > 150:
            pixels.append((0, 0, 0, 0))
        else:
            pixels.append((r, g, b, a))
    image.putdata(pixels)
    # Generated swords can cross nominal cell boundaries. Find whole connected
    # actors before assigning grid slots, so no weapon is cut or duplicated.
    width, height = image.size
    mask = bytearray(image.getchannel('A').tobytes())
    components = []
    for start in range(len(mask)):
        if not mask[start]:
            continue
        mask[start] = 0
        queue = deque([start])
        points = []
        while queue:
            p = queue.popleft()
            points.append(p)
            x, y = p % width, p // width
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = x + dx, y + dy
                q = ny * width + nx
                if 0 <= nx < width and 0 <= ny < height and mask[q]:
                    mask[q] = 0
                    queue.append(q)
        if len(points) > 5:
            components.append(points)
    main = sorted(components, key=len, reverse=True)[:32]
    slots = {}
    for points in main:
        cx = sum(p % width for p in points) / len(points)
        cy = sum(p // width for p in points) / len(points)
        slot = (min(3, int(cy * 4 / height)), min(7, int(cx * 8 / width)))
        if slot in slots:
            raise ValueError(f'Ambiguous sprite components in {path.name}: {slot}')
        slots[slot] = points
    if len(slots) != 32:
        raise ValueError(f'Expected 32 actors in {path.name}')
    # Retain detached droplets/arrow details in their original grid slot.
    for points in sorted(components, key=len, reverse=True)[32:]:
        cx = sum(p % width for p in points) / len(points)
        cy = sum(p // width for p in points) / len(points)
        slots[(min(3, int(cy * 4 / height)), min(7, int(cx * 8 / width)))].extend(points)
    frames = []
    raw = image.load()
    for (row, col), points in sorted(slots.items()):
        left, top = min(p % width for p in points), min(p // width for p in points)
        right, bottom = max(p % width for p in points) + 1, max(p // width for p in points) + 1
        cell = Image.new('RGBA', (right-left, bottom-top))
        out = cell.load()
        for p in points:
            x, y = p % width, p // width
            out[x-left, y-top] = raw[x, y]
        frames.append((row, col, cell, cell.getbbox()))
    return frames


def main():
    provenance = json.loads((SOURCE / 'generation.json').read_text(encoding='utf-8'))
    report = {'frameSize': SIZE, 'anchor': [0.5, 1], 'actors': {}}
    for actor in ['player', 'slime', 'skeleton']:
        sheets = {}
        for entry in provenance['sheets']:
            if entry['actor'] != actor:
                continue
            clip = entry['clip'].replace('-key', '')
            local = SOURCE / f'{actor}-{clip}.png'
            if not local.exists():
                local.write_bytes(Path(entry['source']).read_bytes())
            if actor == 'player' and clip == 'attack':
                repair = json.loads((SOURCE / 'player-attack-repair.json').read_text(encoding='utf-8'))
                local = SOURCE / 'player-attack-repaired.png'
                if not local.exists():
                    local.write_bytes(Path(repair['source']).read_bytes())
            sheets[clip] = extract(local)
        # Match the original standing body height at the same renderer size.
        legacy_folder = 'actors/player' if actor == 'player' else f'enemies/{actor}'
        scales, corrections = {}, {}
        for row, direction in enumerate(DIRECTIONS):
            legacy = Image.open(ROOT / f'assets/hd/{legacy_folder}/frames/{direction}-idle-01.png').convert('RGBA')
            old_bounds = legacy.getbbox()
            standing_height = median(b[3] - b[1] for r, _, _, b in sheets['idle'] if r == row)
            attack_start = next(b for r, c, _, b in sheets['attack'] if r == row and c == 0)
            corrections[row] = standing_height / (attack_start[3] - attack_start[1])
            largest = max(max(b[2]-b[0], b[3]-b[1]) * (corrections[row] if clip == 'attack' else 1)
                          for clip, frames in sheets.items() for r, _, _, b in frames if r == row)
            scales[row] = min((old_bounds[3] - old_bounds[1]) * 2 / standing_height, 120 / largest)
        folder = DEST / actor
        folder.mkdir(parents=True, exist_ok=True)
        checks = []
        for sheet, frames in sheets.items():
            # Foot line uses standing frames. Death keeps its collapsing height.
            for row, col, cell, bounds in frames:
                scale = scales[row] * (corrections[row] if sheet == 'attack' else 1)
                clip = ('hit' if col < 4 else 'death') if sheet == 'reactions' else sheet
                number = col % 4 + 1 if sheet == 'reactions' else col + 1
                sprite = cell.crop(bounds)
                sprite = sprite.resize((max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))), Image.Resampling.LANCZOS)
                frame = Image.new('RGBA', (SIZE, SIZE))
                frame.alpha_composite(sprite, ((SIZE - sprite.width) // 2, SIZE - 4 - sprite.height))
                name = f'{DIRECTIONS[row]}-{clip}-{number:02}.png'
                frame.save(folder / name, optimize=True)
                checks.append({'file': name, 'sha256': hashlib.sha256((folder / name).read_bytes()).hexdigest()})
        report['actors'][actor] = {'directionScales': scales, 'attackSheetCalibration': corrections, 'files': checks}
    (DEST / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({a: {'frames': len(v['files'])} for a, v in report['actors'].items()}))


if __name__ == '__main__':
    main()
