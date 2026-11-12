/* 故事模式：通关档案、下一阶段入口 */
function renderStoryArchive(fragments, ending) {
  const box = $("storyBox");
  if (!box) return;
  box.replaceChildren();
  box.classList.remove("hidden");
  if (fragments.length) {
    box.appendChild(el("div", "label", "案件档案 · 逐层揭开"));
    fragments.forEach((f) => {
      const item = el("p", "frag");
      item.append(
        el("b", null, f.title + "　"),
        document.createTextNode(f.text),
      );
      box.appendChild(item);
    });
  }
  if (ending) {
    box.appendChild(el("div", "label", "收尾小剧场"));
    box.appendChild(el("p", "ending", ending));
  }
  if (box.scrollIntoView)
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* 追问的选项：正确答案加三个同类干扰项，顺序按题号固定 */
function questionOptions(p) {
  const val = p.answer && p.answer.value;
  if (!val) return [];
  const cat = Object.keys(p.categories).find((c) =>
    p.categories[c].includes(val),
  );
  if (!cat) return [];
  const others = p.categories[cat].filter((v) => v !== val);
  if (!others.length) return [];
  let seed = 0;
  String(p.id)
    .split("")
    .forEach((ch) => {
      seed = (seed * 31 + ch.charCodeAt(0)) % 100003;
    });
  const pool = others.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const j = seed % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const options = [val, ...pool.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const j = seed % (i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

/* 追问：通关后由玩家自己选，选对了才把这一层的剧情放出来 */
function renderQuestionGate(reveal) {
  const box = $("storyBox");
  const p = S.cur;
  const options = questionOptions(p);
  if (!options.length || !p.question) {
    reveal();
    return;
  }
  box.replaceChildren();
  box.classList.remove("hidden");
  const card = el("div", "ask");
  card.appendChild(el("div", "label", "追问"));
  card.appendChild(el("p", "ask-text", p.question));
  const row = el("div", "ask-row");
  const note = el("p", "ask-note", "选一个名字，看看当年到底是谁。");
  let wrong = 0;
  options.forEach((v) => {
    const b = button(v, () => {
      if (b.disabled) return;
      if (v === p.answer.value) {
        card.querySelectorAll("button").forEach((x) => {
          x.disabled = true;
        });
        note.textContent = "答对了。";
        note.className = "ask-note ok";
        setTimeout(reveal, 320);
        return;
      }
      wrong += 1;
      b.disabled = true;
      b.classList.add("wrong");
      if (wrong >= 3) {
        card.querySelectorAll("button").forEach((x) => {
          x.disabled = true;
        });
        note.textContent = `三个都没猜中，答案是「${p.answer.value}」。`;
        setTimeout(reveal, 900);
        return;
      }
      note.textContent = "不是这个，再想想。";
      note.className = "ask-note bad";
    });
    b.className = "btn ask-opt";
    b.type = "button";
    row.appendChild(b);
  });
  card.appendChild(row);
  card.appendChild(note);
  box.appendChild(card);
}

/* 通关当前阶段后，展示剧情并允许继续下一阶段 */
function showStoryResult() {
  const ch = CHAPTERS[S.chapter];
  if (!ch) return;
  const stageData = ch.stages[S.stage];
  const p = S.cur;
  const ending = (p.ending || stageData.ending || "").trim();
  const reveal = () => {
    renderStoryArchive(p.fragments || [], ending);
    addNextStage();
  };
  if (S.solved) {
    renderQuestionGate(reveal);
    return;
  }
  reveal();
}

/* 有下一阶段时补一个入口 */
function addNextStage() {
  const ch = CHAPTERS[S.chapter];
  if (!ch) return;
  if (S.stage + 1 >= ch.stages.length) return;
  if (S.stage + 1 >= ch.stages.length) return;
  const next = button(
    "继续下一阶段 →",
    () => {
      chapter = S.chapter;
      stage = S.stage + 1;
      mode = "story";
      startGame();
    },
    "btn primary",
  );
  next.id = "nextStageBtn";
  $("storyBox").appendChild(next);
}
