"""
Folk Scout: a young salvager in a ragged green cloak (concept:
lab/workshop/concepts/folk_scout.webp).

Silhouette first (it is what reads at about 30 px in the game): the cloak's
jagged two-tier hem, the bedroll across the shoulders, messy curls, baggy
trousers gathered into leg wraps, big boots. Details (eyes, buckles, patches)
only for close views.
"""
import math, random

NAME = 'folk_scout'
BODY = 'man'  # which of the game's pools: man | woman | child

PAL = dict(
    skin='#b27a50', hair='#2b1f18', eye='#24160e', eye_white='#efe6d6',
    tunic='#cdbb92', trousers='#4a403b', wraps='#d8c9a3', wrap_line='#a8946c',
    boot='#7a5234', sole='#3a281b', cloak='#7c9656', scarf='#d4836a',
    cloak_edge='#a8a466', strap='#553823', buckle='#b39d73', patch='#7a4a2e', glove='#46332a',
    satchel='#95673a', sack='#d6c69c', roll='#a4733e',
)

SPINE = ['Hips', 'Abdomen', 'Torso', 'Chest', 'Neck']

def side_bones(names, s):
    """Bone names for one side: 'UpperArm.*' → 'UpperArm.L' (s=1) or '.R' (s=-1)."""
    return [n.replace('*', 'L' if s > 0 else 'R') for n in names]

