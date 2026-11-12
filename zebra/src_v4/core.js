/* 题库解压、名称表与全局会话状态 */
const META = BANK.meta,
  PUZ = BANK.puzzles;

const THEME_NAMES = {};
Object.keys(META).forEach((k) => (THEME_NAMES[k] = META[k].title));
const DIFF_NAMES = {
  easy: "简单",
  normal: "普通",
  medium: "中等",
  hard: "困难",
  plus: "加强",
  extreme: "极限·六列",
};

/* 把精简题库还原成页面用的结构 */
function hydrate(p, theme, diff) {
  const cats = {};
  p.k.forEach((c) => (cats[c] = META[theme].cats[c]));
  return {
    id: p.id,
    theme_key: theme,
    theme: META[theme].title,
    intro: META[theme].intro,
    difficulty: diff,
    categories: cats,
    clue_count: p.n,
    clues: softenClues(p.c, p.r, theme),
    rawClues: p.r,
    question: p.q,
    answer: p.a,
    solution: p.s,
  };
}

/* 早期题库里“状态=喝咖啡”和“饮料=热水”会拼出别扭的句子，这里改写成人话 */
function softenClues(texts, raws, theme) {
  if (theme !== "alva" || !raws) return texts;
  const key = ["状态", "饮料"].sort().join("|");
  return texts.map((t, i) => {
    const r = raws[i];
    if (r && r[0] === "same" && [r[1], r[3]].sort().join("|") === key)
      return `正在${r[2]}的人，杯子里装的其实是${r[4]}。`;
    return t;
  });
}

/* 把故事章节的谜题还原成页面用的结构 */
function hydrateStory(ch, i) {
  const p = ch.puzzle;
  return {
    id: p.id,
    theme_key: "story",
    theme: ch.title,
    chapterIndex: i,
    intro: p.intro,
    difficulty: p.diff,
    categories: p.cats,
    colLabels: p.cols || null,
    clue_count: p.c.length,
    clues: p.c,
    rawClues: p.r,
    question: p.q,
    answer: p.a,
    solution: p.s,
    fragments: p.frag || [],
    ending: p.end,
  };
}

/* 页面级状态：模式选择、当前题、填表、计时 */
const S = {
  theme: localStorage.getItem("zebra_theme") || "cat",
  diff: localStorage.getItem("zebra_diff") || "easy",
  tag: localStorage.getItem("zebra_tag") || "all",
  n: 5,
  cur: null, // 当前题目
  assign: null, // {类别: [null x n]}
  t0: 0,
  timerId: null,
  elapsed: 0,
  solved: false,
};

let mode = "free", // free | story | daily
  chapter = 0, // 故事模式下选中的章节
  stage = 0; // 故事模式下选中的阶段
