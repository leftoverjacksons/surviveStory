"""
Figure studio backend (standard library only). Holds the figures being worked
on (lab/figures/work/<id>/) and runs the pipeline one step at a time in a
single worker, since one GPU can take one job:

    generate  gen.py   image(s) → mesh.glb      (the generation environment)
    rig       rig.py   mesh → rigged.glb        (Blender: bpy, or blender -b)
    pack      pack.mjs rigged → packed.glb      (node, the repo's gltf-transform)

and moves finished figures into the studio's library (lab/figures/library/)
or, on request, into the game's figures (src/assets/people/).

    python lab/figures/server.py [--port 5180]

Paths to the environments come from lab/figures/config.json (written by
setup.py); see README.md.
"""
import base64, json, os, queue, re, shutil, subprocess, sys, threading, time, traceback
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
WORK = os.path.join(HERE, 'work')
LIB = os.path.join(HERE, 'library')
GAME = os.path.join(REPO, 'src', 'assets', 'people')
os.makedirs(WORK, exist_ok=True)
os.makedirs(LIB, exist_ok=True)
PORT = int(sys.argv[sys.argv.index('--port') + 1]) if '--port' in sys.argv else 5180

def venv_python(d):
    for p in (os.path.join(d, 'Scripts', 'python.exe'), os.path.join(d, 'bin', 'python')):
        if os.path.exists(p): return p
    return None

def load_config():
    c = {}
    p = os.path.join(HERE, 'config.json')
    if os.path.exists(p):
        with open(p) as f: c = json.load(f)
    c.setdefault('gen_python', venv_python(os.path.join(HERE, '.venv-gen')) or sys.executable)
    c.setdefault('hy3d_repo', os.path.join(HERE, '.hy3d'))
    c.setdefault('bpy_python', venv_python(os.path.join(HERE, '.venv-bpy')))
    c.setdefault('blender', None)  # a Blender executable, used if bpy_python is unset
    c.setdefault('node', 'node')
    return c
CFG = load_config()

# ---------------------------------------------------------------- figures on disk
def fdir(fid): return os.path.join(WORK, fid)
def meta_path(fid): return os.path.join(fdir(fid), 'meta.json')
lock = threading.Lock()

def read_meta(fid):
    with open(meta_path(fid)) as f: return json.load(f)

def write_meta(fid, **kw):
    with lock:
        m = read_meta(fid)
        m.update(kw)
        with open(meta_path(fid), 'w') as f: json.dump(m, f, indent=1)
        return m

def figures():
    out = []
    for fid in sorted(os.listdir(WORK), reverse=True):
        if os.path.exists(meta_path(fid)):
            m = read_meta(fid)
            m['files'] = sorted(os.listdir(fdir(fid)))
            sp = os.path.join(fdir(fid), 'slots.json')
            m['slots'] = json.load(open(sp)) if os.path.exists(sp) else []
            out.append(m)
    return out

SHEETS = os.path.join(WORK, '_sheets')  # (not a figure: figures() only lists dirs with a meta.json)

def sheets():
    out = []
    if os.path.isdir(SHEETS):
        for sid in sorted(os.listdir(SHEETS), reverse=True):
            p = os.path.join(SHEETS, sid, 'sheet.json')
            if os.path.exists(p):
                sh = json.load(open(p))
                ip = os.path.join(SHEETS, sid, 'items.json')
                if os.path.exists(ip):
                    sh['items'] = json.load(open(ip))['items']
                out.append(sh)
    return out

def write_sheet(sid, **kw):
    p = os.path.join(SHEETS, sid, 'sheet.json')
    with lock:
        sh = json.load(open(p)) if os.path.exists(p) else {}
        sh.update(kw)
        with open(p, 'w') as f: json.dump(sh, f, indent=1)

