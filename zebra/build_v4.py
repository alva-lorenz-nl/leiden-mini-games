"""Build the current front-end (src_v4) into a single-file page.

默认输出生产页 ../zebra_puzzle.html；加 --out 可另存一份试验页，
例如 `python3 build_v4.py --out ../zebra_puzzle_test.html`。
"""
import argparse
import json
import os
from pathlib import Path

import build as base
import generator_x as gx
from z3 import IntVal, is_true, simplify, substitute

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'src_v4'
DEST = ROOT.parent / 'zebra_puzzle.html'
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


def validate_x(p):
    """六列/加强题：用扩展生成器的求解器验一遍，线索在解上成立且解唯一。"""
    theme = gx.ALL_THEMES[p["theme_key"]]
    cats = list(p["categories"])
    n = len(p["categories"][cats[0]])
    solver, var_of = gx.make_solver(theme, cats, n)
    values = [
        (var_of[c][v], IntVal(i + 1))
        for c, row in p["solution"].items()
        for i, v in enumerate(row)
    ]
    for clue in p["raw_clues"]:
        expr = gx.clue_constraint(clue, var_of)
        if not is_true(simplify(substitute(expr, *values))):
            raise ValueError(f"不一致的线索: {p['id']}: {clue}")
        solver.add(expr)
    if not gx.unique(solver, var_of, cats, n):
        raise ValueError(f"解不唯一: {p['id']}")


def compact_x(p):
    return dict(
        id=p["id"],
        k=list(p["categories"]),
        n=p["clue_count"],
        c=p["clues"],
        r=p["raw_clues"],
        q=p["question"],
        a=p["answer"],
        s=p["solution"],
    )


def add_extra(bank):
    extra = base.read_json("extra.json")
    for key, puzzles in extra.items():
        theme = key.split("_")[0]
        first = puzzles[0]
        meta = bank["meta"].setdefault(
            theme, dict(title=first["theme"], intro=first["intro"], cats={})
        )
        meta["cats"].update(first["categories"])
        for p in puzzles:
            validate_x(p)
        bank["puzzles"][key] = [compact_x(p) for p in puzzles]
    return sum(len(v) for v in extra.values())


def build(dest=DEST):
    bank, free, daily = make_bank()
    extra_count = add_extra(bank)
    html = (SOURCE / 'page.html').read_text()
    html = html.replace('__CSS__', (SOURCE / 'style.css').read_text())
    html = html.replace(
        '__BANK__', json.dumps(bank, ensure_ascii=False, separators=(',', ':'))
    )
    html = html.replace(
        '__JS__', '\n'.join((SOURCE / (m + '.js')).read_text() for m in MODULES)
    )
    temporary = Path(dest).with_suffix('.tmp')
    temporary.write_text(html)
    os.replace(temporary, dest)
    print(
        f'Built {dest}: {sum(map(len, free.values()))} free, '
        f'{len(daily)} daily + {extra_count} extended puzzles validated.'
    )


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(DEST))
    build(Path(ap.parse_args().out).resolve())
