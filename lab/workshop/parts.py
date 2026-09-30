"""
The workshop's parts catalogue: every piece of a character, by slot, built
relative to the current build's joints (kit.J, kit.HEAD_C/HEAD_R, kit.B), so
the same part fits any build.

    PARTS['hair.bun'](k, pal) → [(object, bones)]

A character is a recipe (recipes.py): which part fills each slot, and the
colours. The parts library (build.py --parts) exports every part as its own
skinned mesh on the shared skeleton, so a survivor can be composed at run
time and re-composed when their clothes or equipment change.

Slots (categories), one part each: body, head, hair, top, bottom, legs, feet,
hands, neck, waist, straps, bag, back, outer, held.
Colour slots are material names (see kit.py): pal[slot] gives the colour.
"""
import math, random
import bmesh
from mathutils import Vector

PARTS = {}
DEFAULTS = {}  # slot name → colour, used when a recipe doesn't give one

def part(name, **defaults):
    def reg(fn):
        PARTS[name] = fn
        DEFAULTS.update(defaults)
        return fn
    return reg

# ---------------------------------------------------------------- helpers
class Ctx:
    """The current build, as vectors, plus shorthand."""
    def __init__(self, k, pal):
        self.k = k
        self.J = {n: Vector(v) for n, v in k.J.items()}
        self.HC, self.HR = Vector(k.HEAD_C), k.HEAD_R
        self.T, self.TT, self.HAND, self.FOOT = k.B['limb'], k.B['torso'], k.B['hand'], k.B['foot']
        self.pal = pal
        self.out = []
        self.mats = {}

    def m(self, slot):
        if slot not in self.mats:
            self.mats[slot] = self.k.mat(slot, self.pal.get(slot) or DEFAULTS.get(slot) or '#ff00ff')
        return self.mats[slot]

    def add(self, ob, bones=None):
        self.out.append((ob, bones))
        return ob

    def pair(self, make, bones):
        """make() builds the left (+x) part; the right is its mirror, weighted to right-side bones."""
        side = lambda b, s: [n.replace('*', s) for n in b] if isinstance(b, list) else b.replace('*', s)
        ob = make()
        self.add(ob, side(bones, 'L'))
        self.add(self.k.mirrored(ob), side(bones, 'R'))

    def H(self, x, y, z):
        """A point on/in the head, in head radii from its centre (y negative = the face)."""
        return Vector((self.HC.x + x * self.HR[0], self.HC.y + y * self.HR[1], self.HC.z + z * self.HR[2]))

    def Hr(self, rx, ry, rz):
        return (rx * self.HR[0], ry * self.HR[1], rz * self.HR[2])

lerp = lambda a, b, t: a + (b - a) * t
SPINE = ['Hips', 'Abdomen', 'Torso', 'Chest', 'Neck']
ARM = ['Shoulder.*', 'UpperArm.*', 'LowerArm.*']
LEG = ['Hips', 'UpperLeg.*', 'LowerLeg.*']

def torso_rings(c, z_bottom, z_top, flare=1.0):
    """Torso cross-sections (points, radii) from z_bottom up to the neck."""
    J, TT = c.J, c.TT
    zs = [z_bottom, lerp(J['pelvis'].z, J['waist'].z, 0.5), J['belly'].z, J['chest'].z, lerp(J['chest'].z, J['neck'].z, 0.6), z_top]
    hipr = J['hip'].x * 1.45
    rs = [(hipr * flare, hipr * 0.72 * flare), (hipr * 0.97, hipr * 0.7), (J['shoulder'].x * 0.8, 0.105 * TT),
          (J['shoulder'].x * 0.87, 0.113 * TT), (J['shoulder'].x * 0.82, 0.103 * TT), (0.07 * TT, 0.066 * TT)]
    return [(0, 0.004, z) for z in zs], rs

# ---------------------------------------------------------------- body (always present)
@part('body.base', skin='#b27a50')
def body_base(k, pal):
    c = Ctx(k, pal); J, T = c.J, c.T
    c.add(k.tube('neck', [J['neck'] + Vector((0, -0.005, -0.03)), J['head'] + Vector((0, -0.005, 0.04))], 0.055 * c.TT, c.m('skin'), segs=8), ['Neck', 'Head'])
    c.pair(lambda: k.tube('arm', [J['shoulder'], J['elbow'], J['wrist']], [0.048 * T, 0.043 * T, 0.038 * T], c.m('skin'), segs=8), ARM)
    # Shins (usually covered; they show between a trouser cuff and a boot).
    c.pair(lambda: k.tube('shin', [J['knee'], J['ankle']], [0.052 * T, 0.045 * T], c.m('skin'), segs=6), ['LowerLeg.*'])
    # A mitten hand and a thumb: big and simple, as in the references.
    def hand():
        w, h = J['wrist'], J['hand']
        return k.box('hand', lerp(w, h, 0.55), (0.044 * c.HAND, 0.058 * c.HAND, 0.072 * c.HAND), c.m('skin'), bevel=0.01 * c.HAND)
    c.pair(hand, 'Wrist.*')
    def thumb():
        w, h = J['wrist'], J['hand']
        b = lerp(w, h, 0.35) + Vector((-0.012 * c.HAND, -0.026 * c.HAND, 0))
        return k.spike('thumb', b, b + Vector((-0.004, -0.018 * c.HAND, -0.034 * c.HAND)), 0.012 * c.HAND, c.m('skin'), segs=5)
    c.pair(thumb, 'Wrist.*')
    return c.out

