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
  $("startBtn").textContent = mode === "free" ? "随机新题 →" : "开始推理 →";
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

/* 每日挑战：月历视图（自 2026-11 起，可补做往期） */
const CAL_START = "2026-11";

function calShift(delta) {
  const y = calMonth.y, m = calMonth.m + delta;
  calMonth = { y: y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
  renderDailyArchive();
}

function renderDailyArchive() {
  const box = $("dailyArchive");
  box.classList.toggle("hidden", mode !== "daily");
  box.replaceChildren();

  const today = dayKey();
  const [ty, tm] = today.split("-").map(Number);
  if (!calMonth) calMonth = { y: ty, m: tm - 1 };

  const byDate = {};
  BANK.daily.forEach((p) => (byDate[p.date] = p));
  const doneSet = new Set(REC.daily || []);

  const ym = `${calMonth.y}-${String(calMonth.m + 1).padStart(2, "0")}`;
  const head = el("div", "calhead");
  const atStart = ym <= CAL_START;
  const atNow = ym >= today.slice(0, 7);
  const prev = button("‹", () => calShift(-1), "btn");
  prev.disabled = atStart;
  const next = button("›", () => calShift(1), "btn");
  next.disabled = atNow;
  head.appendChild(prev);
  head.appendChild(el("div", "title", `${calMonth.y} 年 ${calMonth.m + 1} 月`));
  head.appendChild(next);
  box.appendChild(head);

  const grid = el("div", "calgrid");
  ["一", "二", "三", "四", "五", "六", "日"].forEach((w) =>
    grid.appendChild(el("div", "calwd", w)),
  );
  const first = new Date(Date.UTC(calMonth.y, calMonth.m, 1)).getUTCDay();
  const lead = (first + 6) % 7;
  for (let i = 0; i < lead; i++) grid.appendChild(el("div", "calcell blank"));

  const days = new Date(Date.UTC(calMonth.y, calMonth.m + 1, 0)).getUTCDate();
  for (let d = 1; d <= days; d++) {
    const date = `${ym}-${String(d).padStart(2, "0")}`;
    const p = byDate[date];
    const isToday = date === today;
    const done = doneSet.has(date);
    const playable = !!p || isToday;
    const cell = el("button", "calcell", String(d));
    if (playable && date <= today) cell.classList.add("open");
    if (done) cell.classList.add("done");
    if (isToday) cell.classList.add("today");
    cell.appendChild(el("span", "dot"));
    cell.disabled = !playable || date > today;
    if (playable && date <= today) {
      cell.title = done ? "已通关 · 可重做" : "可挑战";
      cell.onclick = () => {
        mode = "daily";
        localStorage.setItem("zebra_mode", "daily");
        startGame(p ? { ...hydrate(p, p.theme, p.diff), date } : GEN.daily(date));
      };
    }
    grid.appendChild(cell);
  }
  box.appendChild(grid);

  const solved = [...doneSet].filter((x) => x.startsWith(ym)).length;
  const legend = el("div", "callegend");
  const dot = (color, text) => {
    const sp = el("span");
    const i = el("i");
    i.style.background = color;
    sp.appendChild(i);
    sp.appendChild(document.createTextNode(text));
    return sp;
  };
  legend.appendChild(dot("var(--amber2)", "有题可挑战"));
  legend.appendChild(dot("var(--good)", "已通关"));
  legend.appendChild(dot("#5d5346", "未开放 / 无题"));
  box.appendChild(legend);
  box.appendChild(
    el("p", "calnote", `本月已通关 ${solved} 天 · 北京时间 · 可补做往期`),
  );
}
