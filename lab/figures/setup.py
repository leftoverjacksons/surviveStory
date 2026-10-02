"""
Set up the figure studio on this machine (Windows, Linux or macOS).

    python lab/figures/setup.py            (Python 3.10–3.13; 3.13 or 3.11 also install Blender's module)
    python lab/figures/setup.py --cpu      (no CUDA, even with an NVIDIA GPU)

Creates, inside lab/figures/ (all git-ignored):
  .venv-gen   PyTorch (CUDA 12.6 build when an NVIDIA GPU is found, else CPU)
              plus the Hunyuan3D shape-generation dependencies and gradio_client
  .hy3d       a clone of Tencent-Hunyuan/Hunyuan3D-2 (the shape pipeline's code)
  .venv-bpy   Blender as a Python module (bpy), for rigging, on Python 3.13 (bpy 5.1+)
              or 3.11 (bpy up to 5.0); otherwise an installed Blender is used instead
  config.json the paths the studio's server uses

Model weights (about 2–7 GB) download on the first figure, into the
Hugging Face cache. Then: npm run figures, and open http://localhost:5181/.
"""
import json, os, platform, shutil, subprocess, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
WIN = platform.system() == 'Windows'
CPU = '--cpu' in sys.argv

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
if not ((3, 10) <= (v.major, v.minor) <= (3, 13)):
    sys.exit(f'Python {v.major}.{v.minor}: use 3.10–3.13 (3.13 is best: Blender\'s module is built for it).')

# ---------------------------------------------------------------- generation environment
gpu = False
if not CPU and shutil.which('nvidia-smi'):
    try:
        out = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], capture_output=True, text=True).stdout.strip()
        print('NVIDIA GPU:', out)
        gpu = bool(out)
    except Exception:
        pass
gen = venv('.venv-gen')
# cu126 carries the newest PyTorch for Windows + Python 3.13 (2.14, the version tested on CPU here) and supports
# RTX 20xx/30xx cards; cu124 stops at torch 2.6.
index = 'https://download.pytorch.org/whl/cu126' if gpu else 'https://download.pytorch.org/whl/cpu'
sh(gen, '-m', 'pip', 'install', '-q', 'torch', 'torchvision', '--index-url', index)
# transformers 5.18 renamed the image encoder's weights that Hunyuan3D-2 loads (verified 2026-10-02).
sh(gen, '-m', 'pip', 'install', '-q', 'diffusers', 'transformers<5.18', 'accelerate', 'einops', 'omegaconf', 'tqdm',
   'trimesh', 'pymeshlab', 'opencv-python-headless', 'scikit-image', 'pillow', 'rembg', 'onnxruntime',
   'huggingface_hub', 'gradio_client')

if gpu:  # a later install must not have swapped the CUDA build for a CPU one
    ok = subprocess.run([gen, '-c', 'import torch; print(torch.__version__, torch.cuda.is_available())'], capture_output=True, text=True).stdout.strip()
    print('PyTorch:', ok)
    if not ok.endswith('True'):
        print('WARNING: PyTorch cannot see the GPU (old NVIDIA driver? update it from nvidia.com, then rerun). '
              'Figures will still work on the CPU, slowly.')

repo = os.path.join(HERE, '.hy3d')
if not os.path.exists(os.path.join(repo, 'hy3dgen')):
    if not shutil.which('git'):
        sys.exit('git is needed to fetch the Hunyuan3D-2 code (https://git-scm.com).')
    sh('git', 'clone', '--depth', '1', 'https://github.com/Tencent-Hunyuan/Hunyuan3D-2', repo)

# ---------------------------------------------------------------- Blender (rigging)
cfg = {'gen_python': gen, 'hy3d_repo': repo, 'bpy_python': None, 'blender': None, 'node': 'node'}
if (v.major, v.minor) in ((3, 11), (3, 13)):  # the Pythons bpy is built for
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
    print('Blender:', found or 'NOT FOUND. Install Blender 4.2+ (blender.org), or rerun this with Python 3.13.')

with open(os.path.join(HERE, 'config.json'), 'w') as f:
    json.dump(cfg, f, indent=1)

# ---------------------------------------------------------------- check
code = 'import torch;print("torch", torch.__version__, "cuda", torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "")'
sh(gen, '-c', code)
print('\nDone. Wrote', os.path.join(HERE, 'config.json'))
print('Next: npm install (once, in the repo), then npm run figures, and open http://localhost:5181/')
