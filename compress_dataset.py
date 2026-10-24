"""Write precompressed .gz (and .br when the brotli package is installed) copies of prepared data.
Usage: python compress_dataset.py full-dataset viewer/data
serve.py sends a sidecar instead of the original when the browser accepts that encoding and the
sidecar is at least as new as the original. Originals are never modified; rerun after rebuilding data.
"""
import argparse, gzip, os
from pathlib import Path

try:
    import brotli
except ImportError:
    brotli = None

SUFFIXES = {'.bin', '.json', '.geojson'}
MIN_BYTES = 1024

def fresh(sidecar, original):
    return sidecar.exists() and sidecar.stat().st_mtime_ns >= original.stat().st_mtime_ns

def write(sidecar, data, original):
    temp = sidecar.with_name(sidecar.name + '.tmp')
    temp.write_bytes(data)
    os.replace(temp, sidecar)
    stat = original.stat()
    # Match the original mtime so a rebuilt original (newer mtime) makes the sidecar stale.
    os.utime(sidecar, ns=(stat.st_atime_ns, stat.st_mtime_ns))

def compress_file(path, force=False):
    """Return (original bytes, gzip bytes or None, brotli bytes or None); None means skipped."""
    raw = None; sizes = [path.stat().st_size, None, None]
    targets = [(Path(str(path) + '.gz'), lambda b: gzip.compress(b, compresslevel=9, mtime=0), 1)]
    if brotli: targets.append((Path(str(path) + '.br'), lambda b: brotli.compress(b, quality=9), 2))
    for sidecar, encode, slot in targets:
        if not force and fresh(sidecar, path): sizes[slot] = sidecar.stat().st_size; continue
        if raw is None: raw = path.read_bytes()
        data = encode(raw)
        if len(data) >= len(raw):
            sidecar.unlink(missing_ok=True); continue
        write(sidecar, data, path); sizes[slot] = len(data)
    return sizes

def candidates(folder):
    for path in sorted(folder.rglob('*')):
        if path.is_file() and path.suffix in SUFFIXES and path.stat().st_size >= MIN_BYTES: yield path

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('folders', nargs='+', type=Path)
    p.add_argument('--force', action='store_true', help='Recompress even when sidecars are current.')
    args = p.parse_args()
    totals = [0, 0, 0]
    for folder in args.folders:
        if not folder.is_dir(): raise SystemExit(f'Not a folder: {folder}')
        for path in candidates(folder):
            sizes = compress_file(path, args.force)
            totals[0] += sizes[0]; totals[1] += sizes[1] or sizes[0]; totals[2] += sizes[2] or sizes[1] or sizes[0]
    mb = lambda n: f'{n / 1e6:,.1f} MB'
    print(f'Original {mb(totals[0])} · gzip {mb(totals[1])}' + (f' · brotli {mb(totals[2])}' if brotli else ' · brotli unavailable (pip install brotli)'), flush=True)

if __name__ == '__main__': main()
