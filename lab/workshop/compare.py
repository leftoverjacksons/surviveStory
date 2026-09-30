"""
Compare a model's front silhouette (silhouette.mjs) with its concept art:
both are cut out (the concept from its white background, the render from
magenta), scaled to the same height, aligned at the feet and centre, and
overlaid. Reports the overlap (IoU) overall and per band of height, and the
width of each band in both, so shape differences are numbers, not impressions.

    python lab/workshop/compare.py <concept image> <silhouette.png> <overlay.png>

Overlay colours: grey = both, red = concept only (the model is missing it),
blue = model only (the model has too much).
"""
import sys
from PIL import Image

concept_path, render_path, out_path = sys.argv[1:4]
H = 600  # compare at this height

def mask(im, is_bg):
    im = im.convert('RGBA')
    W, Hh = im.size
    px = im.load()
    m = Image.new('L', im.size, 0)
    mp = m.load()
    for y in range(Hh):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a > 128 and not is_bg(r, g, b):
                mp[x, y] = 255
    box = m.getbbox()
    m = m.crop(box)
    w = max(1, round(m.width * H / m.height))
    return m.resize((w, H), Image.NEAREST)

concept = mask(Image.open(concept_path), lambda r, g, b: r > 235 and g > 235 and b > 235)
model = mask(Image.open(render_path), lambda r, g, b: r > 200 and b > 200 and g < 90)

W = max(concept.width, model.width) + 20
def place(m):
    c = Image.new('L', (W, H), 0)
    c.paste(m, ((W - m.width) // 2, 0))
    return c.load()
A, B = place(concept), place(model)

over = Image.new('RGB', (W, H), (255, 255, 255))
op = over.load()
both = either = 0
bands = []
for y in range(H):
    wa = [x for x in range(W) if A[x, y]]
    wb = [x for x in range(W) if B[x, y]]
    for x in range(W):
        a, b = A[x, y] > 0, B[x, y] > 0
        if a or b:
            either += 1
            if a and b:
                both += 1; op[x, y] = (150, 150, 150)
            elif a:
                op[x, y] = (220, 60, 50)
            else:
                op[x, y] = (50, 90, 220)
    bands.append((y, (wa[-1] - wa[0]) if wa else 0, (wb[-1] - wb[0]) if wb else 0))
over.save(out_path)

print(f'IoU {both / max(1, either):.3f}  (1.0 = identical silhouettes)')
print('height band      concept width  model width  (as a share of height)')
names = ['hair/head', 'head/neck', 'shoulders/arms', 'chest', 'waist/hands', 'hips', 'thighs', 'knees', 'shins', 'boots']
for i, name in enumerate(names):
    rows = bands[i * H // 10:(i + 1) * H // 10]
    ca = sum(r[1] for r in rows) / len(rows) / H
    mb = sum(r[2] for r in rows) / len(rows) / H
    print(f'{i * 10:3d}-{(i + 1) * 10:3d}% {name:15s} {ca:6.3f}        {mb:6.3f}   {"model wider" if mb > ca * 1.1 else "model narrower" if mb < ca * 0.9 else ""}')
