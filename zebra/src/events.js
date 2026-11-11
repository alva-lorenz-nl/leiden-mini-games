document.getElementById("undoBtn").onclick = undoMove;
document.getElementById("resetBtn").onclick = resetBoard;
document.getElementById("listBtn").onclick = () => {
  renderList();
  document.getElementById("puzzleList").classList.toggle("hidden");
};
/* ---------------- 绑定 ---------------- */
document.querySelectorAll("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      mode = b.dataset.mode;
      renderModes();
    }),
);
document.getElementById("startBtn").onclick = startGame;
document.getElementById("checkBtn").onclick = check;
document.getElementById("giveUpBtn").onclick = giveUp;
document.getElementById("backBtn").onclick = () => {
  stopTimer();
  document.getElementById("game").classList.add("hidden");
  document.getElementById("home").classList.remove("hidden");
  renderStats();
};
document.getElementById("exportBtn").onclick = doExport;
document.getElementById("importBtn").onclick = doImport;
document.getElementById("syncDo").onclick = syncConfirm;
document.getElementById("syncCancel").onclick = () =>
  document.getElementById("syncBox").classList.add("hidden");
document.getElementById("clearBtn").onclick = () => {
  if (confirm("清空本机的全部记录？同步码可以留着备份。")) {
    REC = { solved: {}, history: [], done: [] };
    saveRec(REC);
    renderStats();
  }
};

renderChoices();
renderStats();

/* 调试用：控制台里可以查看当前题目状态 */
window.ZEBRA = {
  S,
  get REC() {
    return REC;
  },
};