def split_sheet(sid):
    """Cut the sheet into items (intake.py, in the generation environment: it uses CLIP to guess categories)."""
    d = os.path.join(SHEETS, sid)
    sh = json.load(open(os.path.join(d, 'sheet.json')))
    write_sheet(sid, status='splitting', error=None)
    cmd = [CFG['gen_python'], os.path.join(HERE, 'intake.py'), os.path.join(d, sh['front']), d, '--gap', str(sh.get('gap', 1))]
    if sh.get('back'): cmd += ['--back', os.path.join(d, sh['back'])]
    with open(os.path.join(d, 'log.txt'), 'a', encoding='utf-8') as f:
        p = subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT, cwd=REPO, env={**os.environ, 'PYTHONUTF8': '1', 'PYTHONIOENCODING': 'utf-8'})
    if p.returncode:
        tail = open(os.path.join(d, 'log.txt'), encoding='utf-8', errors='replace').read().splitlines()[-6:]
        write_sheet(sid, status='error', error='splitting failed:\n' + '\n'.join(tail))
    else:
        write_sheet(sid, status='ready')

BUILDS_JSON = os.path.join(REPO, 'lab', 'workshop', 'builds.json')
BODIES = os.path.join(LIB, 'bodies')

def bodies():
    p = os.path.join(BODIES, 'bodies.json')
    return json.load(open(p)) if os.path.exists(p) else []

def library():
    p = os.path.join(LIB, 'library.json')
    return json.load(open(p)) if os.path.exists(p) else []

def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_') or 'figure'

# ---------------------------------------------------------------- jobs
jobs = queue.Queue()

def run(fid, step, cmd, env=None):
    log = os.path.join(fdir(fid), 'log.txt')
    with open(log, 'a', encoding='utf-8') as f:
        f.write(f'\n=== {step}: {" ".join(cmd)}\n'); f.flush()
        t = time.time()
        start = f.tell()
        # UTF-8 for every Python we start: on Windows, output redirected to a file is otherwise encoded in the
        # locale's code page (cp1252), and any character outside it (Δ, →, a non-English name) crashes the step.
        utf8 = {'PYTHONUTF8': '1', 'PYTHONIOENCODING': 'utf-8'}
        p = subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT, cwd=REPO, env={**os.environ, **utf8, **(env or {})})
        f.write(f'=== {step} exit {p.returncode} after {time.time() - t:.0f}s\n')
    if p.returncode != 0:
        # The step's last lines, so the error shows where it is reported (not only in the log).
        with open(log, encoding='utf-8', errors='replace') as f:
            f.seek(start)
            lines = [l.split('\r')[-1].rstrip() for l in f.read().splitlines()]
        tail = [l for l in lines if l.strip() and not l.startswith('===') and 'INFO' not in l][-8:]
        raise RuntimeError(f'{step} failed (exit {p.returncode}):\n' + '\n'.join(tail))

def step_generate(fid, m):
    d, prm = fdir(fid), m['params']
    cmd = [CFG['gen_python'], os.path.join(HERE, 'gen.py'), '--front', os.path.join(d, m['front']),
           '--out', os.path.join(d, 'mesh.glb'), '--cut', d, '--backend', prm.get('backend', 'local'),
           '--preset', prm.get('preset', 'turbo'), '--octree', str(prm.get('octree', 192)), '--seed', str(prm.get('seed', 1234))]
    if m.get('back'): cmd += ['--back', os.path.join(d, m['back'])]
    run(fid, 'generate', cmd, {'HY3D_REPO': CFG['hy3d_repo']})

