/* ============================================================
   game.js — 核心循环、存档、计算、自动化与界面交互
   ============================================================ */

/* ---------- 状态 ---------- */
const S = {
  ip:0, run:0, all:0,           // 当前能量 / 本轮累计 / 历史累计
  stab:100,
  lv:{},                        // 设备等级
  frag:0,                       // 可用记忆碎片
  tree:{},                      // L2 记忆碎片树等级
  scene:0,                      // 本周目场景 0-5（重启归 0）
  items:[],                     // 已解锁收藏
  secs:0,                       // 累计在线秒数（只算页面开着的时间）
  taps:0,                       // 手动操作次数
  nights:0,                     // 结束过的夜
  battles:0,                    // 事件里做过的选择
  buffs:[],                     // {m, until}
  cd:{ab1:0, ab2:0, ab3:0},
  evtAt: 0, evtOpen:false,
  log:[], evLog:[], born:Date.now(), last:Date.now(),

  /* ---- 周目制 ---- */
  cycle:1,                      // 当前周目，从 1 开始
  cycleAt:Date.now(),           // 本周目开始时间戳（算碎片时长）
  capRun:1e6,                   // 本周目能量上限
  fx:false,                     // 本周目是否已装「永动轮总装」（每轮可再买）
  route:'',                     // '' | 'bad' | 'good'
  seenBad:false,                // 是否看过坏结局（看过之后才出现「结束这一夜」）
  endingDone:false,             // 结局过场已播完 —— 刷新后直接给收尾界面，不再重播
  breakthrough:0,               // 好结局突破次数（加法叠加）
  cat:null,                     // 小猫支线 {ip,lv,total,last,on}
  lastCycleMin:0,               // 上一局实际时长（分钟）
  hiddenCatReady:false,         // 第一周目守满 8 小时，隐藏入口解锁
  challenge:false,              // 挑战模式进行中
  challengeReady:false,         // 普通通关过，解锁「重新挑战」
  restorePending:false,         // 挑战结束后要把快照盖回来
  snapshot:null,                // 挑战快照摘要 {frag, cat}
  ach:[],                       // 隐藏成就
  m8pick:'',                    // 兼容旧存档
  m8a:0, m8b:0,                 // M8 累计选择次数：关灯 / 抱猫（可多次叠加）
  hiddenCat:false,              // 走过隐藏入口（硬核路线）
  boost:0,                      // 本周目产出加成（事件给，重启清零，封顶 +25%）
  seenEv:[],                    // 本周目已看过的事件 id（重启清空）
  milestones:[],                // 已触发的里程碑 id（跨周目保留）
  introSeen:false,              // 是否看过初次开场剧情
  abUsed:[],                    // 记录新手期体验过的小猫技能
};

/* ---------- 工具 ---------- */
const $ = id => document.getElementById(id);

const UNITS = [[1e20,'垓'],[1e16,'京'],[1e12,'兆'],[1e8,'亿'],[1e4,'万']];
function fmt(n){
  if(!isFinite(n)) return '∞';
  if(n < 1000){
    if(n < 10) return (Math.round(n*10)/10).toString().replace(/\.0$/,'');
    return Math.round(n).toString();
  }
  for(const [v,s] of UNITS){
    if(n >= v){
      let x = n/v;
      let t = x >= 100 ? Math.round(x).toString() : x.toFixed(2);
      return t + s;
    }
  }
  return Math.round(n).toString();
}
function now(){ return Date.now(); }

let logFilter = 'all';
function log(text, cls, type){
  S.log.unshift({t:now(), text, cls:cls||'', type:type||''});
  if(S.log.length > 300) S.log.pop();
  renderLog();
}
let toastTimer=null;
function toast(text){
  const el=$('toast');
  el.textContent=text; el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('on'), 1800);
}

/* ---------- 计算 ---------- */
function lv(id){ return S.lv[id] || 0; }

function herRate(){
  let r = 0.5;
  for(const u of HER) r += u.val * lv(u.id);
  return r;
}
function alvaRate(){
  let r = 1.0;
  for(const u of ALV) r += u.val * lv(u.id);
  return r;
}
function catMult(){
  let m = 1;
  for(const u of CAT) m *= Math.pow(u.val, lv(u.id));
  return m;
}
function heat(){
  // 发热 = 基数 + 赫尔曼^0.5。
  // 次线性是关键：如果发热随赫尔曼线性涨，散热会被指数成本甩得越来越远，
  // 玩家就只剩「一直买赫尔曼」一条路，阿尔瓦整条线作废。
  return HEAT_BASE + Math.pow(Math.max(0, herRate()), HEAT_EXP);
}

function buffMult(){
  let m = 1;
  const t = now();
  for(const b of S.buffs) if(b.until > t) m *= b.m;
  return m;
}
/* 稳定性 → 产出系数。稳定性只影响产出，不影响碎片。 */
function stabFactor(){
  const s = Math.max(0, Math.min(100, S.stab)) / 100;
  return STAB_FLOOR + (1 - STAB_FLOOR) * Math.pow(s, STAB_POW);
}


/* ---------- L2 记忆碎片升级树 ---------- */
function tlv(id){ return (S.tree && S.tree[id]) || 0; }
function treePrice(u){ return Math.ceil(u.cost * Math.pow(u.g, tlv(u.id))); }
function isMainTreeMaxed(){
  if(typeof FRAG_TREE === 'undefined') return true;
  return FRAG_TREE.filter(u => !u.requireMainMax && u.max > 0)
    .every(u => tlv(u.id) >= u.max);
}
function isTreeUnlocked(u){
  if(!u.requireMainMax) return true;
  return isMainTreeMaxed();
}
function treeBellSigma(){ return BELL_SIGMA + 0.18 * tlv('t_bell'); }
function treeBellFloor(){ return Math.min(0.85, BELL_FLOOR + 0.06 * tlv('t_bell')); }
function treeRateMult(){ return Math.pow(1.40, tlv('t_rate')); }
function treeCapMult(){ return Math.pow(2.15, tlv('t_cap')); }
function treeAlvaPowBonus(){ return 0.01 * tlv('t_cap'); }
function treeCatBoost(){ return 1 + 0.08 * tlv('t_cat'); }

function applyBootUpgrades(){
  const b = tlv('t_boot');
  if(b <= 0) return;
  S.lv['h1'] = Math.max(S.lv['h1'] || 0, 2 * b);
  S.lv['a1'] = Math.max(S.lv['a1'] || 0, 1 * b);
  const startIp = Math.round(120 * Math.pow(3.5, b - 1));
  if(S.ip < startIp){
    const add = startIp - S.ip;
    S.ip += add;
    S.run += add;
    S.all += add;
  }
}

function buyTree(id){
  if(typeof FRAG_TREE === 'undefined') return;
  const u = FRAG_TREE.find(x => x.id === id);
  if(!u || !isTreeUnlocked(u)) return;
  if(u.max > 0 && tlv(id) >= u.max) return;
  const c = treePrice(u);
  if(S.frag < c) return;
  S.frag -= c;
  if(!S.tree || typeof S.tree !== 'object') S.tree = {};
  S.tree[id] = tlv(id) + 1;
  S.taps += 1;
  // 若点的是「旧日底稿」，立刻补齐本轮最低起步配置
  if(id === 't_boot') applyBootUpgrades();
  syncCap();
  renderRebirth();
  renderShop();
  if($('catView').classList.contains('on')) updateCat();
  toast('已点亮 · ' + u.name + ' Lv.' + S.tree[id]);
  save();
}

function rate(){
  if(S.ip >= S.capRun) return 0;               // 储存装满，先花掉才能继续产出
  return herRate() * stabFactor() * catMult() * treeRateMult() * (1 + S.boost) *
         (1 + 0.03 * clv('c13')) * buffMult();
}

let buyMode = '1'; // '1' | '10' | 'max'
function priceOf(u){ return Math.ceil(u.cost * Math.pow(u.g, lv(u.id))); }
function bulkInfo(u){
  const cur = lv(u.id);
  const rem = u.max ? Math.max(0, u.max - cur) : Infinity;
  if(rem <= 0) return {n:0, cost:0, maxed:true};
  const limit = buyMode === '1' ? 1 : buyMode === '10' ? Math.min(10, rem) : Math.min(200, rem);
  let n = 0, total = 0;
  for(let i = 0; i < limit; i++){
    const p = Math.ceil(u.cost * Math.pow(u.g, cur + i));
    if(buyMode === 'max'){
      if(total + p > S.ip) break;
      total += p; n++;
    } else {
      total += p; n++;
    }
  }
  if(buyMode === 'max' && n === 0){
    return {n:1, cost:Math.ceil(u.cost * Math.pow(u.g, cur)), maxed:false, afford:false};
  }
  return {n, cost:total, maxed:false, afford: S.ip >= total && n > 0};
}

/* ---------- 小猫支线 ---------- */
function clv(id){ return (S.cat && S.cat.lv[id]) || 0; }
function catRate(){
  if(!S.cat) return 0;
  let r = 0.1;
  for(const u of CATSUB) if(!u.util) r += u.val * clv(u.id);
  // 隐藏线：玩家放弃了转生、放弃了碎片、放弃了全部主线机制，
  // 只靠一只猫硬顶。这只猫在这条线里就该更活跃。
  if(S.hiddenCat || S.challenge) r *= HIDDEN_FISH_BOOST;
  if(S.m8b > 0) r *= (1 + 0.05 * S.m8b); // 每次抱猫 +5% 鱼干产出
  r *= treeCatBoost();                    // L2 碎片树「猫爪余粮」加成
  return r;
}
function catPrice(u){ return Math.ceil(u.cost * Math.pow(u.g, clv(u.id))); }
// 猫对主线的加成全部来自手动升级：c13 产出、c11 储存

let autoT = 0, mainAutoT = 0;
function autoDrive(dt){
  if(!S.cat) return;

  // c14: 猫爪按开关（自动触发主线三技能）
  if(clv('c14') >= 1 && !S.evtOpen && !S.fx && !atCap()){
    if(S.stab < 60 && S.cd.ab2 <= 0) doAbility('ab2', true);
    else if(S.cd.ab3 <= 0) doAbility('ab3', true);
    else if(S.cd.ab1 <= 0 && S.stab > 35) doAbility('ab1', true);
  }

  // c15: Lv.1 小猫监督官（纯粹贪心买，不管散热）；Lv.2 猫工智能（启用散热比安全阀）
  const mainAutoLv = clv('c15');
  if(mainAutoLv >= 1 && !S.evtOpen && !S.fx && !atCap()){
    mainAutoT += dt;
    if(mainAutoT >= 1.5){
      mainAutoT = 0;
      let bestM = null, bestC = Infinity;
      if(mainAutoLv === 1){
        // 贪心模式：有什么买什么，完全不管散热与稳定性
        for(const u of [...HER, ...ALV, ...CAT]){
          if(u.max && lv(u.id) >= u.max) continue;
          const c = priceOf(u);
          if(c > S.ip) continue;
          if(c < bestC){ bestC = c; bestM = u; }
        }
      } else {
        // 猫工智能：带散热比安全阀，低于 2.2 优先补散热，高于 3.2 不乱买散热
        const cr = coolRatio();
        const pool = cr < 2.2 ? ALV : [...ALV, ...HER, ...CAT];
        for(const u of pool){
          if(u.max && lv(u.id) >= u.max) continue;
          const c = priceOf(u);
          if(c > S.ip) continue;
          if(cr > 3.2 && ALV.includes(u)) continue;
          if(c < bestC){ bestC = c; bestM = u; }
        }
      }
      if(bestM) buy(bestM.id, true, true);
    }
  }

  // c12: 小猫自己的自动值守
  const autoLv = clv('c12');
  if(autoLv <= 0) return;
  autoT += dt;
  const gap = autoLv >= 3 ? 1.0 : autoLv >= 2 ? 1.6 : 2.2;
  if(autoT < gap) return;
  autoT = 0;
  if(S.evtOpen) return;

  const allow = u => {
    if(u.id === 'c12' || u.id === 'c14' || u.id === 'c15') return false;
    if(u.id === 'c9' || u.id === 'c10') return false;
    if(u.id === 'c11') return autoLv >= 2;
    if(u.id === 'c13') return autoLv >= 3;
    return true;
  };
  let best = null, bc = Infinity;
  for(const u of CATSUB){
    if(!allow(u)) continue;
    if(u.max && clv(u.id) >= u.max) continue;
    const c = catPrice(u);
    if(c > S.cat.ip) continue;
    if(c < bc){ bc = c; best = u; }
  }
  if(best) buyCat(best.id, true);
}

