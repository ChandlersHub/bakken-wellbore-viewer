"""Precompressed sidecars and the local server's encoding choice; no external data."""
import gzip
import os
from pathlib import Path
import sys
import tempfile
import unittest

from compress_dataset import compress_file

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'gamma-data'))
from serve import accepted_encodings, encoded_variant


class CompressDatasetTests(unittest.TestCase):
    def test_sidecar_round_trip_and_freshness(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'manifest.json'
            payload = b'{"wells":[' + b','.join(b'{"id":%d,"tile":"0_0"}' % i for i in range(500)) + b']}'
            path.write_bytes(payload)
            original, gz, _ = compress_file(path)
            self.assertEqual(original, len(payload))
            sidecar = Path(str(path) + '.gz')
            self.assertEqual(gzip.decompress(sidecar.read_bytes()), payload)
            self.assertLess(gz, original)
            self.assertEqual(encoded_variant(path, 'gzip, deflate'), (sidecar, 'gzip'))
            # A rebuilt original makes the old sidecar stale until compressed again.
            stat = path.stat(); os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 10**9))
            self.assertIsNone(encoded_variant(path, 'gzip'))
            compress_file(path)
            self.assertEqual(encoded_variant(path, 'gzip'), (sidecar, 'gzip'))

    def test_incompressible_data_keeps_no_sidecar(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'tile.bin'
            path.write_bytes(os.urandom(4096))
            _, gz, br = compress_file(path)
            self.assertIsNone(gz); self.assertIsNone(br)
            self.assertIsNone(encoded_variant(path, 'gzip, br'))

    def test_accept_encoding_parsing(self):
        self.assertEqual(accepted_encodings('gzip, deflate, br;q=1.0'), {'gzip', 'deflate', 'br'})
        self.assertEqual(accepted_encodings('gzip;q=0, br'), {'br'})
        self.assertEqual(accepted_encodings(None), set())


if __name__ == '__main__':
    unittest.main()
