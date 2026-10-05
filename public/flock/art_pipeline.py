#!/usr/bin/env python3
"""Resume/pack/audit FLOCK art. Generation is performed by the connected imagegen tool."""
import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
CATALOG = ROOT / 'catalog.json'
MAX_BYTES = 200_000
SIZE = (720, 1080)


def read_catalog():
    return json.loads(CATALOG.read_text())


def summary(catalog):
    ready = sum(s['art']['status'] == 'ready' for d in catalog['dragons'] for s in d['stages'].values())
    complete = sum(all(s['art']['status'] == 'ready' for s in d['stages'].values()) for d in catalog['dragons'])
    return {'dragons': len(catalog['dragons']), 'ready': ready, 'missing': 3 * len(catalog['dragons']) - ready, 'completeDragons': complete}


def queue(catalog):
    pending = []
    for dragon in catalog['dragons']:
        priority = 0 if dragon['gameplay']['starter'] else 1 if dragon['rarity'] == 'legendary' else 2 if dragon['id'] in ('ashmaw', 'pyrestone', 'glacielle', 'stormveil', 'nyxshade') else 3
        for index, stage in enumerate(catalog['stageOrder'], 1):
            row = dragon['stages'][stage]
            if row['art']['status'] == 'ready':
                continue
            previous = None if index == 1 else dragon['stages'][catalog['stageOrder'][index - 2]]['art']
            # A stage may only be generated from an approved preceding stage.
            if previous and previous['status'] != 'ready':
                break
            pending.append({'id': dragon['id'], 'stage': stage, 'priority': priority, 'prompt': row['prompt'],
                            'reference': previous['path'] if previous else None,
                            'destination': f"img/{dragon['id']}-{index}.webp"})
            break
    return sorted(pending, key=lambda x: (x['priority'], x['id']))


def pack(catalog, ident, stage, source, review):
    dragon = next(d for d in catalog['dragons'] if d['id'] == ident)
    row = dragon['stages'][stage]
    index = row['index']
    if index > 1:
        previous = dragon['stages'][catalog['stageOrder'][index - 2]]['art']
        if previous['status'] != 'ready':
            raise ValueError('Approve the preceding reference stage first')
    im = Image.open(source).convert('RGB')
    # Refuse a grid/wrong ratio; split a real grid explicitly before invoking pack.
    if im.width * 3 != im.height * 2:
        raise ValueError(f'Expected a separate 2:3 portrait, got {im.size}; do not distort or crop a grid')
    im = im.resize(SIZE, Image.Resampling.LANCZOS)
    for quality in range(93, 39, -1):
        buffer = io.BytesIO()
        im.save(buffer, 'WEBP', quality=quality, method=6)
        payload = buffer.getvalue()
        if len(payload) <= MAX_BYTES:
            break
    else:
        raise ValueError('Cannot reach 200 KB without excessive compression')
    output = ROOT / f'img/{ident}-{index}.webp'
    output.parent.mkdir(exist_ok=True)
    output.write_bytes(payload)
    row['art'] = {'status': 'ready', 'path': f'img/{ident}-{index}.webp', 'source': 'imagegen',
                  'reference': f'img/{ident}-{index - 1}.webp' if index > 1 else None,
                  'sha256': hashlib.sha256(payload).hexdigest(), 'width': SIZE[0], 'height': SIZE[1],
                  'bytes': len(payload), 'quality': quality, 'reviewedBy': 'agent', 'review': review}
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    return {'path': str(output), 'bytes': len(payload), 'quality': quality, **summary(catalog)}


def audit(catalog):
    errors, seen, rows = [], set(), []
    for dragon in catalog['dragons']:
        stage_hashes = set()
        for stage in catalog['stageOrder']:
            row = dragon['stages'][stage]
            art = row['art']
            if art['status'] != 'ready':
                if art['path'] is not None:
                    errors.append(f"{dragon['id']}/{stage}: missing art has a live path")
                continue
            path = (ROOT / art['path']).resolve()
            if not path.is_relative_to(ROOT / 'img') or not path.exists():
                errors.append(f"{dragon['id']}/{stage}: invalid or missing file")
                continue
            payload = path.read_bytes()
            digest = hashlib.sha256(payload).hexdigest()
            with Image.open(path) as im:
                if im.format != 'WEBP' or im.width * 3 != im.height * 2 or len(payload) > MAX_BYTES:
                    errors.append(f'{path.name}: invalid format, ratio or byte budget')
                rows.append({'id': dragon['id'], 'stage': stage, 'path': art['path'], 'bytes': len(payload), 'width': im.width, 'height': im.height, 'sha256': digest})
            if digest in stage_hashes or digest in seen:
                errors.append(f'{path.name}: duplicate image passed off as a separate dragon/stage')
            stage_hashes.add(digest)
            seen.add(digest)
            if art.get('sha256') and art['sha256'] != digest:
                errors.append(f'{path.name}: checksum mismatch')
    return {**summary(catalog), 'errors': errors, 'files': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('queue')
    sub.add_parser('audit')
    p = sub.add_parser('pack')
    p.add_argument('--id', required=True)
    p.add_argument('--stage', choices=['hatchling', 'adult', 'titan'], required=True)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--review', required=True, help='Visual review after checking anatomy, text, element and identity')
    args = parser.parse_args()
    catalog = read_catalog()
    if args.command == 'pack':
        result = pack(catalog, args.id, args.stage, args.source, args.review)
    elif args.command == 'queue':
        result = queue(catalog)
    else:
        result = audit(catalog)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if isinstance(result, dict) and result.get('errors'):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
