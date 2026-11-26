/* ============================================================
   scene.js — 像素画布渲染（实验室 6 场景 + 小猫的小鱼工厂）
   ============================================================ */

/* ============================================================
   像素场景
   ============================================================ */
const W=192, H=108;
const sceneCv = document.getElementById('scene');
const sctx = sceneCv.getContext('2d');
sctx.imageSmoothingEnabled = false;

const off = document.createElement('canvas');
off.width=W; off.height=H;
const octx = off.getContext('2d');
octx.imageSmoothingEnabled = false;

let anim = [];   // 动画元素

function R(g,x,y,w,h,c){ g.fillStyle=c; g.fillRect(x|0,y|0,w|0,h|0); }
function line(g,x0,y0,x1,y1,c){
  g.fillStyle=c;
  let dx=Math.abs(x1-x0), dy=Math.abs(y1-y0);
  let sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx-dy;
  let x=x0, y=y0;
  for(let i=0;i<400;i++){
    g.fillRect(x|0,y|0,1,1);
    if(x===x1 && y===y1) break;
    const e2=err*2;
    if(e2 > -dy){ err-=dy; x+=sx; }
    if(e2 < dx){ err+=dx; y+=sy; }
  }
}
function glow(g,cx,cy,r,c1,c2){
  const lg=g.createRadialGradient(cx,cy,2,cx,cy,r);
  lg.addColorStop(0,c1); lg.addColorStop(1,c2);
  g.fillStyle=lg; g.fillRect(cx-r,cy-r,r*2,r*2);
}
function vig(g,a){
  const vg=g.createRadialGradient(96,56,34,96,56,124);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,'+a+')');
  g.fillStyle=vg; g.fillRect(0,0,W,H);
}

/* ---------- 猫：矢量贴图 ---------- */
/* 在 1× 分辨率下直接绘制曲线，再靠 CSS 的 pixelated 放大，线条不会糊 */
const CAT_SKIN = {fur:'#f8f1e5', line:'#241e2a', ear:'#e8a2ac', nose:'#d98f8f'};

// 小猫：直接用素材包里的像素猫（原图朝右，绘制时水平翻转）
const CAT_PNG = {
  sit: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAyklEQVR4nJ2TsRHDIAxFv+hcu/QqWSoLZJWs4NojZIoUpjMtlEqRCBOCBJd35/Mhie8vnQx8YGaGQS/vyiKtuJfPQgAQ1w0+JHADHxLiulmGTiEAWOYJAOBD+npLvAsz837ElpmM5E2RksvtaZ41MUdENOb7jVpfWxce13uzNbM9EdTm1J3PiIgmVrtzben+hwHkvRt203JVx2io9woi+rnnxOIIUleKSEydkSVe/kLLPJ271ZqTdt6PmJ/SWd7Sf2elJsv9qHfF4gXsWNrsDQpYlQAAAABJRU5ErkJggg==',
  loaf: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAQCAYAAAD52jQlAAAA0UlEQVR4nJ1TsRGDMAx801FTskqWygJZJStQM0KmSBHfkbuYdDid0sRCYAvb+QaQ8PP/EsAPREQ4QK4v0cgD2sFcP0kKAMswwjoPSsA6j2UYS4WupADQdy0AwDq/uYZ6FYiIHq8lJZIR+sWEEqfL/fA5hci+McaUOnq+P6qwpNK9/dv5GtmfZk/T7Mui0Yj39aPcJTFP3zqvTrnvWt6EEjT5V7bQyMOHOYZau7k6Tz4K+g8HIT62v1+t1Kpp1mW9ZkUBrH+etC/vmbiKFXpMUuEXE5DSRBb3lNwAAAAASUVORK5CYII=',
  sit_c: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAxklEQVR42qVUuRGEMAxcOyMmpAiKoA6KuIquBWJKuDpwhlM71CWIMz7Z8sDOeBhWz6zkBeAAEREq0OI2TSola/GzEQCEZYXzESTA+YiwrFAVMYa+AwA4Hy9P5lUQEW17oBo4XuphtCWKRcaYv9FScp5GzNN4Scg5qck5ljTa5/UWR1MnqO1J28+jZefqLG6AG7DvmtVIqnLu9vXndTZ1sAbOS5swZ7WiWsz5iKHvft6S9lR63/ZwnlSZaf3ftH4qkPzR5OQDX8jgsSO+KFJbAAAAAElFTkSuQmCC',
  loaf_c: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAQCAYAAAD52jQlAAAAzElEQVR42p1TuRGDMBBckRETUgRFUAdFuCK3QEwJrsOawTMWziRn58TSHKDTwyYSe3Mr9h7gDyIiJJCLczQ8QUrMxaOiAGDnBdo4UATaONh5QdWfevRdCwDQxu1Oz1eBiOj5tpSCj5foqZoGiCJKqZ19TkzjgGkcdgmce32+ZZNxtOfxuN1P9tfN0bq5stJIwkc+VXcuHLqvjRO73HdtmITqkSqBJO4fDmWotZvj1ZXdlhz48jXSrB2/U9Y5H8sr2jxun9+D8JWVzm3VD52TmIuz32f4AAAAAElFTkSuQmCC'
};
const CAT_H = {sit:18, loaf:16, walk:18};
const CAT_PRELOAD = {};
for(const k in CAT_PNG){ const im = new Image(); im.src = CAT_PNG[k]; CAT_PRELOAD[k] = im; }

function catSprite(pose, closed){
  const base = CAT_PNG[pose] ? pose : 'sit';
  const key = closed && CAT_PNG[base + '_c'] ? (base + '_c') : base;
  return CAT_PRELOAD[key];
}

const CAT_IMG = {};

// 把环境色烘进精灵：白猫在昏黄屋子里不能是纯白，否则像贴上去的
function tintSprite(img, color){
  const w = img.width || 18, h = img.height || 18;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = color;
  c.fillRect(0, 0, w, h);
  cv.__src = img.src;      // 给离屏渲染器留的标记
  cv.__tint = color;
  return cv;
}

// 三档环境色：越往后（讲堂、陈列馆）屋子里越亮，猫也跟着亮
const CAT_TINTS = ['rgba(58,38,20,0.46)','rgba(76,56,34,0.30)','rgba(102,82,56,0.16)'];

function catLit(){
  const isDay = document.documentElement.getAttribute('data-theme') === 'day';
  if(isDay) return S.scene >= 3 ? 2 : 1;
  if(S.scene < 4) return 0;
  const d = sceneDetail();
  return d < 0.34 ? 0 : (d < 0.67 ? 1 : 2);
}

function catImage(pose, closed, lit){
  const L = lit || 0;
  const k = pose + (closed ? '_c' : '') + '_' + L;
  if(!CAT_IMG[k]){
    const raw = catSprite(pose, closed);
    // 贴图没加载完就先返回原图，别把空画布缓存下来
    if(!raw || !raw.complete || !raw.naturalWidth) return raw;
    CAT_IMG[k] = tintSprite(raw, CAT_TINTS[L]);
  }
  return CAT_IMG[k];
}