@part('head.face', skin='#b27a50', eye='#20140c', eye_white='#efe6d6', hair='#241a14')
def head_face(k, pal, jaw=0.14):
    c = Ctx(k, pal)
    head = c.add(k.ico('head', c.HC, (c.HR[0] * 1.04, c.HR[1] * 1.04, c.HR[2] * 1.02), c.m('skin'), subdiv=3, keep=0.45), 'Head')
    for v in head.data.vertices:  # a softer, narrower jaw
        if v.co.z < c.HC.z:
            f = 1 - jaw * (c.HC.z - v.co.z) / c.HR[2]
            v.co.x *= f; v.co.y = c.HC.y + (v.co.y - c.HC.y) * f
    c.add(k.uvs('nose', c.H(0, -0.97, -0.2), c.Hr(0.15, 0.09, 0.15), c.m('skin'), segs=6, rings=4), 'Head')
    c.pair(lambda: k.uvs('ear', c.H(1.0, 0.08, -0.08), c.Hr(0.15, 0.22, 0.26), c.m('skin'), segs=6, rings=4), 'Head')
    # Big eyes, set a little low (the references' youthful faces).
    c.pair(lambda: k.uvs('eyewhite', c.H(0.4, -0.87, -0.02), c.Hr(0.25, 0.07, 0.22), c.m('eye_white'), segs=8, rings=4), 'Head')
    c.pair(lambda: k.uvs('iris', c.H(0.41, -0.915, -0.03), c.Hr(0.19, 0.06, 0.2), c.m('eye'), segs=8, rings=4), 'Head')
    c.pair(lambda: k.box('brow', c.H(0.42, -0.9, 0.3), c.Hr(0.4, 0.1, 0.07), c.m('hair'), rot=(0, -0.1, 0.06)), 'Head')
    c.add(k.box('mouth', c.H(0, -0.9, -0.48), c.Hr(0.26, 0.08, 0.045), c.m('eye')), 'Head')
    return c.out

# ---------------------------------------------------------------- hair
def hair_cap(c, keep, scale=(1.12, 1.12, 1.1), lift=0.1):
    k = c.k
    cap = k.ico('haircap', c.H(0, 0.05, lift), (c.HR[0] * scale[0], c.HR[1] * scale[1], c.HR[2] * scale[2]), c.m('hair'), subdiv=3, keep=0.4)
    bm = bmesh.new(); bm.from_mesh(cap.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep((v.co.x - c.HC.x) / c.HR[0], (v.co.y - c.HC.y) / c.HR[1], (v.co.z - c.HC.z) / c.HR[2])], context='VERTS')
    bm.to_mesh(cap.data); bm.free()
    return c.add(cap, 'Head')

@part('hair.curly', hair='#241a14')
def hair_curly(k, pal, n=44, seed=7):
    """Messy curls over a cap, and a short fringe."""
    c = Ctx(k, pal); rnd = random.Random(seed)
    hair_cap(c, lambda x, y, z: z > 0.25 or (y > 0.05 and z > -0.55) or (abs(x) > 0.8 and z > -0.25 and y > -0.35))
    for i in range(n):
        a = rnd.uniform(0, 2 * math.pi); e = rnd.uniform(-0.35, 1.0)
        if math.cos(a) > 0.3 and e < 0.55:  # not over the face (the front is -y)
            continue
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        p = c.H(d.x * 1.12, d.y * 1.12, d.z * 1.1 + 0.05)
        r = rnd.uniform(0.26, 0.36) * c.HR[0]
        c.add(k.uvs(f'curl{i}', p, (r, r, r * 0.8), c.m('hair'), segs=5, rings=3), 'Head')
    for i, x in enumerate((-0.62, -0.3, 0.0, 0.3, 0.6)):
        base = c.H(x, -0.62, 0.8)
        tip = c.H(x * 1.15 + rnd.uniform(-0.08, 0.08), -1.08, 0.5 + rnd.uniform(-0.05, 0.05))
        c.add(k.spike(f'fringe{i}', base, tip, 0.22 * c.HR[0], c.m('hair'), segs=4, rot=0.4 * i), 'Head')
    return c.out

