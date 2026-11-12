/* 追问回归：自由模式不出追问，故事模式通关后手动选，选对才放出剧情 */
const fs = require("fs");
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
    w.confirm = () => true;
    w.scrollTo = () => {};
    w.Element.prototype.scrollIntoView = () => {};
    w.HTMLElement.prototype.scrollIntoView = () => {};
  },
});
const w = dom.window,
  d = w.document;
const errs = [];
w.addEventListener("error", (e) => errs.push(String(e.message)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};

function fillAll(Z) {
  const S = Z.S;
  Object.keys(S.cur.categories).forEach((cat) => {
    S.cur.solution[cat].forEach((val, idx) => {
      const cell = d.querySelector(
        `.cell[data-cat="${cat}"][data-idx="${idx}"]`,
      );
      cell.click();
      const opt = [...d.querySelectorAll("#pickerOpts .opt")].find(
        (b) => b.querySelector(".opt-t").textContent === val,
      );
      opt.click();
    });
  });
}

(async () => {
  await sleep(200);
  const Z = w.ZEBRA,
    S = Z.S;

  d.getElementById("startBtn").click();
  await sleep(200);
  out.freeAsk = !!d.querySelector(".ask");
  out.freeQuestionEl = !!d.getElementById("question");
  d.getElementById("backBtn").click();
  await sleep(150);

  d.querySelector('[data-mode="story"]').click();
  await sleep(150);
  [...d.querySelectorAll("#chapters button")].find((b) => !b.disabled).click();
  await sleep(150);
  [...d.querySelectorAll("#storyStages button")]
    .find((b) => !b.disabled)
    .click();
  await sleep(150);
  d.getElementById("startBtn").click();
  await sleep(250);
  out.storyStarted = S.mode === "story" && !!S.cur;
  out.askBeforeSolve = !!d.querySelector(".ask");

  fillAll(Z);
  await sleep(200);
  out.solved = S.solved;
  const ask = d.querySelector("#storyBox .ask");
  out.askShown = !!ask;
  out.askText = ask && ask.querySelector(".ask-text").textContent;
  const opts = ask ? [...ask.querySelectorAll("button")] : [];
  out.options = opts.map((b) => b.textContent);
  out.answer = S.cur.answer.value;
  out.answerInOptions = out.options.includes(out.answer);
  out.fragsBefore = d.querySelectorAll("#storyBox .frag").length;
  out.msgLeaks = d.getElementById("gameMsg").textContent.includes(out.answer);

  const wrong = opts.find((b) => b.textContent !== out.answer);
  wrong.click();
  await sleep(80);
  out.noteBad = ask.querySelector(".ask-note").textContent;
  out.fragsAfterWrong = d.querySelectorAll("#storyBox .frag").length;
  out.wrongDisabled = wrong.disabled;

  opts.find((b) => b.textContent === out.answer).click();
  await sleep(700);
  out.fragsAfterRight = d.querySelectorAll("#storyBox .frag").length;
  out.endingShown = !!d.querySelector("#storyBox .ending");
  out.nextBtn = !!d.getElementById("nextStageBtn");
  out.askGone = !d.querySelector("#storyBox .ask");
  const bad = [];
  const want = (cond, label) => {
    if (!cond) bad.push(label);
  };
  want(!out.freeAsk, "自由模式不该出现追问");
  want(!out.freeQuestionEl, "自由模式不该有自动答案槽");
  want(!out.askBeforeSolve, "没解出来就弹追问");
  want(out.askShown, "通关后没有追问");
  want(out.answerInOptions, "选项里没有正确答案");
  want(out.options.length >= 2 && out.options.length <= 4, "选项数量异常");
  want(out.fragsBefore === 0, "追问前就放出了剧情");
  want(!out.msgLeaks, "通关提示提前说出了追问答案");
  want(out.fragsAfterWrong === 0, "答错也放出了剧情");
  want(out.wrongDisabled, "答错的选项没被禁用");
  want(out.endingShown, "答对后没放剧情");
  want(out.askGone, "答对后追问卡没撤");
  want(!errs.length, "控制台报错：" + errs.join("；"));
  if (bad.length) {
    console.log("FAIL: 追问 " + bad.join("；"));
    process.exit(1);
  }
  console.log("PASS: 追问 — 故事通关后才问、手动选择、选对放剧情");
  process.exit(0);
})();