def step_rig(fid, m):
    d, prm = fdir(fid), m['params']
    args = [os.path.join(d, 'mesh.glb'), os.path.join(d, 'front.png'), os.path.join(d, 'rigged.glb'),
            '--tris', str(prm.get('tris', 30000)), '--final', str(prm.get('final', 12000)), '--k', str(prm.get('k', 10)), '--slots', os.path.join(d, 'slots.json')]
    if os.path.exists(os.path.join(d, 'back.png')): args += ['--back', os.path.join(d, 'back.png')]
    if m.get('names'): args += ['--names', ','.join(f'{k}={v}' for k, v in m['names'].items())]
    args += ['--head', str(prm.get('head', 'keep')), '--hair', str(prm.get('hair', 'curly'))]
    args += ['--parts', os.path.join(d, 'parts.glb'), '--name', m['name']]  # the figure cut into library parts
    build = prm.get('build', 'hero')  # hero/stout/adult, auto (fitted to the mesh), or fit (the Proportions panel's fit.json)
    args += ['--build', os.path.join(d, 'fit.json') if build == 'fit' else build]
    if prm.get('cut', 'garments') == 'garments':  # garment labels from the cut-out(s) (labels.py); else by bones
        try:
            for view in ('front', 'back'):
                cut, lab = os.path.join(d, f'{view}.png'), os.path.join(d, f'labels_{view}.png')
                if os.path.exists(cut) and (not os.path.exists(lab) or os.path.getmtime(lab) < os.path.getmtime(cut)):
                    run(fid, f'labels ({view})', [CFG['gen_python'], os.path.join(HERE, 'labels.py'), cut, lab,
                                                  os.path.join(d, f'labels_{view}_vis.png')])
            args += ['--labels', os.path.join(d, 'labels_front.png')]
            if os.path.exists(os.path.join(d, 'labels_back.png')): args += ['--labels-back', os.path.join(d, 'labels_back.png')]
        except RuntimeError as e:  # e.g. the parser's first download failed: cut by bones this time
            with open(os.path.join(d, 'log.txt'), 'a', encoding='utf-8') as f: f.write(f'garment labels unavailable ({e}); cutting parts by bones\n')
    rig = os.path.join(HERE, 'rig.py')
    if CFG.get('bpy_python'): cmd = [CFG['bpy_python'], rig, *args]
    elif CFG.get('blender'): cmd = [CFG['blender'], '-b', '--factory-startup', '-P', rig, '--', *args]
    else: raise RuntimeError('no Blender: set bpy_python or blender in config.json')
    run(fid, 'rig', cmd)

def step_pack(fid, m):
    d = fdir(fid)
    run(fid, 'pack', [CFG['node'], os.path.join(HERE, 'pack.mjs'), os.path.join(d, 'rigged.glb'), '--out', os.path.join(d, 'packed.glb')])

def bpy_cmd(script, *args):
    if CFG.get('bpy_python'): return [CFG['bpy_python'], script, *args]
    if CFG.get('blender'): return [CFG['blender'], '-b', '--factory-startup', '-P', script, '--', *args]
    raise RuntimeError('no Blender: set bpy_python or blender in config.json')

def step_parts(fid, m):
    """File the figure's parts (rig.py --parts: head, top, bottom, feet, hands on the workshop's hero
    skeleton) in the parts library, and rebuild it (lab/workshop/build.py --parts), so they can be mixed
    with the workshop's parts in Compose."""
    src = os.path.join(fdir(fid), 'parts.glb')
    if not os.path.exists(src): raise RuntimeError('no parts yet: rig the figure again')
    os.makedirs(os.path.join(LIB, 'gen'), exist_ok=True)
    file = f"{slug(m['name']).replace('-', '_')}.hero.glb"
    shutil.copy(src, os.path.join(LIB, 'gen', file))
    write_meta(fid, parts=file)
    run(fid, 'parts', bpy_cmd(os.path.join(REPO, 'lab', 'workshop', 'build.py'), '--parts', '--build', 'hero'))

def step_body(fid, m):
    """Save the figure, re-proportioned (the Proportions panel's shape.json), as a base body with its own build
    (body.py), packed into library/bodies/."""
    d, req = fdir(fid), m.get('body_req') or {}
    name = slug(req.get('name') or m['name'])
    os.makedirs(BODIES, exist_ok=True)
    raw = os.path.join(d, f'body_{name}.glb')
    run(fid, 'body', bpy_cmd(os.path.join(HERE, 'body.py'), os.path.join(d, 'rigged.glb'), os.path.join(d, 'rigged.build.json'),
                             os.path.join(d, 'shape.json'), name, raw))
    run(fid, 'pack body', [CFG['node'], os.path.join(HERE, 'pack.mjs'), raw, '--out', os.path.join(BODIES, f'{name}.glb')])
    shutil.copy(os.path.join(d, 'front.png'), os.path.join(BODIES, f'{name}.png'))
    rest = [b for b in bodies() if b['name'] != name]
    rest.append({'name': name, 'file': f'bodies/{name}.glb', 'build': name, 'from': fid, 'added': time.strftime('%Y-%m-%d %H:%M')})
    with open(os.path.join(BODIES, 'bodies.json'), 'w') as f: json.dump(rest, f, indent=1)

