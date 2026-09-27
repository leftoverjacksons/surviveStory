"""
Survivor figures for Survive Story, built entirely in Blender from code.

    python scripts/blender/survivor.py <out dir> [--preview]

(with Blender's Python module: `pip install bpy`). Writes one .glb per
outfit and anims.glb (the shared skeleton's clips), laid out the way
scripts/characters.mjs expects, and with --preview renders a lineup.

Style: soft, rounded figurines (no hard facets), simple faces (two dark
eyes), layered, mended clothes. Bones and clips use the same names as the
game's character code (UpperLeg.L, Walk, Idle, ...), so the figures drop in.
Blender is Z-up and the figures face -Y; the glTF exporter turns that into
Y-up, facing +Z.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
PREVIEW = '--preview' in sys.argv
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- skeleton
# Joint positions (left side; the right mirrors in x). The body mesh and the
# bones are both built from these, so they always agree. Proportions are a
# little stylised: a large head (about 1:5.3), sturdy limbs, short legs.
J = dict(
    pelvis=(0, 0, 0.86), waist=(0, 0, 0.98), belly=(0, 0, 1.1), chest=(0, 0, 1.24), neck=(0, 0, 1.38), head=(0, 0, 1.44),
    hip=(0.1, 0.005, 0.82), knee=(0.108, 0.0, 0.46), ankle=(0.112, 0.015, 0.1), toe=(0.112, -0.1, 0.045),
    shoulder=(0.18, 0, 1.31), elbow=(0.235, 0.01, 1.06), wrist=(0.255, -0.02, 0.84), hand=(0.262, -0.035, 0.76),
)
HEAD_C = (0, -0.005, 1.56)    # head centre
HEAD_R = (0.13, 0.135, 0.155)  # head radii

def m(j):
    return (-j[0], j[1], j[2])

def sym(name, h, t, parent):
    out = []
    for side, s in (('L', 1), ('R', -1)):
        out.append((f'{name}.{side}', (h[0] * s, h[1], h[2]), (t[0] * s, t[1], t[2]), parent.replace('*', side) if parent else None))
    return out

BONES = [
    ('Root', (0, 0, 0), (0, 0.15, 0), None),
    ('Hips', J['pelvis'], J['waist'], 'Root'),
    ('Abdomen', J['waist'], J['belly'], 'Hips'),
    ('Torso', J['belly'], J['chest'], 'Abdomen'),
    ('Chest', J['chest'], J['neck'], 'Torso'),
    ('Neck', J['neck'], J['head'], 'Chest'),
    ('Head', J['head'], (0, 0, 1.72), 'Neck'),
]
BONES += sym('Shoulder', (0.04, 0, J['shoulder'][2]), J['shoulder'], 'Chest')
BONES += sym('UpperArm', J['shoulder'], J['elbow'], 'Shoulder.*')
BONES += sym('LowerArm', J['elbow'], J['wrist'], 'UpperArm.*')
BONES += sym('Wrist', J['wrist'], J['hand'], 'LowerArm.*')
BONES += sym('UpperLeg', J['hip'], J['knee'], 'Hips')
BONES += sym('LowerLeg', J['knee'], J['ankle'], 'UpperLeg.*')
BONES += sym('Foot', J['ankle'], J['toe'], 'LowerLeg.*')

# ---------------------------------------------------------------- helpers
def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj

def mat(name, rgb):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
        bsdf.inputs['Roughness'].default_value = 0.85
        m.diffuse_color = (*rgb, 1)
    return m

def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def skin_body(points, edges, radii, name):
    """A smooth tube body from a stick figure (Skin modifier + subdivision)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata(points, edges, [])
    ob = link(bpy.data.objects.new(name, me))
    ob.modifiers.new('skin', 'SKIN')
    for i, r in enumerate(radii):
        me.skin_vertices[0].data[i].radius = r
    me.skin_vertices[0].data[0].use_root = True
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = 2
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return ob

