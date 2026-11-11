/* Evaluate only the player's entries, never the stored solution.
 * Unplaced values can occupy any blank cell in their category.
 * Mark fulfilled only when the referenced values have actually been placed.
 */
function clueState(clue, assignments) {
  const [kind, category, value, otherCategory, otherValue] = clue;
  function positions(cat, val) {
    const row = assignments[cat];
    const index = row.indexOf(val);
    return index >= 0 ? [index + 1] : row.flatMap((v, i) => (v ? [] : [i + 1]));
  }
  const left = positions(category, value);
  const placedLeft = assignments[category].includes(value);
  if (kind === "pos") {
    if (!left.includes(otherCategory)) return "conflict";
    return placedLeft ? "satisfied" : "pending";
  }
  const right = positions(otherCategory, otherValue);
  const relation = {
    same: (a, b) => a === b,
    next: (a, b) => b === a + 1,
    left: (a, b) => a < b,
  }[kind];
  if (!relation) return "pending";
  const possible = left.some((a) =>
    right.some(
      (b) =>
        !(category === otherCategory && value !== otherValue && a === b) &&
        relation(a, b),
    ),
  );
  if (!possible) return "conflict";
  return placedLeft && assignments[otherCategory].includes(otherValue)
    ? "satisfied"
    : "pending";
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
  document.querySelectorAll("#clues li").forEach((item, i) => {
    const state = clueState(S.cur.rawClues[i], S.assign);
    item.className = state;
    item.dataset.state = state;
    const status = item.querySelector(".clue-status");
    status.textContent = symbols[state];
    status.setAttribute("aria-label", labels[state]);
    item.title = labels[state];
  });
}
