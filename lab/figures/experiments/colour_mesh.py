# Colour a generated mesh from its front cut-out (patch median, back filled from the sides) and export
# it with vertex colours, for viewing an unrigged garment. python colour_mesh.py mesh.glb cut.png out.glb [tris]
import bpy, bmesh, sys
from mathutils import Vector
mesh, cut, out = sys.argv[1:4]; TR = int(sys.argv[4]) if len(sys.argv) > 4 else 20000
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=mesh)
ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.context.view_layer.objects.active = ms[0]
for o in ms: o.select_set(True)
if len(ms) > 1: bpy.ops.object.join()
ob = bpy.context.active_object
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
d = ob.modifiers.new('d', 'DECIMATE'); d.ratio = min(1, TR / len(ob.data.polygons)); bpy.ops.object.modifier_apply(modifier='d')
vs = [v.co for v in ob.data.vertices]
lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))); hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
img = bpy.data.images.load(cut); W, H = img.size; px = img.pixels[:]
al = [px[i * 4 + 3] for i in range(W * H)]
xs = [i % W for i in range(W * H) if al[i] > .5]; ys = [i // W for i in range(W * H) if al[i] > .5]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
def sample(p):
    x = int(x0 + (p.x - lo.x) / (hi.x - lo.x) * (x1 - x0)); y = int(y0 + (p.z - lo.z) / (hi.z - lo.z) * (y1 - y0))
    r = 4; got = []
    for yy in range(max(0, y - r), min(H, y + r + 1), 2):
        for xx in range(max(0, x - r), min(W, x + r + 1), 2):
            i = yy * W + xx
            if al[i] > .5: got.append(px[i * 4:i * 4 + 3])
    if not got: return None
    return [sorted(c[j] for c in got)[len(got) // 2] for j in range(3)]
cols = [None if v.normal.y > 0.25 else sample(v.co) for v in ob.data.vertices]
nbr = [[] for _ in ob.data.vertices]
for e in ob.data.edges: a, b = e.vertices; nbr[a].append(b); nbr[b].append(a)
for _ in range(400):
    miss = [i for i, c in enumerate(cols) if c is None]
    if not miss: break
    for i in miss:
        g = [cols[n] for n in nbr[i] if cols[n] is not None]
        if g: cols[i] = [sorted(c[j] for c in g)[len(g) // 2] for j in range(3)]
lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
at = ob.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
for i, c in enumerate(cols):
    c = c or [0.5] * 3
    at.data[i].color = (*[lin(x) for x in c], 1)
ob.data.color_attributes.active_color = at
for p in ob.data.polygons: p.use_smooth = False
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
kw = dict(filepath=out, export_format='GLB', use_selection=True, export_materials='NONE')
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
except TypeError: bpy.ops.export_scene.gltf(**kw, export_colors=True)
print('coloured', out, len(ob.data.polygons), 'faces')
