/* 模式与故事：章节、标签、每日档案 */
const CHAPTERS = BANK.story || [];

const TAG_NAMES = {
  cat: "小猫",
  alva: "阿尔瓦",
  herman: "赫尔曼叔叔",
  luca: "卢卡",
  本格: "本格推理",
};

function stageDone(ch, j) {
  return (
    (REC.wins || []).includes(ch.stages[j].puzzle?.id) ||
    (ch.legacyIndex != null && (REC.story || []).includes(ch.legacyIndex))
  );
}

function storyDone(ch) {
  return ch.stages.every((_, j) => stageDone(ch, j));
}

function allTags() {
  const set = new Set();
  CHAPTERS.forEach((ch) => (ch.tags || []).forEach((t) => set.add(t)));
  return [...set];
}

/* 北京时间的日期键，每日题的唯一边界 */
function dayKey() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}

function renderTagRow() {
  if (S.tag !== "all" && !allTags().includes(S.tag)) {
    S.tag = "all";
    localStorage.setItem("zebra_tag", "all");
  }
  const box = $("tagRow");
  if (!box) return;
  box.replaceChildren();
  ["all", ...allTags()].forEach((t) => {
    box.appendChild(
      button(
        t === "all" ? "全部故事" : TAG_NAMES[t] || t,
        () => {
          S.tag = t;
          localStorage.setItem("zebra_tag", t);
          renderModes();
        },
        "btn" + (S.tag === t ? " on" : ""),
      ),
    );
  });
}

function modeInfo() {
  if (mode === "story")
    return `共 ${CHAPTERS.length} 个独立故事，自由选择，互不影响。故事内按阶段推进；看答案不算通关。`;
  if (mode === "daily") {
    const today = dayKey();
    const done = (REC.daily || []).includes(today);
    return `${today} · 每日生成新题，往期题目可在下方补做。${done ? " 今日已完成，可重玩。" : " 今日尚未完成。"}`;
  }
  return "按筛选条件随机抽取未做题；也可打开题目列表自主选择。左右均以屏幕从左到右为准；“左边”可以不相邻。";
}

function renderModes() {
  const daily = REC.daily || [];
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
  $("modeInfo").textContent = modeInfo();

  $("storyStages")?.remove();
  const box = $("chapters");
  box.replaceChildren();
  const tagBox = $("storyTags");
  tagBox.classList.toggle("hidden", mode !== "story");
  renderTagRow();

  const visible = CHAPTERS.map((ch, i) => ({ ch, i })).filter(
    ({ ch }) => S.tag === "all" || (ch.tags || []).includes(S.tag),
  );
  if (!visible.some((x) => x.i === chapter) && visible.length) {
    chapter = visible[0].i;
    stage = 0;
  }
  if (mode === "story") renderStoryPicker(box, tagBox, visible);

  toggleHidden("freeFilters", mode !== "free");
  renderDailyArchive();
  toggleHidden("listBtn", mode !== "free");
  $("startBtn").textContent = mode === "free" ? "随机未做题 →" : "开始推理 →";
  if (mode !== "free") toggleHidden("puzzleList", true);
  renderList();
  renderAchievements();
}

/* 故事选择：标签在上，章节列表在中，当前故事的阶段在下 */
function renderStoryPicker(box, tagBox, visible) {
  visible.forEach(({ ch, i }) => {
    const done = ch.stages.filter((_, j) => stageDone(ch, j)).length;
    const b = button(
      (storyDone(ch) ? "✓ " : "") +
        ch.title +
        " · " +
        done +
        "/" +
        ch.stages.length,
      () => {
        chapter = i;
        stage = Math.max(
          0,
          ch.stages.findIndex((_, j) => !stageDone(ch, j)),
        );
        renderModes();
      },
      "btn" + (chapter === i ? " on" : ""),
    );
    b.title = (ch.tags || []).map((t) => TAG_NAMES[t] || t).join(" · ");
    box.appendChild(b);
  });
  tagBox.after(box);

  const panel = el("div", "row");
  panel.id = "storyStages";
  const ch = CHAPTERS[chapter];
  if (!ch) return;
  panel.appendChild(el("p", "stage-heading", ch.title + " · 故事内阶段"));
  if (!ch.stages[stage] || (stage > 0 && !stageDone(ch, stage - 1))) {
    stage = Math.max(
      0,
      ch.stages.findIndex((_, j) => !stageDone(ch, j)),
    );
  }
  ch.stages.forEach((st, j) => {
    const b = button(
      (stageDone(ch, j) ? "✓ " : "") + "阶段 " + (j + 1) + " · " + st.title,
      () => {
        stage = j;
        renderModes();
      },
      "btn" + (stage === j ? " on" : ""),
    );
    b.disabled = j > 0 && !stageDone(ch, j - 1);
    panel.appendChild(b);
  });
  box.after(panel);
}

/* 每日档案：只列出今天与过去，未来预备题不显示 */
function renderDailyArchive() {
  const box = $("dailyArchive");
  box.classList.toggle("hidden", mode !== "daily");
  box.replaceChildren();
  box.appendChild(el("p", null, "每日档案 · 北京时间（可补做往期）"));
  BANK.daily
    .filter((p) => p.date <= dayKey())
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((p) => {
      const status = (REC.daily || []).includes(p.date)
        ? "已通关"
        : REC.done.includes(p.id)
          ? "已查看"
          : "未完成";
      box.appendChild(
        button(
          `${p.date} · ${THEME_NAMES[p.theme]} / ${DIFF_NAMES[p.diff]} · ${status}`,
          () => {
            mode = "daily";
            startGame({ ...hydrate(p, p.theme, p.diff), date: p.date });
          },
        ),
      );
    });
}