@part('hair.bun', hair='#1c1a22', hat_band='#d8c070')
def hair_bun(k, pal, seed=11):
    """Pulled back into a high messy bun with a band, loose strands at the temples."""
    c = Ctx(k, pal); rnd = random.Random(seed)
    hair_cap(c, lambda x, y, z: z > 0.1 or (y > -0.1 and z > -0.5) or (abs(x) > 0.85 and z > -0.35), scale=(1.07, 1.07, 1.06), lift=0.06)
    bun = c.H(0.08, 0.62, 0.95)
    c.add(k.ico('bun', bun, c.Hr(0.62, 0.58, 0.55), c.m('hair'), subdiv=2), 'Head')
    c.add(k.ring('band', c.H(0.06, 0.38, 0.72), 0.42 * c.HR[0], 0.08 * c.HR[0], c.m('hat_band'), segs=10, minor=4, rot=(0.9, 0.2, 0)), 'Head')
    for i in range(7):  # wisps out of the bun
        a = rnd.uniform(0, 2 * math.pi)
        d = Vector((math.cos(a), math.sin(a) * 0.8, rnd.uniform(0.2, 0.9))).normalized()
        c.add(k.spike(f'wisp{i}', bun + d * 0.45 * c.HR[0], bun + d * 0.85 * c.HR[0], 0.1 * c.HR[0], c.m('hair'), segs=4), 'Head')
    for s in (1, -1):  # strands framing the face
        c.add(k.spike('strand', c.H(0.8 * s, -0.55, 0.55), c.H(0.95 * s, -0.62, -0.45), 0.13 * c.HR[0], c.m('hair'), segs=4), 'Head')
    c.add(k.spike('fringe', c.H(-0.2, -0.7, 0.85), c.H(-0.45, -1.02, 0.35), 0.2 * c.HR[0], c.m('hair'), segs=4), 'Head')
    return c.out

# ---------------------------------------------------------------- tops
def sleeve_path(c, reach):
    """Shoulder (a little inside it) → elbow → towards the wrist by `reach` (0..1 of the forearm)."""
    J = c.J
    return [J['shoulder'] - Vector((0.03, 0, -0.02)), J['shoulder'], J['elbow'], lerp(J['elbow'], J['wrist'], reach)]

@part('top.tunic', cloth_tunic='#cdbb92', cloth_wraps='#d8c9a3')
def top_tunic(k, pal, wraps=True):
    """A long tunic with full sleeves, wrist wraps."""
    c = Ctx(k, pal); J, T = c.J, c.T
    pts, rs = torso_rings(c, J['pelvis'].z - 0.07, J['neck'].z + 0.01, flare=1.03)
    c.add(k.tube('tunic', pts, rs, c.m('cloth_tunic'), segs=10), SPINE)
    c.pair(lambda: k.tube('sleeve', sleeve_path(c, 0.72), [0.06 * T, 0.064 * T, 0.057 * T, 0.052 * T], c.m('cloth_tunic'), segs=8), ARM)
    if wraps:
        c.pair(lambda: k.tube('armwrap', [lerp(J['elbow'], J['wrist'], 0.62), J['wrist']], [0.05 * T, 0.046 * T], c.m('cloth_wraps'), segs=8), 'LowerArm.*')
    return c.out

@part('top.shirt_rolled', cloth_shirt='#e2d3ad')
def top_shirt_rolled(k, pal):
    """A loose shirt, sleeves rolled above the elbow."""
    c = Ctx(k, pal); J, T = c.J, c.T
    pts, rs = torso_rings(c, J['pelvis'].z - 0.02, J['neck'].z + 0.01)
    c.add(k.tube('shirt', pts, rs, c.m('cloth_shirt'), segs=10), SPINE)
    c.pair(lambda: k.tube('sleeve', sleeve_path(c, 0)[:3], [0.066 * T, 0.078 * T, 0.072 * T], c.m('cloth_shirt'), segs=8), ARM)
    c.pair(lambda: k.ring('roll', lerp(J['shoulder'], J['elbow'], 0.92), 0.07 * T, 0.018 * T, c.m('cloth_shirt'), segs=8, minor=4,
                          rot=(0, math.atan2(J['elbow'].x - J['shoulder'].x, J['shoulder'].z - J['elbow'].z), 0)), 'UpperArm.*')
    return c.out

# ---------------------------------------------------------------- bottoms
def seat(c, slot, z_top, bag=1.0):
    J = c.J; hipr = J['hip'].x * 1.45
    return c.add(c.k.tube('seat', [(0, 0.005, J['hip'].z - 0.07), (0, 0.005, J['pelvis'].z), (0, 0.005, z_top)],
                          [(hipr * 0.95 * bag, hipr * 0.72 * bag), (hipr * 1.08 * bag, hipr * 0.78 * bag), (hipr, hipr * 0.72)], c.m(slot), segs=10), ['Hips', 'Abdomen'])