function buyCat(id, auto){
  if(!S.cat) return;
  const u = CATSUB.find(x => x.id === id);
  if(!u) return;
  if(u.max && clv(id) >= u.max) return;
  const c = catPrice(u);
  if(S.cat.ip < c) return;
  S.cat.ip -= c;
  S.cat.lv[id] = clv(id) + 1;
  if(!auto) S.taps += 1;
  renderCat(); updateCat(); drawCatWorld(); save();
}

/* ---------- 周目 / 上限 / 碎片 ---------- */
/* 碎片钟形：散热比的对数正态，带地板 */
function bellCurve(cool){
  if(!(cool > 0)) return 0;
  const d = (Math.log(cool) - Math.log(BELL_MU)) / treeBellSigma();
  return Math.exp(-0.5 * d * d);
}
/* 钟形 + 地板，0~1 */
function fragShape(cool){
  const flr = treeBellFloor();
  return flr + (1 - flr) * bellCurve(cool);
}

// 储存上限：散热 / L2 碎片树 / 突破 / 小猫囤货 / M8 共同决定
function stashMultPerLv(){
  return (S.hiddenCat || S.challenge) ? HIDDEN_STASH_MULT : CAT_STASH_MULT;
}
function storageMax(){
  const tm = treeCapMult();                               // L2 碎片树「深井蓄能」
  const km = Math.pow(stashMultPerLv(), clv('c11'));      // 小猫囤货
  const btN = S.breakthrough || 0;
  const bt = Math.pow(BT_MULT, btN);
  // 散热转化指数：基础 + L2 树加成 + 突破加成
  const alvaPow = CAP_ALVA_POW + treeAlvaPowBonus() + Math.min(0.18, btN * 0.03);
  // M8「最后一次关灯」的永久加成（可多次叠加）：关灯 +3%/次，抱猫 +1.5%/次
  const mm = 1 + 0.03 * (S.m8a || 0) + 0.015 * (S.m8b || 0);
  return CAP_BASE * Math.pow(Math.max(1e-9, alvaRate()), alvaPow)
       * tm * bt * km * mm;
}
function syncCap(){ S.capRun = storageMax(); }
function atCap(){ return S.run >= S.capRun; }
// 装上永动轮之后这一夜就已经算完了。M8 的储存加成会让 capRun 再涨一截，
// 那时候 S.run 追不上新上限，但玩家不该因此卡在「结束这一夜」上。
function reachedCap(){ return S.run >= S.capRun || S.fx; }
function coolRatio(){ const h = heat(); return h > 0 ? alvaRate() / h : 0; }
function cycleMinutes(){ return Math.max(0, (now() - S.cycleAt) / 60000); }
function sceneForRun(r){
  // 按本轮累计能量的固定阶梯（SCENE_AT）切换场景，避免前期一周目就把全部场景一口气走完
  let s = 0;
  for(let i = 1; i < SCENE_AT.length; i++){
    if(r >= SCENE_AT[i]) s = i;
  }
  return Math.min(SCENES.length - 1, s);
}

/* 本局当前能拿到的碎片（不含时长项 —— 结夜时机完全交给玩家） */
function fragNow(){
  const depth = 1 + FRAG_CYCLE * Math.max(0, S.cycle - 1);
  return Math.floor(FRAG_BASE * fragShape(coolRatio()) * depth);
}
/* 是否已到钟形峰值附近，「结束这一夜」该闪光了 */
function atPeak(){ return reachedCap() && fragShape(coolRatio()) >= PEAK_FLASH; }

function fragGain(){
  if(!reachedCap()) return 0;
  return fragNow();
}

/* ---------- 操作 ---------- */
function gain(n){ S.ip += n; S.run += n; S.all += n; }

function spend(frac){
  // 只扣当前能量。run 是本轮成绩、all 是历史累计（收藏里程碑），都不该被事件回退。
  const n = Math.max(0, Math.min(S.ip, S.ip * frac));
  S.ip -= n;
  return n;
}

function addStab(d){
  S.stab = Math.max(0, Math.min(100, S.stab + d));
}

function buff(m, sec){
  S.buffs.push({m, until: now() + sec*1000});
}

// 本轮加成：事件专用，重启清零，单局封顶 +25%
function boost(n){ S.boost = Math.min(0.25, Math.max(0, S.boost + n)); }

// 用「N 秒产出」当作代价
function paySeconds(sec){
  const n = Math.min(S.ip, rate() * sec);
  S.ip -= n;
  return n;
}

function buy(id, singleOnly, isAuto){
  if(S.fx) return false;
  const u = [...HER, ...ALV, ...CAT].find(x => x.id === id);
  if(!u) return false;
  if(u.max && lv(id) >= u.max) return false;
  let n = 1, c = priceOf(u);
  if(!singleOnly){
    const bi = bulkInfo(u);
    if(bi.maxed || !bi.afford) return false;
    n = bi.n; c = bi.cost;
  } else {
    if(S.ip < c) return false;
  }
  S.ip -= c;
  S.lv[id] = lv(id) + n;
  if(!isAuto) S.taps += 1;
  renderShop();
  renderSceneCaption();
  save();
  return true;
}

/* ---------- 存档 ---------- */
const SNAP_KEY = SAVE_KEY + '_snap';

// 挑战开始前把整份存档存到快照，结束时原样盖回来
function saveSnapshot(){
  try{ localStorage.setItem(SNAP_KEY, JSON.stringify(S)); }catch(e){}
}
function restoreSnapshot(){
  try{
    const raw = localStorage.getItem(SNAP_KEY);
    if(!raw) return false;
    const d = JSON.parse(raw);
    const ach = (S.ach || []).slice();
    for(const k in S) delete S[k];
    Object.assign(S, d);
    // 成就不能被快照抹掉：两份取并集
    const merged = new Set(ach.concat(d.ach || []));
    S.ach = Array.from(merged);
    S.challenge = false;
    S.restorePending = false;
    localStorage.removeItem(SNAP_KEY);
    return true;
  }catch(e){ return false; }
}

let wiping = false;
function save(){
  if(wiping) return;                 // 正在清档，别在 beforeunload 里又写回去
  S.last = now();
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){}
}
function hardReset(){
  wiping = true;
  try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
  try{ sessionStorage.removeItem(SAVE_KEY); }catch(e){}
  try{ localStorage.removeItem(SNAP_KEY); }catch(e){}
  setTimeout(() => location.reload(), 0);
}
function load(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const d = JSON.parse(raw);
    if(!d || typeof d !== 'object') return false;
    for(const k of ['ip','run','all','stab','frag','scene','born','last','cycle','cycleAt','breakthrough','secs','taps','nights','battles'])
      if(typeof d[k] === 'number' && isFinite(d[k])) S[k] = d[k];
    for(const k of ['fx','seenBad','endingDone'])
      if(typeof d[k] === 'boolean') S[k] = d[k];
    if(typeof d.route === 'string') S.route = d.route;
    if(typeof d.boost === 'number' && isFinite(d.boost)) S.boost = Math.max(0, Math.min(0.25, d.boost));
    if(typeof d.lastCycleMin === 'number' && isFinite(d.lastCycleMin)) S.lastCycleMin = Math.max(0, d.lastCycleMin);
    if(d.hiddenCatReady === true) S.hiddenCatReady = true;
    if(d.challenge === true) S.challenge = true;
    if(d.challengeReady === true) S.challengeReady = true;
    if(d.restorePending === true) S.restorePending = true;
    if(d.snapshot && typeof d.snapshot === 'object') S.snapshot = d.snapshot;
    if(Array.isArray(d.ach)) S.ach = d.ach.filter(x => typeof x === 'string');
    if(d.m8pick === 'a' || d.m8pick === 'b') S.m8pick = d.m8pick;
    if(typeof d.m8a === 'number' && isFinite(d.m8a)) S.m8a = Math.max(0, Math.round(d.m8a));
    if(typeof d.m8b === 'number' && isFinite(d.m8b)) S.m8b = Math.max(0, Math.round(d.m8b));
    // 兼容旧存档：若之前选过单次 M8，自动折算为 1 次
    if(S.m8a === 0 && S.m8b === 0){
      if(S.m8pick === 'a') S.m8a = 1;
      else if(S.m8pick === 'b') S.m8b = 1;
    }
    if(d.hiddenCat === true) S.hiddenCat = true;
    if(Array.isArray(d.seenEv)) S.seenEv = d.seenEv;
    if(Array.isArray(d.milestones)) S.milestones = d.milestones;
    S.introSeen = (typeof d.introSeen === 'boolean') ? d.introSeen : true;
    S.abUsed = Array.isArray(d.abUsed) ? d.abUsed.filter(x => typeof x === 'string') : [];
    if(d.cat && typeof d.cat === 'object') S.cat = d.cat;
    if(typeof d.cycle !== 'number'){          // 旧存档迁移：当作第 1 周目，计时从现在起
      S.cycle = 1;
      S.cycleAt = now();
      S.capRun  = CAP_BASE;
    }
    if(d.lv && typeof d.lv === 'object') S.lv = d.lv;
    if(d.tree && typeof d.tree === 'object') S.tree = d.tree;
    if(Array.isArray(d.items)) S.items = d.items;
    if(Array.isArray(d.ach)) S.ach = d.ach;
    if(Array.isArray(d.log)) S.log = d.log.slice(0,300);
    if(Array.isArray(d.evLog)) S.evLog = d.evLog.slice(0,300);
    if(Array.isArray(d.buffs)) S.buffs = d.buffs.filter(b=>b && b.until > now());
    S.stab = Math.max(0, Math.min(100, S.stab));
    S.cycle = Math.max(1, Math.round(S.cycle));
    S.breakthrough = Math.max(0, Math.round(S.breakthrough));
    syncCap();
    // 场景由本周目进度决定（run 在周目内单调递增，所以这一句是幂等的）
    S.scene = sceneForRun(S.run);

    // 小猫支线：只做字段兜底，离线鱼干统一交由 offlineCat() 结算并记日志
    if(S.cat){
      if(!S.cat.lv || typeof S.cat.lv !== 'object') S.cat.lv = {};
      if(typeof S.cat.ip !== 'number') S.cat.ip = 0;
      if(typeof S.cat.total !== 'number') S.cat.total = 0;
      if(typeof S.cat.last !== 'number' || !isFinite(S.cat.last)) S.cat.last = now();
    }
    return true;
  }catch(e){ return false; }
}

/* ---------- 离线收益 ---------- */
/* 主线离线：上限与效率都靠小猫支线升 */
function offlineCapH(){ return 8 + 4 * clv('c9'); }
function offlineEff(){ return Math.min(0.80, 0.50 + 0.05 * clv('c10')); }

function offline(){
  if(!S.last) return;
  const dt = Math.min(offlineCapH() * 3600, (now() - S.last)/1000);
  if(dt < 60) return;
  const r = rate();
  if(r <= 0) return;
  const eff = offlineEff();
  const got = r * dt * eff;
  gain(got);
  addStab(-dt * 0.002); // 无人值守，稳定性略降
  log('离开了 ' + Math.round(dt/60) + ' 分钟，屋子自己跑了 ' + fmt(got) +
      ' 能量（' + Math.round(eff*100) + '% 效率）。', 'hot');
}

/* 小猫离线：猫不会因为屋子空了就停下。
 * 主线一局只有 3–20 分钟，如果鱼干只在局内产，猫永远长不起来 ——
 * 所以离场这段时间也照常结算，上限是 CAT_OFFLINE_MIN 分钟。 */
function offlineCat(){
  if(!S.cat || !S.cat.last) return;
  const dt = Math.min(12 * 3600, (now() - S.cat.last) / 1000);
  S.cat.last = now();
  if(dt < 60) return;
  const g = catRate() * dt * 0.5;
  if(g <= 0) return;
  S.cat.ip += g;
  S.cat.total += g;
  log('猫在你不在的时候逛了一圈，叼回来 ' + Math.round(g) + ' 条鱼干。', 'hot');
}

/* ============================================================
   UI 渲染
   ============================================================ */
