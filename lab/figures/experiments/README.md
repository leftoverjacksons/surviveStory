# Experiments (lab)

- `garment_labels.py`: a clothing parser on concept art (later `labels.py`).
- Kit sheet (2026-10-02): the user's sheet of a base body in shorts plus garments drawn
  separately (cloak, tunic, trousers, boots, scarf, belt, bags, wraps, gloves, bedroll).
  Each item cropped from the sheet and generated on its own with gen.py (CPU, turbo, octree 192).
  - Base body through rig.py (hero skeleton, 30k -> 12k): `shots/kit-base-body.png`, beside
    the workshop's body.base + head.face. Full anatomy, face and hair from the drawing, walks.
    Proportions are the sheet's (about 6 heads), not the hero build's (about 4.2).
  - Garments coloured with `colour_mesh.py` (front projection, back filled from the sides) and
    viewed unrigged in `kitview.html?f=<files under work/>`: `shots/kit-garments.png` (cloak,
    tunic, trousers, boot; front, 3/4, back). Real tatters, folds, laces, patches; backs are a
    guess without back views; a scrap of a neighbouring item came along with the cloak.
  - Not done yet: fitting garments to the body (place by body landmarks, inner surface onto the
    body with a gap, weights copied from the body, body regions hidden under each garment).