@part('bottom.baggy', cloth_trousers='#4a403b', strap_patch='#7a4a2e')
def bottom_baggy(k, pal, patches=True):
    """Baggy trousers gathered at the shin (into wraps or boots)."""
    c = Ctx(k, pal); J, T = c.J, c.T
    seat(c, 'cloth_trousers', lerp(J['pelvis'].z, J['waist'].z, 0.8), bag=1.05)
    c.pair(lambda: k.tube('leg', [J['hip'] + Vector((-0.015, 0, 0.05)), J['hip'], lerp(J['hip'], J['knee'], 0.55), J['knee'], lerp(J['knee'], J['ankle'], 0.3)],
                          [0.098 * T, 0.11 * T, 0.12 * T, 0.114 * T, 0.066 * T], c.m('cloth_trousers'), segs=8), LEG)
    if patches:
        p = lerp(J['hip'], J['knee'], 0.55)
        c.add(k.box('patch', p + Vector((0.02, -0.118 * T, 0)), (0.07 * T, 0.012, 0.075 * T), c.m('strap_patch'), rot=(0, 0.1, 0.12)), ['UpperLeg.L'])
        q = J['knee']
        c.add(k.box('patch', Vector((-q.x - 0.01, q.y - 0.11 * T, q.z)), (0.062 * T, 0.012, 0.06 * T), c.m('strap_patch'), rot=(0.15, -0.1, -0.1)), ['UpperLeg.R', 'LowerLeg.R'])
    return c.out

@part('bottom.overalls', cloth_denim='#3e5a7e', strap_patch='#8a9a6a', strap_button='#b8a878')
def bottom_overalls(k, pal):
    """Denim overalls: legs with rolled cuffs, a bib with a pocket, straps over the shoulders."""
    c = Ctx(k, pal); J, T, TT = c.J, c.T, c.TT
    seat(c, 'cloth_denim', J['waist'].z + 0.02)
    cuff = lerp(J['knee'], J['ankle'], 0.35)
    c.pair(lambda: k.tube('leg', [J['hip'] + Vector((-0.015, 0, 0.05)), J['hip'], J['knee'], cuff],
                          [0.1 * T, 0.108 * T, 0.104 * T, 0.098 * T], c.m('cloth_denim'), segs=8), LEG)
    c.pair(lambda: k.ring('cuff', cuff + Vector((0, 0, 0.012)), 0.1 * T, 0.02 * T, c.m('cloth_denim'), segs=8, minor=4), 'LowerLeg.*')
    # The bib, over the chest, and a back panel.
    front = -0.108 * TT - 0.006
    zb, zt = J['waist'].z - 0.01, lerp(J['chest'].z, J['neck'].z, 0.25)
    c.add(k.box('bib', Vector((0, front, (zb + zt) / 2)), (J['shoulder'].x * 1.15, 0.018, zt - zb), c.m('cloth_denim'), taper=0.92), ['Abdomen', 'Torso', 'Chest'])
    c.add(k.box('pocket', Vector((0, front - 0.012, lerp(zb, zt, 0.55))), (J['shoulder'].x * 0.55, 0.01, (zt - zb) * 0.35), c.m('cloth_denim'), bevel=0.004), ['Torso', 'Chest'])
    c.add(k.box('back', Vector((0, 0.104 * TT + 0.006, lerp(zb, zt, 0.4))), (J['shoulder'].x * 1.2, 0.018, (zt - zb) * 0.8), c.m('cloth_denim')), ['Abdomen', 'Torso'])
    x = J['shoulder'].x * 0.42
    c.pair(lambda: k.tube('ostrap', [Vector((x, front, zt - 0.01)), Vector((x + 0.01, -0.06 * TT, J['neck'].z - 0.01)),
                                    Vector((x + 0.01, 0.07 * TT, J['neck'].z - 0.02)), Vector((x * 0.6, 0.11 * TT, lerp(zb, zt, 0.7)))],
                          0.016 * TT, c.m('cloth_denim'), segs=4), ['Chest', 'Torso'])
    c.pair(lambda: k.uvs('button', Vector((x, front - 0.014, zt - 0.025)), (0.013, 0.008, 0.013), c.m('strap_button'), segs=6, rings=3), 'Chest')
    # Patches (lighter, sun-faded).
    c.add(k.box('patch', lerp(J['hip'], J['knee'], 0.5) + Vector((0.02, -0.105 * T, 0)), (0.07 * T, 0.01, 0.07 * T), c.m('strap_patch'), rot=(0, 0.12, 0.2)), ['UpperLeg.L'])
    c.add(k.box('patch', Vector((-J['knee'].x, J['knee'].y - 0.1 * T, J['knee'].z - 0.03)), (0.06 * T, 0.01, 0.055 * T), c.m('strap_patch'), rot=(0.1, -0.1, -0.2)), ['LowerLeg.R'])
    return c.out

