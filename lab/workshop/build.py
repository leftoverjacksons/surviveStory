"""
Character workshop: build a character authored in code (characters/<name>.py)
on the game's skeleton, pack it like the game's figures, and file it in the
figure studio's library (lab/figures/library/), where the studio shows it
beside the current figures and can send it to the game.

    python lab/workshop/build.py <name> [--no-library] [--out <rigged.glb>]

(with Blender's Python module, bpy: lab/figures/.venv-bpy after setup.py, or
`blender -b -P lab/workshop/build.py -- <name>`).
"""
import importlib.util, json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
LIB = os.path.join(REPO, 'lab', 'figures', 'library')
sys.path.insert(0, HERE)
import kit  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
name = argv[0]
spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, 'characters', f'{name}.py'))
char = importlib.util.module_from_spec(spec); spec.loader.exec_module(char)
work = os.path.join(HERE, 'work'); os.makedirs(work, exist_ok=True)
rigged = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(work, f'{name}.glb')

kit.clear()
parts = char.build(kit)
rig, ob = kit.assemble(name, parts)
slots = [m.name for m in ob.data.materials]
print(f'{name}: {len(parts)} parts, {kit.triangles(ob)} triangles, slots {slots}')
kit.export(rigged, rig, ob)
print('wrote', rigged)

if '--no-library' not in argv:
    os.makedirs(LIB, exist_ok=True)
    file = f'{char.BODY}_{name}.glb'
    subprocess.check_call(['node', os.path.join(REPO, 'lab', 'figures', 'pack.mjs'), rigged, '--out', os.path.join(LIB, file)], cwd=REPO)
    p = os.path.join(LIB, 'library.json')
    lib = json.load(open(p)) if os.path.exists(p) else []
    lib = [e for e in lib if e['file'] != file]
    lib.append({'file': file, 'name': name.replace('_', ' '), 'body': char.BODY, 'from': f'lab/workshop/characters/{name}.py',
                'generator': 'workshop (Blender, authored in code)', 'licence': 'own work',
                'triangles': kit.triangles(ob), 'added': time.strftime('%Y-%m-%d %H:%M')})
    with open(p, 'w') as f:
        json.dump(lib, f, indent=1)
    print('library:', file)
