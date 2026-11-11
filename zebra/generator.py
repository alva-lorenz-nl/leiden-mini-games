"""
小猫斑马逻辑谜题生成器
-------------------------------------------------
流程：
  1. 随机生成一个完整解（每类属性都是 1..N 的一个排列）
  2. 从解中枚举所有成立的候选线索
  3. 贪心挑选线索：跳过已被蕴含的冗余线索，直到解唯一
  4. 逐条剪枝，得到极小线索集（hard / normal）
  5. 简单模式额外补几条冗余线索，降低推理难度
"""

import random
from z3 import Solver, Int, Distinct, Or, Not, sat, unsat

# ========================= 主题 =========================

THEMES = {
    "cat": {
        "title": "小猫生活",
        "intro": "五只小猫并排住在五间相邻的猫窝里，它们的名字、毛色、爱吃的零食、正在做的事（以及窝的类型）各不相同。请根据线索推断出每个位置住着哪只小猫。",
        "cats": {
            "名字": ["小雪球", "团子", "奶糖", "煤球", "橘子"],
            "毛色": ["纯白", "橘色", "三花", "全黑", "狸花"],
            "零食": ["小鱼干", "猫罐头", "冻干", "南瓜拿铁", "华夫饼"],
            "活动": ["晒太阳", "玩毛线", "踩奶", "睡大觉", "巡视领地"],
            "窝": ["纸箱", "藤篮", "窗台", "猫爬架", "被窝"],
        },
        "final_question": "谁的窝是「被窝」？",
    },
    "alva": {
        "title": "永动轮往事",
        "intro": "永动轮公司五间相邻的实验室里各待着一个人，他们的身份、所在房间、手里的物件、状态（以及喝的饮料）各不相同。请根据线索还原当年的现场。",
        "cats": {
            "人物": ["赫尔曼", "阿尔瓦", "卢卡", "玛丽", "汉斯"],
            "房间": ["机械车间", "电气工坊", "算法实验室", "数据中心", "会议室"],
            "手里东西": ["咖啡杯", "电路板", "服务器", "扳手", "草稿纸"],
            "状态": ["熬夜", "争吵", "沉思", "喝咖啡", "修机器"],
            "饮料": ["黑咖啡", "红茶", "牛奶", "汽水", "热水"],
        },
        "final_question": "谁的饮料是「牛奶」？",
    },
}

DIFFICULTY = {
    # 类别数量 / 是否极小化 / 额外补充线索
    "easy":   {"n_cats": 4, "minimize": False, "extra": 3},
    "normal": {"n_cats": 4, "minimize": True,  "target": 0},
    "hard":   {"n_cats": 5, "minimize": True,  "target": 0},
}


# ========================= 基础构件 =========================

def build_solution(theme, cats):
    sol = {}
    for c in cats:
        values = theme["cats"][c][:]
        random.shuffle(values)
        sol[c] = {i + 1: values[i] for i in range(5)}
    return sol


def make_solver_for(theme, cats):
    """每类变量取值 1..5 且互不相同"""
    var_of = {}
    s = Solver()
    for c in cats:
        var_of[c] = {}
        vs = []
        for v in theme["cats"][c]:
            var = Int(f"{c}_{v}")
            var_of[c][v] = var
            vs.append(var)
            s.add(var >= 1, var <= 5)
        s.add(Distinct(vs))
    return s, var_of


def all_candidate_clues(theme, sol, cats):
    clues = []
    # 同位
    for i, c1 in enumerate(cats):
        for c2 in cats[i + 1:]:
            for pos in range(1, 6):
                clues.append(("same", c1, sol[c1][pos], c2, sol[c2][pos]))
    # 相邻（左右紧邻）
    for c1 in cats:
        for c2 in cats:
            if c1 == c2:
                continue
            for pos in range(1, 5):
                clues.append(("next", c1, sol[c1][pos], c2, sol[c2][pos + 1]))
                clues.append(("next", c2, sol[c2][pos], c1, sol[c1][pos + 1]))
    # 左右（不一定相邻）
    for i, c1 in enumerate(cats):
        for c2 in cats[i + 1:]:
            for p1 in range(1, 6):
                for p2 in range(p1 + 1, 6):
                    clues.append(("left", c1, sol[c1][p1], c2, sol[c2][p2]))
                    clues.append(("left", c2, sol[c2][p1], c1, sol[c1][p2]))
    # 去重
    return list(dict.fromkeys(clues))


def subject(c, v):
    return {"名字": v, "人物": v, "房间": v, "毛色": f"毛色是{v}的小猫", "零食": f"爱吃{v}的小猫", "活动": f"正在{v}的小猫", "窝": f"住在{v}里的小猫", "手里东西": f"有{v}的房间", "状态": f"正在{v}的人", "饮料": f"喝{v}的人"}[c]