# ---------------------------------------------------------------- legs and feet
@part('legs.wraps', cloth_wraps='#d8c9a3', cloth_wrap_line='#a8946c')
def legs_wraps(k, pal):
    """Cloth wrapped round the shins, with darker turns."""
    c = Ctx(k, pal); J, T = c.J, c.T
    top, bot = lerp(J['knee'], J['ankle'], 0.22), lerp(J['ankle'], J['knee'], 0.3)
    c.pair(lambda: k.tube('wrap', [top, bot], [0.066 * T, 0.062 * T], c.m('cloth_wraps'), segs=8), 'LowerLeg.*')
    for t, tilt in ((0.25, 0.12), (0.55, -0.1), (0.82, 0.14)):
        c.pair(lambda t=t, tilt=tilt: k.ring('band', lerp(bot, top, t), 0.066 * T, 0.006 * T, c.m('cloth_wrap_line'), segs=8, minor=3, rot=(tilt, 0.05, 0)), 'LowerLeg.*')
    return c.out

@part('feet.boots', boot='#7a5234', boot_sole='#3a281b', boot_lace='#c9a36a')
def feet_boots(k, pal, height=0.4):
    """Big lace-up boots: shaft, turned cuff, rounded foot, thick sole."""
    c = Ctx(k, pal); J, T = c.J, c.T
    F = 1 + (c.FOOT - 1) * 0.5  # big, round boots rather than long ones
    a = J['ankle']
    top = lerp(a, J['knee'], height)
    c.pair(lambda: k.tube('shaft', [top, a + Vector((0, 0.004, -0.03))], [0.07 * T, 0.068 * T], c.m('boot'), segs=8), 'LowerLeg.*')
    c.pair(lambda: k.ring('cuff', top, 0.074 * T, 0.013 * T, c.m('boot'), segs=8, minor=4), 'LowerLeg.*')
    zf = a.z * 0.45
    c.pair(lambda: k.tube('foot', [Vector((a.x, a.y + 0.065 * F, zf)), Vector((a.x, a.y, zf + 0.008 * F)), Vector((a.x + 0.001, a.y - 0.09 * F, zf)), Vector((a.x + 0.002, a.y - 0.145 * F, zf - 0.008 * F))],
                          [(0.066 * F, 0.056 * F), (0.076 * F, 0.064 * F), (0.072 * F, 0.052 * F), (0.052 * F, 0.034 * F)], c.m('boot'), segs=8), 'Foot.*')
    c.pair(lambda: k.box('sole', Vector((a.x + 0.001, a.y - 0.04 * F, 0.011 * F)), (0.155 * F, 0.235 * F, 0.024 * F), c.m('boot_sole'), bevel=0.006), 'Foot.*')
    for i in range(3):  # lace crossings up the front
        z = lerp(zf + 0.03 * F, top.z - 0.02, i / 2)
        c.pair(lambda z=z: k.box('lace', Vector((a.x, a.y - 0.062 * T, z)), (0.045 * T, 0.008, 0.008), c.m('boot_lace'), rot=(0, 0.35 * (1 if i % 2 else -1), 0)), 'LowerLeg.*')
    return c.out

@part('hands.gloves_fingerless', strap_glove='#46332a')
def hands_gloves(k, pal):
    """Fingerless gloves over the mittens, with a cuff."""
    c = Ctx(k, pal); J, Hs = c.J, c.HAND
    def glove():
        w, h = J['wrist'], J['hand']
        return k.box('glove', lerp(w, h, 0.38), (0.05 * Hs, 0.064 * Hs, 0.05 * Hs), c.m('strap_glove'), bevel=0.008 * Hs)
    c.pair(glove, 'Wrist.*')
    c.pair(lambda: k.ring('gcuff', J['wrist'], 0.036 * Hs, 0.01 * Hs, c.m('strap_glove'), segs=8, minor=4, scale=(1, 1.2, 1)), 'Wrist.*')
    return c.out

