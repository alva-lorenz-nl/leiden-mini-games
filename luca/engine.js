// engine.js - 核心状态、公式计算、三层转生、挑战、成就、离线结算与主循环
function createDefaultState() {
  return {
    energy: 0,
    runEnergy: 0,
    totalEnergy: 0,
    reports: 0,
    tickspeed: 0,
    sacrificeMult: 1,
    rp: 0,
    totalDrafts: 0,
    pp: 0,
    defenses: 0,
    ttBought: { e: 0, rp: 0, pp: 0 },
    paradigms: {},
    paradigmPresets: [
      { name: '预设 1 · 日常挂机', nodes: [] },
      { name: '预设 2 · 质询挑战', nodes: [] },
      { name: '预设 3 · 冲刺答辩', nodes: [] }
    ],
    autoThesisEnabled: false,
    autoThesisMinRP: 1,
    autoReportStopAtThesis: false,
    runTime: 0,
    activeChallenge: null,
    challengeCompletions: { ec1: 0, ec2: 0, ec3: 0, ec4: 0 },
    entropyTime: 0,
    achievements: {},
    antimatter: 0,
    paperclips: 0,
    tickerClicks: 0,
    mutedClicks: 0,
    totalClicks: 0,
    thrownEnergyCount: 0,
    shareRerolls: 0,
    stampClicks: 0,
    physicsMilestones: {},
    buyMode: 1,
    activeTab: 'lab',
    muteModal: false,
    units: {},
    seenUnits: {},
    maxRpEver: 0,
    labUpgrades: {},
    upgrades: {},
    autos: {},
    settings: {
      theme: 'cyber',
      notation: 'sci',
      compactMode: false,
      hideBoughtLab: false,
      showTicker: true,
      floatText: true,
      skipPrestigeConfirm: false,
      assistantName: ''
    },
    tuning: { ...BALANCE.defaultTuning },
    logs: [],
    lastTick: Date.now()
  };
}

let state = createDefaultState();

// 运行时临时状态（不持久化）
let pendingEvent = null;
let activeBuffs = [];
let nextEventTimer = 90;
let lastSaveTime = null;
let isHardResetting = false;
let lastInteractionTime = Date.now();
let lastExportedSaveStr = '';

function recordUserInteraction() {
  lastInteractionTime = Date.now();
  const hr = new Date().getHours();
  if (hr >= 2 && hr < 5) {
    unlockAchievement('ach_no_sleep');
  }
}

function initMissingFields() {
  if (!state.units) state.units = {};
  if (!state.labUpgrades) state.labUpgrades = {};
  if (!state.upgrades) state.upgrades = {};
  if (!state.autos) state.autos = {};
  if (!state.paradigms) state.paradigms = {};
  const defaultPresets = [
    { name: '预设 1 · 日常挂机', nodes: [] },
    { name: '预设 2 · 质询挑战', nodes: [] },
    { name: '预设 3 · 冲刺答辩', nodes: [] }
  ];
  if (!Array.isArray(state.paradigmPresets) || state.paradigmPresets.length < 3) {
    const prev = Array.isArray(state.paradigmPresets) ? state.paradigmPresets : [];
    state.paradigmPresets = defaultPresets.map((d, idx) => ({
      name: (prev[idx] && typeof prev[idx].name === 'string' && prev[idx].name.trim()) ? prev[idx].name : d.name,
      nodes: (prev[idx] && Array.isArray(prev[idx].nodes)) ? prev[idx].nodes.slice() : []
    }));
  }
  if (!state.achievements) state.achievements = {};
  if (!state.ttBought) state.ttBought = { e: 0, rp: 0, pp: 0 };
  if (!state.challengeCompletions) state.challengeCompletions = { ec1: 0, ec2: 0, ec3: 0, ec4: 0 };
  if (!Array.isArray(state.logs)) state.logs = [];
  const defaultSettings = { theme: 'cyber', notation: 'sci', compactMode: false, hideBoughtLab: false, showTicker: true, floatText: true, skipPrestigeConfirm: false, assistantName: '' };
  state.settings = { ...defaultSettings, ...(state.settings || {}) };
  if (typeof state.antimatter !== 'number') state.antimatter = 0;
  if (typeof state.paperclips !== 'number') state.paperclips = 0;
  if (typeof state.tickerClicks !== 'number') state.tickerClicks = 0;
  if (typeof state.mutedClicks !== 'number') state.mutedClicks = 0;
  if (typeof state.totalClicks !== 'number') state.totalClicks = 0;
  if (typeof state.thrownEnergyCount !== 'number') state.thrownEnergyCount = 0;
  if (typeof state.shareRerolls !== 'number') state.shareRerolls = 0;
  if (typeof state.stampClicks !== 'number') state.stampClicks = 0;
  if (!state.physicsMilestones || typeof state.physicsMilestones !== 'object') state.physicsMilestones = {};
  if (typeof state.runTime !== 'number') state.runTime = 0;
  if (typeof state.entropyTime !== 'number') state.entropyTime = 0;
  if (typeof state.tickspeed !== 'number' || !isFinite(state.tickspeed)) state.tickspeed = 0;
  if (typeof state.sacrificeMult !== 'number' || !isFinite(state.sacrificeMult) || state.sacrificeMult < 1) state.sacrificeMult = 1;
  if (typeof state.autoThesisMinRP !== 'number' || !isFinite(state.autoThesisMinRP) || state.autoThesisMinRP < 1) state.autoThesisMinRP = 1;

  if (!state.seenUnits) state.seenUnits = {};
  if (typeof state.maxRpEver !== 'number') state.maxRpEver = 0;
  if ((state.rp || 0) > state.maxRpEver) state.maxRpEver = state.rp;

  for (const u of BALANCE.units) {
    if (typeof state.units[u.id] !== 'number') state.units[u.id] = 0;
    if (state.units[u.id] > 0) state.seenUnits[u.id] = true;
  }
  for (const a of BALANCE.automators) {
    if (!state.autos[a.id]) {
      state.autos[a.id] = { unlocked: false, enabled: false, speedLvl: 0, acc: 0 };
    }
  }
  for (const ch of BALANCE.challenges) {
    if (typeof state.challengeCompletions[ch.id] !== 'number') {
      state.challengeCompletions[ch.id] = 0;
    }
  }
}

function formatNum(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + formatNum(-n);
  const notation = (state.settings && state.settings.notation) || 'sci';
  if (notation === 'entropy') {
    if (n === 0) return '零';
    if (n < 10) return '一丁点';
    if (n < 100) return '一点点';
    if (n < 1e3) return '一些';
    if (n < 1e5) return '不少了';
    if (n < 1e7) return '很多';
    if (n < 1e10) return '相当多';
    if (n < 1e14) return '太多了';
    if (n < 1e20) return '红笔溢出';
    if (n < 1e30) return '热力学已死';
    return '别数了';
  }
  if (n < 10000) return n.toFixed(n < 10 && n % 1 !== 0 ? 1 : 0);
  if (notation === 'cn' && n < 1e20) {
    const units = [
      { v: 1e16, s: '京' },
      { v: 1e12, s: '兆' },
      { v: 1e8,  s: '亿' },
      { v: 1e4,  s: '万' }
    ];
    for (const u of units) {
      if (n >= u.v) return `${(n / u.v).toFixed(2)}${u.s}`;
    }
  }
  const exp = Math.floor(Math.log10(n));
  const mant = n / Math.pow(10, exp);
  return `${mant.toFixed(2)}e${exp}`;
}

function hasLabUpg(id) { return !!state.labUpgrades[id]; }
function hasUpg(id) { return !!state.upgrades[id]; }
function getUpgLevel(id) {
  return typeof state.upgrades[id] === 'number' ? state.upgrades[id] : (state.upgrades[id] ? 1 : 0);
}
function hasMilestone(req) { return (state.defenses || 0) >= req; }
function hasParadigm(id) { return !!(state.paradigms && state.paradigms[id]); }
function hasAchievement(id) { return !!(state.achievements && state.achievements[id]); }

function isLabUpgradeUnlocked(upg) {
  if (hasLabUpg(upg.id)) return true;
  if (upg.reqUnit && (state.units[upg.reqUnit] || 0) < (upg.reqCount || 1)) {
    return false;
  }
  return true;
}

// --- 渐进式显示判断（仅在已触发过或快要可以触发时显现） ---
function isUnitVisible(u, index) {
  if (index === 0) return true;
  if ((state.activeChallenge === 'ec1' || state.activeChallenge === 'ec4') && u.id === 'leydenJar') return true;
  if ((state.units[u.id] || 0) > 0) return true;
  if (state.seenUnits && state.seenUnits[u.id]) return true;
  if (state.energy >= u.baseCost * 0.25 || state.runEnergy >= u.baseCost * 0.35) return true;
  const prev = BALANCE.units[index - 1];
  if (prev && (state.units[prev.id] || 0) > 0 && state.energy >= u.baseCost * 0.15) return true;
  return false;
}

function isRpUpgradeVisible(upg) {
  const lvl = getUpgLevel(upg.id);
  if (lvl > 0) return true;
  if (upg.tier === 'T1') return true;
  if ((state.defenses || 0) > 0) return true;
  const cost = upg.repeatable ? upg.baseCost * Math.pow(upg.costMult || 4, lvl) : upg.cost;
  const effectiveRp = Math.max(state.rp || 0, state.maxRpEver || 0);
  if (effectiveRp >= cost * 0.35 || ((state.rp || 0) + getPendingRP()) >= cost * 0.45) return true;
  return false;
}

function isAutomatorVisible(a) {
  const st = state.autos[a.id];
  if (st && st.unlocked) return true;
  if (a.id === 'auto_L1') return true;
  if ((state.defenses || 0) > 0) return true;
  const effectiveRp = Math.max(state.rp || 0, state.maxRpEver || 0);
  if (effectiveRp >= a.cost * 0.35 || ((state.rp || 0) + getPendingRP()) >= a.cost * 0.45) return true;
  if (a.layerGroup && getLayerCount(a.layerGroup) > 0) return true;
  return false;
}

