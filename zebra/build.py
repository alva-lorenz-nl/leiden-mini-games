"""Validate archived puzzles and build the standalone offline game."""
import json
import os
from pathlib import Path

from z3 import IntVal, is_true, simplify, substitute
from generator import THEMES, make_solver_for, clue_to_constraint, unique_solution, clue_to_text

ROOT = Path(__file__).resolve().parent
MODULES = [
    'core', 'generator', 'dom', 'records', 'clues', 'story', 'session',
    'board', 'home', 'achievements', 'modes', 'sync', 'events',
]


def read_json(name):
    return json.loads((ROOT / 'data' / name).read_text())


def validate(puzzle):
    categories = list(puzzle['categories'])
    solver, variables = make_solver_for(THEMES[puzzle['theme_key']], categories)
    values = [(variables[c][v], IntVal(i + 1))
              for c, row in puzzle['solution'].items() for i, v in enumerate(row)]
    for clue in puzzle['raw_clues']:
        expr = clue_to_constraint(clue, variables)
        if not is_true(simplify(substitute(expr, *values))):
            raise ValueError(f"Inconsistent clue: {puzzle['id']}: {clue}")
        solver.add(expr)
    if not unique_solution(solver, variables, categories):
        raise ValueError(f"Non-unique puzzle: {puzzle['id']}")


def validate_story(chapter):
    """校验自建故事章节：线索在解上成立，且解唯一。"""
    if 'src' in chapter:
        return
    p = chapter['puzzle']
    categories = list(p['k'])
    solver, variables = make_solver_for({'cats': p['cats']}, categories)
    values = [(variables[c][v], IntVal(i + 1))
              for c, row in p['s'].items() for i, v in enumerate(row)]
    for clue in p['r']:
        expr = clue_to_constraint(clue, variables)
        if not is_true(simplify(substitute(expr, *values))):
            raise ValueError(f"Inconsistent story clue: {p['id']}: {clue}")
        solver.add(expr)
    if not unique_solution(solver, variables, categories):
        raise ValueError(f"Non-unique story puzzle: {p['id']}")


def compact(p, daily=False):
    item = dict(id=p['id'] if daily else 'v2-' + p['id'],
                k=list(p['categories']), n=p['clue_count'], c=[clue_to_text(c) for c in p['raw_clues']], r=p['raw_clues'],
                q=p['question'], a=p['answer'], s=p['solution'])
    if daily:
        item.update(date=p['date'], theme=p['theme_key'], diff=p['difficulty'])
    return item


def build():
    free = read_json('free.json')
    daily = read_json('daily.json')
    bank = dict(meta={}, puzzles={}, daily=[])
    for key, puzzles in free.items():
        theme = key.split('_')[0]
        first = puzzles[0]
        meta = bank['meta'].setdefault(theme, dict(title=first['theme'], intro=first['intro'], cats={}))
        meta['cats'].update(first['categories'])
        for p in puzzles:
            validate(p)
        bank['puzzles'][key] = [compact(p) for p in puzzles]
    for p in daily:
        validate(p)
        bank['daily'].append(compact(p, daily=True))
    story = read_json('story.json')
    for chapter in story:
        for stage in chapter["stages"]:
            validate_story(stage)
    bank['story'] = story
    source = ROOT / 'src'
    html = (source / 'page.html').read_text()
    html = html.replace('__CSS__', (source / 'style.css').read_text())
    html = html.replace('__BANK__', json.dumps(bank, ensure_ascii=False, separators=(',', ':')))
    html = html.replace('__JS__', '\n'.join((source / (m + '.js')).read_text() for m in MODULES))
    dest = ROOT.parent / 'zebra_puzzle_legacy.html'
    temporary = dest.with_suffix('.tmp')
    temporary.write_text(html)
    os.replace(temporary, dest)
    print(f'Built {dest}: {sum(map(len, free.values()))} free, {len(daily)} daily puzzles validated.')


if __name__ == '__main__':
    build()