# ---------------------------------------------------------------- neck, waist, straps
@part('neck.scarf', cloth_scarf='#d4836a')
def neck_scarf(k, pal):
    """A big bunched scarf with a tail."""
    c = Ctx(k, pal); J, TT = c.J, c.TT
    z = lerp(J['neck'].z, J['head'].z, 0.15)
    c.add(k.ring('scarf', Vector((0, -0.01, z)), 0.085 * TT, 0.045 * TT, c.m('cloth_scarf'), segs=10, minor=5, scale=(1.15, 1.05, 0.9)), ['Neck', 'Chest'])
    c.add(k.ring('scarf2', Vector((0, -0.02, z - 0.035 * TT)), 0.095 * TT, 0.035 * TT, c.m('cloth_scarf'), segs=10, minor=4, scale=(1.1, 1.05, 0.8), rot=(0.2, 0, 0)), 'Chest')
    c.add(k.spike('tail', Vector((0.02, -0.12 * TT, z - 0.04)), Vector((0.05, -0.15 * TT, J['chest'].z - 0.02)), 0.05 * TT, c.m('cloth_scarf'), segs=4, rot=0.3), 'Chest')
    return c.out

@part('neck.bandana', cloth_bandana='#6f7f3a')
def neck_bandana(k, pal):
    """A knotted neckerchief."""
    c = Ctx(k, pal); J, TT = c.J, c.TT
    z = lerp(J['neck'].z, J['head'].z, 0.1)
    c.add(k.ring('bandana', Vector((0, -0.008, z)), 0.078 * TT, 0.034 * TT, c.m('cloth_bandana'), segs=10, minor=4, scale=(1.12, 1.05, 0.85)), ['Neck', 'Chest'])
    c.add(k.spike('point', Vector((0, -0.105 * TT, z - 0.01)), Vector((0.01, -0.13 * TT, z - 0.1 * TT)), 0.045 * TT, c.m('cloth_bandana'), segs=4, rot=math.pi / 4), 'Chest')
    return c.out

@part('waist.belt', strap='#553823', strap_buckle='#b39d73')
def waist_belt(k, pal):
    c = Ctx(k, pal); J = c.J
    z = lerp(J['pelvis'].z, J['waist'].z, 0.6); r = J['hip'].x * 1.45 * 1.02
    c.add(k.ring('belt', Vector((0, 0.004, z)), r, 0.017 * c.TT, c.m('strap'), segs=12, minor=4, scale=(1, 0.73, 1)), 'Hips')
    c.add(k.box('buckle', Vector((0, -r * 0.73 - 0.012, z)), (0.052, 0.014, 0.042), c.m('strap_buckle')), 'Hips')
    return c.out

@part('straps.chest', strap='#553823', strap_buckle='#b39d73')
def straps_chest(k, pal):
    """Pack straps over the shoulders, down the chest to the belt."""
    c = Ctx(k, pal); J, TT = c.J, c.TT
    x = J['shoulder'].x * 0.5; zb = lerp(J['pelvis'].z, J['waist'].z, 0.6)
    front = -0.108 * TT - 0.008
    c.pair(lambda: k.tube('strap', [Vector((x, 0.1 * TT, J['chest'].z)), Vector((x + 0.006, 0.03, J['neck'].z + 0.012)), Vector((x, front + 0.01, lerp(J['chest'].z, J['neck'].z, 0.5))),
                                  Vector((x, front, J['belly'].z)), Vector((x - 0.002, front + 0.004, zb))], 0.012, c.m('strap'), segs=4), ['Chest', 'Torso'])
    c.pair(lambda: k.box('sbuckle', Vector((x, front - 0.006, J['chest'].z - 0.02)), (0.032, 0.01, 0.03), c.m('strap_buckle')), 'Torso')
    return c.out

# ---------------------------------------------------------------- bags, back
@part('bag.satchel', pack='#95673a', pack_sack='#d6c69c', strap='#553823')
def bag_satchel(k, pal):
    """A satchel on the right hip (-x) and a small tied sack beside it."""
    c = Ctx(k, pal); J, T = c.J, c.T
    p = Vector((-(J['hip'].x + 0.085), -0.055, J['pelvis'].z - 0.015))
    c.add(k.box('satchel', p, (0.1 * T, 0.055 * T, 0.1 * T), c.m('pack'), rot=(0, 0, 0.2), bevel=0.01), 'Hips')
    c.add(k.box('flap', p + Vector((-0.004, -0.03 * T, 0.03 * T)), (0.102 * T, 0.014, 0.052 * T), c.m('pack'), rot=(0.1, 0, 0.2)), 'Hips')
    c.add(k.tube('sstrap', [p + Vector((0, 0, 0.05 * T)), Vector((-J['hip'].x * 1.2, -0.1, lerp(J['pelvis'].z, J['waist'].z, 0.6)))], 0.008, c.m('strap'), segs=4), 'Hips')
    q = Vector((-J['hip'].x * 1.05, -0.125 * T, J['pelvis'].z - 0.01))
    c.add(k.uvs('sack', q, (0.028 * T, 0.026 * T, 0.038 * T), c.m('pack_sack'), segs=6, rings=4), 'Hips')
    c.add(k.spike('tie', q + Vector((0, 0, 0.03 * T)), q + Vector((0.003, -0.003, 0.06 * T)), 0.015 * T, c.m('pack_sack'), segs=4), 'Hips')
    return c.out

