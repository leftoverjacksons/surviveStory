"""
Figure studio: a generated garment (or any loose item), coloured from its drawing, unrigged.

    python garment.py <mesh.glb> <front cut-out.png> <out.glb> [--back <back cut-out.png>] [--tris 20000]

Decimates to --tris, drops stray scraps (pieces under 5% of the largest; a pair of boots keeps both),
colours each vertex from the front view (a median over a small patch), or from the back view for
surfaces facing away when there is one (otherwise filled from the sides), and writes vertex colours.
Fitting garments onto bodies comes next; this is the garment as drawn.
"""
import bpy, bmesh, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
def opt(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
MESH, FRONT, OUT = argv[:3]
BACK = opt('--back', '')
TRIS = opt('--tris', 20000)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=MESH)
ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in ms: o.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
if len(ms) > 1: bpy.ops.object.join()
ob = bpy.context.active_object
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Stray scraps (a sliver of a neighbouring drawing) go; real pieces (the second boot) stay.
bm = bmesh.new(); bm.from_mesh(ob.data)
seen, islands = set(), []
for f in bm.faces:
    if f in seen: continue
    stack, isl = [f], []; seen.add(f)
    while stack:
        g = stack.pop(); isl.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h not in seen: seen.add(h); stack.append(h)
    islands.append(isl)
big = max(len(i) for i in islands)
drop = [f for i in islands if len(i) < 0.05 * big for f in i]
bmesh.ops.delete(bm, geom=drop, context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(ob.data); bm.free()
d = ob.modifiers.new('d', 'DECIMATE'); d.ratio = min(1, TRIS / max(1, len(ob.data.polygons)))
bpy.ops.object.modifier_apply(modifier='d')

vs = [v.co for v in ob.data.vertices]
lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))

class View:
    def __init__(self, path, back):
        img = bpy.data.images.load(path); self.W, self.H = img.size; self.px = img.pixels[:]
        W, H = self.W, self.H
        self.al = [self.px[i * 4 + 3] for i in range(W * H)]
        xs = [i % W for i in range(W * H) if self.al[i] > .5]; ys = [i // W for i in range(W * H) if self.al[i] > .5]
        self.x0, self.x1, self.y0, self.y1 = min(xs), max(xs), min(ys), max(ys)
        self.back = back
    def sample(self, p):
        u = (p.x - lo.x) / max(1e-6, hi.x - lo.x)
        if self.back: u = 1 - u  # seen from behind, the item's left is on the picture's right
        x = int(self.x0 + u * (self.x1 - self.x0)); y = int(self.y0 + (p.z - lo.z) / max(1e-6, hi.z - lo.z) * (self.y1 - self.y0))
        W, H, al, px = self.W, self.H, self.al, self.px
        r = max(2, (self.y1 - self.y0) // 150); got = []
        for yy in range(max(0, y - r), min(H, y + r + 1), max(1, r // 2)):
            for xx in range(max(0, x - r), min(W, x + r + 1), max(1, r // 2)):
                i = yy * W + xx
                if al[i] > .5: got.append(px[i * 4:i * 4 + 3])
        if not got: return None
        return [sorted(c[j] for c in got)[len(got) // 2] for j in range(3)]

front = View(FRONT, False)
back = View(BACK, True) if BACK else None
cols = [(back.sample(v.co) if back else None) if v.normal.y > 0.25 else front.sample(v.co) for v in ob.data.vertices]
nbr = [[] for _ in ob.data.vertices]
for e in ob.data.edges: a, b = e.vertices; nbr[a].append(b); nbr[b].append(a)
for _ in range(400):  # missing (off the silhouette, or the back without a back view): from the neighbours
    miss = [i for i, c in enumerate(cols) if c is None]
    if not miss: break
    for i in miss:
        g = [cols[n] for n in nbr[i] if cols[n] is not None]
        if g: cols[i] = [sorted(c[j] for c in g)[len(g) // 2] for j in range(3)]
lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
at = ob.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
for i, c in enumerate(cols):
    at.data[i].color = (*[lin(x) for x in (c or [0.5] * 3)], 1)
ob.data.color_attributes.active_color = at
for p in ob.data.polygons: p.use_smooth = False
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
kw = dict(filepath=OUT, export_format='GLB', use_selection=True, export_materials='NONE')
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
except TypeError: bpy.ops.export_scene.gltf(**kw, export_colors=True)
print(f'garment: {len(ob.data.polygons)} faces, {len(drop)} scrap faces dropped, back view {"yes" if back else "no (filled from the sides)"}; wrote {OUT}')
