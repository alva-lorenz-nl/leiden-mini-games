/* 成就：全部由档案字段推导，不单独存档 */
function achievementDefs() {
  const total = Object.values(REC.solved).reduce((n, v) => n + v.n, 0);
  const daily = REC.daily || [];
  return [
    ["初露锋芒", "独立完成第一道题", total >= 1],
    ["小猫侦探", "累计完成10道不同题", total >= 10],
    ["勇闯工坊", "完成一道困难题", (REC.solved.hard?.n || 0) > 0],
    ["每日赴约", "完成一次每日挑战", daily.length >= 1],
    ["七日手记", "累计完成7天每日挑战", daily.length >= 7],
    [
      "故事收藏家",
      `完成全部 ${CHAPTERS.length} 个故事`,
      CHAPTERS.every(storyDone),
    ],
  ];
}

function renderAchievements() {
  const box = $("achievements");
  box.replaceChildren();
  achievementDefs().forEach(([name, desc, unlocked]) => {
    const item = el("div", "stat");
    const title = el("b", null, (unlocked ? "★ " : "☆ ") + name);
    title.style.fontSize = "14px";
    item.append(
      title,
      el("span", null, desc + (unlocked ? " · 已解锁" : " · 未解锁")),
    );
    box.appendChild(item);
  });
}
