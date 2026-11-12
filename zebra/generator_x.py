"""ZebraLogic 风格扩展生成器（测试版专用）

线索类型照搬 ZebraLogic 评测集：
  Found_At / Not_At / Same_House / Direct_Left / Direct_Right /
  Side_By_Side / Left_Of / Right_Of / One_Between / Two_Between

与 generator.py 一样：先造一个合法解，只枚举“在解上成立”的线索，
再贪心加到 Z3 判定唯一解，最后剪掉冗余线索。
产出结构与 data/free.json 一致，可直接并进题库。
"""
import json
import random
from pathlib import Path

from z3 import Int, Solver, Distinct, Or, Not, sat, unsat

from generator import THEMES

# ========================= 主题 =========================

THEMES_X = {
    "canal": {
        "title": "运河街区",
        "intro": "莱顿运河边的六个泊位依次排开，每条船的主人、船名、货物、出发时段和目的地都各不相同。请根据线索把六个泊位排出来。",
        "cats": {
            "名字": ["玛丽", "汉斯", "安娜", "彼得", "苏菲", "尤里"],
            "船名": ["晨星号", "灰鸽号", "风车号", "郁金香号", "银鲱号", "夜灯号"],
            "货物": ["奶酪", "郁金香球茎", "木鞋", "青鱼", "面粉", "旧书"],
            "时段": ["清晨", "上午", "正午", "午后", "黄昏", "深夜"],
            "目的地": [
                "海牙",
                "鹿特丹",
                "代尔夫特",
                "乌得勒支",
                "哈勒姆",
                "阿姆斯特丹",
            ],
        },
        "final_question": "去「代尔夫特」的是谁？",
    }
}

ALL_THEMES = {**THEMES, **THEMES_X}

# 各类属性的“主语形式”与“谓语形式”
NOUN = {
    "名字": "{v}",
    "人物": "{v}",
    "船名": "船名是{v}的船",
    "货物": "运{v}的船",
    "时段": "{v}出发的船",
    "目的地": "去{v}的船",
    "毛色": "毛色是{v}的小猫",
    "零食": "爱吃{v}的小猫",
    "活动": "正在{v}的小猫",
    "窝": "窝在{v}的小猫",
    "房间": "{v}",
    "手里东西": "拿着{v}的人",
    "状态": "正在{v}的人",
    "饮料": "喝{v}的人",
}
PRED = {
    "名字": "是{v}",
    "人物": "是{v}",
    "船名": "的船名是{v}",
    "货物": "运的是{v}",
    "时段": "{v}出发",
    "目的地": "去{v}",
    "毛色": "的毛色是{v}",
    "零食": "爱吃{v}",
    "活动": "正在{v}",
    "窝": "窝在{v}",
    "房间": "在{v}里",
    "手里东西": "拿着{v}",
    "状态": "正在{v}",
    "饮料": "喝的是{v}",
}


def noun(c, v):
    return NOUN[c].format(v=v)


def pred(c, v):
    return PRED[c].format(v=v)


# ========================= 题面 =========================


def clue_text(clue, n, theme_key="cat"):
    k, c1, v1 = clue[0], clue[1], clue[2]
    a = noun(c1, v1)
    if k == "pos":
        p = clue[3]
        label = f"第{p}" if p <= n // 2 else f"倒数第{n - p + 1}"
        return f"{a}在{label}个位置。"
    if k == "not":
        p = clue[3]
        label = f"第{p}" if p <= n // 2 else f"倒数第{n - p + 1}"
        return f"{a}不在{label}个位置。"
    c2, v2 = clue[3], clue[4]
    b = noun(c2, v2)
    if k == "same":
        if c1 == "船名" and c2 == "货物":
            return f"{a}上装着{v2}。"
        if c1 == "名字" and theme_key == "canal" and c2 == "船名":
            return f"{a}的船叫{v2}。"
        if c1 == "名字" and theme_key == "canal":
            return f"{a}的船{pred(c2, v2)}。"
        return f"{a}{pred(c2, v2)}。"
    if k == "next":
        return f"{a}的右边紧挨着{b}。"
    if k == "nextleft":
        return f"{a}的左边紧挨着{b}。"
    if k == "side":
        return f"{a}和{b}挨在一起，左右顺序不定。"
    if k == "left":
        return f"{a}在{b}的左边，不一定相邻。"
    if k == "right":
        return f"{a}在{b}的右边，不一定相邻。"
    if k == "between":
        gap = clue[5]
        return f"{a}和{b}之间正好隔着{gap}个位置。"
    raise ValueError(clue)