let shopRefs = [];
let shopGroup = 'her';
function renderShop(){
  const box = $('shopList');
  box.replaceChildren();
  shopRefs = [];

  function addSection(title){
    const d = document.createElement('div');
    d.className = 'sec'; d.textContent = title;
    box.appendChild(d);
  }
  function addRow(u, kind){
    const row = document.createElement('div');
    row.className = 'row';
    const info = document.createElement('div');
    info.className = 'info';
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = u.name;
    const em = document.createElement('em');
    em.textContent = '';
    nm.appendChild(em);
    const ds = document.createElement('div');
    ds.className = 'ds';
    ds.textContent = u.desc;
    info.append(nm, ds);
    const btn = document.createElement('button');
    btn.className = 'buy';
    btn.innerHTML = '<span>0</span><small>Lv.0</small>';
    btn.onclick = () => buy(u.id);
    row.append(info, btn);
    box.appendChild(row);
    shopRefs.push({u, row, btn, nm, em, ds, kind});
  }

  const g = shopGroup;
  if(g === 'all' || g === 'her'){
    addSection('赫尔曼 · 机构与演算');
    for(const u of HER) addRow(u,'her');
  }
  if(g === 'all' || g === 'alv'){
    addSection('阿尔瓦 · 传热与稳定');
    for(const u of ALV) addRow(u,'alv');
  }
  if(g === 'all' || g === 'cat'){
    if(g === 'cat' && S.cat){
      const er = document.createElement('button');
      er.className = 'catenter';
      er.innerHTML = '进入小猫的小鱼工厂<small>鱼干 ' + fmt(S.cat.ip) +
        ' · 每秒 ' + fmt(catRate()) + '</small>';
      er.onclick = openCatView;
      box.appendChild(er);
    }
    addSection('小猫 · 全局加成');
    for(const u of CAT) addRow(u,'cat');
  }

  updateShop();
}

function updateShop(){
  updateFinal();
  for(const r of shopRefs){
    const u = r.u, L = lv(u.id);
    const bi = bulkInfo(u);
    const maxed = bi.maxed;
    r.btn.querySelector('span').textContent = maxed ? '已满级' : fmt(bi.cost);
    const tag = (!maxed && bi.n > 1) ? (' +' + bi.n) : '';
    r.btn.querySelector('small').textContent = 'Lv.' + L + (u.max ? '/' + u.max : '') + tag;
    r.btn.disabled = maxed || !bi.afford;
    r.row.classList.toggle('max', !!maxed);
    // 描述只在等级变化时重写，别每 0.1 秒刷一遍 innerHTML
    if(r.lastLv !== L){
      r.lastLv = L;
      if(r.kind === 'her'){
        r.ds.innerHTML = u.desc + ' <span class="up" style="white-space:nowrap">+' + fmt(u.val*1) + ' 产出</span> <span class="dn" style="white-space:nowrap">+发热</span>';
      } else if(r.kind === 'alv'){
        r.ds.innerHTML = u.desc + ' <span class="up" style="white-space:nowrap">+' + fmt(u.val) + ' 散热</span>';
      } else {
        r.ds.innerHTML = u.desc + ' <span class="up" style="white-space:nowrap">×' + u.val + '</span>';
      }
    }
  }
}


function renderSceneCaption(){
  const s = SCENES[S.scene];
  $('sceneName').textContent = s.name;
  $('sceneDesc').textContent = s.desc;
  // 进度条 = 本周目上限的完成度（场景改由本周目进度驱动，不再按设备价格）
  const fill = $('tierFill');
  fill.style.width = (S.capRun > 0 ? Math.min(100, S.run / S.capRun * 100) : 0) + '%';
}

function renderLog(){
  const box = $('logBox');
  if(!box) return;
  box.replaceChildren();

  if(logFilter === 'event'){
    const list = S.evLog || [];
    if(!list.length){
      const p = document.createElement('p');
      p.textContent = '还没有记录下任何事件剧情。';
      box.appendChild(p);
      return;
    }
    for(const e of list){
      const card = document.createElement('div');
      card.className = 'evcard';
      const d = new Date(e.t);
      const tstr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
      const eh = document.createElement('div');
      eh.className = 'eh';
      eh.innerHTML = '<span>【' + (e.title || '事件') + '】</span><small>第 ' + (e.cycle || 1) + ' 周目 · ' + tstr + '</small>';
      const eo = document.createElement('div');
      eo.className = 'eo';
      eo.textContent = '选择：' + (e.choice || '—');
      const et = document.createElement('div');
      et.className = 'et';
      et.textContent = e.text || '';
      card.append(eh, eo, et);
      box.appendChild(card);
    }
    return;
  }

  for(const e of S.log.slice(0,120)){
    const p = document.createElement('p');
    const tm = document.createElement('time');
    const d = new Date(e.t);
    tm.textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    p.appendChild(tm);
    const sp = document.createElement('span');
    if(e.cls) sp.className = e.cls;
    sp.textContent = e.text;
    p.appendChild(sp);
    box.appendChild(p);
  }
}

const SHELF_GROUP = [
  {t:'时间',   k:'time'},
  {t:'手上',   k:'taps'},
  {t:'夜里',   k:'nights'},
  {t:'主线',   k:'all'},
  {t:'赫尔曼', k:'her'},
  {t:'阿尔瓦', k:'alv'},
  {t:'小猫',   k:'cat'},
  {t:'后日谈', k:'bt'}
];

function renderShelf(){
  const box = $('shelfList');
  box.replaceChildren();

  // 成就：拿到了才出现在最上面
  for(const a of ACH){
    if(S.ach.indexOf(a.id) < 0) continue;
    const d = document.createElement('div');
    d.className = 'item open';
    const ico = document.createElement('div');
    ico.className = 'ico'; ico.textContent = a.icon;
    const tx = document.createElement('div');
    tx.className = 'tx';
    const tn = document.createElement('div');
    tn.className = 'tn'; tn.textContent = a.name;
    const td = document.createElement('div');
    td.className = 'td'; td.textContent = a.desc;
    tx.append(tn, td); d.append(ico, tx); box.appendChild(d);
  }

  const got = ITEMS.filter(it => S.items.indexOf(it.id) >= 0).length;

  for(const g of SHELF_GROUP){
    const list = ITEMS.filter(it => it.kind === g.k);
    if(!list.length) continue;
    const n = list.filter(it => S.items.indexOf(it.id) >= 0).length;

    const head = document.createElement('div');
    head.className = 'sec';
    head.style.marginTop = '14px';
    head.textContent = g.t + ' · ' + n + '/' + list.length;
    box.appendChild(head);

    for(const it of list){
      const open = S.items.indexOf(it.id) >= 0;
      const d = document.createElement('div');
      d.className = 'item' + (open ? ' open' : '');
      const ico = document.createElement('div');
      ico.className = 'ico';
      ico.textContent = open ? it.icon : '·';
      const tx = document.createElement('div');
      tx.className = 'tx';
      const tn = document.createElement('div');
      tn.className = 'tn';
      tn.textContent = open ? it.name : '？？？';
      const td = document.createElement('div');
      td.className = 'td';
      td.textContent = open ? (it.lore ? '点开翻翻旧档' : '点开看看批注') : shelfLabel(it);
      tx.append(tn, td);
      if(!open){
        const bar = document.createElement('div');
        bar.className = 'bar';
        const fill = document.createElement('i');
        const pct = Math.min(100, shelfValue(it.kind) / it.need * 100);
        fill.style.width = pct.toFixed(1) + '%';
        bar.appendChild(fill);
        tx.appendChild(bar);
      }
      if(open){
        const note = document.createElement('div');
        note.className = 'note';
        if(it.lore){
          note.innerHTML = '<p class="lore">' + it.lore + '</p>' +
            (it.note ? '<p class="arch">' + it.note + '</p>' : '');
        } else {
          note.innerHTML = '<p><b>阿尔瓦：</b>' + it.a + '</p><p><b>赫尔曼：</b>' + it.h + '</p>';
        }
        tx.appendChild(note);
        d.onclick = () => d.classList.toggle('show');
      }
      d.append(ico, tx);
      box.appendChild(d);
    }
  }

  const foot = document.createElement('div');
  foot.className = 'sec';
  foot.style.marginTop = '14px';
  foot.style.textAlign = 'center';
  foot.textContent = '共 ' + got + ' / ' + ITEMS.length;
  box.appendChild(foot);
}

function renderRebirth(){
  const g = fragGain();
  const capped = reachedCap();
  $('fragTotal').textContent = S.frag;

  const pct = S.capRun > 0 ? Math.min(100, S.run / S.capRun * 100) : 0;
  let info = '第 ' + S.cycle + ' 周目 · 上限 ' + fmt(S.capRun) + '（已到 ' + pct.toFixed(1) + '%）';
  if(capped){
    const cr = coolRatio();
    const crTag = fragShape(cr) >= PEAK_FLASH ? '刚好·满额' : (cr < BELL_MU ? '偏热' : '过冷');
    info += '<br>当前散热比 ×' + cr.toFixed(2) + '（' + crTag + '）' +
            ' → <b style="color:#c9a0d0">' + g + '</b> 片记忆碎片';
  } else {
    info += '<br>这一夜还没到头。';
  }
  if(S.challenge){
    info += '<br><span style="color:#c9a0d0">挑战进行中 · 不要碰永动轮</span>';
  }else if(S.challengeReady && S.snapshot){
    let n = 0;
    if(S.snapshot.cat && S.snapshot.cat.lv) for(const k in S.snapshot.cat.lv) n += S.snapshot.cat.lv[k];
    info += '<br>挑战快照：碎片 ' + S.snapshot.frag + ' · 小猫 ' + n + ' 级（在设置里重新挑战）';
  }
    if(S.seenBad || S.hiddenCat || S.challenge){
    const capNow = storageMax();
    const capOk = capNow >= GOOD_STORAGE;
    if(S.breakthrough >= 1 && !S.challenge){
      info += '<div class="goal-box"><div class="gt">永动轮已转起来</div>' +
              '已累计突破 <b>' + S.breakthrough + '</b> 次 · 继续提升储存上限与突破次数，可解锁更多后日谈收藏。</div>';
    } else if(S.challenge || S.hiddenCat){
      info += '<div class="goal-box"><div class="gt">突破僵局的目标（好结局）</div>' +
              '<span class="' + (capOk ? 'ok' : 'todo') + '">' + (capOk ? '✓ ' : '· ') +
              '储存上限达到 ' + fmt(GOOD_STORAGE) + '（当前 ' + fmt(capNow) + '）</span><br>' +
              '达标并跑满本轮后，在工位点击「尝试启动永动轮」即可。</div>';
    } else {
      const cycOk = S.cycle >= MIN_GOOD_CYCLE;
      info += '<div class="goal-box"><div class="gt">突破僵局的目标（开启好结局）</div>' +
              '<span class="' + (cycOk ? 'ok' : 'todo') + '">' + (cycOk ? '✓ ' : '· ') +
              '推进至第 ' + MIN_GOOD_CYCLE + ' 周目起（当前第 ' + S.cycle + ' / ' + MIN_GOOD_CYCLE + ' 周目）</span><br>' +
              '<span class="' + (capOk ? 'ok' : 'todo') + '">' + (capOk ? '✓ ' : '· ') +
              '储存上限达到 ' + fmt(GOOD_STORAGE) + '（当前 ' + fmt(capNow) + ' / ' + fmt(GOOD_STORAGE) + '）</span><br>' +
              '两项均达标并跑满本轮后，在工位点击「尝试启动永动轮」即可迎来好结局。</div>';
    }
  }
  $('reInfo').innerHTML = info;

  const btn = $('reBtn');
  btn.style.display = (S.seenBad && !S.challenge) ? '' : 'none';
  btn.disabled = !(capped && g > 0 && S.seenBad);
  $('reSub').textContent = (capped && g > 0)
    ? ('换取 ' + g + ' 片记忆碎片 · 用于点亮下方永久升级')
    : '这一夜还没到头';
  const cg = $('catGo');
  if(cg) cg.style.display = canUnlockCat() ? '' : 'none';
  const ch = $('catHidden');
  if(ch) ch.style.display = canUnlockCatHidden() ? '' : 'none';
  renderFragTree();
}

function treeEffectText(u, L){
  if(u.id === 't_boot'){
    if(L <= 0) return '当前未激活 · 点亮后每夜直接跳过冷启动';
    const ip0 = Math.round(120 * Math.pow(3.5, L - 1));
    return '已生效：开局演算草纸 Lv.' + (2*L) + ' · 焊锡炉 Lv.' + L + ' · 初始能量 ' + fmt(ip0);
  }
  if(u.id === 't_bell'){
    return '当前甜点宽度 ' + treeBellSigma().toFixed(2) + ' · 最低保底 ' + Math.round(treeBellFloor()*100) + '%';
  }
  if(u.id === 't_rate'){
    return '当前主线全局产出 ×' + treeRateMult().toFixed(2);
  }
  if(u.id === 't_cap'){
    return '当前储存上限 ×' + treeCapMult().toFixed(2) + ' · 散热转化 +' + (L * 0.01).toFixed(2);
  }
  if(u.id === 't_cat'){
    return '当前小猫鱼干产量 +' + (L * 8) + '%（×' + treeCatBoost().toFixed(2) + '）';
  }
  return '';
}

