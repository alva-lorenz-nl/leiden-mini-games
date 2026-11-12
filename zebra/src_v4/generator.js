/* ===== 在线题目生成器（SAT/约束传播 + 线索精简） =====
 * 思路参考开源实现（joshhills/logic-puzzle-generator、tuchandra/zebra）：
 * 1. 随机生成一个合法解；
 * 2. 收集所有在该解下为真的候选线索；
 * 3. 以“删除后是否仍唯一解”为判据，逐条剔除冗余线索，得到最小线索集；
 * 4. 按难度补回若干线索，再用中文模板渲染成题面。
 */
const GEN = (() => {
  const N = 5;
  const FULL = (1 << N) - 1;

  /* 可复现随机数：同一 seed 在任何设备上生成同一道题 */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function popcount(x) {
    let c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  }

  /* 每个主题每类属性的“主语形式”与“谓语形式”，用于把抽象线索写成中文 */
  const PHRASE = {
    cat: {
      名字: { noun: "{v}", pred: "是{v}", q: "{v}是谁？" },
      毛色: {
        noun: "毛色是{v}的小猫",
        pred: "的毛色是{v}",
        q: "毛色是{v}的小猫是谁？",
      },
      零食: {
        noun: "爱吃{v}的小猫",
        pred: "爱吃{v}",
        q: "爱吃{v}的小猫是谁？",
      },
      活动: {
        noun: "正在{v}的小猫",
        pred: "正在{v}",
        q: "正在{v}的小猫是谁？",
      },
      窝: { noun: "窝在{v}的小猫", pred: "窝在{v}", q: "窝在{v}的小猫是谁？" },
    },
    alva: {
      人物: { noun: "{v}", pred: "是{v}", q: "{v}是谁？" },
      房间: { noun: "{v}", pred: "在{v}里", q: "{v}里的人是谁？" },
      手里东西: {
        noun: "有{v}的房间",
        pred: "有{v}",
        q: "谁在有{v}的房间里？",
        roomish: true,
      },
      状态: { noun: "正在{v}的人", pred: "正在{v}", q: "正在{v}的人是谁？" },
      饮料: { noun: "喝{v}的人", pred: "喝{v}", q: "喝{v}的人是谁？" },
    },
  };

  /* 这两类属性描述的是“房间”，与其它属性拼句时要多一层“里的人” */
  function isRoomish(themeKey, cat) {
    return cat === "房间" || !!PHRASE[themeKey][cat].roomish;
  }

  /* 语义上互斥/容易产生怪句子的属性对，不生成“同一格”线索 */
  const AVOID_SAME = [["状态", "饮料"]];

  function pairKey(a, b) {
    return [a, b].sort().join("|");
  }

  const AVOID = new Set(AVOID_SAME.map((p) => pairKey(p[0], p[1])));

  /* ---------- 约束求解：位掩码域 + 传播 + MRV 回溯，只数到 limit 个解 ---------- */
  function propagate(dom, clues, nc) {
    let changed = true;
    while (changed) {
      changed = false;
      /* 每类属性内部：每个取值恰好出现一次 */
      for (let c = 0; c < nc; c++) {
        const row = dom[c];
        for (let p = 0; p < N; p++) if (!row[p]) return false;
        for (let p = 0; p < N; p++) {
          if (popcount(row[p]) === 1) {
            for (let q = 0; q < N; q++)
              if (q !== p && row[q] & row[p]) {
                row[q] &= ~row[p];
                if (!row[q]) return false;
                changed = true;
              }
          }
        }
        /* 唯一候选：某取值只剩一个位置可放 */
        for (let v = 0; v < N; v++) {
          const bit = 1 << v;
          let only = -1,
            cnt = 0;
          for (let p = 0; p < N; p++)
            if (row[p] & bit) {
              only = p;
              cnt++;
            }
          if (!cnt) return false;
          if (cnt === 1 && popcount(row[only]) > 1) {
            row[only] = bit;
            changed = true;
          }
        }
      }
      /* 线索传播 */
      for (const cl of clues) {
        const da = dom[cl.a],
          db = dom[cl.b];
        const ba = 1 << cl.va,
          bb = 1 << cl.vb;
        if (cl.kind === "same") {
          for (let p = 0; p < N; p++) {
            if (!(da[p] & ba) && db[p] & bb) {
              db[p] &= ~bb;
              changed = true;
            }
            if (!(db[p] & bb) && da[p] & ba) {
              da[p] &= ~ba;
              changed = true;
            }
            if (da[p] === ba && db[p] !== bb) {
              db[p] = bb;
              changed = true;
            }
            if (db[p] === bb && da[p] !== ba) {
              da[p] = ba;
              changed = true;
            }
            if (!da[p] || !db[p]) return false;
          }
        } else if (cl.kind === "next") {
          for (let p = 0; p < N; p++) {
            if (!(da[p] & ba)) {
              if (p + 1 < N && db[p + 1] & bb) {
                db[p + 1] &= ~bb;
                changed = true;
              }
            }
            if (p + 1 < N && !(db[p + 1] & bb)) {
              if (da[p] & ba) {
                da[p] &= ~ba;
                changed = true;
              }
            }
            if (da[p] === ba) {
              if (p + 1 >= N) return false;
              if (db[p + 1] !== bb) {
                db[p + 1] = bb;
                changed = true;
              }
            }
            if (p + 1 < N && db[p + 1] === bb && da[p] !== ba) {
              da[p] = ba;
              changed = true;
            }
            if (!da[p] || (p + 1 < N && !db[p + 1])) return false;
          }
        } else if (cl.kind === "left") {
          for (let p = 0; p < N; p++) {
            if (da[p] === ba) {
              for (let q = 0; q <= p; q++)
                if (db[q] & bb) {
                  db[q] &= ~bb;
                  changed = true;
                  if (!db[q]) return false;
                }
            }
            if (db[p] === bb) {
              for (let q = p; q < N; q++)
                if (da[q] & ba) {
                  da[q] &= ~ba;
                  changed = true;
                  if (!da[q]) return false;
                }
            }
          }
        }
      }
    }
    return true;
  }

  function countSolutions(nc, clues, limit) {
    const dom = [];
    for (let c = 0; c < nc; c++) dom.push(new Array(N).fill(FULL));
    /* pos 线索先落地 */
    for (const cl of clues)
      if (cl.kind === "pos") {
        dom[cl.a][cl.p] = 1 << cl.va;
      }
    if (!propagate(dom, clues, nc)) return 0;

    let count = 0;
    function dfs(d) {
      let bestC = -1,
        bestP = -1,
        bestCnt = 99;
      for (let c = 0; c < nc; c++)
        for (let p = 0; p < N; p++) {
          const k = popcount(d[c][p]);
          if (!k) return;
          if (k > 1 && k < bestCnt) {
            bestCnt = k;
            bestC = c;
            bestP = p;
          }
        }
      if (bestC < 0) {
        count++;
        return;
      }
      const row = d[bestC];
      for (let v = 0; v < N; v++) {
        if (!((row[bestP] >> v) & 1)) continue;
        const nd = d.map((r) => r.slice());
        nd[bestC][bestP] = 1 << v;
        if (!propagate(nd, clues, nc)) continue;
        dfs(nd);
        if (count >= limit) return;
      }
    }
    dfs(dom);
    return count;
  }

  /* ---------- 中文渲染 ---------- */
  function fill(tpl, v) {
    return tpl.replace("{v}", v);
  }

  function posText(p) {
    const fromStart = p + 1,
      fromEnd = N - p;
    return fromEnd < fromStart
      ? `倒数第${fromEnd}个位置`
      : `第${fromStart}个位置`;
  }

  function clueText(cl, ctx) {
    const { cats, valOf, themeKey } = ctx;
    const ph = PHRASE[themeKey];
    const noun = (ci, vi) => fill(ph[cats[ci]].noun, valOf(ci, vi));
    const pred = (ci, vi) => fill(ph[cats[ci]].pred, valOf(ci, vi));
    const answerCat = cats[0];
    if (cl.kind === "pos") return `${noun(cl.a, cl.va)}在${posText(cl.p)}。`;
    if (cl.kind === "same") {
      const A = cats[cl.a],
        B = cats[cl.b];
      if (isRoomish(themeKey, A)) {
        if (B === answerCat)
          return `${noun(cl.a, cl.va)}里的人就是${valOf(cl.b, cl.vb)}。`;
        if (isRoomish(themeKey, B))
          return `${noun(cl.a, cl.va)}就是${noun(cl.b, cl.vb)}。`;
        return `${noun(cl.a, cl.va)}里的人${pred(cl.b, cl.vb)}。`;
      }
      if (isRoomish(themeKey, B))
        return `${noun(cl.a, cl.va)}在${noun(cl.b, cl.vb)}里。`;
      if (B === answerCat)
        return `${noun(cl.a, cl.va)}就是${valOf(cl.b, cl.vb)}。`;
      if (A === answerCat) return `${valOf(cl.a, cl.va)}${pred(cl.b, cl.vb)}。`;
      return `${noun(cl.a, cl.va)}${pred(cl.b, cl.vb)}。`;
    }
    if (cl.kind === "next")
      return `${noun(cl.a, cl.va)}的右边紧挨着${noun(cl.b, cl.vb)}。`;
    return `${noun(cl.a, cl.va)}在${noun(cl.b, cl.vb)}的左边（不一定相邻）。`;
  }

  function rawOf(cl, ctx) {
    const { cats, valOf } = ctx;
    if (cl.kind === "pos")
      return ["pos", cats[cl.a], valOf(cl.a, cl.va), cl.p + 1];
    return [
      cl.kind,
      cats[cl.a],
      valOf(cl.a, cl.va),
      cats[cl.b],
      valOf(cl.b, cl.vb),
    ];
  }

  /* ---------- 生成一道题 ---------- */
  function make(themeKey, diff, seed) {
    const rnd = mulberry32(seed >>> 0);
    const meta = META[themeKey];
    const allCats = Object.keys(meta.cats);
    const answerCat = allCats[0];
    const cats = [answerCat, ...shuffle(allCats.slice(1), rnd).slice(0, 3)];
    const nc = cats.length;

    /* 随机解：每类属性一个排列 */
    const sol = {};
    cats.forEach((c) => (sol[c] = shuffle([0, 1, 2, 3, 4], rnd)));
    const posOf = {};
    cats.forEach((c) => {
      posOf[c] = [];
      sol[c].forEach((v, p) => (posOf[c][v] = p));
    });

    /* 候选线索池：全部在该解下为真 */
    const pool = [];
    const posValues = shuffle([0, 1, 2, 3, 4], rnd).slice(0, 3);
    for (const v of posValues)
      pool.push({ kind: "pos", a: 0, va: v, p: posOf[answerCat][v] });
    for (let i = 0; i < nc; i++)
      for (let j = i + 1; j < nc; j++) {
        if (AVOID.has(pairKey(cats[i], cats[j]))) continue;
        for (let va = 0; va < N; va++)
          for (let vb = 0; vb < N; vb++)
            if (posOf[cats[i]][va] === posOf[cats[j]][vb])
              pool.push({ kind: "same", a: i, va, b: j, vb });
      }
    const nx = [],
      lf = [];
    for (let i = 0; i < nc; i++)
      for (let j = 0; j < nc; j++) {
        if (i === j) continue;
        for (let va = 0; va < N; va++)
          for (let vb = 0; vb < N; vb++) {
            const d = posOf[cats[j]][vb] - posOf[cats[i]][va];
            if (d === 1) nx.push({ kind: "next", a: i, va, b: j, vb });
            else if (d > 1) lf.push({ kind: "left", a: i, va, b: j, vb });
          }
      }
    pool.push(...shuffle(nx, rnd).slice(0, 24));
    pool.push(...shuffle(lf, rnd).slice(0, 30));

    /* 同一句话只留一条，避免题面出现重复线索 */
    const ctx = {
      cats,
      sol,
      themeKey,
      /* vi 是“取值序号”，直接查名字表；sol 只负责“位置→取值序号” */
      valOf: (ci, vi) => meta.cats[cats[ci]][vi],
    };
    const seenText = new Set();
    const poolUniq = pool.filter((cl) => {
      const t = clueText(cl, ctx);
      if (seenText.has(t)) return false;
      seenText.add(t);
      return true;
    });
    pool.length = 0;
    pool.push(...poolUniq);

    /* 先确认整池线索足以定解；不够就把剩下的位置线索补回来 */
    let keep = pool.map((_, i) => i);
    if (countSolutions(nc, pool, 2) !== 1) {
      for (let v = 0; v < N; v++) {
        if (posValues.includes(v)) continue;
        pool.push({ kind: "pos", a: 0, va: v, p: posOf[answerCat][v] });
        if (countSolutions(nc, pool, 2) === 1) break;
      }
      keep = pool.map((_, i) => i);
    }

    /* 逐条剔除冗余线索：删掉后仍唯一，就永久删掉 */
    for (const idx of shuffle(keep, rnd)) {
      if (keep.length <= 4) break;
      const trial = keep.filter((i) => i !== idx);
      if (
        countSolutions(
          nc,
          trial.map((i) => pool[i]),
          2,
        ) === 1
      )
        keep = trial;
    }

    /* 按难度补回线索：简单多给、困难只给最小集 */
    const spareRank = { same: 0, next: 1, left: 2, pos: 3 };
    const spare = shuffle(
      pool.filter((_, i) => !keep.includes(i)),
      rnd,
    ).sort((x, y) => spareRank[x.kind] - spareRank[y.kind]);
    const extra =
      diff === "easy" ? 5 : diff === "normal" ? 3 : diff === "medium" ? 1 : 0;
    const chosen = keep.map((i) => pool[i]).concat(spare.slice(0, extra));

    /* 排序：位置 → 同格 → 相邻 → 左右，读起来顺一点 */
    chosen.sort((x, y) => rank(x.kind) - rank(y.kind));

    const question = (() => {
      const qi = 1 + Math.floor(rnd() * (nc - 1));
      const p = Math.floor(rnd() * N);
      const cat = cats[qi],
        val = meta.cats[cat][sol[cat][p]];
      return {
        q: fill(PHRASE[themeKey][cat].q, val),
        a: { position: p + 1, value: meta.cats[answerCat][sol[answerCat][p]] },
      };
    })();

    const categories = {};
    cats.forEach((c) => (categories[c] = meta.cats[c].slice()));

    return {
      id: `gen-${themeKey}-${diff}-${(seed >>> 0).toString(36)}`,
      theme_key: themeKey,
      theme: meta.title,
      intro: meta.intro,
      difficulty: diff,
      categories,
      clue_count: chosen.length,
      clues: chosen.map((cl) => clueText(cl, ctx)),
      rawClues: chosen.map((cl) => rawOf(cl, ctx)),
      question: question.q,
      answer: question.a,
      solution: Object.fromEntries(
        cats.map((c) => [c, sol[c].map((v) => meta.cats[c][v])]),
      ),
    };
  }

  function rank(kind) {
    return { pos: 0, same: 1, next: 2, left: 3 }[kind] ?? 9;
  }

  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /* 每日题：由日期派生种子，任何设备打开都是同一道 */
  function daily(dateKey) {
    const seed = hashSeed("zebra-daily-" + dateKey);
    const themes = Object.keys(META);
    const diffs = ["easy", "normal", "hard"];
    const themeKey = themes[seed % themes.length];
    const diff = diffs[(seed >>> 5) % diffs.length];
    const p = make(themeKey, diff, seed);
    p.id = "gen-daily-" + dateKey;
    return { ...p, date: dateKey };
  }

  return { make, daily, countSolutions, hashSeed };
})();
