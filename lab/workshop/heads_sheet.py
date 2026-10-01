"""Stitch heads.mjs close-ups into one sheet: a row per look, columns front / 3/4 / side.
    python lab/workshop/heads_sheet.py <dir> <out.png>   (needs Pillow)"""
import os, sys
from PIL import Image, ImageDraw

d, out = sys.argv[1], sys.argv[2]
views = ['front', 'three-quarter', 'side']
looks = sorted({f.rsplit('-', 1)[0] for f in os.listdir(d) if f.endswith('-front.png')})
looks = sorted({f[: -len('-front.png')] for f in os.listdir(d) if f.endswith('-front.png')})
S = 300
sheet = Image.new('RGB', (S * len(views), (S + 22) * len(looks)), (34, 36, 30))
draw = ImageDraw.Draw(sheet)
for r, look in enumerate(looks):
    y = r * (S + 22)
    draw.text((6, y + 5), look, fill=(230, 225, 210))
    for c, v in enumerate(views):
        p = os.path.join(d, f'{look}-{v}.png')
        if os.path.exists(p):
            sheet.paste(Image.open(p).convert('RGB').resize((S, S)), (c * S, y + 22))
sheet.save(out)
print(out, len(looks), 'looks')