function isPrestigeVisible(level) {
  if (level === 1) return true;
  if (level === 2) {
    return (state.totalDrafts || 0) > 0
      || (state.rp || 0) > 0
      || (state.maxRpEver || 0) > 0
      || (state.defenses || 0) > 0
      || (state.reports || 0) >= 1
      || (state.runEnergy || 0) >= (state.tuning.thesisReq || 2.5e7) * 0.2;
  }
  if (level === 3) {
    const defReq = state.tuning.defenseReq || 10000;
    return (state.defenses || 0) > 0
      || (state.pp || 0) > 0
      || hasUpg('u_break')
      || (state.rp || 0) >= defReq * 0.2
      || (state.maxRpEver || 0) >= defReq * 0.2;
  }
  return true;
}

function isParadigmVisible(p) {
  if (hasParadigm(p.id)) return true;
  if (!p.req) return true;
  return hasParadigm(p.req);
}

function isTabUnlocked(tab) {
  if (tab === 'shop' || tab === 'auto') {
    return (state.totalDrafts || 0) > 0
      || (state.rp || 0) > 0
      || (state.maxRpEver || 0) > 0
      || (state.defenses || 0) > 0
      || Object.keys(state.upgrades || {}).length > 0
      || BALANCE.automators.some(a => state.autos[a.id] && state.autos[a.id].unlocked);
  }
  if (tab === 'defense') {
    return (state.defenses || 0) > 0
      || (state.pp || 0) > 0
      || getTotalTT() > 0
      || !!state.activeChallenge
      || BALANCE.challenges.some(ch => getChallengeComp(ch.id) > 0);
  }
  return true;
}

function isChallengesSectionUnlocked() {
  return (state.defenses || 0) >= 2
    || getTotalTT() >= 2
    || (state.maxRpEver || 0) >= 2.5e4
    || !!state.activeChallenge
    || BALANCE.challenges.some(ch => getChallengeComp(ch.id) > 0);
}

function isChallengeVisible(ch, index) {
  if (!isChallengesSectionUnlocked()) return false;
  if (index === 0) return true;
  if (state.activeChallenge === ch.id || getChallengeComp(ch.id) > 0) return true;
  const prev = BALANCE.challenges[index - 1];
  if (prev && getChallengeComp(prev.id) > 0) return true;
  const goal = getChallengeGoal(ch.id);
  const effectiveRp = Math.max(state.rp || 0, state.maxRpEver || 0);
  if (effectiveRp >= goal * 0.05) return true;
  return false;
}

function getLayerCount(group) {
  let sum = 0;
  for (const u of BALANCE.units) {
    if (u.layerGroup === group) sum += (state.units[u.id] || 0);
  }
  return sum;
}

function getChallengeComp(id) {
  return (state.challengeCompletions && state.challengeCompletions[id]) || 0;
}

function getChallengeGoal(id) {
  const ch = BALANCE.challenges.find(x => x.id === id);
  const comp = getChallengeComp(id);
  if (!ch || comp >= ch.maxComp) return Infinity;
  return ch.goals[comp];
}

function getEntropyPenalty() {
  if (state.activeChallenge !== 'ec2') return 1;
  return Math.max(0.0001, Math.exp(-state.entropyTime * 0.15));
}

function getEffectiveR(u) {
  let baseR = u.r;
  if (u.layerGroup === 'L1' && hasUpg('u_wholesale')) baseR -= 0.01;
  if (u.id === 'butteredCat' && hasLabUpg('lu_freezeDried') && state.activeChallenge !== 'ec1') {
    baseR -= 0.01;
  }
  if (u.id === 'superconductor' && hasLabUpg('lu_liquidHelium')) baseR -= 0.01;
  baseR -= getChallengeComp('ec2') * 0.002;
  baseR = Math.max(1.04, baseR);
  return 1 + (baseR - 1) * (state.tuning.growthMult || 1);
}

function getUnitCost(u, count = state.units[u.id]) {
  return u.baseCost * Math.pow(getEffectiveR(u), count);
}

function getBulkBuyInfo(u, mode = state.buyMode) {
  const r = getEffectiveR(u);
  const firstCost = getUnitCost(u, state.units[u.id]);
  if (!isFinite(firstCost) || firstCost <= 0) return { count: 0, cost: Infinity };
  if (mode === 'max') {
    if (state.energy < firstCost) return { count: 0, cost: firstCost };
    const ratio = (state.energy * (r - 1)) / firstCost;
    const rawK = isFinite(ratio)
      ? Math.floor(Math.log(1 + ratio) / Math.log(r))
      : Math.floor((Math.log(state.energy) + Math.log(r - 1) - Math.log(firstCost)) / Math.log(r));
    const maxSafeK = Math.max(1, Math.floor(Math.log(Number.MAX_VALUE / Math.max(1, firstCost)) / Math.log(r)));
    let hi = Math.max(1, Math.min(rawK, maxSafeK));
    const costOf = (n) => (n === 1 ? firstCost : firstCost * (Math.pow(r, n) - 1) / (r - 1));
    let totalCost = costOf(hi);
    if (!isFinite(totalCost) || totalCost > state.energy) {
      let lo = 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const c = costOf(mid);
        if (isFinite(c) && c <= state.energy) lo = mid;
        else hi = mid - 1;
      }
      hi = lo;
      totalCost = costOf(hi);
    }
    return { count: hi, cost: totalCost };
  }
  const totalCost = firstCost * (Math.pow(r, mode) - 1) / (r - 1);
  return { count: mode, cost: totalCost };
}

function getMilestoneMult(count) {
  let m = 1;
  if (count >= 10) m *= 1.5;
  if (count >= 25) m *= 2;
  if (count >= 50) m *= 2.5;
  if (count >= 100) m *= 3;
  return m;
}

function getReportMult() {
  const base = hasUpg('u_error') ? 2.5 : 2.0;
  return Math.pow(base, state.reports);
}

function getReportReq() { return 5000 * Math.pow(10, state.reports); }
function getTotalUnitsCount() { return Object.values(state.units).reduce((a, b) => a + b, 0); }

function getAchievementCount() {
  return Object.keys(state.achievements || {}).length;
}

function getAchievementMult() {
  return 1 + getAchievementCount() * (BALANCE.achievementBonus || 0.02);
}

function getBuffMultipliers() {
  let epsMult = 1;
  let clickMult = 1;
  for (const b of activeBuffs) {
    if (b.epsMult) epsMult *= b.epsMult;
    if (b.clickMult) clickMult *= b.clickMult;
  }
  return { epsMult, clickMult };
}

// --- 超频刻度（Tickspeed）与实验台过载献祭（Sacrifice） ---
function getTickspeedStep() {
  const cfg = BALANCE.tickspeed || { baseStep: 1.12, reportStepBonus: 0.015, maxStep: 1.35 };
  return Math.min(cfg.maxStep, cfg.baseStep + (state.reports || 0) * cfg.reportStepBonus);
}

function getTickspeedCost(lvl = state.tickspeed || 0) {
  const cfg = BALANCE.tickspeed || { baseCost: 1000, costMult: 10 };
  return cfg.baseCost * Math.pow(cfg.costMult, lvl);
}

function getTickspeedMult() {
  const lvl = state.tickspeed || 0;
  if (lvl <= 0) return 1;
  return Math.pow(getTickspeedStep(), lvl);
}

function isTickspeedVisible() {
  return (state.tickspeed || 0) > 0
    || (state.energy || 0) >= 600
    || (state.runEnergy || 0) >= 1000
    || (state.reports || 0) > 0
    || (state.totalDrafts || 0) > 0
    || (state.defenses || 0) > 0;
}

function buyTickspeed(buyMax = false) {
  let bought = 0;
  if (buyMax) {
    const cfg = BALANCE.tickspeed || { baseCost: 1000, costMult: 10 };
    const firstCost = getTickspeedCost();
    if (!isFinite(firstCost) || state.energy < firstCost) return false;
    const r = cfg.costMult;
    const ratio = (state.energy * (r - 1)) / firstCost;
    const rawK = isFinite(ratio)
      ? Math.floor(Math.log(1 + ratio) / Math.log(r))
      : Math.floor((Math.log(state.energy) + Math.log(r - 1) - Math.log(firstCost)) / Math.log(r));
    const maxSafeK = Math.max(1, Math.floor(Math.log(Number.MAX_VALUE / Math.max(1, firstCost)) / Math.log(r)));
    let hi = Math.max(1, Math.min(rawK, maxSafeK));
    const costOf = (n) => (n === 1 ? firstCost : firstCost * (Math.pow(r, n) - 1) / (r - 1));
    let totalCost = costOf(hi);
    if (!isFinite(totalCost) || totalCost > state.energy) {
      let lo = 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const c = costOf(mid);
        if (isFinite(c) && c <= state.energy) lo = mid;
        else hi = mid - 1;
      }
      hi = lo;
      totalCost = costOf(hi);
    }
    if (hi > 0 && isFinite(totalCost) && state.energy >= totalCost) {
      state.energy -= totalCost;
      state.tickspeed = (state.tickspeed || 0) + hi;
      bought = hi;
    }
  } else {
    const cost = getTickspeedCost();
    if (!isFinite(cost) || state.energy < cost) return false;
    state.energy -= cost;
    state.tickspeed = (state.tickspeed || 0) + 1;
    bought = 1;
  }
  if (bought > 0 && state.activeChallenge === 'ec2') {
    state.entropyTime *= 0.5;
  }
  return bought > 0;
}

function getSacrificeFodderCount() {
  return getLayerCount('L1') + getLayerCount('L2') + getLayerCount('L3');
}

function isSacrificeVisible() {
  return getLayerCount('L4') > 0 || (state.sacrificeMult || 1) > 1;
}