/* 放一只猫，并登记眨眼 / 尾巴（y 沿用旧点阵的基线，底部对齐） */
function drawCatImg(g, img, x, y, noShadow){
  const w = img.width || 18, h = img.height || 18;
  // 落地投影：压住猫，别让它飘在桌面上（卧在窝里时不画，窝本身就是承托）
  if(!noShadow){
  g.save();
  g.fillStyle = 'rgba(0,0,0,.48)';
  g.beginPath();
  g.ellipse(x + w * 0.5, y + h - 2, w * 0.50, 2.6, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  }
  // 原图朝右，绘制时水平翻转
  g.save();
  g.translate(x + w, y);
  g.scale(-1, 1);
  g.drawImage(img, 0, 0);
  g.restore();
}

function putCat(g, x, y, pose, sc, inBed){
  const oldH = pose === 'loaf' ? 7 : pose === 'walk' ? 12 : 14;
  const img = catImage(pose, false, catLit());
  const h = CAT_H[pose] || 18;
  const ox = x + 8 - Math.round((img.width || 18)/2), oy = y + oldH - h;
  drawCatImg(g, img, ox, oy, !!inBed);
  anim.push({type:'cat', pose, img, ox, oy, inBed: !!inBed,
             nextBlink: 1600 + Math.random()*3000, blinkUntil: 0,
             tailPhase: Math.random()*6.28});
}

/* ============================================================
   场景绘制
   —— 只画环境，不画人。
   —— d 是本周目的"家当程度"（0~1），同一场景内加小件；
      换大件（整场景切换）由 S.scene 决定。
   ============================================================ */

function wear(g, n, seed){
  let s = seed;
  for(let i=0;i<n;i++){
    s = (s*1103515245 + 12345) & 0x7fffffff;
    const x = s % W;
    s = (s*1103515245 + 12345) & 0x7fffffff;
    const y = s % 76;
    R(g, x, y, 1, 1, '#1d1712');
  }
}

/* 每个场景几个猫待着的地方，刷新时随机挑一个 */
const CAT_SPOTS = [
  [ {x:146,y:66,pose:'sit'},  {x:42,y:66,pose:'sit'},  {x:156,y:91,pose:'loaf',bed:1} ],
  [ {x:150,y:66,pose:'sit'},  {x:38,y:66,pose:'sit'},  {x:156,y:91,pose:'loaf',bed:1} ],
  [ {x:150,y:66,pose:'sit'},  {x:36,y:74,pose:'sit'},  {x:156,y:92,pose:'loaf',bed:1} ],
  [ {x:38,y:66,pose:'sit'},   {x:152,y:66,pose:'sit'}, {x:156,y:92,pose:'loaf',bed:1} ],
  [ {x:64,y:68,pose:'sit'},   {x:26,y:68,pose:'sit'},  {x:156,y:93,pose:'loaf',bed:1} ],
  [ {x:150,y:68,pose:'sit'},  {x:70,y:68,pose:'sit'},  {x:156,y:93,pose:'loaf',bed:1} ]
];
const catPick = [];
function catSpot(){
  const i = S.scene;
  if(catPick[i] === undefined) catPick[i] = Math.floor(Math.random() * CAT_SPOTS[i].length);
  return CAT_SPOTS[i][catPick[i]];
}
function patrolCat(){
  const i = S.scene;
  const list = CAT_SPOTS[i];
  if(!list || list.length <= 1) return;
  const cur = catPick[i] || 0;
  catPick[i] = (cur + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
  drawScene();
}

/* 同人标志物：阿尔瓦的淡紫色缎带与账本、赫尔曼的棕绿条纹外套与绿宝石胸针 */
function drawAlvaProps(g, x, y){
  // 摊开的账本 + 红笔批注
  R(g, x,   y+2, 11, 4, '#cfc6b0');
  R(g, x+1, y+2, 9,  1, '#ede5d2');
  R(g, x+5, y+2, 1,  4, '#8a7a62');
  R(g, x+2, y+4, 2,  1, '#b84a39');
  // 母亲留下的淡紫色缎带（放在账本旁）
  R(g, x+13, y+3, 4, 3, '#b894c8');
  R(g, x+14, y+4, 2, 1, '#241c15');
}
function drawHermannCoat(g, x, y){
  // 椅背/架上搭着的棕绿条纹外套 + 领结绿宝石反光
  R(g, x,   y,   9, 13, '#3c4a38');
  R(g, x+2, y,   1, 13, '#584432');
  R(g, x+6, y,   1, 13, '#584432');
  R(g, x+1, y+1, 7, 1,  '#4f6149');
  // 领结上的绿宝石胸针微光
  R(g, x+4, y+2, 2, 2,  '#52c97a');
  anim.push({type:'gem', x:x+4, y:y+2});
}
/* 猫窝：浅口藤篮 + 垫子 */
// 猫窝的档次：随场景推进，越往后越讲究
function bedTier(){
  const base = Math.floor(S.scene / 2);                  // 0,0,1,1,2,2
  return Math.min(2, base + (sceneDetail() > 0.65 ? 1 : 0));
}

function drawBowl(g, x, y){
  // 猫饭碗：浅碟 + 里面一点吃的
  R(g, x,   y+3, 11, 3, '#7a6248');
  R(g, x+1, y+3, 9, 1, '#a8895f');
  R(g, x+2, y+1, 7, 2, '#3f3a34');
  R(g, x+3, y+1, 5, 1, '#c0a279');
  R(g, x+4, y+2, 3, 1, '#8a6a45');
  R(g, x+1, y+6, 9, 1, '#3a2d22');
}

function drawBed(g, cx, by){
  const x = Math.round(cx) - 15;
  const tier = bedTier();

  // 篮底
  R(g, x+3, by+7, 24, 3, '#3a2d22');
  // 篮身（前低后高的浅口）
  R(g, x+1, by+4, 28, 4, '#6a5235');
  R(g, x+1, by+4, 28, 1, '#8a6a45');
  R(g, x+2, by+8, 26, 1, '#4a3a2c');
  // 篮口
  R(g, x,   by+3, 30, 2, '#8a6a45');
  R(g, x,   by+3, 30, 1, '#a07c52');
  // 垫子
  R(g, x+3, by,   24, 3, '#a88a62');
  R(g, x+5, by+1, 20, 2, '#c0a279');

  // 第二级：旁边多一只饭碗
  if(tier >= 1) drawBowl(g, x - 13, by + 2);

  // 第三级：篮沿搭一条毯子，脚边一个球
  if(tier >= 2){
    R(g, x+6,  by+4, 11, 4, '#8a4040');
    R(g, x+6,  by+4, 11, 1, '#a55252');
    R(g, x+6,  by+7, 11, 1, '#6a3030');
    R(g, x+18, by+5, 5, 5, '#c9a227');
    R(g, x+19, by+4, 3, 1, '#e0c060');
    R(g, x+19, by+9, 3, 1, '#a8851f');
  }
}
function drawCatIn(g){
  // 窝一直在，猫不在的时候也摆在那儿
  const bed = CAT_SPOTS[S.scene].find(s => s.bed);
  if(bed) drawBed(g, bed.x + 8, bed.y + 2);
  const sp = catSpot();
  putCat(g, sp.x, sp.y, sp.pose, 1, !!sp.bed);
}

/* ---------------- 场景 0/1：出租屋 ---------------- */
function drawRoom(g, d, detail){
  R(g,0,0,W,H,'#181310');
  // 墙
  R(g,0,0,W,80,'#2b2119');
  for(let x=0;x<W;x+=12) R(g,x,0,1,80,'#241b14');
  for(let y=8;y<70;y+=15) for(let x=7;x<W;x+=15) R(g,x,y,1,1,'#33271d');
  wear(g, 26, 7);
  // 护墙板
  R(g,0,66,W,12,'#241c15');
  R(g,0,66,W,1,'#3a2d22');
  for(let x=0;x<W;x+=12) R(g,x,67,1,11,'#1b1510');

  // 地板（提亮一层，能看出木条）
  R(g,0,78,W,H-78,'#2a2019');
  R(g,0,78,W,1,'#4a3a2c');
  for(let i=1;i<6;i++){ const y=78+i*6; R(g,0,y,W,1,'#1f1811'); }
  for(let i=0;i<9;i++){ const x=i*24+6; line(g,x,79,x-14,H,'#191309'); }
  for(let i=0;i<30;i++) R(g,(i*37)%W, 82+((i*13)%24), 3,1,'#332619');

  // 窗
  R(g,10,12,44,34,'#3d3229');
  R(g,12,14,40,30,'#121a26');
  R(g,32,14,1,30,'#3d3229'); R(g,12,29,40,1,'#3d3229');
  const sky = ['#1b2740','#22304a','#2a3a52'];
  for(let i=0;i<3;i++) R(g,12,14+i*10,40,10,sky[i]);
  R(g,20,22,2,2,'#e8c88a'); R(g,43,18,1,1,'#a8b4c8');
  R(g,26,34,1,1,'#8a94a8'); R(g,38,26,1,1,'#8a94a8');
  // 窗台 + 书
  R(g,8,46,48,3,'#4c3b2d');
  R(g,9,44,3,2,'#8a4a3a'); R(g,12,43,3,3,'#4a5a7a'); R(g,15,44,2,2,'#8a6a45');
  R(g,40,44,4,2,'#6a5a45');

  // 挂钟：木壳 + 方形表盘 + 摆锤窗
  R(g,148,7,18,26,'#3a2d20');
  R(g,150,9,14,22,'#4c3b2d');
  R(g,150,9,14,1,'#5c4a38');
  R(g,150,9,1,22,'#5c4a38');
  // 表盘
  R(g,152,11,10,10,'#d8cfbb');
  R(g,152,11,10,1,'#e6ddc9');
  // 刻度
  R(g,156,12,1,1,'#a89e88'); R(g,156,19,1,1,'#a89e88');
  R(g,153,15,1,1,'#a89e88'); R(g,160,15,1,1,'#a89e88');
  // 指针
  R(g,156,13,1,3,'#3b3339');
  R(g,157,15,3,1,'#3b3339');
  R(g,156,15,1,1,'#8a2f22');
  // 摆锤窗（摆锤在动画里左右慢摆）
  R(g,152,22,10,7,'#241c15');
  anim.push({type:'pendulum', cx:156, cy:23, len:4});

  // 门
  R(g,158,34,34,44,'#3b2f26');
  R(g,160,36,30,40,'#4a3b2e');
  R(g,160,36,30,1,'#5c4a38');
  R(g,186,54,2,3,'#c9a227');

  // 左桌：演算纸（有字）、书摞、墨水瓶、笔
  R(g,10,60,70,4,'#5a4535'); R(g,10,60,70,1,'#6e5442');
  R(g,14,64,3,16,'#4a3a2c'); R(g,74,64,3,16,'#4a3a2c');
  // 底下一张（露边）
  R(g,17,58,28,3,'#b8ad95');
  // 上面一张
  R(g,16,51,28,8,'#ded4bf'); R(g,16,51,28,1,'#f0e7d4'); R(g,16,51,1,8,'#c9bda4');
  // 三行字：每行断成三段，读起来像字
  for(let i=0;i<3;i++){
    const y=53+i*2;
    R(g,19,y,7,1,'#3f2f1f'); R(g,28,y,5,1,'#3f2f1f'); R(g,35,y,6,1,'#3f2f1f');
  }
  // 书摞
  R(g,49,55,17,3,'#7a3b32'); R(g,49,55,17,1,'#8d4a40');
  R(g,50,58,15,2,'#3f4a63');
  // 墨水瓶
  R(g,69,56,5,4,'#22262e'); R(g,70,55,3,1,'#3a4048');
  // 笔搁在墨水瓶上
  R(g,74,55,1,5,'#3a4048'); R(g,75,54,1,2,'#e8e0cc');

  // 右桌 + 煤油灯
  R(g,108,60,66,4,'#5a4535'); R(g,108,60,66,1,'#6e5442');
  R(g,112,64,3,16,'#4a3a2c'); R(g,168,64,3,16,'#4a3a2c');
  R(g,119,57,28,3,'#b8ad95');
  R(g,118,50,28,8,'#ded4bf'); R(g,118,50,28,1,'#f0e7d4'); R(g,118,50,1,8,'#c9bda4');
  for(let i=0;i<3;i++){
    const y=52+i*2;
    R(g,121,y,7,1,'#3f2f1f'); R(g,130,y,6,1,'#3f2f1f'); R(g,138,y,5,1,'#3f2f1f');
  }
  // 第二张（斜一点）
  R(g,148,55,12,5,'#cfc6b0'); R(g,148,55,12,1,'#e6ddc9');
  R(g,150,57,8,1,'#3f2f1f'); R(g,151,59,6,1,'#3f2f1f');
  R(g,146,56,6,6,'#2b2f3a'); R(g,147,55,4,1,'#4a4f5c');
  R(g,152,52,1,8,'#d8cfbb');

  // 煤油灯
  R(g,92,54,10,6,'#4a3a28');
  R(g,93,46,8,9,'#6a5a48');
  R(g,94,47,6,8,'#8a7a58');
  R(g,95,41,4,6,'#ffe9b0');
  R(g,96,42,2,4,'#fff6d0');
  anim.push({type:'bulb', x:97, y:41});
  glow(g,97,44,58,'rgba(255,206,120,.26)','rgba(255,206,120,0)');

  // 箱子、凳子
  R(g,84,70,18,11,'#8a6a45'); R(g,84,70,18,1,'#a07c52'); R(g,88,75,10,1,'#6a5235');
  if(d > 0.12){ R(g,86,62,14,8,'#8a6a45'); R(g,86,62,14,1,'#a07c52'); }
  if(d > 0.3){
    R(g,55,70,12,12,'#7a5c3c'); R(g,55,70,12,1,'#916f49');
    R(g,140,74,10,9,'#4a3a2c'); R(g,140,74,10,1,'#5c4a38');  // 矮凳
  }
  if(d > 0.2){
    // 桌上多一叠纸
    R(g,30,58,10,2,'#cfc6b0'); R(g,30,56,10,2,'#e0d8c4');
    // 墙上多一张钉着的草图（挪到黑板和挂钟之间，不再压住钟）
    R(g,116,15,22,17,'#3a2d20');
    R(g,118,17,18,13,'#cfc6b0');
    R(g,120,20,14,1,'#8a7d6a'); R(g,120,23,10,1,'#8a7d6a'); R(g,122,26,7,1,'#8a7d6a');
    R(g,126,10,2,6,'#3d3229');
  }

  // 家当变多后，桌角出现阿尔瓦的淡紫色缎带与账本，椅旁搭着赫尔曼的棕绿条纹外套
  if(d > 0.25) drawAlvaProps(g, 58, 54);
  if(d > 0.45) drawHermannCoat(g, 173, 56);
  anim.push({type:'dust', x:32, y:24, w:120, h:36});

  drawCatIn(g);
  vig(g,.55);
}

/* ---------------- 场景 1：学院 · 借来的地下室 ---------------- */
function drawBasement(g, d){
  R(g,0,0,W,H,'#111315');
  // 潮湿的青灰石砖墙
  R(g,0,0,W,80,'#202428');
  for(let y=0;y<80;y+=8){
    const off = (y/8)%2 ? 10 : 0;
    for(let x=-10;x<W;x+=20) R(g,x+off,y,19,7,'#272c31');
  }
  // 墙根返潮水渍
  R(g,0,64,W,16,'#1a1e22');
  for(let x=4;x<W;x+=18) R(g,x,60+(x%7),6,6,'#181c20');

  // 地下室高窗（窄横窗，透进清冷天光）
  for(const wx of [18, 134]){
    R(g,wx,8,38,14,'#343a40');
    R(g,wx+2,10,34,10,'#25374a');
    R(g,wx+13,10,1,10,'#343a40'); R(g,wx+25,10,1,10,'#343a40');
    glow(g,wx+19,16,38,'rgba(170,205,235,.15)','rgba(170,205,235,0)');
  }

  // 石板地面
  R(g,0,80,W,H-80,'#1e2124');
  R(g,0,80,W,1,'#3a4046');
  for(let i=1;i<5;i++) R(g,0,80+i*6,W,1,'#16191c');
  for(let i=0;i<9;i++) line(g,i*24+4,80,i*24-12,H,'#14171a');

  // 中央大黑板（写满推演箭头）
  R(g,64,14,62,32,'#342c24');
  R(g,66,16,58,28,'#1d2420');
  R(g,64,46,62,3,'#46382c');
  for(let i=0;i<5;i++) R(g,70,20+i*4,12+i*8,1,'#cfd8c4');
  R(g,70,41,24,1,'#c96a5a'); R(g,98,41,18,1,'#8ab0c8');

  // 左侧木桌：阿尔瓦的精密电表、笔记与淡紫色缎带
  R(g,10,60,68,4,'#4d3e32'); R(g,10,60,68,1,'#635040');
  R(g,14,64,3,16,'#3a2f26'); R(g,71,64,3,16,'#3a2f26');
  R(g,16,49,18,11,'#343028');
  R(g,17,50,16,9,'#d8cfbb');
  // 表盘顶部三个刻度点
  R(g,20,51,1,1,'#8a7d6a'); R(g,25,51,1,1,'#8a7d6a'); R(g,30,51,1,1,'#8a7d6a');
  anim.push({type:'needle', cx:25, cy:57, len:6, c:'#8a2f22'});
  drawAlvaProps(g, 38, 54);

  // 右侧实验台：线圈组、煤油灯与赫尔曼的草稿
  R(g,108,60,72,4,'#4d3e32'); R(g,108,60,72,1,'#635040');
  R(g,112,64,3,16,'#3a2f26'); R(g,173,64,3,16,'#3a2f26');
  // 铜线圈架
  R(g,116,50,18,10,'#3a322c');
  R(g,119,52,12,6,'#b8783a');
  for(let x=120;x<130;x+=2) R(g,x,52,1,6,'#e0a458');
  // 演算纸与墨水
  R(g,138,52,24,8,'#ded4bf'); R(g,138,52,24,1,'#f0e7d4');
  R(g,141,54,14,1,'#3f2f1f'); R(g,141,56,18,1,'#3f2f1f');
  // 台灯
  R(g,92,54,10,6,'#4a3a28');
  R(g,95,43,4,11,'#ffe9b0');
  anim.push({type:'bulb', x:97, y:43});
  glow(g,97,46,52,'rgba(255,206,120,.22)','rgba(255,206,120,0)');

  if(d > 0.25) drawHermannCoat(g, 176, 56);
  if(d > 0.50){
    // 接地铜线连向地面
    line(g,125,60,125,80,'#b8783a');
    R(g,82,70,18,10,'#6a5235');
  }
  anim.push({type:'dust', x:24, y:18, w:140, h:40});

  drawCatIn(g);
  vig(g,.58);
}

/* ---------------- 场景 2：工坊 ---------------- */
function drawWorkshop(g, d){
  R(g,0,0,W,H,'#15100e');
  // 砖墙
  R(g,0,0,W,80,'#2a1f1a');
  for(let y=0;y<80;y+=6){
    const off = (y/6)%2 ? 8 : 0;
    for(let x=-8;x<W;x+=16) R(g,x+off,y,15,5,'#332620');
  }
  wear(g, 20, 31);

  // 铁横梁
  R(g,0,8,W,5,'#3a3230'); R(g,0,8,W,1,'#4a423f');
  for(let x=4;x<W;x+=22) R(g,x,9,2,3,'#2a2422');

  // 传动轴 + 皮带轮
  R(g,0,20,W,3,'#4a423f');
  for(const px of [24,70,118,164]){
    R(g,px-4,15,8,13,'#5a504a');
    R(g,px-4,15,8,1,'#6e625a');
    R(g,px-1,15,2,13,'#3a3230');
    line(g,px,16,px+18,54,'#3a3128');
    line(g,px+1,16,px+19,54,'#3a3128');
  }

  // 齿轮（动态啮合旋转，随小猫加速技能加快转速）
  anim.push({type:'gear', cx:38,  cy:54, r:15, teeth:10, col:'#4a403a', sp:0.35});
  anim.push({type:'gear', cx:84,  cy:60, r:11, teeth:8,  col:'#443a34', sp:-0.45});
  if(d > 0.25) anim.push({type:'gear', cx:124, cy:56, r:13, teeth:9, col:'#4a403a', sp:0.40});

  // 蒸汽管
  R(g,168,10,6,62,'#3f4a46');
  R(g,168,10,1,62,'#55615c');
  R(g,164,18,14,4,'#4a5651');
  R(g,166,40,10,10,'#2f3835');
  for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; R(g,169+Math.round(Math.cos(a)*5),45+Math.round(Math.sin(a)*5),2,2,'#5a6661'); }

  // 铁地板
  R(g,0,80,W,H-80,'#2a2521');
  R(g,0,80,W,1,'#4a403a');
  for(let x=0;x<W;x+=24){ R(g,x,80,1,H-80,'#1b1714'); }
  for(let y=86;y<H;y+=8) for(let x=6;x<W;x+=24) R(g,x,y,1,1,'#3f3833');
  for(let i=0;i<16;i++) R(g,20+i*11,86+(i%4)*5,4,1,'#211c19');

  // 高窗
  R(g,8,26,26,18,'#3a3028');
  R(g,10,28,22,14,'#2a3a4a');
  R(g,21,28,1,14,'#3a3028'); R(g,10,35,22,1,'#3a3028');

  // 工作台
  R(g,92,60,76,4,'#6a5238'); R(g,92,60,76,1,'#7d6244');
  R(g,96,64,4,16,'#4a3a2c'); R(g,160,64,4,16,'#4a3a2c');
  R(g,101,58,22,2,'#b8ad95');
  R(g,100,52,22,7,'#ded4bf'); R(g,100,52,22,1,'#f0e7d4');
  for(let i=0;i<3;i++){
    const y=54+i*2;
    R(g,103,y,6,1,'#3f2f1f'); R(g,111,y,5,1,'#3f2f1f'); R(g,117,y,3,1,'#3f2f1f');
  }
  R(g,124,56,10,4,'#3a3428');
  // 铁砧
  R(g,138,52,10,4,'#3a3a42'); R(g,140,56,6,4,'#2e2e36');

  // 墙角挂灯：家当越多，烧得越亮
  if(d > 0.1){
    R(g,154,34,6,4,'#5a504a'); R(g,156,32,2,2,'#c9a227');
  }
  if(d > 0.18){
    R(g,146,46,16,16,'#3a3428');
    R(g,147,47,14,14,'#d8cfbb');
    R(g,150,49,1,1,'#8a7d6a'); R(g,154,48,1,1,'#8a7d6a'); R(g,158,49,1,1,'#8a7d6a');
    anim.push({type:'needle', cx:154, cy:58, len:8, c:'#8a2f22'});
  }
  // 添了两根竖着的管子
  if(d > 0.3){
    R(g,12,44,8,12,'#3a3428');
    R(g,14,46,4,8,'#5a504a');
    R(g,36,48,6,10,'#3a3428');
    R(g,38,50,4,6,'#5a504a');
  }
  if(d > 0.4){
    // 木桶
    R(g,58,66,14,16,'#6a4f34'); R(g,58,66,14,1,'#7d5f40');
    R(g,58,70,14,1,'#3f2f20'); R(g,58,76,14,1,'#3f2f20');
    // 煤堆
    R(g,22,74,26,8,'#1d1a18'); R(g,26,72,16,3,'#242120'); R(g,30,70,8,2,'#2b2725');
    // 地上散落的零件
    R(g,48,90,5,4,'#3a3428'); R(g,76,92,4,3,'#3a3428');
  }
  // 墙上挂的图纸框
  if(d > 0.6){
    R(g,140,36,12,8,'#2a2420'); R(g,142,38,8,4,'#d8cfbb');
  }

  // 蒸汽管口缓缓冒出白气
  anim.push({type:'steam', x:169, y:12});
  if(d > 0.35) drawAlvaProps(g, 102, 46);
  if(d > 0.55) drawHermannCoat(g, 174, 58);

  drawCatIn(g);
  vig(g,.6);
}

/* ---------------- 场景 3：市中心 · 工业博览会 ---------------- */
function drawExpo(g, d){
  R(g,0,0,W,H,'#12100f');
  // 拱顶
  R(g,0,0,W,66,'#1e1a17');
  g.fillStyle='#241f1b';
  g.beginPath(); g.moveTo(0,42); g.quadraticCurveTo(96,2,192,42); g.lineTo(192,66); g.lineTo(0,66); g.closePath(); g.fill();
  for(let i=1;i<9;i++){ const x=i*22; line(g,x,42-Math.sin(i/9*Math.PI)*30,x,66,'#2e2823'); }
  for(let j=1;j<3;j++){ const y=46+j*7; R(g,0,y,W,1,'#2e2823'); }

  // 吊灯
  for(const lx of [36,96,156]){
    R(g,lx,18,1,16,'#3a322c');
    R(g,lx-5,34,11,3,'#4a4038');
    R(g,lx-3,37,7,3,'#ffe9b0');
    anim.push({type:'bulb', x:lx, y:38});
    glow(g,lx,40,36,'rgba(255,214,140,.20)','rgba(255,214,140,0)');
  }

  // 石地：近大远小
  R(g,0,80,W,H-80,'#26221f');
  R(g,0,80,W,1,'#463f38');
  for(let i=0;i<4;i++){
    const y = 80 + i*7;
    R(g,0,y,W,1,'#332e29');
    const step = 16 + i*8;
    for(let x=-step;x<W;x+=step) R(g,x,y,1,7,'#332e29');
  }
  // 中央地毯（带透视，越近越宽）
  g.fillStyle='#3f2424';
  g.beginPath(); g.moveTo(76,82); g.lineTo(116,82); g.lineTo(136,H); g.lineTo(56,H); g.closePath(); g.fill();
  g.fillStyle='#5e3636';
  g.beginPath(); g.moveTo(78,84); g.lineTo(114,84); g.lineTo(132,H-2); g.lineTo(60,H-2); g.closePath(); g.fill();
  g.fillStyle='#3f2424';
  g.beginPath(); g.moveTo(86,88); g.lineTo(106,88); g.lineTo(118,H-8); g.lineTo(74,H-8); g.closePath(); g.fill();

  // 展柜
  function case_(cx, w, h, y){
    R(g,cx,y+h-4,w,4,'#4a3f33');
    R(g,cx,y+h-4,w,1,'#5d5044');
    R(g,cx+1,y+6,w-2,1,'#7a7268');
    R(g,cx+1,y+6,1,h-10,'#7a7268');
    R(g,cx+w-2,y+6,1,h-10,'#7a7268');
    R(g,cx+3,y+h-14,w-6,4,'#3a3a44');
    R(g,cx+5,y+h-20,w-10,6,'#5a5a66');
    R(g,cx+6,y+h-22,w-12,2,'#c9a227');
    anim.push({type:'bulb', x:cx+(w>>1), y:y+h-16});
    glow(g,cx+(w>>1),y+h-16,22,'rgba(255,240,200,.14)','rgba(255,240,200,0)');
  }
  case_(22, 40, 32, 46);
  case_(76, 40, 32, 42);
  anim.push({type:'wheel', x:96, y:56, r:6, sp:0.9});
  if(d > 0.2) case_(130, 40, 32, 46);

  // 围栏绳
  for(const px of [10,96,182]){ R(g,px,66,2,14,'#6a5a48'); R(g,px-1,64,4,3,'#c9a227'); }
  R(g,10,70,172,1,'#6a5a48');

  if(d > 0.35){
    R(g,150,24,20,14,'#2a2a30');
    R(g,151,25,18,12,'#d8cfbb');
    R(g,153,28,14,1,'#8a7d6a'); R(g,153,31,10,1,'#8a7d6a');
  }

  drawCatIn(g);
  vig(g,.5);
}

/* ---------------- 场景 4：学会 · 二层讲堂 ---------------- */
function drawHall(g, d){
  R(g,0,0,W,H,'#141110');
  R(g,0,0,W,82,'#2a231d');
  for(let x=0;x<W;x+=16) R(g,x,0,1,82,'#231d18');
  for(const px of [0,60,132,190]){
    R(g,px,0,6,82,'#332a22');
    R(g,px,0,1,82,'#3f342a');
    R(g,px,0,6,4,'#443830');
  }
  for(const wx of [10,150]){
    R(g,wx,10,32,34,'#3a3228');
    R(g,wx+2,12,28,30,'#1a2636');
    R(g,wx+16,12,1,30,'#3a3228'); R(g,wx+2,26,28,1,'#3a3228');
    glow(g,wx+16,30,46,'rgba(200,220,255,' + (0.10 + 0.18*d).toFixed(2) + ')','rgba(200,220,255,0)');
  }
  // 黑板
  R(g,52,12,88,36,'#3a3028');
  R(g,54,14,84,32,'#20241d');
  R(g,52,48,88,3,'#4a3a2c');
  for(let i=0;i<4;i++) R(g,60,20+i*6,20+i*12,1,'#cfd8c4');
  R(g,60,44,26,1,'#c96a5a'); R(g,96,44,18,1,'#8ab0c8');

  // 讲台
  R(g,78,56,36,4,'#5a4535'); R(g,78,56,36,1,'#6e5442');
  R(g,84,60,24,18,'#4a3a2c'); R(g,84,60,24,1,'#5c4a38');
  R(g,90,51,12,7,'#ded4bf'); R(g,90,51,12,1,'#f0e7d4');
  R(g,92,53,8,1,'#3f2f1f'); R(g,92,55,6,1,'#3f2f1f'); R(g,94,57,4,1,'#3f2f1f');

  // 地板
  R(g,0,82,W,H-82,'#241d18');
  R(g,0,82,W,1,'#4a3a2c');
  for(let x=0;x<W;x+=20) R(g,x,83,1,H-83,'#1a1410');
  // 中间走道
  R(g,86,82,20,H-82,'#2e241c');
  R(g,86,82,1,H-82,'#3f3226'); R(g,105,82,1,H-82,'#3f3226');

  // 长椅：有椅背，成排
  function bench(y, w){
    const x = (W-w)>>1;
    R(g,x,y,w,4,'#4a3527'); R(g,x,y,w,1,'#5e4433');        // 坐板
    R(g,x,y+4,w,1,'#2e2018');
    R(g,x,y-7,w,3,'#3f2e22'); R(g,x,y-7,w,1,'#4d392b');    // 椅背
    R(g,x+2,y-7,2,7,'#352619');
    R(g,x+w-4,y-7,2,7,'#352619');
    R(g,x+4,y+5,3,5,'#352619'); R(g,x+w-7,y+5,3,5,'#352619');
  }
  bench(86, 88);
  bench(96, 76);
  if(d > 0.2) bench(106, 60);
  if(d > 0.45){ R(g,20,18,18,14,'#332a22'); R(g,21,19,16,12,'#cfc6b0'); R(g,24,23,10,1,'#8a7d6a'); }

  // 侧墙壁灯：人越多越多一盏
  if(d > 0.12){
    R(g,8,40,8,5,'#3a3228');
    R(g,10,41,4,3,'#5a504a');
  }
  if(d > 0.25){
    R(g,176,40,8,5,'#3a3228');
    R(g,178,41,4,3,'#5a504a');
  }
  // 走道两侧的扶手（修正坐标至画布内可见）
  if(d > 0.35){
    R(g,50,104,92,2,'#2a1f1a');
    R(g,56,102,8,2,'#3a3228'); R(g,128,102,8,2,'#3a3228');
  }
  // 后墙上一排冷光
  if(d > 0.5){
    R(g,44,90,3,10,'#4a403a');
    R(g,145,90,3,10,'#4a403a');
    glow(g,46,92,12,'rgba(200,220,255,0.08)','rgba(200,220,255,0)');
    glow(g,147,92,12,'rgba(200,220,255,0.08)','rgba(200,220,255,0)');
  }
  // 顶上的两盏壁灯
  if(d > 0.65){
    R(g,30,12,8,3,'#3a3028'); R(g,32,10,4,2,'#c9a227');
    R(g,154,12,8,3,'#3a3028'); R(g,156,10,4,2,'#c9a227');
  }

  if(d > 0.30) drawAlvaProps(g, 82, 50);
  if(d > 0.50) drawHermannCoat(g, 114, 56);
  anim.push({type:'dust', x:16, y:16, w:160, h:44});

  drawCatIn(g);
  vig(g,.55);
}

/* ---------------- 场景 5：永动轮陈列馆 ---------------- */
function drawMuseum(g, d){
  R(g,0,0,W,H,'#0f0d0c');
  // 穹顶
  R(g,0,0,W,72,'#1a1714');
  g.fillStyle='#211d19';
  g.beginPath(); g.moveTo(0,56); g.quadraticCurveTo(96,0,192,56); g.lineTo(192,72); g.lineTo(0,72); g.closePath(); g.fill();
  for(let i=1;i<7;i++){ const y=12+i*8; R(g,0,y,W,1,'#282320'); }
  for(let i=1;i<9;i++){ const x=i*22; line(g,x,6,x,72,'#282320'); }

  // 天窗光柱
  R(g,78,10,36,10,'#3e4a52');
  glow(g,96,16,74,'rgba(220,235,255,' + (0.18 + 0.30*d).toFixed(2) + ')','rgba(220,235,255,0)');
  R(g,74,20,44,58,'rgba(220,235,255,.045)');

  // 墙裙
  R(g,0,72,W,10,'#241f1b');
  R(g,0,72,W,1,'#3a322c');

  // 地面：抛光石地
  R(g,0,82,W,H-82,'#221d19');
  R(g,0,82,W,1,'#463c33');
  for(let i=1;i<5;i++) R(g,0,82+i*6,W,1,'#1a1613');
  for(let i=0;i<8;i++) line(g,i*26,82,i*26-16,H,'#171310');
  R(g,64,84,64,18,'rgba(201,162,39,.06)');

  // 中央展台
  R(g,60,72,72,10,'#3a322c'); R(g,60,72,72,1,'#514740');
  R(g,70,82,52,4,'#2e2823');

  // 永动轮：轮圈 + 轮毂（辐条在动画里转）
  function ring(cx,cy,r,col){
    for(let a=0;a<Math.PI*2;a+=0.012){
      const x=Math.round(cx+Math.cos(a)*r);
      const y=Math.round(cy+Math.sin(a)*r*0.55);
      R(g,x,y,1,1,col);
    }
  }
  ring(96,50,30,'#8a6d24');
  ring(96,50,29,'#d8b45a');
  R(g,92,46,9,9,'#c9a227');
  R(g,94,48,5,5,'#3a322c');
  // 支架
  R(g,58,50,4,22,'#4a403a'); R(g,130,50,4,22,'#4a403a');
  R(g,56,48,8,4,'#5a504a'); R(g,128,48,8,4,'#5a504a');
  anim.push({type:'wheel', x:96, y:50, r:28, sp:0.7});

  // 展柜
  function vitrine(cx){
    R(g,cx,58,26,26,'#2a2420');
    R(g,cx,58,26,1,'#3f3833');
    R(g,cx+2,60,22,17,'#20242c');
    R(g,cx+4,62,18,13,'rgba(200,220,255,.10)');
    // 玻璃反光
    for(let i=0;i<10;i++) R(g,cx+5+i,62+i,1,1,'rgba(220,235,255,.16)');
    // 柜里的东西
    R(g,cx+9,70,8,2,'#8a7d6a');
    R(g,cx+10,66,6,4,'#c9a227');
    R(g,cx+11,64,4,2,'#8a6d24');
    R(g,cx+7,74,12,2,'#3a3630');
    anim.push({type:'bulb', x:cx+13, y:64});
  }
  vitrine(8); vitrine(158);
  if(d > 0.3) vitrine(36);

  // 铭牌
  R(g,84,88,24,7,'#4a4038'); R(g,85,89,22,5,'#c9a227');
  R(g,89,91,14,1,'#3b3339');
  // 展台一角留着当年那张收据与绿宝石胸针反光
  if(d > 0.25){
    R(g,64,69,8,3,'#ded4bf');
    R(g,120,69,3,3,'#52c97a');
    anim.push({type:'gem', x:120, y:69});
  }
  anim.push({type:'dust', x:70, y:16, w:52, h:54});

  drawCatIn(g);
  vig(g,.62);
}

function drawScene(){
  anim = [];
  octx.clearRect(0,0,W,H);
  const d = sceneDetail();
  if(S.scene === 0) drawBasement(octx, d);
  else if(S.scene === 1) drawRoom(octx, d, false);
  else if(S.scene === 2) drawWorkshop(octx, d);
  else if(S.scene === 3) drawExpo(octx, d);
  else if(S.scene === 4) drawHall(octx, d);
  else drawMuseum(octx, d);
  /* 日间照明交给 CSS 滤镜（[data-theme="day"] .scene canvas），
     不在这里盖白——场景是按夜色画的美术，盖白会把整张图洗掉。 */
}

// 本周目"家当程度"：设备总级数折算成 0~1，用来在同一场景里加小件
function sceneDetail(){
  let n = 0;
  for(const u of HER) n += lv(u.id);
  for(const u of ALV) n += lv(u.id);
  for(const u of CAT) n += lv(u.id);
  return Math.min(1, n / 60);
}

/* 每帧：底图 + 动画 */
// 摸猫时飘起的小爱心粒子
let petHearts = [];
function spawnPetHeart(x, y){
  petHearts.push({x, y, born: performance.now()});
  if(petHearts.length > 8) petHearts.shift();
}
function drawPixelHeart(g, cx, cy, col){
  const pts = [[-2,-1],[-1,-1],[1,-1],[2,-1],[-2,0],[-1,0],[0,0],[1,0],[2,0],[-1,1],[0,1],[1,1],[0,2]];
  g.fillStyle = col;
  for(const [dx, dy] of pts) g.fillRect((cx + dx)|0, (cy + dy)|0, 1, 1);
}
function drawPixelZ(g, x, y, col){
  g.fillStyle = col;
  g.fillRect(x|0, y|0, 3, 1);
  g.fillRect((x+1)|0, (y+1)|0, 1, 1);
  g.fillRect(x|0, (y+2)|0, 3, 1);
}

function paintScene(tms){
  sctx.clearRect(0,0,W,H);
  sctx.drawImage(off,0,0);
  const t = tms/1000;
  const stabNorm = (typeof S !== 'undefined' ? Math.max(0, Math.min(100, S.stab)) : 100) / 100;
  const speedMul = (typeof buffMult === 'function' && buffMult() > 1.05) ? 2.2 : 1.0;

  for(const a of anim){
    if(a.type === 'cat'){
      const tt = tms;
      if(tt > a.nextBlink){ a.blinkUntil = tt + 130; a.nextBlink = tt + 2200 + Math.random()*4200; }
      const closed = a.inBed ? true : (tt < a.blinkUntil);
      const img = closed ? catImage(a.pose, true, catLit()) : a.img;
      drawCatImg(sctx, img, a.ox, a.oy, a.inBed);
      // 窝在藤篮里打盹时，飘起极淡的像素 z
      if(a.inBed){
        const p = (t * 0.45) % 1;
        const zx = a.ox + 15 + Math.round(Math.sin(t * 2.2) * 1.5);
        const zy = a.oy + 2 - Math.round(p * 8);
        const za = Math.sin(p * Math.PI) * 0.65;
        if(za > 0.08) drawPixelZ(sctx, zx, zy, 'rgba(232,220,200,' + za.toFixed(2) + ')');
      }
    } else if(a.type === 'pendulum'){
      // 挂钟摆锤左右慢摆
      const ang = Math.sin(t * 2.4) * 0.55;
      const bx = Math.round(a.cx + Math.sin(ang) * a.len);
      const by = Math.round(a.cy + Math.cos(ang) * a.len);
      line(sctx, a.cx, a.cy, bx, by, '#7a5a20');
      R(sctx, bx - 1, by - 1, 3, 2, '#c9a227');
    } else if(a.type === 'gear'){
      const ang = t * (a.sp || 0.35) * speedMul;
      const teeth = a.teeth || 8, r = a.r || 12;
      for(let i=0;i<teeth;i++){
        const th = ang + i/teeth*Math.PI*2;
        R(sctx, Math.round(a.cx+Math.cos(th)*r)-1, Math.round(a.cy+Math.sin(th)*r*0.9)-1, 3, 3, a.col);
      }
      for(let k=0;k<16;k++){
        const th = ang + k/16*Math.PI*2;
        R(sctx, Math.round(a.cx+Math.cos(th)*r*0.72), Math.round(a.cy+Math.sin(th)*r*0.65), 2, 2, '#3a3028');
      }
      R(sctx, a.cx-3, a.cy-3, 7, 7, '#2a2420');
      R(sctx, a.cx-1, a.cy-1, 3, 3, '#55493f');
    } else if(a.type === 'bulb'){
      // 稳定性越低，灯火闪烁越明显
      const unstable = 1 - stabNorm;
      const f = 0.82 + Math.sin(t*3.1)*(0.05 + unstable*0.18) + Math.sin(t*13)*(0.03 + unstable*0.14);
      sctx.globalAlpha = 1;
      glow(sctx, a.x, a.y+3, 40, 'rgba(255,214,140,'+(0.10*Math.max(0.25, f))+')', 'rgba(255,214,140,0)');
    } else if(a.type === 'wave'){
      for(let i=0;i<a.w;i++){
        const v = Math.sin(t*3 + i*.8)*1.6;
        sctx.fillStyle = '#5fe0a0';
        sctx.fillRect(a.x+i, (a.y + Math.round(v))|0, 1, 1);
      }
    } else if(a.type === 'needle'){
      // 围绕表盘底部轴心左右摆动，稳定性越低颤动越剧烈
      const jitter = 0.08 + (1 - stabNorm) * 0.42;
      const ang = Math.sin(t * 1.9) * 0.58 + Math.sin(t * 14.5) * jitter;
      const tx = Math.round(a.cx + Math.sin(ang) * a.len);
      const ty = Math.round(a.cy - Math.cos(ang) * a.len);
      line(sctx, a.cx, a.cy, tx, ty, a.c);
      R(sctx, a.cx, a.cy, 1, 1, '#2b2620');
    } else if(a.type === 'wheel'){
      const ang = t * (a.sp || 0.6) * speedMul;
      for(let k=0;k<10;k++){
        const th = ang + k*Math.PI/5;
        sctx.fillStyle = k%2 ? '#b8912f' : '#d8b45a';
        for(let r=3;r<a.r;r++){
          const x = Math.round(a.x + Math.cos(th)*r);
          const y = Math.round(a.y + Math.sin(th)*r*0.55);
          sctx.fillRect(x,y,1,1);
        }
      }
      sctx.fillStyle = '#e8dcc8';
      sctx.fillRect(a.x-2, a.y-2, 4, 3);
    } else if(a.type === 'led'){
      if(a.skip) continue;
      const on = (Math.sin(t*2 + (a.x+a.y)*0.7) > -0.3);
      sctx.fillStyle = on ? a.c : '#16202a';
      sctx.fillRect(a.x, a.y, 2, 2);
    } else if(a.type === 'code'){
      for(let i=0;i<7;i++){
        const w = 8 + ((i*7 + Math.floor(t*1.5))%3)*5;
        sctx.fillStyle = 'rgba(95,224,160,'+(0.55+0.3*Math.sin(t*2+i))+')';
        sctx.fillRect(a.x, a.y+i*2, Math.min(w, a.w), 1);
      }
    } else if(a.type === 'win'){
      const on = Math.sin(t*1.4 + a.x*0.3) > -0.2;
      if(!on){ sctx.fillStyle='#222c3a'; sctx.fillRect(a.x,a.y,4,4); }
    } else if(a.type === 'beacon'){
      const on = Math.sin(t*2.4) > 0;
      sctx.fillStyle = on ? '#ff5a4a' : '#5a2a26';
      sctx.fillRect(a.x, a.y, 3, 2);
      if(on) glow(sctx, a.x+1, a.y+1, 16, 'rgba(255,90,74,.22)', 'rgba(255,90,74,0)');
    } else if(a.type === 'steam'){
      for(let i=0;i<4;i++){
        const p = (t * 0.45 + i * 0.25) % 1;
        const sx = Math.round(a.x + Math.sin(t * 2 + i * 1.7) * 2.2);
        const sy = Math.round(a.y - p * 11);
        const alpha = (1 - p) * 0.38;
        sctx.fillStyle = 'rgba(215,228,235,' + alpha.toFixed(2) + ')';
        sctx.fillRect(sx, sy, 2, 1);
      }
    } else if(a.type === 'dust'){
      for(let i=0;i<6;i++){
        const dx = a.x + ((i * 23 + Math.floor(t * 2.5 + i * 3)) % a.w);
        const dy = a.y + ((i * 13 + Math.round(Math.sin(t * 0.9 + i) * 3)) % a.h);
        const alpha = 0.14 + 0.10 * Math.sin(t * 1.5 + i * 2.1);
        sctx.fillStyle = 'rgba(255,236,195,' + Math.max(0.04, alpha).toFixed(2) + ')';
        sctx.fillRect(dx|0, dy|0, 1, 1);
      }
    } else if(a.type === 'gem'){
      const glint = 0.55 + 0.45 * Math.sin(t * 2.8);
      sctx.fillStyle = 'rgba(130,245,170,' + glint.toFixed(2) + ')';
      sctx.fillRect(a.x, a.y, 1, 1);
    }
  }
  // 摸猫飘起的小爱心
  if(petHearts.length){
    petHearts = petHearts.filter(h => (tms - h.born) < 1100);
    for(const h of petHearts){
      const p = (tms - h.born) / 1100;
      const hy = h.y - p * 12;
      const hx = h.x + Math.sin(p * 6.28) * 1.5;
      const alpha = Math.max(0, 1 - p);
      drawPixelHeart(sctx, hx, hy, 'rgba(232,140,148,' + alpha.toFixed(2) + ')');
    }
  }
  // 环境光：底图和猫都画完之后统一罩一层，两者才在同一个光下
  sctx.save();
  sctx.globalAlpha = 1;
  const litBoost = (S.scene >= 4) ? 0.10 * sceneDetail() : 0;
  sctx.fillStyle = 'rgba(255,196,128,' + (0.045 + litBoost).toFixed(3) + ')';
  sctx.fillRect(0, 0, W, H);
  sctx.restore();
  sctx.globalAlpha = 1;
}

/* ============================================================
   小猫的小鱼工厂
   ============================================================ */
const CW = 192, CH = 108;
let catCv = null, catCtx = null, catOff = null, catOffCtx = null;
let catFish = [];          // 需要摆动的鱼

function catWorldTier(){
  let n = 0;
  for(const u of CATSUB) if(!u.util) n += clv(u.id);
  return n >= 30 ? 3 : n >= 16 ? 2 : n >= 6 ? 1 : 0;
}

function drawCatWorld(){
  if(!catCv){
    catCv = $('catScene');
    if(!catCv) return;
    catCtx = catCv.getContext('2d');
    catCtx.imageSmoothingEnabled = false;
    catOff = document.createElement('canvas');
    catOff.width = CW; catOff.height = CH;
    catOffCtx = catOff.getContext('2d');
    catOffCtx.imageSmoothingEnabled = false;
  }
  const g = catOffCtx;
  const tier = catWorldTier();
  catFish = [];

  g.clearRect(0, 0, CW, CH);
  R(g,0,0,CW,CH,'#100e0c');

  // 砖墙
  R(g,0,0,CW,76,'#241d18');
  for(let y=0;y<76;y+=6){
    const off = (y/6)%2 ? 8 : 0;
    for(let x=-8;x<CW;x+=16) R(g,x+off,y,15,5,'#2c231d');
  }
  // 墙根
  R(g,0,70,CW,6,'#1c1712');

  // 石板地
  R(g,0,76,CW,CH-76,'#1b1613');
  R(g,0,76,CW,1,'#3d3128');
  for(let x=0;x<CW;x+=14) R(g,x,77,1,CH-77,'#141110');
  for(let y=82;y<CH;y+=7) for(let x=(y%14?7:0);x<CW;x+=14) R(g,x,y,6,4,'#221c17');

  // 串灯：从左上斜拉到右
  for(let i=0;i<4;i++){
    const x = 22 + i*46, y = 12 + Math.round(Math.sin(i*1.1)*3);
    R(g,x,y,1,10,'#3a3229');
    R(g,x-3,y+10,7,3,'#4a4038');
    R(g,x-1,y+13,3,3,'#ffe0a0');
  }
  glow(g,96,10,120,'rgba(255,190,120,.10)','rgba(255,190,120,0)');

  // 晾鱼架（tier>=1）
  if(tier >= 1){
    R(g,26,34,3,44,'#4a3a2c');
    R(g,96,34,3,44,'#4a3a2c');
    R(g,24,34,76,3,'#5a4634');
    R(g,24,34,76,1,'#6d5540');
    R(g,24,52,76,2,'#4a3a2c');
    for(let i=0;i<4;i++){
      catFish.push({x:34 + i*18, y:38, len:8});
    }
  }

  // 木箱堆（tier 越高越多）
  R(g,120,60,26,18,'#6a4f34'); R(g,120,60,26,1,'#7d5f40'); R(g,124,66,18,1,'#503b26');
  if(tier >= 1){
    R(g,124,44,20,16,'#6a4f34'); R(g,124,44,20,1,'#7d5f40');
    R(g,148,52,22,16,'#5c4530'); R(g,148,52,22,1,'#70563c');
  }
  if(tier >= 2){
    R(g,10,58,18,20,'#5c4530'); R(g,10,58,18,1,'#70563c');
    // 木桶
    R(g,100,62,14,16,'#6a4f34'); R(g,100,62,14,1,'#7d5f40');
    R(g,100,66,14,1,'#3f2f20'); R(g,100,74,14,1,'#3f2f20');
  }
  if(tier >= 3){
    // 招牌
    R(g,150,18,30,16,'#4a3a2c'); R(g,151,19,28,14,'#c9a227');
    R(g,155,23,20,2,'#4a3a2c'); R(g,155,28,12,2,'#4a3a2c');
    R(g,163,34,2,10,'#4a3a2c');
    // 吊着的鱼串
    for(let i=0;i<3;i++) catFish.push({x:58+i*9, y:55, len:7});
  }

  // 挂在架子上的灯（tier>=1）
  if(tier >= 1){
    R(g,22,34,4,4,'#3a3229');
    R(g,20,38,8,3,'#4a4038');
    R(g,22,41,4,4,'#ffe0a0');
    glow(g,24,43,34,'rgba(255,200,120,.20)','rgba(255,200,120,0)');
  }

  // 地上摊着的鱼干（tier>=2）：细长、朝一边、带尾巴
  if(tier >= 2){
    const pile = [[13,84],[19,88],[26,83],[21,92],[29,89]];
    for(const [px,py] of pile){
      R(g,px,py,8,2,'#9aa6ad');          // 身子
      R(g,px+8,py-1,1,4,'#7d888f');      // 尾
      R(g,px+8,py,1,2,'#9aa6ad');
      R(g,px+1,py,1,1,'#b8c2c8');        // 背光
      R(g,px+5,py+1,1,1,'#2b2620');      // 眼
    }
  }
  // 猫罐头（tier>=1）
  if(tier >= 1){
    R(g,152,72,10,7,'#8a8f96');
    R(g,152,72,10,1,'#c2c7cd');
    R(g,153,74,8,3,'#c96a5a');
    R(g,154,75,6,1,'#e8a48f');
    R(g,152,78,10,1,'#6d737a');
  }
  // 毛线球（tier>=2）
  if(tier >= 2){
    R(g,44,84,8,8,'#a86a8a');
    R(g,45,83,6,1,'#c484a4');
    R(g,43,87,1,1,'#c484a4');
    R(g,52,89,1,1,'#c484a4');
    R(g,45,85,2,1,'#8e5573');
  }
  // 第二罐罐头 + 第二个毛线球（tier>=3）
  if(tier >= 3){
    R(g,164,68,9,6,'#8a8f96');
    R(g,164,68,9,1,'#c2c7cd');
    R(g,165,70,7,2,'#c96a5a');
    R(g,54,76,7,7,'#8a6a9a');
    R(g,55,75,5,1,'#a884b8');
  }

  // 箱子上的账本（一直有）
  R(g,126,56,12,4,'#d8cfbb'); R(g,126,56,12,1,'#e6ddc9');
  R(g,128,58,8,1,'#3f2f1f');

  // 猫：坐在右边箱子上
  const img = catImage('sit', false, 1);
  if(img && img.__src !== undefined){
    const cx = 122, cy = 42;
    g.save();
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.beginPath();
    g.ellipse(cx + 10, cy + 17, 7, 1.5, 0, 0, Math.PI*2);
    g.fill();
    g.restore();
    g.save();
    g.translate(cx + (img.width||18), cy);
    g.scale(-1, 1);
    g.drawImage(img, 0, 0);
    g.restore();
  }

  vig(g, .58);
  paintCatWorld(performance.now());
}

function paintCatWorld(tms){
  if(!catCtx || !catOff) return;
  const t = tms / 1000;
  catCtx.clearRect(0, 0, CW, CH);
  catCtx.drawImage(catOff, 0, 0);

  // 灯串呼吸
  catCtx.save();
  catCtx.fillStyle = 'rgba(255,214,140,' + (0.05 + 0.03*Math.sin(t*1.7)).toFixed(3) + ')';
  catCtx.fillRect(0, 0, CW, 40);
  catCtx.restore();

  // 挂着的鱼干：细条、尾巴朝上、头朝下
  for(const f of catFish){
    const sway = Math.sin(t * 1.6 + f.x * 0.2) * 1.0;
    const x = Math.round(f.x + sway);
    const len = f.len || 8;

    // 吊线
    catCtx.fillStyle = '#3a3229';
    catCtx.fillRect(f.x, f.y - 5, 1, 5);

    // 尾鳍（上，分叉）
    catCtx.fillStyle = '#7d888f';
    catCtx.fillRect(x - 1, f.y, 1, 2);
    catCtx.fillRect(x + 1, f.y, 1, 2);

    // 身子：2px 宽、细长
    catCtx.fillStyle = '#9aa6ad';
    catCtx.fillRect(x, f.y + 1, 1, len);
    catCtx.fillRect(x + 1, f.y + 2, 1, len - 2);

    // 背上一道亮
    catCtx.fillStyle = '#b8c2c8';
    catCtx.fillRect(x, f.y + 1, 1, 2);

    // 头（下，略收）
    catCtx.fillStyle = '#8e99a0';
    catCtx.fillRect(x, f.y + len, 1, 1);

    // 眼
    catCtx.fillStyle = '#2b2620';
    catCtx.fillRect(x + 1, f.y + 3, 1, 1);
  }
}


/* ============================================================
   摸猫互动与 Web Audio 合成音效（纯代码合成，无需外部音频文件）
   ============================================================ */
let audioCtx = null;
function playCatPurrSound(){
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    if(!audioCtx) audioCtx = new AC();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const nowT = audioCtx.currentTime;

    // 1. 轻柔的喉咙呼噜声（低频三角波 + 26Hz 颤音调制）
    const purrOsc = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    const purrGain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    purrOsc.type = 'triangle';
    purrOsc.frequency.setValueAtTime(92, nowT);
    purrOsc.frequency.exponentialRampToValueAtTime(76, nowT + 0.55);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, nowT);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(26, nowT);
    lfoGain.gain.setValueAtTime(0.055, nowT);

    purrGain.gain.setValueAtTime(0.001, nowT);
    purrGain.gain.linearRampToValueAtTime(0.09, nowT + 0.08);
    purrGain.gain.exponentialRampToValueAtTime(0.001, nowT + 0.60);

    lfo.connect(lfoGain);
    lfoGain.connect(purrGain.gain);
    purrOsc.connect(filter);
    filter.connect(purrGain);
    purrGain.connect(audioCtx.destination);

    purrOsc.start(nowT);
    lfo.start(nowT);
    purrOsc.stop(nowT + 0.62);
    lfo.stop(nowT + 0.62);

    // 2. 偶尔附带一声极轻的撒娇「咕噜喵」短音
    if(Math.random() < 0.55){
      const meow = audioCtx.createOscillator();
      const meowGain = audioCtx.createGain();
      meow.type = 'sine';
      meow.frequency.setValueAtTime(460, nowT + 0.03);
      meow.frequency.exponentialRampToValueAtTime(660, nowT + 0.14);
      meow.frequency.exponentialRampToValueAtTime(520, nowT + 0.24);

      meowGain.gain.setValueAtTime(0.001, nowT + 0.03);
      meowGain.gain.linearRampToValueAtTime(0.045, nowT + 0.09);
      meowGain.gain.exponentialRampToValueAtTime(0.001, nowT + 0.25);

      meow.connect(meowGain);
      meowGain.connect(audioCtx.destination);
      meow.start(nowT + 0.03);
      meow.stop(nowT + 0.27);
    }
  }catch(e){}
}

