/* 本地档案：读取校验、保存、统计与历史 */
const EMPTY_RECORD = () => ({ solved: {}, history: [], done: [] });

function loadRec() {
  try {
    const raw = localStorage.getItem("zebra_records");
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const records = EMPTY_RECORD();
        for (const key of ["done", "wins", "daily"])
          records[key] = Array.isArray(data[key])
            ? data[key].filter((x) => typeof x === "string")
            : [];
        records.story = Array.isArray(data.story)
          ? data.story.filter((x) => Number.isInteger(x) && x >= 0)
          : [];
        records.history = Array.isArray(data.history)
          ? data.history.filter((x) => x && typeof x === "object").slice(0, 60)
          : [];
        for (const key of Object.keys(DIFF_NAMES)) {
          const stat = data.solved?.[key];
          if (
            stat &&
            Number.isInteger(stat.n) &&
            stat.n >= 0 &&
            Number.isFinite(stat.total) &&
            stat.total >= 0 &&
            (stat.best === null ||
              (Number.isFinite(stat.best) && stat.best >= 0))
          )
            records.solved[key] = {
              n: stat.n,
              best: stat.best,
              total: stat.total,
            };
        }
        return records;
      }
    }
  } catch (e) {}
  return EMPTY_RECORD();
}

function saveRec(r) {
  localStorage.setItem("zebra_records", JSON.stringify(r));
}

function resetRecords() {
  REC = EMPTY_RECORD();
  saveRec(REC);
  renderStats();
}

let REC = loadRec();

const fmt = formatClock;

/* 记录一次作答。同一题只记一次，看答案也计入“已做”。 */
function record(sec, ok) {
  if (S.recorded) return;
  S.recorded = true;
  REC.story = REC.story || [];
  REC.daily = REC.daily || [];
  if (
    ok &&
    S.mode === "story" &&
    CHAPTERS[S.chapter].stages.length === 1 &&
    !REC.story.includes(S.chapter)
  )
    REC.story.push(S.chapter);
  if (ok && S.mode === "daily" && !REC.daily.includes(S.day))
    REC.daily.push(S.day);
  if (ok && S.mode === "story") showStoryResult();

  const p = S.cur;
  const d = p.difficulty;
  if (!REC.solved[d]) REC.solved[d] = { n: 0, best: null, total: 0 };
  const generated = String(p.id).startsWith("gen-");
  if (ok && (generated || !(REC.wins || []).includes(p.id))) {
    REC.wins = REC.wins || [];
    if (!generated) REC.wins.push(p.id);
    const s = REC.solved[d];
    s.n++;
    s.total += sec;
    s.best = s.best == null ? sec : Math.min(s.best, sec);
  }
  if (!generated && !REC.done.includes(p.id)) REC.done.push(p.id);
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

/* 档案面板：各难度统计与最近记录 */
function renderStats() {
  renderModes();
  const box = $("statBox");
  box.replaceChildren();
  ["easy", "normal", "hard"].forEach((d) => {
    const s = REC.solved[d] || { n: 0, best: null, total: 0 };
    const avg = s.n ? fmt(s.total / s.n) : "—";
    const item = el("div", "stat");
    const count = el("b", null, `${s.n} 题`);
    const detail = el(
      "span",
      null,
      `${DIFF_NAMES[d]} · 最快 ${s.best == null ? "—" : fmt(s.best)} · 平均 ${avg}`,
    );
    item.append(count, detail);
    box.appendChild(item);
  });

  const h = $("histBox");
  h.style.whiteSpace = "pre-line";
  if (!REC.history.length) {
    h.textContent = "还没有记录。做一题，这里就会留下痕迹。";
    return;
  }
  h.textContent = REC.history
    .filter((x) => x && typeof x === "object")
    .slice(0, 12)
    .map(
      (x) =>
        `· ${x.time}　${THEME_NAMES[x.theme] || x.theme} / ${DIFF_NAMES[x.diff] || x.diff}　${x.ok ? "完成" : "查看答案"} · 用时 ${fmt(x.sec)}`,
    )
    .join("\n");
}
