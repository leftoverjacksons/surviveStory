"""
Character workshop: build characters from recipes (recipes.py) out of parts
(parts.py) on the game's skeleton, and file them in the figure studio's library
(lab/figures/library/).

    python lab/workshop/build.py <recipe>...        a whole character per recipe → <pool>_<recipe>.glb
    python lab/workshop/build.py --parts [--build hero]
        every part as its own skinned mesh on one skeleton → parts_<build>.glb and
        parts_<build>.json (categories, parts, colour slots, and the recipes), for
        composing survivors at run time (the studio's Compose view)

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
    raw = os.path.join(WORK, f'parts_{build}.glb')
    kit.export_many(raw, rig, meshes)
    pack(raw, os.path.join(LIB, f'parts_{build}.glb'))
    with open(os.path.join(LIB, f'parts_{build}.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    print('parts library:', f'parts_{build}.glb', len(meshes), 'parts')
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
