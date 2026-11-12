/* 棋盘：点击填格、取值面板、撤回/重置、随填随查、看答案 */

/* 每格显示的是“值”，空格显示一个淡淡的圆点；点击弹出取值面板 */
function renderGrid() {
  updateClues();
  updateEditButtons();
  renderQuestion();
  const p = S.cur,
    tb = $("grid");
  tb.replaceChildren();
  tb.classList.toggle("dense", S.n >= 6);

  const head = document.createElement("tr");
  head.appendChild(el("th", "corner", ""));
  for (let i = 1; i <= S.n; i++) {
    const th = el("th", "colh");
    th.appendChild(el("span", "colnum", String(i)));
    th.appendChild(
      el(
        "span",
        "collabel",
        p.colLabels ? p.colLabels[i - 1] : "第" + i + "位",
      ),
    );
    head.appendChild(th);
  }
  tb.appendChild(head);

  Object.keys(p.categories).forEach((cat) => {
    const tr = document.createElement("tr");
    tr.appendChild(el("th", "rowh", cat));
    for (let i = 0; i < S.n; i++) {
      const td = document.createElement("td");
      td.appendChild(cellButton(p, cat, i));
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  });
}

/* 追问条：棋盘上方的一条小问题，答案槽会随填表自动对上 */
function renderQuestion() {
  const box = $("question");
  if (!box) return;
  const p = S.cur;
  box.replaceChildren();
  box.appendChild(el("span", "q-tag", "追问"));
  box.appendChild(el("span", "q-text", p.question));

  const slot = el("span", "q-slot");
  const val = p.answer.value;
  const cat = Object.keys(p.categories).find((c) =>
    p.categories[c].includes(val),
  );
  const row = (cat && S.assign?.[cat]) || [];
  const at = row.indexOf(val);
  if (at >= 0) {
    slot.className += " on";
    slot.appendChild(el("b", null, val));
    slot.appendChild(el("i", null, "第 " + (at + 1) + " 位"));
  } else {
    slot.textContent = "还空着";
  }
  box.appendChild(slot);
}

function cellButton(p, cat, i) {
  const v = S.assign[cat][i];
  const b = el("button", "cell" + (v ? " filled" : "") + (v ? "" : " empty"));
  b.dataset.cat = cat;
  b.dataset.idx = i;
  b.type = "button";
  b.setAttribute(
    "aria-label",
    cat + "，第" + (i + 1) + "位" + (v ? "：" + v : "：空"),
  );
  b.textContent = v || "·";
  if (S.hinted?.[cat]?.[i]) b.classList.add("hinted");
  b.disabled = S.solved;
  if (S.focus && S.focus.cat === cat && S.focus.idx === i)
    b.classList.add("focus");
  b.onclick = (ev) => {
    ev.stopPropagation();
    S.focus = { cat, idx: i };
    openPicker(cat, i, b);
  };
  return b;
}

/* ---------- 取值面板 ---------- */
function pickerNode() {
  let box = $("cellPicker");
  if (box) return box;
  box = el("div", "picker");
  box.id = "cellPicker";
  box.hidden = true;
  box.innerHTML =
    '<div class="picker-box" role="dialog" aria-label="选择这一格的内容">' +
    '<div class="picker-head"><span id="pickerTitle"></span>' +
    '<button type="button" class="picker-x" id="pickerClose" aria-label="关闭">×</button></div>' +
    '<div class="picker-opts" id="pickerOpts"></div></div>';
  document.body.appendChild(box);
  box.addEventListener("click", (ev) => {
    if (ev.target === box) closePicker();
  });
  return box;
}

function openPicker(cat, idx, anchor) {
  if (S.solved) return;
  const p = S.cur,
    box = pickerNode(),
    opts = $("pickerOpts");
  $("pickerTitle").textContent = cat + " · 第 " + (idx + 1) + " 位";
  opts.replaceChildren();

  p.categories[cat].forEach((value) => {
    const usedAt = S.assign[cat].indexOf(value);
    const b = el(
      "button",
      "opt" +
        (S.assign[cat][idx] === value ? " on" : "") +
        (usedAt >= 0 && usedAt !== idx ? " used" : ""),
    );
    b.type = "button";
    b.appendChild(el("span", "opt-t", value));
    if (usedAt >= 0 && usedAt !== idx)
      b.appendChild(el("span", "opt-note", "已在第 " + (usedAt + 1) + " 位"));
    b.onclick = () => {
      setCell(cat, idx, value);
      closePicker();
    };
    opts.appendChild(b);
  });

  const clear = el("button", "opt clear", "清空这一格");
  clear.type = "button";
  clear.onclick = () => {
    setCell(cat, idx, null);
    closePicker();
  };
  opts.appendChild(clear);

  box.hidden = false;
  positionPicker(box, anchor);
  $("pickerClose").onclick = closePicker;
  renderGrid();
}

/* 面板贴着被点的那一格，靠近边缘时自动收进视口 */
function positionPicker(box, anchor) {
  const rect = anchor?.getBoundingClientRect?.();
  box.style.left = "50%";
  box.style.top = "50%";
  box.style.transform = "translate(-50%,-50%)";
  if (!rect || (!rect.width && !rect.height)) return;
  const panel = box.querySelector(".picker-box");
  const w = panel.offsetWidth || 260,
    h = panel.offsetHeight || 240;
  const gap = 8;
  let left = rect.left + rect.width / 2 - w / 2;
  left = Math.max(10, Math.min(left, window.innerWidth - w - 10));
  let top = rect.bottom + gap;
  if (top + h > window.innerHeight - 10) top = Math.max(10, rect.top - h - gap);
  box.style.transform = "none";
  box.style.left = left + "px";
  box.style.top = top + "px";
}

function closePicker() {
  const box = $("cellPicker");
  if (box) box.hidden = true;
}

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closePicker();
});