def clue_constraint(clue, var_of):
    k = clue[0]
    if k == "pos":
        return var_of[clue[1]][clue[2]] == clue[3]
    if k == "not":
        return var_of[clue[1]][clue[2]] != clue[3]
    a, b = var_of[clue[1]][clue[2]], var_of[clue[3]][clue[4]]
    if k == "same":
        return a == b
    if k == "next":
        return b == a + 1
    if k == "nextleft":
        return b == a + 1
    if k == "side":
        return Or(b == a + 1, b == a - 1)
    if k == "left":
        return a < b
    if k == "right":
        return a > b
    if k == "between":
        gap = clue[5] + 1
        return Or(b == a + gap, a == b + gap)
    raise ValueError(clue)


# ========================= 求解 =========================


def make_solver(theme, cats, n):
    var_of, s = {}, Solver()
    for c in cats:
        var_of[c] = {}
        vs = []
        for v in theme["cats"][c][:n]:
            var = Int(f"{c}_{v}")
            var_of[c][v] = var
            vs.append(var)
            s.add(var >= 1, var <= n)
        s.add(Distinct(vs))
    return s, var_of


def unique(s, var_of, cats, n):
    if s.check() != sat:
        return False
    m = s.model()
    s.push()
    s.add(
        Or(
            *[
                var_of[c][v] != m.eval(var_of[c][v], model_completion=True)
                for c in cats
                for v in list(var_of[c])[:n]
            ]
        )
    )
    second = s.check()
    s.pop()
    return second == unsat


def build_solution(theme, cats, n):
    sol = {}
    for c in cats:
        vals = theme["cats"][c][:n][:]
        random.shuffle(vals)
        sol[c] = {i + 1: vals[i] for i in range(n)}
    return sol


def candidate_pool(theme, sol, cats, n):
    pool = []

    def pos_of(c, v):
        return [p for p in range(1, n + 1) if sol[c][p] == v][0]

    for c in cats:
        for v in theme["cats"][c][:n]:
            p = pos_of(c, v)
            pool.append(("pos", c, v, p))
            for q in range(1, n + 1):
                if q != p:
                    pool.append(("not", c, v, q))
    for i, c1 in enumerate(cats):
        for c2 in cats[i + 1 :]:
            for p in range(1, n + 1):
                pool.append(("same", c1, sol[c1][p], c2, sol[c2][p]))
    for c1 in cats:
        for c2 in cats:
            if c1 == c2:
                continue
            for p in range(1, n):
                pool.append(("next", c1, sol[c1][p], c2, sol[c2][p + 1]))
                pool.append(("nextleft", c2, sol[c2][p], c1, sol[c1][p + 1]))
                pool.append(("side", c1, sol[c1][p], c2, sol[c2][p + 1]))
    for i, c1 in enumerate(cats):
        for c2 in cats[i + 1 :]:
            for p1 in range(1, n + 1):
                for p2 in range(p1 + 1, n + 1):
                    pool.append(("left", c1, sol[c1][p1], c2, sol[c2][p2]))
                    pool.append(("right", c2, sol[c2][p2], c1, sol[c1][p1]))
                    gap = p2 - p1 - 1
                    if gap in (1, 2):
                        pool.append(
                            ("between", c1, sol[c1][p1], c2, sol[c2][p2], gap)
                        )
    return list(dict.fromkeys(pool))


STRONG = ("same", "next", "nextleft", "left", "right", "pos")
EXOTIC = ("side", "between", "not")