@part('bag.plant_sack', pack='#8a6238', strap='#553823', pack_leaf='#5f8a3e', pack_flower='#f2ecd8', pack_flower_eye='#e0b040')
def bag_plant_sack(k, pal, seed=5):
    """A sack of seedlings on a strap across the body (left shoulder to right hip)."""
    c = Ctx(k, pal); J, T, TT = c.J, c.T, c.TT; rnd = random.Random(seed)
    q = Vector((-(J['hip'].x + 0.1 * T), -0.06, J['pelvis'].z + 0.01))
    c.add(k.ico('sack', q, (0.105 * T, 0.075 * T, 0.095 * T), c.m('pack'), subdiv=2, keep=0.6), 'Hips')
    front = -0.108 * TT - 0.01
    c.add(k.tube('xstrap', [q + Vector((0.03, -0.01, 0.07 * T)), Vector((-0.02, front, J['belly'].z)), Vector((J['shoulder'].x * 0.55, front + 0.01, J['chest'].z + 0.04)),
                            Vector((J['shoulder'].x * 0.6, 0.0, J['neck'].z + 0.012)), Vector((J['shoulder'].x * 0.5, 0.11 * TT, J['chest'].z)),
                            Vector((-0.02, 0.115 * TT, J['belly'].z)), q + Vector((0.03, 0.05, 0.06 * T))], 0.013, c.m('strap'), segs=4), ['Hips', 'Torso', 'Chest'])
    top = q + Vector((0, 0, 0.075 * T))
    for i in range(7):  # leaves
        d = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 0.6), rnd.uniform(0.7, 1.4))).normalized()
        c.add(k.spike(f'leaf{i}', top + d * 0.02, top + d * rnd.uniform(0.09, 0.14) * T, 0.026 * T, c.m('pack_leaf'), segs=3, rot=rnd.uniform(0, 3)), 'Hips')
    for i in range(3):  # flowers: white petals round a yellow eye
        f = top + Vector((rnd.uniform(-0.06, 0.06), rnd.uniform(-0.05, 0.01), rnd.uniform(0.05, 0.09))) * T
        c.add(k.uvs(f'flower{i}', f, (0.024 * T, 0.012 * T, 0.024 * T), c.m('pack_flower'), segs=5, rings=3), 'Hips')
        c.add(k.uvs(f'feye{i}', f + Vector((0, -0.01 * T, 0)), (0.009 * T, 0.006, 0.009 * T), c.m('pack_flower_eye'), segs=4, rings=2), 'Hips')
    return c.out

@part('back.bedroll', roll='#a4733e', strap='#553823')
def back_bedroll(k, pal):
    c = Ctx(k, pal); J, TT = c.J, c.TT
    y, z, x = 0.17 * TT, J['neck'].z + 0.005, J['shoulder'].x + 0.03
    c.add(k.tube('bedroll', [Vector((-x, y, z)), Vector((x, y, z))], 0.055 * TT, c.m('roll'), segs=8), 'Chest')
    c.pair(lambda: k.ring('tie', Vector((x * 0.55, y, z)), 0.058 * TT, 0.008, c.m('strap'), segs=8, minor=3, rot=(0, math.pi / 2, 0)), 'Chest')
    return c.out

