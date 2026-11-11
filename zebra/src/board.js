/* 棋盘：渲染表格、填值、撤回/重置、提交与看答案 */
function renderGrid() {
  updateClues();
  updateEditButtons();
  const p = S.cur,
    tb = $("grid");
  tb.replaceChildren();

  const head = document.createElement("tr");
  head.appendChild(document.createElement("th"));
  for (let i = 1; i <= S.n; i++) {
    head.appendChild(
      el("th", null, p.colLabels ? p.colLabels[i - 1] : "第" + i + "位"),
    );
  }
  tb.appendChild(head);

  const cats = Object.keys(p.categories);
  cats.forEach((cat, rowIndex) => {
    const tr = document.createElement("tr");
    tr.appendChild(el("th", "rowh", cat));
    for (let i = 0; i < S.n; i++) {
      const td = document.createElement("td");
      td.appendChild(cellSelect(p, cat, i, rowIndex));
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  });
}

function cellSelect(p, cat, i, rowIndex) {
  const b = document.createElement("select");
  b.className = "cell";
  b.dataset.cat = cat;
  b.dataset.idx = i;
  b.setAttribute("aria-label", cat + "，第" + (i + 1) + "位");
  b.appendChild(new Option("请选择", ""));
  p.categories[cat].forEach((value) => b.appendChild(new Option(value, value)));
  b.value = S.assign[cat][i] || "";
  b.disabled = S.solved;
  if (b.value) b.classList.add("filled");
  b.onchange = () => {
    setCell(cat, i, b.value || null);
    // 重绘后把焦点放回同一格，方便连续填写
    document.querySelectorAll("select.cell")[rowIndex * S.n + i]?.focus();
  };
  return b;
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

/* 整表快照：移动重复值造成的原格清空也作为一步撤回 */
function copyAssignments() {
  return Object.fromEntries(
    Object.entries(S.assign).map(([cat, row]) => [cat, row.slice()]),
  );
}

function clearEditMessage() {
  setMessage("gameMsg", "");
}

function updateEditButtons() {
  $("undoBtn").disabled = S.solved || !S.undoStack?.length;
  $("resetBtn").disabled =
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

/* 返回空格数、错误格数；只看玩家填表，不提前泄露答案 */
function inspectBoard() {
  const p = S.cur;
  let blanks = 0,
    wrong = 0;
  Object.keys(p.categories).forEach((cat) => {
    p.categories[cat].forEach((_, i) => {
      const mine = S.assign[cat][i];
      if (!mine) blanks++;
      else if (mine !== p.solution[cat][i]) wrong++;
    });
  });
  return { blanks, wrong };
}

function check() {
  if (S.solved) return;
  const { blanks, wrong } = inspectBoard();
  if (blanks)
    return setMessage("gameMsg", "还有空格没填。慢慢来，不急。", "no");
  if (wrong) {
    setMessage("gameMsg", `有 ${wrong} 格不对。线索是够用的，再推一推。`, "no");
    document.querySelectorAll(".cell").forEach((b) => {
      const cat = b.dataset.cat,
        i = +b.dataset.idx,
        v = S.assign[cat][i];
      if (v && v !== S.cur.solution[cat][i]) b.classList.add("wrong");
    });
    return;
  }
  finishBoard(true);
}

function giveUp() {
  if (S.solved) return;
  if (
    !confirm("确定查看答案吗？本题将标记为已做，本次不计通关，也不会解锁成就。")
  )
    return;
  const p = S.cur;
  Object.keys(p.categories).forEach((cat) => {
    S.assign[cat] = p.solution[cat].slice();
  });
  finishBoard(false);
}

/* 结束本题：锁定棋盘、停表、显示结果并写入档案 */
function finishBoard(ok) {
  S.solved = true;
  stopTimer();
  updateEditButtons();
  renderGrid();
  document.querySelectorAll(".cell").forEach((b) => {
    b.classList.add("right");
    b.disabled = true;
  });
  $("checkBtn").disabled = true;
  $("giveUpBtn").disabled = true;
  if (ok)
    setMessage(
      "gameMsg",
      `全对！用时 ${fmt(S.elapsed)}。答案是「${S.cur.answer.value}」。`,
      "ok",
    );
  else setMessage("gameMsg", `答案是：${S.cur.answer.value}。`);
  record(S.elapsed, ok);
}