function renderFragTree(){
  const box = $('fragTreeList');
  if(!box || typeof FRAG_TREE === 'undefined') return;
  box.replaceChildren();
  for(const u of FRAG_TREE){
    const L = tlv(u.id);
    const unlocked = isTreeUnlocked(u);
    const maxed = u.max > 0 && L >= u.max;
    const cost = treePrice(u);

    const card = document.createElement('div');
    card.className = 'ftree-node' + (maxed ? ' max' : '') + (!unlocked ? ' locked' : '');

    const info = document.createElement('div');
    info.className = 'finfo';

    const nm = document.createElement('div');
    nm.className = 'fnm';
    nm.textContent = u.name;
    const tag = document.createElement('span');
    tag.className = 'ftag';
    tag.textContent = u.tag || '';
    nm.appendChild(tag);

    const ds = document.createElement('div');
    ds.className = 'fds';
    ds.textContent = u.desc;

    const eff = document.createElement('div');
    eff.className = 'feff';
    eff.textContent = unlocked ? treeEffectText(u, L) : '需先将上方四项主线底稿全部点满后解锁';

    info.append(nm, ds, eff);

    const btn = document.createElement('button');
    btn.className = 'fbuy';
    if(!unlocked){
      btn.innerHTML = '<span>未解锁</span><small>需主线全满</small>';
      btn.disabled = true;
    } else if(maxed){
      btn.innerHTML = '<span>已满级</span><small>Lv.' + L + '/' + u.max + '</small>';
      btn.disabled = true;
    } else {
      btn.innerHTML = '<span>' + fmt(cost) + ' 碎片</span><small>Lv.' + L + (u.max > 0 ? '/' + u.max : '') + '</small>';
      btn.disabled = S.frag < cost;
      btn.onclick = () => buyTree(u.id);
    }

    card.append(info, btn);
    box.appendChild(card);
  }
}

/* 事件 */

/* ---------- 小猫支线界面 ---------- */
let catRefs = [];

function renderCat(){
  const box = $('catList');
  if(!box || !S.cat) return;
  box.replaceChildren();
  catRefs = [];
  for(const u of CATSUB){
    const row = document.createElement('div');
    row.className = 'row';
    const info = document.createElement('div');
    info.className = 'info';
    const nm = document.createElement('div');
    nm.className = 'nm';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = u.name;
    const em = document.createElement('em');
    em.textContent = '';
    nm.append(titleSpan, em);
    const ds = document.createElement('div');
    ds.className = 'ds';
    ds.textContent = u.desc;
    info.append(nm, ds);
    const btn = document.createElement('button');
    btn.className = 'buy';
    btn.onclick = () => buyCat(u.id);
    row.append(info, btn);
    box.appendChild(row);
    catRefs.push({u, row, btn, em, titleSpan, ds});
  }
  updateCat();
}

function updateCat(){
  if(!S.cat) return;
  $('catIp').textContent = fmt(S.cat.ip);
  const sm = stashMultPerLv();
  $('catLine').innerHTML = '每秒 <b>' + fmt(catRate()) + '</b> · 累计 ' + fmt(S.cat.total) +
    ' · 主线产出 +' + (3 * clv('c13')) + '% · 储存 ×' + Math.pow(sm, clv('c11')).toFixed(2) +
    '<br>主线离线：' + offlineCapH() + ' 小时 · ' + Math.round(offlineEff()*100) + '% 效率';
  for(const r of catRefs){
    const u = r.u, L = clv(u.id), c = catPrice(u), maxed = !!u.max && L >= u.max;
    r.btn.innerHTML = '<span>' + (maxed ? '已满' : fmt(c)) + '</span><small>Lv.' + L +
      (u.max ? '/' + u.max : '') + '</small>';
    r.btn.disabled = maxed || S.cat.ip < c;
    r.row.classList.toggle('max', maxed);
    if(u.id === 'c11'){
      r.ds.textContent = '把东西码整齐 · 每级主线上限 ×' + sm.toFixed(2) + '（无上限）';
    } else if(u.id === 'c15'){
      if(L === 0){
        r.titleSpan.textContent = '小猫监督官';
        r.ds.textContent = '排班表旁多了两个猫爪印 · 有钱就买最便宜的主线工位（不管发不发热）';
      } else if(L === 1){
        r.titleSpan.textContent = '猫工智能';
        r.ds.textContent = '它好像看懂温度了 · 升级后偏热会优先升阿尔瓦，不再乱烧机器';
      } else {
        r.titleSpan.textContent = '猫工智能';
        r.ds.textContent = '它已经学会看温度了 · 自动买主线工位（偏热优先升阿尔瓦）';
      }
    }
    r.em.textContent = u.util
      ? (u.id === 'c9'  ? ' ' + offlineCapH() + ' 小时'
        : u.id === 'c10' ? ' ' + Math.round(offlineEff()*100) + '%'
        : u.id === 'c11' ? ' ×' + Math.pow(sm, L).toFixed(2)
        : u.id === 'c13' ? ' +' + (3 * L) + '%'
        : u.id === 'c14' ? (L ? ' 已开启' : ' 关')
        : u.id === 'c15' ? (L === 0 ? ' 关' : L === 1 ? ' 贪心买中' : ' 散热保护中')
        : ['关', '自动买产线', '＋囤货', '＋带回来的'][L] || '关')
      : ' +' + u.val + '/级';
  }
}

function renderSet(){
  const hasCh = !!S.challengeReady;
  $('setChSec').style.display = hasCh ? '' : 'none';
  const btn = $('setChallenge');
  btn.style.display = hasCh ? '' : 'none';
  if(!hasCh) return;
  if(S.challenge){
    btn.disabled = true;
    btn.innerHTML = '挑战进行中 · 不要碰永动轮';
    return;
  }
  btn.disabled = false;
  const sn = S.snapshot;
  let n = 0;
  if(sn && sn.cat && sn.cat.lv) for(const k in sn.cat.lv) n += sn.cat.lv[k];
  btn.innerHTML = '重新挑战<small>' + (sn
    ? '快照：碎片 ' + sn.frag + ' · 小猫 ' + n + ' 级 · 主线从第一夜重来'
    : '主线和碎片重来一次，小猫进度保留') + '</small>';
}
function openSet(){ $('setView').classList.add('on'); document.body.style.overflow = 'hidden'; renderSet(); }
function closeSet(){ $('setView').classList.remove('on'); document.body.style.overflow = ''; }
function openHelp(){ $('helpView').classList.add('on'); document.body.style.overflow = 'hidden'; }
function closeHelp(){ $('helpView').classList.remove('on'); document.body.style.overflow = ''; }

/* ---------- 更新日志与版本提醒 ---------- */
const VER_KEY = 'lab_seen_ver';
function hasUnseenUpdate(hadSave){
  if(typeof APP_VERSION === 'undefined') return false;
  try{
    const seen = localStorage.getItem(VER_KEY);
    if(!seen){
      if(!hadSave){
        // 首次打开的新玩家不弹更新红点，静默记下当前版本
        localStorage.setItem(VER_KEY, APP_VERSION);
        return false;
      }
      // 已有旧存档但未记过版本号的老玩家，提示一次
      return true;
    }
    return seen !== APP_VERSION;
  }catch(e){ return false; }
}
function setUpdateBadge(on){
  if($('setBtn')) $('setBtn').classList.toggle('has-update', !!on);
  if($('setChangelog')) $('setChangelog').classList.toggle('has-update', !!on);
}
function markChangelogSeen(){
  if(typeof APP_VERSION !== 'undefined'){
    try{ localStorage.setItem(VER_KEY, APP_VERSION); }catch(e){}
  }
  setUpdateBadge(false);
}
function renderChangelog(){
  const box = $('changelogList');
  if(!box || typeof CHANGELOG === 'undefined') return;
  box.replaceChildren();
  for(const entry of CHANGELOG){
    const wrap = document.createElement('div');
    wrap.className = 'cl-entry';
    const head = document.createElement('div');
    head.className = 'cl-head';
    head.innerHTML = '<b>v' + entry.ver + '</b><span>' + (entry.date || '') + '</span>';
    const ul = document.createElement('ul');
    ul.className = 'helplist';
    for(const line of (entry.items || [])){
      const li = document.createElement('li');
      li.textContent = line;
      ul.appendChild(li);
    }
    wrap.append(head, ul);
    box.appendChild(wrap);
  }
}
function openChangelog(){
  renderChangelog();
  markChangelogSeen();
  if($('changelogView')) $('changelogView').classList.add('on');
  document.body.style.overflow = 'hidden';
}
function closeChangelog(){
  if($('changelogView')) $('changelogView').classList.remove('on');
  if(!$('setView').classList.contains('on')) document.body.style.overflow = '';
}

function exportSave(){
  try{
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lab_idle_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    toast('已导出存档');
  }catch(e){ toast('导出失败'); }
}
function importSave(file){
  const r = new FileReader();
  r.onload = () => {
    try{
      const d = JSON.parse(String(r.result));
      if(!d || typeof d !== 'object' || typeof d.ip !== 'number') throw new Error('bad');
      wiping = false;
      localStorage.setItem(SAVE_KEY, JSON.stringify(d));
      location.reload();
    }catch(e){ toast('这不是有效的存档文件'); }
  };
  r.readAsText(file);
}

function copyText(text, okMsg){
  const fallback = () => {
    try{
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if(ok){ toast(okMsg); return; }
    }catch(e){}
    window.prompt('请手动复制以下内容：', text);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(() => toast(okMsg)).catch(fallback);
  } else {
    fallback();
  }
}

function copySaveCode(){
  try{
    save();
    const json = JSON.stringify(S);
    const code = btoa(unescape(encodeURIComponent(json)));
    copyText(code, '已复制存档码');
  }catch(e){ toast('生成存档码失败'); }
}

function pasteSaveCode(){
  const raw = window.prompt('请粘贴之前复制的存档码：');
  if(!raw || !raw.trim()) return;
  try{
    const json = decodeURIComponent(escape(atob(raw.trim())));
    const d = JSON.parse(json);
    if(!d || typeof d !== 'object' || typeof d.ip !== 'number') throw new Error('bad');
    wiping = false;
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    location.reload();
  }catch(e){ toast('存档码无效或已损坏'); }
}

/* 开始挑战：进入前先整份存快照，主线归零 */
function startChallenge(){
  if(S.challenge || !S.challengeReady) return;
  if(!confirm('进入挑战模式？\n\n主线会被清空，碎片和小猫保持你现在的进度。\n这一局里不要碰永动轮，也不要结束这一夜，直到小猫把所有人送上好结局。\n\n通关后会把现在的存档原样盖回来。')) return;
  const sn = S.snapshot;
  if(sn) S.frag = sn.frag || 0;
  saveSnapshot();               // 整份存档进快照
  S.challenge = true;
  S.restorePending = true;
  resetRun();
  closeSet();
  log('你把这一夜重新摆回原样。猫看了一眼门，没有走。——挑战开始。', 'hot');
  toast('挑战开始');
  save();
}

function openCatView(){
  if(!S.cat) return;
  $('catView').classList.add('on');
  document.body.style.overflow = 'hidden';
  renderCat(); drawCatWorld();
}
function closeCatView(){
  $('catView').classList.remove('on');
  document.body.style.overflow = '';
}

/* 解锁：第 10 周目起（也就是重置过 9 次之后），在「结束这一夜」界面里出现。
 * 猫有九条命 —— 前九次重置它都不在，第九次之后它才出现。 */
// 小猫入口有两条，干的是同一件事：普通路线（第十夜起）和硬核路线（守满 8 小时）。
// 硬核一旦解锁就把普通那条收起来，别让玩家看见两个一样的按钮。
function canUnlockCat(){ return !S.cat && S.cycle >= CAT_UNLOCK_CYCLE && !S.hiddenCatReady; }
function canUnlockCatHidden(){ return !S.cat && S.hiddenCatReady; }
function catOffered(){ return canUnlockCat() || canUnlockCatHidden(); }

