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

/* 通关当前阶段后，展示剧情并允许继续下一阶段 */
function showStoryResult() {
  const ch = CHAPTERS[S.chapter];
  if (!ch) return;
  const stageData = ch.stages[S.stage];
  const p = S.cur;
  const ending = (p.ending || stageData.ending || "").trim();
  renderStoryArchive(p.fragments || [], ending);
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