def blob(name, loc, scale, material, segs=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    ob.data.materials.append(material)
    return ob

def assign_by(ob, rule):
    """Material per face by a rule on the face centre (x, y, z) → material."""
    for m in {rule(Vector((0, 0, z))) for z in (0,)}:
        pass
    mats = []
    for p in ob.data.polygons:
        c = ob.matrix_world @ p.center
        m = rule(c)
        if m.name not in [x.name for x in ob.data.materials]:
            ob.data.materials.append(m)
        p.material_index = [x.name for x in ob.data.materials].index(m.name)

def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True

# ---------------------------------------------------------------- outfits
SKIN = srgb('#d9a883')
HAIR = srgb('#4a3222')
EYE = srgb('#1c1612')

OUTFITS = {
    # name: body/garment choices; the game recolours cloth slots per survivor.
    'walker':   dict(top='#6f7d5c', legs='#4b4a44', boots='#5a4332', coat=True, scarf='#b8664a', hood=False, hat=None, hair='short', pack=True, female=False),
    'gardener': dict(top='#c9a45c', legs='#5b6a78', boots='#4a3a2c', coat=False, scarf=None, hood=False, hat='brim', hair='bun', pack=False, female=True),
    'mender':   dict(top='#8a6a4a', legs='#3f4a3c', boots='#3a2e26', coat=False, scarf='#6b7f8f', hood=False, hat='beanie', hair='short', pack=False, female=False),
    'wanderer': dict(top='#5a6b7a', legs='#6b5a48', boots='#4a3a2c', coat=True, scarf=None, hood=True, hat=None, hair='long', pack=True, female=True),
    'forager':  dict(top='#7a4f45', legs='#4d5a3c', boots='#5a4332', coat=False, scarf='#d8c060', hood=False, hat=None, hair='pony', pack=False, female=True),
    'keeper':   dict(top='#4f6a5a', legs='#4b4a44', boots='#3a2e26', coat=True, scarf=None, hood=False, hat='brim', hair='short', pack=False, female=False),
}

def build_outfit(name, o):
    parts = []
    top, legs, boots = mat(f'{name}_Top', srgb(o['top'])), mat(f'{name}_Legs', srgb(o['legs'])), mat(f'{name}_Boots', srgb(o['boots']))
    skin, hair, eye = mat('Skin', SKIN), mat('Hair', HAIR), mat('Eye', EYE)
    f = o['female']
    names = ['pelvis', 'waist', 'chest', 'neck', 'hip', 'knee', 'ankle', 'toe', 'shoulder', 'elbow', 'wrist', 'hand']
    P = [J['pelvis'], J['waist'], J['chest'], (0, 0, 1.33), J['neck'],
         J['hip'], J['knee'], J['ankle'], J['toe'], m(J['hip']), m(J['knee']), m(J['ankle']), m(J['toe']),
         J['shoulder'], J['elbow'], J['wrist'], J['hand'], m(J['shoulder']), m(J['elbow']), m(J['wrist']), m(J['hand'])]
    E = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8), (0, 9), (9, 10), (10, 11), (11, 12),
         (3, 13), (13, 14), (14, 15), (15, 16), (3, 17), (17, 18), (18, 19), (19, 20)]
    chest = (0.155, 0.105) if not f else (0.145, 0.11)
    hips = (0.15, 0.105) if not f else (0.16, 0.11)
    leg = [(0.098, 0.098), (0.075, 0.08), (0.066, 0.07), (0.06, 0.066)]
    arm = [(0.072, 0.072), (0.06, 0.06), (0.05, 0.05), (0.047, 0.034)]
    R = [hips, (0.14, 0.1), chest, (0.165, 0.105), (0.062, 0.062)] + leg + leg + arm + arm
    body = skin_body(P, E, R, f'{name}_body')
    def region(c):
        if c.z < 0.2: return boots
        if abs(c.x) > 0.2 and c.z < 0.86: return skin          # hands
        if c.z > 1.36: return skin                              # neck
        if c.z < 0.93 and abs(c.x) < 0.2: return legs
        return top
    assign_by(body, region)
    smooth(body)
    parts.append((body, None))

    # Head: a soft egg, two dark eyes, a small nose, hair.
    hx, hy, hz = HEAD_C
    rx, ry, rz = HEAD_R
    H = lambda x, y, z: (hx + x * rx, hy + y * ry, hz + z * rz)   # head-relative, in radii
    head = blob(f'{name}_head', HEAD_C, HEAD_R, skin, 24, 16)
    smooth(head); parts.append((head, 'Head'))
    for sd in (1, -1):
        e = blob('eye', H(0.36 * sd, -0.9, 0.08), (0.017, 0.012, 0.022), eye, 8, 6)
        parts.append((e, 'Head'))
    nose = blob('nose', H(0, -0.97, -0.12), (0.022, 0.022, 0.03), skin, 8, 6); smooth(nose); parts.append((nose, 'Head'))
    h = o['hair']
    def shell(nm, scale, material, keep):
        """A cap over the head, trimmed by keep(x, y, z) in head-relative units."""
        ob = blob(nm, HEAD_C, (rx * scale[0], ry * scale[1], rz * scale[2]), material, 24, 14)
        bm = bmesh.new(); bm.from_mesh(ob.data)
        # Mesh coordinates are in world space here: measure from the head centre.
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep((v.co.x - hx) / rx, (v.co.y - hy) / ry, (v.co.z - hz) / rz)], context='VERTS')
        bm.to_mesh(ob.data); bm.free(); smooth(ob)
        return ob
    if not o['hood'] and o['hat'] != 'beanie':
        # Hair: over the crown and down the back, clear of the face.
        parts.append((shell('hair', (1.07, 1.07, 1.05), hair, lambda x, y, z: z > 0.3 or (y > -0.25 and z > -0.6)), 'Head'))
        if h == 'bun':
            b_ = blob('bun', H(0, 0.55, 0.85), (0.055, 0.055, 0.05), hair); smooth(b_); parts.append((b_, 'Head'))
        if h == 'pony':
            b_ = blob('pony', H(0, 1.05, -0.35), (0.045, 0.045, 0.11), hair); smooth(b_); parts.append((b_, 'Head'))
        if h == 'long':
            b_ = blob('long', H(0, 0.55, -0.75), (0.14, 0.07, 0.13), hair); smooth(b_); parts.append((b_, 'Head'))
    # Bands where garments meet: a belt, cuffs, boot tops, a collar.
    def ring(nm, loc, r, t, material, bone, scale=(1, 0.8, 1), rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=t, major_segments=24, minor_segments=8, location=loc, rotation=rot)
        ob = bpy.context.active_object; ob.name = nm; ob.scale = scale; bpy.ops.object.transform_apply(scale=True)
        ob.data.materials.append(material); smooth(ob); parts.append((ob, bone))
    strap = mat('Strap', srgb('#4a3a2c'))
    ring('belt', (0, 0, 0.93), 0.135, 0.018, strap, 'Hips', (1.08, 0.78, 1))
    for sd, side in ((1, 'L'), (-1, 'R')):
        wx, wy, wz = J['wrist']
        ring(f'cuff{side}', (wx * sd, wy, wz + 0.02), 0.052, 0.014, top, f'LowerArm.{side}', (1, 1, 1))
        ax, ay, az = J['ankle']
        ring(f'boot{side}', (ax * sd, ay, 0.2), 0.07, 0.016, boots, f'LowerLeg.{side}', (1, 1, 1))
    ring('collar', (0, 0, 1.36), 0.08, 0.02, top, 'Chest', (1.15, 1, 1))
    # Garments.
    if o['coat']:
        # A long coat: a flared skirt from the waist to the knee.
        bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=0.215, radius2=0.155, depth=0.4, location=(0, 0.005, 0.74))
        coat = bpy.context.active_object; coat.scale = (1, 0.8, 1); bpy.ops.object.transform_apply(scale=True)
        bm = bmesh.new(); bm.from_mesh(coat.data)
        bmesh.ops.delete(bm, geom=[f_ for f_ in bm.faces if abs(f_.normal.z) > 0.9], context='FACES')
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.012)
        bm.to_mesh(coat.data); bm.free()
        coat.data.materials.append(top); smooth(coat); parts.append((coat, 'hips-legs'))
    if o['scarf']:
        scm = mat(f'{name}_Scarf', srgb(o['scarf']))
        ring('scarf', (0, 0, 1.39), 0.08, 0.036, scm, 'Neck', (1.12, 1, 0.9))
        tail = blob('scarftail', (0.055, -0.11, 1.27), (0.038, 0.022, 0.1), scm); smooth(tail); parts.append((tail, 'Chest'))
    if o['hood']:
        parts.append((shell('hood', (1.18, 1.18, 1.14), top, lambda x, y, z: not (y < -0.3 and z < 0.5)), 'Head'))
    if o['hat'] == 'brim':
        hm = mat(f'{name}_Hat', srgb('#8a7a5a'))
        bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.215, depth=0.02, location=H(0, 0, 0.62))
        br = bpy.context.active_object; br.data.materials.append(hm); smooth(br); parts.append((br, 'Head'))
        cr = blob('crown', H(0, 0, 0.82), (0.125, 0.125, 0.075), hm); smooth(cr); parts.append((cr, 'Head'))
        parts.append((shell('hair', (1.06, 1.06, 1.04), hair, lambda x, y, z: y > -0.1 and -0.6 < z < 0.6), 'Head'))
    if o['hat'] == 'beanie':
        parts.append((shell('beanie', (1.1, 1.1, 1.08), mat(f'{name}_Hat', srgb('#b8664a')), lambda x, y, z: z > 0.3 or (y > 0 and z > 0.0)), 'Head'))
        parts.append((shell('hair', (1.06, 1.06, 1.04), hair, lambda x, y, z: y > 0 and -0.55 < z <= 0.15), 'Head'))
    if o['pack']:
        pk = blob('pack', (0, 0.16, 1.14), (0.13, 0.075, 0.16), mat(f'{name}_Pack', srgb('#6b5a3a')), 16, 10)
        smooth(pk); parts.append((pk, 'Chest'))
        roll = blob('roll', (0, 0.16, 1.33), (0.14, 0.045, 0.045), mat(f'{name}_Roll', srgb('#8a8a78')), 12, 8)
        smooth(roll); parts.append((roll, 'Chest'))
        for sd in (1, -1):
            # Over the shoulder, front to back.
            ring(f'strap{sd}', (0.1 * sd, 0.03, 1.24), 0.125, 0.013, strap, 'Chest', (1, 1, 1), (0, math.radians(90), 0))
    return parts

