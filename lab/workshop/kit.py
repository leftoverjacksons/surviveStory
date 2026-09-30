"""
Character workshop kit: faceted, hand-built parts on the game's survivor
skeleton, for characters authored in code (lab/workshop/characters/*.py).

Conventions (as scripts/blender/survivor.py, whose skeleton and weighting
this copies): Blender is Z-up, the figure faces -Y (its right hand is at -X),
units are metres, adult height about 1.69 m to the top of the head. Every part
is a mesh object with ONE material; the material's name is the game's colour
slot: `skin*`, `hair*` (re-coloured per survivor), `eye*`, `boot*`, `strap*`,
`pack*`, `roll*`, `hat*` (colours kept), anything else is clothing (re-hued per
survivor at the same lightness; near-greys and whites stay as authored).
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

# ---------------------------------------------------------------- skeleton (from scripts/blender/survivor.py)
J = dict(
    pelvis=(0, 0, 0.86), waist=(0, 0, 0.98), belly=(0, 0, 1.1), chest=(0, 0, 1.24), neck=(0, 0, 1.38), head=(0, 0, 1.44),
    hip=(0.1, 0.005, 0.82), knee=(0.108, 0.0, 0.46), ankle=(0.112, 0.015, 0.1), toe=(0.112, -0.1, 0.045),
    shoulder=(0.195, 0, 1.31), elbow=(0.25, 0.01, 1.06), wrist=(0.27, -0.02, 0.84), hand=(0.277, -0.035, 0.76),
)
HEAD_C = (0, -0.005, 1.555)
HEAD_R = (0.108, 0.117, 0.13)
TOP = 1.69

def _sym(name, h, t, parent):
    return [(f'{name}.{side}', (h[0] * s, h[1], h[2]), (t[0] * s, t[1], t[2]), parent.replace('*', side) if parent else None)
            for side, s in (('L', 1), ('R', -1))]

BONES = [
    ('Root', (0, 0, 0), (0, 0.15, 0), None),
    ('Hips', J['pelvis'], J['waist'], 'Root'),
    ('Abdomen', J['waist'], J['belly'], 'Hips'),
    ('Torso', J['belly'], J['chest'], 'Abdomen'),
    ('Chest', J['chest'], J['neck'], 'Torso'),
    ('Neck', J['neck'], J['head'], 'Chest'),
    ('Head', J['head'], (0, 0, TOP), 'Neck'),
]
BONES += _sym('Shoulder', (0.04, 0, J['shoulder'][2]), J['shoulder'], 'Chest')
BONES += _sym('UpperArm', J['shoulder'], J['elbow'], 'Shoulder.*')
BONES += _sym('LowerArm', J['elbow'], J['wrist'], 'UpperArm.*')
BONES += _sym('Wrist', J['wrist'], J['hand'], 'LowerArm.*')
BONES += _sym('UpperLeg', J['hip'], J['knee'], 'Hips')
BONES += _sym('LowerLeg', J['knee'], J['ankle'], 'UpperLeg.*')
BONES += _sym('Foot', J['ankle'], J['toe'], 'LowerLeg.*')
DEFORM = [n for n, *_ in BONES if n != 'Root']

def V(*p):
    return Vector(p[0] if len(p) == 1 else p)

def mirror(p):
    return (-p[0], p[1], p[2])

# ---------------------------------------------------------------- scene and materials
def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob

def srgb(h):
    """'#rrggbb' → linear RGB (glTF base colours are linear)."""
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def mat(slot, hexcol):
    m = bpy.data.materials.get(slot)
    if m is None:
        m = bpy.data.materials.new(slot)
        rgb = srgb(hexcol)
        m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*rgb, 1)
        b.inputs['Roughness'].default_value = 0.9
        m.diffuse_color = (*rgb, 1)
    return m

# ---------------------------------------------------------------- mesh building
def mesh_object(name, verts, faces, material):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.validate()
    ob = link(bpy.data.objects.new(name, me))
    ob.data.materials.append(material)
    return ob

def frame(t):
    """Two unit vectors across direction t (x-ish and y-ish for a vertical t)."""
    t = t.normalized()
    ref = Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 1, 0))
    n1 = (ref - t * ref.dot(t)).normalized()
    return n1, t.cross(n1)

def tube(name, path, radii, material, segs=8, caps=(True, True), twist=0.0, offsets=None):
    """A faceted tube through points `path`, with (rx, ry) or r per point.
    offsets: optional per-point (dx, dy) shift of the ring in its own frame."""
    path = [V(p) for p in path]
    if isinstance(radii, (int, float)):
        radii = [radii] * len(path)
    verts, faces = [], []
    for i, p in enumerate(path):
        t = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)])
        n1, n2 = frame(t)
        r = radii[i]
        rx, ry = (r, r) if isinstance(r, (int, float)) else r
        ox, oy = offsets[i] if offsets else (0, 0)
        for k in range(segs):
            a = 2 * math.pi * k / segs + twist
            verts.append(p + n1 * (math.cos(a) * rx + ox) + n2 * (math.sin(a) * ry + oy))
    for i in range(len(path) - 1):
        for k in range(segs):
            a, b = i * segs + k, i * segs + (k + 1) % segs
            faces.append((a, b, b + segs, a + segs))
    if caps[0]:
        verts.append(path[0]); c = len(verts) - 1
        faces += [((k + 1) % segs, k, c) for k in range(segs)]
    if caps[1]:
        verts.append(path[-1]); c = len(verts) - 1
        base = (len(path) - 1) * segs
        faces += [(base + k, base + (k + 1) % segs, c) for k in range(segs)]
    ob = mesh_object(name, verts, faces, material)
    fix_normals(ob)
    return ob

def ico(name, center, radii, material, subdiv=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * radii[0] + center[0], v.co.y * radii[1] + center[1], v.co.z * radii[2] + center[2]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me)); ob.data.materials.append(material)
    return ob

def uvs(name, center, radii, material, segs=8, rings=6):
    """A low UV sphere (ellipsoid)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * radii[0] + center[0], v.co.y * radii[1] + center[1], v.co.z * radii[2] + center[2]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me)); ob.data.materials.append(material)
    return ob

