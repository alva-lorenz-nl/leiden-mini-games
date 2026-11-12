"""Build the test build (src_v4) into ../zebra_puzzle_test.html.

Same bank and same validation as the production build; only the front-end
sources differ. Production zebra_puzzle.html is never touched here.
"""
import json
import os
from pathlib import Path

import build as base

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'src_v4'
DEST = ROOT.parent / 'zebra_puzzle_test.html'
MODULES = base.MODULES


def make_bank():
    free = base.read_json('free.json')
    daily = base.read_json('daily.json')
    bank = dict(meta={}, puzzles={}, daily=[])
    for key, puzzles in free.items():
        theme = key.split('_')[0]
        first = puzzles[0]
        meta = bank['meta'].setdefault(
            theme, dict(title=first['theme'], intro=first['intro'], cats={})
        )
        meta['cats'].update(first['categories'])
        for p in puzzles:
            base.validate(p)
        bank['puzzles'][key] = [base.compact(p) for p in puzzles]
    for p in daily:
        base.validate(p)
        bank['daily'].append(base.compact(p, daily=True))
    story = base.read_json('story.json')
    for chapter in story:
        for stage in chapter['stages']:
            base.validate_story(stage)
    bank['story'] = story
    return bank, free, daily


def build():
    bank, free, daily = make_bank()
    html = (SOURCE / 'page.html').read_text()
    html = html.replace('__CSS__', (SOURCE / 'style.css').read_text())
    html = html.replace(
        '__BANK__', json.dumps(bank, ensure_ascii=False, separators=(',', ':'))
    )
    html = html.replace(
        '__JS__', '\n'.join((SOURCE / (m + '.js')).read_text() for m in MODULES)
    )
    temporary = DEST.with_suffix('.tmp')
    temporary.write_text(html)
    os.replace(temporary, DEST)
    print(
        f'Built {DEST}: {sum(map(len, free.values()))} free, '
        f'{len(daily)} daily puzzles validated.'
    )


if __name__ == '__main__':
    build()
