/* 事件绑定与启动 */
function bindEvents() {
  $("undoBtn").onclick = undoMove;
  $("resetBtn").onclick = resetBoard;
  $("hintBtn").onclick = hintCell;
  $("listBtn").onclick = () => {
    if ($("listBtn").disabled) return;
    renderList();
    $("puzzleList").classList.toggle("hidden");
  };

  document.querySelectorAll("[data-mode]").forEach((b) => {
    b.onclick = () => {
      mode = b.dataset.mode;
      setMessage("homeMsg", "");
      renderModes();
      updateStartState();
    };
  });

  $("startBtn").onclick = () => startGame();
  $("checkBtn").onclick = check;
  $("giveUpBtn").onclick = giveUp;
  $("backBtn").onclick = backHome;

  $("exportBtn").onclick = doExport;
  $("importBtn").onclick = doImport;
  $("syncDo").onclick = syncConfirm;
  $("syncCancel").onclick = () => $("syncBox").classList.add("hidden");
  $("clearBtn").onclick = () => {
    if (confirm("清空本机的全部记录？同步码可以留着备份。")) resetRecords();
  };
}

function init() {
  bindEvents();
  renderChoices();
  renderStats();
}

init();

/* 调试用：控制台里可以查看当前题目状态 */
window.ZEBRA = {
  S,
  get REC() {
    return REC;
  },
};
