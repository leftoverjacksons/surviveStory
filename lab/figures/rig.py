"""
Lab (not part of the game): rig a generated character mesh onto the game's
survivor skeleton, so it plays the game's clips (anims.glb) unchanged.

    python lab/figures/rig.py <mesh.glb> <image.png> <out.glb> [--tris 3000] [--k 6] [--preview <png>]

(with Blender's Python module: `pip install bpy`).

Steps:
  1. Import the generated mesh (Hunyuan3D / TRELLIS output), join, stand it
     on the ground at the survivors' height (Head bone tip 1.69), centred.
  2. Voxel-remesh (watertight, which heat weighting wants) and decimate to
     about --tris triangles.
  3. Build the game's skeleton (bone table copied from
     scripts/blender/survivor.py), fitted to the mesh's measured proportions.
  4. Skin with Blender's automatic (heat) weights; fall back to distance
     weights if heat weighting fails.
  5. Colour: project the input image onto the mesh from the front, cluster
     the vertex colours into --k groups and turn each group into a named
     material (skin / hair / boot / cloth_N). scripts/characters.mjs turns
     material names into the game's recolour slots.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
def opt(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
MESH, IMAGE, OUT = argv[0], argv[1], argv[2]
TRIS = opt('--tris', 3000)
K = opt('--k', 6)
PREVIEW = opt('--preview', '')
VOXEL = opt('--voxel', 0.012)
TOP = 1.69  # Head bone tip in the game's skeleton

# ---------------------------------------------------------------- skeleton (from scripts/blender/survivor.py)
J = dict(
    pelvis=(0, 0, 0.86), waist=(0, 0, 0.98), belly=(0, 0, 1.1), chest=(0, 0, 1.24), neck=(0, 0, 1.38), head=(0, 0, 1.44),
    hip=(0.1, 0.005, 0.82), knee=(0.108, 0.0, 0.46), ankle=(0.112, 0.015, 0.1), toe=(0.112, -0.1, 0.045),
    shoulder=(0.195, 0, 1.31), elbow=(0.25, 0.01, 1.06), wrist=(0.27, -0.02, 0.84), hand=(0.277, -0.035, 0.76),
)

def sym(name, h, t, parent):
    out = []
    for side, s in (('L', 1), ('R', -1)):
        out.append((f'{name}.{side}', (h[0] * s, h[1], h[2]), (t[0] * s, t[1], t[2]), parent.replace('*', side) if parent else None))
    return out

def bones(fit):
    """The game's bone table, with every joint passed through fit()."""
    j = {k: fit(k, v) for k, v in J.items()}
    b = [
        ('Root', (0, 0, 0), (0, 0.15, 0), None),
        ('Hips', j['pelvis'], j['waist'], 'Root'),
        ('Abdomen', j['waist'], j['belly'], 'Hips'),
        ('Torso', j['belly'], j['chest'], 'Abdomen'),
        ('Chest', j['chest'], j['neck'], 'Torso'),
        ('Neck', j['neck'], j['head'], 'Chest'),
        ('Head', j['head'], fit('top', (0, 0, TOP)), 'Neck'),
    ]
    b += sym('Shoulder', (0.04, 0, j['shoulder'][2]), j['shoulder'], 'Chest')
    b += sym('UpperArm', j['shoulder'], j['elbow'], 'Shoulder.*')
    b += sym('LowerArm', j['elbow'], j['wrist'], 'UpperArm.*')
    b += sym('Wrist', j['wrist'], j['hand'], 'LowerArm.*')
    b += sym('UpperLeg', j['hip'], j['knee'], 'Hips')
    b += sym('LowerLeg', j['knee'], j['ankle'], 'UpperLeg.*')
    b += sym('Foot', j['ankle'], j['toe'], 'LowerLeg.*')
    return b

# ---------------------------------------------------------------- 1. import and normalise
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=MESH)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.active_object
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.context.scene.objects):
    if o != ob:
        bpy.data.objects.remove(o)

def bbox(o):
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return lo, hi

lo, hi = bbox(ob)
s = TOP / (hi.z - lo.z)
for v in ob.data.vertices:
    v.co = Vector(((v.co.x - (lo.x + hi.x) / 2) * s, (v.co.y - (lo.y + hi.y) / 2) * s, (v.co.z - lo.z) * s))
ob.data.update()
print(f'imported {len(ob.data.polygons)} faces, scale {s:.3f}')

