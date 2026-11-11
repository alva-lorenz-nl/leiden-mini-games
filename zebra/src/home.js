/* 自由推理：主题/难度筛选与题目列表 */
function renderChoices() {
  // 旧缓存里可能存着已下线的主题，回退到“不限主题”
  if (S.theme !== "all" && !META[S.theme]) {
    S.theme = "all";
    localStorage.setItem("zebra_theme", "all");
  }
  const tr = $("themeRow");
  tr.replaceChildren();
  ["all", ...Object.keys(META)].forEach((k) => {
    tr.appendChild(
      button(
        k === "all" ? "不限主题" : THEME_NAMES[k],
        () => {
          S.theme = k;
          localStorage.setItem("zebra_theme", k);
          renderChoices();
          renderList();
        },
        "btn" + (S.theme === k ? " on" : ""),
      ),
    );
  });

  const dr = $("diffRow");
  dr.replaceChildren();
  Object.keys({ all: "不限难度", ...DIFF_NAMES }).forEach((k) => {
    dr.appendChild(
      button(
        k === "all" ? "不限难度" : DIFF_NAMES[k],
        () => {
          S.diff = k;
          localStorage.setItem("zebra_diff", k);
          renderChoices();
          renderList();
        },
        "btn" + (S.diff === k ? " on" : ""),
      ),
    );
  });
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
}
