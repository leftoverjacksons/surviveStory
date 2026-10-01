"""Source metadata and upload validation; no GPU or Blender imports."""
import base64
import hashlib
import json
import struct

BACKENDS = ('triposr', 'import', 'local', 'space')


def decode_upload(url):
    if not isinstance(url, str) or ';base64,' not in url:
        raise ValueError('Expected a base64 file upload')
    return base64.b64decode(url.split(',', 1)[1], validate=True)


def validate_glb(data):
    if len(data) < 20:
        raise ValueError('Upload a GLB 2.0 mesh')
    magic, version, size = struct.unpack_from('<4sII', data)
    if magic != b'glTF' or version != 2 or size != len(data):
        raise ValueError('Invalid GLB 2.0 header or length')
    length, kind = struct.unpack_from('<II', data, 12)
    if kind != 0x4E4F534A or 20 + length > len(data):
        raise ValueError('GLB has no valid JSON chunk')
    doc = json.loads(data[20:20 + length])
    if not doc.get('meshes'):
        raise ValueError('GLB contains no meshes')
    # Imported assets must be self-contained, not refer to local files or URLs.
    for item in doc.get('buffers', []) + doc.get('images', []):
        if item.get('uri') and not item['uri'].startswith('data:'):
            raise ValueError('GLB must embed its buffers and images')


def provenance(params, supplied=None):
    backend = params.get('backend', 'local')  # old jobs retain their backend
    if backend not in BACKENDS:
        raise ValueError('Unknown generator')
    if backend == 'triposr':
        return {'generator': 'TripoSR', 'model': 'stabilityai/TripoSR',
                'licence': 'MIT (generator code and weights; source image rights are separate)',
                'source_url': 'https://github.com/VAST-AI-Research/TripoSR'}
    if backend == 'import':
        supplied = supplied or {}
        return {'generator': str(supplied.get('generator') or 'Imported GLB')[:200],
                'licence': str(supplied.get('licence') or 'Unspecified; check the source before distribution')[:500],
                'source_url': str(supplied.get('source_url') or '')[:1000]}
    return {'generator': 'Hunyuan3D (' + backend + ')',
            'licence': 'Tencent Hunyuan 3D community licence: not for the EU, UK or South Korea; prototype only'}


def fingerprint(data):
    return hashlib.sha256(data).hexdigest()
