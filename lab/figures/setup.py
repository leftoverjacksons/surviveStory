"""
Set up the figure studio on this machine (Windows, Linux or macOS).

    python lab/figures/setup.py --backend triposr   (default; local image-to-3D)
    python lab/figures/setup.py --backend import    (GLBs from another machine)
    python lab/figures/setup.py --backend hunyuan   (legacy prototype backend)
    Add --cpu to avoid CUDA. Python 3.10–3.12; 3.11 also installs Blender's module.

Creates, inside lab/figures/ (all git-ignored):
  .venv-triposr, .triposr   TripoSR environment and upstream checkout
  .venv-import             Pillow and background removal only
  .venv-gen   PyTorch (CUDA 12.4 build when an NVIDIA GPU is found, else CPU)
              plus the Hunyuan3D shape-generation dependencies and gradio_client
  .hy3d       a clone of Tencent-Hunyuan/Hunyuan3D-2 (the shape pipeline's code)
  .venv-bpy   Blender as a Python module (bpy), for rigging, only on Python 3.11;
              otherwise an installed Blender is looked for and used instead
  config.json the paths the studio's server uses

Model weights (about 2–7 GB) download on the first figure, into the
Hugging Face cache. Then: npm run figures, and open http://localhost:5181/.
"""
import argparse, json, os, platform, shutil, subprocess, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
WIN = platform.system() == 'Windows'
CPU = '--cpu' in sys.argv
parser = argparse.ArgumentParser(description='Install one Figure Studio backend in its own environment')
parser.add_argument('--backend', choices=['triposr', 'import', 'hunyuan'], default='triposr')
parser.add_argument('--cpu', action='store_true')
options = parser.parse_args()
config_path = os.path.join(HERE, 'config.json')
cfg = json.load(open(config_path)) if os.path.exists(config_path) else {'node': 'node'}

def sh(*cmd, **kw):
    print('>', ' '.join(cmd), flush=True)
    subprocess.check_call(list(cmd), **kw)

def venv(name):
    d = os.path.join(HERE, name)
    if not os.path.exists(d):
        sh(sys.executable, '-m', 'venv', d)
    py = os.path.join(d, 'Scripts', 'python.exe') if WIN else os.path.join(d, 'bin', 'python')
    sh(py, '-m', 'pip', 'install', '-q', '--upgrade', 'pip')
    return py

v = sys.version_info
if not ((3, 10) <= (v.major, v.minor) <= (3, 12)):
    sys.exit(f'Python {v.major}.{v.minor}: use 3.10–3.12 (3.11 is best: Blender\'s module needs it).')

# ---------------------------------------------------------------- generation environment
gpu = False
if not CPU and shutil.which('nvidia-smi'):
    try:
        out = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], capture_output=True, text=True).stdout.strip()
        print('NVIDIA GPU:', out)
        gpu = bool(out)
    except Exception:
        pass
gen = venv({'triposr': '.venv-triposr', 'import': '.venv-import', 'hunyuan': '.venv-gen'}[options.backend])
index = 'https://download.pytorch.org/whl/cu124' if gpu else 'https://download.pytorch.org/whl/cpu'
if options.backend == 'import':
    sh(gen, '-m', 'pip', 'install', '-q', 'pillow', 'rembg', 'onnxruntime')
    cfg['import_python'] = gen
else:
    sh(gen, '-m', 'pip', 'install', '-q', 'torch==2.6.0', 'torchvision==0.21.0', '--index-url', index)
    triposr = options.backend == 'triposr'
    repo = os.path.join(HERE, '.triposr' if triposr else '.hy3d')
    url = 'https://github.com/VAST-AI-Research/TripoSR' if triposr else 'https://github.com/Tencent-Hunyuan/Hunyuan3D-2'
    if not os.path.isdir(os.path.join(repo, 'tsr' if triposr else 'hy3dgen')):
        sh('git', 'clone', '--depth', '1', url, repo)
    if triposr:
        sh(gen, '-m', 'pip', 'install', '-q', 'setuptools', 'wheel')
        sh(gen, '-m', 'pip', 'install', '-r', os.path.join(repo, 'requirements.txt'))
        sh(gen, '-m', 'pip', 'install', '-q', 'onnxruntime')
        cfg.update(triposr_python=gen, triposr_repo=repo)
    else:
        sh(gen, '-m', 'pip', 'install', '-q', 'diffusers', 'transformers', 'accelerate', 'einops', 'omegaconf', 'tqdm',
           'trimesh', 'pymeshlab', 'opencv-python-headless', 'scikit-image', 'pillow', 'rembg', 'onnxruntime',
           'huggingface_hub', 'gradio_client')
        cfg.update(gen_python=gen, hy3d_repo=repo)
    # Image preparation for imported GLBs can reuse either generation environment.
    cfg.setdefault('import_python', gen)

# ---------------------------------------------------------------- Blender (rigging)
if cfg.get('bpy_python') or cfg.get('blender'):
    print('Keeping configured Blender:', cfg.get('bpy_python') or cfg.get('blender'))
elif (v.major, v.minor) == (3, 11):
    bpy = venv('.venv-bpy')
    sh(bpy, '-m', 'pip', 'install', '-q', 'bpy')
    cfg['bpy_python'] = bpy
else:
    found = shutil.which('blender')
    if not found and WIN:
        hits = sorted(glob.glob(r'C:\Program Files\Blender Foundation\Blender*\blender.exe'))
        found = hits[-1] if hits else None
    if not found and platform.system() == 'Darwin' and os.path.exists('/Applications/Blender.app'):
        found = '/Applications/Blender.app/Contents/MacOS/Blender'
    cfg['blender'] = found
    print('Blender:', found or 'NOT FOUND. Install Blender 4.2+ (blender.org), or rerun this with Python 3.11.')

with open(os.path.join(HERE, 'config.json'), 'w') as f:
    json.dump(cfg, f, indent=1)

# ---------------------------------------------------------------- check
code = 'from PIL import Image; print("GLB import image preparation ready")' if options.backend == 'import' else 'import torch;print("torch", torch.__version__, "cuda", torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "")'
sh(gen, '-c', code)
print('\nDone. Wrote', os.path.join(HERE, 'config.json'))
print('Next: npm install (once, in the repo), then npm run figures, and open http://localhost:5181/')
