const fs = require("fs"),
  assert = require("assert");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(
  require("path").join(__dirname, "../../zebra_puzzle_test.html"),
  "utf8",
);
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  url: "https://alva-lorenz.top/minigames/zebra_puzzle_test.html",
  beforeParse(w) {
    w.TextEncoder = TextEncoder;
    w.TextDecoder = TextDecoder;
    w.scrollTo = () => {};
    w.alert = () => {};
    w.confirm = () => true;
  },
});
const w = dom.window,
  d = w.document;
const click = (id) => d.getElementById(id).click();

click("startBtn");
const S = w.ZEBRA.S;
assert(S.cur, "puzzle started");
const cells = d.querySelectorAll(".cell");
assert.equal(cells.length, Object.keys(S.cur.categories).length * 5);
assert(!d.querySelector("select.cell"), "no dropdown selects anymore");
assert.equal(d.getElementById("clueProgress").textContent, "0/" + S.cur.rawClues.length);

/* 点击格子 -> 面板 -> 选值 */
const cat = Object.keys(S.cur.categories)[0];
cells[0].click();
assert(!d.getElementById("cellPicker").hidden, "picker opens on cell click");
const opts = d.querySelectorAll("#pickerOpts .opt");
assert.equal(opts.length, S.cur.categories[cat].length + 1);
const value = opts[0].querySelector(".opt-t").textContent;
opts[0].click();
assert(d.getElementById("cellPicker").hidden, "picker closes after choosing");
assert.equal(S.assign[cat][0], value);
assert.equal(
  d.querySelector('.cell[data-cat="' + cat + '"][data-idx="0"]').textContent,
  value,
);

/* 同一类别的值换位置：原来那格让出来，且可撤回 */
const other = S.cur.categories[cat].find((v) => v !== value);
w.setCell(cat, 1, other);
const before = JSON.stringify(S.assign[cat]);
w.setCell(cat, 2, other);
assert.equal(S.assign[cat][1], null);
click("undoBtn");
assert.equal(JSON.stringify(S.assign[cat]), JSON.stringify([value, other, null, null, null]));
assert.notEqual(before, null);

/* 冲突线索会被标出来 */
const conflictClue = S.cur.rawClues.findIndex((c) => c[0] === "pos");
if (conflictClue >= 0) {
  const clue = S.cur.rawClues[conflictClue];
  w.setCell(clue[1], clue[3] - 1, S.cur.categories[clue[1]].find((v) => v !== clue[2]));
  assert.equal(
    d.querySelectorAll("#clues li")[conflictClue].dataset.state,
    "conflict",
  );
  w.eval("S.assign = Object.fromEntries(Object.entries(S.assign).map(([k,r])=>[k,new Array(5).fill(null)])); S.undoStack=[]; renderGrid();");
}

/* 提示：填一格并标记 */
click("hintBtn");
const hinted = d.querySelector(".cell.hinted");
assert(hinted && hinted.textContent.length > 0, "hint fills a cell");

/* 填满正确答案 -> 自动判定完成，无需点按钮 */
const sol = S.cur.solution;
Object.keys(sol).forEach((c) => {
  sol[c].forEach((v, i) => {
    S.assign[c][i] = v;
  });
});
w.renderGrid();
w.autoCheck();
assert(S.solved, "auto finish when board complete and consistent");
assert(d.getElementById("gameMsg").className.includes("ok"));
assert(d.getElementById("clueProgress").textContent ===
  S.cur.rawClues.length + "/" + S.cur.rawClues.length, "progress full");
assert(d.querySelectorAll("#clues li.satisfied").length === S.cur.rawClues.length);
assert(d.getElementById("hintBtn").disabled);

/* 回首页、再来一局，重置与撤回 */
click("backBtn");
click("startBtn");
assert(!w.ZEBRA.S.solved);
w.setCell(Object.keys(w.ZEBRA.S.assign)[0], 0, w.ZEBRA.S.cur.categories[Object.keys(w.ZEBRA.S.assign)[0]][0]);
click("resetBtn");
assert(Object.values(w.ZEBRA.S.assign).every((r) => r.every((v) => !v)));
click("undoBtn");
assert(Object.values(w.ZEBRA.S.assign).some((r) => r.some(Boolean)));

/* 看答案后棋盘锁定 */
click("giveUpBtn");
assert(w.ZEBRA.S.solved);
assert(d.querySelector(".cell").disabled);
console.log("PASS: v4 board — click-to-pick, unique values, undo/reset, live clue states, hint, auto-finish");
dom.window.close();