# ---------------------------------------------------------------- 2. remesh and decimate
rm = ob.modifiers.new('remesh', 'REMESH')
rm.mode = 'VOXEL'; rm.voxel_size = VOXEL
bpy.ops.object.modifier_apply(modifier='remesh')
# Keep the largest connected piece (voxel remesh can leave specks).
bm = bmesh.new(); bm.from_mesh(ob.data)
seen, islands = set(), []
for f in bm.faces:
    if f in seen: continue
    stack, isl = [f], []
    seen.add(f)
    while stack:
        g = stack.pop(); isl.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h not in seen: seen.add(h); stack.append(h)
    islands.append(isl)
islands.sort(key=len, reverse=True)
bmesh.ops.delete(bm, geom=[f for isl in islands[1:] for f in isl], context='FACES')
bm.to_mesh(ob.data); bm.free()
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
dec = ob.modifiers.new('dec', 'DECIMATE')
dec.ratio = min(1.0, TRIS / max(tris, 1)); dec.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec')
print(f'remeshed {tris} tris -> {len(ob.data.polygons)} (islands dropped: {len(islands) - 1})')

# ---------------------------------------------------------------- 3. fit the skeleton
V = [v.co.copy() for v in ob.data.vertices]
def width_at(z, band=0.03, core=None):
    """Half-width of the mesh in x at height z (optionally only |x| < core)."""
    xs = [abs(p.x) for p in V if abs(p.z - z) < band and (core is None or abs(p.x) < core)]
    return max(xs) if xs else 0
def depth_mid(z, band=0.03):
    ys = [p.y for p in V if abs(p.z - z) < band]
    return (min(ys) + max(ys)) / 2 if ys else 0

# Hip and shoulder widths from the mesh (legs and arms hang at the sides, so
# the widest point at shoulder height is the arms' outer edge: take a share).
hip_w = width_at(J['hip'][2] * 1.0) * 0.55
sh_w = width_at(J['shoulder'][2] - 0.04) * 0.78
kx_hip = hip_w / J['hip'][0] if hip_w else 1
kx_sh = sh_w / J['shoulder'][0] if sh_w else 1
print(f'fit: hip x {kx_hip:.2f}, shoulder x {kx_sh:.2f}')
LEG = {'hip', 'knee', 'ankle', 'toe'}
ARM = {'shoulder', 'elbow', 'wrist', 'hand'}
def fit(k, p):
    kx = kx_hip if k in LEG else kx_sh if k in ARM else 1
    y = depth_mid(p[2]) if k not in ('toe',) else p[1] + depth_mid(p[2] + 0.05)
    return (p[0] * kx, y if k not in LEG | ARM else p[1] + depth_mid(p[2]), p[2])
BONES = bones(fit)

arm = bpy.data.armatures.new('Rig')
rig = bpy.data.objects.new('Rig', arm)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for n, h, t, p in BONES:
    b = arm.edit_bones.new(n)
    b.head, b.tail = Vector(h), Vector(t)
    if p:
        b.parent = arm.edit_bones[p]; b.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')
arm.bones['Root'].use_deform = False