function getSacrificeTargetMult() {
  const fodder = getSacrificeFodderCount();
  if (getLayerCount('L4') <= 0 || fodder <= 0) return state.sacrificeMult || 1;
  const logE = Math.log10(Math.max(10, state.runEnergy || 10));
  const target = Math.max(1, Math.pow(logE / 10, 2) * (1 + fodder * 0.05));
  return Math.max(state.sacrificeMult || 1, target);
}

function canSacrifice() {
  if (getLayerCount('L4') <= 0 || getSacrificeFodderCount() <= 0) return false;
  const cur = state.sacrificeMult || 1;
  const target = getSacrificeTargetMult();
  return target >= cur * 1.05;
}

function performSacrifice() {
  if (!canSacrifice()) return false;
  const oldMult = state.sacrificeMult || 1;
  const newMult = getSacrificeTargetMult();
  const fodder = getSacrificeFodderCount();

  for (const u of BALANCE.units) {
    if (u.layerGroup !== 'L4') state.units[u.id] = 0;
  }
  state.sacrificeMult = newMult;
  if (newMult >= 5) unlockAchievement('ach_sacrifice');

  addLog(`🔥 [过载献祭] 拆解了 ${fodder} 台 L1~L3 装置投入 L4 核心，L4 产出倍率提升至 ×${formatNum(newMult)}（原 ×${formatNum(oldMult)}）！`);
  if (typeof SFX !== 'undefined') SFX.playCrit();
  saveGame();
  renderAll();
  return true;
}

function getMultiplierBreakdown() {
  const rows = [];
  const pushRow = (name, mult, note = '') => {
    rows.push({ name, mult, note });
  };

  pushRow('实验报告倍率', getReportMult(), `已提交 ${state.reports || 0} 次（单次 ×${hasUpg('u_error') ? '2.5' : '2.0'}）`);
  pushRow('实验台主频超频', getTickspeedMult(), `Lv.${state.tickspeed || 0}（每级 ×${getTickspeedStep().toFixed(3)}）`);

  if (hasUpg('u_frame')) {
    pushRow('红笔升级 · 错题本裱框', 1 + 0.5 * (state.totalDrafts || 0), `累计交论文 ${state.totalDrafts || 0} 次`);
  }
  if (hasUpg('u_refs')) {
    const totalU = getTotalUnitsCount();
    pushRow('红笔升级 · 参考文献堆砌术', 1 + Math.floor(totalU / 10) * 0.15, `当前共 ${totalU} 台组件`);
  }
  if (hasUpg('u_pride')) {
    pushRow('红笔升级 · 红笔胜负欲', 1 + 0.8 * Math.log(1 + (state.rp || 0)), `当前未花 RP：${formatNum(state.rp || 0)}`);
  }
  if ((state.pp || 0) > 0) {
    pushRow('专利点数常驻加成', 1 + state.pp * 2, `当前拥有 ${formatNum(state.pp)} PP`);
  }
  if (hasParadigm('p_ai1')) {
    const aiCap = 100 * Math.pow(2, getChallengeComp('ec3'));
    const aiVal = Math.min(aiCap, 1 + (state.runTime || 0) * 0.05);
    pushRow('范式 · 长程梯度下降', aiVal, `本轮挂机 ${formatDuration(state.runTime || 0)}（上限 ×${formatNum(aiCap)}）`);
  }
  const ec4Comp = getChallengeComp('ec4');
  if (ec4Comp > 0) {
    const emTotal = BALANCE.emUnits.reduce((sum, id) => sum + (state.units[id] || 0), 0);
    pushRow('质询奖励 · 电磁共振反哺', 1 + emTotal * 0.01 * ec4Comp, `${emTotal} 台电磁组件 × ${ec4Comp}%`);
  }
  const qCount = state.units.quantumCore || 0;
  const rlCount = state.units.rlAgent || 0;
  const qRate = hasLabUpg('lu_vacuumShield') ? 0.20 : 0.12;
  const rlRate = hasLabUpg('lu_rlGpu') ? 0.04 : 0.02;
  if (qCount > 0 || rlCount > 0) {
    pushRow('L4 核心全局协同', 1 + qCount * qRate + rlCount * rlRate, `AI ×${rlCount} · 量子核心 ×${qCount}`);
  }
  pushRow('成就墙永久加成', getAchievementMult(), `已解锁 ${getAchievementCount()} 项（每项 +2%）`);
  if (state.activeChallenge === 'ec2') {
    pushRow('质询限制 · 高熵损耗', getEntropyPenalty(), '购买组件减半衰减，交报告重置');
  }
  const buffEps = getBuffMultipliers().epsMult;
  if (buffEps !== 1) {
    pushRow('突发随机事件 Buff', buffEps, `${activeBuffs.length} 个生效中`);
  }

  const totalGlobal = getGlobalMult() * buffEps;
  return { rows, totalGlobal };
}

function getGlobalMult() {
  let m = getReportMult() * getTickspeedMult();
  if (hasUpg('u_frame')) m *= (1 + 0.5 * state.totalDrafts);
  if (hasUpg('u_refs')) m *= (1 + Math.floor(getTotalUnitsCount() / 10) * 0.15);
  if (hasUpg('u_pride')) m *= (1 + 0.8 * Math.log(1 + state.rp));
  if (state.pp > 0) m *= (1 + state.pp * 2);

  if (hasParadigm('p_ai1')) {
    const aiCap = 100 * Math.pow(2, getChallengeComp('ec3'));
    m *= Math.min(aiCap, 1 + state.runTime * 0.05);
  }

  const ec4Comp = getChallengeComp('ec4');
  if (ec4Comp > 0) {
    const emTotal = BALANCE.emUnits.reduce((sum, id) => sum + (state.units[id] || 0), 0);
    m *= (1 + emTotal * 0.01 * ec4Comp);
  }

  const qCount = state.units.quantumCore || 0;
  const rlCount = state.units.rlAgent || 0;
  const qRate = hasLabUpg('lu_vacuumShield') ? 0.20 : 0.12;
  const rlRate = hasLabUpg('lu_rlGpu') ? 0.04 : 0.02;
  m *= (1 + qCount * qRate + rlCount * rlRate);
  m *= getAchievementMult();
  m *= getEntropyPenalty();
  return m;
}

function getUnitEpS(u) {
  const c = state.units[u.id] || 0;
  if (c <= 0) return 0;

  if (state.activeChallenge === 'ec1' && u.layerGroup === 'L1') return 0;
  if (state.activeChallenge === 'ec4' && !BALANCE.emUnits.includes(u.id)) return 0;

  const catCount  = state.units.butteredCat || 0;
  const birdCount = state.units.drinkingBird || 0;
  const pidCount  = state.units.pidLoop || 0;
  const l2Count   = getLayerCount('L2');
  const l3Count   = getLayerCount('L3');
  const l4Count   = getLayerCount('L4');

  const synMult = (hasUpg('u_synergy') ? 2 : 1) * (hasParadigm('p_ai2') ? 2 : 1);
  const ec2SynBonus = 1 + getChallengeComp('ec2') * 0.25;

  let layerMult = 1;
  if (u.layerGroup === 'L1') {
    layerMult = (1 + l2Count * 0.05 * synMult)
              * (1 + l3Count * 0.08 * synMult * ec2SynBonus)
              * (hasUpg('u_wholesale') ? 3 : 1);
  } else if (u.layerGroup === 'L2') {
    layerMult = (1 + l3Count * 0.08 * synMult * ec2SynBonus)
              * (hasLabUpg('lu_pidTune') ? 1.5 : 1)
              * Math.pow(10, getChallengeComp('ec1'));
  } else if (u.layerGroup === 'L3') {
    layerMult = (1 + l4Count * 0.06 * synMult)
              * (hasUpg('u_synergy') && state.activeChallenge !== 'ec1' ? (1 + catCount * 0.02) : 1);
  } else if (u.layerGroup === 'L4') {
    layerMult = (state.sacrificeMult || 1);
  }

  const catExtra = (state.activeChallenge === 'ec1')
    ? 1
    : (hasLabUpg('lu_borrowCat') ? 2 : 1) * (hasLabUpg('lu_freezeDried') ? 2 : 1);

  let unitMult = 1;
  if (u.id === 'hamster') {
    if (hasLabUpg('lu_sunflowerOil')) unitMult *= 2;
    if (hasLabUpg('lu_warmWater'))    unitMult *= (1 + birdCount * 0.03);
  }
  if (u.id === 'butteredCat') unitMult *= catExtra;
  if (u.id === 'drinkingBird') {
    if (hasLabUpg('lu_warmWater'))    unitMult *= 2.2;
    if (hasLabUpg('lu_birdHumidity')) unitMult *= 2.5;
  }
  if (u.id === 'leydenJar') {
    if (hasLabUpg('lu_leydenCat'))    unitMult *= 2.5;
    if (hasLabUpg('lu_birdHumidity') && state.activeChallenge !== 'ec1') unitMult *= (1 + birdCount * 0.02);
  }
  if (u.id === 'teslaCoil'      && hasLabUpg('lu_teslaArc'))     unitMult *= 3;
  if (u.id === 'pidLoop') {
    if (hasLabUpg('lu_pidTune'))      unitMult *= 2.5;
    if (hasLabUpg('lu_pidMaxwell'))   unitMult *= 2;
  }
  if (u.id === 'maxwellDemon') {
    if (hasLabUpg('lu_demonNotes'))   unitMult *= 3;
    if (hasLabUpg('lu_pidMaxwell'))   unitMult *= (1 + pidCount * 0.03);
  }
  if (u.id === 'rlAgent') {
    if (hasParadigm('p_ai2'))         unitMult *= 10;
    if (hasLabUpg('lu_rlGpu'))        unitMult *= 3;
  }
  if (u.id === 'superconductor' && hasLabUpg('lu_liquidHelium')) unitMult *= 4;
  if (u.id === 'quantumCore') {
    if (hasUpg('u_break'))            unitMult *= 5;
    if (hasLabUpg('lu_vacuumShield')) unitMult *= 3;
  }

  let rawProd = c * u.baseEpS * getMilestoneMult(c) * layerMult * unitMult;
  if (state.activeChallenge === 'ec3' && (u.layerGroup === 'L1' || u.layerGroup === 'L2')) {
    rawProd = Math.pow(rawProd, 0.5);
  }

  return rawProd * getGlobalMult() * getBuffMultipliers().epsMult;
}