def clue_to_text(clue):
    k, c1, v1, *rest = clue
    a = subject(c1, v1)
    if k == "pos":
        return f"{a}在从左数第{rest[0]}个位置。"
    c2, v2 = rest
    b = subject(c2, v2)
    if k == "left":
        return f"{a}在{b}的左边（不一定相邻）。"
    if k == "next":
        return f"{a}的右边紧挨着{b}。"
    if k == "same":
        predicate = {"毛色": f"的毛色是{v2}", "零食": f"爱吃{v2}", "活动": f"正在{v2}", "窝": f"住在{v2}里", "房间": f"在{v2}里", "手里东西": f"所在的房间里有{v2}", "状态": f"正在{v2}", "饮料": f"喝的是{v2}"}
        if c1 == "房间":
            return f"{v1}里有{v2}。" if c2 == "手里东西" else f"{v1}里的人{predicate[c2]}。"
        if c1 == "手里东西":
            a += "里的人"
        return a + predicate[c2] + "。"
    raise ValueError(clue)


def clue_to_constraint(clue, var_of):
    k = clue[0]
    if k == "same":
        _, c1, v1, c2, v2 = clue
        return var_of[c1][v1] == var_of[c2][v2]
    if k == "next":
        _, c1, v1, c2, v2 = clue
        return var_of[c2][v2] == var_of[c1][v1] + 1
    if k == "left":
        _, c1, v1, c2, v2 = clue
        return var_of[c1][v1] < var_of[c2][v2]
    if k == "pos":
        _, c, v, p = clue
        return var_of[c][v] == p
    return None


def unique_solution(s, var_of, cats):
    """当前约束下是否只有唯一解"""
    if s.check() != sat:
        return False
    m = s.model()
    s.push()
    s.add(Or(*[var_of[c][v] != m.eval(var_of[c][v], model_completion=True)
               for c in cats for v in var_of[c]]))
    second = s.check()
    s.pop()
    return second == unsat


# ========================= 生成主流程 =========================

def generate_puzzle(theme_key, difficulty, max_attempts=60):
    theme = THEMES[theme_key]
    cfg = DIFFICULTY[difficulty]
    cats = list(theme["cats"].keys())[: cfg["n_cats"]]
    anchor_cat = cats[0]

    for _ in range(max_attempts):
        sol = build_solution(theme, cats)
        anchors = [("pos", anchor_cat, sol[anchor_cat][p], p) for p in range(1, 6)]

        s, var_of = make_solver_for(theme, cats)
        chosen = []
        for c in anchors:
            s.add(clue_to_constraint(c, var_of))
            chosen.append(c)

        pool = all_candidate_clues(theme, sol, cats)
        random.shuffle(pool)

        # 贪心加入线索，直到解唯一
        for c in pool:
            if unique_solution(s, var_of, cats):
                break
            cons = clue_to_constraint(c, var_of)
            s.push()
            s.add(Not(cons))
            implied = (s.check() == unsat)
            s.pop()
            if implied:
                continue
            s.push()
            s.add(cons)
            ok = (s.check() == sat)
            s.pop()
            if ok:
                s.add(cons)
                chosen.append(c)

        if not unique_solution(s, var_of, cats):
            continue

        # 极小化剪枝
        if cfg["minimize"]:
            i = 0
            while i < len(chosen):
                if len(chosen) <= cfg["target"]:
                    break
                if chosen[i][0] == "pos" and chosen[i][1] == anchor_cat:
                    i += 1
                    continue
                trial = chosen[:i] + chosen[i + 1:]
                st, vt = make_solver_for(theme, cats)
                for t in trial:
                    st.add(clue_to_constraint(t, vt))
                if unique_solution(st, vt, cats):
                    chosen = trial
                else:
                    i += 1
        else:
            # 简单模式：补充几条冗余但成立的真线索
            added = 0
            for c in pool:
                if added >= cfg["extra"]:
                    break
                if c in chosen:
                    continue
                chosen.append(c)
                added += 1

        random.shuffle(chosen)

        # 动态生成追问：取最后一个类别，问它某个值的名字对应谁
        q_cat = cats[-1]
        q_val = random.choice(theme["cats"][q_cat])
        q_pos = [p for p in range(1, 6) if sol[q_cat][p] == q_val][0]
        question = subject(q_cat, q_val) + "是谁？"

        return {
            "theme_key": theme_key,
            "theme": theme["title"],
            "intro": theme["intro"],
            "difficulty": difficulty,
            "categories": {c: theme["cats"][c] for c in cats},
            "clue_count": len(chosen),
            "raw_clues": chosen,
            "clues": [clue_to_text(c) for c in chosen],
            "question": question,
            "answer": {"position": q_pos, "value": sol[cats[0]][q_pos]},
            "solution": {c: [sol[c][p] for p in range(1, 6)] for c in cats},
        }

    raise RuntimeError("本次生成失败，请重试")


if __name__ == "__main__":
    random.seed(2026)
    for tk in ["cat", "alva"]:
        for diff in ["easy", "normal", "hard"]:
            p = generate_puzzle(tk, diff)
            print(f"\n===== {p['theme']} / {p['difficulty']} / {p['clue_count']} 条 =====")
            print(p["intro"])
            for i, c in enumerate(p["clues"], 1):
                print(f"{i}. {c}")
            print("问：" + p["question"])
            print("解：")
            for c, vals in p["solution"].items():
                print("  ", c, "→", vals)
