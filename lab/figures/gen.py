"""
Figure studio, step 1: image(s) → untextured mesh.

    python gen.py --front front.png [--back back.png] --out mesh.glb --cut <dir>
                  [--backend local|space] [--model mini|mv] [--preset turbo|full]
                  [--octree 192] [--seed 1234] [--device auto|cuda|cpu] [--offload auto|on|off]

Backends:
  local  Hunyuan3D-2mini (one image) or Hunyuan3D-2mv (front + back), shape
         only, from a clone of Tencent-Hunyuan/Hunyuan3D-2 (HY3D_REPO). Runs on
         CUDA when present (fp16; whole-model CPU offload below 7 GB of VRAM),
         else on the CPU (fp32). 'turbo' is the step-distilled model (5 steps);
         'full' is 30 steps.
  space  A hosted Hugging Face Space (default tencent/Hunyuan3D-2.1) through
         gradio_client; HF_TOKEN raises the free GPU quota.

Either way the cut-out images (background removed, RGBA) are saved to --cut
for the colour step (rig.py). Licence: Hunyuan3D outputs may not be used or
shown in the EU, UK or South Korea (see README.md): prototypes only.
"""
import argparse, json, os, shutil, sys, time

ap = argparse.ArgumentParser()
ap.add_argument('--front', required=True)
ap.add_argument('--back')
ap.add_argument('--out', required=True)
ap.add_argument('--cut', required=True)
ap.add_argument('--backend', default='local', choices=['local', 'space'])
ap.add_argument('--model', default='auto', choices=['auto', 'mini', 'mv'])
ap.add_argument('--preset', default='turbo', choices=['turbo', 'full'])
ap.add_argument('--octree', type=int, default=192)
ap.add_argument('--seed', type=int, default=1234)
ap.add_argument('--device', default='auto')
ap.add_argument('--offload', default='auto', choices=['auto', 'on', 'off'])
ap.add_argument('--space', default='tencent/Hunyuan3D-2.1')
a = ap.parse_args()
os.makedirs(a.cut, exist_ok=True)
T0 = time.time()
def log(*m):
    print(f'[{time.time() - T0:6.1f}s]', *m, flush=True)

sys.path.insert(0, os.environ.get('HY3D_REPO', os.path.join(os.path.dirname(__file__), '.hy3d')))
from PIL import Image
from hy3dgen.rembg import BackgroundRemover

# ---------------------------------------------------------------- cut-outs
rembg = None
def cutout(path, name):
    global rembg
    im = Image.open(path)
    im = im.convert('RGBA')
    if im.getextrema()[3][0] > 250:  # fully opaque: remove the background
        rembg = rembg or BackgroundRemover()
        im = rembg(im.convert('RGB'))
    # Crop to the figure with a margin and centre it on a square, as the model expects.
    box = im.getbbox()
    im = im.crop(box)
    s = int(max(im.size) * 1.15)
    sq = Image.new('RGBA', (s, s), (255, 255, 255, 0))
    sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    out = os.path.join(a.cut, name)
    sq.save(out)
    return out, sq

front_path, front = cutout(a.front, 'front.png')
back_path, back = cutout(a.back, 'back.png') if a.back else (None, None)
log('cut-outs saved')

# ---------------------------------------------------------------- space
if a.backend == 'space':
    from gradio_client import Client, handle_file
    c = Client(a.space, hf_token=os.environ.get('HF_TOKEN') or None)
    res = c.predict(image=handle_file(front_path), mv_image_front=None,
                    mv_image_back=handle_file(back_path) if back_path else None,
                    mv_image_left=None, mv_image_right=None,
                    steps=30 if a.preset == 'full' else 20, guidance_scale=5.0, seed=a.seed,
                    octree_resolution=a.octree, check_box_rembg=False, num_chunks=8000,
                    randomize_seed=False, api_name='/shape_generation')
    shutil.copy(res[0], a.out)
    log('space done', json.dumps(res[2]) if len(res) > 2 else '')
    sys.exit(0)

# ---------------------------------------------------------------- local
import torch
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

dev = a.device if a.device != 'auto' else ('cuda' if torch.cuda.is_available() else 'cpu')
vram = torch.cuda.get_device_properties(0).total_memory / 2 ** 30 if dev == 'cuda' else 0
offload = dev == 'cuda' and (a.offload == 'on' or (a.offload == 'auto' and vram < 7))
dtype = torch.float16 if dev == 'cuda' else torch.float32
model = a.model if a.model != 'auto' else ('mv' if back else 'mini')
repo, sub = {'mini': ('tencent/Hunyuan3D-2mini', 'hunyuan3d-dit-v2-mini'),
             'mv': ('tencent/Hunyuan3D-2mv', 'hunyuan3d-dit-v2-mv')}[model]
if a.preset == 'turbo':
    sub += '-turbo'
steps = 5 if a.preset == 'turbo' else 30
log(f'device {dev}' + (f' ({torch.cuda.get_device_name(0)}, {vram:.1f} GB)' if dev == 'cuda' else '')
    + f', model {repo}/{sub}, {steps} steps, offload {offload}')

pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(repo, subfolder=sub, variant='fp16',
                                                        device='cpu' if offload else dev, dtype=dtype)
pipe.enable_flashvdm(mc_algo='mc')  # hierarchical decoding: seconds instead of minutes
pipe.vae.to('cpu' if offload else dev, dtype)
if offload:
    pipe.enable_model_cpu_offload()
log('model loaded')

image = {'front': front, 'back': back} if model == 'mv' else front
if model == 'mv' and back is None:
    image = {'front': front}
mesh = pipe(image=image, num_inference_steps=steps, octree_resolution=a.octree, num_chunks=20000,
            generator=torch.manual_seed(a.seed), output_type='trimesh')[0]
log(f'generated: {len(mesh.vertices)} vertices, {len(mesh.faces)} faces')
mesh.export(a.out)
log('wrote', a.out)
