"""Run with: python -m unittest discover -s lab/figures -p 'test_*.py'."""
import base64
import json
import os
import struct
import tempfile
import unittest
from unittest.mock import patch

import server
from sources import decode_upload, provenance, validate_glb


def glb(doc):
    raw = json.dumps(doc).encode()
    raw += b' ' * (-len(raw) % 4)
    return struct.pack('<4sIIII', b'glTF', 2, 20 + len(raw), len(raw), 0x4E4F534A) + raw


class SourcesTest(unittest.TestCase):
    def test_glb_must_be_a_self_contained_mesh(self):
        valid = glb({'asset': {'version': '2.0'}, 'meshes': [{'primitives': []}]})
        validate_glb(valid)
        for data in [b'not a mesh', valid[:-1], glb({'asset': {'version': '2.0'}}),
                     glb({'meshes': [{}], 'buffers': [{'uri': '../outside.bin'}]})]:
            with self.assertRaises(ValueError):
                validate_glb(data)

    def test_upload_bytes_are_preserved(self):
        data = b'\x00\xff\x01'
        self.assertEqual(decode_upload('data:application/octet-stream;base64,' + base64.b64encode(data).decode()), data)
        with self.assertRaises(ValueError):
            decode_upload(None)

    def test_source_terms_are_not_relabelled(self):
        self.assertIn('MIT', provenance({'backend': 'triposr'})['licence'])
        self.assertIn('Tencent', provenance({})['licence'])
        self.assertEqual(provenance({'backend': 'import'}, {'generator': 'Example', 'licence': 'Custom'})['licence'], 'Custom')
        self.assertIn('Unspecified', provenance({'backend': 'import'})['licence'])
        with self.assertRaises(ValueError):
            provenance({'backend': 'unknown'})

    def test_each_backend_uses_its_own_environment(self):
        cfg = {'gen_python': 'legacy-python', 'triposr_python': 'tripo-python', 'import_python': 'image-python',
               'hy3d_repo': 'hunyuan-code', 'triposr_repo': 'tripo-code'}
        with patch.dict(server.CFG, cfg), patch.object(server, 'run') as run:
            for backend, expected in [('local', 'legacy-python'), ('space', 'legacy-python'), ('triposr', 'tripo-python'), ('import', 'image-python')]:
                server.step_generate('fixture', {'front': 'source.png', 'params': {'backend': backend}})
                cmd = run.call_args.args[2]
                self.assertEqual(cmd[0], expected)
                self.assertEqual('--mesh' in cmd, backend == 'import')
                self.assertEqual('--chunk-size' in cmd, backend == 'triposr')

    def test_rerun_invalidates_only_downstream_files(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(server, 'WORK', tmp), patch.object(server, 'jobs'):
            os.mkdir(os.path.join(tmp, 'figure'))
            for file in ['mesh.glb', 'rigged.glb', 'packed.glb', 'source.glb']:
                with open(os.path.join(tmp, 'figure', file), 'wb') as f: f.write(b'old')
            with open(server.meta_path('figure'), 'w') as f:
                json.dump({'status': 'ready', 'done': ['generate', 'rig', 'pack']}, f)
            server.enqueue('figure', ['rig'])
            self.assertTrue(os.path.exists(os.path.join(tmp, 'figure', 'mesh.glb')))
            self.assertTrue(os.path.exists(os.path.join(tmp, 'figure', 'source.glb')))
            self.assertFalse(os.path.exists(os.path.join(tmp, 'figure', 'packed.glb')))
            self.assertEqual(server.read_meta('figure')['done'], ['generate'])
            with self.assertRaises(ValueError):
                server.enqueue('figure', ['generate'])


if __name__ == '__main__':
    unittest.main()