# ---------------------------------------------------------------- outerwear
@part('outer.cloak', cloth_cloak='#7c9656', cloth_cloak_edge='#a8a466')
def outer_cloak(k, pal):
    """A ragged two-tier cloak, open at the front, bleached at the hem, hood down behind."""
    c = Ctx(k, pal); J, T, TT = c.J, c.T, c.TT
    def drape(name, z_top, r_top, hem, r_hem, jag, open_front, cols, rows, seed):
        rr = random.Random(seed)
        span = 2 * math.pi - 2 * open_front
        jags = [rr.uniform(0.55, 1.35) for _ in range(cols)]
        grid = []
        for i in range(rows):
            v = i / (rows - 1); row = []
            for j in range(cols):
                phi = open_front + span * j / (cols - 1)
                hx, hy = r_hem(phi)
                rx = r_top[0] + (hx - r_top[0]) * v ** 0.7
                ry = r_top[1] + (hy - r_top[1]) * v ** 0.7
                z = z_top + (hem(phi) - z_top) * v
                if i == rows - 1:
                    z -= jag * jags[j] if j % 2 == 0 else -jag * 0.25
                row.append((math.sin(phi) * rx, -math.cos(phi) * ry + 0.01, z))
            grid.append(row)
        return k.sheet(name, grid, c.m('cloth_cloak'), thickness=0.012, extra=[c.m('cloth_cloak_edge')], face_mat=lambda i, j: 1 if i == rows - 2 else 0)
    back = lambda phi: max(0.0, -math.cos(phi))
    sides = lambda phi: abs(math.sin(phi))
    sx = J['shoulder'].x
    thigh = lerp(J['hip'].z, J['knee'].z, 0.35)
    c.add(drape('cloak', J['shoulder'].z + 0.02, (sx + 0.005, 0.14 * TT), hem=lambda phi: thigh + (J['pelvis'].z - thigh) * 0.35 * sides(phi) ** 2,
                r_hem=lambda phi: (sx + 0.12 * T, 0.17 * TT + 0.09 * back(phi)), jag=0.07, open_front=0.42, cols=30, rows=6, seed=3),
          ['Chest', 'Torso', 'Abdomen', 'Hips', 'UpperArm.L', 'UpperArm.R', 'UpperLeg.L', 'UpperLeg.R'])
    c.add(drape('capelet', J['neck'].z + 0.03, (0.095 * TT, 0.088 * TT), hem=lambda phi: J['belly'].z + 0.04 * sides(phi),
                r_hem=lambda phi: (sx + 0.09 * T, 0.18 * TT + 0.07 * back(phi)), jag=0.055, open_front=0.36, cols=24, rows=4, seed=5),
          ['Chest', 'Neck', 'Shoulder.L', 'Shoulder.R', 'UpperArm.L', 'UpperArm.R'])
    c.add(k.uvs('hood', Vector((0, 0.1 * TT, J['neck'].z + 0.03)), (0.13 * TT, 0.075 * TT, 0.07 * TT), c.m('cloth_cloak'), segs=8, rings=5), ['Chest', 'Neck'])
    return c.out

# ---------------------------------------------------------------- held (left hand, +x)
@part('held.lantern', pack_metal='#4a3a2e', pack_glass='#ffd27a')
def held_lantern(k, pal):
    """A hurricane lantern hanging from the left hand."""
    c = Ctx(k, pal); J = c.J; s = c.HAND * 1.15
    h = J['hand']; top = h + Vector((0, 0, -0.03 * s))
    body = top + Vector((0, 0, -0.14 * s))
    c.add(k.ring('handle', top + Vector((0, 0, 0.025 * s)), 0.04 * s, 0.006, c.m('pack_metal'), segs=10, minor=3, rot=(0, math.pi / 2, 0)), 'Wrist.L')
    c.add(k.spike('cap', top + Vector((0, 0, -0.06 * s)), top + Vector((0, 0, 0.0)), 0.05 * s, c.m('pack_metal'), segs=8), 'Wrist.L')
    c.add(k.tube('glass', [body + Vector((0, 0, 0.06 * s)), body + Vector((0, 0, -0.05 * s))], [0.038 * s, 0.042 * s], c.m('pack_glass'), segs=8), 'Wrist.L')
    for a in range(4):
        d = Vector((math.cos(a * math.pi / 2 + math.pi / 4), math.sin(a * math.pi / 2 + math.pi / 4), 0)) * 0.044 * s
        c.add(k.tube('post', [body + d + Vector((0, 0, 0.065 * s)), body + d + Vector((0, 0, -0.06 * s))], 0.005, c.m('pack_metal'), segs=4), 'Wrist.L')
    c.add(k.tube('base', [body + Vector((0, 0, -0.055 * s)), body + Vector((0, 0, -0.085 * s))], [0.05 * s, 0.052 * s], c.m('pack_metal'), segs=8), 'Wrist.L')
    return c.out

@part('held.trowel', pack_wood='#8a5a34', pack_steel='#8f9294')
def held_trowel(k, pal):
    """A garden trowel in the left hand, blade down."""
    c = Ctx(k, pal); J = c.J; s = c.HAND * 1.1
    h = J['hand']
    grip_top, grip_bot = h + Vector((0, -0.01, 0.03 * s)), h + Vector((0.004, -0.03 * s, -0.06 * s))
    c.add(k.tube('grip', [grip_top, grip_bot], [0.016 * s, 0.018 * s], c.m('pack_wood'), segs=6), 'Wrist.L')
    c.add(k.tube('neck', [grip_bot, grip_bot + Vector((0, -0.02 * s, -0.03 * s))], 0.006, c.m('pack_steel'), segs=4), 'Wrist.L')
    tip = grip_bot + Vector((0.01, -0.08 * s, -0.16 * s))
    mid = grip_bot + Vector((0, -0.04 * s, -0.07 * s))
    c.add(k.sheet('blade', [[mid + Vector((-0.04 * s, 0, 0.02 * s)), mid + Vector((0, -0.006, 0.03 * s)), mid + Vector((0.04 * s, 0, 0.02 * s))],
                            [tip + Vector((-0.004, 0, 0)), tip, tip + Vector((0.004, 0, 0))]], c.m('pack_steel'), thickness=0.006), 'Wrist.L')
    return c.out
