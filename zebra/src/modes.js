const CHAPTERS = [
  {
    title: "第一章 · 窗边的邀请",
    theme: "cat",
    diff: "easy",
    index: 0,
    intro:
      "清晨，我把五只猫的小碟子摆好，却忘了谁坐在哪儿。小雪球，帮我把午睡前的座次找回来吧。",
    ending:
      "你把最后一张名牌放好，窗边响起满足的呼噜声。我替你留了一块暖和的坐垫。",
  },
  {
    title: "第二章 · 消失的毛线",
    theme: "cat",
    diff: "normal",
    index: 1,
    intro:
      "午后的毛线滚到了走廊尽头。五只猫各忙各的，谁也没注意。我把它们留下的线索记在纸上，请你还原现场。",
    ending:
      "毛线终于绕回篮子里。我笑着收起笔记：原来每一只猫，都有自己的午后计划。",
  },
  {
    title: "第三章 · 工坊来信",
    theme: "alva",
    diff: "normal",
    index: 2,
    intro:
      "我翻开一份虚构的永动轮小剧场手稿：五间实验室的门牌全被摘下了。我们得在客人到来前还原房间安排。",
    ending:
      "门牌一一归位。赫尔曼终于找到会议室，手稿的下一页却夹着一张没有署名的便条。",
  },
  {
    title: "第四章 · 灯亮以后",
    theme: "alva",
    diff: "hard",
    index: 3,
    intro:
      "便条上只有一句话：灯亮之前，把每个人的位置找出来。这一次，连饮料也成了线索。",
    ending:
      "工坊的灯亮了。我把故事最后一页递给你：今日值班侦探，小雪球。谢谢你陪我走到这里。",
  },
];
function dayKey() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}
function renderModes() {
  const story = REC.story || [],
    daily = REC.daily || [];
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
  document.getElementById("modeInfo").textContent =
    mode === "story"
      ? "四章小故事，解开当前章节即可解锁下一章；看答案不算通关。"
      : mode === "daily"
        ? dayKey() +
          " · 每日生成新题，往期题目可在下方补做。" +
          (daily.includes(dayKey())
            ? " 今日已完成，可重玩。"
            : " 今日尚未完成。")
        : "按筛选条件随机抽取未做题；也可打开题目列表自主选择。左右均以屏幕从左到右为准；“左边”可以不相邻。";
  const box = document.getElementById("chapters");
  box.innerHTML = "";
  if (mode === "story")
    CHAPTERS.forEach((ch, i) => {
      const b = document.createElement("button");
      b.className = "btn" + (chapter === i ? " on" : "");
      b.textContent = (story.includes(i) ? "✓ " : "") + ch.title;
      b.disabled = i > 0 && !story.includes(i - 1);
      b.onclick = () => {
        chapter = i;
        renderModes();
      };
      box.appendChild(b);
    });
  if (chapter > 0 && !story.includes(chapter - 1)) chapter = 0;
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
    ["故事收藏家", "完成全部四章", story.length >= 4],
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
