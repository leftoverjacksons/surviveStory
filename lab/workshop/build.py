"""
Character workshop: build characters from recipes (recipes.py) out of parts
(parts.py) on the game's skeleton, and file them in the figure studio's library
(lab/figures/library/).

    python lab/workshop/build.py <recipe>...        a whole character per recipe → <pool>_<recipe>.glb
    python lab/workshop/build.py --parts [--build hero] [--game]
        every part as its own skinned mesh on one skeleton → parts_<build>.glb and
        parts_<build>.json (categories, parts, colour slots, and the recipes), for
        composing survivors at run time (the studio's Compose view); --game also copies
        the .glb into src/assets/people/parts/, where the game dresses survivors from it

(with Blender's Python module, bpy: lab/figures/.venv-bpy after setup.py, or
`blender -b -P lab/workshop/build.py -- <args>`).
"""
import json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
LIB = os.path.join(REPO, 'lab', 'figures', 'library')
WORK = os.path.join(HERE, 'work')
sys.path.insert(0, HERE)
import bpy  # noqa: E402
import kit  # noqa: E402
from parts import PARTS, DEFAULTS  # noqa: E402
from recipes import RECIPES  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
os.makedirs(WORK, exist_ok=True); os.makedirs(LIB, exist_ok=True)

def pack(src, dst):
    subprocess.check_call(['node', os.path.join(REPO, 'lab', 'figures', 'pack.mjs'), src, '--out', dst], cwd=REPO)

def file_in_library(file, entry):
    p = os.path.join(LIB, 'library.json')
    lib = json.load(open(p)) if os.path.exists(p) else []
    lib = [e for e in lib if e['file'] != file] + [dict(file=file, added=time.strftime('%Y-%m-%d %H:%M'), **entry)]
    with open(p, 'w') as f:
        json.dump(lib, f, indent=1)

if '--parts' in argv:
    # ------------------------------------------------ the parts library
    build = argv[argv.index('--build') + 1] if '--build' in argv else 'hero'
    kit.clear(); kit.set_build(build)
    rig = kit.make_armature()
    meshes, manifest = [], {'build': build, 'parts': {}, 'recipes': RECIPES, 'defaults': DEFAULTS}
    for name, fn in PARTS.items():
        parts = fn(kit, DEFAULTS)
        ob = kit.skin_to(rig, name, parts)
        meshes.append(ob)
        manifest['parts'][name] = {'category': name.split('.')[0], 'slots': [m.name for m in ob.data.materials], 'triangles': kit.triangles(ob)}
        print(f'{name:28s} {kit.triangles(ob):5d} triangles  {[m.name for m in ob.data.materials]}')
    # Parts cut from generated figures (figure studio: rig.py --parts, filed by "Add parts to library"),
    # rigged on this build's skeleton, so they mix with the workshop's parts: lab/figures/library/gen/*.<build>.glb
    import glob
    for f in sorted(glob.glob(os.path.join(LIB, 'gen', f'*.{build}.glb'))):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=f)
        new = [o for o in bpy.data.objects if o not in before]
        for ob in [o for o in new if o.type == 'MESH']:
            mw = ob.matrix_world.copy()
            ob.parent = None
            ob.matrix_world = mw
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            for m in list(ob.modifiers): ob.modifiers.remove(m)
            mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = rig
            ob.parent = rig
            name = ob.name.split('.0')[0] if '.0' in ob.name[-4:] else ob.name  # (Blender's .001 suffixes)
            ob.name = name
            meshes.append(ob)
            manifest['parts'][name] = {'category': name.split('.')[0], 'slots': [m.name for m in ob.data.materials],
                                       'triangles': kit.triangles(ob), 'generated': os.path.basename(f)}
            print(f'{name:28s} {kit.triangles(ob):5d} triangles  (generated: {os.path.basename(f)})')
        for o in new:
            if o.type != 'MESH': bpy.data.objects.remove(o)
    raw = os.path.join(WORK, f'parts_{build}.glb')
    kit.export_many(raw, rig, meshes)
    pack(raw, os.path.join(LIB, f'parts_{build}.glb'))
    with open(os.path.join(LIB, f'parts_{build}.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    print('parts library:', f'parts_{build}.glb', len(meshes), 'parts')
    if '--game' in argv:
        import shutil
        game = os.path.join(REPO, 'src', 'assets', 'people', 'parts')
        os.makedirs(game, exist_ok=True)
        shutil.copy(os.path.join(LIB, f'parts_{build}.glb'), game)
        print('game:', os.path.join('src/assets/people/parts', f'parts_{build}.glb'))
else:
    # ------------------------------------------------ whole characters
    for name in argv:
        r = RECIPES[name]
        kit.clear(); kit.set_build(r['build'])
        pal = {**DEFAULTS, **r['palette']}
        parts = []
        for slot, pname in r['parts'].items():
            parts += PARTS[pname](kit, pal)
        rig, ob = kit.assemble(name, parts)
        print(f'{name}: {len(parts)} pieces, {kit.triangles(ob)} triangles, slots {[m.name for m in ob.data.materials]}')
        raw = os.path.join(WORK, f'{name}.glb')
        kit.export(raw, rig, ob)
        file = f"{r['pool']}_{name}.glb"
        pack(raw, os.path.join(LIB, file))
        file_in_library(file, dict(name=name.replace('_', ' '), body=r['pool'], build=r['build'], recipe=name,
                                   generator='workshop (Blender, parts + recipe)', licence='own work', triangles=kit.triangles(ob)))
        print('library:', file)