def generate(theme_key, n_cats, n, extra=1, max_attempts=40):
    theme = ALL_THEMES[theme_key]
    cats = list(theme["cats"].keys())[:n_cats]
    for _ in range(max_attempts):
        sol = build_solution(theme, cats, n)
        pool = candidate_pool(theme, sol, cats, n)
        by_kind = {}
        for c in pool:
            by_kind.setdefault(c[0], []).append(c)
        for v in by_kind.values():
            random.shuffle(v)

        s, var_of = make_solver(theme, cats, n)
        chosen = []

        def add(c):
            cons = clue_constraint(c, var_of)
            s.push()
            s.add(cons)
            ok = s.check() == sat
            s.pop()
            if ok:
                s.add(cons)
                chosen.append(c)
            return ok

        def prune(keep_safe=()):
            nonlocal chosen
            safe = set(keep_safe)
            i = 0
            while i < len(chosen):
                if chosen[i] in safe:
                    i += 1
                    continue
                trial = chosen[:i] + chosen[i + 1 :]
                st, vt = make_solver(theme, cats, n)
                for t in trial:
                    st.add(clue_constraint(t, vt))
                if unique(st, vt, cats, n):
                    chosen = trial
                else:
                    i += 1

        # 先把第一个类别的五个位置钉住（和主生成器一样），题目才有落脚点
        anchor = cats[0]
        for q in range(1, n + 1):
            add(("pos", anchor, sol[anchor][q], q))

        # 第一步：只用“强线索”贪心到唯一解，再剪成极小集
        strong = [c for c in pool if c[0] in STRONG]
        random.shuffle(strong)
        for c in strong:
            if unique(s, var_of, cats, n):
                break
            add(c)
        if not unique(s, var_of, cats, n):
            continue
        prune()

        # 第二步：各塞一条 ZebraLogic 特有的弱线索，再剪一次，多余的自然被剔掉
        exotic_kept = []
        for kind in EXOTIC:
            cands = [c for c in by_kind.get(kind, []) if c not in chosen]
            random.shuffle(cands)
            for c in cands[:6]:
                if add(c):
                    exotic_kept.append(c)
                    break
        prune(exotic_kept)

        if extra:
            spare = [c for c in pool if c not in chosen]
            random.shuffle(spare)
            chosen += spare[:extra]

        random.shuffle(chosen)
        chosen.sort(key=lambda c: {"pos": 0, "not": 1, "same": 2}.get(c[0], 3))

        texts, keep = set(), []
        for c in chosen:
            t = clue_text(c, n, theme_key)
            if t in texts:
                continue
            texts.add(t)
            keep.append(c)
        chosen = keep

        q_cat = cats[-1]
        q_val = random.choice(theme["cats"][q_cat][:n])
        q_pos = [p for p in range(1, n + 1) if sol[q_cat][p] == q_val][0]
        if theme_key == "canal" and q_cat != "名字":
            question = noun(q_cat, q_val) + "的主人是谁？"
        else:
            question = noun(q_cat, q_val) + "是谁？"

        return {
            "theme_key": theme_key,
            "theme": theme["title"],
            "intro": theme["intro"],
            "categories": {c: theme["cats"][c][:n] for c in cats},
            "clue_count": len(chosen),
            "raw_clues": chosen,
            "clues": [clue_text(c, n, theme_key) for c in chosen],
            "question": question,
            "answer": {"position": q_pos, "value": sol[cats[0]][q_pos]},
            "solution": {c: [sol[c][p] for p in range(1, n + 1)] for c in cats},
        }
    raise RuntimeError(f"生成失败：{theme_key} {n}x{n_cats}")


def build_bank(counts):
    bank = {}
    for key, (theme, n_cats, n, extra, num) in counts.items():
        items = []
        for i in range(num):
            p = generate(theme, n_cats, n, extra)
            p["id"] = f"x-{key}-{i + 1:02d}"
            p["difficulty"] = key.split("_")[1]
            items.append(p)
        bank[key] = items
        print(f"{key}: {len(items)} 题，线索 {[x['clue_count'] for x in items]}")
    return bank


if __name__ == "__main__":
    random.seed(20261112)
    counts = {
        "cat_plus": ("cat", 5, 5, 2, 12),
        "alva_plus": ("alva", 5, 5, 2, 12),
        "canal_extreme": ("canal", 5, 6, 2, 12),
    }
    bank = build_bank(counts)
    dest = Path(__file__).resolve().parent / "data" / "extra.json"
    dest.write_text(json.dumps(bank, ensure_ascii=False, indent=1))
    print("written", dest)
