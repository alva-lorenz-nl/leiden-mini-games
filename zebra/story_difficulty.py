"""把故事模式的分阶段谜题重建为多类别推理题（一次性内容迁移）。

旧版每阶段只有“人物 + 一个属性”，线索是一条完整链，几乎不用推理。
本脚本为每阶段补一到两类属性，用 Z3 生成唯一解并极小化线索集；
最终阶段升为四类属性，标为困难。题目 ID 保持不变，已通关进度不丢。
"""
import copy
import json
import random
from pathlib import Path

from z3 import Distinct, Int, Not, Or, Solver, sat, unsat

ROOT = Path(__file__).parent

# 可复用的属性池；每类至少 7 个值，按阶段规模截取
POOLS = [
    {
        "name": "到场时间",
        "values": ["18:40", "18:55", "19:10", "19:25", "19:40", "19:55", "20:10"],
        "excludes": {"时间", "到场", "到场时间"},
    },
    {
        "name": "随身物",
        "values": ["旧钥匙", "铜怀表", "折起的纸条", "半盒火柴", "毛线球", "钢笔", "备用电池"],
        "excludes": {"随身物", "随身物品", "私物", "疑物", "行李箱", "雨具", "饰品", "软垫", "毯子", "收纳", "草稿", "记录", "读物"},
    },
    {
        "name": "饮品",
        "values": ["黑咖啡", "红茶", "牛奶", "汽水", "热可可", "柠檬水", "温水"],
        "excludes": {"饮品", "饮料", "热饮", "点单", "夜宵", "菜肴", "补给", "旁边饮品", "零食"},
    },
]

IDENTITY = {
    "人物", "名字", "房客", "乘客", "嫌疑人", "常驻", "队员", "同学",
    "宾客", "小猫", "物件", "模块", "乐园", "入座者", "来客", "滞留者",
}

SUBJECT = {
    "毛色": "毛色是{v}的小猫",
    "零食": "爱吃{v}的小猫",
    "活动": "正在{v}的小猫",
    "窝": "住在{v}里的小猫",
    "房间": "{v}里的人",
    "手里东西": "手里有{v}的人",
    "状态": "正在{v}的人",
    "饮品": "喝{v}的人",
    "饮料": "喝{v}的人",
    "热饮": "喝{v}的人",
    "旁边饮品": "手边放着{v}的人",
    "点单": "点了{v}的人",
    "夜宵": "吃着{v}的人",
    "菜肴": "面前是{v}的人",
    "补给": "分到{v}的人",
    "到场时间": "{v}到场的人",
    "时间": "{v}在场的人",
    "到场": "{v}到场的人",
    "随身物": "带着{v}的人",
    "随身物品": "带着{v}的人",
    "私物": "带着{v}的人",
    "疑物": "身边有{v}的人",
    "行李箱": "带着{v}的人",
    "雨具": "带着{v}的人",
    "饰品": "戴着{v}的人",
    "软垫": "坐在{v}上的人",
    "毯子": "盖着{v}的人",
    "收纳": "用{v}收纳的人",
    "草稿": "写着{v}的人",
    "记录": "填过{v}的人",
    "读物": "在读{v}的人",
    "任务": "负责{v}的人",
    "课题": "在做{v}的人",
    "设施": "守着{v}的人",
    "指示灯": "亮着{v}的房间",
    "门色": "门是{v}的房间",
    "宠物": "带着{v}的人",
    "键盘": "用{v}的人",
    "模块": "管着{v}模块的人",
    "带来的东西": "带来{v}的人",
    "气味": "身上有{v}气味的人",
    "微痕": "留下{v}痕迹的人",
    "证词": "说法是「{v}」的人",
    "心事": "心里想着{v}的人",
    "心结": "心里想着{v}的人",
    "私下心事": "心里想着{v}的人",
    "动机": "冲着{v}来的人",
}


def subject(cat, value):
    if cat in IDENTITY:
        return value
    template = SUBJECT.get(cat, "{cat}是{v}的人")
    return template.format(cat=cat, v=value)


def clue_text(clue):
    kind = clue[0]
    if kind == "pos":
        _, cat, value, pos = clue
        return f"{subject(cat, value)}在第{pos}个位置。"
    _, c1, v1, c2, v2 = clue
    a, b = subject(c1, v1), subject(c2, v2)
    if kind == "same":
        return f"{a}和{b}是同一个人。"
    if kind == "next":
        return f"{b}紧挨在{a}的右边。"
    if kind == "left":
        return f"{a}在{b}的左边（不一定相邻）。"
    raise ValueError(clue)


def constraint(clue, var_of):
    kind = clue[0]
    if kind == "same":
        _, c1, v1, c2, v2 = clue
        return var_of[c1][v1] == var_of[c2][v2]
    if kind == "next":
        _, c1, v1, c2, v2 = clue
        return var_of[c2][v2] == var_of[c1][v1] + 1
    if kind == "left":
        _, c1, v1, c2, v2 = clue
        return var_of[c1][v1] < var_of[c2][v2]
    _, cat, value, pos = clue
    return var_of[cat][value] == pos


def make_solver(values):
    solver = Solver()
    var_of = {}
    for cat, items in values.items():
        var_of[cat] = {}
        row = []
        for value in items:
            var = Int(f"{cat}_{value}")
            var_of[cat][value] = var
            row.append(var)
            solver.add(var >= 1, var <= len(items))
        solver.add(Distinct(row))
    return solver, var_of


