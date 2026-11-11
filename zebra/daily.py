"""Append immutable dated puzzles; backfill gaps and prepare a seven-day buffer."""
import argparse
import json
import os
import random
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from build import ROOT, read_json, validate
from generator import generate_puzzle

START = '2026-11-11'


def signature(p):
    return json.dumps(p['solution'], sort_keys=True, ensure_ascii=False)


def generate(through=None):
    end = through or (datetime.now(ZoneInfo('Asia/Shanghai')).date() + timedelta(days=7)).isoformat()
    path = ROOT / 'data/daily.json'
    archive = json.loads(path.read_text()) if path.exists() else []
    dates = {p['date'] for p in archive}
    used = {signature(p) for items in read_json('free.json').values() for p in items}
    used.update(signature(p) for p in read_json('legacy_daily.json'))
    used.update(signature(p) for p in archive)
    day = datetime.fromisoformat(START).date()
    while day.isoformat() <= end:
        key = day.isoformat()
        if key not in dates:
            random.seed('leiden-daily-v2-' + key)
            theme = ['cat', 'alva'][day.toordinal() % 2]
            difficulty = ['easy', 'normal', 'hard'][day.toordinal() % 3]
            for attempt in range(100):
                puzzle = generate_puzzle(theme, difficulty)
                if signature(puzzle) not in used:
                    break
            else:
                raise RuntimeError('Cannot generate new puzzle for ' + key)
            puzzle.update(id='daily-v2-' + key, date=key)
            validate(puzzle)
            archive.append(puzzle)
            used.add(signature(puzzle))
            print('Generated', key, flush=True)
        day += timedelta(days=1)
    archive.sort(key=lambda p: p['date'])
    content = json.dumps(archive, ensure_ascii=False, indent=2) + '\n'
    if not path.exists() or path.read_text() != content:
        temp = path.with_suffix('.tmp')
        temp.write_text(content)
        os.replace(temp, path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--through', help='Last date to generate (YYYY-MM-DD)')
    args = parser.parse_args()
    generate(args.through)
