"""Deterministically package all enemy HD2 sheets without changing HD1 locks."""
import importlib.util
import json
import hashlib
import argparse
import sys
from pathlib import Path
from statistics import median
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/source/all-v2'
DEST = ROOT / 'assets/hd/all-v2'
spec = importlib.util.spec_from_file_location('early_assets', ROOT / 'scripts/build-hd2-early-assets.py')
sys.dont_write_bytecode = True
early = importlib.util.module_from_spec(spec)
spec.loader.exec_module(early)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--actor')
    args = parser.parse_args()
    actors = json.loads((SOURCE / 'actors.json').read_text(encoding='utf-8'))
    if args.actor:
        actors = [actor for actor in actors if actor['id'] == args.actor]
        if not actors:
            raise ValueError('Unknown actor')
    report = {}
    for actor in actors:
        aid = actor['id']
        sheets = {}
        sheet_names = ['totem'] if aid == 'totem' else ['idle', 'move', 'attack', 'reactions']
        for clip in sheet_names:
            receipt = json.loads((SOURCE / f'{aid}-{clip}.json').read_text(encoding='utf-8'))
            local = SOURCE / f'{aid}-{clip}.png'
            if not local.exists():
                local.write_bytes(Path(receipt['source']).read_bytes())
            repair_path = SOURCE / f'{aid}-{clip}-repair.json'
            if repair_path.exists():
                repair = json.loads(repair_path.read_text(encoding='utf-8'))
                local = SOURCE / f'{aid}-{clip}-repaired.png'
                if not local.exists():
                    local.write_bytes(Path(repair['source']).read_bytes())
            sheets[clip] = early.extract(local)
        frame_size = 256 if actor['folder'].startswith('bosses/') else 128
        folder = DEST / aid
        folder.mkdir(parents=True, exist_ok=True)
        frames_out = []
        for row, direction in enumerate(actor.get('rowDirections', early.DIRECTIONS)):
            if aid == 'totem':
                direction = 'base'
            reference = ROOT / f"assets/hd/{actor['folder']}/frames/{direction}-idle-01.png"
            old = Image.open(reference).convert('RGBA')
            old_box = old.getbbox()
            if aid == 'totem':
                idle_frames = [f for f in sheets['totem'] if f[0] == 0]
            else:
                idle_frames = [f for f in sheets['idle'] if f[0] == row]
            neutral_height = median(b[3]-b[1] for _, _, _, b in idle_frames)
            scale = (old_box[3]-old_box[1]) / old.height * frame_size / neutral_height
            # Source sheets share actor size. Calibrate the first neutral attack
            # pose once per strip, never rescale individual animated poses.
            attack_factor = 1
            if aid != 'totem':
                first = next(b for r, c, _, b in sheets['attack'] if r == row and c == 0)
                attack_factor = neutral_height / (first[3]-first[1])
            largest = max(max(b[2]-b[0],b[3]-b[1]) * (attack_factor if sheet == 'attack' else 1)
                          for sheet, frames in sheets.items() for r, _, _, b in frames if r == row)
            scale = min(scale, (frame_size - 12) / largest)
            for sheet, frames in sheets.items():
                for r, col, cell, bounds in frames:
                    if r != row:
                        continue
                    clip = sheet
                    index = col + 1
                    if aid == 'totem':
                        clip = ['idle','awaken','cast','reactions'][row]
                    if clip == 'reactions':
                        clip, index = ('hit' if col < 4 else 'death'), col % 4 + 1
                    if clip == 'attack' and actor.get('action') == 'cast':
                        clip = 'cast'
                    multiplier = scale * (attack_factor if sheet == 'attack' else 1)
                    cropped = cell.crop(bounds)
                    size = (max(1,round(cropped.width*multiplier)),max(1,round(cropped.height*multiplier)))
                    resized = cropped.resize(size, Image.Resampling.LANCZOS)
                    output = Image.new('RGBA',(frame_size,frame_size))
                    output.alpha_composite(resized,((frame_size-size[0])//2,frame_size-6-size[1]))
                    name = f'{direction}-{clip}-{index:02}.png'
                    output.save(folder / name,optimize=True)
                    frames_out.append({'file':name,'sha256':hashlib.sha256((folder/name).read_bytes()).hexdigest()})
        metadata = {'id':aid,'frameSize':frame_size,'anchor':[0.5,1],'files':frames_out}
        (folder/'manifest.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
        report[aid] = len(frames_out)
        print(f'{aid}: {len(frames_out)} RGBA frames')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
