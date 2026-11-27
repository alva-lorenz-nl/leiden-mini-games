// balance.js - 所有数值、成本、增长率、挑战与成就配置表（v1.4 经典放置向重平衡）
const BALANCE = {
  version: 'v3.2.6',
  saveKey: 'luca_perpetual_game_save_v1',

  defaultTuning: {
    growthMult: 1.0,
    thesisReq: 2.5e7,
    defenseReq: 10000,
    timeScale: 1
  },

  tickspeed: {
    baseCost: 1000,
    costMult: 10,
    baseStep: 1.12,
    reportStepBonus: 0.015,
    maxStep: 1.35
  },

  units: [
    { id: 'hamster',        layerGroup: 'L1', baseCost: 15,     r: 1.15, baseEpS: 0.16 },
    { id: 'butteredCat',    layerGroup: 'L1', baseCost: 250,    r: 1.16, baseEpS: 1.3 },
    { id: 'drinkingBird',   layerGroup: 'L1', baseCost: 4.5e3,  r: 1.17, baseEpS: 14 },
    { id: 'leydenJar',      layerGroup: 'L2', baseCost: 9.0e4,  r: 1.18, baseEpS: 180 },
    { id: 'teslaCoil',      layerGroup: 'L2', baseCost: 2.0e6,  r: 1.19, baseEpS: 2.7e3 },
    { id: 'pidLoop',        layerGroup: 'L3', baseCost: 5.0e7,  r: 1.20, baseEpS: 4.5e4 },
    { id: 'maxwellDemon',   layerGroup: 'L3', baseCost: 1.5e9,  r: 1.21, baseEpS: 9.0e5 },
    { id: 'rlAgent',        layerGroup: 'L4', baseCost: 5.0e10, r: 1.22, baseEpS: 2.0e7 },
    { id: 'superconductor', layerGroup: 'L4', baseCost: 2.0e12, r: 1.24, baseEpS: 5.0e8 },
    { id: 'quantumCore',    layerGroup: 'L4', baseCost: 1.0e14, r: 1.26, baseEpS: 1.4e10 }
  ],

  labUpgrades: [
    { id: 'lu_sunflowerOil', cost: 150,    reqUnit: 'hamster',        reqCount: 5 },
    { id: 'lu_borrowCat',    cost: 1800,   reqUnit: 'butteredCat',    reqCount: 1 },
    { id: 'lu_warmWater',    cost: 1.5e4,  reqUnit: 'drinkingBird',   reqCount: 1 },
    { id: 'lu_freezeDried',  cost: 4.0e4,  reqUnit: 'butteredCat',    reqCount: 10 },
    { id: 'lu_leydenCat',    cost: 5.0e5,  reqUnit: 'leydenJar',      reqCount: 1 },
    { id: 'lu_birdHumidity', cost: 1.5e6,  reqUnit: 'drinkingBird',   reqCount: 10 },
    { id: 'lu_teslaArc',     cost: 1.5e7,  reqUnit: 'teslaCoil',      reqCount: 1 },
    { id: 'lu_pidTune',      cost: 3.0e8,  reqUnit: 'pidLoop',        reqCount: 1 },
    { id: 'lu_demonNotes',   cost: 1.2e10, reqUnit: 'maxwellDemon',   reqCount: 1 },
    { id: 'lu_pidMaxwell',   cost: 3.5e10, reqUnit: 'pidLoop',        reqCount: 10 },
    { id: 'lu_rlGpu',        cost: 4.0e11, reqUnit: 'rlAgent',        reqCount: 1 },
    { id: 'lu_liquidHelium', cost: 1.5e13, reqUnit: 'superconductor', reqCount: 1 },
    { id: 'lu_vacuumShield', cost: 8.0e14, reqUnit: 'quantumCore',    reqCount: 1 }
  ],

  rpUpgrades: [
    { id: 'u_frame',     tier: 'T1', cost: 1 },
    { id: 'u_wire',      tier: 'T1', cost: 1 },
    { id: 'u_wholesale', tier: 'T1', cost: 2 },
    { id: 'u_error',     tier: 'T2', cost: 3 },
    { id: 'u_synergy',   tier: 'T2', cost: 5 },
    { id: 'u_fury',      tier: 'T2', cost: 6 },
    { id: 'u_coffee',    tier: 'T2', cost: 8 },
    { id: 'u_cans',      tier: 'T3', cost: 8 },
    { id: 'u_refs',      tier: 'T3', cost: 15 },
    { id: 'u_pride',     tier: 'T3', cost: 25 },
    { id: 'u_thick',     tier: 'T3', baseCost: 10, repeatable: true, costMult: 4 },
    { id: 'u_break',     tier: 'T4', cost: 50 }
  ],

  autoIntervals: [5.0, 2.0, 0.5, 0.1],
  autoSpeedCosts: [2, 5, 15],

  automators: [
    { id: 'auto_L1',        layerGroup: 'L1',  cost: 1 },
    { id: 'auto_L2',        layerGroup: 'L2',  cost: 3 },
    { id: 'auto_tickspeed', isTickspeed: true, cost: 4 },
    { id: 'auto_L3',        layerGroup: 'L3',  cost: 8 },
    { id: 'auto_L4',        layerGroup: 'L4',  cost: 18 },
    { id: 'auto_report',    isReport: true,    cost: 25 }
  ],

  randomEvents: [
    { id: 'ev_catRub',       duration: 20, epsMult: 5, clickMult: 2 },
    { id: 'ev_alvaInspect',  duration: 15, epsMult: 3, instantSec: 25 },
    { id: 'ev_lightbulb',    duration: 15, clickMult: 20 },
    { id: 'ev_fishTreat',    duration: 25, epsMult: 4 },
    { id: 'ev_goldenCookie', duration: 30, epsMult: 7 }
  ],

  defenseMilestones: [1, 2, 4, 8, 15],

  paradigms: [
    { id: 'p_ai1',  branch: 'ai',  costTT: 1, req: null },
    { id: 'p_ai2',  branch: 'ai',  costTT: 2, req: 'p_ai1' },
    { id: 'p_cyb1', branch: 'cyb', costTT: 1, req: null },
    { id: 'p_cyb2', branch: 'cyb', costTT: 2, req: 'p_cyb1' },
    { id: 'p_cat1', branch: 'cat', costTT: 1, req: null },
    { id: 'p_cat2', branch: 'cat', costTT: 3, req: 'p_cat1' }
  ],

  emUnits: ['leydenJar', 'teslaCoil', 'superconductor'],

  challenges: [
    { id: 'ec1', maxComp: 5, goals: [1e5, 1e8, 1e12, 1e17, 1e23] },
    { id: 'ec2', maxComp: 5, goals: [5e5, 5e9, 5e14, 5e20, 5e28] },
    { id: 'ec3', maxComp: 5, goals: [1e7, 1e12, 1e18, 1e25, 1e34] },
    { id: 'ec4', maxComp: 5, goals: [1e9, 1e15, 1e22, 1e30, 1e40] }
  ],

  physicsMilestones: [
    { id: 'pm_kcal', energy: 4.18e3 },
    { id: 'pm_kwh',  energy: 3.60e6 },
    { id: 'pm_gw',   energy: 1.21e9 },
    { id: 'pm_avog', energy: 6.02e23 }
  ],

  achievementBonus: 0.02,

  achievements: [
    // --- 常规实验、新机制与挑战成就（14 项） ---
    { id: 'ach_first_hamster', cat: 'main',   hasCG: false, cgImg: '' },
    { id: 'ach_first_reject',  cat: 'main',   hasCG: false, cgImg: '' },
    { id: 'ach_cat_caught',    cat: 'main',   hasCG: true,  cgImg: '' },
    { id: 'ach_crit_master',   cat: 'main',   hasCG: false, cgImg: '' },
    { id: 'ach_only_cat',      cat: 'main',   hasCG: false, cgImg: '' },
    { id: 'ach_tickspeed_10',  cat: 'main',   hasCG: false, cgImg: '' },
    { id: 'ach_sacrifice',     cat: 'main',   hasCG: false, cgImg: '' },
    { id: 'ach_theme_switch',  cat: 'main',   hasCG: false, cgImg: '' },
    { id: 'ach_coauthor',      cat: 'main',   hasCG: false, cgImg: '' },
    { id: 'ach_em_dignity',    cat: 'main',   hasCG: true,  cgImg: '' },
    { id: 'ach_ai_off',        cat: 'main',   hasCG: true,  cgImg: '' },
    { id: 'ach_quantum',       cat: 'main',   hasCG: false, cgImg: '' },
    { id: 'ach_ec_all',        cat: 'main',   hasCG: false, cgImg: '' },
    { id: 'ach_cat_advisor',   cat: 'main',   hasCG: true,  cgImg: '' },

    // --- 致敬放置神作、Meta 与隐藏彩蛋成就（19 项） ---
    { id: 'ach_ad_5hours',     cat: 'easter', hasCG: false, cgImg: '' },
    { id: 'ach_ad_9th',        cat: 'easter', hasCG: false, cgImg: '' },
    { id: 'ach_ad_infinity',   cat: 'easter', hasCG: false, cgImg: '' },
    { id: 'ach_ad_pointless',  cat: 'easter', hasCG: false, cgImg: '' },
    { id: 'ach_cc_cookie',     cat: 'easter', hasCG: false, cgImg: '' },
    { id: 'ach_useless_am',    cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_kg_forest',     cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_up_paperclip',  cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_ad_news_click', cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_quiet_cat',        cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_no_sleep',         cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_fell_asleep',      cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_reviewer2',        cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_schrodinger_save', cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_zeno_turtle',      cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_absolute_zero',    cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_occam_razor',      cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_stamp_click',      cat: 'easter', hasCG: false, cgImg: '', hidden: true },
    { id: 'ach_throw_energy',     cat: 'easter', hasCG: false, cgImg: '', hidden: true }
  ]
};
