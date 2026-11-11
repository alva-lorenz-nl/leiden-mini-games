const CHAPTERS = BANK.story || [];
let stage = 0;
function stageDone(ch, j) {
  return (
    (REC.wins || []).includes(ch.stages[j].puzzle?.id) ||
    (ch.legacyIndex != null && (REC.story || []).includes(ch.legacyIndex))
  );
}
function storyDone(ch) {
  return ch.stages.every((_, j) => stageDone(ch, j));
}
THEME_NAMES.story = "故事模式";

/* 标签的中文名 */
const TAG_NAMES = {
  cat: "小猫",
  alva: "阿尔瓦",
  herman: "赫尔曼叔叔",
  luca: "卢卡",
  本格: "本格推理",
};

function allTags() {
  const set = new Set();
  CHAPTERS.forEach((ch) => (ch.tags || []).forEach((t) => set.add(t)));
  return [...set];
}

function dayKey() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}

function renderTagRow() {
  const box = document.getElementById("tagRow");
  if (!box) return;
  box.replaceChildren();
  const tags = ["all", ...allTags()];
  tags.forEach((t) => {
    const b = document.createElement("button");
    b.className = "btn" + (S.tag === t ? " on" : "");
    b.textContent = t === "all" ? "全部故事" : TAG_NAMES[t] || t;
    b.onclick = () => {
      S.tag = t;
      localStorage.setItem("zebra_tag", t);
      renderModes();
    };
    box.appendChild(b);
  });
}

function renderModes() {
  const story = REC.story || [],
    daily = REC.daily || [];
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
  document.getElementById("modeInfo").textContent =
    mode === "story"
      ? `共 ${CHAPTERS.length} 个独立故事，自由选择，互不影响。故事内按阶段推进；看答案不算通关。`
      : mode === "daily"
        ? dayKey() +
          " · 每日生成新题，往期题目可在下方补做。" +
          (daily.includes(dayKey())
            ? " 今日已完成，可重玩。"
            : " 今日尚未完成。")
        : "按筛选条件随机抽取未做题；也可打开题目列表自主选择。左右均以屏幕从左到右为准；“左边”可以不相邻。";
  document.getElementById("storyStages")?.remove();
  const box = document.getElementById("chapters");
  box.innerHTML = "";
  const tagBox = document.getElementById("storyTags");
  if (tagBox) tagBox.classList.toggle("hidden", mode !== "story");
  renderTagRow();
  const visible = CHAPTERS.map((ch, i) => ({ ch, i })).filter(
    ({ ch }) => S.tag === "all" || (ch.tags || []).includes(S.tag),
  );
  if (!visible.some((x) => x.i === chapter) && visible.length) {
    chapter = visible[0].i;
    stage = 0;
  }
  if (mode === "story") {
    visible.forEach(({ ch, i }) => {
      const b = document.createElement("button");
      b.className = "btn" + (chapter === i ? " on" : "");
      b.textContent =
        (storyDone(ch) ? "✓ " : "") +
        ch.title +
        " · " +
        ch.stages.filter((_, j) => stageDone(ch, j)).length +
        "/" +
        ch.stages.length;
      b.title = (ch.tags || []).map((t) => TAG_NAMES[t] || t).join(" · ");
      b.onclick = () => {
        chapter = i;
        stage = Math.max(
          0,
          ch.stages.findIndex((_, j) => !stageDone(ch, j)),
        );
        renderModes();
      };
      box.appendChild(b);
    });
    const panel = document.createElement("div");
    panel.id = "storyStages";
    const ch = CHAPTERS[chapter];
    if (ch)
      ch.stages.forEach((st, j) => {
        const b = document.createElement("button");
        b.className = "btn" + (stage === j ? " on" : "");
        b.textContent =
          (stageDone(ch, j) ? "✓ " : "") + "阶段 " + (j + 1) + " · " + st.title;
        b.disabled = j > 0 && !stageDone(ch, j - 1);
        b.onclick = () => {
          stage = j;
          renderModes();
        };
        panel.appendChild(b);
      });
    box.after(panel);
  }
  document
    .getElementById("freeFilters")
    .classList.toggle("hidden", mode !== "free");
  renderDailyArchive();
  document
    .getElementById("listBtn")
    .classList.toggle("hidden", mode !== "free");
  document.getElementById("startBtn").textContent =
    mode === "free" ? "随机未做题 →" : "开始推理 →";
  if (mode !== "free")
    document.getElementById("puzzleList").classList.add("hidden");
  renderList();
  const total = Object.values(REC.solved).reduce((n, v) => n + v.n, 0);
  const defs = [
    ["初露锋芒", "独立完成第一道题", total >= 1],
    ["小猫侦探", "累计完成10道不同题", total >= 10],
    ["勇闯工坊", "完成一道困难题", (REC.solved.hard?.n || 0) > 0],
    ["每日赴约", "完成一次每日挑战", daily.length >= 1],
    ["七日手记", "累计完成7天每日挑战", daily.length >= 7],
    [
      "故事收藏家",
      `完成全部 ${CHAPTERS.length} 个故事`,
      CHAPTERS.every(storyDone),
    ],
  ];
  const ach = document.getElementById("achievements");
  ach.innerHTML = "";
  defs.forEach(([name, desc, yes]) => {
    const el = document.createElement("div");
    el.className = "stat";
    const title = document.createElement("b");
    title.style.fontSize = "14px";
    title.textContent = (yes ? "★ " : "☆ ") + name;
    const sub = document.createElement("span");
    sub.textContent = desc + (yes ? " · 已解锁" : " · 未解锁");
    el.append(title, sub);
    ach.appendChild(el);
  });
}

function renderDailyArchive() {
  const box = document.getElementById("dailyArchive");
  box.classList.toggle("hidden", mode !== "daily");
  box.replaceChildren();
  const title = document.createElement("p");
  title.textContent = "每日档案 · 北京时间（可补做往期）";
  box.appendChild(title);
  BANK.daily
    .filter((p) => p.date <= dayKey())
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((p) => {
      const button = document.createElement("button");
      button.className = "btn";
      button.textContent =
        p.date +
        " · " +
        THEME_NAMES[p.theme] +
        " / " +
        DIFF_NAMES[p.diff] +
        ((REC.daily || []).includes(p.date)
          ? " · 已通关"
          : REC.done.includes(p.id)
            ? " · 已查看"
            : " · 未完成");
      button.onclick = () => {
        mode = "daily";
        startGame({ ...hydrate(p, p.theme, p.diff), date: p.date });
      };
      box.appendChild(button);
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
function renderList() {
  const box = document.getElementById("puzzleList");
  box.innerHTML = "";
  const list = filteredPuzzles();
  const info = document.createElement("p");
  info.className = "intro";
  info.textContent =
    "符合条件 " +
    list.length +
    " 题 · 未做 " +
    list.filter((p) => !REC.done.includes(p.id)).length +
    " 题（看过答案也视为已做）。列表允许选择重玩。";
  box.appendChild(info);
  list.forEach((p) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent =
      p.id.replace("v2-", "") +
      " · " +
      THEME_NAMES[p.theme_key] +
      " / " +
      DIFF_NAMES[p.difficulty] +
      " · " +
      ((REC.wins || []).includes(p.id)
        ? "已通关"
        : REC.done.includes(p.id)
          ? "已做"
          : "未做");
    b.onclick = () => {
      mode = "free";
      startGame(p);
    };
    box.appendChild(b);
  });
}
