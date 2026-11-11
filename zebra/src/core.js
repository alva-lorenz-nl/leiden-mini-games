const META = BANK.meta,
  PUZ = BANK.puzzles;

const THEME_NAMES = {};
Object.keys(META).forEach((k) => (THEME_NAMES[k] = META[k].title));
const DIFF_NAMES = { easy: "简单", normal: "普通", hard: "困难" };

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
    clues: p.c,
    question: p.q,
    answer: p.a,
    solution: p.s,
  };
}

const S = {
  theme: localStorage.getItem("zebra_theme") || "cat",
  diff: localStorage.getItem("zebra_diff") || "easy",
  cur: null, // 当前题目
  assign: null, // {类别: [null x5]}
  t0: 0,
  timerId: null,
  elapsed: 0,
  solved: false,
};