def step_garment(fid, m):
    """A garment (or loose item) from a sheet: coloured from its front (and back) drawing, unrigged (garment.py)."""
    d = fdir(fid)
    cmd = [os.path.join(d, 'mesh.glb'), os.path.join(d, 'front.png'), os.path.join(d, 'garment.glb')]
    if os.path.exists(os.path.join(d, 'back.png')): cmd += ['--back', os.path.join(d, 'back.png')]
    run(fid, 'garment', bpy_cmd(os.path.join(HERE, 'garment.py'), *cmd))

STEPS = {'generate': step_generate, 'rig': step_rig, 'pack': step_pack, 'parts': step_parts, 'body': step_body, 'garment': step_garment}

def worker():
    while True:
        fid, steps = jobs.get()
        try:
            for s in steps:
                write_meta(fid, status=f'running {s}', error=None)
                STEPS[s](fid, read_meta(fid))
                write_meta(fid, done=sorted(set(read_meta(fid).get('done', [])) | {s}), stamp=time.time())
            write_meta(fid, status='ready')
        except Exception as e:
            traceback.print_exc()
            write_meta(fid, status='error', error=str(e))
threading.Thread(target=worker, daemon=True).start()

def enqueue(fid, steps):
    write_meta(fid, status='queued')
    jobs.put((fid, steps))

# ---------------------------------------------------------------- environment probe
ENV = {}
def probe():
    code = ('import json,torch;c=torch.cuda.is_available();'
            'print(json.dumps({"torch":torch.__version__,"cuda":c,'
            '"gpu":torch.cuda.get_device_name(0) if c else None,'
            '"vram":round(torch.cuda.get_device_properties(0).total_memory/2**30,1) if c else 0}))')
    try:
        out = subprocess.run([CFG['gen_python'], '-c', code], capture_output=True, text=True, timeout=120)
        ENV.update(json.loads(out.stdout.strip().splitlines()[-1]))
    except Exception as e:
        ENV.update(error=f'generation environment not usable: {e}')
    ENV['hy3d_repo'] = os.path.isdir(os.path.join(CFG['hy3d_repo'], 'hy3dgen'))
    ENV['blender'] = bool(CFG.get('bpy_python') or CFG.get('blender'))
    ENV['hf_token'] = bool(os.environ.get('HF_TOKEN'))
threading.Thread(target=probe, daemon=True).start()

