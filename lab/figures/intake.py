"""
Figure studio, sheet intake: cut a character/clothing sheet into items, pair them with a back-view sheet
of the same layout, and guess what each one is.

    python intake.py <front sheet> <out dir> [--back <back sheet>] [--gap 4] [--no-guess]

Items are the separate shapes on a plain (white or transparent) background. --gap is how far apart
two shapes may be and still count as one item (px at 1000 px across; default 1: the user's kit sheet
cuts into its 18 items, a cloak and trousers that nearly touch included): raise it if an item falls into
pieces, lower it if two items that nearly touch come out as one. Specks are joined to the nearest item.
Each crop keeps only its own item (neighbours whited out). Back-sheet items pair with front items by
position. The guess is CLIP zero-shot (an image matched against a description per category); the studio
asks you to confirm it.

Writes <out>/items.json and <out>/item_NN.png (+ item_NN_back.png).
"""
import json, os, sys
os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS', '1')
import numpy as np
from PIL import Image
from scipy import ndimage

args = sys.argv[1:]
def opt(name, default):
    return type(default)(args[args.index(name) + 1]) if name in args else default
front_path, out = args[0], args[1]
back_path = opt('--back', '')
GAP = opt('--gap', 1.0)
os.makedirs(out, exist_ok=True)

CATEGORIES = ['body', 'hair', 'hat', 'scarf', 'cloak', 'top', 'belt', 'bag', 'backpack', 'gloves', 'trousers', 'wraps', 'boots', 'bedroll', 'other']

def load(path):
    im = Image.open(path)
    if im.mode in ('RGBA', 'LA') or 'transparency' in im.info:
        rgba = np.array(im.convert('RGBA'))
        fg = rgba[:, :, 3] > 40
        rgb = rgba[:, :, :3].copy(); rgb[~fg] = 255
    else:
        rgb = np.array(im.convert('RGB'))
        fg = np.abs(rgb.astype(int) - 255).sum(2) > 30
    return rgb, fg

def split(rgb, fg):
    """Label the items: shapes closer than the gap are one item; specks join the nearest item."""
    scale = max(fg.shape) / 1000
    fg = ndimage.binary_opening(fg, iterations=1)  # paper texture, jpeg noise
    joined = ndimage.binary_dilation(fg, iterations=max(1, int(round(GAP * scale))))
    lab, n = ndimage.label(joined)
    lab[~fg] = 0
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    big = [i + 1 for i, s in enumerate(sizes) if s >= max(200 * scale * scale, 0.004 * sizes.max())]
    if not big: return np.zeros_like(lab), []
    keep = np.isin(lab, big)
    # specks: take the label of the nearest kept pixel
    _, (iy, ix) = ndimage.distance_transform_edt(~keep, return_indices=True)
    near = lab[iy, ix]
    lab = np.where(fg, near, 0)
    return lab, big

