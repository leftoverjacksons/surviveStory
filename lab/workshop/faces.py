"""
Heads and faces: a sculpted skull and features placed on its surface, from a
few numbers per face (FACES). parts.py registers each as a `head.<name>` part.

The skull is built from profiles (half-width, face depth and back depth over
height: temples, cranium, occiput, nape, cheekbones, jaw corner, chin), each
slice a superellipse, then cut into small facets. `skull_point` gives the same
shape for hair caps, so hair follows the skull. Features (eyes, brows, nose, mouth, ears,
cheeks, lines) are found by casting a ray at the skull from the front, so they
sit on whichever shape the face has. Every head keeps the same crown, so any
hair fits any head.

Colour slots: `skin` (re-coloured per survivor), `skin_blush`, `skin_lip` and
`skin_shade` (the game derives them from the survivor's skin), `eye` (kept
dark), `eye_white` (kept), `hair` (brows follow the hair colour).
"""
import math
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

# Every number is in head radii (the skull is about 2 × 2 × 2 of them).
BASE = dict(
    wide=1.0,        # skull width
    jaw=0.2,         # how much the lower face narrows (0 square, 0.35 pointed)
    chin=0.0,        # chin length, down
    chin_fwd=0.0,    # chin forward
    cheek=0.05,      # cheek fullness (negative: hollow)
    brow_ridge=0.02,
    flat=0.12,       # flatter face plane
    eye=1.0, eye_x=0.4, eye_z=-0.04, eye_tilt=0.0, lash=0.0, bags=0.0,
    brow=1.0, brow_tilt=0.0, brow_z=0.3,
    nose='button', nose_size=1.0, nose_len=1.0, nose_z=-0.26,
    mouth_w=0.24, smile=0.04, mouth_z=-0.52, lip=0.0,
    blush=0.0, lines=0.0, ear=1.0,
)

FACES = {
    # The concept's young face: big eyes, button nose, a small smile, rosy cheeks.
    'face': dict(blush=1.0),
    # Rounder and softer: full cheeks, small chin, lashes, fuller lips.
    'soft': dict(jaw=0.26, cheek=0.1, eye=1.06, lash=1.0, brow=0.75, brow_tilt=0.06, nose_size=0.85, mouth_w=0.2,
                 smile=0.05, lip=1.0, blush=1.0),
    # Square and strong: wide jaw, heavy brows, broad nose, straight mouth.
    'broad': dict(wide=1.05, jaw=0.06, chin=0.05, chin_fwd=0.04, cheek=0.0, brow_ridge=0.07, eye=0.86, eye_z=-0.07, brow=1.4,
                  brow_tilt=-0.06, brow_z=0.25, nose='broad', nose_size=1.15, mouth_w=0.27, smile=0.0),
    # Long and narrow: longer jaw and nose, narrower eyes.
    'long': dict(wide=0.93, jaw=0.24, chin=0.1, chin_fwd=0.02, cheek=-0.02, eye=0.88, eye_x=0.37, brow=1.1,
                 nose='long', nose_size=1.0, nose_len=1.15, nose_z=-0.28, mouth_w=0.21, smile=0.02, mouth_z=-0.56),
    # Old: hollow cheeks, bags, smaller eyes, a long drooping nose, big ears, lines.
    'elder': dict(jaw=0.22, chin=0.06, cheek=-0.07, brow_ridge=0.06, eye=0.78, eye_z=-0.07, bags=1.0, brow=1.3,
                  brow_tilt=0.08, brow_z=0.24, nose='hook', nose_size=1.1, nose_len=1.35, mouth_w=0.22, smile=-0.01,
                  mouth_z=-0.56, lines=1.0, ear=1.25),
}

lerp = lambda a, b, t: a + (b - a) * t
smooth = lambda t: (lambda u: u * u * (3 - 2 * u))(min(1.0, max(0.0, t)))


def table(pts, z):
    """Piecewise-smooth interpolation through (z, value) points (z ascending)."""
    if z <= pts[0][0]:
        return pts[0][1]
    for (z0, v0), (z1, v1) in zip(pts, pts[1:]):
        if z <= z1:
            return lerp(v0, v1, smooth((z - z0) / (z1 - z0)))
    return pts[-1][1]


