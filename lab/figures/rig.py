"""
Lab (not part of the game): rig a generated character mesh onto the game's
survivor skeleton, so it plays the game's clips (anims.glb) unchanged.

    python lab/figures/rig.py <mesh.glb> <image.png> <out.glb> [--back <png>] [--tris 3000] [--k 10] [--merge 7] [--smooth 1] [--patch 8] [--light 0.7] [--build hero|adult|stout] [--head face|soft|broad|long|elder|keep] [--hair curly|bun|swept|none] [--shade 1]
        [--names 0=skin,1=hair,...] [--slots <json>] [--preview <png>]

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
  5. Colour: project the input image onto the mesh from the front (and the
     back view, if given, onto the back), cluster
     the vertex colours (CIELAB, farthest-point seeds, look-alikes merged) into up to --k groups and turn each group into a named
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
K = opt('--k', 10)  # at most this many colour slots (look-alikes merge, see MERGE)
SMOOTH = opt('--smooth', 1)  # neighbour passes over colours and over cluster labels
LIGHT = opt('--light', 0.7)  # slot colour: this luminance percentile of the group's samples
PATCH = opt('--patch', 8)  # colour sample window, per mille of the figure's height in the image
PREVIEW = opt('--preview', '')
BACK = opt('--back', '')  # optional back view (cut-out) for the colours
NAMES = opt('--names', '')
SLOTS_OUT = opt('--slots', '')  # write the slots (index, name, sRGB colour, vertices) as JSON
VOXEL = opt('--voxel', 0.012)
TOP = 1.69  # Head bone tip in the game's skeleton

# ---------------------------------------------------------------- skeleton (from scripts/blender/survivor.py)
J = dict(
    pelvis=(0, 0, 0.86), waist=(0, 0, 0.98), belly=(0, 0, 1.1), chest=(0, 0, 1.24), neck=(0, 0, 1.38), head=(0, 0, 1.44),
    hip=(0.1, 0.005, 0.82), knee=(0.108, 0.0, 0.46), ankle=(0.112, 0.015, 0.1), toe=(0.112, -0.1, 0.045),
    shoulder=(0.195, 0, 1.31), elbow=(0.25, 0.01, 1.06), wrist=(0.27, -0.02, 0.84), hand=(0.277, -0.035, 0.76),
)

# --build: the joint table's proportions. 'adult' is the game's old 1:7 figure (above); 'hero' and
# 'stout' are the workshop's chibi builds (lab/workshop/kit.py: head about a quarter of the height),
# which keep every bone's direction, so the game's clips still fit. Generated figures from chibi
# concept art need 'hero', or the neck and shoulders land inside the head.
BUILD = opt('--build', 'hero')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'workshop'))
import kit  # noqa: E402  (lab/workshop: builds, and the head parts below)
_J, _HC, _HR = kit.derive(kit.BUILDS[BUILD])
_k = TOP / (_HC[2] + _HR[2] * 1.12)  # kit units -> this figure (the mesh's top includes some hair)
J = {n: tuple(c * _k for c in v) for n, v in _J.items()}
HEAD_RX = _HR[0] * _k  # head half-width
# --head: replace the generated head with a workshop face (lab/workshop/faces.py: face, soft, broad,
# long, elder) and --hair (curly, bun, swept, none), coloured from the image. A generated head at a
# few thousand triangles has no face (eyes and mouth are smaller than a triangle). 'keep' keeps it.
HEAD = opt('--head', 'face')
HAIR = opt('--hair', 'curly')

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
if width_at(J['shoulder'][2]) > 0.42 * TOP:
    print('WARNING: the arms look straight out (a T-pose). The game\'s clips expect arms angled down '
          '(an A-pose, 30-45 degrees); a T-pose image gives twisted arms and cloth. Use an A-pose image.')
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

# ---------------------------------------------------------------- 4b. head swap: cut the generated head away
FULL = bbox(ob)  # the whole figure, which the image maps onto (before the head is cut away)
if HEAD != 'keep':
    head_joint = Vector(fit('head', J['head']))
    off = head_joint - Vector(J['head'])  # the fit moves joints in depth only
    HCm = Vector(_HC) * _k + off  # head centre and radii, in this figure
    HRm = Vector(_HR) * _k
    # Fit the new head to the generated one: as wide (hair included) and with the same top, so a
    # concept's short neck or big head carries over. Its centre sits a head-height below the top.
    top_z = FULL[1].z
    gw = width_at(top_z - HRm.z * 1.1, band=0.03, core=HRm.x * 1.8)
    HS = max(0.85, min(1.35, gw / (HRm.x * 1.15))) if gw else 1.0
    target = Vector((HCm.x, HCm.y, min(HCm.z, top_z - HRm.z * HS * 1.12)))  # never above the skeleton's
    shift = target - HCm
    HCm = target
    cut = HCm.z - HRm.z * HS * 0.92  # about the chin
    bm = bmesh.new(); bm.from_mesh(ob.data)
    gone = [v for v in bm.verts if v.co.z > cut and abs(v.co.x - HCm.x) < HRm.x * HS * 1.7]
    bmesh.ops.delete(bm, geom=gone, context='VERTS')
    bm.to_mesh(ob.data); bm.free()
    print(f'head swap: generated head cut above z {cut:.3f} ({len(gone)} vertices), new head x{HS:.2f}')

# ---------------------------------------------------------------- 5. colour from the image, clustered into slots
class View:
    """A cut-out image (RGBA) seen from the front (-Y) or the back (+Y)."""
    def __init__(self, path, back):
        img = bpy.data.images.load(os.path.abspath(path))
        self.W, self.H = img.size
        self.px = list(img.pixels)  # RGBA floats, bottom row first
        W, H = self.W, self.H
        self.alpha = [self.px[i * 4 + 3] for i in range(W * H)]
        xs = [i % W for i in range(W * H) if self.alpha[i] > 0.5]
        ys = [i // W for i in range(W * H) if self.alpha[i] > 0.5]
        self.x0, self.x1, self.y0, self.y1 = min(xs), max(xs), min(ys), max(ys)
        self.back = back

    def col(self, p):
        """Image column of mesh point p. From the front, mesh +x is image right; from the back, image left."""
        u = (p.x - lo.x) / (hi.x - lo.x)
        if self.back: u = 1 - u
        return int(self.x0 + u * (self.x1 - self.x0))

    def sample(self, p):
        W, H, alpha, px = self.W, self.H, self.alpha, self.px
        x = self.col(p); y = int(self.y0 + (p.z - lo.z) / (hi.z - lo.z) * (self.y1 - self.y0))
        # Walk inwards to the nearest opaque pixel (silhouettes don't match exactly).
        for r in range(0, 40, 2):
            for dx, dy in ((0, 0), (r, 0), (-r, 0), (0, r), (0, -r)):
                xx, yy = min(W - 1, max(0, x + dx)), min(H - 1, max(0, y + dy))
                if alpha[yy * W + xx] > 0.5:
                    return self.patch(xx, yy)
        return (0.5, 0.5, 0.5)

    def patch(self, x, y):
        """The median colour of the opaque pixels around (x, y): painted concept art is full of brush
        texture and stains, and single pixels make neighbouring vertices of one cloth disagree."""
        W, H, alpha, px = self.W, self.H, self.alpha, self.px
        r = max(2, PATCH * (self.y1 - self.y0) // 1000)
        got = []
        for yy in range(max(0, y - r), min(H, y + r + 1), max(1, r // 3)):
            for xx in range(max(0, x - r), min(W, x + r + 1), max(1, r // 3)):
                i = yy * W + xx
                if alpha[i] > 0.5: got.append(px[i * 4:i * 4 + 3])
        if not got:
            i = y * W + x
            return px[i * 4:i * 4 + 3]
        return [sorted(c[j] for c in got)[len(got) // 2] for j in range(3)]

    def top_of(self, p):
        """The silhouette's top in this column: hair (or hat), for the back of the head."""
        x = self.col(p)
        for y in range(self.y1, self.y0, -1):
            if self.alpha[y * self.W + x] > 0.5:
                return Vector((p.x, p.y, lo.z + (y - 12 - self.y0) / (self.y1 - self.y0) * (hi.z - lo.z)))
        return p