const PET_LINES = [
  '猫眯起眼睛，喉咙里发出轻轻的呼噜声。',
  '猫用脑袋蹭了蹭你的指尖。',
  '小猫监督官认可了你的摸鱼态度。',
  '猫甩了甩尾巴，决定再多陪这一夜一会儿。',
  '毛茸茸的，带着一点煤油灯烘出来的暖意。'
];
let lastPetLine = -1;

function getCatHitBox(){
  const c = anim.find(a => a.type === 'cat');
  if(!c) return null;
  const w = (c.img && c.img.width) ? c.img.width : 18;
  const h = (c.img && c.img.height) ? c.img.height : 18;
  // 留出 6px 容错边距，手机端更容易点到
  return {x: c.ox - 6, y: c.oy - 6, w: w + 12, h: h + 12, cx: c.ox + w/2, cy: c.oy + 2};
}

function canvasPoint(cv, ev){
  const rect = cv.getBoundingClientRect();
  return {
    x: (ev.clientX - rect.left) * (cv.width / rect.width),
    y: (ev.clientY - rect.top) * (cv.height / rect.height)
  };
}

if(sceneCv){
  sceneCv.addEventListener('mousemove', ev => {
    const box = getCatHitBox();
    if(!box){ sceneCv.style.cursor = ''; return; }
    const pt = canvasPoint(sceneCv, ev);
    const hit = pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h;
    sceneCv.style.cursor = hit ? 'pointer' : '';
  });
  sceneCv.addEventListener('click', ev => {
    const box = getCatHitBox();
    if(!box) return;
    const pt = canvasPoint(sceneCv, ev);
    if(pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h){
      playCatPurrSound();
      spawnPetHeart(box.cx, box.cy);
      let idx = Math.floor(Math.random() * PET_LINES.length);
      if(idx === lastPetLine) idx = (idx + 1) % PET_LINES.length;
      lastPetLine = idx;
      if(typeof toast === 'function') toast(PET_LINES[idx]);
    }
  });
}