def profiles(s):
    """The skull as three profiles over height z (-1 chin … 1 crown), in head radii, before the
    sphere envelope: half-width, depth in front (the face) and depth behind (the back of the skull)."""
    j, ch, br, wd = s['jaw'], s['cheek'], s['brow_ridge'], s['wide']
    W = [(-1, 0.66 - j * 0.4), (-0.9, 0.73 - j * 0.5), (-0.72, 0.84 - j * 0.55), (-0.5, 0.92 - j * 0.4),
         (-0.25, 0.97 + ch * 0.7), (0.05, 0.96), (0.35, 1.03), (0.7, 1.02), (1, 1.0)]
    # Depths are divided by the envelope later, so these keep the face plane near vertical from the
    # forehead to the mouth, then a chin, with a shallow dip at the eyes.
    F = [(-1, 0.95 + s['chin_fwd']), (-0.8, 1.12 + s['chin_fwd']), (-0.55, 1.1), (-0.3, 1.03 + ch * 0.5),
         (-0.02, 0.97), (0.2, 1.03 + br), (0.5, 1.04), (0.8, 1.0), (1, 1.0)]
    # Behind: the back of the skull reaches well past the neck, then the nape tucks in.
    B = [(-1, 0.5), (-0.65, 0.62), (-0.35, 0.82), (0.05, 1.12), (0.4, 1.12), (0.8, 1.02), (1, 1.0)]
    return [(z, v * wd) for z, v in W], F, B


def shape(x, y, z, s, P):
    """A unit-sphere point (y negative = the face) → this face's skull. Each horizontal slice is a
    superellipse (squarer than a circle: flat temples and a face plane) whose half-width and front and
    back depths follow the profiles; the envelope (1 - z²)^0.42 is fuller than a sphere's toward the
    crown and the jaw. The chin then reaches down on the front."""
    W, F, B = P
    h = math.hypot(x, y)
    env = max(0.0, 1 - z * z) ** 0.42
    if h > 1e-6:
        cx, cy = x / h, y / h
        w = table(W, z)
        d = table(F, z) if cy < 0 else table(B, z)
        p = 2.3 + s['flat'] * 3 if cy < 0 else 2.2
        r = ((abs(cx) / w) ** p + (abs(cy) / d) ** p) ** (-1 / p)
        x, y = cx * r * env, cy * r * env
    if z < -0.3 and y < 0:  # the chin: longer on the front only
        z -= s['chin'] * smooth((-z - 0.3) / 0.6) * smooth(-y / max(env, 1e-3) * 1.5)
    return x, y, z


def skull_point(d, s=None):
    """A unit direction → the point on a skull (head radii from the centre); the plain face by default."""
    s = {**BASE, **(s or {})}
    return shape(*Vector(d).normalized(), s, profiles(s))


class Face:
    def __init__(self, c, s, keep=0.36):
        self.c, self.k, self.s = c, c.k, s
        k, HC, HR = c.k, c.HC, c.HR
        R = (HR[0] * 1.04, HR[1] * 1.04, HR[2] * 1.02)
        self.R = R
        head = k.ico('head', (0, 0, 0), (1, 1, 1), c.m('skin'), subdiv=3)
        P = profiles(s)
        for v in head.data.vertices:
            x, y, z = shape(*v.co.normalized(), s, P)
            v.co = Vector((HC.x + x * R[0], HC.y + y * R[1], HC.z + z * R[2]))
        d = head.modifiers.new('dec', 'DECIMATE'); d.ratio = keep
        k.apply_modifiers(head)
        me = head.data
        self.bvh = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
        c.add(head, 'Head')

    def at(self, x, z):
        """The skull's surface in front of (x, z) (head radii): (point, outward normal)."""
        c = self.c
        o = Vector((c.HC.x + x * self.R[0], c.HC.y - 3 * self.R[1], c.HC.z + z * self.R[2]))
        hit, _n, _i, _d = self.bvh.ray_cast(o, Vector((0, 1, 0)))
        if hit is None:
            hit = o + Vector((0, 2.2 * self.R[1], 0))
        # Orientation from the smooth ellipsoid (the facets' own normals would jitter features).
        ux, uy, uz = (hit.x - c.HC.x) / self.R[0], (hit.y - c.HC.y) / self.R[1], (hit.z - c.HC.z) / self.R[2]
        n = Vector((ux / self.R[0], uy / self.R[1], uz / self.R[2])).normalized()
        return hit, n

    def side(self, y, z):
        """The skull's surface on its left side (+x) at (y, z) in head radii."""
        c = self.c
        o = Vector((c.HC.x + 3 * self.R[0], c.HC.y + y * self.R[1], c.HC.z + z * self.R[2]))
        hit = self.bvh.ray_cast(o, Vector((-1, 0, 0)))[0]
        return hit if hit is not None else o - Vector((2.0 * self.R[0], 0, 0))

    def place(self, ob, at, n, spin=0.0, sink=0.0):
        """ob was built at the origin facing -y (z up): turn it to face n, sit it at `at`."""
        f = n.normalized()
        up = Vector((0, 0, 1))
        zax = (up - f * up.dot(f)).normalized()
        yax = -f
        xax = yax.cross(zax)
        M = Matrix((xax, yax, zax)).transposed() @ Matrix.Rotation(spin, 3, 'Y')
        for v in ob.data.vertices:
            v.co = M @ v.co + at - f * sink
        self.k.fix_normals(ob)
        return ob

    def onface(self, ob, x, z, lift=0.0, spin=0.0):
        p, n = self.at(x, z)
        return self.place(ob, p + n * lift, n, spin)

    def strip(self, name, pts, radii, slot, lift, segs=4):
        """A tapered tube along the surface through (x, z) points, raised by `lift` (m)."""
        path = []
        for x, z in pts:
            p, n = self.at(x, z)
            path.append(p + n * lift)
        return self.k.tube(name, path, radii, self.c.m(slot), segs=segs)


