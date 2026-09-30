"""
A comparison sheet from shots.mjs output: the concept(s), the close turnaround,
a walking frame, and the game-zoom pixel views.

    python lab/workshop/sheet.py <shots dir> <out.png> <concept image>...
"""
import os, sys
from PIL import Image

shots, out, concepts = sys.argv[1], sys.argv[2], sys.argv[3:]
H = 600
tiles = []
for c in concepts:
    im = Image.open(c).convert('RGB'); im.thumbnail((400, H)); tiles.append(im)
for n in ('close-front', 'close-three-quarter', 'close-back', 'walk-0.55'):
    tiles.append(Image.open(os.path.join(shots, f'{n}.png')).crop((100, 120, 500, 720)))
g = [Image.open(os.path.join(shots, f'{n}.png')) for n in ('game-default', 'game-max')]
col = Image.new('RGB', (400, H), (40, 40, 40))
col.paste(g[1].resize((400, 300)), (0, 0))
col.paste(g[0].crop((100, 75, 300, 225)).resize((400, 300), Image.NEAREST), (0, 300))
tiles.append(col)
sheet = Image.new('RGB', (sum(t.width for t in tiles), H), (40, 40, 40))
x = 0
for t in tiles:
    sheet.paste(t, (x, (H - t.height) // 2)); x += t.width
sheet.save(out)
print(out, sheet.size)