lo, hi = FULL
front = View(IMAGE, False)
back = View(BACK, True) if BACK else None
neck_z = J['neck'][2] * (hi.z - lo.z) / TOP
def colour(v):
    if v.normal.y > 0.25:  # facing away from the front view
        if back: return back.sample(v.co)
        # No back view: the back of the head takes the colour at the top of the head.
        if v.co.z > neck_z: return front.sample(front.top_of(v.co))
    return front.sample(v.co)
cols = [colour(v) for v in ob.data.vertices]
raw = [list(c) for c in cols]  # unsmoothed: the slots' final colours come from these

# Neighbours on the mesh, for smoothing colours before clustering and labels after.
nbr = [[] for _ in ob.data.vertices]
for e in ob.data.edges:
    a, b = e.vertices
    nbr[a].append(b); nbr[b].append(a)
for _ in range(SMOOTH):
    cols = [[(cols[i][j] * 2 + sum(cols[n][j] for n in nbr[i])) / (2 + len(nbr[i])) for j in range(3)] for i in range(len(cols))]

# Group the colours in CIELAB (distances there follow what the eye sees, so a muted green and a brown
# of the same brightness stay apart). Seeds: farthest-point (each new seed the colour least like the
# seeds so far), so distinct hues each get one; then k-means; then clusters closer than MERGE (ΔE)
# are merged, so --k is an upper bound and a plain figure ends with fewer slots.
def lab_of(c):
    l = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    X = (0.4124 * l[0] + 0.3576 * l[1] + 0.1805 * l[2]) / 0.9505
    Y = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
    Z = (0.0193 * l[0] + 0.1192 * l[1] + 0.9505 * l[2]) / 1.089
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
d2 = lambda a, b: sum((a[j] - b[j]) ** 2 for j in range(3))
labs = [lab_of(c) for c in cols]
cent = [list(min(labs, key=lambda c: c[0]))]  # start from the darkest colour
while len(cent) < K:
    far = max(labs, key=lambda c: min(d2(c, s) for s in cent))
    if min(d2(far, s) for s in cent) < 4: break  # nothing left that differs
    cent.append(list(far))