def boxes(lab, ids):
    out = []
    for i in ids:
        ys, xs = np.nonzero(lab == i)
        out.append((i, int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)))
    # reading order: rows (by top, in bands of the median item height), then left to right
    band = max(1, int(np.median([b[4] for b in out]) * 0.6)) if out else 1
    return sorted(out, key=lambda b: (b[2] // band, b[1]))

def crop(rgb, lab, i, x, y, w, h, path):
    pad = max(8, int(0.04 * max(w, h)))
    H, W = lab.shape
    x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(W, x + w + pad), min(H, y + h + pad)
    c = rgb[y0:y1, x0:x1].copy()
    mine = lab[y0:y1, x0:x1] == i
    c[~mine] = 255  # neighbours (and gaps) white
    # The item's own mask as alpha: generation then skips the background remover, which can eat drawings
    # (an empty picture gives the model nothing: "No surface found"). Small holes (near-white highlights)
    # are filled; large ones (the loop of a strap) stay transparent.
    m = ndimage.binary_closing(mine, iterations=2) | mine
    holes, n = ndimage.label(ndimage.binary_fill_holes(m) & ~m)
    if n:
        sz = ndimage.sum(holes > 0, holes, range(1, n + 1))
        m |= np.isin(holes, [k + 1 for k, v in enumerate(sz) if v < 0.01 * mine.sum()])
    a = m * 255
    Image.fromarray(np.dstack([c, a.astype(np.uint8)])).save(path)

rgb, fg = load(front_path)
lab, ids = split(rgb, fg)
items = []
for k, (i, x, y, w, h) in enumerate(boxes(lab, ids)):
    f = f'item_{k:02d}.png'
    crop(rgb, lab, i, x, y, w, h, os.path.join(out, f))
    items.append({'index': k, 'box': [x, y, w, h], 'front': f, 'back': None,
                  'centre': [(x + w / 2) / lab.shape[1], (y + h / 2) / lab.shape[0]], 'size': [w / lab.shape[1], h / lab.shape[0]]})

if back_path:  # pair by position (same layout): nearest centre, sizes alike, one each
    brgb, bfg = load(back_path)
    blab, bids = split(brgb, bfg)
    cand = []
    for (i, x, y, w, h) in boxes(blab, bids):
        c = [(x + w / 2) / blab.shape[1], (y + h / 2) / blab.shape[0]]; sz = [w / blab.shape[1], h / blab.shape[0]]
        for it in items:
            d = np.hypot(c[0] - it['centre'][0], c[1] - it['centre'][1]) + 0.5 * abs(np.log((sz[0] * sz[1] + 1e-9) / (it['size'][0] * it['size'][1] + 1e-9)))
            cand.append((d, it['index'], (i, x, y, w, h)))
    used_f, used_b = set(), set()
    for d, k, b in sorted(cand, key=lambda t: t[0]):
        if d > 0.15 or k in used_f or b[0] in used_b: continue
        used_f.add(k); used_b.add(b[0])
        f = f'item_{k:02d}_back.png'
        crop(brgb, blab, *b, os.path.join(out, f))
        items[k]['back'] = f

# ---------------------------------------------------------------- what each item is (a guess, confirmed in the studio)
CLIP_TEXT = {  # category -> what it looks like (CLIP zero-shot); isolated objects, so not the clothing parser
    'body': 'a full-body drawing of a person standing, wearing only underwear',
    'hair': 'a drawing of a hairstyle, a wig',
    'hat': 'a drawing of a hat',
    'scarf': 'a drawing of a scarf',
    'cloak': 'a drawing of a ragged cloak or cape with a hood',
    'top': 'a drawing of a shirt, tunic or jacket',
    'belt': 'a drawing of a leather belt with a buckle',
    'bag': 'a drawing of a small shoulder bag, satchel or pouch',
    'backpack': 'a drawing of a backpack',
    'gloves': 'a drawing of a glove',
    'trousers': 'a drawing of a pair of trousers',
    'wraps': 'a drawing of a cloth bandage leg wrap',
    'boots': 'a drawing of a boot',
    'bedroll': 'a drawing of a rolled-up bedroll blanket with straps',
    'other': 'a drawing of an object',
}
if '--no-guess' not in args:
    import torch
    from transformers import CLIPModel, CLIPProcessor
    NAME = 'openai/clip-vit-base-patch32'
    model = CLIPModel.from_pretrained(NAME).eval(); proc = CLIPProcessor.from_pretrained(NAME)
    cats = list(CLIP_TEXT)
    for it in items:
        im = Image.open(os.path.join(out, it['front'])).convert('RGB')
        with torch.no_grad():
            r = model(**proc(text=[CLIP_TEXT[c] for c in cats], images=im, return_tensors='pt', padding=True))
        p = r.logits_per_image.softmax(-1)[0].tolist()
        best = sorted(zip(cats, p), key=lambda t: -t[1])
        it['guess'] = best[0][0]
        it['parser'] = {c: round(v, 2) for c, v in best[:3]}

json.dump({'categories': CATEGORIES, 'items': items, 'gap': GAP, 'size': [int(lab.shape[1]), int(lab.shape[0])]},
          open(os.path.join(out, 'items.json'), 'w'), indent=1)
print(f'{len(items)} items' + (f', {sum(1 for i in items if i["back"])} paired with the back sheet' if back_path else ''))
for it in items:
    print(f"  {it['index']:2d} {it.get('guess', '?'):9s} {it['box']}{'  +back' if it['back'] else ''}  {it.get('parser', '')}")
