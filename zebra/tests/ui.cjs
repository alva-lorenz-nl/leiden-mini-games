const fs = require("fs"),
  assert = require("assert");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(
  require("path").join(__dirname, "../../zebra_puzzle.html"),
  "utf8",
);
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  url: "https://alva-lorenz.top/minigames/zebra_puzzle.html",
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
function click(id) {
  d.getElementById(id).click();
}
function mode(m) {
  d.querySelector('[data-mode="' + m + '"]').click();
}
function win() {
  const s = w.ZEBRA.S;
  for (const c in s.cur.solution) s.assign[c] = Array.from(s.cur.solution[c]);
  click("checkBtn");
  assert(s.solved);
}
mode("story");
assert(d.getElementById("freeFilters").classList.contains("hidden"));
mode("daily");
assert(d.getElementById("freeFilters").classList.contains("hidden"));
const bank = w.eval("BANK");
assert(bank.daily.length > 0);
const today = w.eval("dayKey()");
assert(bank.daily.some((p) => p.date === today));
assert.equal(
  d.querySelectorAll("#dailyArchive button").length,
  bank.daily.filter((p) => p.date <= today).length,
);
// Simulate a later day: future puzzles become history and completion uses selected date.
const realDay = w.dayKey;
w.dayKey = () => bank.daily.at(-1).date;
w.renderModes();
const historic = bank.daily[0];
d.querySelectorAll("#dailyArchive button")[bank.daily.length - 1].click();
assert.equal(w.ZEBRA.S.day, historic.date);
win();
assert(w.ZEBRA.REC.daily.includes(historic.date));
click("backBtn");
w.dayKey = realDay;
w.ZEBRA.REC.daily = [];
mode("free");
assert(!d.getElementById("freeFilters").classList.contains("hidden"));
click("startBtn");
assert(d.querySelectorAll("select.cell").length >= 20);
assert(d.querySelectorAll("#clues li.pending").length > 0);
for (const c in w.ZEBRA.S.cur.solution)
  w.ZEBRA.S.assign[c] = Array.from(w.ZEBRA.S.cur.solution[c]);
w.updateClues();
assert.equal(
  d.querySelectorAll("#clues li.satisfied").length,
  w.ZEBRA.S.cur.clue_count,
);
const assignments = {
  A: ["a", null, null, null, null],
  B: [null, "b", null, null, null],
};
assert.equal(
  w.clueState(["next", "A", "a", "B", "b"], assignments),
  "satisfied",
);
assert.equal(
  w.clueState(["same", "A", "a", "B", "b"], assignments),
  "conflict",
);
assert.equal(
  w.clueState(["left", "B", "b", "A", "a"], assignments),
  "conflict",
);
assert.equal(w.clueState(["pos", "A", "a", 2], assignments), "conflict");
assert.equal(w.clueState(["pos", "A", "a", 1], assignments), "satisfied");
assignments.B[1] = null;
assert.equal(w.clueState(["next", "A", "a", "B", "b"], assignments), "pending");
assignments.B[1] = "other";
assert.equal(
  w.clueState(["next", "A", "a", "B", "b"], assignments),
  "conflict",
);
assert.equal(w.clueState(["pos", "B", "b", 2], assignments), "conflict");
assignments.B[1] = null;
assert.equal(w.clueState(["pos", "B", "b", 2], assignments), "pending");
click("backBtn");
assert.equal(d.querySelectorAll("#achievements .stat").length, 6);
mode("story");
assert.equal(d.querySelectorAll("#chapters button:disabled").length, 3);
click("startBtn");
win();
assert(w.ZEBRA.REC.story.includes(0));
assert(d.getElementById("gameMsg").textContent.includes("呼噜声"));
click("backBtn");
assert.equal(d.querySelectorAll("#chapters button:disabled").length, 2);
for (let i = 1; i < 4; i++) {
  d.querySelectorAll("#chapters button")[i].click();
  click("startBtn");
  win();
  click("backBtn");
}
assert.equal(w.ZEBRA.REC.story.length, 4);
mode("daily");
click("startBtn");
let id = w.ZEBRA.S.cur.id;
click("backBtn");
click("startBtn");
assert.equal(w.ZEBRA.S.cur.id, id);
win();
assert.equal(w.ZEBRA.REC.daily.length, 1);
click("backBtn");
// New progress format excludes history but retains aggregate achievements.
click("exportBtn");
const code = d.getElementById("syncText").value;
assert(code.startsWith("ZBR3-"));
const encoded = code.slice(5, code.lastIndexOf("-"));
const exported = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
assert(!("history" in exported));
assert(exported.w.length > 0);

click("clearBtn");
assert.equal(w.ZEBRA.REC.story, undefined);
click("importBtn");
d.getElementById("syncText").value = code;
click("syncDo");
assert.equal(w.ZEBRA.REC.story.length, 4);
assert.equal(w.ZEBRA.REC.daily.length, 1);
mode("free");
click("startBtn");
const doneBefore = w.ZEBRA.REC.done.length;
w.confirm = () => false;
click("giveUpBtn");
assert(!w.ZEBRA.S.solved);
assert.equal(w.ZEBRA.REC.done.length, doneBefore);
w.confirm = () => true;
click("giveUpBtn");
const n = Object.values(w.ZEBRA.REC.solved).reduce((a, v) => a + v.n, 0);
click("checkBtn");
assert.equal(
  Object.values(w.ZEBRA.REC.solved).reduce((a, v) => a + v.n, 0),
  n,
);
assert(
  !d.getElementById("gameMsg").textContent.includes(w.ZEBRA.S.cur.question),
);
console.log(
  "PASS: four chapter progression, daily stability, six achievements, sync roundtrip and revealed-answer exclusion",
);
dom.window.close();