/* ---------- 填表 ---------- */
function setCell(cat, idx, v) {
  if (S.solved || S.assign[cat][idx] === v) return;
  S.undoStack.push(copyAssignments());
  clearEditMessage();
  // 同一类别里同一个值只能出现一次，若重复则把原来那格让出来
  if (v) {
    const old = S.assign[cat].indexOf(v);
    if (old >= 0 && old !== idx) S.assign[cat][old] = null;
  }
  S.assign[cat][idx] = v;
  renderGrid();
  autoCheck();
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
  closePicker();
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
  S.hinted = {};
  clearEditMessage();
  closePicker();
  renderGrid();
}

/* 只统计玩家填表：空格数与冲突线索数，不提前泄露答案 */
function inspectBoard() {
  let blanks = 0,
    conflicts = 0;
  Object.values(S.assign).forEach((row) =>
    row.forEach((v) => {
      if (!v) blanks++;
    }),
  );
  (S.cur.rawClues || []).forEach((clue) => {
    if (clueState(clue, S.assign) === "conflict") conflicts++;
  });
  return { blanks, conflicts };
}

/* 全表填满且没有冲突时，自动判定完成 */
function autoCheck() {
  if (S.solved) return;
  const { blanks, conflicts } = inspectBoard();
  if (blanks) return;
  if (conflicts) {
    setMessage(
      "gameMsg",
      `有 ${conflicts} 条线索和当前填表冲突，回到线索里再推一推。`,
      "no",
    );
    return;
  }
  finishBoard(true);
}

function check() {
  if (S.solved) return;
  const { blanks, conflicts } = inspectBoard();
  if (blanks)
    return setMessage("gameMsg", `还有 ${blanks} 格没填。慢慢来，不急。`, "no");
  if (conflicts)
    return setMessage(
      "gameMsg",
      `有 ${conflicts} 条线索和当前填表冲突。线索是够用的，再推一推。`,
      "no",
    );
  setMessage("gameMsg", "所有线索都对上了。", "ok");
}

/* 提示：替你把最有把握的一格填上，计一次提示 */
function hintCell() {
  if (S.solved) return;
  const p = S.cur;
  const blanks = [];
  Object.keys(p.categories).forEach((cat) => {
    p.categories[cat].forEach((_, i) => {
      if (!S.assign[cat][i]) blanks.push({ cat, i });
    });
  });
  if (!blanks.length) return;
  const pick = blanks[Math.floor(Math.random() * blanks.length)];
  S.undoStack.push(copyAssignments());
  const v = p.solution[pick.cat][pick.i];
  const old = S.assign[pick.cat].indexOf(v);
  if (old >= 0) S.assign[pick.cat][old] = null;
  S.assign[pick.cat][pick.i] = v;
  S.hinted = S.hinted || {};
  S.hinted[pick.cat] = S.hinted[pick.cat] || [];
  S.hinted[pick.cat][pick.i] = true;
  setMessage("gameMsg", `提示：${pick.cat} 的第 ${pick.i + 1} 位是「${v}」。`);
  renderGrid();
  autoCheck();
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
  closePicker();
  updateEditButtons();
  renderGrid();
  document.querySelectorAll(".cell").forEach((b) => {
    b.classList.add("right");
    b.disabled = true;
  });
  $("checkBtn").disabled = true;
  $("giveUpBtn").disabled = true;
  $("hintBtn").disabled = true;
  if (ok)
    setMessage(
      "gameMsg",
      `全对！用时 ${fmt(S.elapsed)}。答案是「${S.cur.answer.value}」。`,
      "ok",
    );
  else setMessage("gameMsg", `答案是：${S.cur.answer.value}。`);
  record(S.elapsed, ok);
}