# ---------------------------------------------------------------- HTTP
def save_data_url(url, path):
    head, b64 = url.split(',', 1)
    with open(path, 'wb') as f: f.write(base64.b64decode(b64))

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, code, body, ctype='application/json'):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'{}')

    def file(self, root, rel):
        p = os.path.normpath(os.path.join(root, unquote(rel)))
        if not p.startswith(root) or not os.path.isfile(p): return self.send(404, {'error': 'not found'})
        ctype = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
                 '.glb': 'model/gltf-binary', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8'}
        with open(p, 'rb') as f: self.send(200, f.read(), ctype.get(os.path.splitext(p)[1].lower(), 'application/octet-stream'))

    def do_GET(self):
        u = urlparse(self.path).path
        if u == '/api/state':
            return self.send(200, {'env': ENV, 'figures': figures(), 'library': library(), 'bodies': bodies(), 'sheets': sheets(), 'queue': jobs.qsize()})
        if u == '/api/builds':
            return self.send(200, json.load(open(BUILDS_JSON)))
        if u.startswith('/api/work/'): return self.file(WORK, u[len('/api/work/'):])
        if u.startswith('/api/library/'): return self.file(LIB, u[len('/api/library/'):])
        if u.startswith('/api/sheets/'): return self.file(SHEETS, u[len('/api/sheets/'):])
        self.send(404, {'error': 'not found'})

    def do_POST(self):
        u = urlparse(self.path).path.strip('/').split('/')
        try:
            b = self.body()
            if u == ['api', 'figures']:
                fid = time.strftime('%Y%m%d-%H%M%S') + '-' + slug(b.get('name', 'figure'))[:24]
                os.makedirs(fdir(fid))
                m = {'id': fid, 'name': b.get('name') or 'figure', 'body': b.get('body', 'man'),
                     'params': b.get('params', {}), 'created': time.time(), 'done': [], 'names': {}}
                ext = lambda url: '.' + url.split(';')[0].split('/')[-1].replace('jpeg', 'jpg')
                m['front'] = 'source_front' + ext(b['front'])
                save_data_url(b['front'], os.path.join(fdir(fid), m['front']))
                if b.get('back'):
                    m['back'] = 'source_back' + ext(b['back'])
                    save_data_url(b['back'], os.path.join(fdir(fid), m['back']))
                with open(meta_path(fid), 'w') as f: json.dump(m, f, indent=1)
                enqueue(fid, ['generate', 'rig', 'pack'])
                return self.send(200, {'id': fid})
            if u == ['api', 'sheets']:  # {name, front, back?}: a sheet of items to cut up
                sid = time.strftime('%Y%m%d-%H%M%S') + '-' + slug(b.get('name', 'sheet'))[:24]
                d = os.path.join(SHEETS, sid); os.makedirs(d)
                ext = lambda url: '.' + url.split(';')[0].split('/')[-1].replace('jpeg', 'jpg')
                sh = {'id': sid, 'name': b.get('name') or 'sheet', 'created': time.time(), 'gap': 1.0, 'made': {}}
                sh['front'] = 'sheet_front' + ext(b['front']); save_data_url(b['front'], os.path.join(d, sh['front']))
                if b.get('back'):
                    sh['back'] = 'sheet_back' + ext(b['back']); save_data_url(b['back'], os.path.join(d, sh['back']))
                with open(os.path.join(d, 'sheet.json'), 'w') as f: json.dump(sh, f, indent=1)
                threading.Thread(target=split_sheet, args=(sid,), daemon=True).start()
                return self.send(200, {'id': sid})
            if len(u) == 4 and u[:2] == ['api', 'sheets']:
                sid, act = u[2], u[3]
                d = os.path.join(SHEETS, sid)
                if not os.path.exists(os.path.join(d, 'sheet.json')): return self.send(404, {'error': 'no such sheet'})
                sh = json.load(open(os.path.join(d, 'sheet.json')))
                if act == 'split':  # {gap}: cut again with another separation
                    write_sheet(sid, gap=float(b.get('gap', 1)))
                    threading.Thread(target=split_sheet, args=(sid,), daemon=True).start()
                elif act == 'make':  # {items: [{index, category, name}], params}: a figure per chosen item
                    its = {i['index']: i for i in json.load(open(os.path.join(d, 'items.json')))['items']}
                    made = dict(sh.get('made', {}))
                    for want in b.get('items', []):
                        it = its.get(int(want['index']))
                        if not it: continue
                        cat = want.get('category') or it.get('guess') or 'other'
                        name = want.get('name') or f"{sh['name']} {cat}"
                        fid = time.strftime('%Y%m%d-%H%M%S') + f"-{int(want['index']):02d}-" + slug(name)[:20]
                        os.makedirs(fdir(fid))
                        kind = 'body' if cat == 'body' else 'garment'
                        params = {**b.get('params', {}), **({'build': 'auto', 'cut': 'bones'} if kind == 'body' else {})}
                        m = {'id': fid, 'name': name, 'body': 'man', 'kind': kind, 'category': cat, 'sheet': sid,
                             'params': params, 'created': time.time(), 'done': [], 'names': {}}
                        m['front'] = 'source_front.png'; shutil.copy(os.path.join(d, it['front']), os.path.join(fdir(fid), m['front']))
                        if it.get('back'):
                            m['back'] = 'source_back.png'; shutil.copy(os.path.join(d, it['back']), os.path.join(fdir(fid), m['back']))
                        with open(meta_path(fid), 'w') as f: json.dump(m, f, indent=1)
                        enqueue(fid, ['generate', 'rig', 'pack'] if kind == 'body' else ['generate', 'garment'])
                        made[str(want['index'])] = fid
                    write_sheet(sid, made=made)
                elif act == 'delete':
                    shutil.rmtree(d)
                else:
                    return self.send(404, {'error': 'unknown action'})
                return self.send(200, {'ok': True})
            if len(u) == 4 and u[:2] == ['api', 'figures']:
                fid, act = u[2], u[3]
                if not os.path.exists(meta_path(fid)): return self.send(404, {'error': 'no such figure'})
                m = read_meta(fid)
                if act == 'run':  # {steps: [...], params: {...}}
                    write_meta(fid, params={**m['params'], **b.get('params', {})})
                    enqueue(fid, [s for s in b.get('steps', ['generate', 'rig', 'pack']) if s in STEPS])
                elif act == 'names':  # {names: {index: name}} → re-colour
                    write_meta(fid, names=b.get('names', {}))
                    enqueue(fid, ['rig', 'pack'])
                elif act == 'fit':  # {factors}: the skeleton placed in the Proportions panel → rig on it
                    with open(os.path.join(fdir(fid), 'fit.json'), 'w') as f: json.dump(b.get('factors', {}), f, indent=1)
                    write_meta(fid, params={**m['params'], 'build': 'fit'})
                    enqueue(fid, ['rig', 'pack'])
                elif act == 'body':  # {name, factors}: save as a base body (re-proportioned) in library/bodies
                    with open(os.path.join(fdir(fid), 'shape.json'), 'w') as f: json.dump(b.get('factors', {}), f, indent=1)
                    write_meta(fid, body_req={'name': b.get('name') or m['name']})
                    enqueue(fid, ['body'])
                elif act == 'edit':  # {name, body}
                    write_meta(fid, **{k: b[k] for k in ('name', 'body') if k in b})
                elif act == 'library':
                    src = os.path.join(fdir(fid), 'packed.glb')
                    if not os.path.exists(src): return self.send(400, {'error': 'not packed yet'})
                    file = f"{m['body']}_{slug(m['name'])}.glb"
                    shutil.copy(src, os.path.join(LIB, file))
                    shutil.copy(os.path.join(fdir(fid), 'front.png'), os.path.join(LIB, file.replace('.glb', '.png')))
                    lib = [e for e in library() if e['file'] != file]
                    lib.append({'file': file, 'name': m['name'], 'body': m['body'], 'from': fid,
                                'generator': 'hunyuan3d-2 (' + m['params'].get('backend', 'local') + ')',
                                'licence': 'Tencent Hunyuan 3D community licence: not for the EU, UK or South Korea; prototype only',
                                'added': time.strftime('%Y-%m-%d %H:%M')})
                    with open(os.path.join(LIB, 'library.json'), 'w') as f: json.dump(lib, f, indent=1)
                    write_meta(fid, library=file)
                elif act == 'game':
                    file = m.get('library')
                    if not file: return self.send(400, {'error': 'add it to the library first'})
                    shutil.copy(os.path.join(LIB, file), os.path.join(GAME, file))
                    write_meta(fid, game=file)
                elif act == 'delete':
                    shutil.rmtree(fdir(fid))
                else:
                    return self.send(404, {'error': 'unknown action'})
                return self.send(200, {'ok': True})
            if u == ['api', 'library', 'remove']:  # {file, game: bool}
                file = os.path.basename(b['file'])
                for p in [os.path.join(LIB, file), os.path.join(LIB, file.replace('.glb', '.png'))] + ([os.path.join(GAME, file)] if b.get('game') else []):
                    if os.path.exists(p): os.remove(p)
                rest = [e for e in library() if e['file'] != file]  # read before opening for writing (which empties the file)
                with open(os.path.join(LIB, 'library.json'), 'w') as f: json.dump(rest, f, indent=1)
                for m in figures():  # the source figure is no longer in the library (or the game)
                    if m.get('library') == file:
                        write_meta(m['id'], library=None, **({'game': None} if b.get('game') else {}))
                return self.send(200, {'ok': True})
            self.send(404, {'error': 'not found'})
        except Exception as e:
            traceback.print_exc()
            self.send(500, {'error': str(e)})

# Anything left mid-run when the server stopped is queued again.
for m in figures():
    if m.get('status', '').startswith(('running', 'queued')):
        chain = ('generate', 'garment') if m.get('kind') == 'garment' else ('generate', 'rig', 'pack')
        enqueue(m['id'], [s for s in chain if s not in m.get('done', [])] or [chain[-1]])

print(f'figure studio backend on http://localhost:{PORT} (work: {WORK})', flush=True)
ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