function getEpS() {
  let total = 0;
  for (const u of BALANCE.units) total += getUnitEpS(u);
  return total;
}

function getClickPower() {
  if (state.activeChallenge === 'ec3') return 0;
  const base = 1 + (state.units.hamster || 0) * (hasLabUpg('lu_sunflowerOil') ? 1.5 : 0.5);
  const ratio = hasUpg('u_coffee') ? 0.06 : 0.03;
  const teslaBonus = hasLabUpg('lu_teslaArc') ? (1 + (state.units.teslaCoil || 0) * 0.01) : 1;
  const cybBonus = hasParadigm('p_cyb2') ? 10 : 1;
  return (base * getReportMult() + getEpS() * ratio) * getBuffMultipliers().clickMult * teslaBonus * cybBonus;
}

function getPendingRP() {
  const req = state.tuning.thesisReq || 2.5e7;
  if (state.runEnergy < req) return 0;

  let baseRP = 1;
  if (hasUpg('u_break')) baseRP = Math.max(1, Math.pow(state.runEnergy / req, 0.36));
  if (hasParadigm('p_cat1')) baseRP *= (1 + (state.units.butteredCat || 0) * 0.05);

  const thickMult = Math.pow(2, getUpgLevel('u_thick'));
  let catFuryMult = 1;
  if (hasUpg('u_fury')) {
    const fromCats = 1 + Math.floor((state.units.butteredCat || 0) / 10) * 0.15;
    catFuryMult = (getChallengeComp('ec1') >= 5) ? Math.max(1.75, fromCats) : fromCats;
  }
  return Math.max(1, Math.floor(baseRP * thickMult * catFuryMult));
}

function getPendingPP() {
  const req = state.tuning.defenseReq || 10000;
  if (state.rp < req) return 0;
  let base = Math.max(1, Math.pow(state.rp / req, 0.25));
  if (hasParadigm('p_cat2')) {
    base *= (1 + Math.floor((state.units.butteredCat || 0) / 10) * 0.2);
  }
  return Math.max(1, Math.floor(base));
}

function pickAlvaQuote(type = 'report') {
  const cats = state.units.butteredCat || 0;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  if (type === 'thesis') {
    const t = COPY.alvaQuotes.thesis;
    if (cats >= 31) return pick(t.catResigned);
    if (cats >= 11) return pick(t.catCaught);
    if ((state.totalDrafts || 0) === 0) return pick(t.firstTime);
    return pick(t.normal);
  }

  const r = COPY.alvaQuotes.report;
  if ((state.reports || 0) === 0) return pick(r.firstTime);
  if (cats >= 1 && Math.random() < 0.45) return pick(r.withCat);
  return pick(r.normal);
}

function addLog(text) {
  const timeStr = new Date().toTimeString().slice(0, 8);
  state.logs.unshift({ time: timeStr, text });
  if (state.logs.length > 60) state.logs.length = 60;
  if (typeof renderLogs === 'function') renderLogs();
}

// --- 玩家基础操作 ---
function manualClick() {
  if (state.activeChallenge === 'ec3') return;
  let gain = getClickPower();
  let isCrit = false;
  const critChance = hasParadigm('p_cyb2') ? 0.30 : (hasUpg('u_coffee') ? 0.10 : 0);

  if (critChance > 0 && Math.random() < critChance) {
    gain *= 10;
    isCrit = true;
    showCritFlash(`⚡ 灵感暴击 ×10 (+${formatNum(gain)})!`);
    triggerCritGlow();
    unlockAchievement('ach_crit_master');
  }

  if (typeof SFX !== 'undefined') {
    if (SFX.muted) {
      state.mutedClicks = (state.mutedClicks || 0) + 1;
      if (state.mutedClicks >= 50) unlockAchievement('ach_quiet_cat');
    }
    if (isCrit) SFX.playCrit();
    else SFX.playClick();
  }

  state.totalClicks = (state.totalClicks || 0) + 1;
  recordUserInteraction();

  state.energy += gain;
  state.runEnergy += gain;
  state.totalEnergy += gain;

  spawnClickFloat(isCrit ? `⚡ +${formatNum(gain)}!` : `+${formatNum(gain)}`, isCrit);
  if (typeof triggerOrbPulse === 'function') triggerOrbPulse(isCrit);
  renderTop();
}

function buyUnit(unitId, modeOverride = null, silent = false) {
  const u = BALANCE.units.find(x => x.id === unitId);
  if (!u) return false;
  if (state.activeChallenge === 'ec1' && u.layerGroup === 'L1') return false;

  const info = getBulkBuyInfo(u, modeOverride || state.buyMode);
  if (info.count <= 0 || state.energy < info.cost) return false;

  const prev = state.units[u.id];
  const energyBefore = state.energy;
  state.energy -= info.cost;
  state.units[u.id] += info.count;
  if (u.id === 'hamster' && modeOverride === null && energyBefore >= 1e10) {
    unlockAchievement('ach_ad_pointless');
  }
  if (u.id === 'butteredCat' && (state.units.hamster || 0) === 0 && state.units.butteredCat >= 1) {
    unlockAchievement('ach_only_cat');
  }
  if (!state.seenUnits) state.seenUnits = {};
  state.seenUnits[u.id] = true;
  if (state.activeChallenge === 'ec2') state.entropyTime *= 0.5;

  if (prev === 0 && !silent) {
    const c = COPY.units[u.id];
    addLog(`解锁【${c.name}】—— ${c.luca}`);
  }
  return true;
}

function buyAllMax() {
  let boughtAny = false;
  if (isTickspeedVisible() && buyTickspeed(true)) {
    boughtAny = true;
  }
  for (let i = BALANCE.units.length - 1; i >= 0; i--) {
    if (buyUnit(BALANCE.units[i].id, 'max')) {
      boughtAny = true;
    }
  }
  if (boughtAny) {
    if (typeof SFX !== 'undefined') SFX.playClick();
    renderAll();
  }
}

function buyLabUpgrade(id) {
  const upg = BALANCE.labUpgrades.find(x => x.id === id);
  if (!upg || hasLabUpg(id) || state.energy < upg.cost) return;
  state.energy -= upg.cost;
  state.labUpgrades[id] = true;
  const c = COPY.labUpgrades[id];
  addLog(`购入常规升级【${c.name}】：${c.flavor}`);
  if (typeof SFX !== 'undefined') SFX.playClick();
  saveGame();
  renderAll();
}

// --- 启动能量保底（防止 EC1/EC3/EC4 开局或转生后软锁） ---
function getStartingEnergy() {
  let e = hasUpg('u_wire') ? 150 : 0;
  if (state.activeChallenge === 'ec1' || state.activeChallenge === 'ec4') {
    e = Math.max(e, 1e5);
  } else if (state.activeChallenge === 'ec3') {
    e = Math.max(e, 150);
  }
  return e;
}

// --- L1/L2 转生 ---
function submitReport(isAuto = false, silent = false) {
  const req = getReportReq();
  if (state.runEnergy < req) return;

  unlockAchievement('ach_first_reject');
  const prevCats = state.units.butteredCat || 0;
  if (prevCats >= 11) unlockAchievement('ach_cat_caught');

  const quote = pickAlvaQuote('report');
  const keptCats = hasUpg('u_cans') ? Math.min(50, Math.ceil(prevCats * 0.2)) : 0;

  state.reports += 1;
  state.tickspeed = 0;
  state.sacrificeMult = 1;
  state.energy = getStartingEnergy();
  state.runEnergy = 0;
  if (state.activeChallenge === 'ec2') state.entropyTime = 0;
  state.labUpgrades = {};
  for (const u of BALANCE.units) state.units[u.id] = 0;
  if (keptCats > 0 && state.activeChallenge !== 'ec1') state.units.butteredCat = keptCats;

  const rewardText = `实验报告被打回重写（第 ${state.reports} 次）！全产出倍率提升至 ×${getReportMult().toFixed(1)}。` +
    (keptCats > 0 && state.activeChallenge !== 'ec1' ? `（罐头基金保留了 ${keptCats} 台黄油猫）` : '');

  if (!silent) {
    addLog(`[实验报告退回] 阿尔瓦：“${quote}” -> ${rewardText}`);
    if (!isAuto) {
      if (typeof SFX !== 'undefined') SFX.playReject();
      if (!state.muteModal) showModal('实验报告 · 退回重写', quote, rewardText, prevCats >= 11);
    }
    saveGame();
    renderAll();
  }
}

function submitThesis(isAuto = false, silent = false) {
  const gainRP = getPendingRP();
  if (gainRP <= 0) return;

  unlockAchievement('ach_first_reject');
  const prevCats = state.units.butteredCat || 0;
  if (prevCats >= 11) unlockAchievement('ach_cat_caught');

  const quote = pickAlvaQuote('thesis');
  const keptCats = hasUpg('u_cans') ? Math.min(50, Math.ceil(prevCats * 0.2)) : 0;

  state.rp += gainRP;
  if (state.rp > (state.maxRpEver || 0)) state.maxRpEver = state.rp;
  state.totalDrafts += 1;
  state.reports = hasUpg('u_wire') ? 1 : 0;
  state.tickspeed = 0;
  state.sacrificeMult = 1;
  state.energy = getStartingEnergy();
  state.runEnergy = 0;
  if (state.activeChallenge === 'ec2') state.entropyTime = 0;
  state.labUpgrades = {};
  for (const u of BALANCE.units) state.units[u.id] = 0;
  if (keptCats > 0 && state.activeChallenge !== 'ec1') state.units.butteredCat = keptCats;

  const rewardText = `论文初稿惨遭退回！收获 +${formatNum(gainRP)} 点「红笔批注 (RP)」（当前共 ${formatNum(state.rp)} RP）。`;
  if (!silent) {
    addLog(`[论文初稿退回] 阿尔瓦：“${quote}” -> ${rewardText}`);
    if (!isAuto) {
      if (typeof SFX !== 'undefined') SFX.playReject();
      if (!state.muteModal) showModal('论文初稿 · 重大修改', quote, rewardText, prevCats >= 11);
    }
    saveGame();
    renderAll();
  }
}