# ---------------------------------------------------------------- rig
def make_armature():
    arm = bpy.data.armatures.new('Rig')
    ob = link(bpy.data.objects.new('Rig', arm))
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    for n, h, t, p in BONES:
        b = arm.edit_bones.new(n)
        b.head, b.tail = Vector(h), Vector(t)
        if p:
            b.parent = arm.edit_bones[p]
            b.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob

def seg_dist(p, a, b):
    ab = b - a
    t = max(0, min(1, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length

DEFORM = [n for n, *_ in BONES if n != 'Root']

def weight(ob, rigid):
    """Vertex groups from distance to each bone (rigid parts follow one bone)."""
    for n in DEFORM:
        ob.vertex_groups.new(name=n)
    segs = {n: (Vector(h), Vector(t)) for n, h, t, _ in BONES if n != 'Root'}
    for v in ob.data.vertices:
        p = ob.matrix_world @ v.co
        if rigid and rigid not in ('hips-legs',):
            ob.vertex_groups[rigid].add([v.index], 1.0, 'REPLACE')
            continue
        cands = DEFORM if rigid is None else ['Hips', 'UpperLeg.L', 'UpperLeg.R']
        ds = sorted(((seg_dist(p, *segs[n]), n) for n in cands))
        # Hands and feet are small: don't let the torso pull them.
        d0 = ds[0][0]
        ws = [(n, 1 / max(d, 1e-4) ** 4) for d, n in ds[:3] if d < d0 * 1.5 + 0.02]
        tot = sum(w for _, w in ws)
        for n, w in ws:
            ob.vertex_groups[n].add([v.index], w / tot, 'REPLACE')

def assemble(name, parts, rig):
    objs = []
    for ob, rigid in parts:
        weight(ob, rigid)
        objs.append(ob)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = f'{name}_mesh'
    mod = ob.modifiers.new('rig', 'ARMATURE')
    mod.object = rig
    ob.parent = rig
    return ob

# ---------------------------------------------------------------- clips
FPS = 24

def key(rig, frame, pose):
    """pose: bone → (x, y, z) euler degrees (bone-local); 'loc' → root offset."""
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        r = pose.get(pb.name, (0, 0, 0))
        pb.rotation_euler = tuple(math.radians(a) for a in r)
        pb.keyframe_insert('rotation_euler', frame=frame)
    root = rig.pose.bones['Root']
    root.location = pose.get('loc', (0, 0, 0))
    root.keyframe_insert('location', frame=frame)

def clip(rig, name, frames, fn):
    """Bake a clip: fn(t in 0..1) → pose, one key per frame, looping."""
    act = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = act
    for i in range(frames + 1):
        key(rig, i, fn((i % frames) / frames))
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, act)
    rig.animation_data.action = None

S = lambda t, k=1, ph=0: math.sin((t * k + ph) * 2 * math.pi)

def clips(rig):
    # Bone-local axes: legs and arms point down, so local X swings forward/back.
    clip(rig, 'Idle', 72, lambda t: {
        'Chest': (S(t) * 1.5, 0, 0), 'Head': (S(t, 1, 0.25) * 2, S(t, 1) * 3, 0),
        'UpperArm.L': (S(t) * 2, 0, 4), 'UpperArm.R': (S(t) * 2, 0, -4), 'loc': (0, 0, S(t) * 0.004)})
    clip(rig, 'Idle_Neutral', 96, lambda t: {
        'Chest': (S(t) * 1, 0, 0), 'Head': (4 + S(t) * 1.5, 0, 0),
        'UpperArm.L': (0, 0, 3), 'UpperArm.R': (0, 0, -3)})
    def walk(t):
        s, c = S(t), S(t, 1, 0.25)
        return {
            'UpperLeg.L': (-s * 28, 0, 0), 'UpperLeg.R': (s * 28, 0, 0),
            'LowerLeg.L': (max(0, -c) * 40 + 5, 0, 0), 'LowerLeg.R': (max(0, c) * 40 + 5, 0, 0),
            'Foot.L': (s * 10, 0, 0), 'Foot.R': (-s * 10, 0, 0),
            'UpperArm.L': (s * 22, 0, 5), 'UpperArm.R': (-s * 22, 0, -5),
            'LowerArm.L': (-12, 0, 0), 'LowerArm.R': (-12, 0, 0),
            'Hips': (0, s * 5, 0), 'Chest': (3, -s * 6, 0), 'Head': (0, s * 3, 0),
            'loc': (0, 0, abs(S(t, 2, 0.25)) * 0.03),
        }
    clip(rig, 'Walk', 24, walk)
    clip(rig, 'Run', 16, lambda t: {k: tuple(a * 1.5 for a in v) if k != 'loc' else v for k, v in walk(t).items()})
    clip(rig, 'Interact', 36, lambda t: {
        'Abdomen': (18 + S(t) * 4, 0, 0), 'Chest': (12, 0, 0), 'Head': (-10, 0, 0),
        'UpperLeg.L': (-20, 0, 0), 'UpperLeg.R': (-8, 0, 0), 'LowerLeg.L': (30, 0, 0), 'LowerLeg.R': (15, 0, 0),
        'UpperArm.R': (-40 - S(t) * 15, 0, 0), 'LowerArm.R': (-20, 0, 0), 'UpperArm.L': (-25, 0, 5),
        'loc': (0, 0, -0.04)})
    def chop(t):
        # Wind up overhead, then swing down hard.
        up = 1 - min(1, t / 0.6) if t < 0.6 else (t - 0.6) / 0.4
        a = -150 * (1 - up) if t < 0.6 else -150 + 170 * ((t - 0.6) / 0.4) ** 1.5
        a = -150 * (t / 0.6) if t < 0.6 else -150 + 170 * ((t - 0.6) / 0.4) ** 1.5
        bend = -8 if t < 0.6 else 22 * ((t - 0.6) / 0.4)
        return {'UpperArm.R': (a, 0, -10), 'UpperArm.L': (a * 0.9, 0, 10), 'LowerArm.R': (-15, 0, 0), 'LowerArm.L': (-15, 0, 0),
                'Abdomen': (bend, 0, 0), 'Chest': (bend * 0.5, 0, 0), 'UpperLeg.L': (-12, 0, 0), 'UpperLeg.R': (10, 0, 0), 'LowerLeg.L': (10, 0, 0)}
    clip(rig, 'Sword_Slash', 30, chop)
    clip(rig, 'Punch_Right', 14, lambda t: {
        'UpperArm.R': (-70 - 50 * max(0, S(t)), 0, -10), 'LowerArm.R': (-60 + 40 * max(0, S(t)), 0, 0),
        'UpperArm.L': (-35, 0, 10), 'LowerArm.L': (-40, 0, 0), 'Abdomen': (10, 0, 0), 'Head': (-8, 0, 0)})
    clip(rig, 'Wave', 36, lambda t: {'UpperArm.R': (-10, 0, -150), 'LowerArm.R': (0, S(t) * 25, -20)})

# ---------------------------------------------------------------- export
def export(path, objs, anim):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=anim,
                              export_animation_mode='NLA_TRACKS', export_apply=False, export_yup=True,
                              export_skins=True, export_morph=False, export_materials='EXPORT')