function openHiddenCat(){
  if(S.cat || !S.hiddenCatReady) return;
  playCards(ENDINGS.catUnlockHidden, () => {
    S.cat = { ip: 0, lv: {}, total: 0, last: now(), on: true };
    S.hiddenCat = true;
    endFinale();
    log('你没有让这一夜结束。猫带你看了它的地盘。——硬核路线开始。','hot');
    toast('解锁 · 小猫（隐藏）');
    renderCat(); renderRebirth(); renderShop();
    save();
  });
}

function openCatLine(){
  if(!canUnlockCat()) return;
  playCards(ENDINGS.catUnlockNormal, () => {
    S.cat = {ip:0, lv:{}, total:0, last:now(), on:true};
    endFinale();
    log('猫甩了甩尾巴，走出了门。它开始有自己的账本了。', 'hot');
    toast('解锁 · 小猫');
    renderCat(); renderRebirth(); renderShop();
    save();
  });
}

let evTimer = 0, evCur = null, evClose = null;

function scheduleEvent(){
  const mul = S.cycle === 1 ? FIRST_CYCLE_EVENT_MUL : 1.0;
  evTimer = now() + (EVENT_MIN_SEC + Math.random()*EVENT_JITTER_SEC) * mul * 1000;
}

// 抽一张事件卡（里程碑与结局过场也走这里）
function resolveCycleText(ev){
  let text = ev.desc;
  if(ev.cycleNotes && typeof ev.cycleNotes === 'object'){
    // 只需在事件里写 cycleNotes: { 2: '...', 6: '...' }，会自动挑出 <= 当前周目的最高档补在文末
    const keys = Object.keys(ev.cycleNotes)
      .map(Number)
      .filter(k => isFinite(k) && k <= S.cycle)
      .sort((a, b) => b - a);
    if(keys.length > 0){
      text = text + '\n\n' + ev.cycleNotes[keys[0]];
    }
  }
  return text;
}

function presentEvent(ev, onClose){
  evCur = ev;
  evClose = onClose || null;
  S.evtOpen = true;
  $('evTitle').textContent = ev.title;
  $('evDesc').textContent = resolveCycleText(ev);
  const opts = $('evOpts');
  opts.replaceChildren();
  ev.opts.forEach((o, i) => {
    const b = document.createElement('button');
    b.innerHTML = '<b>' + (i+1) + '</b>' + o.label +
      '<br><span style="color:#8a7d6a;font-size:10.5px">' + o.sub + '</span>';
    b.onclick = () => resolveEvent(i);
    opts.appendChild(b);
  });
  $('event').classList.add('on');
}

function resolveEvent(i){
  if(!S.evtOpen) return;
  S.evtOpen = false;
  $('event').classList.remove('on');
  S.battles += 1;
  const curEv = evCur;
  const o = curEv && curEv.opts[i];
  const prevTop = S.log.length ? S.log[0] : null;
  if(o && o.run) o.run();
  // 把本次事件触发的完整文案永久记入 S.evLog（跨周目不清空、不会被系统日志顶掉）
  const newTop = S.log.length ? S.log[0] : null;
  if(curEv && newTop && newTop !== prevTop){
    newTop.type = 'event';
    if(!Array.isArray(S.evLog)) S.evLog = [];
    S.evLog.unshift({
      t: now(),
      cycle: S.cycle,
      title: curEv.title || '事件',
      choice: o ? o.label : '',
      text: newTop.text
    });
    if(S.evLog.length > 300) S.evLog.pop();
    if(logFilter === 'event') renderLog();
  }
  const cb = evClose;
  evClose = null; evCur = null;
  save();
  if(cb){ cb(); return; }
  scheduleEvent();
}

// 随机事件：只在当前场景的池子里抽，本周目不重复；小猫事件（stage -1）全阶段可出
function openEvent(){
  if(S.evtOpen || reachedCap()) return;
  const pool = EVENTS.filter(e =>
    !S.seenEv.includes(e.id) && (e.stage === S.scene || e.stage === -1));
  if(!pool.length) return;
  const ev = pool[Math.floor(Math.random() * pool.length)];
  S.seenEv.push(ev.id);
  presentEvent(ev);
}

// 里程碑：满足条件即触发，跨周目只来一次
function checkMilestones(){
  if(S.evtOpen) return;
  for(const m of MILESTONES){
    if(m.manual || S.milestones.includes(m.id)) continue;
    let hit = false;
    try{ hit = !!m.when(); }catch(e){ hit = false; }
    if(!hit) continue;
    S.milestones.push(m.id);
    presentEvent(m);
    return;
  }
}


/* ============================================================
   主循环
   ============================================================ */
let lastT = performance.now();
let acc = 0, uiAcc = 0;
let paintedScene = -1;

function tick(dt){
  syncCap();   // 储存上限跟着散热比 / 碎片实时走

  // 隐藏：第一周目硬守 8 小时，不碰永动轮，猫会自己找上门
  if(!S.hiddenCatReady && !S.cat && S.cycle === 1 && !S.fx && cycleMinutes() >= HIDDEN_MIN){
    S.hiddenCatReady = true;
    log('猫从桌上跳下来，走到门口坐下，又回头看了你一眼。','hot');
    toast('有什么不一样了');
    renderRebirth();
    save();
  }

  // 在线时长（只算页面开着的时候）
  S.secs += dt;

  // 稳定性：向「散热比决定的平衡点」缓动，限速 ±3 %/s。
  //
  // 旧写法是 stab += (散热 - 发热) * 1.5 * dt —— 用绝对差当 %/s，
  // 后期散热涨到几千时一帧就回满，稳定条恒定 100，等于没有这个系统。
  // 现在改成「当前值朝目标值收敛」，上限天然被限速吃掉。
  const stabTarget = 100 / (1 + Math.pow(Math.max(1e-6, coolRatio()), -STAB_SLOPE));
  const dStab = stabTarget - S.stab;
  S.stab = Math.max(0, Math.min(100, S.stab + Math.max(-3, Math.min(3, dStab * 1.2)) * dt));

  // 产出
  const r = rate();
  if(r > 0) gain(r * dt);

  // buff 清理
  if(S.buffs.length){
    const t = now();
    S.buffs = S.buffs.filter(b => b.until > t);
  }

  // 技能冷却
  for(const k in S.cd) if(S.cd[k] > 0) S.cd[k] = Math.max(0, S.cd[k] - dt);

  // 成就：按行为累计，只在达标那一刻喊一声
  if(S.nights >= 20)  awardAch('nights20');
  if(S.nights >= 40)  awardAch('nights40');
  if(S.taps >= 1000) awardAch('tap1000');
  if(SHELF_CAT_N() >= 40) awardAch('cat40');
  if(S.secs >= 86400) awardAch('pole');
  if(S.secs >= 259200) awardAch('weekly');
  if(S.secs >= 604800) awardAch('month');
  if(clv('c12') >= 3) awardAch('auto3');
  if(S.seenBad) awardAch('paris1775');
  if(shelfValue('her') >= 60) awardAch('davinci');
  if(S.secs >= 10800) awardAch('orffyreus');
  if(clv('c15') >= 2) awardAch('maxwell');

  // 收藏解锁：按行为累计，不只按能量
  for(const it of ITEMS){
    if(S.items.includes(it.id)) continue;
    if(shelfValue(it.kind) >= it.need){
      S.items.push(it.id);
      log('收藏室多了一件东西：' + it.name, 'hot');
      toast('解锁 · ' + it.name);
      renderShelf();
    }
  }

  // 场景：本周目内按累计能量推进，重启归 0
  const sc = sceneForRun(S.run);
  if(sc > S.scene) S.scene = sc;

  // 小猫挂机时每隔约 3.5 分钟在当前场景的点位间换个窝，让画面更有生活感
  if(!S.evtOpen && !S.fx && Math.floor((S.secs - dt) / 210) < Math.floor(S.secs / 210)){
    patrolCat();
  }

  autoDrive(dt);

  // 小猫支线：并行产出，不受周目影响
  if(S.cat){
    const g = catRate() * dt;
    S.cat.ip += g;
    S.cat.total += g;
    S.cat.last = now();
  }

  // 里程碑（跨周目只触发一次）；同一帧若触发了里程碑，就先不弹随机事件
  if(!S.evtOpen && S.run > 1500) checkMilestones();

  // 随机事件：封顶后不再打扰；第一周目需要跑过 8000 能量后再开始慢慢出事件
  const minRunForEv = S.cycle === 1 ? 8000 : 3000;
  if(!atCap() && !S.evtOpen && now() > evTimer && S.run > minRunForEv) openEvent();
}

function renderUI(){
  $('ip').textContent = fmt(S.ip);
  $('unitLbl').textContent = '/ ' + fmt(storageMax());
  const r = rate();
  $('rateLine').innerHTML = '每秒 <b>' + fmt(r) + '</b> · 稳定性系数 ×' + stabFactor().toFixed(2) +
    (buffMult() > 1 ? ' · 加成 ×' + buffMult().toFixed(2) : '');
  const pct = S.stab;
  $('stabVal').textContent = Math.round(pct) + '%';
  const bar = $('stabBar');
  $('stabFill').style.width = pct + '%';
  bar.className = 'bar' + (pct < 20 ? ' danger' : pct < 45 ? ' warn' : '');
  const cr = coolRatio();
  const shape = fragShape(cr);
  const crHint = shape >= PEAK_FLASH ? ' · 刚好' : (cr < BELL_MU ? ' · 偏热' : ' · 过冷');
  $('heatLine').textContent = '发热 ' + heat().toFixed(1) + ' / 散热 ' + alvaRate().toFixed(1) +
    ' · 比 ×' + cr.toFixed(2) + crHint;

  // 技能
  const cdMax = {ab1:14, ab2:40, ab3:70};
  for(const k in cdMax){
    const b = $(k);
    const left = S.cd[k];
    b.disabled = left > 0;
    b.querySelector('.cd').style.width = (left/cdMax[k]*100) + '%';
    const sub = b.querySelector('small');
    if(left > 0) sub.textContent = Math.ceil(left) + ' 秒';
    else sub.textContent = k==='ab1' ? '8 秒产出 · 稳 -8' : k==='ab2' ? '稳定性 +22' : '20 秒 ×2.5';
  }

  updateEndNight();
  if(paintedScene !== S.scene){ paintedScene = S.scene; drawScene(); }
  updateCapBanner();
  updateShop();
  renderSceneCaption();
  if($('tab-re').style.display !== 'none') renderRebirth();
  if($('catView').classList.contains('on')) updateCat();
  updateGuide();
  updateDocTitle();
}

function totalTreeLv(){
  if(!S.tree) return 0;
  let n = 0;
  for(const k in S.tree) n += (S.tree[k] || 0);
  return n;
}
function catProdLv(){
  let n = 0;
  for(const u of CATSUB) if(!u.util) n += clv(u.id);
  return n;
}
function hasAffordableTree(){
  if(typeof FRAG_TREE === 'undefined') return false;
  for(const u of FRAG_TREE){
    if(!isTreeUnlocked(u)) continue;
    if(u.max > 0 && tlv(u.id) >= u.max) continue;
    if(S.frag >= treePrice(u)) return true;
  }
  return false;
}
function updateTabBadges(){
  const reTab = $('tabBtnRe');
  if(!reTab) return;
  const needAttn = hasAffordableTree() || canUnlockCat() || canUnlockCatHidden();
  reTab.classList.toggle('has-dot', needAttn);
}
function abTried(k){
  return Array.isArray(S.abUsed) && S.abUsed.includes(k);
}

