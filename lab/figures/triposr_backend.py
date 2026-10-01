"""TripoSR adapter. Uses the upstream API in an isolated environment."""
import os
import sys


def generate(front, output, resolution=192, chunk_size=4096, device='auto'):
    sys.path.insert(0, os.environ.get('TRIPOSR_REPO', os.path.join(os.path.dirname(__file__), '.triposr')))
    import torch
    from PIL import Image
    from tsr.system import TSR
    from tsr.utils import to_gradio_3d_orientation

    if device == 'auto':
        device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
    print(f'TripoSR: {device}, resolution {resolution}, chunk size {chunk_size}', flush=True)
    model = TSR.from_pretrained('stabilityai/TripoSR', config_name='config.yaml', weight_name='model.ckpt')
    model.renderer.set_chunk_size(chunk_size)
    model.to(device)
    # The shared cutout already has a margin. Composite alpha onto neutral grey.
    image = Image.new('RGBA', front.size, (128, 128, 128, 255))
    image.alpha_composite(front)
    with torch.no_grad():
        code = model([image.convert('RGB')], device=device)
        mesh = model.extract_mesh(code, False, resolution=resolution)[0]
    # Upstream's viewer conversion makes the raw Z-up mesh glTF Y-up.
    # The rigging stage imports glTF back into Blender's Z-up coordinates.
    to_gradio_3d_orientation(mesh).export(output)