def build(name, o, with_clips):
    clear()
    rig = make_armature()
    mesh = assemble(name, build_outfit(name, o), rig)
    if with_clips:
        clips(rig)
    return rig, mesh

names = list(OUTFITS)
for i, n in enumerate(names):
    rig, mesh = build(n, OUTFITS[n], False)
    export(os.path.join(OUT, f"{'woman' if OUTFITS[n]['female'] else 'man'}_{n}.glb"), [rig, mesh], False)
rig, mesh = build(names[0], OUTFITS[names[0]], True)
export(os.path.join(OUT, 'anims.glb'), [rig], True)
print('exported', names)

# ---------------------------------------------------------------- preview
if PREVIEW:
    # All outfits side by side in one scene, each in a slightly different pose.
    clear()
    scene = bpy.context.scene
    for i, n in enumerate(names):
        rig = make_armature()
        rig.name = f'Rig_{n}'
        mesh = assemble(n, build_outfit(n, OUTFITS[n]), rig)
        rig.location = ((i - (len(names) - 1) / 2) * 0.62, 0, 0)
        pb = rig.pose.bones
        pb['Head'].rotation_mode = 'XYZ'; pb['Head'].rotation_euler = (0, 0, math.radians((i - 2.5) * 6))
        if i % 3 == 1:
            for s, sg in (('L', 1), ('R', -1)):
                pb[f'UpperLeg.{s}'].rotation_mode = 'XYZ'; pb[f'UpperLeg.{s}'].rotation_euler = (math.radians(-20 * sg), 0, 0)
                pb[f'UpperArm.{s}'].rotation_mode = 'XYZ'; pb[f'UpperArm.{s}'].rotation_euler = (math.radians(18 * sg), 0, 0)
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.data.materials.append(mat('ground', srgb('#6b7d4a')))
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam')))
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 4.2
    cam.location = (3.2, -5.2, 4.0)
    target = link(bpy.data.objects.new('target', None)); target.location = (0, 0, 0.85)
    tc = cam.constraints.new('TRACK_TO'); tc.target = target; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
    scene.camera = cam
    sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')))
    sun.data.energy = 3.2; sun.data.angle = math.radians(12); sun.rotation_euler = (math.radians(50), 0, math.radians(-40))
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (*srgb('#a9cfd6'), 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 48; scene.cycles.device = 'CPU'
    scene.render.resolution_x, scene.render.resolution_y = 1400, 700
    scene.view_settings.view_transform = 'AgX'
    scene.render.filepath = os.path.join(OUT, 'preview.png')
    bpy.ops.render.render(write_still=True)
    print('preview', scene.render.filepath)