let dismissedGuideKey = '';
let currentGuideKey = '';
function updateGuide(){
  updateTabBadges();
  const el = $('catGuide');
  const body = $('catGuideBody');
  if(!el || !body) return;
  for(const id of ['ab1','ab2','ab3']){
    const b = $(id);
    if(b) b.classList.remove('guide-pulse');
  }

  const blocking =
    S.fx || S.evtOpen ||
    ($('setView') && $('setView').classList.contains('on')) ||
    ($('helpView') && $('helpView').classList.contains('on')) ||
    ($('changelogView') && $('changelogView').classList.contains('on')) ||
    ($('endnight') && $('endnight').classList.contains('on'));
  if(blocking){
    el.style.display = 'none';
    return;
  }

  let key = '';
  let msg = '';
  let isWarn = false;
  const inCatView = $('catView') && $('catView').classList.contains('on');
  const inReTab = $('tab-re') && $('tab-re').style.display !== 'none';

  // 0. 小猫的小鱼工厂专属引导（4 步）
  if(inCatView && S.cat){
    const prod = catProdLv();
    if(prod === 0){
      key = 'cat_1';
      msg = '<b>小猫引路 (1/4)：</b>欢迎来到猫的秘密基地！这里的<b>「鱼干」</b>是独立账本，完全不花实验室的能量。先买最上面的<b>「窗台」</b>或<b>「毛线球」</b>，让猫开始自己攒鱼干吧。';
    } else if(prod < 4 && clv('c11') === 0 && clv('c13') === 0){
      key = 'cat_2';
      msg = '<b>小猫引路 (2/4)：</b>鱼干已经进账啦！多给猫占几块地盘（屋顶、烟囱、面包店后门……），鱼干涨得越快，后面能帮实验室干的活就越多。';
    } else if(clv('c11') === 0 && clv('c13') === 0){
      key = 'cat_3';
      msg = '<b>小猫引路 (3/4)：</b>往下翻就能看到猫暗中给实验室留的帮手——<b>「囤货」</b>能帮主线把容量一路撑大（这是冲刺好结局的关键），<b>「带回来的」</b>能帮主线提速。';
    } else if(clv('c12') === 0){
      key = 'cat_4';
      msg = '<b>小猫引路 (4/4)：</b>等鱼干宽裕了，还可以点<b>「留一盏灯 / 按时回来」</b>让离线收益更丰厚，或者买<b>「自动值守 / 小猫监督官」</b>，猫就会在你走神时替你把升级都打理好。';
    }
  }
  // 1. 本轮已研究到尽头（含满仓停产提醒）
  else if(atCap()){
    if(S.ip >= S.capRun){
      key = 'full_cap_' + S.cycle;
      msg = (S.seenBad && !S.challenge)
        ? '<b>小猫提醒：</b>容器装得满满当当，机器暂时停下来喘口气啦——现在可以直接点工位顶部的<b>「尝试启动永动轮」</b>，或切到「记忆碎片」结束这一夜。'
        : '<b>小猫提醒：</b>容器装得满满当当，机器暂时停下来喘口气啦——今晚能做的都做尽了，去工位顶部点击<b>「尝试启动永动轮」</b>看看结果吧。';
      isWarn = true;
    } else if(S.ip < finalPrice()){
      key = 'cap_wait_' + S.cycle;
      msg = '<b>小猫备忘：</b>这一夜似乎已经研究到尽头了！先忍住别花能量，等手里蓄够（<b>' + fmt(finalPrice()) + '</b>），就能点工位顶部的<b>「尝试启动永动轮」</b>。';
    } else if(enoughForGoodEnding()){
      key = 'cap_good_' + S.cycle;
      msg = '<b>小猫备忘：</b>猫竖起了耳朵——这一次火候和底气都攒够了！快去工位顶部点击<b>「尝试启动永动轮」</b>，迎接不一样的结局吧。';
    } else if(!S.seenBad){
      key = 'cap_first';
      msg = '<b>小猫备忘：</b>今晚能做的都做尽了！点击工位顶部的<b>「尝试启动永动轮」</b>，看看今晚会发生什么吧。';
    } else if(S.cycle <= 3){
      key = 'cap_c2';
      msg = '<b>小猫备忘：</b>这一夜又走到尽头啦：结夜前把热度调到<b>「刚好」</b>能换到最多记忆碎片。可以直接去「记忆碎片」收手结夜，或点「尝试启动永动轮」拿一份坚持奖励。';
    }
  }
  // 2. 小猫支线可解锁提醒（第 10 周目或隐藏 8 小时）
  else if(canUnlockCat() || canUnlockCatHidden()){
    key = 'cat_unlock_hint';
    msg = '<b>小猫引路：</b>猫在门口坐了很久，又回头冲你叫了一声——切到<b>「记忆碎片」</b>页，看看它要带你去哪儿吧。';
  }
  // 3. 第一周目结束结算完记忆碎片后：手把手教点亮永久底稿
  else if(S.seenBad && totalTreeLv() === 0 && S.frag >= 12){
    if(!inReTab){
      key = 'c2_frag_go';
      msg = '<b>小猫引路：</b>第一夜的准备还撑不住永动轮，别难过，这不是玩错了！刚才你攒下了<b>记忆碎片</b>，快切到<b>「记忆碎片」</b>页，把记住的经验点亮成永久底稿吧。';
    } else {
      key = 'c2_frag_buy';
      msg = '<b>小猫引路：</b>碎片攥在手里不会自己起作用——往下翻就是<b>「记忆碎片升级树」</b>：点亮<b>「旧日底稿」</b>能省去慢热开荒，点亮<b>「深井蓄能」</b>能把天花板越推越高，点亮后每夜永久生效！';
    }
  }
  // 4. 第一周目生动多步引导（先体验三枚小猫技能，再循序升级、过热降温、温控、事件与收藏室）
  else if(S.cycle === 1 && !S.seenBad){
    if(!abTried('ab1')){
      key = 'c1_ab1';
      msg = '<b>小猫引路 (1/7)：</b>猫用肉垫拍了拍桌上的铜踏板——开局还买不起设备，先点一下<b>「踩踏板」</b>，立刻就能攒出第一笔能量！';
      if($('ab1') && S.cd.ab1 <= 0) $('ab1').classList.add('guide-pulse');
    } else if(!abTried('ab2') || !abTried('ab3')){
      key = 'c1_ab23';
      msg = '<b>小猫引路 (2/7)：</b>另外两枚小猫按钮现在也能直接点：试着按一遍<b>「呼噜声」</b>（安抚机器回稳）和<b>「尾巴扫纸」</b>（让两人短时间手速翻倍）吧！';
      if(!abTried('ab2') && $('ab2') && S.cd.ab2 <= 0) $('ab2').classList.add('guide-pulse');
      if(!abTried('ab3') && $('ab3') && S.cd.ab3 <= 0) $('ab3').classList.add('guide-pulse');
    } else if(lv('h1') === 0){
      key = 'c1_h1';
      msg = '<b>小猫引路 (3/7)：</b>能量够买第一件东西啦！去「工位 → 赫尔曼」买第一摞<b>「演算草纸」</b>，让屋里的机器自己转起来。';
    } else if(lv('h1') < 3 && shelfValue('alv') === 0){
      key = 'c1_h1_more';
      msg = '<b>小猫引路 (4/7)：</b>纸页沙沙响起来了！趁热打铁把<b>「演算草纸」</b>再多升两级，赫尔曼写起算式会越来越顺手。';
    } else if(shelfValue('alv') === 0){
      key = 'c1_alv';
      msg = '<b>小猫引路 (5/7)：</b>升级了产出反而速度变慢了？不要担心，是机器过热了！攒够 <b>100 能量</b>就去找<b>「阿尔瓦」</b>升级散热系统（买第一台「恒温焊锡炉」），让屋里凉快下来吧。';
    } else if(lv('h2') === 0 || shelfValue('alv') < 2){
      key = 'c1_balance';
      msg = '<b>小猫引路 (6/7)：</b>焊锡炉一接上，屋里立刻安稳多了。接下来可以交替给赫尔曼和阿尔瓦添置新家伙，顺手留意温控提示：<b>「偏热」</b>找阿尔瓦降温，<b>「过冷」</b>找赫尔曼加把劲，稳在<b>「刚好」</b>附近最舒服。';
    } else if(S.battles === 0){
      key = 'c1_event_preview';
      msg = '<b>小猫引路 (7/7)：</b>等机器跑顺了，屋里时不时会冒出两个人和猫的<b>随机小插曲（事件弹窗）</b>，不同选择会带来不同收获。现在就专心把这一夜推进到尽头吧！';
    } else if(S.battles === 1){
      key = 'c1_event_done';
      msg = '<b>小猫备忘：</b>刚才的小插曲已经收进<b>「日志 → 仅看事件」</b>啦，随时能翻回来看。随着研究推进，<b>「收藏室」</b>里也会悄悄多出两人的旧物，记得偶尔点开翻翻。';
    }
  }
  // 5. 第二周目点亮第一个底稿后：交代温控与碎片关系
  else if(S.cycle === 2 && totalTreeLv() > 0){
    key = 'c2_cool';
    msg = '<b>小猫引路：</b>永久底稿已经刻进记忆里啦！以后每夜结夜前，留意温控提示——<b>偏热</b>找阿尔瓦、<b>过冷</b>找赫尔曼，把温度稳在<b>「刚好」</b>时结夜，能换到最多记忆碎片。';
  }

  // 如果进入新阶段，自动重置之前的关闭记录
  if(key && key !== currentGuideKey){
    currentGuideKey = key;
    if(dismissedGuideKey !== key) dismissedGuideKey = '';
  }

  if(msg && dismissedGuideKey !== key){
    el.style.display = 'flex';
    el.className = 'cat-guide' + (isWarn ? ' warn' : '');
    if(body.innerHTML !== msg) body.innerHTML = msg;
  } else {
    el.style.display = 'none';
  }
}

let lastDocTitle = '';
function updateDocTitle(){
  let next = '永动轮实验室日常 · 小猫监督官';
  if(S.evtOpen && !S.fx){
    next = '【事件】永动轮实验室';
  } else if(atCap() && !S.fx){
    next = '【已到头】永动轮实验室';
  } else if(S.capRun > 0 && S.run > 0){
    const pct = Math.min(100, Math.floor(S.run / S.capRun * 100));
    next = '永动轮 · ' + pct + '%';
  }
  if(next !== lastDocTitle){
    lastDocTitle = next;
    document.title = next;
  }
}

function loop(tms){
  const dt = Math.min(0.5, (tms - lastT)/1000);
  lastT = tms;
  tick(dt);
  paintScene(tms);
  if($('catView').classList.contains('on')) paintCatWorld(tms);
  uiAcc += dt;
  if(uiAcc > 0.1){ uiAcc = 0; renderUI(); }
  requestAnimationFrame(loop);
}

/* ============================================================
   交互
   ============================================================ */
function doAbility(k, isAuto){
  if(S.cd[k] > 0) return;
  if(!isAuto){
    S.taps += 1;
    if(!Array.isArray(S.abUsed)) S.abUsed = [];
    if(!S.abUsed.includes(k)) S.abUsed.push(k);
  }
  if(k === 'ab1'){
    const g = Math.max(10, rate()*8);
    gain(g);
    addStab(-8);
    S.cd[k] = 14;
    if(!isAuto) toast('+' + fmt(g) + ' 能量');
  } else if(k === 'ab2'){
    addStab(22);
    S.cd[k] = 40;
    if(!isAuto) toast('稳定性 +22');
  } else if(k === 'ab3'){
    buff(2.5, 20);
    S.cd[k] = 70;
    if(!isAuto) toast('20 秒内产出 ×2.5');
  }
}

function switchTab(name){
  for(const b of document.querySelectorAll('.tabs button'))
    b.classList.toggle('on', b.dataset.tab === name);
  for(const t of ['shop','shelf','re','log'])
    $('tab-' + t).style.display = (t === name ? '' : 'none');
  if(name === 'shelf') renderShelf();
  if(name === 're') renderRebirth();
  if(name === 'log') renderLog();
}

/* 挑战被破坏：立刻回到进入挑战前的存档，不给确认 */
function abortChallenge(){
  if(!S.challenge) return;
  S.challenge = false;
  S.restorePending = false;
  const ok = restoreSnapshot();
  paintedScene = -1;
  renderShop(); renderRebirth(); renderSceneCaption(); renderShelf(); drawScene();
  if(ok){
    log('灯又亮回来了。屋子还是你离开时的样子。', 'warm');
    toast('挑战中断 · 存档已还原');
  }
  save();
}

function resetRun(){
  S.ip = 0; S.run = 0; S.stab = 100; S.lv = {}; S.buffs = [];
  S.cd = {ab1:0, ab2:0, ab3:0}; S.lastCycleMin = Math.max(0.1, cycleMinutes());
  S.scene = 0; S.fx = false; S.route = ''; S.boost = 0; S.seenEv = [];
  S.cycle = 1; S.cycleAt = now(); S.breakthrough = 0;
  applyBootUpgrades();
  syncCap(); paintedScene = -1;
  renderShop(); renderRebirth(); renderSceneCaption(); drawScene();
}

