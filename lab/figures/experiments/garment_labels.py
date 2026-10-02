"""
Experiment (2026-10-02): can an off-the-shelf clothing parser read painted concept art?
mattmdjaga/segformer_b2_clothes (18 labels: hair, face, upper-clothes, pants, shoes, belt, bag,
scarf, ...) on a cut-out; writes the image beside its labels. On the folk scout it found hair, face,
scarf, belt, bag, pants and shoes; cloak and tunic came out as one "upper-clothes", wraps as
shoes (shots/garment-labels-segformer.png). Candidate first step for cutting garments.

    lab/figures/.venv-gen/bin/python lab/figures/experiments/garment_labels.py <cut-out.png> <out.png>
"""
import sys, numpy as np, torch
from PIL import Image
from transformers import SegformerImageProcessor, AutoModelForSemanticSegmentation
src, out = sys.argv[1], sys.argv[2]
name = 'mattmdjaga/segformer_b2_clothes'
proc = SegformerImageProcessor.from_pretrained(name)
model = AutoModelForSemanticSegmentation.from_pretrained(name)
im = Image.open(src).convert('RGBA')
rgb = Image.new('RGB', im.size, (255, 255, 255)); rgb.paste(im, mask=im.split()[3])
with torch.no_grad():
    logits = model(**proc(images=rgb, return_tensors='pt')).logits
up = torch.nn.functional.interpolate(logits, size=rgb.size[::-1], mode='bilinear', align_corners=False)
lab = up.argmax(1)[0].numpy()
names = model.config.id2label
pal = np.array([[0,0,0],[230,180,40],[120,70,30],[0,0,0],[60,160,80],[200,80,160],[60,80,200],[160,60,200],[240,120,0],[150,90,40],[150,90,40],[250,200,170],[255,150,150],[255,150,150],[200,120,90],[200,120,90],[180,140,60],[230,90,90]], dtype=np.uint8)
col = pal[lab]
a = np.array(im.split()[3]) > 128
col[~a] = 255
over = (np.array(rgb) * 0.35 + col * 0.65).astype(np.uint8)
w, h = rgb.size
sheet = Image.new('RGB', (w * 2, h), 'white'); sheet.paste(rgb, (0, 0)); sheet.paste(Image.fromarray(over), (w, 0))
sheet.thumbnail((1400, 800)); sheet.save(out)
counts = {names[int(k)]: int(v) for k, v in zip(*np.unique(lab[a], return_counts=True))}
print(sorted(counts.items(), key=lambda kv: -kv[1]))
