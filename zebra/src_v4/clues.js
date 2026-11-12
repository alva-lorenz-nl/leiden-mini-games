/* Evaluate only the player's entries, never the stored solution.
 * Unplaced values can occupy any blank cell in their category.
 * Mark fulfilled only when the referenced values have actually been placed.
 */
function clueState(clue, assignments) {
  const [kind, c1, v1, c2, v2, gap] = clue;
  const rowOf = (c) => assignments[c] || [];
  const positions = (c, v) => {
    const row = rowOf(c);
    const i = row.indexOf(v);
    return i >= 0 ? [i + 1] : row.flatMap((x, j) => (x ? [] : [j + 1]));
  };
  const placed = (c, v) => rowOf(c).includes(v);

  if (kind === "pos") {
    if (!positions(c1, v1).includes(c2)) return "conflict";
    return placed(c1, v1) ? "satisfied" : "pending";
  }
  if (kind === "not") {
    if (placed(c1, v1)) return rowOf(c1).indexOf(v1) + 1 === c2 ? "conflict" : "satisfied";
    return positions(c1, v1).some((x) => x !== c2) ? "pending" : "conflict";
  }

  const relation = {
    same: (a, b) => a === b,
    next: (a, b) => b === a + 1,
    nextleft: (a, b) => b === a + 1,
    side: (a, b) => Math.abs(a - b) === 1,
    left: (a, b) => a < b,
    right: (a, b) => a > b,
    between: (a, b) => Math.abs(a - b) === gap + 1,
  }[kind];
  if (!relation) return "pending";

  const possible = positions(c1, v1).some((a) =>
    positions(c2, v2).some(
      (b) => !(c1 === c2 && v1 !== v2 && a === b) && relation(a, b),
    ),
  );
  if (!possible) return "conflict";
  return placed(c1, v1) && placed(c2, v2) ? "satisfied" : "pending";
}

function renderClues() {
  const list = document.getElementById("clues");
  list.replaceChildren();
  S.cur.clues.forEach((text) => {
    const item = document.createElement("li");
    const status = document.createElement("span");
    status.className = "clue-status";
    const label = document.createElement("span");
    label.className = "clue-text";
    label.textContent = text;
    item.append(status, label);
    list.appendChild(item);
  });
  list.parentElement.scrollTop = 0;
}

function updateClues() {
  if (!S.cur) return;
  const labels = {
    pending: "待确定",
    satisfied: "已满足",
    conflict: "与当前填表冲突",
  };
  const symbols = { pending: "□", satisfied: "✓", conflict: "✕" };
  let satisfied = 0;
  document.querySelectorAll("#clues li").forEach((item, i) => {
    const state = clueState(S.cur.rawClues[i], S.assign);
    item.className = state;
    item.dataset.state = state;
    if (state === "satisfied") satisfied++;
    const status = item.querySelector(".clue-status");
    status.textContent = symbols[state];
    status.setAttribute("aria-label", labels[state]);
    item.title = labels[state];
  });
  updateClueProgress(satisfied);
}

/* 顶部进度条：已满足的线索 / 全部线索 */
function updateClueProgress(satisfied) {
  const total = (S.cur?.rawClues || []).length;
  const label = $("clueProgress");
  if (label) label.textContent = satisfied + "/" + total;
  const bar = $("clueBar");
  if (bar) bar.style.width = (total ? (satisfied / total) * 100 : 0) + "%";
}