let lastSkipCardIdx = -1;
function doResetNight(g, customLog){
  $('endnight').classList.remove('on');

  S.frag += g;
  S.nights += 1;
  S.ip = 0; S.run = 0; S.stab = 100; S.lv = {}; S.buffs = [];
  S.cd = {ab1:0, ab2:0, ab3:0};
  S.lastCycleMin = Math.max(0.1, cycleMinutes());
  S.scene = 0; S.fx = false; S.route = ''; S.endingDone = false;
  S.boost = 0; S.seenEv = [];
  S.cycle += 1;
  S.cycleAt = now();
  applyBootUpgrades();
  syncCap();

  log(customLog || ('第 ' + (S.cycle - 1) + ' 夜结束。灯灭了，又亮起来，桌子还是那两张。'), 'hot');
  toast('获得 ' + g + ' 片记忆碎片');
  paintedScene = -1;
  renderShop(); renderRebirth(); renderSceneCaption(); drawScene();
  save();
}

function endNight(fromEndScreen){
  const g = fragGain();
  if(!reachedCap() || g <= 0 || !S.seenBad){
    if(reachedCap() && g <= 0) toast('这一夜还没走到尽头');
    return;
  }
  if(S.challenge){ abortChallenge(); return; }
  if(!fromEndScreen){
    const goodHint = enoughForGoodEnding()
      ? '\n\n（提示：当前上限已足够在工位「尝试启动永动轮」，直接结束会跳过这一夜的结局）'
      : '';
    if(!confirm('结束这一夜？\n\n第 ' + S.cycle + ' 周目到此为止，换取 ' + g + ' 片记忆碎片（可用于点亮永久记忆升级树）。' + goodHint)) return;

    // 未启动永动轮直接重启：播放一段阿尔瓦意识到准备不足、主动收手重来的单卡小剧情
    if(!S.fx && typeof SKIP_RESET_CARDS !== 'undefined' && SKIP_RESET_CARDS.length){
      let idx = Math.floor(Math.random() * SKIP_RESET_CARDS.length);
      if(SKIP_RESET_CARDS.length > 1 && idx === lastSkipCardIdx){
        idx = (idx + 1) % SKIP_RESET_CARDS.length;
      }
      lastSkipCardIdx = idx;
      const pick = SKIP_RESET_CARDS[idx];
      const resetLog = '第 ' + S.cycle + ' 夜结束。' + (pick.log || '灯灭了，又亮起来，桌子还是那两张。');
      playCards([{t: pick.t, b: pick.b || '熄灯，进入下一夜', d: pick.d}], () => {
        doResetNight(g, resetLog);
      }, true);
      return;
    }
  }
  doResetNight(g);
}

/* ============================================================
   结局 · 永动轮总装
   ============================================================ */

function finalPrice(){ return Math.round(S.capRun * FINAL_RATIO); }
function enoughForGoodEnding(){
  /*
   * 「前 12 个周目只能走坏结局」这道闸，只对**正常轮回**成立。
   *
   * 挑战模式和隐藏线都必须绕开它：
   *   · 挑战模式 startChallenge() 里会 resetRun()，周目被拨回 1；
   *   · 隐藏线本来就永远停在第 1 周目，压根没有周目可言。
   * 这两条线的玩家已经在放弃转生了，再拿周目数卡他们就永远通不了关
   * —— 之前正是这个原因，挑战模式那句测试一直失败。
   */
  if(!S.challenge && !S.hiddenCat && S.cycle < MIN_GOOD_CYCLE) return false;
  return storageMax() >= GOOD_STORAGE && S.run >= 0.9 * S.capRun;
}

/* 收藏解锁的六种行为 */
function shelfValue(kind){
  if(kind === 'time')  return S.secs;
  if(kind === 'taps')  return S.taps;
  if(kind === 'nights')return S.nights;
  if(kind === 'her')   return HER.reduce((n,u) => n + lv(u.id), 0);
  if(kind === 'alv')   return ALV.reduce((n,u) => n + lv(u.id), 0);
  if(kind === 'cat')   return SHELF_CAT_N();
  if(kind === 'bt')    return S.breakthrough || 0;
  return S.all;
}
function SHELF_CAT_N(){
  return Object.keys(S.cat ? S.cat.lv : {}).reduce((n,k) => n + clv(k), 0);
}
function shelfLabel(it){
  const v = shelfValue(it.kind);
  if(it.kind === 'time'){
    const h = v / 3600, needH = it.need / 3600;
    if(needH < 1) return v.toFixed(0) + ' / ' + it.need + ' 秒';
    return (h < 10 ? h.toFixed(1) : h.toFixed(0)) + ' / ' + needH.toFixed(0) + ' 小时';
  }
  if(it.kind === 'taps')   return v + ' / ' + it.need + ' 次手动操作';
  if(it.kind === 'nights') return v + ' / ' + it.need + ' 夜';
  if(it.kind === 'her')    return '赫尔曼的设备共 ' + v + ' / ' + it.need + ' 级';
  if(it.kind === 'alv')    return '阿尔瓦的设备共 ' + v + ' / ' + it.need + ' 级';
  if(it.kind === 'cat')    return '小猫支线共 ' + v + ' / ' + it.need + ' 级';
  if(it.kind === 'bt')     return '永动轮突破 ' + v + ' / ' + it.need + ' 次';
  return '累计 ' + fmt(v) + ' / ' + fmt(it.need) + ' 能量';
}

function awardAch(id){
  if(S.ach.indexOf(id) >= 0) return;
  const a = ACH.find(x => x.id === id);
  if(!a) return;
  S.ach.push(id);
  toast('成就 · ' + a.name);
  log('【成就】' + a.name + ' —— ' + a.desc, 'hot');
}

let cardQueue = [], cardDone = null, cardFinale = false;

function nextCard(){
  if(!cardQueue.length){
    $('event').classList.remove('on');
    $('event').classList.remove('finale');   // 过场结束，恢复成普通事件层
    S.evtOpen = false;                       // 过场收尾要复位，否则之后再也不弹随机事件
    const d = cardDone; cardDone = null;
    cardFinale = false;
    if(d) d();
    return;
  }
  const c = cardQueue.shift();
  $('evKicker').textContent = c.k || (cardFinale ? 'ENDING' : 'INTERLUDE');
  $('evTitle').textContent = c.t || '';
  $('evDesc').textContent = c.d;
  const opts = $('evOpts');
  opts.replaceChildren();
  if(c.opts && c.opts.length){
    /* 带选项的卡片（M8「最后一次关灯」用）：
       选完把这一选的旁白接成下一张卡，全程留在 finale 过场层里，
       不会先关掉事件层退回操作界面。 */
    c.opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.innerHTML = '<b>' + (i+1) + '</b>' + o.label +
        '<br><span style="color:#8a7d6a;font-size:10.5px">' + o.sub + '</span>';
      b.onclick = () => {
        const before = S.log.length ? S.log[0].text : '';
        if(o.run) o.run();
        const said = (S.log.length && S.log[0].text !== before) ? S.log[0].text : '';
        if(said) cardQueue.unshift({t:'', d:said});
        nextCard();
      };
      opts.appendChild(b);
    });
  } else {
    const b = document.createElement('button');
    b.innerHTML = '<b>·</b>' + (c.b || '……');
    b.onclick = nextCard;
    opts.appendChild(b);
  }
  $('event').classList.add('on');
  $('event').classList.toggle('finale', cardFinale);
}

/* finale = true 时强制置顶：铺满全屏、吃掉所有点击，玩家点不到下面任何东西。
   结局过场必须用它 —— 否则玩家能在 S.fx 已经置上的时候继续买东西。 */
function playCards(cards, done, finale){
  cardQueue = cards.slice(); cardDone = done;
  cardFinale = !!finale;
  S.evtOpen = true;                 // 过场期间不弹随机事件
  nextCard();
}
function endFinale(){ S.evtOpen = false; save(); }

function buyFinal(){
  if(S.fx) return;

  // 无转生小猫路线（隐藏线或挑战模式）：必须攒够好结局上限才能总装，否则提示差距并拦截，避免误入死局
  if(S.challenge || S.hiddenCat){
    const have = storageMax(), need = GOOD_STORAGE;
    if(!confirm('你确认准备好了吗？\n\n储存上限  ' + fmt(have) + ' / ' + fmt(need) + (atCap() ? '' : '\n（当前能量尚未跑满本轮上限）'))) return;
    if(have < need || !atCap()){
      toast('上限还差一点，再让小猫攒攒吧（' + fmt(have) + ' / ' + fmt(need) + '）');
      return;
    }
    if(S.ip < finalPrice()){
      toast('当前能量不足八成上限，请先蓄一会儿能量');
      return;
    }
  }else if(!atCap()){
    return;
  }
  const pay = finalPrice();
  S.ip -= pay;
  S.fx = true;
  const good = enoughForGoodEnding();
  if(good){
    if(S.challenge || S.hiddenCat){
      S.challenge = false;
      awardAch('hardcore');
    }else{
      S.challengeReady = true;
      S.snapshot = { frag: S.frag, cat: S.cat ? JSON.parse(JSON.stringify(S.cat)) : null };
    }
  }else if(S.challenge){
    S.challenge = false;
  }
  save(); renderShop();
  if(good) playGoodEnding(); else playBadEnding();
}

function finishChallenge(){
  const ok = restoreSnapshot();
  S.restorePending = false;
  if(ok){
    paintedScene = -1;
    renderShop(); renderRebirth(); renderSceneCaption(); renderShelf(); drawScene();
    log('你把这一夜收了回来。什么都没少，除了那些只有你记得的东西。', 'hot');
    toast('挑战结束 · 存档已还原');
  }
  save();
}

let lastBadPoolIdx = -1;
function buildBadEndingCards(){
  // 第 1 次看坏结局播完整版；第 2 次起从精简随机池抽一套（3 张卡），避免重复看太长
  let cards;
  const isShort = !!(S.seenBad && typeof BAD_ENDING_POOL !== 'undefined' && BAD_ENDING_POOL.length);
  if(isShort){
    let idx = Math.floor(Math.random() * BAD_ENDING_POOL.length);
    if(BAD_ENDING_POOL.length > 1 && idx === lastBadPoolIdx){
      idx = (idx + 1) % BAD_ENDING_POOL.length;
    }
    lastBadPoolIdx = idx;
    cards = BAD_ENDING_POOL[idx].map(c => ({...c}));
  } else {
    cards = ENDINGS.bad.map(c => ({...c}));
  }

  const cfg = BAD_ENDING_VARIANTS;
  if(!cfg) return cards;

  // 随着周目增加（第 2 周目起逐步提高概率），阿尔瓦在争吵中隐约察觉不对、情绪激动地冲口而出
  const slipChance = Math.min(0.85, Math.max(0, (S.cycle - 1) * 0.14));
  if(S.cycle >= 2 && Math.random() < slipChance && cfg.alvaSlipLines && cfg.alvaSlipLines.length){
    const pickAlva = cfg.alvaSlipLines[Math.floor(Math.random() * cfg.alvaSlipLines.length)];
    const targetCard = isShort ? cards[0] : cards[2];
    if(targetCard){
      targetCard.d = targetCard.d + '\n' + pickAlva;
    }
  }

  // 赫尔曼的微调台词（仅完整版或有对应卡时混入）
  if(!isShort && S.cycle >= 2 && Math.random() < 0.45 && cfg.hermannMoodLines && cfg.hermannMoodLines.length){
    const pickHerm = cfg.hermannMoodLines[Math.floor(Math.random() * cfg.hermannMoodLines.length)];
    if(cards[1]){
      cards[1].d = cards[1].d + '\n' + pickHerm;
    }
  }

  // 小猫作为完整亲历者的旁观注记（按当前周目挑出 <= S.cycle 的最高档）
  if(cfg.catWitnessLines && S.cycle >= 2){
    const keys = Object.keys(cfg.catWitnessLines)
      .map(Number)
      .filter(k => isFinite(k) && k <= S.cycle)
      .sort((a, b) => b - a);
    if(keys.length > 0){
      const catLine = cfg.catWitnessLines[keys[0]];
      const lastCard = cards[cards.length - 1];
      if(lastCard){
        lastCard.d = lastCard.d + '\n\n' + catLine;
      }
    }
  }

  // 二周目及以后：为坏结局推进按钮赋予轻度 meta 的轮回感表述
  if(S.cycle >= 2 && cfg.metaButtons){
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    cards.forEach((c, i) => {
      if(i === 0 && cfg.metaButtons.first) c.b = pick(cfg.metaButtons.first);
      else if(i === cards.length - 1 && cfg.metaButtons.last) c.b = pick(cfg.metaButtons.last);
      else if(cfg.metaButtons.middle) c.b = pick(cfg.metaButtons.middle);
    });
  }

  return cards;
}

