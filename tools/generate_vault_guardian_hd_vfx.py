from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "art/source/vault-guardian-hd-vfx"
LOCK_PATH = SOURCE_DIR / "vault-vfx-assets.lock.json"
ATLAS_SPECS = {
    "vault-chest-states-atlas-alpha.png": (
        ("assets/hd/objects/vault/chest-lock/lock-{frame:02d}.png", 0),
        ("assets/hd/vfx/vault/hoard-sentence/mark/mark-{frame:02d}.png", 1),
        ("assets/hd/objects/vault/chest-destroyed/debris-{frame:02d}.png", 2),
        ("assets/hd/vfx/vault/seal-break/break-{frame:02d}.png", 3),
    ),
    "vault-spell-vfx-atlas-alpha.png": (
        ("assets/hd/vfx/vault/lockdown/tile/tile-{frame:02d}.png", 0),
        ("assets/hd/vfx/vault/lockdown/anchor/anchor-{frame:02d}.png", 1),
        ("assets/hd/vfx/vault/lockdown/detonation/detonation-{frame:02d}.png", 2),
        ("assets/hd/vfx/vault/hoard-sentence/cast/cast-{frame:02d}.png", 3),
    ),
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def render_cell(atlas: Image.Image, column: int, row: int) -> bytes:
    left = round(column * atlas.width / 4)
    top = round(row * atlas.height / 4)
    right = round((column + 1) * atlas.width / 4)
    bottom = round((row + 1) * atlas.height / 4)
    cell = atlas.crop((left, top, right, bottom)).convert("RGBA")
    alpha_box = cell.getchannel("A").getbbox()
    if alpha_box is None:
        raise RuntimeError(f"empty atlas cell at row={row} column={column}")
    subject = cell.crop(alpha_box)
    scale = min(116 / subject.width, 116 / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    output.alpha_composite(subject, ((128 - size[0]) // 2, (128 - size[1]) // 2))
    buffer = io.BytesIO()
    output.save(buffer, format="PNG", optimize=False, compress_level=9)
    return buffer.getvalue()


def build_outputs() -> tuple[dict[str, bytes], dict[str, str]]:
    outputs: dict[str, bytes] = {}
    sources: dict[str, str] = {}
    for atlas_name, rows in ATLAS_SPECS.items():
        atlas_path = SOURCE_DIR / atlas_name
        atlas_bytes = atlas_path.read_bytes()
        sources[atlas_path.relative_to(ROOT).as_posix()] = sha256(atlas_bytes)
        with Image.open(io.BytesIO(atlas_bytes)) as atlas_image:
            atlas = atlas_image.convert("RGBA")
            for path_template, row in rows:
                for column in range(4):
                    relative = path_template.format(frame=column + 1)
                    outputs[relative] = render_cell(atlas, column, row)
    return outputs, sources


def build_lock(outputs: dict[str, bytes], sources: dict[str, str]) -> bytes:
    payload = {
        "version": 1,
        "canvas": [128, 128],
        "sources": sources,
        "outputs": {path: sha256(data) for path, data in sorted(outputs.items())},
    }
    return (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs, sources = build_outputs()
    lock_bytes = build_lock(outputs, sources)
    if args.check:
        mismatches = []
        for relative, expected in outputs.items():
            path = ROOT / relative
            if not path.is_file() or path.read_bytes() != expected:
                mismatches.append(relative)
        if not LOCK_PATH.is_file() or LOCK_PATH.read_bytes() != lock_bytes:
            mismatches.append(LOCK_PATH.relative_to(ROOT).as_posix())
        if mismatches:
            raise SystemExit("Vault HD VFX drift: " + ", ".join(mismatches))
        print(f"Vault HD VFX check passed: {len(outputs)} assets")
        return 0
    for relative, data in outputs.items():
        path = ROOT / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    LOCK_PATH.write_bytes(lock_bytes)
    print(f"Wrote {len(outputs)} Vault HD assets and {LOCK_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())