function buyRpUpgrade(id) {
  const upg = BALANCE.rpUpgrades.find(x => x.id === id);
  if (!upg) return;
  const lvl = getUpgLevel(id);
  if (!upg.repeatable && lvl > 0) return;

  const cost = upg.repeatable ? upg.baseCost * Math.pow(upg.costMult || 4, lvl) : upg.cost;
  if (state.rp < cost) return;

  state.rp -= cost;
  state.upgrades[id] = upg.repeatable ? (lvl + 1) : true;
  const c = COPY.rpUpgrades[id];
  addLog(`购入红笔批注升级【${c.name}】：${c.flavor}`);
  if (typeof SFX !== 'undefined') SFX.playClick();
  saveGame();
  renderAll();
}

function unlockAutomator(id) {
  const a = BALANCE.automators.find(x => x.id === id);
  if (!a || state.autos[id].unlocked || state.rp < a.cost) return;
  state.rp -= a.cost;
  state.autos[id] = { unlocked: true, enabled: true, speedLvl: 0, acc: 0 };
  const c = COPY.automators[id];
  addLog(`解锁自动化外包【${c.name}】：${c.flavor}`);
  if (typeof SFX !== 'undefined') SFX.playClick();
  saveGame();
  renderAll();
}

function upgradeAutoSpeed(id) {
  const st = state.autos[id];
  if (!st || !st.unlocked || st.speedLvl >= BALANCE.autoSpeedCosts.length) return;
  const cost = BALANCE.autoSpeedCosts[st.speedLvl];
  if (state.rp < cost) return;
  state.rp -= cost;
  st.speedLvl += 1;
  addLog(`自动化模块提速！新间隔：${BALANCE.autoIntervals[st.speedLvl]} 秒`);
  if (typeof SFX !== 'undefined') SFX.playClick();
  saveGame();
  renderAll();
}

function toggleAutomator(id) {
  if (!state.autos[id] || !state.autos[id].unlocked) return;
  state.autos[id].enabled = !state.autos[id].enabled;
  saveGame();
  renderAuto();
}

function toggleAutoReportStopAtThesis() {
  state.autoReportStopAtThesis = !state.autoReportStopAtThesis;
  saveGame();
  renderAuto();
}

// --- L3：正式答辩 / 专利点数 (PP) & 范式树 (TT) ---
function getTotalTT() {
  return (state.ttBought.e || 0) + (state.ttBought.rp || 0) + (state.ttBought.pp || 0);
}

function getSpentTT() {
  let spent = 0;
  for (const p of BALANCE.paradigms) {
    if (hasParadigm(p.id)) spent += p.costTT;
  }
  return spent;
}

function getAvailableTT() { return getTotalTT() - getSpentTT(); }

function getTTCost(type) {
  const n = state.ttBought[type] || 0;
  if (type === 'e')  return 1e8 * Math.pow(1e4, n);
  if (type === 'rp') return 5000 * Math.pow(10, n);
  if (type === 'pp') return Math.pow(2, n);
  return Infinity;
}

function buyTT(type) {
  const cost = getTTCost(type);
  if (type === 'e'  && state.energy < cost) return;
  if (type === 'rp' && state.rp < cost) return;
  if (type === 'pp' && state.pp < cost) return;

  if (type === 'e')  state.energy -= cost;
  if (type === 'rp') state.rp -= cost;
  if (type === 'pp') state.pp -= cost;

  state.ttBought[type] = (state.ttBought[type] || 0) + 1;
  addLog(`获得 1 点【理论学分 (TT)】（当前可用 ${getAvailableTT()} TT）。`);
  if (typeof SFX !== 'undefined') SFX.playClick();
  saveGame();
  renderAll();
}

function getMaxParadigmBranches() {
  if (hasMilestone(15)) return 3;
  if (hasMilestone(8)) return 2;
  return 1;
}

function getActiveParadigmBranches() {
  const set = new Set();
  for (const p of BALANCE.paradigms) {
    if (hasParadigm(p.id) && p.branch) set.add(p.branch);
  }
  return set;
}

function canPickParadigmBranch(branch) {
  if (!branch) return true;
  const active = getActiveParadigmBranches();
  return active.has(branch) || active.size < getMaxParadigmBranches();
}

function buyParadigm(id) {
  const p = BALANCE.paradigms.find(x => x.id === id);
  if (!p || hasParadigm(id)) return;
  if (p.req && !hasParadigm(p.req)) return;
  if (!canPickParadigmBranch(p.branch)) return;
  if (getAvailableTT() < p.costTT) return;

  state.paradigms[id] = true;
  addLog(`点亮范式节点【${COPY.paradigms[id].name}】：${COPY.paradigms[id].flavor}`);
  if (typeof SFX !== 'undefined') SFX.playClick();
  saveGame();
  renderAll();
}

function respecParadigms() {
  state.paradigms = {};
  addLog('已免费洗点！所有理论学分 (TT) 已返还。');
  saveGame();
  renderAll();
}

function saveParadigmPreset(slotIdx) {
  if (!Array.isArray(state.paradigmPresets) || !state.paradigmPresets[slotIdx]) return false;
  const activeNodes = BALANCE.paradigms
    .filter(p => hasParadigm(p.id))
    .map(p => p.id);
  state.paradigmPresets[slotIdx].nodes = activeNodes;
  const label = state.paradigmPresets[slotIdx].name;
  addLog(`💾 已将当前范式方案（${activeNodes.length} 个节点）保存至【${label}】。`);
  if (typeof SFX !== 'undefined') SFX.playClick();
  saveGame();
  renderDefense();
  if (typeof showToast === 'function') {
    showToast(`已保存当前方案到「${label}」（${activeNodes.length} 个节点）`);
  }
  return true;
}

function loadParadigmPreset(slotIdx) {
  if (!Array.isArray(state.paradigmPresets) || !state.paradigmPresets[slotIdx]) return false;
  const preset = state.paradigmPresets[slotIdx];
  const savedNodes = Array.isArray(preset.nodes) ? preset.nodes : [];
  if (savedNodes.length === 0) {
    if (typeof showToast === 'function') showToast('该预设槽位为空，请先点亮范式后点击「保存当前」。');
    return false;
  }

  state.paradigms = {};
  const targetSet = new Set(savedNodes);
  let loaded = 0;
  let skipped = 0;

  for (const p of BALANCE.paradigms) {
    if (!targetSet.has(p.id)) continue;
    const reqOk = !p.req || hasParadigm(p.req);
    const branchOk = canPickParadigmBranch(p.branch);
    const ttOk = getAvailableTT() >= p.costTT;
    if (reqOk && branchOk && ttOk) {
      state.paradigms[p.id] = true;
      loaded += 1;
    } else {
      skipped += 1;
    }
  }

  const skipHint = skipped > 0 ? `（${skipped} 个节点因 TT 或分支上限未点亮）` : '';
  addLog(`📂 已载入范式预设【${preset.name}】：成功点亮 ${loaded} 个节点${skipHint}。`);
  if (typeof SFX !== 'undefined') SFX.playClick();
  saveGame();
  renderAll();
  if (typeof showToast === 'function') {
    showToast(`已切换至「${preset.name}」（点亮 ${loaded} 节点${skipHint}）`);
  }
  return loaded > 0;
}

function renameParadigmPreset(slotIdx, newName) {
  if (!Array.isArray(state.paradigmPresets) || !state.paradigmPresets[slotIdx]) return false;
  const trimmed = String(newName || '').trim().slice(0, 18);
  if (!trimmed) return false;
  state.paradigmPresets[slotIdx].name = trimmed;
  saveGame();
  renderDefense();
  return true;
}

function submitDefense() {
  const gainPP = getPendingPP();
  if (gainPP <= 0) return;

  const quote = COPY.alvaDefenseQuotes[Math.min(state.defenses, COPY.alvaDefenseQuotes.length - 1)];
  const prevCats = state.units.butteredCat || 0;
  const prevLabUpgs = { ...state.labUpgrades };

  state.pp += gainPP;
  state.defenses += 1;
  state.activeChallenge = null;

  state.energy = 0;
  state.runEnergy = 0;
  state.runTime = 0;
  state.entropyTime = 0;
  state.reports = 0;
  state.tickspeed = 0;
  state.sacrificeMult = 1;
  state.rp = 0;
  state.totalDrafts = 0;
  for (const u of BALANCE.units) state.units[u.id] = 0;
  state.labUpgrades = {};

  const nextUpgrades = {};
  if (hasMilestone(2)) {
    nextUpgrades.u_break = true;
    nextUpgrades.u_fury = true;
  }
  state.upgrades = nextUpgrades;

  if (!hasMilestone(1)) {
    for (const a of BALANCE.automators) {
      state.autos[a.id] = { unlocked: false, enabled: false, speedLvl: 0, acc: 0 };
    }
  }
  if (hasMilestone(15)) {
    state.units.butteredCat = prevCats;
    const catLabUpgIds = ['lu_borrowCat', 'lu_freezeDried'];
    for (const id of catLabUpgIds) {
      if (prevLabUpgs[id]) state.labUpgrades[id] = true;
    }
  }

  const rewardText = `第 ${state.defenses} 次正式答辩通过！获得 +${formatNum(gainPP)} 点「专利点数 (PP)」（当前共 ${formatNum(state.pp)} PP）。`;
  addLog(`🎓 [专利答辩通过] ${rewardText}`);
  if (COPY.darkRoomLog && (state.defenses === 1 || Math.random() < 0.35)) {
    addLog(COPY.darkRoomLog);
  }
  if (typeof SFX !== 'undefined') SFX.playVictory();
  if (!state.muteModal) showModal('专利局 · 答辩通过', quote, rewardText, false);
  saveGame();
  renderAll();
}