def kmeans(cent):
    lab = [0] * len(labs)
    for _ in range(20):
        for i, c in enumerate(labs):
            lab[i] = min(range(len(cent)), key=lambda k: d2(c, cent[k]))
        for k in range(len(cent)):
            m = [labs[i] for i in range(len(labs)) if lab[i] == k]
            if m: cent[k] = [sum(c[j] for c in m) / len(m) for j in range(3)]
    return lab
lab = kmeans(cent)
# Drop seeds that ended up (nearly) empty, and merge look-alikes.
MERGE = opt('--merge', 7.0)
while True:
    counts = [sum(1 for x in lab if x == k) for k in range(len(cent))]
    small = [k for k in range(len(cent)) if counts[k] < max(8, len(labs) // 200)]
    pairs = [(d2(cent[a], cent[b]), a, b) for a in range(len(cent)) for b in range(a + 1, len(cent))]
    close = min(pairs) if pairs else None
    if small and len(cent) > 2:
        cent.pop(small[0])
    elif close and close[0] < MERGE ** 2 and len(cent) > 2:
        a, b = close[1], close[2]
        cent[a] = [(cent[a][j] * counts[a] + cent[b][j] * counts[b]) / (counts[a] + counts[b]) for j in range(3)]
        cent.pop(b)
    else:
        break
    lab = kmeans(cent)
K = len(cent)
print('colour groups:', K)
# Majority filter: specks of one colour inside another join their surroundings.
for _ in range(SMOOTH):
    new = lab[:]
    for i in range(len(lab)):
        votes = [lab[i]] + [lab[n] for n in nbr[i]]
        new[i] = max(set(votes), key=votes.count)
    lab = new
# Each slot's colour: the median of its unsmoothed samples (smoothing is for grouping only;
# averages drift towards neighbouring regions, e.g. a white shirt towards hair).
for k in range(K):
    m = [raw[i] for i in range(len(raw)) if lab[i] == k]
    # The painting already has shading painted in, and the game lights the figure again: take the lit
    # side of each group (--light, a luminance percentile) rather than its middle, or it renders dark.
    if m:
        m = sorted(m, key=lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])
        lo_i = int(len(m) * max(0.0, LIGHT - 0.1)); hi_i = max(lo_i + 1, int(len(m) * min(1.0, LIGHT + 0.1)))
        band = m[lo_i:hi_i]
        cent[k] = [sorted(c[j] for c in band)[len(band) // 2] for j in range(3)]
    else:
        cent[k] = [0.5, 0.5, 0.5]  # (was CIELAB)

# Name the clusters by where they sit: skin = the front of the face,
# hair = the top of the head, boot = the feet; the rest is clothing.
zs = {k: [ob.data.vertices[i].co for i in range(len(cols)) if lab[i] == k] for k in range(K)}
def share(k, pred):
    return sum(1 for p in zs[k] if pred(p)) / max(1, len(zs[k]))
# The face: front-centre of the lower head (above the neck, below the fringe).
face = lambda p: neck_z + 0.2 * (TOP - neck_z) < p.z < neck_z + 0.5 * (TOP - neck_z) and abs(p.x) < HEAD_RX * 0.4 and p.y < 0
top = lambda p: p.z > TOP * 0.93
feet = lambda p: p.z < TOP * 0.07
names = {}
hands = [Vector(t) for n, h, t, _ in BONES if n.startswith('Wrist')]
if HEAD != 'keep':  # no generated face left: skin is what is at the hands
    face = lambda p: min((p - q).length for q in hands) < 0.07
for tag, pred in (('skin', face), ('hair', top), ('boot', feet)):
    free = [k for k in range(K) if k not in names and zs[k]]
    if not free: break
    best = max(free, key=lambda k: sum(1 for p in zs[k] if pred(p)))
    if sum(1 for p in zs[best] if pred(p)) > 5: names[best] = tag
n = 0
for k in range(K):
    if k not in names:
        names[k] = f'cloth_{n}'; n += 1
# --names 0=skin,3=hat,...: the studio's corrections, by cluster index.
for kv in filter(None, NAMES.split(',')):
    k, v = kv.split('=')
    if int(k) in names: names[int(k)] = v
seen = {}
for k in range(K):  # material names must be unique: boot, boot_1, ...
    base = names[k]
    seen[base] = seen.get(base, -1) + 1
    if seen[base]: names[k] = f'{base}_{seen[base]}'
if SLOTS_OUT:
    import json
    with open(SLOTS_OUT, 'w') as f:
        json.dump([{'index': k, 'name': names[k].split('_')[0] if not names[k].startswith('cloth') else 'cloth',
                    'label': names[k], 'color': cent[k], 'count': sum(1 for x in lab if x == k)} for k in range(K)], f)
mats = []
# Image pixels are sRGB; glTF base colours (and the game's slot colours) are linear.
lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
for k in range(K):
    c = [lin(x) for x in cent[k]]
    mt = bpy.data.materials.new(names[k])
    mt.diffuse_color = (*c, 1)
    mt.use_nodes = True
    mt.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*c, 1)
    ob.data.materials.append(mt); mats.append(mt)
for p in ob.data.polygons:
    votes = [lab[i] for i in p.vertices]
    p.material_index = max(set(votes), key=votes.count)
print('slots:', {names[k]: sum(1 for x in lab if x == k) for k in range(K)})

# Per-vertex shade: each vertex's own brightness in the image over its slot's colour (stains, patches,
# folds, painted shadow). The game multiplies the survivor's slot colour by it, so re-colouring still
# works and the painting's light and dark survive. One smoothing pass; clamped so a speck can't blow out.
lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
shade = [max(0.55, min(1.6, lum(raw[i]) / max(0.02, lum(cent[lab[i]])))) for i in range(len(raw))]
shade = [(shade[i] * 2 + sum(shade[n] for n in nbr[i])) / (2 + len(nbr[i])) for i in range(len(shade))]
SHADE = opt('--shade', 1.0)  # 0: flat slot colours (as before); 1: the image's light and dark
at = ob.data.attributes.new('_shade', 'FLOAT', 'POINT')
for i, v in enumerate(shade):
    at.data[i].value = 1 + (v - 1) * SHADE

# ---------------------------------------------------------------- 5b. the new head
if HEAD != 'keep':
    import parts as P, faces as F  # noqa: E402
    hexc = lambda c: '#%02x%02x%02x' % tuple(int(max(0, min(1, x)) * 255) for x in c)
    mix = lambda a, b, t: [a[j] + (b[j] - a[j]) * t for j in range(3)]
    # Skin from the middle of the face, below the eyes; hair from the top of the head (image colours).
    skin = front.sample(Vector((HCm.x, 0, HCm.z - HRm.z * HS * 0.35)))
    hair = front.sample(Vector((HCm.x, 0, FULL[1].z - 0.03)))
    pal = {'skin': hexc(skin), 'hair': hexc(hair), 'skin_blush': hexc(mix(skin, (0.78, 0.31, 0.28), 0.3)),
           'skin_lip': hexc([x * 0.82 for x in mix(skin, (0.78, 0.31, 0.28), 0.35)]), 'skin_shade': hexc([x * 0.72 for x in skin]),
           'eye': '#20140c', 'eye_white': '#efe6d6', 'hat_band': '#d8c070'}
    for slot in ('skin', 'hair'):  # a cluster may already be called skin/hair: give it the measured colour too
        m = bpy.data.materials.get(slot)
        if m is not None:
            m.name = slot + '_body'
    kit.set_build(BUILD)
    c = P.Ctx(kit, pal)
    pieces = F.build(c, F.FACES[HEAD])
    if HAIR != 'none':
        pieces += P.PARTS['hair.' + HAIR](kit, pal)
    kj = {n: Vector(v) for n, v in kit.J.items()}
    pieces.append((kit.tube('neck', [kj['neck'] + Vector((0, -0.005, -0.03)), kj['head'] + Vector((0, -0.005, 0.04))],
                           0.055 * kit.B['torso'], c.m('skin'), segs=8), 'Neck'))
    for o, bone in pieces:
        for v in o.data.vertices:  # kit units -> this figure, then scaled about the head centre
            p = v.co * _k + off + shift
            v.co = HCm + (p - HCm) * HS if bone != 'Neck' else p
        a = o.data.attributes.new('_shade', 'FLOAT', 'POINT')  # authored parts: plain slot colours
        for d in a.data: d.value = 1.0
        g = o.vertex_groups.new(name='Head' if bone != 'Neck' else 'Neck')
        g.add([v.index for v in o.data.vertices], 1.0, 'REPLACE')
    bpy.ops.object.select_all(action='DESELECT')
    for o, _ in pieces:
        o.select_set(True)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()
    for p in ob.data.polygons:
        p.use_smooth = False
    print(f'new head: {HEAD} + hair {HAIR}, skin {pal["skin"]}, hair {pal["hair"]}')

# ---------------------------------------------------------------- export
ob.name = 'figure'
bpy.ops.object.select_all(action='DESELECT')
ob.select_set(True); rig.select_set(True)
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=False,
                          export_apply=False, export_yup=True, export_skins=True, export_morph=False,
                          export_materials='EXPORT', export_attributes=True)  # _shade -> _SHADE
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
