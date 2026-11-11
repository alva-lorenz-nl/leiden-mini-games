/* ---------------- 档案 ---------------- */
function loadRec() {
  try {
    const raw = localStorage.getItem("zebra_records");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { solved: {}, history: [], done: [] };
}
function saveRec(r) {
  localStorage.setItem("zebra_records", JSON.stringify(r));
}
let REC = loadRec();
let mode = "free",
  chapter = 0;

function fmt(sec) {
  sec = Math.round(sec);
  const m = Math.floor(sec / 60),
    s = sec % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function renderStats() {
  renderModes();
  const box = document.getElementById("statBox");
  box.innerHTML = "";
  ["easy", "normal", "hard"].forEach((d) => {
    const s = REC.solved[d] || { n: 0, best: null, total: 0 };
    const avg = s.n ? fmt(s.total / s.n) : "—";
    const el = document.createElement("div");
    el.className = "stat";
    el.innerHTML = `<b>${s.n} 题</b><span>${DIFF_NAMES[d]} · 最快 ${s.best == null ? "—" : fmt(s.best)} · 平均 ${avg}</span>`;
    box.appendChild(el);
  });
  const h = document.getElementById("histBox");
  if (!REC.history.length) {
    h.textContent = "还没有记录。做一题，这里就会留下痕迹。";
  } else {
    h.innerHTML = REC.history
      .slice(0, 12)
      .map(
        (x) =>
          `· ${x.time}　${THEME_NAMES[x.theme] || x.theme} / ${DIFF_NAMES[x.diff] || x.diff}　${x.ok ? "完成" : "查看答案"} · 用时 ${fmt(x.sec)}`,
      )
      .join("<br>");
  }
}