function toggleAutoThesis() {
  if (!hasMilestone(4)) return;
  state.autoThesisEnabled = !state.autoThesisEnabled;
  saveGame();
  renderDefense();
}

function setAutoThesisMinRP(val) {
  const num = Number(val);
  state.autoThesisMinRP = (!isFinite(num) || num < 1) ? 1 : Math.floor(num);
  saveGame();
}

// --- 评审团质询挑战（EC） ---
function resetLayerForChallenge() {
  state.energy = 0;
  state.runEnergy = 0;
  state.runTime = 0;
  state.entropyTime = 0;
  state.reports = 0;
  state.tickspeed = 0;
  state.sacrificeMult = 1;
  state.rp = 0;
  state.totalDrafts = 0;
  for (const u of BALANCE.units) state.units[u.id] = 0;
  state.labUpgrades = {};

  const nextUpgrades = {};
  if (hasMilestone(2)) {
    nextUpgrades.u_break = true;
    nextUpgrades.u_fury = true;
  }
  state.upgrades = nextUpgrades;
}

function enterChallenge(id) {
  if (!isChallengesSectionUnlocked()) return;
  const ch = BALANCE.challenges.find(x => x.id === id);
  if (!ch || getChallengeComp(id) >= ch.maxComp) return;
  if (state.activeChallenge === id) return;

  resetLayerForChallenge();
  state.activeChallenge = id;
  if (id === 'ec3') {
    pendingEvent = null;
    activeBuffs = [];
  }
  const startE = getStartingEnergy();
  if (startE > 0) {
    state.energy = startE;
    state.runEnergy = 0;
  }
  const grantHint = startE > 0 ? `（学院特批启动经费 ${formatNum(startE)} E）` : '';
  addLog(`⚖️ [进入质询挑战] ${COPY.challenges[id].name}${grantHint} —— ${COPY.challenges[id].quote}`);
  saveGame();
  renderAll();
}

function exitChallenge() {
  if (!state.activeChallenge) return;
  const oldName = COPY.challenges[state.activeChallenge].name;
  state.activeChallenge = null;
  resetLayerForChallenge();
  addLog(`🏳️ 已退出质询挑战【${oldName}】，恢复常规实验。`);
  saveGame();
  renderAll();
}

function completeChallenge() {
  const id = state.activeChallenge;
  if (!id) return;
  const goal = getChallengeGoal(id);
  if (state.rp < goal) return;

  state.challengeCompletions[id] = getChallengeComp(id) + 1;
  const comp = state.challengeCompletions[id];
  const c = COPY.challenges[id];
  state.activeChallenge = null;
  resetLayerForChallenge();

  const msg = `通过质询挑战【${c.name}】第 ${comp}/5 次！永久奖励已叠加生效。`;
  addLog(`🏆 [质询通过] ${msg}`);
  if (typeof SFX !== 'undefined') SFX.playVictory();
  if (!state.muteModal) showModal('评审团 · 质询通过', c.quote, msg, false);
  saveGame();
  renderAll();
}

// --- 成就系统 ---
function unlockAchievement(id) {
  if (hasAchievement(id)) return;
  const c = COPY.achievements[id];
  if (!c) return;

  state.achievements[id] = true;
  addLog(`🏅 [解锁成就] ${c.name} —— ${c.flavor}`);
  if (typeof showAchievementToast === 'function') showAchievementToast(id);
  if (typeof SFX !== 'undefined') SFX.playCrit();
  saveGame();
  if (state.activeTab === 'ach') renderAchievements();
}

function checkAchievements() {
  if ((state.units.hamster || 0) >= 1) unlockAchievement('ach_first_hamster');
  if ((state.tickspeed || 0) >= 10) unlockAchievement('ach_tickspeed_10');
  if ((state.units.rlAgent || 0) >= 1) unlockAchievement('ach_ai_off');
  if ((state.units.quantumCore || 0) >= 1) unlockAchievement('ach_quantum');
  if (getChallengeComp('ec1') >= 1) unlockAchievement('ach_em_dignity');
  if (BALANCE.challenges.every(ch => getChallengeComp(ch.id) >= 1)) unlockAchievement('ach_ec_all');
  if ((state.defenses || 0) >= 15) unlockAchievement('ach_cat_advisor');
  if ((state.totalDrafts || 0) >= 5) unlockAchievement('ach_ad_5hours');
  if ((state.units.superconductor || 0) >= 9) unlockAchievement('ach_ad_9th');
  if (!state.antimatter && (state.totalEnergy || 0) >= 9e13) {
    state.antimatter = 1;
    addLog('⚛️ 你获得了 1 个反物质。');
    if (typeof showTopNotice === 'function') showTopNotice('你获得了 1 个反物质');
    unlockAchievement('ach_useless_am');
  }
  if ((state.totalEnergy || 0) >= 1e15) unlockAchievement('ach_ad_infinity');

  // 真实物理量级里程碑日志
  if (Array.isArray(BALANCE.physicsMilestones)) {
    for (const pm of BALANCE.physicsMilestones) {
      if ((state.totalEnergy || 0) >= pm.energy && !state.physicsMilestones[pm.id]) {
        state.physicsMilestones[pm.id] = true;
        const msg = COPY.physicsMilestones && COPY.physicsMilestones[pm.id];
        if (msg) {
          addLog(msg);
          if (typeof showTopNotice === 'function') showTopNotice(msg, 4600);
        }
      }
    }
  }

  // 芝诺的乌龟：攒到报告门槛 10 倍却不交
  if ((state.runEnergy || 0) >= getReportReq() * 10) {
    unlockAchievement('ach_zeno_turtle');
  }

  // 奥卡姆剃刀：极简苦行僧模式
  const stg = state.settings || {};
  if (stg.compactMode && stg.hideBoughtLab && stg.showTicker === false && stg.floatText === false) {
    unlockAchievement('ach_occam_razor');
  }

  // 绝对零度：解锁至少 1 个自动化、全部关闭且静置 60 秒
  const idleMs = Date.now() - lastInteractionTime;
  const unlockedAutos = BALANCE.automators.filter(a => state.autos[a.id] && state.autos[a.id].unlocked);
  if (unlockedAutos.length > 0 && unlockedAutos.every(a => !state.autos[a.id].enabled) && idleMs >= 60 * 1000) {
    unlockAchievement('ach_absolute_zero');
  }

  // 等等，所以你还是睡着了吗（Meta：凌晨 2:00~5:00 在线但 30 分钟无操作）
  const hr = new Date().getHours();
  if (hr >= 2 && hr < 5 && idleMs >= 30 * 60 * 1000) {
    unlockAchievement('ach_fell_asleep');
  }
}

function throwEnergyOnFloor() {
  if (state.energy < 10) {
    if (typeof showToast === 'function') showToast('你连 10 点能量都凑不出来，地板表示很遗憾。');
    return;
  }
  state.energy -= 10;
  state.thrownEnergyCount = (state.thrownEnergyCount || 0) + 1;
  if (typeof SFX !== 'undefined') SFX.playClick();

  if (state.thrownEnergyCount === 10) {
    addLog('🔥 你把 10 点能量扔在了地上（累计 100 点）。地板微微暖和了一点。');
    unlockAchievement('ach_throw_energy');
  } else {
    addLog(`💨 你把 10 点能量扔在了地上。它迅速消散成了毫无用处的热熵。（累计扔掉 ${state.thrownEnergyCount * 10} E）`);
  }
  saveGame();
  renderAll();
}

// --- 随机事件 ---
function spawnRandomEvent() {
  const pool = BALANCE.randomEvents;
  const ev = pool[Math.floor(Math.random() * pool.length)];
  pendingEvent = { data: ev, expireIn: 14 };
  renderEventBanner();
  if (typeof SFX !== 'undefined') SFX.playEventSpawn();
}

function claimRandomEvent() {
  if (!pendingEvent) return;
  const ev = pendingEvent.data;
  const c = COPY.randomEvents[ev.id];
  if (ev.id === 'ev_goldenCookie') unlockAchievement('ach_cc_cookie');
  pendingEvent = null;

  if (ev.instantSec) {
    const bonus = Math.max(50, getEpS() * ev.instantSec);
    state.energy += bonus;
    state.runEnergy += bonus;
    state.totalEnergy += bonus;
  }

  const dur = ev.duration * (hasParadigm('p_cyb1') ? 2 : 1);
  const existing = activeBuffs.find(b => b.id === ev.id);
  if (existing) {
    existing.remaining = dur;
  } else {
    activeBuffs.push({
      id: ev.id,
      name: c.buffName,
      epsMult: ev.epsMult || 1,
      clickMult: ev.clickMult || 1,
      remaining: dur
    });
  }

  addLog(`✨ [突发事件] ${c.log}`);
  if (typeof SFX !== 'undefined') SFX.playCrit();
  nextEventTimer = 120 + Math.random() * 90;
  renderEventBanner();
  renderAll();
}

// --- 离线收益结算 ---
function formatDuration(sec) {
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  if (h > 0) return `${h} 小时 ${m} 分 ${s} 秒`;
  if (m > 0) return `${m} 分 ${s} 秒`;
  return `${s} 秒`;
}

