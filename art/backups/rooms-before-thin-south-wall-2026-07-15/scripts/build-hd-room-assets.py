#!/usr/bin/env python3
"""Build the locked Task 8 themed-room kit from five approved ImageGen sources."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import runpy
import shutil
import uuid

from PIL import Image, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parents[1]
BASE = runpy.run_path(str(ROOT / "scripts/build-descent-environment-assets.py"))
PIPELINE_SCHEMA = 1
SUPPORTED_PILLOW_VERSION = "12.1.1"
SOURCE_ROOT = ROOT / "art/source/task8-hd"
WORK_PARENT = ROOT / "art/work/task8-hd-rooms"
OUTPUT_ROOT = ROOT / "assets/hd"
LOCK_PATH = SOURCE_ROOT / "room-assets.lock.json"
MERCHANT_PROFILE_SIZE = 96
SOURCE_HASHES = {
    "corruption-env-source-original.png": "5ca073fe55065c17989daf947621f42cc309950c50305f6dc11da8a4091cba65",
    "abyss-env-source-original.png": "671d384d86322e33345ad778bbfedf9482afad04162c3fd3ba2da3fd0792260f",
    "merchant-seed-source-original.png": "a1b16d560ef89f9fcbc4bd8151f184a04d937fe50b2d1fc30c56f5762c3396b6",
    "core-props-source-original.png": "7fffd23347dd0bc596040b783e6b5596ce36a0a65cac212475a67e806d356846",
    "portals-boss-source-original.png": "318e62b9b11ea586723d170bccfa6989a8ec2c671662669f09cb43fdfb9d36e3",
    "vault-seal-blocked-source-original.png": "27191f085144deded50936d01dfdf689dbd3645794a300c2e5a012c67788fefb",
    "vault-seal-cleared-source-original.png": "1b31817cdb662d88dc8bfb84c239a9d0c1b7407627868560d4d324d4350396ce",
    "otter-portal-source-original.png": "5ec3c083ee09c85f7de86fd6124d9dbb7e64c7fa685d9e22a65a3c267d59efbf",
    "forge-portal-source-original.png": "320aa4b047b41518d5650e67b0d5c9022a66e64ff7e2a8940eddb3ac1e62ac82",
    "forge-room-source-original.png": "e0cfc77066672468bcf9f01727d7ab8fa6e25c92dcf67c5fe4ab7c5c169b3550",
    "forge-setpiece-source-original.png": "0c78be6f7d62c840a3ade49460c3f0253bc9bc5bf8d415bed4562c9ee69cc201",
    "vault-room-source-original.png": "5c3ceb7edce0c9dc1f549af4c08f57fc871d5e4a121f589d913b0d9ce4ac1844",
    "otter-room-source-original.png": "2d682f3ebe86342222bc1ed3ef205cd842e49bf66a901f37f41ae2f6b70e8293",
    "descent-room-01-source-original.png": "9fb916febac18cba22ce6797bce3aa593ef73775c1117983df5c77751cc211ef",
    "descent-room-02-source-original.png": "365ab9469c2a687b9c2b984536ed077c94ca56f722b6580d6274ca6e8efb0df1",
    "descent-room-03-source-original.png": "bf120844652e37b95a063ef8a5f6029f740c73495d82e0874f410293dce7cb7c",
    "corruption-room-01-source-original.png": "44b28b130b7f67b9d277f27e5e1194327f0023f297ad3eb0dff22136b5926a58",
    "corruption-room-02-source-original.png": "a30c7fb9fd7e24eb8cf071c917e5d0257d34b440f081f5ca65f3ef21c443997e",
    "corruption-room-03-source-original.png": "5264d4ec8c921208718b599feb9e1bf8e141abd44b6505da94c46dbecb0fe692",
    "abyss-room-01-source-original.png": "170378bae993529f343cfe557280029fff11d189a08f9bcf27eb3d2af0dc7643",
    "abyss-room-02-source-original.png": "256f7db383bc51b940f0a540adaefc18b6b4f1cdc52850b4212b4817b6d4a15a",
    "abyss-room-03-source-original.png": "384729b188428a41d4c89df699f424bd9d41e338c5164b085644e9d5aa457a3e",
    "hazard-spikes-source-original.png": "792cd2cbdc4a705d36c433f091e274663d4b103576d1ca3078a086b48635c29b",
    "hazard-mine-source-original.png": "064236cc6c46eef1b4c008e01dcbc33543c68b7a4cdecd905c20b800606fcaaa",
    "descent-boss-room-source-original.png": "3514709b15aacc03c294300a237766bbb78fda6d41d159b63d02fc9b753a9c0f",
    "corruption-boss-room-source-original.png": "6b4461987e2e286497668f65cfd0006b0c2bbc560489a224bea9471487191026",
    "abyss-boss-room-source-original.png": "d9cdbd4614f7abf880e59e8746681f113c51921f30336ed9b126222236e17874",
}
ATLAS_SOURCES = (
    "corruption-env-source-original.png",
    "abyss-env-source-original.png",
    "core-props-source-original.png",
    "portals-boss-source-original.png",
)
ENVIRONMENT_FILENAMES = (
    "floor-base.png", "floor-b.png", "floor-c.png", "floor-skull.png", "floor-crack-cross.png",
    "floor-var3.png", "floor-var4.png", "wall-north.png", "wall-south.png", "wall-east.png", "wall-west.png",
    "wall-corner-northwest.png", "wall-corner-northeast.png", "wall-corner-southwest.png",
    "wall-corner-southeast.png", "decal-crack.png", "grate.png", "rubble.png",
    "decal-stain-01.png", "decal-stain-02.png", "decal-stain-03.png", "decal-sigil.png",
    "decal-vein.png", "decal-dust.png", "decal-scar.png", "decal-residue.png",
    "torch-unlit.png", "torch-lit-01.png", "torch-lit-02.png", "torch-lit-03.png",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def normalize_source(source: Path, destination: Path) -> Image.Image:
    with Image.open(source) as image:
        if image.size != (1254, 1254) or image.mode != "RGB":
            raise ValueError(f"source must be untouched 1254x1254 RGB: {source}")
        normalized = image.resize((1024, 1024), Image.Resampling.LANCZOS)
    BASE["save_png"](normalized, destination)
    return normalized


def validate_atlas_layout(atlas: Image.Image, name: str) -> None:
    pixels = atlas.convert("RGB")
    for row in range(4):
        for column in range(4):
            slot = pixels.crop((column * 256, row * 256, (column + 1) * 256, (row + 1) * 256))
            meaningful = sum(
                1 for red, green, blue in slot.get_flattened_data()
                if not (red >= 220 and blue >= 220 and green <= 50 and abs(red - blue) <= 45)
            )
            if meaningful < 1500:
                raise ValueError(f"{name} is not a complete 4x4 atlas; empty slot r{row + 1}c{column + 1}")


def key_atlas(source: Path, normalized: Path, work: Path, helper: Path) -> list[Image.Image]:
    atlas = normalize_source(source, normalized)
    validate_atlas_layout(atlas, source.name)
    slots = BASE["crop_slots"](atlas, work / "slots")
    return BASE["key_slots"](slots, work / "keyed", helper)


def thirds(image: Image.Image, axis: str) -> list[Image.Image]:
    if axis == "vertical":
        return [image.crop((round(index * 256 / 3), 0, round((index + 1) * 256 / 3), 256)) for index in range(3)]
    return [image.crop((0, round(index * 256 / 3), 256, round((index + 1) * 256 / 3))) for index in range(3)]


def quarters_vertical(image: Image.Image) -> list[Image.Image]:
    return [image.crop((index * 64, 0, (index + 1) * 64, 256)) for index in range(4)]


def write_rgba(image: Image.Image, output: Path) -> Path:
    rgba = BASE["remove_residual_chroma"](image.convert("RGBA"))
    BASE["validate_chroma_policy"](rgba, output)
    BASE["save_png"](rgba, output)
    return output


def build_environment(
    theme: str,
    keyed: list[Image.Image],
    output_root: Path,
    brazier_atlas: Image.Image,
    classic_tileset: Image.Image,
) -> list[Path]:
    directory = output_root / f"environment/{theme}"
    written: list[Path] = []

    def emit(image: Image.Image, filename: str) -> None:
        written.append(write_rgba(image, directory / filename))

    crack_asset = BASE["contained"](keyed[9], (64, 64), margin=2)
    stain_axis = "horizontal" if theme == "corruption" else "vertical"
    stain_assets = [
        BASE["contained"](source, (64, 64), margin=2)
        for source in thirds(keyed[12], stain_axis)
    ]
    floor_variants = BASE["build_floor_variants"](
        keyed[0], crack_asset, stain_assets, classic_tileset, theme
    )
    for filename in BASE["FLOOR_VARIANT_FILENAMES"]:
        name = filename.removeprefix("floor-").removesuffix(".png")
        emit(floor_variants[name].convert("RGBA"), filename)
    wall_assets = {
        "north": BASE["contained"](keyed[1], (64, 64), anchor="north", margin=0),
        "south": BASE["contained"](keyed[2], (64, 64), anchor="south", margin=0),
        "west": BASE["contained"](keyed[3], (64, 64), anchor="west", margin=0),
        "east": BASE["contained"](keyed[4], (64, 64), anchor="east", margin=0),
    }
    for direction in ("north", "south", "west", "east"):
        emit(wall_assets[direction], f"wall-{direction}.png")
    corner_arms = {
        "northwest": ("north", "west"),
        "northeast": ("north", "east"),
        "southwest": ("south", "west"),
        "southeast": ("south", "east"),
    }
    for index, name in enumerate(("northwest", "northeast", "southwest", "southeast"), start=5):
        detail = BASE["contained"](keyed[index], (64, 64), anchor=name, margin=0)
        horizontal, vertical = corner_arms[name]
        corner = BASE["compose_wall_corner"](wall_assets[horizontal], wall_assets[vertical], detail, name)
        emit(corner, f"wall-corner-{name}.png")
    emit(crack_asset, "decal-crack.png")
    emit(BASE["contained"](keyed[10], (64, 64), margin=2), "grate.png")
    emit(BASE["contained"](keyed[11], (64, 64), anchor="bottom", margin=2), "rubble.png")

    for source, name in zip(stain_assets, ("01", "02", "03"), strict=True):
        emit(source, f"decal-stain-{name}.png")
    sigil, vein = BASE["split_vertical"](keyed[13])
    emit(BASE["contained"](sigil, (64, 64), margin=2), "decal-sigil.png")
    emit(BASE["contained"](vein, (64, 64), margin=2), "decal-vein.png")
    for source, name in zip(thirds(keyed[14], "horizontal"), ("dust", "scar", "residue"), strict=True):
        emit(BASE["contained"](source, (64, 64), margin=2), f"decal-{name}.png")
    torches = BASE["build_brazier_assets"](brazier_atlas, 1 if theme == "corruption" else 2)
    for source, name in zip(torches, ("unlit", "lit-01", "lit-02", "lit-03"), strict=True):
        emit(source, f"torch-{name}.png")
    if len(written) != 30 or sorted(path.name for path in written) != sorted(ENVIRONMENT_FILENAMES):
        raise ValueError(f"{theme} environment contract mismatch")
    return written


def build_theme_spike(theme: str, source: Image.Image, output_root: Path) -> Path:
    spike = BASE["theme_spike"](BASE["contained"](source, (64, 64), margin=4), theme)
    return write_rgba(spike, output_root / f"hazards/{theme}/spikes-armed.png")


def build_theme_mines(theme: str, source: Image.Image, output_root: Path) -> list[Path]:
    unarmed, armed = BASE["build_mine_assets"](BASE["contained"](source, (64, 64), margin=4), theme)
    return [
        write_rgba(unarmed, output_root / f"hazards/{theme}/mine-unarmed.png"),
        write_rgba(armed, output_root / f"hazards/{theme}/mine-armed.png"),
    ]


def build_props(
    core: list[Image.Image],
    portals: list[Image.Image],
    vault_seals: list[Image.Image],
    special_portals: dict[str, Image.Image],
    portal_energy_style: Image.Image,
    forge_setpiece: Image.Image,
    output_root: Path,
) -> list[Path]:
    objects = output_root / "objects"
    written: list[Path] = []

    def group(sources: list[Image.Image], size: int, anchor: str, folder: str, names: tuple[str, ...]) -> None:
        normalized = BASE["normalized_group"](sources, (size, size), anchor=anchor, margin=max(2, size // 32))
        for image, name in zip(normalized, names, strict=True):
            written.append(write_rgba(image, objects / folder / f"{name}.png"))

    group(core[0:4], 128, "bottom", "merchant", ("idle-01", "idle-02", "idle-03", "idle-04"))
    connected_forge = BASE["keep_largest_alpha_component"](forge_setpiece)
    forge_active = BASE["contained"](connected_forge, (192, 192), anchor="bottom", margin=4)

    def forge_state(glow_scale: float, desaturate: float = 0.0) -> Image.Image:
        result = forge_active.copy().convert("RGBA")
        pixels = []
        for red, green, blue, alpha in result.get_flattened_data():
            warm = red >= 72 and red >= green * 1.08 and red >= blue * 1.45
            if warm:
                red, green, blue = (
                    round(red * glow_scale),
                    round(green * glow_scale),
                    round(blue * glow_scale),
                )
            if desaturate > 0:
                luminance = round(red * 0.2126 + green * 0.7152 + blue * 0.0722)
                red = round(red * (1 - desaturate) + luminance * desaturate)
                green = round(green * (1 - desaturate) + luminance * desaturate)
                blue = round(blue * (1 - desaturate) + luminance * desaturate)
            pixels.append((red, green, blue, alpha))
        result.putdata(pixels)
        return result

    for image, name in zip(
        (forge_state(0.16), forge_state(0.78), forge_active, forge_state(0.08, 0.55)),
        ("dormant", "ready01", "ready02", "used"),
        strict=True,
    ):
        written.append(write_rgba(image, objects / "forge" / f"{name}.png"))
    group(core[8:12], 128, "bottom", "pact", ("dormant", "ready01", "ready02", "used"))
    group(vault_seals, 128, "center", "vault", ("seal-blocked", "seal-cleared"))
    group(core[12:14], 128, "center", "otter", ("seal-blocked", "seal-cleared"))
    group(core[14:16], 64, "bottom", "otter", ("chest-ready", "chest-opened"))
    portal_specs = {
        "vault": ((64, 64), 29, (14, 8, 2)),
        "forge": ((64, 64), 33, (18, 5, 1)),
        "otter": ((64, 64), 33, (12, 2, 5)),
    }
    for index, folder in enumerate(("vault", "forge", "otter")):
        if folder == "vault":
            sources = portals[index * 4:index * 4 + 4]
            normalized = BASE["normalized_group"](sources, (128, 128), anchor="bottom", margin=4)
        else:
            aperture = (512, 492) if folder == "forge" else (512, 464)
            active = BASE["portal_source_canvas"](special_portals[folder], aperture=aperture)
            normalized = [active, active]
        frame, swirls, composites = BASE["portal_layer_animation"](
            normalized,
            center=portal_specs[folder][0],
            radius=portal_specs[folder][1],
            void_tint=portal_specs[folder][2],
            stabilize_texture=True,
            energy_source=portal_energy_style,
            energy_tint={
                "vault": (255, 190, 48),
                "forge": (255, 82, 8),
                "otter": (238, 24, 42),
            }[folder],
        )
        inactive = normalized[0] if folder == "vault" else frame
        for image, name in zip(
            (inactive, composites[0], composites[3], composites[6]),
            ("portal-inactive", "portal-active01", "portal-active02", "portal-active03"),
            strict=True,
        ):
            written.append(write_rgba(image, objects / folder / f"{name}.png"))
        written.append(write_rgba(frame, objects / folder / "portal-frame.png"))
        for phase, swirl in enumerate(swirls, start=1):
            written.append(write_rgba(swirl, objects / folder / f"portal-swirl{phase:02d}.png"))
    group(portals[12:14], 192, "center", "boss", ("floorseal-phase01", "floorseal-phase02"))
    group(portals[14:16], 64, "center", "boss", ("relief-north", "relief-south"))
    if len(written) != 61:
        raise ValueError(f"expected 61 prop assets, wrote {len(written)}")
    return written


def profile_data() -> dict[str, dict[str, object]]:
    profiles: dict[str, dict[str, object]] = {}
    def add(key: str, size: int, anchor: str, layer: str) -> None:
        profiles[key] = {"anchor": anchor, "layer": layer, "width": size, "height": size}
    for index in range(1, 5): add(
        f"object.merchant.idle{index:02d}", MERCHANT_PROFILE_SIZE, "bottom-center", "objects"
    )
    for state in ("dormant", "ready01", "ready02", "used"): add(f"object.forge.{state}", 192, "bottom-center", "objects")
    for state in ("dormant", "ready01", "ready02", "used"): add(f"object.pact.{state}", 128, "bottom-center", "objects")
    for state in ("blocked", "cleared"): add(f"object.vault.seal.{state}", 128, "center", "decals")
    for state in ("blocked", "cleared"): add(f"object.otter.seal.{state}", 128, "center", "decals")
    for group in ("vault", "otter", "forge"):
        for state in ("inactive", "active01", "active02", "active03"): add(f"object.{group}.portal.{state}", 128, "bottom-center", "objects")
        add(f"object.{group}.portal.frame", 128, "bottom-center", "objects")
        for phase in range(1, 9): add(f"object.{group}.portal.swirl{phase:02d}", 128, "bottom-center", "objects")
    for state in ("ready", "opened"): add(f"object.otter.chest.{state}", 64, "bottom-center", "objects")
    for state in ("phase01", "phase02"): add(f"object.boss.floorseal.{state}", 192, "center", "decals")
    for state in ("north", "south"): add(f"object.boss.relief.{state}", 64, "center", "decals")
    return dict(sorted(profiles.items()))


def validate_outputs(paths: list[Path]) -> None:
    if len(paths) != 142:
        raise ValueError(f"expected 142 final PNGs, wrote {len(paths)}")
    for path in paths:
        with Image.open(path) as image:
            if image.mode != "RGBA" or image.width != image.height or image.width not in (64, 128, 192, 576):
                raise ValueError(f"invalid final PNG contract: {path} {image.mode} {image.size}")
            rgba = image.convert("RGBA")
            BASE["validate_chroma_policy"](rgba, path)
            visible = sum(alpha > 0 for *_rgb, alpha in rgba.get_flattened_data())
            if visible < image.width * image.height * 0.03:
                raise ValueError(f"asset lost meaningful coverage: {path}")


def source_descriptor(path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        return {
            "sha256": sha256(path),
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
        }


def create_lock(sources: dict[str, Path], normalized: dict[str, Path], assets: list[Path], staged_root: Path, helper_hash: str, profile: Path) -> dict[str, object]:
    return {
        "pipelineSchema": PIPELINE_SCHEMA,
        "pillowVersion": PILLOW_VERSION,
        "helper": {"sha256": helper_hash},
        "sources": {
            path.relative_to(ROOT).as_posix(): source_descriptor(path)
            for path in sources.values()
        },
        "normalizedAtlases": {
            target.relative_to(staged_root).as_posix(): sha256(target) for target in normalized.values()
        },
        "metadata": {"assets/hd/objects/room-profiles.json": sha256(profile)},
        "assets": {
            f"assets/hd/{asset.relative_to(staged_root / 'assets/hd').as_posix()}": sha256(asset)
            for asset in sorted(assets)
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--update-lock", action="store_true")
    return parser.parse_args()


def create_invocation_work_root() -> Path:
    allowed_parent = (ROOT / "art/work").resolve()
    work_parent = WORK_PARENT.resolve()
    if allowed_parent not in work_parent.parents:
        raise ValueError(f"work parent must stay inside {allowed_parent}")
    work_root = work_parent / f"{os.getpid()}-{uuid.uuid4().hex}"
    resolved_work = work_root.resolve()
    if work_parent not in resolved_work.parents:
        raise ValueError(f"invocation work root must stay inside {work_parent}")
    work_root.mkdir(parents=True, exist_ok=False)
    return work_root


def main() -> None:
    args = parse_args()
    if PILLOW_VERSION != SUPPORTED_PILLOW_VERSION:
        raise RuntimeError(f"Pillow must be {SUPPORTED_PILLOW_VERSION}, received {PILLOW_VERSION}")
    helper = Path.home() / ".codex/skills/.system/imagegen/scripts/remove_chroma_key.py"
    helper_hash = BASE["verify_toolchain"](helper)
    sources = {name: SOURCE_ROOT / name for name in SOURCE_HASHES}
    hazard_source_root = ROOT / "art/source/abyssal-gothic-hd"
    for name in ("hazard-spikes-source-original.png", "hazard-mine-source-original.png"):
        sources[name] = hazard_source_root / name
    for name, expected in SOURCE_HASHES.items():
        BASE["verify_source"](sources[name], expected)
    common_portal_source = ROOT / "art/source/abyssal-gothic-hd/common-portal-source-original-1254.png"
    BASE["verify_source"](common_portal_source, BASE["EXPECTED_COMMON_PORTAL_SOURCE_SHA256"])
    sources[common_portal_source.name] = common_portal_source
    brazier_source = BASE["brazier_source_path"]()
    BASE["verify_brazier_source"](brazier_source)
    sources["brazier-atlas-source-original.png"] = brazier_source
    classic_floor_source = BASE["classic_floor_source_path"]()
    BASE["verify_classic_floor_source"](classic_floor_source)
    sources["classic-floor-tileset.png"] = classic_floor_source

    work_root = create_invocation_work_root()
    try:
        staged = work_root / "staged"
        normalized: dict[str, Path] = {}
        keyed: dict[str, list[Image.Image]] = {}
        for name in ATLAS_SOURCES:
            stem = name.replace("-source-original.png", "-source-1024.png")
            normalized[name] = staged / f"art/source/task8-hd/{stem}"
            keyed[name] = key_atlas(sources[name], normalized[name], work_root / name.removesuffix(".png"), helper)
        # Preserve a deterministic normalized copy of the single merchant seed too.
        seed_name = "merchant-seed-source-original.png"
        normalized[seed_name] = staged / "art/source/task8-hd/merchant-seed-source-1024.png"
        normalize_source(sources[seed_name], normalized[seed_name])

        hazard_sources: dict[str, Image.Image] = {}
        for kind in ("spikes", "mine"):
            name = f"hazard-{kind}-source-original.png"
            normalized[name] = staged / f"art/source/abyssal-gothic-hd/hazard-{kind}-source-1024.png"
            normalize_source(sources[name], normalized[name])
            keyed_path = work_root / f"hazard-{kind}-keyed.png"
            BASE["run_chroma_helper"](normalized[name], keyed_path, helper)
            with Image.open(keyed_path) as keyed_source:
                hazard = BASE["remove_residual_chroma"](keyed_source.convert("RGBA"))
            BASE["validate_chroma_policy"](hazard, keyed_path)
            hazard_sources[kind] = hazard

        vault_seals: list[Image.Image] = []
        for state in ("blocked", "cleared"):
            name = f"vault-seal-{state}-source-original.png"
            normalized[name] = staged / f"art/source/task8-hd/vault-seal-{state}-source-1024.png"
            normalize_source(sources[name], normalized[name])
            keyed_path = work_root / f"vault-seal-{state}-keyed.png"
            BASE["run_chroma_helper"](normalized[name], keyed_path, helper)
            with Image.open(keyed_path) as keyed_source:
                keyed_seal = BASE["remove_residual_chroma"](keyed_source.convert("RGBA"))
            BASE["validate_chroma_policy"](keyed_seal, keyed_path)
            vault_seals.append(keyed_seal)

        special_portals: dict[str, Image.Image] = {}
        for folder in ("forge", "otter"):
            name = f"{folder}-portal-source-original.png"
            normalized[name] = staged / f"art/source/task8-hd/{folder}-portal-source-1024.png"
            source_rgb = normalize_source(sources[name], normalized[name])
            keyed_path = work_root / f"{folder}-portal-keyed.png"
            BASE["run_chroma_helper"](normalized[name], keyed_path, helper)
            with Image.open(keyed_path) as keyed_source:
                keyed_portal = BASE["remove_residual_chroma"](keyed_source.convert("RGBA"))
            keyed_portal = BASE["restore_intended_magic"](source_rgb, keyed_portal)
            keyed_portal = BASE["remove_residual_chroma"](keyed_portal)
            BASE["validate_chroma_policy"](keyed_portal, keyed_path)
            special_portals[folder] = keyed_portal

        forge_room_name = "forge-room-source-original.png"
        normalized[forge_room_name] = staged / "art/source/task8-hd/forge-room-source-1024.png"
        forge_room_source = normalize_source(sources[forge_room_name], normalized[forge_room_name])

        vault_room_name = "vault-room-source-original.png"
        normalized[vault_room_name] = staged / "art/source/task8-hd/vault-room-source-1024.png"
        vault_room_source = normalize_source(sources[vault_room_name], normalized[vault_room_name])

        otter_room_name = "otter-room-source-original.png"
        normalized[otter_room_name] = staged / "art/source/task8-hd/otter-room-source-1024.png"
        otter_room_source = normalize_source(sources[otter_room_name], normalized[otter_room_name])

        descent_room_sources: list[Image.Image] = []
        for index in range(1, 4):
            name = f"descent-room-{index:02d}-source-original.png"
            normalized[name] = staged / f"art/source/task8-hd/descent-room-{index:02d}-source-1024.png"
            descent_room_sources.append(normalize_source(sources[name], normalized[name]))

        corruption_room_sources: list[Image.Image] = []
        for index in range(1, 4):
            name = f"corruption-room-{index:02d}-source-original.png"
            normalized[name] = staged / f"art/source/task8-hd/corruption-room-{index:02d}-source-1024.png"
            corruption_room_sources.append(normalize_source(sources[name], normalized[name]))

        abyss_room_sources: list[Image.Image] = []
        for index in range(1, 4):
            name = f"abyss-room-{index:02d}-source-original.png"
            normalized[name] = staged / f"art/source/task8-hd/abyss-room-{index:02d}-source-1024.png"
            abyss_room_sources.append(normalize_source(sources[name], normalized[name]))

        boss_room_sources: dict[str, Image.Image] = {}
        for theme in ("descent", "corruption", "abyss"):
            name = f"{theme}-boss-room-source-original.png"
            normalized[name] = staged / f"art/source/task8-hd/{theme}-boss-room-source-1024.png"
            boss_room_sources[theme] = normalize_source(sources[name], normalized[name])

        forge_setpiece_name = "forge-setpiece-source-original.png"
        normalized[forge_setpiece_name] = staged / "art/source/task8-hd/forge-setpiece-source-1024.png"
        forge_setpiece_rgb = normalize_source(sources[forge_setpiece_name], normalized[forge_setpiece_name])
        forge_setpiece_keyed_path = work_root / "forge-setpiece-keyed.png"
        BASE["run_chroma_helper"](normalized[forge_setpiece_name], forge_setpiece_keyed_path, helper)
        with Image.open(forge_setpiece_keyed_path) as keyed_source:
            forge_setpiece = BASE["remove_residual_chroma"](keyed_source.convert("RGBA"))
        forge_setpiece = BASE["restore_intended_magic"](forge_setpiece_rgb, forge_setpiece)
        forge_setpiece = BASE["remove_residual_chroma"](forge_setpiece)
        BASE["validate_chroma_policy"](forge_setpiece, forge_setpiece_keyed_path)

        common_portal_normalized = work_root / "common-portal-style-source-1024.png"
        common_portal_rgb = normalize_source(common_portal_source, common_portal_normalized)
        common_portal_keyed_path = work_root / "common-portal-style-keyed.png"
        BASE["run_chroma_helper"](common_portal_normalized, common_portal_keyed_path, helper)
        with Image.open(common_portal_keyed_path) as keyed_source:
            common_portal_keyed = BASE["remove_residual_chroma"](keyed_source.convert("RGBA"))
        common_portal_keyed = BASE["restore_intended_magic"](common_portal_rgb, common_portal_keyed)
        common_portal_keyed = BASE["remove_residual_chroma"](common_portal_keyed)
        BASE["validate_chroma_policy"](common_portal_keyed, common_portal_keyed_path)
        portal_energy_style = BASE["portal_source_canvas"](common_portal_keyed, aperture=(512, 512))

        staged_assets = staged / "assets/hd"
        brazier_atlas = BASE["key_brazier_atlas"](
            brazier_source,
            work_root / "brazier-atlas-keyed.png",
            helper,
        )
        with Image.open(classic_floor_source) as source:
            classic_tileset = source.convert("RGBA")
        assets = []
        assets += build_environment(
            "corruption", keyed["corruption-env-source-original.png"], staged_assets, brazier_atlas, classic_tileset
        )
        assets += build_environment(
            "abyss", keyed["abyss-env-source-original.png"], staged_assets, brazier_atlas, classic_tileset
        )
        assets += [build_theme_spike(theme, hazard_sources["spikes"], staged_assets) for theme in ("corruption", "abyss")]
        for theme in ("corruption", "abyss"):
            assets += build_theme_mines(theme, hazard_sources["mine"], staged_assets)
        forge_room = forge_room_source.resize((576, 576), Image.Resampling.LANCZOS).convert("RGBA")
        assets.append(write_rgba(forge_room, staged_assets / "environment/forge/room.png"))
        vault_room = vault_room_source.resize((576, 576), Image.Resampling.LANCZOS).convert("RGBA")
        assets.append(write_rgba(vault_room, staged_assets / "environment/vault/room.png"))
        otter_room = otter_room_source.resize((576, 576), Image.Resampling.LANCZOS).convert("RGBA")
        assets.append(write_rgba(otter_room, staged_assets / "environment/otter/room.png"))
        for index, source in enumerate(descent_room_sources, start=1):
            room = source.resize((576, 576), Image.Resampling.LANCZOS).convert("RGBA")
            assets.append(write_rgba(room, staged_assets / f"environment/descent/room-{index:02d}.png"))
        for index, source in enumerate(corruption_room_sources, start=1):
            room = source.resize((576, 576), Image.Resampling.LANCZOS).convert("RGBA")
            assets.append(write_rgba(room, staged_assets / f"environment/corruption/room-{index:02d}.png"))
        for index, source in enumerate(abyss_room_sources, start=1):
            room = source.resize((576, 576), Image.Resampling.LANCZOS).convert("RGBA")
            assets.append(write_rgba(room, staged_assets / f"environment/abyss/room-{index:02d}.png"))
        for theme, source in boss_room_sources.items():
            room = source.resize((576, 576), Image.Resampling.LANCZOS).convert("RGBA")
            assets.append(write_rgba(room, staged_assets / f"environment/{theme}/boss-room.png"))
        assets += build_props(
            keyed["core-props-source-original.png"],
            keyed["portals-boss-source-original.png"],
            vault_seals,
            special_portals,
            portal_energy_style,
            forge_setpiece,
            staged_assets,
        )
        validate_outputs(assets)
        profile_path = staged_assets / "objects/room-profiles.json"
        profile_path.parent.mkdir(parents=True, exist_ok=True)
        profile_path.write_text(json.dumps(profile_data(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
        lock_data = create_lock(sources, normalized, assets, staged, helper_hash, profile_path)
        staged_lock = staged / "art/source/task8-hd/room-assets.lock.json"
        if args.update_lock:
            staged_lock.parent.mkdir(parents=True, exist_ok=True)
            staged_lock.write_text(json.dumps(lock_data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        else:
            if not LOCK_PATH.is_file() or json.loads(LOCK_PATH.read_text(encoding="utf-8")) != lock_data:
                raise ValueError("staged Task 8 assets do not match room-assets.lock.json")

        if args.check:
            print(f"Verified Pillow version: {PILLOW_VERSION}")
            print(f"Verified helper SHA256: {helper_hash}")
            print(f"Lock verification passed: {LOCK_PATH}")
            return

        pairs: list[tuple[Path, Path]] = []
        pairs += [(path, ROOT / path.relative_to(staged)) for path in normalized.values()]
        pairs += [(path, OUTPUT_ROOT / path.relative_to(staged_assets)) for path in assets]
        pairs.append((profile_path, OUTPUT_ROOT / "objects/room-profiles.json"))
        if args.update_lock: pairs.append((staged_lock, LOCK_PATH))
        BASE["publish_transaction"](pairs, work_root)
        print(f"Published {len(assets)} Task 8 PNGs")
        print(f"Verified source hashes: {len(sources)}")
        print(f"Lock verification passed: {LOCK_PATH}")
    finally:
        if work_root.exists(): shutil.rmtree(work_root)


if __name__ == "__main__":
    main()
