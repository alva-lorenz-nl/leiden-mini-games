/* 开局：选题、初始化状态、计时 */
function pickPuzzle() {
  if (mode === "story") {
    const ch = CHAPTERS[chapter]?.stages[stage];
    if (!ch || (stage > 0 && !stageDone(CHAPTERS[chapter], stage - 1)))
      return null;
    const title = CHAPTERS[chapter].title + " · " + ch.title;
    if (ch.src) {
      const p = hydrate(
        PUZ[ch.src.theme + "_" + ch.src.diff][ch.src.index],
        ch.src.theme,
        ch.src.diff,
      );
      return { ...p, theme: title };
    }
    return hydrateStory({ ...ch, title }, chapter);
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

function startGame(selected) {
  const p = selected && selected.id ? selected : pickPuzzle();
  if (!p) {
    $("homeMsg").textContent =
      mode === "daily"
        ? "今日题目尚未发布，请稍后刷新；可以先做历史每日题。"
        : "当前筛选下没有未做题了；请放宽条件，或从题目列表选择重玩。";
    return;
  }
  S.cur = p;
  S.mode = mode;
  S.chapter = chapter;
  S.stage = stage;
  S.day = p.date || dayKey();
  S.recorded = false;
  S.undoStack = [];
  S.assign = {};
  S.n = p.categories[Object.keys(p.categories)[0]].length;
  Object.keys(p.categories).forEach(
    (c) => (S.assign[c] = new Array(S.n).fill(null)),
  );
  S.solved = false;

  const storyBox = $("storyBox");
  storyBox.classList.add("hidden");
  storyBox.replaceChildren();
  toggleHidden("home", true);
  toggleHidden("game", false);
  $("gameTitle").textContent = puzzleTitle(p);
  $("intro").textContent = puzzleIntro(p);
  $("question").textContent = "追问：" + p.question;
  setMessage("gameMsg", "");
  $("checkBtn").disabled = false;
  $("giveUpBtn").disabled = false;

  renderClues();
  renderGrid();
  startTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function puzzleTitle(p) {
  const theme =
    S.mode === "story" ? p.theme : THEME_NAMES[p.theme_key] || p.theme;
  return `${theme} · ${DIFF_NAMES[p.difficulty] || p.difficulty} · ${p.clue_count} 条线索`;
}

function puzzleIntro(p) {
  if (S.mode === "story") {
    const ch = CHAPTERS[S.chapter];
    return (ch.stages[S.stage].intro || ch.intro) + " " + p.intro;
  }
  if (S.mode === "daily") return S.day + " 每日挑战（北京时间）。 " + p.intro;
  return p.intro;
}

function startTimer() {
  clearInterval(S.timerId);
  S.t0 = Date.now();
  S.elapsed = 0;
  $("timer").textContent = "00:00";
  S.timerId = setInterval(() => {
    S.elapsed = (Date.now() - S.t0) / 1000;
    $("timer").textContent = fmt(S.elapsed);
  }, 250);
}

function stopTimer() {
  clearInterval(S.timerId);
  S.timerId = null;
}

function backHome() {
  stopTimer();
  toggleHidden("game", true);
  toggleHidden("home", false);
  renderStats();
}
