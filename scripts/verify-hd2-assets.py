"""Check packaged transparency/padding and render a deterministic review contact sheet."""
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[1]
actors = json.loads((ROOT/'tools/hd2-preview/actors.json').read_text(encoding='utf-8'))
out = ROOT/'output/verification/hd2'
out.mkdir(parents=True,exist_ok=True)
contact = Image.new('RGB',(1500,1200),'#191b17')
draw = ImageDraw.Draw(contact)
total = 0
for i,actor in enumerate(actors):
    folder = ROOT/'assets/hd'/actor['root']
    frames = sorted(folder.glob('*.png'))
    expected = 32 if actor['id']=='totem' else 192 if actor['id']=='acolyte' else 128
    assert len(frames)==expected, (actor['id'],len(frames))
    for file in frames:
        im = Image.open(file)
        assert im.mode=='RGBA',file
        alpha = im.getchannel('A')
        box = alpha.getbbox()
        assert box and box[0]>0 and box[1]>0 and box[2]<im.width and box[3]<im.height, (file,box)
        assert alpha.getextrema()==(0,255),file
        total += 1
    x,y = (i%5)*300,(i//5)*300
    draw.text((x+14,y+12),actor['id'],fill='#ecd6a5')
    direction = actor['directions'][0]
    for col,clip in enumerate(['idle','move' if actor['id']!='totem' else 'awaken',actor['action']]):
        im=Image.open(folder/f'{direction}-{clip}-05.png').convert('RGBA')
        im.thumbnail((96,200))
        contact.paste(im,(x+col*98+(98-im.width)//2,y+190-im.height),im)
        draw.text((x+col*98+8,y+210),clip,fill='#9d9988')
contact.save(out/'bestiary-overview.png')
(out/'asset-quality.json').write_text(json.dumps({'frames':total,'rgba':True,'transparentPadding':True},indent=2)+'\n')
print(f'PASS: {total} RGBA frames, complete clips, real transparency and clear padding.')
