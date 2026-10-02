"""
Figure studio, garment labels: a clothing parser (mattmdjaga/segformer_b2_clothes, 18 labels) run on
the cut-out view(s), so rig.py can cut the figure into garments (rig.py --labels).

    python labels.py <cut-out.png> <labels.png> [<overlay.png>]

<labels.png>: one byte per pixel, the parser's label id (0 background, 1 hat, 2 hair, 3 sunglasses,
4 upper clothes, 5 skirt, 6 pants, 7 dress, 8 belt, 9/10 shoes, 11 face, 12/13 legs, 14/15 arms,
16 bag, 17 scarf). <overlay.png>: the image beside its labels, for the studio. Trained on photos, it
reads painted concept art well enough (shots/garment-labels-segformer.png); it does not tell a cloak
from the shirt under it (both "upper clothes"): rig.py splits those by colour.
The model (about 110 MB) downloads on first use.
"""
import os, sys, time
os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS', '1')
import numpy as np
from PIL import Image

T0 = time.time()
src, out = sys.argv[1], sys.argv[2]
vis = sys.argv[3] if len(sys.argv) > 3 else None

import torch
from transformers import SegformerImageProcessor, AutoModelForSemanticSegmentation
NAME = 'mattmdjaga/segformer_b2_clothes'
proc = SegformerImageProcessor.from_pretrained(NAME)
model = AutoModelForSemanticSegmentation.from_pretrained(NAME).eval()

im = Image.open(src).convert('RGBA')
rgb = Image.new('RGB', im.size, (255, 255, 255))
rgb.paste(im, mask=im.split()[3])
with torch.no_grad():
    logits = model(**proc(images=rgb, return_tensors='pt')).logits
lab = torch.nn.functional.interpolate(logits, size=rgb.size[::-1], mode='bilinear', align_corners=False).argmax(1)[0].numpy().astype(np.uint8)
alpha = np.array(im.split()[3]) > 128
lab[~alpha] = 0
Image.fromarray(lab, 'L').save(out)

names = model.config.id2label
counts = {names[int(k)]: int(v) for k, v in zip(*np.unique(lab[alpha], return_counts=True))}
print(f'[{time.time() - T0:6.1f}s] labels:', ', '.join(f'{k} {v * 100 / alpha.sum():.0f}%' for k, v in sorted(counts.items(), key=lambda kv: -kv[1]) if v * 100 / alpha.sum() >= 0.5), flush=True)

if vis:
    pal = np.array([[255, 255, 255], [230, 180, 40], [120, 70, 30], [40, 40, 40], [60, 160, 80], [200, 80, 160], [60, 80, 200], [160, 60, 200],
                    [240, 120, 0], [150, 90, 40], [150, 90, 40], [250, 200, 170], [255, 150, 150], [255, 150, 150], [200, 120, 90], [200, 120, 90],
                    [180, 140, 60], [230, 90, 90]], dtype=np.uint8)
    col = pal[lab]
    over = (np.array(rgb) * 0.35 + col * 0.65).astype(np.uint8)
    over[~alpha] = 255
    w, h = rgb.size
    sheet = Image.new('RGB', (w * 2, h), 'white')
    sheet.paste(rgb, (0, 0)); sheet.paste(Image.fromarray(over), (w, 0))
    sheet.thumbnail((1200, 800))
    sheet.save(vis)