def is_unique(solver, var_of, cats):
    if solver.check() != sat:
        return False
    model = solver.model()
    solver.push()
    solver.add(Or(*[var_of[c][v] != model.eval(var_of[c][v], model_completion=True) for c in cats for v in var_of[c]]))
    second = solver.check()
    solver.pop()
    return second == unsat


def candidates(solution, cats, n):
    pool = []
    for i, c1 in enumerate(cats):
        for c2 in cats[i + 1:]:
            for pos in range(1, n + 1):
                pool.append(("same", c1, solution[c1][pos], c2, solution[c2][pos]))
            for p1 in range(1, n):
                for p2 in range(p1 + 1, n + 1):
                    pool.append(("left", c1, solution[c1][p1], c2, solution[c2][p2]))
                    pool.append(("left", c2, solution[c2][p1], c1, solution[c1][p2]))
    for c1 in cats:
        for c2 in cats:
            if c1 == c2:
                continue
            for pos in range(1, n):
                pool.append(("next", c1, solution[c1][pos], c2, solution[c2][pos + 1]))
    return list(dict.fromkeys(pool))


def build(values, rng, anchor=True):
    cats = list(values)
    n = len(values[cats[0]])
    solution = {c: [None] + rng.sample(values[c], n) for c in cats}
    solver, var_of = make_solver(values)
    chosen = []

    if anchor:
        pos = rng.randint(1, n)
        anchor_clue = ("pos", cats[0], solution[cats[0]][pos], pos)
        solver.add(constraint(anchor_clue, var_of))
        chosen.append(anchor_clue)

    pool = candidates(solution, cats, n)
    rng.shuffle(pool)
    for clue in pool:
        if is_unique(solver, var_of, cats):
            break
        cons = constraint(clue, var_of)
        solver.push()
        solver.add(Not(cons))
        implied = solver.check() == unsat
        solver.pop()
        if implied:
            continue
        solver.push()
        solver.add(cons)
        possible = solver.check() == sat
        solver.pop()
        if possible:
            solver.add(cons)
            chosen.append(clue)

    if not is_unique(solver, var_of, cats):
        return None

    # 逐条剪枝：删掉后仍唯一就删除，得到极小线索集
    index = 0
    while index < len(chosen):
        trial = chosen[:index] + chosen[index + 1:]
        test_solver, test_vars = make_solver(values)
        for clue in trial:
            test_solver.add(constraint(clue, test_vars))
        if is_unique(test_solver, test_vars, cats):
            chosen = trial
        else:
            index += 1

    return solution, chosen


def choose_pools(base_cats, base_values, count, stage_index):
    used_names = set(base_cats)
    used_values = {v for items in base_values.values() for v in items}
    allowed = [
        p for p in POOLS
        if p["name"] not in used_names
        and not (p["excludes"] & used_names)
        and not (set(p["values"]) & used_values)
    ]
    if not allowed:
        return []
    picked = [allowed[stage_index % len(allowed)]]
    for pool in allowed:
        if len(picked) >= count:
            break
        if pool not in picked:
            picked.append(pool)
    return picked[:count]


def rebuild_stage(stage, index, is_final, rng):
    puzzle = stage["puzzle"]
    base_cats = list(puzzle["cats"])
    base_values = {c: puzzle["cats"][c] for c in base_cats}
    n = len(base_values[base_cats[0]])
    wanted = 2 if is_final else 1
    pools = choose_pools(base_cats, base_values, wanted, index)
    if not pools:
        return False
    values = dict(base_values)
    for pool in pools:
        values[pool["name"]] = pool["values"][:n]
    # 值不能跨类别重复，避免线索歧义
    seen = set()
    for items in values.values():
        if len(set(items)) != len(items) or seen & set(items):
            return False
        seen |= set(items)

    for _ in range(12):
        result = build(values, rng, anchor=True)
        if not result:
            continue
        solution, clues = result
        if len(clues) < (6 if len(values) == 3 else 8):
            continue
        cats = list(values)
        question_cat = cats[-1]
        question_value = rng.choice(values[question_cat])
        position = next(p for p in range(1, n + 1) if solution[question_cat][p] == question_value)
        puzzle.update(
            cats={c: values[c] for c in cats},
            k=cats,
            s={c: [solution[c][p] for p in range(1, n + 1)] for c in cats},
            r=clues,
            c=[clue_text(clue) for clue in clues],
            q=f"{subject(question_cat, question_value)}是谁？",
            a={"position": position, "value": solution[cats[0]][position]},
            diff="hard" if len(cats) >= 4 or n >= 6 else "medium",
            difficultyVersion=2,
        )
        return True
    return False


def main():
    path = ROOT / "data" / "story.json"
    stories = json.loads(path.read_text())
    rng = random.Random(20261111)
    changed = failed = 0
    for story in stories:
        for index, stage in enumerate(story["stages"]):
            if "puzzle" not in stage:
                continue
            if stage["puzzle"].get("difficultyVersion") == 2:
                continue
            is_final = index == len(story["stages"]) - 1
            if rebuild_stage(stage, index, is_final, rng):
                changed += 1
            else:
                failed += 1
                print("skip", story["title"], stage["title"])
        for stage in story["stages"]:
            if "puzzle" not in stage:
                continue
            p = stage["puzzle"]
            stage["intro"] = "本阶段核对：" + "、".join(p["k"]) + "。所有方位按屏幕列序。"
    path.write_text(json.dumps(stories, ensure_ascii=False, indent=2))
    print(f"rebuilt {changed} stages, skipped {failed}")


if __name__ == "__main__":
    main()