function processOfflineProgress() {
  const now = Date.now();
  const elapsedSec = Math.max(0, (now - (state.lastTick || now)) / 1000);
  state.lastTick = now;

  if (elapsedSec < 5) return null;

  const maxOfflineSec = 86400;
  const effectiveSec = Math.min(elapsedSec, maxOfflineSec);
  const steps = Math.min(120, Math.max(20, Math.ceil(effectiveSec / 60)));
  const stepSec = effectiveSec / steps;
  const timeScale = state.tuning.timeScale || 1;

  let gainedEnergy = 0;
  let gainedRP = 0;
  let autoReportsTriggered = 0;
  let autoThesesTriggered = 0;
  let autoUnitsBought = 0;
  let autoTickspeedBought = 0;

  for (let s = 0; s < steps; s++) {
    state.runTime += stepSec;

    // 1. 能量产出
    const stepEnergy = getEpS() * stepSec * timeScale;
    if (stepEnergy > 0) {
      state.energy += stepEnergy;
      state.runEnergy += stepEnergy;
      state.totalEnergy += stepEnergy;
      gainedEnergy += stepEnergy;
    }

    // 2. 里程碑 8：被动 RP
    if (hasMilestone(8)) {
      const passiveRate = 0.1 + getChallengeComp('ec3') * 0.05;
      const passiveRP = getPendingRP() * passiveRate * stepSec;
      if (passiveRP > 0) {
        state.rp += passiveRP;
        if (state.rp > (state.maxRpEver || 0)) state.maxRpEver = state.rp;
        gainedRP += passiveRP;
      }
    }

    // 3. 里程碑 4：自动提交论文初稿
    if (hasMilestone(4) && state.autoThesisEnabled) {
      const pendingRP = getPendingRP();
      const minRP = Math.max(1, state.autoThesisMinRP || 1);
      if (pendingRP >= minRP) {
        gainedRP += pendingRP;
        autoThesesTriggered += 1;
        submitThesis(true, true);
      }
    }

    // 4. 自动化外包（按真实间隔步进触发）
    for (const a of BALANCE.automators) {
      const st = state.autos[a.id];
      if (!st || !st.unlocked || !st.enabled) continue;
      st.acc = (st.acc || 0) + stepSec;
      const interval = BALANCE.autoIntervals[st.speedLvl || 0];
      if (st.acc >= interval) {
        st.acc = st.acc % interval;
        if (a.isReport) {
          const canSelfRestart = getStartingEnergy() >= 15 || (hasUpg('u_cans') && (state.units.butteredCat || 0) > 0);
          const stopAtThesis = state.autoReportStopAtThesis && getPendingRP() > 0;
          if (canSelfRestart && !stopAtThesis && state.runEnergy >= getReportReq()) {
            autoReportsTriggered += 1;
            submitReport(true, true);
          }
        } else if (a.isTickspeed) {
          const waitForEm = (state.activeChallenge === 'ec1' || state.activeChallenge === 'ec4') && getEpS() <= 0;
          if (!waitForEm) {
            const beforeTs = state.tickspeed || 0;
            if (buyTickspeed(true)) {
              autoTickspeedBought += (state.tickspeed || 0) - beforeTs;
            }
          }
        } else if (a.layerGroup) {
          const skipNonEm = state.activeChallenge === 'ec4' && a.layerGroup === 'L1' && getEpS() <= 0;
          if (!skipNonEm) {
            for (let i = BALANCE.units.length - 1; i >= 0; i--) {
              const u = BALANCE.units[i];
              if (u.layerGroup === a.layerGroup) {
                const beforeCnt = state.units[u.id] || 0;
                if (buyUnit(u.id, 'max', true)) {
                  autoUnitsBought += (state.units[u.id] || 0) - beforeCnt;
                }
              }
            }
          }
        }
      }
    }
  }

  checkAchievements();

  const didAnything = gainedEnergy > 0 || gainedRP > 0 || autoReportsTriggered > 0
    || autoThesesTriggered > 0 || autoUnitsBought > 0 || autoTickspeedBought > 0;
  if (!didAnything) return null;

  saveGame();
  if (elapsedSec < 60) return null;

  const extraParts = [];
  if (gainedRP > 0) extraParts.push(`RP +${formatNum(gainedRP)}`);
  if (autoUnitsBought > 0) extraParts.push(`自动购置 ${autoUnitsBought} 台组件`);
  if (autoTickspeedBought > 0) extraParts.push(`自动超频 +${autoTickspeedBought} 级`);
  if (autoReportsTriggered > 0) extraParts.push(`自动交报告 ${autoReportsTriggered} 次`);
  if (autoThesesTriggered > 0) extraParts.push(`自动交论文 ${autoThesesTriggered} 次`);
  const extraStr = extraParts.length ? `（${extraParts.join(' · ')}）` : '';

  addLog(`💤 [离线结算] 离开实验室 ${formatDuration(elapsedSec)}，期间产出 ${formatNum(gainedEnergy)} 能量${extraStr}。`);

  return {
    elapsedSec,
    effectiveSec,
    capped: elapsedSec > maxOfflineSec,
    steps,
    gainedEnergy,
    gainedRP,
    autoReportsTriggered,
    autoThesesTriggered,
    autoUnitsBought,
    autoTickspeedBought
  };
}

// --- 主循环 ---
function tick() {
  const now = Date.now();
  const rawDt = Math.min(3600, Math.max(0, (now - state.lastTick) / 1000));
  state.lastTick = now;

  // 随机事件计时
  if (pendingEvent) {
    pendingEvent.expireIn -= rawDt;
    if (pendingEvent.expireIn <= 0) {
      pendingEvent = null;
      nextEventTimer = 120 + Math.random() * 90;
    }
    renderEventBanner();
  } else if (state.activeChallenge !== 'ec3') {
    nextEventTimer -= rawDt * (hasParadigm('p_cyb1') ? 2 : 1);
    if (nextEventTimer <= 0) spawnRandomEvent();
  }

  for (let i = activeBuffs.length - 1; i >= 0; i--) {
    activeBuffs[i].remaining -= rawDt;
    if (activeBuffs[i].remaining <= 0) activeBuffs.splice(i, 1);
  }

  state.runTime += rawDt;
  if (state.activeChallenge === 'ec2') state.entropyTime += Math.min(rawDt, 2);

  // 能量产出
  const dt = rawDt * (state.tuning.timeScale || 1);
  const gained = getEpS() * dt;
  if (gained > 0) {
    state.energy += gained;
    state.runEnergy += gained;
    state.totalEnergy += gained;
  }

  // 里程碑 8：被动获得 RP
  if (hasMilestone(8)) {
    const passiveRate = 0.1 + getChallengeComp('ec3') * 0.05;
    const passiveRP = getPendingRP() * passiveRate * rawDt;
    if (passiveRP > 0) { state.rp += passiveRP; if (state.rp > (state.maxRpEver || 0)) state.maxRpEver = state.rp; }
  }

  // 里程碑 4：自动提交论文初稿
  if (hasMilestone(4) && state.autoThesisEnabled && getPendingRP() >= Math.max(1, state.autoThesisMinRP || 1)) {
    submitThesis(true);
  }

  // 自动化外包（按 layerGroup）
  for (const a of BALANCE.automators) {
    const st = state.autos[a.id];
    if (!st || !st.unlocked || !st.enabled) continue;
    st.acc = (st.acc || 0) + rawDt;
    const interval = BALANCE.autoIntervals[st.speedLvl || 0];
    if (st.acc >= interval) {
      st.acc = 0;
      if (a.isReport) {
        const stopAtThesis = state.autoReportStopAtThesis && getPendingRP() > 0;
        if (!stopAtThesis && state.runEnergy >= getReportReq()) submitReport(true);
      } else if (a.isTickspeed) {
        const waitForEm = (state.activeChallenge === 'ec1' || state.activeChallenge === 'ec4') && getEpS() <= 0;
        if (!waitForEm) buyTickspeed(true);
      } else if (a.layerGroup) {
        const skipNonEm = state.activeChallenge === 'ec4' && a.layerGroup === 'L1' && getEpS() <= 0;
        if (!skipNonEm) {
          for (let i = BALANCE.units.length - 1; i >= 0; i--) {
            const u = BALANCE.units[i];
            if (u.layerGroup === a.layerGroup) {
              buyUnit(u.id, 'max');
            }
          }
        }
      }
    }
  }



  checkAchievements();

  renderTop();
  if (state.activeTab === 'lab') {
    if (typeof renderTickspeedAndSacrifice === 'function') renderTickspeedAndSacrifice();
    renderLabUpgrades();
    renderUnits();
  } else if (state.activeTab === 'shop' && typeof syncShopStates === 'function') {
    syncShopStates();
  } else if (state.activeTab === 'auto' && typeof syncAutoStates === 'function') {
    syncAutoStates();
  } else if (state.activeTab === 'defense' && typeof syncDefenseStates === 'function') {
    syncDefenseStates();
  } else if (state.activeTab === 'stats' && typeof renderStats === 'function') {
    renderStats();
  }
}

// --- 存档与 Base64 导出/导入 ---
function saveGame() {
  if (isHardResetting) return;
  try {
    localStorage.setItem(BALANCE.saveKey, JSON.stringify(state));
    lastSaveTime = new Date().toTimeString().slice(0, 8);
    if (typeof updateSaveTimeUI === 'function') updateSaveTimeUI();
  } catch (e) {}
}

function getShareCommentTier() {
  if ((state.defenses || 0) >= 1) return 'late';
  if ((state.totalDrafts || 0) >= 1 || (state.rp || 0) > 0 || (state.maxRpEver || 0) > 0) return 'mid';
  return 'early';
}

function pickShareComment(prevComment = '') {
  const tier = getShareCommentTier();
  const c = COPY.shareReportComments || {};
  let pool = [];
  if (tier === 'late') {
    pool = [...(c.late || [])];
  } else if (tier === 'mid') {
    pool = [...(c.mid || [])];
  } else {
    pool = [...(c.early || [])];
    if ((state.units.butteredCat || 0) >= 1) {
      pool.push(...(c.withCat || []));
    }
  }
  if (pool.length <= 1) return pool[0] || '';
  const filtered = pool.filter(x => x !== prevComment);
  const src = filtered.length ? filtered : pool;
  return src[Math.floor(Math.random() * src.length)];
}