def build(k):
    M = {key: k.mat(slot, PAL[key]) for key, slot in dict(
        skin='skin', hair='hair', eye='eye', eye_white='eye_white', tunic='cloth_tunic', trousers='cloth_trousers',
        wraps='cloth_wraps', wrap_line='cloth_wrap_line', boot='boot', sole='boot_sole', cloak='cloth_cloak',
        scarf='cloth_scarf', cloak_edge='cloth_cloak_edge', strap='strap', buckle='strap_buckle', patch='strap_patch', glove='strap_glove',
        satchel='pack', sack='pack_sack', roll='roll').items()}
    J, HC, HR = k.J, k.HEAD_C, k.HEAD_R
    parts = []
    def add(ob, bones=None):
        parts.append((ob, bones))
        return ob
    def pair(make, bones):
        """make(s) builds the left (s=1) part; the right is its mirror, weighted to the right-side bones."""
        ob = make(1)
        add(ob, side_bones(bones, 1) if isinstance(bones, list) else bones.replace('*', 'L'))
        add(k.mirrored(ob), side_bones(bones, -1) if isinstance(bones, list) else bones.replace('*', 'R'))
    rnd = random.Random(7)

    # ------------------------------------------------ body and clothes
    # Tunic torso (the neck opening sits under the scarf).
    add(k.tube('tunic', [(0, 0, z) for z in (0.80, 0.92, 1.05, 1.19, 1.31, 1.39)],
               [(0.152, 0.108), (0.148, 0.104), (0.154, 0.104), (0.168, 0.11), (0.162, 0.1), (0.07, 0.065)], M['tunic'], segs=10), SPINE)
    add(k.tube('neck', [(0, -0.005, 1.36), (0, -0.005, 1.47)], [0.052, 0.05], M['skin'], segs=8), ['Neck', 'Head'])
    # Trousers: a seat, then baggy legs gathered at the shin.
    add(k.tube('seat', [(0, 0.005, z) for z in (0.76, 0.86, 0.96)], [(0.158, 0.115), (0.175, 0.125), (0.155, 0.11)], M['trousers'], segs=10),
        ['Hips', 'Abdomen'])
    pair(lambda s: k.tube('leg', [(0.088, 0.005, 0.86), (0.1, 0.005, 0.76), (0.108, 0.0, 0.58), (0.11, -0.005, 0.45), (0.112, 0.008, 0.33)],
                          [0.108, 0.122, 0.128, 0.118, 0.068], M['trousers'], segs=8), ['Hips', 'UpperLeg.*', 'LowerLeg.*'])
    add(k.box('patch_thigh', (0.13, -0.118, 0.6), (0.075, 0.012, 0.08), M['patch'], rot=(0, 0.1, 0.12)), ['UpperLeg.L'])
    add(k.box('patch_knee', (-0.118, -0.112, 0.44), (0.066, 0.012, 0.064), M['patch'], rot=(0.15, -0.1, -0.1)), ['UpperLeg.R', 'LowerLeg.R'])
    # Leg wraps with darker bands, then boots (shaft follows the shin, the foot follows the foot).
    pair(lambda s: k.tube('wrap', [(0.112, 0.012, 0.34), (0.112, 0.014, 0.19)], [0.066, 0.064], M['wraps'], segs=8), 'LowerLeg.*')
    for z, tilt in ((0.22, 0.12), (0.27, -0.1), (0.315, 0.14)):
        pair(lambda s, z=z, tilt=tilt: k.ring('wrapband', (0.112, 0.013, z), 0.066, 0.006, M['wrap_line'], segs=8, minor=3, rot=(tilt, 0.05, 0)), 'LowerLeg.*')
    pair(lambda s: k.tube('bootshaft', [(0.112, 0.016, 0.215), (0.112, 0.016, 0.09)], [0.078, 0.076], M['boot'], segs=8), 'LowerLeg.*')
    pair(lambda s: k.ring('bootcuff', (0.112, 0.016, 0.21), 0.08, 0.013, M['boot'], segs=8, minor=4), 'LowerLeg.*')
    pair(lambda s: k.tube('foot', [(0.112, 0.075, 0.058), (0.112, 0.01, 0.064), (0.113, -0.085, 0.052), (0.114, -0.15, 0.044)],
                          [(0.066, 0.058), (0.076, 0.064), (0.072, 0.048), (0.05, 0.032)], M['boot'], segs=8), 'Foot.*')
    pair(lambda s: k.box('sole', (0.113, -0.035, 0.01), (0.155, 0.265, 0.022), M['sole'], bevel=0.006), 'Foot.*')
    # Arms: tunic sleeves, wrist wraps, fingerless gloves, fingers.
    arm = ['Shoulder.*', 'UpperArm.*', 'LowerArm.*']
    pair(lambda s: k.tube('sleeve', [(0.175, 0.0, 1.33), J['shoulder'], J['elbow'], (0.266, -0.016, 0.9)],
                          [0.062, 0.062, 0.052, 0.047], M['tunic'], segs=8), arm)
    pair(lambda s: k.tube('armwrap', [(0.266, -0.017, 0.915), (0.271, -0.021, 0.845)], [0.046, 0.043], M['wraps'], segs=8), 'LowerArm.*')
    pair(lambda s: k.box('glove', (0.274, -0.029, 0.8), (0.042, 0.058, 0.07), M['glove'], taper=0.9, bevel=0.008), 'Wrist.*')
    pair(lambda s: k.box('fingers', (0.278, -0.036, 0.752), (0.036, 0.052, 0.034), M['skin'], bevel=0.008), 'Wrist.*')
    pair(lambda s: k.spike('thumb', (0.262, -0.058, 0.795), (0.256, -0.075, 0.755), 0.014, M['skin'], segs=4), 'Wrist.*')

    # ------------------------------------------------ head
    head = add(k.ico('head', HC, (HR[0] * 1.04, HR[1] * 1.04, HR[2] * 1.02), M['skin'], subdiv=3, keep=0.45), 'Head')
    for v in head.data.vertices:  # a narrower jaw
        if v.co.z < HC[2]:
            f = 1 - 0.14 * (HC[2] - v.co.z) / HR[2]
            v.co.x *= f; v.co.y = HC[1] + (v.co.y - HC[1]) * f
    add(k.uvs('nose', (0, -0.118, 1.54), (0.017, 0.011, 0.02), M['skin'], segs=6, rings=4), 'Head')  # small and round (a point reads as a beak)
    pair(lambda s: k.uvs('ear', (0.111, 0.005, 1.548), (0.016, 0.026, 0.034), M['skin'], segs=6, rings=4), 'Head')
    pair(lambda s: k.uvs('eyewhite', (0.043, -0.109, 1.567), (0.028, 0.009, 0.03), M['eye_white'], segs=8, rings=4), 'Head')
    pair(lambda s: k.uvs('iris', (0.044, -0.116, 1.564), (0.022, 0.008, 0.026), M['eye'], segs=6, rings=4), 'Head')
    add(k.box('mouth', (0, -0.112, 1.508), (0.034, 0.01, 0.007), M['eye'], rot=(0, 0, 0)), 'Head')
    pair(lambda s: k.box('brow', (0.046, -0.114, 1.608), (0.048, 0.014, 0.012), M['hair'], rot=(0, -0.12, 0.08)), 'Head')
    # Hair: a cap over the crown and back, then curls and a fringe.
    cap = k.ico('haircap', (HC[0], HC[1] + 0.006, HC[2] + 0.012), (HR[0] * 1.13, HR[1] * 1.12, HR[2] * 1.1), M['hair'], subdiv=2)
    import bmesh
    bm = bmesh.new(); bm.from_mesh(cap.data)
    def keep(v):
        x, y, z = (v.co.x - HC[0]) / HR[0], (v.co.y - HC[1]) / HR[1], (v.co.z - HC[2]) / HR[2]
        return z > 0.28 or (y > 0.05 and z > -0.55) or (abs(x) > 0.8 and z > -0.2 and y > -0.35)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v)], context='VERTS')
    bm.to_mesh(cap.data); bm.free()
    add(cap, 'Head')
    for i in range(40):
        # Curls over the cap: points on the upper and back of the head, pointing outwards and a little down.
        a = rnd.uniform(0, 2 * math.pi); e = rnd.uniform(-0.35, 1.0)
        if math.cos(a) > 0.3 and e < 0.55:  # not over the face (the front is -y: cos(a) > 0)
            continue
        d = (math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))
        base = (HC[0] + d[0] * HR[0] * 1.08, HC[1] + d[1] * HR[1] * 1.08, HC[2] + d[2] * HR[2] * 1.06)
        # Curls: small low lumps rather than spikes.
        L = rnd.uniform(0.022, 0.04)
        c = (base[0] + d[0] * L * 0.5, base[1] + d[1] * L * 0.5, base[2] + d[2] * L * 0.5 - 0.004)
        r = rnd.uniform(0.028, 0.04)
        add(k.uvs(f'curl{i}', c, (r, r, r * 0.8), M['hair'], segs=5, rings=3), 'Head')
    for i, x in enumerate((-0.075, -0.04, -0.005, 0.03, 0.065)):
        # A short fringe: ends above the brows (at 1.604).
        add(k.spike(f'fringe{i}', (x, -0.075, 1.672), (x * 1.15 + rnd.uniform(-0.01, 0.01), -0.128, 1.632 + rnd.uniform(-0.006, 0.006)),
                    0.026, M['hair'], segs=4, rot=0.4 * i), 'Head')

    # ------------------------------------------------ scarf, belt, straps, bags
    add(k.ring('scarf', (0, -0.008, 1.395), 0.082, 0.036, M['scarf'], segs=10, minor=5, scale=(1.12, 1.0, 0.85)), ['Neck', 'Chest'])
    add(k.spike('scarftail', (0.01, -0.1, 1.37), (0.03, -0.14, 1.265), 0.045, M['scarf'], segs=4, rot=0.3), 'Chest')
    add(k.ring('belt', (0, 0.0, 0.93), 0.152, 0.017, M['strap'], segs=12, minor=4, scale=(1.02, 0.73, 1)), 'Hips')
    add(k.box('buckle', (0, -0.118, 0.93), (0.05, 0.014, 0.04), M['buckle']), 'Hips')
    pair(lambda s: k.tube('strap', [(0.098, 0.1, 1.24), (0.104, 0.03, 1.395), (0.1, -0.095, 1.31), (0.098, -0.115, 1.12), (0.096, -0.11, 0.96)],
                          0.011, M['strap'], segs=4), ['Chest', 'Torso'])
    pair(lambda s: k.box('strapbuckle', (0.099, -0.122, 1.2), (0.03, 0.01, 0.028), M['buckle']), 'Torso')
    # Satchel on the right hip (-x), a small sack beside it.
    add(k.box('satchel', (-0.19, -0.05, 0.84), (0.1, 0.055, 0.1), M['satchel'], rot=(0, 0, 0.2), bevel=0.01), 'Hips')
    add(k.box('satchelflap', (-0.197, -0.08, 0.872), (0.102, 0.014, 0.052), M['satchel'], rot=(0.1, 0, 0.2)), 'Hips')
    add(k.tube('satchelstrap', [(-0.2, -0.05, 0.89), (-0.16, -0.09, 0.93)], 0.008, M['strap'], segs=4), 'Hips')
    add(k.uvs('sack', (-0.115, -0.125, 0.84), (0.028, 0.026, 0.038), M['sack'], segs=6, rings=4), 'Hips')
    add(k.spike('sacktie', (-0.115, -0.125, 0.87), (-0.112, -0.128, 0.9), 0.015, M['sack'], segs=4), 'Hips')
    # Bedroll across the shoulders, above the cloak.
    add(k.tube('bedroll', [(-0.17, 0.155, 1.375), (0.17, 0.155, 1.375)], (0.05, 0.05), M['roll'], segs=8), 'Chest')
    pair(lambda s: k.ring('rolltie', (0.1, 0.155, 1.375), 0.053, 0.007, M['strap'], segs=8, minor=3, rot=(0, math.pi / 2, 0)), 'Chest')

    # ------------------------------------------------ the cloak (two jagged tiers, open at the front)
    def cloak(name, z_top, r_top, hem, r_hem, jag, open_front, cols=30, rows=5, seed=1):
        """A drape from a ring at z_top down to a jagged hem. hem(phi) and r_hem(phi) give the
        hem's height and radius (rx, ry) by angle (phi = 0 at the front, pi at the back)."""
        rr = random.Random(seed)
        span = 2 * math.pi - 2 * open_front
        grid = []
        jags = [rr.uniform(0.55, 1.35) for _ in range(cols)]
        for i in range(rows):
            v = i / (rows - 1)
            row = []
            for j in range(cols):
                phi = open_front + span * j / (cols - 1)
                d = (math.sin(phi), -math.cos(phi))
                hx, hy = r_hem(phi)
                rx = r_top[0] + (hx - r_top[0]) * v ** 0.7
                ry = r_top[1] + (hy - r_top[1]) * v ** 0.7
                z = z_top + (hem(phi) - z_top) * v
                if i == rows - 1:  # the jagged hem: every other column hangs lower
                    z -= jag * jags[j] if j % 2 == 0 else -jag * 0.25
                row.append((d[0] * rx, d[1] * ry + 0.01, z))
            grid.append(row)
        # The last band of faces (the hem's points) is sun-bleached, as in the concept.
        return k.sheet(name, grid, M['cloak'], thickness=0.012, extra=[M['cloak_edge']], face_mat=lambda i, j: 1 if i == rows - 2 else 0)
    back = lambda phi: max(0.0, -math.cos(phi))   # 1 at the back
    sides = lambda phi: abs(math.sin(phi))         # 1 at the sides (over the arms)
    body_bones = ['Chest', 'Torso', 'Abdomen', 'Hips', 'UpperArm.L', 'UpperArm.R', 'UpperLeg.L', 'UpperLeg.R']
    # Lower tier: to mid-thigh at the back and front, shorter over the arms so the hands show.
    add(cloak('cloak', 1.33, (0.2, 0.14),
              hem=lambda phi: 0.62 + 0.1 * sides(phi) ** 2,
              r_hem=lambda phi: (0.32, 0.17 + 0.09 * back(phi)),
              jag=0.07, open_front=0.42, cols=30, rows=6, seed=3), body_bones)
    # Upper tier (the capelet): from the neck over the shoulders.
    add(cloak('capelet', 1.41, (0.095, 0.088),
              hem=lambda phi: 1.12 + 0.04 * sides(phi),
              r_hem=lambda phi: (0.285, 0.18 + 0.07 * back(phi)),
              jag=0.055, open_front=0.36, cols=24, rows=4, seed=5), ['Chest', 'Neck', 'Shoulder.L', 'Shoulder.R', 'UpperArm.L', 'UpperArm.R'])
    # The hood, gathered behind the neck.
    # A bigger head, as in the concept: everything on the Head bone, scaled about the top of the neck.
    k.scale_about(parts, 'Head', (0, HC[1], 1.44), 1.12)
    add(k.uvs('hood', (0, 0.1, 1.44), (0.12, 0.07, 0.065), M['cloak'], segs=8, rings=5), ['Chest', 'Neck'])
    return parts
