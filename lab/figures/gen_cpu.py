# Lab: shape-only Hunyuan3D-2mini on CPU (see README.md).
#   python gen_cpu.py <image> <out.glb> [steps 30] [octree 256] [--flash]
import os, sys, time, torch
sys.path.insert(0, os.environ.get('HY3D_REPO', 'hy2'))  # a clone of Tencent-Hunyuan/Hunyuan3D-2
from PIL import Image
from hy3dgen.rembg import BackgroundRemover
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
img, out = sys.argv[1], sys.argv[2]
steps = int(sys.argv[3]) if len(sys.argv) > 3 else 30
octree = int(sys.argv[4]) if len(sys.argv) > 4 else 256
t = time.time()
pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
    'tencent/Hunyuan3D-2mini', subfolder='hunyuan3d-dit-v2-mini', variant='fp16',
    device='cpu', dtype=torch.float32)
if '--flash' in sys.argv:
    pipe.enable_flashvdm(mc_algo='mc')
    pipe.vae.to('cpu', torch.float32)
print(f'load {time.time()-t:.0f}s', flush=True)
im = Image.open(img).convert('RGBA')
if im.getextrema()[3][0] == 255: im = BackgroundRemover()(im.convert('RGB'))
t = time.time()
mesh = pipe(image=im, num_inference_steps=steps, octree_resolution=octree, num_chunks=20000,
            generator=torch.manual_seed(1234), output_type='trimesh')[0]
print(f'generate {time.time()-t:.0f}s  verts {len(mesh.vertices)} faces {len(mesh.faces)}', flush=True)
mesh.export(out)