def build(c, s):
    s = {**BASE, **s}
    k, HR = c.k, c.HR
    r = HR[0]  # the unit for feature sizes
    f = Face(c, s)
    m = c.m

    # ---- eyes: a dark oval with a glint, a little white, a lid line; lashes, bags
    e = s['eye']
    def eye():
        parts = []
        ex, ez = s['eye_x'], s['eye_z']
        sc = k.uvs('eyewhite', (0, 0, 0), (0.23 * r * e, 0.05 * r, 0.21 * r * e), m('eye_white'), segs=8, rings=4)
        parts.append(f.onface(sc, ex, ez, lift=0.004 * r, spin=s['eye_tilt']))
        ir = k.uvs('iris', (0, 0, 0), (0.17 * r * e, 0.05 * r, 0.19 * r * e), m('eye'), segs=8, rings=4)
        parts.append(f.onface(ir, ex - 0.02, ez - 0.01, lift=0.03 * r))
        gl = k.uvs('glint', (0, 0, 0), (0.055 * r * e, 0.02 * r, 0.055 * r * e), m('eye_white'), segs=5, rings=3)
        parts.append(f.onface(gl, ex + 0.05 * e, ez + 0.07 * e, lift=0.07 * r))
        # Upper lid: a dark arc over the eye, flicking out at the corner when there are lashes.
        lx = 0.27 * e
        pts = [(ex - lx, ez + 0.05 * e), (ex - 0.1 * e, ez + 0.17 * e), (ex + 0.1 * e, ez + 0.18 * e), (ex + lx, ez + 0.07 * e + 0.08 * s['lash'])]
        lid = f.strip('lid', pts, [0.02 * r, 0.035 * r, 0.035 * r, (0.02 + 0.025 * s['lash']) * r], 'eye', lift=0.035 * r)
        parts.append(lid)
        if s['bags']:
            bag = f.strip('bag', [(ex - 0.2 * e, ez - 0.2 * e), (ex, ez - 0.27 * e), (ex + 0.22 * e, ez - 0.2 * e)],
                          [0.02 * r, 0.035 * r, 0.02 * r], 'skin_shade', lift=0.015 * r)
            parts.append(bag)
        return parts
    for ob in eye():
        c.add(ob, 'Head')
        c.add(k.mirrored(ob), 'Head')

    # ---- brows: tapered strips in the hair colour
    b = s['brow']
    for side in (1, -1):
        bx, bz, t = s['eye_x'] * side, s['brow_z'] + s['eye_z'] * 0.5, s['brow_tilt']
        pts = [(bx - 0.22 * side, bz - 0.02 + t), (bx, bz + 0.04), (bx + 0.24 * side, bz - 0.02 - t)]
        c.add(f.strip('brow', pts, [0.05 * r * b, 0.065 * r * b, 0.035 * r * b], 'hair', lift=0.03 * r), 'Head')

    # ---- nose
    ns, nl, nz = s['nose_size'], s['nose_len'], s['nose_z']
    tip_p, tip_n = f.at(0, nz)
    if s['nose'] in ('button', 'broad'):
        w = 0.15 if s['nose'] == 'button' else 0.21
        tip = k.ico('nose', (0, 0, 0), (w * r * ns, 0.1 * r * ns * nl, 0.12 * r * ns), m('skin'), subdiv=1)
        c.add(f.place(tip, tip_p + tip_n * 0.05 * r * ns * nl, tip_n), 'Head')
        if s['nose'] == 'broad':  # wings
            for side in (1, -1):
                c.add(f.onface(k.ico('nostril', (0, 0, 0), (0.08 * r, 0.06 * r, 0.07 * r), m('skin'), subdiv=1), 0.13 * side, nz - 0.05, lift=0.02 * r), 'Head')
    else:
        # A ridge from between the eyes to a tip; 'hook' droops at the end.
        hook = s['nose'] == 'hook'
        root, rn = f.at(0, s['eye_z'] + 0.02)
        out = 0.17 * r * nl * ns
        tip = tip_p + tip_n * out + Vector((0, 0, (-0.05 if hook else 0.0) * r * nl))
        mid = lerp(root + rn * 0.02 * r, tip, 0.55) + Vector((0, -0.03 * r * (1 if hook else 0.4), 0))
        c.add(k.tube('bridge', [root + rn * 0.01 * r, mid, tip], [(0.07 * r * ns, 0.05 * r), (0.09 * r * ns, 0.08 * r), (0.11 * r * ns, 0.09 * r)], m('skin'), segs=5), 'Head')
        c.add(f.place(k.ico('tip', (0, 0, 0), (0.12 * r * ns, 0.09 * r, 0.1 * r * ns), m('skin'), subdiv=1), tip, tip_n), 'Head')

    # ---- mouth: a dark line that turns up at the ends (a smile), and a lower lip when asked
    mw, sm, mz = s['mouth_w'], s['smile'], s['mouth_z']
    pts = [(-mw, mz + sm * 1.6), (-mw * 0.5, mz + sm * 0.2), (0, mz), (mw * 0.5, mz + sm * 0.2), (mw, mz + sm * 1.6)]
    c.add(f.strip('mouth', pts, [0.018 * r, 0.03 * r, 0.032 * r, 0.03 * r, 0.018 * r], 'eye', lift=0.008 * r), 'Head')
    if s['lip']:
        lip = k.uvs('lip', (0, 0, 0), (mw * 0.55 * r, 0.04 * r, 0.06 * r), m('skin_lip'), segs=8, rings=4)
        c.add(f.onface(lip, 0, mz - 0.08, lift=0.0), 'Head')

    # ---- cheeks (a blush), lines for age
    if s['blush']:
        for side in (1, -1):
            bl = k.uvs('blush', (0, 0, 0), (0.17 * r, 0.03 * r, 0.11 * r), m('skin_blush'), segs=8, rings=4)
            c.add(f.onface(bl, 0.55 * side, -0.3, lift=0.0), 'Head')
    if s['lines']:
        for side in (1, -1):  # nose to mouth corners, and one across the brow
            pts = [(0.17 * side, nz - 0.02), (0.25 * side, mz + 0.05), (0.29 * side, mz - 0.1)]
            c.add(f.strip('fold', pts, [0.015 * r, 0.03 * r, 0.015 * r], 'skin_shade', lift=0.012 * r), 'Head')
        c.add(f.strip('forehead', [(-0.3, 0.55), (0, 0.6), (0.3, 0.55)], [0.012 * r, 0.025 * r, 0.012 * r], 'skin_shade', lift=0.008 * r), 'Head')

    # ---- ears: a flattened shell, tilted back, with a shaded hollow
    ea = s['ear']
    def ear():
        at = f.side(0.1, -0.1) + Vector((-0.02 * r, 0, 0))
        side = Vector((1, 0.25, 0)).normalized()
        shell = k.uvs('ear', (0, 0, 0), (0.17 * r * ea, 0.07 * r, 0.27 * r * ea), m('skin'), segs=6, rings=4)
        f.place(shell, at, side)
        hollow = k.uvs('earhollow', (0, 0, 0), (0.09 * r * ea, 0.03 * r, 0.16 * r * ea), m('skin_shade'), segs=6, rings=3)
        f.place(hollow, at + side * 0.045 * r, side)
        return [shell, hollow]
    for ob in ear():
        c.add(ob, 'Head')
        c.add(k.mirrored(ob), 'Head')
    return c.out