function playBadEnding(){
  playCards(buildBadEndingCards(), () => {
    S.seenBad = true;
    S.route = 'bad';
    S.endingDone = true;
    endFinale();
    const m8 = MILESTONES.find(x => x.id === 'M8');
    if(m8){
      if(!S.milestones.includes('M8')) S.milestones.push('M8');
      save();
      // 每次坚持走完坏结局都能触发一次「最后一次关灯」，作为小额可叠加的永久奖励
      playCards([{t:m8.title, d:m8.desc, opts:m8.opts}],
        () => { S.endingDone = true; syncCap(); save(); showEndNight(); }, true);
    } else {
      showEndNight();
    }
  }, true);
}

function playGoodEnding(){
  playCards(ENDINGS.good.map(c => ({...c})), () => {
    S.breakthrough += 1;
    S.route = 'good';
    S.endingDone = true;
    endFinale();
    syncCap();
    log('永动轮转起来了。这一夜的上限被推到 ' + fmt(S.capRun) + '。', 'hot');
    toast('突破 · 上限提高');
    renderShop(); renderRebirth(); renderShelf();
    save();
    if(S.restorePending) finishChallenge();
    showEndNight();
  }, true);
}

function showEndNight(){
  $('endnight').classList.add('on');
  updateEndNight();
}

/* 结夜没有时间门槛：碎片只看散热比，什么时候结由玩家定。
 * 唯一的前提是这一夜烧到了头（reachedCap）。 */
function updateEndNight(){
  const box = $('endnight');
  if(!box || !box.classList.contains('on')) return;
  const capped = reachedCap();

  /* 隐藏线：如果未通关却误入了结夜界面，允许退回实验室继续攒上限，绝不死锁 */
  if(S.hiddenCat && S.route !== 'good'){
    const pct = Math.min(100, (S.capRun / GOOD_STORAGE) * 100);
    $('endLines').innerHTML = '猫坐回桌角，尾巴垂着。<br>' +
      '这一夜不会结束。<span class="hi">上限 ' + fmt(S.capRun) + '</span>' +
      ' / ' + fmt(GOOD_STORAGE) + '（' + pct.toFixed(1) + '%）';
    const b = $('endnightBtn');
    b.disabled = false;
    b.textContent = '回到实验室继续准备';
    b.onclick = () => {
      S.fx = false; S.route = ''; S.endingDone = false;
      $('endnight').classList.remove('on');
      b.onclick = () => endNight(true);
      renderShop(); save();
    };
    return;
  }

  const g = fragGain();
  $('endLines').innerHTML = '天亮了。<br>这一夜到此为止。' +
    (g > 0 ? '<br><span class="hi">' + g + ' 片记忆碎片</span>' : '');
  const b = $('endnightBtn');
  b.disabled = g <= 0;
  // 到了钟形峰值就提示「现在结最划算」
  b.textContent = g > 0
    ? (atPeak() ? '结束这一夜 · 正是时候' : '结束这一夜')
    : '这一夜还没烧到头';
  b.classList.toggle('peak', g > 0 && atPeak());
}

function updateCapBanner(){
  // 特殊提示横幅已关闭，避免闪烁打扰
  const b = $('capBanner');
  if(b) b.classList.remove('on');
}

function updateFinal(){
  const btn = $('wheelLaunchBtn');
  const ds = $('wheelLaunchDesc');
  const title = $('wheelLaunchTitle');
  if(!btn || !ds || !title) return;
  if(S.fx){
    title.textContent = '永动轮已启动';
    ds.textContent = '这一夜的火已经烧到尽头了。';
    btn.disabled = true;
    btn.classList.remove('ready');
    return;
  }
  title.textContent = '尝试启动永动轮';
  const cost = finalPrice();
  const capped = atCap();
  if(S.challenge || S.hiddenCat){
    const ready = capped && storageMax() >= GOOD_STORAGE && S.ip >= cost;
    ds.textContent = ready
      ? '这一次，图纸上的每个数都严丝合缝了——按下开关吧'
      : ((S.hiddenCat ? '这一夜还不算完' : '挑战进行中') + ' · 点击查看距离突破还差多少');
    btn.disabled = false;
    btn.classList.toggle('ready', ready);
    return;
  }
  if(!capped){
    const pct = S.capRun > 0 ? Math.min(100, Math.floor(S.run / S.capRun * 100)) : 0;
    if(pct < 35) ds.textContent = '研究还远不够充分（' + pct + '%），桌上的算式还缺一大截';
    else if(pct < 75) ds.textContent = '离设想还差些火候（' + pct + '%），再多推演一会儿吧';
    else ds.textContent = '隐约摸到这一夜的边界了（' + pct + '%），再添一把柴';
    btn.disabled = true;
    btn.classList.remove('ready');
  } else if(S.ip < cost){
    ds.textContent = '这一夜似乎已经研究到尽头了……再蓄一点能量就能试机（' + fmt(S.ip) + ' / ' + fmt(cost) + '）';
    btn.disabled = true;
    btn.classList.remove('ready');
  } else {
    ds.textContent = enoughForGoodEnding()
      ? '这一次，图纸上的每个数都严丝合缝了——按下开关吧'
      : '今晚能做的都做尽了，按下开关看看结果吧';
    btn.disabled = false;
    btn.classList.add('ready');
  }
}

/* 启动 */(function init(){
  const had = load();
  if(!had){ S.cycleAt = now(); }
  syncCap();
  drawScene();
  renderSceneCaption();
  renderShop();
  renderShelf();
  renderLog();
  renderRebirth();

  if(had){
    offline();
    offlineCat();
  } else {
    log('莱顿，十九世纪末。毕业没多久的两个学生借下了学院的地下室，还带来了一只在学校里长大的猫。');
    if(!S.introSeen && typeof INTRO_CARDS !== 'undefined' && INTRO_CARDS.length){
      setTimeout(() => {
        if(!S.introSeen && !S.evtOpen){
          playCards(INTRO_CARDS, () => {
            S.introSeen = true;
            endFinale();
          }, true);
        }
      }, 260);
    }
  }
  scheduleEvent();

  // 上次在结局过场里被刷新打断。
  //
  // 旧逻辑只看 `fx && !route`，那样有两个坑：
  //   1. 坏结局播完后 route 已经是 'bad'，但玩家还没点「结束这一夜」，
  //      这时候刷新就什么都不做 —— 停在黑屏上，也点不到按钮（卡死）。
  //   2. 反过来，如果 route 还没写进去，刷新会把整段过场重播一遍。
  //
  // 现在用 endingDone 明确区分「过场播完了」和「过场没播完」：
  //   · endingDone = true  → 直接进「结束这一夜」界面
  //   · route 为空且未播完 → 补播过场
  // 救档兜底：如果旧存档在一周目隐藏小猫线里误触发了坏结局导致卡死，自动解除锁定退回实验室
  if(had && S.hiddenCat && S.fx && S.route !== 'good'){
    S.fx = false; S.route = ''; S.endingDone = false;
    save();
  }

  if(had && S.fx){
    if(S.endingDone || S.route){
      // 过场已经看过了，直接给收尾界面
      setTimeout(() => {
        if(!S.evtOpen) showEndNight();
      }, 300);
    } else if(!S.evtOpen){
      setTimeout(() => {
        if(S.fx && !S.route){
          if(enoughForGoodEnding()) playGoodEnding(); else playBadEnding();
        }
      }, 500);
    }
  }

  $('ab1').onclick = () => doAbility('ab1');
  $('ab2').onclick = () => doAbility('ab2');
  $('ab3').onclick = () => doAbility('ab3');
  for(const b of document.querySelectorAll('.tabs button'))
    b.onclick = () => switchTab(b.dataset.tab);
  for(const b of document.querySelectorAll('#shopSub button'))
    b.onclick = () => {
      shopGroup = b.dataset.g;
      for(const o of document.querySelectorAll('#shopSub button'))
        o.classList.toggle('on', o === b);
      renderShop();
    };
  for(const b of document.querySelectorAll('#bulkBar button'))
    b.onclick = () => {
      buyMode = b.dataset.b;
      for(const o of document.querySelectorAll('#bulkBar button'))
        o.classList.toggle('on', o === b);
      updateShop();
    };
  for(const b of document.querySelectorAll('#logSub button'))
    b.onclick = () => {
      logFilter = b.dataset.lf;
      for(const o of document.querySelectorAll('#logSub button'))
        o.classList.toggle('on', o === b);
      renderLog();
    };

  // 实验室滚动条
  let lastTicker = '';
  function nextTicker(){
    const el = $('ticker');
    if(!el) return;
    let pool = TICKER_LINES.base.slice();
    if(S.cycle >= 2) pool = pool.concat(TICKER_LINES.loop);
    if(S.breakthrough >= 1) pool = pool.concat(TICKER_LINES.good);
    if(pool.length > 1) pool = pool.filter(x => x !== lastTicker);
    const pick = pool[Math.floor(Math.random() * pool.length)] || '';
    lastTicker = pick;
    el.classList.add('fade');
    setTimeout(() => { el.textContent = pick; el.classList.remove('fade'); }, 220);
  }
  if($('ticker')){
    $('ticker').onclick = nextTicker;
    setTimeout(nextTicker, 1200);
    setInterval(nextTicker, 12000);
  }

  $('reBtn').onclick = () => endNight(false);
  $('capGo').onclick = buyFinal;
  if($('wheelLaunchBtn')) $('wheelLaunchBtn').onclick = buyFinal;
  $('endnightBtn').onclick = () => endNight(true);
  $('catGo').onclick = openCatLine;
  $('catHidden').onclick = openHiddenCat;
  $('catBack').onclick = closeCatView;
  $('setBtn').onclick = openSet;
  $('setClose').onclick = closeSet;
  if($('helpBtn')) $('helpBtn').onclick = openHelp;
  if($('helpClose')) $('helpClose').onclick = closeHelp;
  if($('catGuideClose')) $('catGuideClose').onclick = () => { dismissedGuideKey = currentGuideKey; $('catGuide').style.display = 'none'; };
  if($('setChangelog')) $('setChangelog').onclick = openChangelog;
  if($('changelogClose')) $('changelogClose').onclick = closeChangelog;
  if(typeof APP_VERSION !== 'undefined'){
    for(const el of document.querySelectorAll('.appVer')) el.textContent = APP_VERSION;
  }
  setUpdateBadge(hasUnseenUpdate(had));
  $('setExport').onclick = exportSave;
  $('setImport').onclick = () => $('setFile').click();
  if($('setCopyCode')) $('setCopyCode').onclick = copySaveCode;
  if($('setPasteCode')) $('setPasteCode').onclick = pasteSaveCode;
  if($('setFeedback')) $('setFeedback').onclick = () => copyText('eleanorsch@outlook.com', '已复制邮箱：eleanorsch@outlook.com');
  $('setFile').onchange = e => { if(e.target.files[0]) importSave(e.target.files[0]); };
  $('setWipe').onclick = () => {
    if(!confirm('确定清空全部存档？记忆碎片、收藏室、小猫和挑战快照都会消失。')) return;
    hardReset();
  };
  $('setChallenge').onclick = startChallenge;
  if(S.cat){ renderCat(); }

  // 后台标签页：rAF 会被冻结，用独立计时兜底
  let bgT = performance.now();
  setInterval(() => {
    const t0 = performance.now();
    if(document.hidden){
      const bdt = Math.min(5, (t0 - bgT) / 1000);
      if(bdt > 0) tick(bdt);
    }
    bgT = t0;
  }, 1000);

  setInterval(save, 5000);
  window.addEventListener('beforeunload', save);

  /* ---------- 昼夜主题 ---------- */
  const themeToggle = document.getElementById('themeToggle');
  const htmlEl = document.documentElement;
  const savedTheme = localStorage.getItem('lab_theme') || 'night';

  htmlEl.setAttribute('data-theme', savedTheme);
  updateThemeButton();

  function updateThemeButton(){
    const cur = htmlEl.getAttribute('data-theme') || 'night';
    themeToggle.textContent = cur === 'day' ? '☀' : '☾';
    themeToggle.title = cur === 'day' ? '切换到夜间' : '切换到白天';
  }

  themeToggle.addEventListener('click', () => {
    const cur = htmlEl.getAttribute('data-theme') || 'night';
    const next = cur === 'day' ? 'night' : 'day';
    htmlEl.setAttribute('data-theme', next);
    localStorage.setItem('lab_theme', next);
    updateThemeButton();
    paintedScene = -1;
    drawScene();
  });

  requestAnimationFrame(loop);
})();
