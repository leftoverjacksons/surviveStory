"""
Figure studio: re-proportion a rigged body and save it as a base body with its own build.

    python lab/figures/body.py <rigged.glb> <base build or .build.json> <factors.json> <name> <out.glb>

<rigged.glb> is rig.py's output (on the workshop skeleton of <base build>). <factors.json> holds the
new build's factors (lab/workshop/builds.json keys: spine, neck, upper_leg, ...). The mesh is reshaped
exactly as the studio's Proportions panel previews it (proportions.ts#reshape): every bone moves to its
joint in the new build and stretches along its own length (thickness across it), heads, hands and
feet scale whole; each vertex blends its bones by its weights. Then the skeleton is rebuilt as the new
build (kit.make_armature), so the game's clips and the parts made for that build fit, and the build is
added to builds.json as <name>.
"""
import bpy, json, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
SRC, BASE, FACTORS, NAME, OUT = argv[:5]
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'workshop'))
import kit  # noqa: E402

if BASE.endswith('.json'):  # the build the figure is rigged on (rig.py writes <out>.build.json)
    kit.BUILDS['base'] = {**kit.BUILDS['adult'], **json.load(open(BASE))}
    BASE = 'base'
new = {**kit.BUILDS[BASE], **json.load(open(FACTORS))}
kit.BUILDS[NAME] = new

def bones_of(build):
    kit.set_build(build)
    return {n: (Vector(h), Vector(t)) for n, h, t, _ in kit.BONES if n != 'Root'}
old_b, new_b = bones_of(BASE), bones_of(NAME)
ob_, nb_ = kit.BUILDS[BASE], new

# Per bone: (along-length ratio, across ratio) or ('u', uniform ratio). Kept in step with proportions.ts#BONE_RULES.
def rule(n):
    r = lambda k: nb_[k] / ob_[k]
    base = n.split('.')[0]
    if base in ('Hips', 'Abdomen', 'Torso', 'Chest'): return r('spine'), r('torso')
    if base == 'Neck': return r('neck'), 1.0
    if base == 'Head': return 'u', r('head')
    if base == 'Shoulder': return 1.0, 1.0
    if base == 'UpperArm': return r('upper_arm'), r('limb')
    if base == 'LowerArm': return r('lower_arm'), r('limb')
    if base == 'Wrist': return 'u', r('hand')
    if base == 'UpperLeg': return r('upper_leg'), r('limb')
    if base == 'LowerLeg': return r('lower_leg'), r('limb')
    if base == 'Foot': return 'u', r('foot')
    return 1.0, 1.0

def deform(n):
    h0, t0 = old_b[n]; h1, _ = new_b[n]
    a, c = rule(n)
    if a == 'u':
        A = Matrix.Identity(3) * c
    else:
        d = (t0 - h0).normalized()
        dd = Matrix(((d.x * d.x, d.x * d.y, d.x * d.z), (d.y * d.x, d.y * d.y, d.y * d.z), (d.z * d.x, d.z * d.y, d.z * d.z)))
        A = (Matrix.Identity(3) - dd) * c + dd * a
    return lambda p: h1 + A @ (p - h0)
D = {n: deform(n) for n in old_b}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
mw = mesh.matrix_world.copy()
mesh.parent = None; mesh.matrix_world = mw
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for m in list(mesh.modifiers): mesh.modifiers.remove(m)
for o in list(bpy.context.scene.objects):
    if o.type == 'ARMATURE': bpy.data.objects.remove(o)

gname = {g.index: g.name for g in mesh.vertex_groups}
moved = 0
for v in mesh.data.vertices:
    ws = [(gname[g.group], g.weight) for g in v.groups if g.weight > 0 and gname[g.group] in D]
    tot = sum(w for _, w in ws)
    if not tot: continue
    p = Vector(v.co)
    v.co = sum((D[n](p) * (w / tot) for n, w in ws), Vector())
    moved += 1
mesh.data.update()

kit.set_build(NAME)
rig = kit.make_armature()
rig.data.bones['Root'].use_deform = False
mesh.parent = rig
mod = mesh.modifiers.new('rig', 'ARMATURE'); mod.object = rig
mesh.name = 'figure'
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True); rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=False,
                          export_apply=False, export_yup=True, export_skins=True, export_morph=False,
                          export_materials='EXPORT', export_attributes=True)

# The build, for the workshop's parts and later bodies (kit.py reads builds.json).
p = os.path.join(HERE, '..', 'workshop', 'builds.json')
bj = json.load(open(p))
bj['builds'][NAME] = {**{k: round(v, 4) for k, v in new.items()}, '_doc': f'Saved from the figure studio (base {BASE}).'}
with open(p, 'w') as f:
    json.dump(bj, f, indent=1)
print(f'body {NAME}: {moved} vertices reshaped from {BASE}, skeleton rebuilt; build added to builds.json; wrote {OUT}')
