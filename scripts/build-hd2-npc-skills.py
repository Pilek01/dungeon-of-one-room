"""Normalize additional NPC gestures with fixed per-direction scale/foot anchors."""
import sys, importlib.util, json, hashlib
from pathlib import Path
from PIL import Image
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('early',ROOT/'scripts/build-hd2-early-assets.py')
early=importlib.util.module_from_spec(spec);spec.loader.exec_module(early)
source=ROOT/'art/source/npc-skills-v2'
for actor,clip,output_clip,directions in [('acolyte','heal','heal',['south','north','west','east']),('acolyte','buff','buff',['south','north','west','east']),('bulwark','bash','attack',['south','north','east','west'])]:
    receipt=json.loads((source/f'{actor}-{clip}.json').read_text())
    local=source/f'{actor}-{clip}.png'
    if not local.exists():local.write_bytes(Path(receipt['source']).read_bytes())
    cells=early.extract(local)
    folder=ROOT/f'assets/hd/all-v2/{actor}'
    for row,direction in enumerate(directions):
        reference=Image.open(folder/f'{direction}-idle-01.png')
        old=reference.getbbox()
        first=next(b for r,c,_,b in cells if r==row and c==0)
        scale=(old[3]-old[1])/(first[3]-first[1])
        largest=max(max(b[2]-b[0],b[3]-b[1]) for r,c,_,b in cells if r==row)
        scale=min(scale,116/largest)
        for r,c,im,box in cells:
            if r!=row:continue
            im=im.crop(box)
            im=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.LANCZOS)
            out=Image.new('RGBA',(128,128));out.alpha_composite(im,((128-im.width)//2,122-im.height))
            out.save(folder/f'{direction}-{output_clip}-{c+1:02}.png',optimize=True)
    metadata=json.loads((folder/'manifest.json').read_text())
    metadata['files']=[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(folder.glob('*.png'))]
    (folder/'manifest.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(f'{actor} {output_clip}: 32 frames')
