/* 自由推理：主题/难度筛选与题目列表 */

/* 某个主题+难度组合里，题库还剩几道没做 */
function bankStats(theme, diff) {
  let total = 0,
    undone = 0;
  for (const [key, items] of Object.entries(PUZ)) {
    const [t, d] = key.split("_");
    if (theme !== "all" && t !== theme) continue;
    if (diff !== "all" && d !== diff) continue;
    items.forEach((p) => {
      total++;
      if (!REC.done.includes(p.id)) undone++;
    });
  }
  return { total, undone };
}

/* 这个组合还能不能出题：生成器能现场造，或者题库里还有没做的 */
function canPlay(theme, diff) {
  const genOk =
    (theme === "all" || GEN.themes().includes(theme)) &&
    (diff === "all" || ["easy", "normal", "hard"].includes(diff));
  return genOk || bankStats(theme, diff).undone > 0;
}

/* 这个组合下到底有没有题（不管做没做），用来防止选项悬空 */
function hasAnyPuzzle(theme, diff) {
  const genOk =
    (theme === "all" || GEN.themes().includes(theme)) &&
    (diff === "all" || ["easy", "normal", "hard"].includes(diff));
  return genOk || bankStats(theme, diff).total > 0;
}

/* 没得做就把按钮变灰，别让人点了才发现 */
function updateStartState() {
  const btn = $("startBtn");
  if (!btn) return;
  const ok = mode !== "free" || canPlay(S.theme, S.diff);
  btn.disabled = !ok;
  btn.classList.toggle("off", !ok);
  const listBtn = $("listBtn");
  if (listBtn) {
    const empty = mode === "free" && bankStats(S.theme, S.diff).total === 0;
    listBtn.disabled = empty;
    listBtn.classList.toggle("off", empty);
  }
  if (!ok) setMessage("homeMsg", "这个组合下没有可做的题了，换个主题或难度。", "no");
  else if ($("homeMsg").textContent.indexOf("没有可做的题") >= 0)
    setMessage("homeMsg", "");
}

function renderChoices() {
  // 换了主题后，原来的难度可能没有题，回退到“不限难度”
  if (S.diff !== "all" && !hasAnyPuzzle(S.theme, S.diff)) {
    S.diff = "all";
    localStorage.setItem("zebra_diff", "all");
  }
  // 旧缓存里可能存着已下线的主题，回退到“不限主题”
  if (S.theme !== "all" && !META[S.theme]) {
    S.theme = "all";
    localStorage.setItem("zebra_theme", "all");
  }
  const tr = $("themeRow");
  tr.replaceChildren();
  ["all", ...Object.keys(META)].forEach((k) => {
    const off = false; /* 主题永远可点：切过去后难度会自动回退 */
    const b = button(
      k === "all" ? "不限主题" : THEME_NAMES[k],
      () => {
        S.theme = k;
        localStorage.setItem("zebra_theme", k);
        setMessage("homeMsg", "");
        if (S.diff !== "all" && !hasAnyPuzzle(k, S.diff)) {
          S.diff = "all";
          localStorage.setItem("zebra_diff", "all");
        }
        renderChoices();
        renderList();
      },
      "btn" + (S.theme === k ? " on" : "") + (off ? " off" : ""),
    );
    b.disabled = off;
    tr.appendChild(b);
  });

  const dr = $("diffRow");
  dr.replaceChildren();
  const bankDiffs = new Set(Object.keys(PUZ).map((key) => key.split("_")[1]));
  const diffOptions = { all: "不限难度" };
  Object.keys(DIFF_NAMES)
    .filter((d) => bankDiffs.has(d))
    .forEach((d) => (diffOptions[d] = DIFF_NAMES[d]));
  Object.keys(diffOptions).forEach((k) => {
    const off = k !== "all" && k !== S.diff && !hasAnyPuzzle(S.theme, k);
    const b = button(
      diffOptions[k],
      () => {
        S.diff = k;
        localStorage.setItem("zebra_diff", k);
        setMessage("homeMsg", "");
        renderChoices();
        renderList();
      },
      "btn" + (S.diff === k ? " on" : "") + (off ? " off" : ""),
    );
    b.disabled = off;
    dr.appendChild(b);
  });
  updateStartState();
}

function filteredPuzzles() {
  const out = [];
  for (const [key, items] of Object.entries(PUZ)) {
    const [theme, diff] = key.split("_");
    if (
      (S.theme !== "all" && theme !== S.theme) ||
      (S.diff !== "all" && diff !== S.diff)
    )
      continue;
    items.forEach((p) => out.push(hydrate(p, theme, diff)));
  }
  return out;
}

function puzzleStatus(p) {
  if ((REC.wins || []).includes(p.id)) return "已通关";
  if (REC.done.includes(p.id)) return "已做";
  return "未做";
}

function renderList() {
  const box = $("puzzleList");
  box.replaceChildren();
  const list = filteredPuzzles();
  const undone = list.filter((p) => !REC.done.includes(p.id)).length;
  box.appendChild(
    el(
      "p",
      "intro",
      `符合条件 ${list.length} 题 · 未做 ${undone} 题（看过答案也视为已做）。列表允许选择重玩。`,
    ),
  );
  list.forEach((p) => {
    box.appendChild(
      button(
        `${p.id.replace("v2-", "")} · ${THEME_NAMES[p.theme_key]} / ${DIFF_NAMES[p.difficulty]} · ${puzzleStatus(p)}`,
        () => {
          mode = "free";
          startGame(p);
        },
      ),
    );
  });
  updateStartState();
}