# ---------------------------------------------------------------- 4. skin
bpy.ops.object.select_all(action='DESELECT')
ob.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
weighted = sum(1 for v in ob.data.vertices if any(g.weight > 0 for g in v.groups))
print(f'heat weights: {weighted}/{len(ob.data.vertices)} vertices weighted')
if weighted < 0.95 * len(ob.data.vertices):
    print('heat weighting incomplete: distance weights instead')
    for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
    segs = {n: (Vector(h), Vector(t)) for n, h, t, _ in BONES if n != 'Root'}
    def seg_dist(p, a, b):
        ab = b - a; t = max(0, min(1, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
        return (a + ab * t - p).length
    for n in segs: ob.vertex_groups.new(name=n)
    for v in ob.data.vertices:
        ds = sorted((seg_dist(v.co, *segs[n]), n) for n in segs)
        d0 = ds[0][0]
        ws = [(n, 1 / max(d, 1e-4) ** 4) for d, n in ds[:3] if d < d0 * 1.5 + 0.02]
        tot = sum(w for _, w in ws)
        for n, w in ws: ob.vertex_groups[n].add([v.index], w / tot, 'REPLACE')

# ---------------------------------------------------------------- 5. colour from the image, clustered into slots
img = bpy.data.images.load(os.path.abspath(IMAGE))
W, H = img.size
px = list(img.pixels)  # RGBA floats, bottom row first
alpha = [px[i * 4 + 3] for i in range(W * H)]
xs = [i % W for i in range(W * H) if alpha[i] > 0.5]
ys = [i // W for i in range(W * H) if alpha[i] > 0.5]
ix0, ix1, iy0, iy1 = min(xs), max(xs), min(ys), max(ys)
lo, hi = bbox(ob)
def sample(p):
    # Front view: mesh x → image x (the figure faces -Y, so its left is image right), z → image y.
    u = (p.x - lo.x) / (hi.x - lo.x); w = (p.z - lo.z) / (hi.z - lo.z)
    x = int(ix0 + u * (ix1 - ix0)); y = int(iy0 + w * (iy1 - iy0))
    # Walk inwards to the nearest opaque pixel (silhouettes don't match exactly).
    for r in range(0, 40, 2):
        for dx, dy in ((0, 0), (r, 0), (-r, 0), (0, r), (0, -r)):
            xx, yy = min(W - 1, max(0, x + dx)), min(H - 1, max(0, y + dy))
            i = yy * W + xx
            if alpha[i] > 0.5: return px[i * 4:i * 4 + 3]
    return (0.5, 0.5, 0.5)
cols = [sample(v.co) for v in ob.data.vertices]

# k-means (deterministic seeding: spread along luminance).
cs = sorted(cols, key=lambda c: sum(c))
cent = [list(cs[int((i + 0.5) * len(cs) / K)]) for i in range(K)]
lab = [0] * len(cols)
for _ in range(20):
    for i, c in enumerate(cols):
        lab[i] = min(range(K), key=lambda k: sum((c[j] - cent[k][j]) ** 2 for j in range(3)))
    for k in range(K):
        m = [cols[i] for i in range(len(cols)) if lab[i] == k]
        if m: cent[k] = [sum(c[j] for c in m) / len(m) for j in range(3)]

# Name the clusters by where they sit: skin = the front of the face,
# hair = the top of the head, boot = the feet; the rest is clothing.
zs = {k: [ob.data.vertices[i].co for i in range(len(cols)) if lab[i] == k] for k in range(K)}
def share(k, pred):
    return sum(1 for p in zs[k] if pred(p)) / max(1, len(zs[k]))
face = lambda p: p.z > TOP * 0.84 and p.z < TOP * 0.93 and p.y < 0
top = lambda p: p.z > TOP * 0.93
feet = lambda p: p.z < TOP * 0.07
names = {}
for tag, pred in (('skin', face), ('hair', top), ('boot', feet)):
    free = [k for k in range(K) if k not in names and zs[k]]
    if not free: break
    best = max(free, key=lambda k: sum(1 for p in zs[k] if pred(p)))
    if sum(1 for p in zs[best] if pred(p)) > 5: names[best] = tag
n = 0
for k in range(K):
    if k not in names:
        names[k] = f'cloth_{n}'; n += 1
mats = []
for k in range(K):
    mt = bpy.data.materials.new(names[k])
    mt.diffuse_color = (*cent[k], 1)
    mt.use_nodes = True
    mt.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*cent[k], 1)
    ob.data.materials.append(mt); mats.append(mt)
for p in ob.data.polygons:
    votes = [lab[i] for i in p.vertices]
    p.material_index = max(set(votes), key=votes.count)
print('slots:', {names[k]: sum(1 for x in lab if x == k) for k in range(K)})

# ---------------------------------------------------------------- export
ob.name = 'figure'
bpy.ops.object.select_all(action='DESELECT')
ob.select_set(True); rig.select_set(True)
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=False,
                          export_apply=False, export_yup=True, export_skins=True, export_morph=False,
                          export_materials='EXPORT')
print('wrote', OUT, len(ob.data.polygons), 'faces')

# ---------------------------------------------------------------- preview: front, side, and a posed copy
if PREVIEW:
    scene = bpy.context.scene
    pb = rig.pose.bones
    for s, sg in (('L', 1), ('R', -1)):
        pb[f'UpperArm.{s}'].rotation_mode = 'XYZ'; pb[f'UpperArm.{s}'].rotation_euler = (math.radians(35 * sg), 0, math.radians(-25 * sg))
        pb[f'UpperLeg.{s}'].rotation_mode = 'XYZ'; pb[f'UpperLeg.{s}'].rotation_euler = (math.radians(-25 * sg), 0, 0)
        pb[f'LowerLeg.{s}'].rotation_mode = 'XYZ'; pb[f'LowerLeg.{s}'].rotation_euler = (math.radians(20), 0, 0)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.1
    cam.location = (2.2, -3.6, 2.6)
    tgt = bpy.data.objects.new('t', None); scene.collection.objects.link(tgt); tgt.location = (0, 0, 0.85)
    tc = cam.constraints.new('TRACK_TO'); tc.target = tgt; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
    scene.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); scene.collection.objects.link(sun)
    sun.data.energy = 3.0; sun.rotation_euler = (math.radians(50), 0, math.radians(-40))
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.65, 0.68, 1)
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'MATERIAL'
    scene.render.resolution_x, scene.render.resolution_y = 700, 700
    scene.render.filepath = os.path.abspath(PREVIEW)
    bpy.ops.render.render(write_still=True)
    print('preview', PREVIEW)
