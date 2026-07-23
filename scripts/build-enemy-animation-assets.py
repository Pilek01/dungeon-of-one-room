#!/usr/bin/env python3
"""Build the approved 400-frame HD enemy roster deterministically."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile

from PIL import Image, ImageChops, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parents[1]
PLAYER_BUILDER = ROOT / "scripts/build-player-animation-assets.py"
_SPEC = importlib.util.spec_from_file_location("_player_asset_pipeline", PLAYER_BUILDER)
if _SPEC is None or _SPEC.loader is None:
    raise RuntimeError("cannot load the pinned player sprite pipeline")
PIPE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(PIPE)

SCHEMA_VERSION = 1
KEY = (255, 0, 255)
FRAME_SIZE = 64
FRAME_ROOT = (32, 60)
MAX_FRAME_BOUNDS = (58, 58)
MEANINGFUL_AREA = 500
ROSTER = ("slime", "skeleton", "brute", "acolyte", "skitter", "totem", "otter")
MOBILE = tuple(name for name in ROSTER if name != "totem")
DIRECTIONS = ("south", "north", "east", "west")
MOBILE_CLIPS = (("idle", 4, 4, True), ("move", 4, 8, True), ("attack", 4, 12, False), ("hit", 2, 10, False), ("death", 2, 6, False))
TOTEM_CLIPS = (("idle", 4, 4, True), ("awaken", 4, 8, False), ("cast", 4, 10, False), ("hit", 2, 10, False), ("death", 2, 6, False))
LOCK_REL = "art/source/enemy-hd/enemy-animation-assets.lock.json"
LAYOUT_REL = "art/source/enemy-hd/enemy-animation-source-layout.json"
CONTACT_REL = "art/source/enemy-hd/enemy-animation-contact-sheet.png"
SLOTS = tuple(f"R{row}C{column}" for row in range(1, 5) for column in range(1, 5))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(value: object, path: Path, *, sort_keys: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=sort_keys) + "\n", encoding="utf8", newline="\n")


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False, compress_level=9)


def directions_for(actor: str) -> tuple[str, ...]:
    return ("base",) if actor == "totem" else DIRECTIONS


def clips_for(actor: str):
    return TOTEM_CLIPS if actor == "totem" else MOBILE_CLIPS


def source_rel(actor: str, direction: str) -> str:
    return f"art/source/enemy-hd/{actor}/{actor}-animation-{direction}-source-1024.png"


def normalized_rel(actor: str, direction: str) -> str:
    return f"art/source/enemy-hd/{actor}/{actor}-animation-{direction}-normalized-1024.png"


def frame_records(actor: str | None = None) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    actors = (actor,) if actor else ROSTER
    for name in actors:
        for direction in directions_for(name):
            slot = 0
            for clip, count, _fps, _loop in clips_for(name):
                for frame in range(1, count + 1):
                    suffix = f"{frame:02d}"
                    records.append({
                        "type": name, "direction": direction, "clip": clip, "frame": frame, "slot": slot,
                        "key": f"enemy.{name}.{direction}.{clip}.{suffix}",
                        "src": f"assets/hd/enemies/{name}/frames/{direction}-{clip}-{suffix}.png",
                    })
                    slot += 1
    return records


def _clean_small(image: Image.Image):
    components = PIPE.connected_components(image)
    meaningful = [item for item in components if int(item["area"]) >= MEANINGFUL_AREA]
    small = [item for item in components if int(item["area"]) < MEANINGFUL_AREA]
    cleaned = image.copy()
    pixels = cleaned.load()
    for component in small:
        for index in component["points"]:
            pixels[index % cleaned.width, index // cleaned.width] = (0, 0, 0, 0)
    return cleaned, components, meaningful, small


def analyze_sheet(label: str, image: Image.Image, detected_key: str, *, allow_bbox_crossing: bool = False):
    cleaned, components, meaningful, small = _clean_small(image)
    if len(meaningful) != 16:
        raise ValueError(f"{label}: expected exactly 16 meaningful components, received {len(meaningful)}")
    column_centers, column_assignment = PIPE.cluster_axis(meaningful, 0)
    row_centers, row_assignment = PIPE.cluster_axis(meaningful, 1)
    slots = {name: [] for name in SLOTS}
    for index, component in enumerate(meaningful):
        row = row_assignment[index]
        column = column_assignment[index]
        left, top, right, bottom = component["bounds"]
        cx, cy = (left + right) / 2, (top + bottom) / 2
        x_distances = sorted(abs(cx - center) for center in column_centers)
        y_distances = sorted(abs(cy - center) for center in row_centers)
        if x_distances[1] - x_distances[0] < 8 or y_distances[1] - y_distances[0] < 8:
            raise ValueError(f"{label}: ambiguous component centroid in semantic grid")
        slots[f"R{row + 1}C{column + 1}"].append(component)
    invalid = [name for name, values in slots.items() if len(values) != 1]
    if invalid:
        raise ValueError(f"{label}: expected one meaningful component per slot: {invalid}")
    crossing = PIPE.find_crossing_components(slots)
    if crossing and not allow_bbox_crossing:
        raise ValueError(f"{label}: {len(crossing)} components cross semantic bounding boxes")

    crops = []
    slot_report = {}
    for name in SLOTS:
        component = slots[name][0]
        left, top, right, bottom = component["bounds"]
        pad = 12
        box = (max(0, left-pad), max(0, top-pad), min(cleaned.width, right+pad+1), min(cleaned.height, bottom+pad+1))
        isolated = Image.new("RGBA", cleaned.size, (0, 0, 0, 0))
        source_pixels, target_pixels = cleaned.load(), isolated.load()
        for index in component["points"]:
            x, y = index % cleaned.width, index // cleaned.width
            target_pixels[x, y] = source_pixels[x, y]
        crop = isolated.crop(box)
        crops.append(crop)
        slot_report[name] = {"meaningfulComponentCount": 1, "area": component["area"], "bounds": component["bounds"]}
    return crops, {
        "helperDetectedKey": detected_key, "semanticLayout": "4x4", "rawComponentCount": len(components),
        "meaningfulComponentCount": len(meaningful), "removedSmallComponentCount": len(small),
        "crossingComponentCount": len(crossing), "bboxCrossingAcceptedForComponentNormalization": bool(crossing and allow_bbox_crossing),
        "columnCenters": [round(value, 3) for value in column_centers], "rowCenters": [round(value, 3) for value in row_centers],
        "slots": slot_report,
    }


def composite_normalized(crops: list[Image.Image], destination: Path) -> None:
    sheet = Image.new("RGB", (1024, 1024), KEY)
    for index, crop in enumerate(crops):
        box = crop.getchannel("A").getbbox()
        if box is None:
            raise ValueError(f"normalized source slot {index + 1} is empty")
        silhouette = crop.crop(box)
        scale = min(224 / silhouette.width, 224 / silhouette.height)
        size = (max(1, round(silhouette.width * scale)), max(1, round(silhouette.height * scale)))
        rgba = silhouette.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")
        cell = Image.new("RGB", (256, 256), KEY)
        cell.paste(rgba.convert("RGB"), ((256-size[0])//2, (256-size[1])//2), rgba.getchannel("A"))
        row, column = divmod(index, 4)
        sheet.paste(cell, (column*256, row*256))
    save_png(sheet, destination)


def validate_normalized(label: str, normalized: Path) -> dict[str, object]:
    with Image.open(normalized) as source:
        rgb = source.convert("RGB")
    red, green, blue = rgb.split()
    difference = Image.eval(red, lambda value: 255 - value)
    difference = ImageChops.lighter(difference, green)
    blue_difference = Image.eval(blue, lambda value: 255 - value)
    difference = ImageChops.lighter(difference, blue_difference)
    alpha = difference.point(lambda value: 255 if value else 0)
    keyed = rgb.convert("RGBA"); keyed.putalpha(alpha)
    _crops, report = analyze_sheet(label + "/normalized", keyed, "#ff00ff-exact")
    if report["crossingComponentCount"] != 0:
        raise ValueError(f"{label}: normalized sheet still crosses slots")
    for row in range(1, 5):
        for column in range(1, 4):
            left = report["slots"][f"R{row}C{column}"]["bounds"]
            right = report["slots"][f"R{row}C{column+1}"]["bounds"]
            if right[0] - left[2] - 1 < 24: raise ValueError(f"{label}: normalized horizontal padding below 24px")
    for column in range(1, 5):
        for row in range(1, 4):
            upper = report["slots"][f"R{row}C{column}"]["bounds"]
            lower = report["slots"][f"R{row+1}C{column}"]["bounds"]
            if lower[1] - upper[3] - 1 < 24: raise ValueError(f"{label}: normalized vertical padding below 24px")
    return report


def normalize_actor_frames(actor: str, crops_by_direction: dict[str, list[Image.Image]], staged: Path):
    bounds = {}
    max_width = max_height = 0
    for direction, crops in crops_by_direction.items():
        for index, crop in enumerate(crops):
            box = crop.getchannel("A").getbbox()
            if box is None:
                raise ValueError(f"{actor}/{direction}/slot-{index+1}: empty")
            bounds[(direction, index)] = box
            max_width = max(max_width, box[2]-box[0]); max_height = max(max_height, box[3]-box[1])
    scale = min(MAX_FRAME_BOUNDS[0]/max_width, MAX_FRAME_BOUNDS[1]/max_height)
    metrics = []
    for record in frame_records(actor):
        direction, slot = str(record["direction"]), int(record["slot"])
        source = crops_by_direction[direction][slot]
        silhouette = source.crop(bounds[(direction, slot)])
        width, height = max(1, round(silhouette.width*scale)), max(1, round(silhouette.height*scale))
        resized = silhouette.convert("RGBa").resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
        canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(resized, (FRAME_ROOT[0]-width//2, FRAME_ROOT[1]-height+1))
        pixels = canvas.load()
        exact = near = 0
        for y in range(FRAME_SIZE):
            for x in range(FRAME_SIZE):
                r,g,b,a = pixels[x,y]
                if a == 0 or (r,g,b) == KEY or (a <= 128 and (r-255)**2+g**2+(b-255)**2 <= 48**2 and r-g >= 96 and b-g >= 96 and abs(r-b) <= 64):
                    pixels[x,y] = (0,0,0,0)
        for r,g,b,a in canvas.get_flattened_data():
            exact += int(a > 0 and (r,g,b) == KEY)
            near += int(a > 0 and r >= 240 and b >= 240 and g <= 20)
        if exact or near:
            raise ValueError(f"{record['key']}: chroma residue exact={exact} near={near}")
        save_png(canvas, staged / str(record["src"]))
        visible = canvas.getchannel("A").getbbox()
        metrics.append({"key": record["key"], "bounds": list(visible) if visible else None})
    return {"sharedScale": scale, "sourceMaxBounds": [max_width, max_height], "frames": metrics}


def write_manifest(actor: str, staged: Path) -> str:
    relative = f"assets/hd/enemies/{actor}/{actor}-manifest.json"
    frames = []
    for record in frame_records(actor):
        frames.append({key: record[key] for key in ("type", "direction", "clip", "frame", "key", "src")} | {"group": "enemies", "critical": True})
    clips = [{"name": name, "frameCount": count, "fps": fps, "loop": loop} for name, count, fps, loop in clips_for(actor)]
    write_json({"schemaVersion": 1, "type": actor, "frameSize": [64,64], "renderSize": [64,64], "anchor": [0.5,1], "group": "enemies", "clips": clips, "frames": frames}, staged / relative)
    return relative


def render_contacts(staged: Path) -> list[str]:
    outputs = []
    all_records = frame_records()
    combined = Image.new("RGBA", (1024, 25*64), (18,14,25,255))
    for global_index, record in enumerate(all_records):
        with Image.open(staged / str(record["src"])) as frame:
            row, column = divmod(global_index, 16)
            combined.alpha_composite(frame.convert("RGBA"), (column*64,row*64))
    save_png(combined, staged / CONTACT_REL); outputs.append(CONTACT_REL)
    for actor in ROSTER:
        records = frame_records(actor)
        rows = (len(records)+15)//16
        canvas = Image.new("RGBA", (1024, rows*64), (18,14,25,255))
        for index, record in enumerate(records):
            with Image.open(staged / str(record["src"])) as frame:
                row,column=divmod(index,16); canvas.alpha_composite(frame.convert("RGBA"),(column*64,row*64))
        rel=f"art/source/enemy-hd/{actor}/{actor}-animation-contact-sheet.png"
        save_png(canvas, staged/rel); outputs.append(rel)
    return outputs


def publish(pairs: list[tuple[Path, Path]], work: Path) -> None:
    backups, created, replaced = {}, set(), []
    backup_root = work / "backups"; backup_root.mkdir(parents=True, exist_ok=True)
    try:
        for index, (_source, target) in enumerate(pairs):
            if target.exists():
                backup=backup_root/f"{index:04d}-{target.name}"; shutil.copy2(target,backup); backups[target]=backup
            else: created.add(target)
        for source,target in pairs:
            target.parent.mkdir(parents=True,exist_ok=True); os.replace(source,target); replaced.append(target)
    except Exception:
        for target in reversed(replaced):
            if target in backups: os.replace(backups[target],target)
            elif target in created: target.unlink(missing_ok=True)
        raise


def parse_args():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check",action="store_true"); parser.add_argument("--update-lock",action="store_true")
    parser.add_argument("--helper",type=Path,default=Path.home()/".codex/skills/.system/imagegen/scripts/remove_chroma_key.py")
    args=parser.parse_args()
    if args.check and args.update_lock: parser.error("--check and --update-lock are mutually exclusive")
    return args


def main() -> int:
    args=parse_args(); lock_path=ROOT/LOCK_REL
    source_paths=[source_rel(actor,direction) for actor in ROSTER for direction in directions_for(actor)]
    if args.check:
        if not lock_path.is_file(): raise FileNotFoundError(f"missing lock: {LOCK_REL}")
        committed=json.loads(lock_path.read_text(encoding="utf8"))
        for relative,digest in committed["sourceSheets"].items():
            if not (ROOT/relative).is_file() or sha256(ROOT/relative)!=digest: raise ValueError(f"source bytes changed: {relative}")
        if sha256(PLAYER_BUILDER) != committed["helper"]["playerBuilderSha256"]:
            raise ValueError("imported player builder helper changed")
    helper_hash=PIPE.verify_toolchain(args.helper)
    work_parent=ROOT/"art/work/enemy-animation-build"; work_parent.mkdir(parents=True,exist_ok=True)
    work=Path(tempfile.mkdtemp(prefix=f"{os.getpid()}-",dir=work_parent)); staged=work/"staged"
    try:
        def key_one(relative: str):
            actor_direction = Path(relative).stem.replace("-animation-", "-").replace("-source-1024", "")
            return relative, PIPE.key_source(ROOT/relative, work/f"{actor_direction}-keyed.png", args.helper)
        with ThreadPoolExecutor(max_workers=4) as executor:
            keyed_sources = dict(executor.map(key_one, source_paths))
        layout={"schemaVersion":1,"sources":{}}; metrics={}; output_rels=[]
        for actor in ROSTER:
            crops_by_direction={}
            for direction in directions_for(actor):
                relative=source_rel(actor,direction); source=ROOT/relative
                if not source.is_file(): raise FileNotFoundError(f"missing source: {relative}")
                with Image.open(source) as raw:
                    if raw.size!=(1254,1254) or raw.mode!="RGB": raise ValueError(f"{relative}: expected 1254x1254 RGB")
                keyed,detected=keyed_sources[relative]
                workaround=actor=="otter" and direction=="west"
                crops,report=analyze_sheet(f"{actor}/{direction}",keyed,detected,allow_bbox_crossing=workaround)
                if workaround and not report["bboxCrossingAcceptedForComponentNormalization"]:
                    report["bboxCrossingAcceptedForComponentNormalization"]=False
                norm_rel=normalized_rel(actor,direction); composite_normalized(crops,staged/norm_rel)
                report["normalizedGate"]=validate_normalized(f"{actor}/{direction}",staged/norm_rel)
                report["identity"]={"path":relative,"sha256":sha256(source),"width":1254,"height":1254,"mode":"RGB"}
                layout["sources"][f"{actor}/{direction}"]=report; crops_by_direction[direction]=crops; output_rels.append(norm_rel)
            metrics[actor]=normalize_actor_frames(actor,crops_by_direction,staged)
            output_rels.extend(str(item["src"]) for item in frame_records(actor)); output_rels.append(write_manifest(actor,staged))
        write_json(layout,staged/LAYOUT_REL); output_rels.append(LAYOUT_REL); output_rels.extend(render_contacts(staged))
        next_lock={
            "schemaVersion":1,"pipelineSchema":SCHEMA_VERSION,"chromaKey":"#ff00ff","frameSize":[64,64],"anchor":[0.5,1],
            "pillowVersion":PILLOW_VERSION,"helper":{"path":args.helper.name,"sha256":helper_hash,"playerBuilderSha256":sha256(PLAYER_BUILDER)},
            "sourceSheets":{relative:sha256(ROOT/relative) for relative in source_paths},
            "normalization":{"bottomCenterRoot":list(FRAME_ROOT),"maxFrameBounds":list(MAX_FRAME_BOUNDS),"meaningfulComponentArea":MEANINGFUL_AREA,"otterWestPolicy":"16 disconnected components; centroid slot assignment; alpha component mask; 224px normalized extent; strict normalized gate"},
            "metrics":metrics,"outputs":{relative:sha256(staged/relative) for relative in output_rels},
        }
        if args.update_lock:
            write_json(next_lock,staged/LOCK_REL,sort_keys=True)
            publish([(staged/relative,ROOT/relative) for relative in output_rels]+[(staged/LOCK_REL,lock_path)],work)
            print("Published 400 enemy frames and updated immutable source/build lock"); return 0
        expected=json.loads(lock_path.read_text(encoding="utf8"))
        if next_lock!=expected: raise ValueError("rebuilt enemy animation assets do not match committed lock")
        for relative,digest in expected["outputs"].items():
            if not (ROOT/relative).is_file() or sha256(ROOT/relative)!=digest: raise ValueError(f"published output changed: {relative}")
        print("Enemy animation lock verification passed"); return 0
    finally:
        shutil.rmtree(work,ignore_errors=True)
        try: work_parent.rmdir()
        except OSError: pass


if __name__ == "__main__":
    raise SystemExit(main())
