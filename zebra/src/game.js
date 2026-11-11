/* ---------------- 首页 ---------------- */
function renderChoices() {
  const tr = document.getElementById("themeRow");
  tr.innerHTML = "";
  Object.keys({ all: "不限主题", ...THEME_NAMES }).forEach((k) => {
    const b = document.createElement("button");
    b.className = "btn" + (S.theme === k ? " on" : "");
    b.textContent = k === "all" ? "不限主题" : THEME_NAMES[k];
    b.onclick = () => {
      S.theme = k;
      localStorage.setItem("zebra_theme", k);
      renderChoices();
      renderList();
    };
    tr.appendChild(b);
  });
  const dr = document.getElementById("diffRow");
  dr.innerHTML = "";
  Object.keys({ all: "不限难度", ...DIFF_NAMES }).forEach((k) => {
    const b = document.createElement("button");
    b.className = "btn" + (S.diff === k ? " on" : "");
    b.textContent = k === "all" ? "不限难度" : DIFF_NAMES[k];
    b.onclick = () => {
      S.diff = k;
      localStorage.setItem("zebra_diff", k);
      renderChoices();
      renderList();
    };
    dr.appendChild(b);
  });
}

function pickPuzzle() {
  if (mode === "story") {
    const ch = CHAPTERS[chapter];
    if (!ch) return null;
    if (ch.src)
      return hydrate(
        PUZ[ch.src.theme + "_" + ch.src.diff][ch.src.index],
        ch.src.theme,
        ch.src.diff,
      );
    return hydrateStory(ch, chapter);
  }
  if (mode === "daily") {
    const item = BANK.daily.find((p) => p.date === dayKey());
    return item
      ? { ...hydrate(item, item.theme, item.diff), date: item.date }
      : null;
  }
  const pool = filteredPuzzles().filter((p) => !REC.done.includes(p.id));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

/* ---------------- 谜题 ---------------- */
function startGame(selected) {
  const p = selected && selected.id ? selected : pickPuzzle();
  if (!p) {
    document.getElementById("homeMsg").textContent =
      mode === "daily"
        ? "今日题目尚未发布，请稍后刷新；可以先做历史每日题。"
        : "当前筛选下没有未做题了；请放宽条件，或从题目列表选择重玩。";
    return;
  }
  S.cur = p;
  S.mode = mode;
  S.chapter = chapter;
  S.day = p.date || dayKey();
  S.recorded = false;
  S.undoStack = [];
  S.assign = {};
  S.n = p.categories[Object.keys(p.categories)[0]].length;
  Object.keys(p.categories).forEach(
    (c) => (S.assign[c] = new Array(S.n).fill(null)),
  );
  S.solved = false;
  const storyBox = document.getElementById("storyBox");
  if (storyBox) {
    storyBox.classList.add("hidden");
    storyBox.replaceChildren();
  }
  document.getElementById("home").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("gameTitle").textContent =
    `${S.mode === "story" ? p.theme : THEME_NAMES[p.theme_key] || p.theme} · ${DIFF_NAMES[p.difficulty] || p.difficulty} · ${p.clue_count} 条线索`;
  document.getElementById("intro").textContent =
    (S.mode === "story"
      ? CHAPTERS[S.chapter].intro + " "
      : S.mode === "daily"
        ? S.day + " 每日挑战（北京时间）。 "
        : "") + p.intro;
  document.getElementById("question").textContent = "追问：" + p.question;
  document.getElementById("gameMsg").textContent = "";
  document.getElementById("gameMsg").className = "msg";
  document.getElementById("checkBtn").disabled = false;
  document.getElementById("giveUpBtn").disabled = false;

  renderClues();

  renderGrid();
  startTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderGrid() {
  updateClues();
  updateEditButtons();
  const p = S.cur,
    tb = document.getElementById("grid");
  tb.innerHTML = "";
  const head = document.createElement("tr");
  head.appendChild(document.createElement("th"));
  for (let i = 1; i <= S.n; i++) {
    const th = document.createElement("th");
    th.textContent = p.colLabels ? p.colLabels[i - 1] : "第" + i + "位";
    head.appendChild(th);
  }
  tb.appendChild(head);

  Object.keys(p.categories).forEach((cat) => {
    const tr = document.createElement("tr");
    const rh = document.createElement("th");
    rh.className = "rowh";
    rh.textContent = cat;
    tr.appendChild(rh);
    for (let i = 0; i < S.n; i++) {
      const td = document.createElement("td");
      const b = document.createElement("select");
      b.className = "cell";
      b.dataset.cat = cat;
      b.dataset.idx = i;
      b.setAttribute("aria-label", cat + "，第" + (i + 1) + "位");
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "请选择";
      b.appendChild(empty);
      p.categories[cat].forEach((value) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
        b.appendChild(opt);
      });
      b.value = S.assign[cat][i] || "";
      b.disabled = S.solved;
      if (b.value) b.classList.add("filled");
      b.onchange = () => {
        setCell(cat, i, b.value || null);
        document
          .querySelectorAll("select.cell")
          [Object.keys(p.categories).indexOf(cat) * S.n + i].focus();
      };
      td.appendChild(b);
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  });
}

function setCell(cat, idx, v) {
  if (S.solved || S.assign[cat][idx] === v) return;
  S.undoStack.push(copyAssignments());
  clearEditMessage();
  // 同一类别里同一个值只能出现一次，若重复则清掉原来那格
  if (v) {
    const old = S.assign[cat].indexOf(v);
    if (old >= 0 && old !== idx) S.assign[cat][old] = null;
  }
  S.assign[cat][idx] = v;
  renderGrid();
}

function startTimer() {
  clearInterval(S.timerId);
  S.t0 = Date.now();
  S.elapsed = 0;
  document.getElementById("timer").textContent = "00:00";
  S.timerId = setInterval(() => {
    S.elapsed = (Date.now() - S.t0) / 1000;
    document.getElementById("timer").textContent = fmt(S.elapsed);
  }, 250);
}
function stopTimer() {
  clearInterval(S.timerId);
  S.timerId = null;
}

function check() {
  if (S.solved) return;
  const p = S.cur;
  let allFilled = true,
    wrong = 0;
  Object.keys(p.categories).forEach((cat) => {
    p.categories[cat].forEach((v, i) => {
      const mine = S.assign[cat][i];
      if (!mine) {
        allFilled = false;
        return;
      }
      if (mine !== p.solution[cat][i]) wrong++;
    });
  });
  const msg = document.getElementById("gameMsg");
  if (!allFilled) {
    msg.className = "msg no";
    msg.textContent = "还有空格没填。慢慢来，不急。";
    return;
  }
  if (wrong > 0) {
    msg.className = "msg no";
    msg.textContent = `有 ${wrong} 格不对。线索是够用的，再推一推。`;
    // 标红错误格
    document.querySelectorAll(".cell").forEach((b) => {
      const cat = b.dataset.cat,
        i = +b.dataset.idx,
        v = S.assign[cat][i];
      if (v && v !== p.solution[cat][i]) b.classList.add("wrong");
    });
    return;
  }
  // 全对
  S.solved = true;
  updateEditButtons();
  stopTimer();
  document.getElementById("checkBtn").disabled = true;
  document.getElementById("giveUpBtn").disabled = true;
  msg.className = "msg ok";
  msg.textContent = `全对！用时 ${fmt(S.elapsed)}。答案是「${p.answer.value}」。`;
  document.querySelectorAll(".cell").forEach((b) => {
    b.classList.add("right");
    b.disabled = true;
  });
  record(S.elapsed, true);
}

function giveUp() {
  if (S.solved) return;
  if (
    !confirm("确定查看答案吗？本题将标记为已做，本次不计通关，也不会解锁成就。")
  )
    return;
  const p = S.cur;
  S.solved = true;
  updateEditButtons();
  stopTimer();
  Object.keys(p.categories).forEach((cat) => {
    S.assign[cat] = p.solution[cat].slice();
  });
  renderGrid();
  document.querySelectorAll(".cell").forEach((b) => {
    b.classList.add("right");
    b.disabled = true;
  });
  document.getElementById("checkBtn").disabled = true;
  document.getElementById("giveUpBtn").disabled = true;
  const msg = document.getElementById("gameMsg");
  msg.className = "msg";
  msg.textContent = `答案是：${p.answer.value}。`;
  record(S.elapsed, false);
}

function record(sec, ok) {
  if (S.recorded) return;
  S.recorded = true;
  REC.story = REC.story || [];
  REC.daily = REC.daily || [];
  if (ok && S.mode === "story" && !REC.story.includes(S.chapter))
    REC.story.push(S.chapter);
  if (ok && S.mode === "daily" && !REC.daily.includes(S.day))
    REC.daily.push(S.day);
  if (ok && S.mode === "story") {
    const ch = CHAPTERS[S.chapter];
    const p0 = S.cur;
    const ending = (p0.ending || ch.ending || "").trim();
    renderStoryArchive(p0.fragments || [], ending);
  }

  const p = S.cur;
  const d = p.difficulty;
  if (!REC.solved[d]) REC.solved[d] = { n: 0, best: null, total: 0 };
  if (ok && !(REC.wins || []).includes(p.id)) {
    REC.wins = REC.wins || [];
    REC.wins.push(p.id);
    const s = REC.solved[d];
    s.n++;
    s.total += sec;
    s.best = s.best == null ? sec : Math.min(s.best, sec);
  }
  if (!REC.done.includes(p.id)) REC.done.push(p.id);
  const now = new Date();
  REC.history.unshift({
    time: `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    theme: p.theme_key,
    diff: d,
    sec: Math.round(sec),
    ok,
    mode: S.mode,
  });
  REC.history = REC.history.slice(0, 60);
  saveRec(REC);
  renderStats();
}

// Capture the whole board so moving a duplicate value is one undoable action.
function copyAssignments() {
  return Object.fromEntries(
    Object.entries(S.assign).map(([cat, row]) => [cat, row.slice()]),
  );
}
function clearEditMessage() {
  const msg = document.getElementById("gameMsg");
  msg.textContent = "";
  msg.className = "msg";
}
function updateEditButtons() {
  document.getElementById("undoBtn").disabled =
    S.solved || !S.undoStack?.length;
  document.getElementById("resetBtn").disabled =
    S.solved || !Object.values(S.assign).some((row) => row.some(Boolean));
}
function undoMove() {
  if (S.solved || !S.undoStack.length) return;
  S.assign = S.undoStack.pop();
  clearEditMessage();
  renderGrid();
}
function resetBoard() {
  if (S.solved || !Object.values(S.assign).some((row) => row.some(Boolean)))
    return;
  if (
    !confirm(
      "确定清空本题的所有填写吗？计时继续，已保存的档案不受影响；清空后可以撤回。",
    )
  )
    return;
  S.undoStack.push(copyAssignments());
  Object.keys(S.assign).forEach((cat) => S.assign[cat].fill(null));
  clearEditMessage();
  renderGrid();
}

/* 通关后展开故事档案：分段剧情 + 收尾小剧场 */
function renderStoryArchive(fragments, ending) {
  const box = document.getElementById("storyBox");
  if (!box) return;
  box.replaceChildren();
  box.classList.remove("hidden");
  if (fragments.length) {
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = "案件档案 · 逐层揭开";
    box.appendChild(label);
    fragments.forEach((f) => {
      const item = document.createElement("p");
      item.className = "frag";
      const t = document.createElement("b");
      t.textContent = f.title + "　";
      item.append(t, document.createTextNode(f.text));
      box.appendChild(item);
    });
  }
  if (ending) {
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = "收尾小剧场";
    box.appendChild(label);
    const p = document.createElement("p");
    p.className = "ending";
    p.textContent = ending;
    box.appendChild(p);
  }
  if (box.scrollIntoView)
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