function getShareReportData(commentText = '') {
  const achCount = getAchievementCount();
  const visibleTotal = BALANCE.achievements.filter(a => !a.hidden || hasAchievement(a.id)).length;
  const cats = state.units.butteredCat || 0;
  const assistant = (state.settings && state.settings.assistantName && state.settings.assistantName.trim())
    ? state.settings.assistantName.trim()
    : '匿名实验助手';

  const stage = (getLayerCount('L4') > 0) ? '阶段 IV · AI与前沿物理'
    : (getLayerCount('L3') > 0) ? '阶段 III · 自控与信息热力学'
    : (getLayerCount('L2') > 0) ? '阶段 II · 经典电磁学'
    : '阶段 I · 民科与力学悖论';

  let highestUnit = '尚未购置装置';
  for (let i = BALANCE.units.length - 1; i >= 0; i--) {
    const u = BALANCE.units[i];
    if ((state.units[u.id] || 0) > 0) {
      highestUnit = `${COPY.units[u.id].name} ×${state.units[u.id]}`;
      break;
    }
  }

  const reports = state.reports || 0;
  const drafts = state.totalDrafts || 0;
  const totalRejects = reports + drafts;
  const defenses = state.defenses || 0;
  const ecDetail = BALANCE.challenges.map((ch, idx) => `EC${idx + 1}:${getChallengeComp(ch.id)}`).join(' · ');
  const challengesDone = BALANCE.challenges.reduce((sum, ch) => sum + getChallengeComp(ch.id), 0);
  const challengesMax = BALANCE.challenges.reduce((sum, ch) => sum + ch.maxComp, 0);

  let stampLine1 = '待审草案';
  let stampLine2 = '继续观察';
  if (defenses >= 4) {
    stampLine1 = '准予通过';
    stampLine2 = '特批立项';
  } else if (defenses >= 1) {
    stampLine1 = '有条件通过';
    stampLine2 = '严禁借猫';
  } else if (drafts >= 1) {
    stampLine1 = '退回大修';
    stampLine2 = '重算误差';
  } else if (reports >= 1) {
    stampLine1 = '打回重写';
    stampLine2 = '不合格';
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  const commentTier = getShareCommentTier();
  const tierMeta = commentTier === 'late' ? {
    commentTitleVintage: '✒️ 学术联合评议意见：',
    commentTitleCanvasVintage: '✒ 学术联合评议意见：',
    commentTitleCyber: '⚡ 专利评审终端决议：',
    commentSign: '—— 专利评审委员会（附议：阿尔瓦·洛伦兹）',
    commentTextLabel: '学术联合评议'
  } : commentTier === 'mid' ? {
    commentTitleVintage: '✒️ 指导教授审阅批注：',
    commentTitleCanvasVintage: '✒ 指导教授审阅批注：',
    commentTitleCyber: '⚡ 导师终端审阅意见：',
    commentSign: '—— 阿尔瓦·洛伦兹',
    commentTextLabel: '洛伦兹教授审阅批注'
  } : {
    commentTitleVintage: '✒️ 指导教授红笔批语：',
    commentTitleCanvasVintage: '✒ 指导教授红笔批语：',
    commentTitleCyber: '⚡ 导师终端红笔批注：',
    commentSign: '—— 阿尔瓦·洛伦兹',
    commentTextLabel: '洛伦兹教授批语'
  };

  return {
    version: BALANCE.version,
    commentTier,
    ...tierMeta,
    dateStr,
    stage,
    assistant,
    highestUnit,
    stampLine1,
    stampLine2,
    totalEnergy: formatNum(state.totalEnergy),
    eps: formatNum(getEpS()),
    reports,
    drafts,
    totalRejects,
    defenses,
    rp: formatNum(state.rp || 0),
    maxRp: formatNum(state.maxRpEver || 0),
    pp: formatNum(state.pp || 0),
    totalTT: getTotalTT(),
    challengesDone,
    challengesMax,
    ecDetail,
    totalUnits: getTotalUnitsCount(),
    tickspeed: state.tickspeed || 0,
    sacrificeMult: formatNum(state.sacrificeMult || 1),
    cats,
    achStr: `${achCount} / ${visibleTotal}`,
    comment: commentText || pickShareComment()
  };
}

function getShareText(commentOverride = '') {
  const d = getShareReportData(commentOverride);
  const url = (window.location && window.location.protocol.startsWith('http')) ? `\n试玩地址：${window.location.href}` : '';
  return `【卢卡的“永动”实验手记 · 实验评估报告 (${d.version})】\n` +
    `🧪 实验负责人：卢卡·巴尔萨 ｜ 实验助手：${d.assistant}\n` +
    `📌 当前阶段：${d.stage}（印章：${d.stampLine1}·${d.stampLine2}）\n` +
    `⚡ 累计产出：${d.totalEnergy} E（当前 ${d.eps} E/秒 ｜ 最高装置：${d.highestUnit}）\n` +
    `📕 累计被打回：${d.totalRejects} 次（本轮报告 ${d.reports} 次 · 论文初稿 ${d.drafts} 次）\n` +
    `🎓 正式答辩：${d.defenses} 次（专利 ${d.pp} PP · 批注 ${d.rp} RP · 历史最高 ${d.maxRp} RP · 学分 ${d.totalTT} TT）\n` +
    `⚖️ 质询挑战：已通关 ${d.challengesDone}/${d.challengesMax} 次（${d.ecDetail}）\n` +
    `⚙️ 实验台规模：${d.totalUnits} 台装置 · 超频 Lv.${d.tickspeed} · L4献祭 ×${d.sacrificeMult}\n` +
    `🐈‍⬛ 在岗黄油猫：${d.cats} 只 · 成就进度：${d.achStr}\n` +
    `✒️ ${d.commentTextLabel}：“${d.comment}”\n${d.commentSign}${url}`;
}

function getDiagnosticReport() {
  const b64 = exportSaveString();
  return [
    `=== 卢卡的“永动”实验手记 反馈诊断信息 ===`,
    `版本：${BALANCE.version}`,
    `时间：${new Date().toLocaleString()}`,
    `进度：总能量 ${formatNum(state.totalEnergy)} | RP ${formatNum(state.rp)} | PP ${formatNum(state.pp)} | 答辩 ${state.defenses} 次 | 挑战 ${state.activeChallenge || '无'}`,
    `设备：${navigator.userAgent}`,
    `--- Base64 存档 ---`,
    b64
  ].join('\n');
}

function mergeSaveData(parsed) {
  const base = createDefaultState();
  return {
    ...base,
    ...parsed,
    settings: { ...base.settings, ...(parsed.settings || {}) },
    tuning: { ...BALANCE.defaultTuning },
    ttBought: { ...base.ttBought, ...(parsed.ttBought || {}) },
    challengeCompletions: { ...base.challengeCompletions, ...(parsed.challengeCompletions || {}) }
  };
}

function loadGame() {
  try {
    const raw = localStorage.getItem(BALANCE.saveKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state = mergeSaveData(parsed);
      }
    }
  } catch (e) {}
  initMissingFields();
  if (state.logs.length === 0) addLog(COPY.initialLog);
}

function hardReset() {
  isHardResetting = true;
  if (window._tickIntervalId) clearInterval(window._tickIntervalId);
  if (window._saveIntervalId) clearInterval(window._saveIntervalId);
  window.removeEventListener('beforeunload', saveGame);
  try {
    localStorage.removeItem(BALANCE.saveKey);
  } catch (e) {}
  state = createDefaultState();
  location.reload();
}

function encodeBase64UTF8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function decodeBase64UTF8(b64) {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function exportSaveString() {
  saveGame();
  const b64 = encodeBase64UTF8(JSON.stringify(state));
  lastExportedSaveStr = b64;
  return b64;
}

function importSaveString(rawStr) {
  if (!rawStr || !rawStr.trim()) {
    return { ok: false, msg: '未输入任何存档内容。' };
  }
  try {
    const jsonStr = decodeBase64UTF8(rawStr);
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== 'object' || typeof parsed.energy !== 'number') {
      return { ok: false, msg: '存档数据结构不完整，无法识别。' };
    }

    const isSchrodinger = !!(lastExportedSaveStr && rawStr.trim() === lastExportedSaveStr);
    state = {
      ...mergeSaveData(parsed),
      lastTick: Date.now()
    };
    initMissingFields();
    if (isSchrodinger) {
      unlockAchievement('ach_schrodinger_save');
    }
    saveGame();
    addLog('📂 存档导入成功！欢迎回到实验室。');
    return { ok: true, msg: '导入成功！' };
  } catch (e) {
    return { ok: false, msg: 'Base64 解码或解析失败，请检查字符串是否完整。' };
  }
}

window.addEventListener('beforeunload', saveGame);

// --- 标签页小红点检测 ---
function hasAffordableShop() {
  for (const upg of BALANCE.rpUpgrades) {
    const lvl = getUpgLevel(upg.id);
    if (!upg.repeatable && lvl > 0) continue;
    const cost = upg.repeatable ? upg.baseCost * Math.pow(upg.costMult || 4, lvl) : upg.cost;
    if (state.rp >= cost) return true;
  }
  return false;
}

function hasAffordableAuto() {
  for (const a of BALANCE.automators) {
    const st = state.autos[a.id];
    if (!st || !st.unlocked) {
      if (state.rp >= a.cost) return true;
    } else {
      const nextCost = BALANCE.autoSpeedCosts[st.speedLvl || 0];
      if (nextCost !== undefined && state.rp >= nextCost) return true;
    }
  }
  return false;
}

function hasAffordableDefense() {
  if (state.activeChallenge && state.rp >= getChallengeGoal(state.activeChallenge)) return true;
  if (state.energy >= getTTCost('e') || state.rp >= getTTCost('rp') || state.pp >= getTTCost('pp')) return true;
  const availTT = getAvailableTT();
  if (availTT > 0) {
    for (const p of BALANCE.paradigms) {
      if (hasParadigm(p.id)) continue;
      if (p.req && !hasParadigm(p.req)) continue;
      if (!canPickParadigmBranch(p.branch)) continue;
      if (availTT >= p.costTT) return true;
    }
  }
  return false;
}