def box(name, center, size, material, rot=(0, 0, 0), taper=1.0, bevel=0.0):
    """A box (optionally narrower at the top by `taper`, optionally bevelled)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        k = taper if v.co.z > 0 else 1.0
        v.co = Vector((v.co.x * size[0] * k, v.co.y * size[1] * k, v.co.z * size[2]))
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect='EDGES')
    R = Matrix.Rotation(rot[2], 3, 'Z') @ Matrix.Rotation(rot[1], 3, 'Y') @ Matrix.Rotation(rot[0], 3, 'X')
    for v in bm.verts:
        v.co = R @ v.co + V(center)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me)); ob.data.materials.append(material)
    return ob

def ring(name, center, r, thick, material, segs=10, minor=4, scale=(1, 1, 1), rot=(0, 0, 0)):
    """A low torus (a band: belt, cuff, strap loop)."""
    bm = bmesh.new()
    verts = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        for j in range(minor):
            b = 2 * math.pi * j / minor + math.pi / minor
            verts.append(bm.verts.new(((r + thick * math.cos(b)) * math.cos(a), (r + thick * math.cos(b)) * math.sin(a), thick * math.sin(b))))
    for i in range(segs):
        for j in range(minor):
            a, b = i * minor + j, i * minor + (j + 1) % minor
            c, d = ((i + 1) % segs) * minor + (j + 1) % minor, ((i + 1) % segs) * minor + j
            bm.faces.new((verts[a], verts[b], verts[c], verts[d]))
    R = Matrix.Rotation(rot[2], 3, 'Z') @ Matrix.Rotation(rot[1], 3, 'Y') @ Matrix.Rotation(rot[0], 3, 'X')
    for v in bm.verts:
        v.co = R @ Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) + V(center)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me)); ob.data.materials.append(material)
    fix_normals(ob)
    return ob

def spike(name, base, tip, r, material, segs=4, rot=0.0):
    """A low cone from base (radius r) to a point: hair clumps, cloth points."""
    base, tip = V(base), V(tip)
    n1, n2 = frame(tip - base)
    verts = [base + (n1 * math.cos(2 * math.pi * k / segs + rot) + n2 * math.sin(2 * math.pi * k / segs + rot)) * r for k in range(segs)]
    verts += [tip, base]
    faces = [(k, (k + 1) % segs, segs) for k in range(segs)] + [((k + 1) % segs, k, segs + 1) for k in range(segs)]
    ob = mesh_object(name, verts, faces, material)
    fix_normals(ob)
    return ob

def sheet(name, grid, material, thickness=0.0):
    """A surface from a grid of points (rows × cols); optionally given thickness."""
    rows, cols = len(grid), len(grid[0])
    verts = [V(p) for row in grid for p in row]
    faces = [(i * cols + j, i * cols + j + 1, (i + 1) * cols + j + 1, (i + 1) * cols + j) for i in range(rows - 1) for j in range(cols - 1)]
    ob = mesh_object(name, verts, faces, material)
    if thickness:
        m = ob.modifiers.new('solid', 'SOLIDIFY'); m.thickness = thickness; m.offset = 0
        apply_modifiers(ob)
    fix_normals(ob)
    return ob

def apply_modifiers(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def fix_normals(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(ob.data); bm.free()

def jitter(ob, amount, seed):
    """Hand-made unevenness: move each vertex a little (welded vertices move together)."""
    rnd = random.Random(seed)
    seen = {}
    for v in ob.data.vertices:
        k = tuple(round(c, 4) for c in v.co)
        if k not in seen:
            seen[k] = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * amount
        v.co += seen[k]

def mirrored(ob):
    """A copy mirrored in x (left ↔ right)."""
    c = ob.copy(); c.data = ob.data.copy(); link(c)
    for v in c.data.vertices:
        v.co.x = -v.co.x
    fix_normals(c)
    c.name = ob.name + '.m'
    return c

# ---------------------------------------------------------------- rig
def seg_dist(p, a, b):
    ab = b - a
    t = max(0, min(1, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length

SEGS = {n: (V(h), V(t)) for n, h, t, _ in BONES if n != 'Root'}

def weight(ob, bone):
    """bone=None: blend the nearest bones (distance^-4). bone='Chest' etc.: rigid.
    bone=[names]: blend among those bones only (cloaks, skirts)."""
    for n in DEFORM:
        ob.vertex_groups.new(name=n)
    for v in ob.data.vertices:
        p = ob.matrix_world @ v.co
        if isinstance(bone, str):
            ob.vertex_groups[bone].add([v.index], 1.0, 'REPLACE'); continue
        cands = bone or DEFORM
        ds = sorted((seg_dist(p, *SEGS[n]), n) for n in cands)
        d0 = ds[0][0]
        ws = [(n, 1 / max(d, 1e-4) ** 4) for d, n in ds[:3] if d < d0 * 1.5 + 0.02]
        tot = sum(w for _, w in ws)
        for n, w in ws:
            ob.vertex_groups[n].add([v.index], w / tot, 'REPLACE')

def make_armature():
    arm = bpy.data.armatures.new('Rig')
    ob = link(bpy.data.objects.new('Rig', arm))
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    for n, h, t, p in BONES:
        b = arm.edit_bones.new(n)
        b.head, b.tail = V(h), V(t)
        if p:
            b.parent = arm.edit_bones[p]; b.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob

def assemble(name, parts):
    """parts: [(object, bone spec)] → one skinned mesh on the game's skeleton."""
    rig = make_armature()
    objs = []
    for ob, bone in parts:
        weight(ob, bone)
        objs.append(ob)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = f'{name}_mesh'
    for p in ob.data.polygons:
        p.use_smooth = False  # faceted, like the game's pixel look
    mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = rig
    ob.parent = rig
    return rig, ob

def export(path, rig, ob):
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True); ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=False,
                              export_apply=False, export_yup=True, export_skins=True, export_morph=False,
                              export_materials='EXPORT')

def triangles(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)
