// ui.js - 界面渲染、设置/更新日志/联系开发者弹窗、局部 DOM 更新、Toast 与初始化启动
let toastTimer = null;

function showToast(msg, duration = 2600) {
  const el = document.getElementById('toastBox');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, duration);
}

let topNoticeTimer = null;
function showTopNotice(msg, duration = 4200) {
  const el = document.getElementById('topNoticeBox');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (topNoticeTimer) clearTimeout(topNoticeTimer);
  topNoticeTimer = setTimeout(() => {
    el.classList.remove('show');
  }, duration);
}

function showAchievementToast(id) {
  const stack = document.getElementById('achToastStack');
  const c = COPY.achievements && COPY.achievements[id];
  if (!stack || !c) return;

  const item = document.createElement('div');
  item.className = 'ach-toast';
  item.innerHTML = `
    <div class="ach-toast-kicker">🏅 解锁新成就 · 永久加成 +2%</div>
    <div class="ach-toast-title">${escapeHtml(c.name)}</div>
    <div class="ach-toast-sub">${escapeHtml(c.desc)}</div>
  `;
  stack.appendChild(item);
  requestAnimationFrame(() => item.classList.add('show'));

  while (stack.children.length > 4) {
    stack.removeChild(stack.firstElementChild);
  }

  setTimeout(() => {
    item.classList.remove('show');
    setTimeout(() => item.remove(), 260);
  }, 4200);
}

function fallbackCopyText(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

function copyToClipboard(text, successMsg, fallbackPromptTitle = '请手动复制以下内容（Ctrl+C / Cmd+C）：') {
  if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => showToast(successMsg))
      .catch(() => {
        if (fallbackCopyText(text)) showToast(successMsg);
        else window.prompt(fallbackPromptTitle, text);
      });
  } else if (fallbackCopyText(text)) {
    showToast(successMsg);
  } else {
    window.prompt(fallbackPromptTitle, text);
  }
}

function showCritFlash(text) {
  const el = document.getElementById('critFlash');
  if (!el) return;
  el.textContent = text;
  setTimeout(() => { el.textContent = ''; }, 900);
}

function spawnClickFloat(text, isCrit = false) {
  if (state.settings && state.settings.floatText === false) return;
  const btn = document.getElementById('manualClickBtn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();

  const el = document.createElement('span');
  el.className = 'float-text' + (isCrit ? ' crit' : '');
  el.textContent = text;

  const offsetX = (Math.random() - 0.5) * 60;
  el.style.left = `${rect.left + rect.width / 2 + offsetX}px`;
  el.style.top = `${rect.top - 4}px`;
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 660);
}

function triggerCritGlow() {
  const box = document.getElementById('energyDisplayBox');
  if (!box) return;
  box.classList.remove('crit-glow');
  void box.offsetWidth;
  box.classList.add('crit-glow');
}

function triggerOrbPulse(isCrit = false) {
  const orb = document.getElementById('emOrbWrap');
  if (!orb) return;
  orb.classList.remove('orb-pulse', 'orb-crit');
  void orb.offsetWidth;
  orb.classList.add(isCrit ? 'orb-crit' : 'orb-pulse');
}

function showModal(stamp, quote, reward, angryShake = false) {
  document.getElementById('modalStamp').textContent = stamp;
  document.getElementById('modalQuote').textContent = `“${quote}”`;
  document.getElementById('modalReward').textContent = reward;
  document.getElementById('muteModalCheck').checked = state.muteModal;
  document.getElementById('alvaModal').style.display = 'flex';

  const card = document.querySelector('#alvaModal .modal-card');
  if (card) {
    card.classList.remove('angry-shake');
    void card.offsetWidth;
    if (angryShake) card.classList.add('angry-shake');
  }
}

function closeModal() { document.getElementById('alvaModal').style.display = 'none'; }

function toggleMuteModal() {
  state.muteModal = document.getElementById('muteModalCheck').checked;
  saveGame();
  syncSettingsUI();
}

function toggleMuteModalSetting() {
  state.muteModal = !state.muteModal;
  saveGame();
  syncSettingsUI();
  showToast(state.muteModal ? '已静音退稿/答辩弹窗（仅写入日志）' : '已恢复退稿/答辩弹窗');
}

function updateMuteBtnUI() {
  const btn = document.getElementById('muteSfxBtn');
  if (btn && typeof SFX !== 'undefined') {
    btn.textContent = SFX.muted ? '🔇 静音' : '🔊 音效';
  }
  const setSfxBtn = document.getElementById('setSfxBtn');
  if (setSfxBtn && typeof SFX !== 'undefined') {
    setSfxBtn.textContent = SFX.muted ? '关' : '开';
    setSfxBtn.className = SFX.muted ? '' : 'primary';
  }
}

function handleToggleMute() {
  if (typeof SFX === 'undefined') return;
  SFX.toggleMute();
  updateMuteBtnUI();
  if (!SFX.muted) SFX.playClick();
  showToast(SFX.muted ? '已关闭实验台音效' : '已开启实验台音效');
}

function updateSaveTimeUI() {
  const el = document.getElementById('saveTimeDisplay');
  if (el) {
    el.textContent = lastSaveTime ? `上次保存：${lastSaveTime}` : '自动保存中';
  }
}

function applySettingsToDOM() {
  const s = state.settings || {};
  const isVintage = s.theme === 'vintage';
  document.body.classList.toggle('theme-vintage', isVintage);
  document.body.classList.toggle('compact-mode', !!s.compactMode);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', isVintage ? '#efe5cc' : '#0a0e17');

  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) themeBtn.textContent = isVintage ? '📜 复古风' : '⚡ 赛博风';

  const tickerBar = document.getElementById('tickerBar');
  if (tickerBar) tickerBar.style.display = (s.showTicker === false) ? 'none' : 'flex';

  const compactBtn = document.getElementById('compactModeBtn');
  if (compactBtn) compactBtn.textContent = s.compactMode ? '简洁视图：开' : '简洁视图：关';

  const hideBtn = document.getElementById('hideBoughtBtn');
  if (hideBtn) hideBtn.textContent = s.hideBoughtLab ? '隐藏已购：开' : '隐藏已购：关';

  syncSettingsUI();
}

function syncSettingsUI() {
  const s = state.settings || {};
  const curTheme = s.theme === 'vintage' ? 'vintage' : 'cyber';
  const cyberBtn = document.getElementById('setThemeCyberBtn');
  const vintageBtn = document.getElementById('setThemeVintageBtn');
  if (cyberBtn) cyberBtn.classList.toggle('active-toggle', curTheme === 'cyber');
  if (vintageBtn) vintageBtn.classList.toggle('active-toggle', curTheme === 'vintage');

  const sciBtn = document.getElementById('setNotSciBtn');
  const cnBtn = document.getElementById('setNotCnBtn');
  const entBtn = document.getElementById('setNotEntropyBtn');
  if (sciBtn) sciBtn.classList.toggle('active-toggle', (s.notation || 'sci') === 'sci');
  if (cnBtn) cnBtn.classList.toggle('active-toggle', s.notation === 'cn');
  if (entBtn) entBtn.classList.toggle('active-toggle', s.notation === 'entropy');

  const setToggle = (id, on) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = on ? '开' : '关';
    el.className = on ? 'primary' : '';
  };
  setToggle('setCompactBtn', !!s.compactMode);
  setToggle('setHideBoughtBtn', !!s.hideBoughtLab);
  setToggle('setTickerBtn', s.showTicker !== false);
  setToggle('setFloatTextBtn', s.floatText !== false);
  setToggle('setMuteModalBtn', !!state.muteModal);
  setToggle('setSkipConfirmBtn', !!s.skipPrestigeConfirm);
  updateMuteBtnUI();
  updateSaveTimeUI();
}

function setTheme(theme) {
  const next = theme === 'vintage' ? 'vintage' : 'cyber';
  if (!state.settings) state.settings = {};
  state.settings.theme = next;
  unlockAchievement('ach_theme_switch');
  saveGame();
  applySettingsToDOM();
  if (typeof SFX !== 'undefined') SFX.playClick();
  showToast(next === 'vintage' ? '📜 已切换为「复古实验手记」主题' : '⚡ 已切换为「赛博实验室」主题');
}

function toggleTheme() {
  const cur = (state.settings && state.settings.theme === 'vintage') ? 'vintage' : 'cyber';
  setTheme(cur === 'vintage' ? 'cyber' : 'vintage');
}

function setNotation(mode) {
  state.settings.notation = mode;
  saveGame();
  syncSettingsUI();
  renderAll();
  const msg = mode === 'cn'
    ? '已切换为中文大数单位（万/亿/兆）'
    : (mode === 'entropy' ? '已切换为熵增模糊计数法（阿尔瓦看了一眼并陷入了沉思）' : '已切换为科学计数法');
  showToast(msg);
}

function toggleCompactMode() {
  state.settings.compactMode = !state.settings.compactMode;
  saveGame();
  applySettingsToDOM();
}

function toggleHideBoughtLab() {
  state.settings.hideBoughtLab = !state.settings.hideBoughtLab;
  saveGame();
  applySettingsToDOM();
  renderLabUpgrades();
}

function toggleTickerSetting() {
  state.settings.showTicker = (state.settings.showTicker === false);
  saveGame();
  applySettingsToDOM();
}

function toggleFloatTextSetting() {
  state.settings.floatText = (state.settings.floatText === false);
  saveGame();
  applySettingsToDOM();
}

// --- 设置、更新日志、联系开发者弹窗 ---
function openSettingsModal() {
  syncSettingsUI();
  document.getElementById('settingsModal').style.display = 'flex';
}
function closeSettingsModal() {
  document.getElementById('settingsModal').style.display = 'none';
}

function openHardResetModal() {
  const el = document.getElementById('hardResetModal');
  if (el) el.style.display = 'flex';
}

function closeHardResetModal() {
  const el = document.getElementById('hardResetModal');
  if (el) el.style.display = 'none';
}

function confirmHardReset() {
  closeHardResetModal();
  hardReset();
}

function openChangelogModal() {
  const box = document.getElementById('changelogContainer');
  box.innerHTML = (COPY.changelog || []).map(entry => `
    <div class="changelog-entry">
      <div class="between">
        <div>
          <strong class="mono" style="font-size:14px; color:var(--accent);">${entry.version}</strong>
          <span class="badge gold" style="margin-left:6px;">${entry.tag}</span>
        </div>
        <span class="muted mono">${entry.date}</span>
      </div>
      <ul>
        ${entry.items.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
  `).join('');
  document.getElementById('changelogModal').style.display = 'flex';
}
function closeChangelogModal() {
  document.getElementById('changelogModal').style.display = 'none';
}

function openAboutModal() {
  const info = COPY.about;
  const mailSubject = encodeURIComponent(`《${info.title}》${BALANCE.version} 反馈与建议`);
  const mailBody = encodeURIComponent(`你好！我在游玩 ${BALANCE.version} 时有以下反馈/建议：\n\n（如果是 Bug 反馈，欢迎在「设置 → 复制 Bug 诊断包」后粘贴在下方）\n`);
  const mailtoHref = `mailto:${info.developerEmail}?subject=${mailSubject}&body=${mailBody}`;

  document.getElementById('aboutContainer').innerHTML = `
    <div style="margin-bottom: 10px;">
      <strong style="font-size:15px; color:var(--text);">${info.title}</strong>
      <span class="badge" style="margin-left:6px;">${BALANCE.version}</span>
      <div class="muted" style="margin-top:3px;">${info.subtitle}</div>
    </div>
    <p style="margin: 8px 0; color: var(--text-soft); line-height: 1.6;">${info.intro}</p>

    <div class="contact-box">
      <h3 style="margin-bottom: 6px;">联系开发者 / 反馈与投稿</h3>
      <div class="muted" style="color: var(--text-soft); line-height: 1.55; margin-bottom: 10px;">${info.contactTip}</div>
      <div class="row" style="margin-bottom: 10px;">
        <span class="email-pill mono">${info.developerEmail}</span>
      </div>
      <div class="row">
        <button class="primary" onclick="handleCopyEmail()">📋 复制联系邮箱</button>
        <a class="btn-link" href="${mailtoHref}">✉️ 调用邮件客户端发送</a>
        <button onclick="handleCopyDiagnostic()">🩺 复制 Bug 诊断包</button>
      </div>
    </div>

    <div class="item-box" style="margin-top: 10px;">
      <div style="font-size:12px; color: var(--text-soft); line-height:1.55;">
        <div><strong>致谢：</strong>${info.credits}</div>
        <div style="margin-top:6px; color: var(--muted);"><strong>同人声明：</strong>${info.disclaimer}</div>
      </div>
    </div>
  `;
  document.getElementById('aboutModal').style.display = 'flex';
}
function closeAboutModal() {
  document.getElementById('aboutModal').style.display = 'none';
}

function handleCopyEmail() {
  copyToClipboard(COPY.about.developerEmail, `已复制开发者邮箱：${COPY.about.developerEmail}`);
}

let currentShareComment = '';
let currentShareStyle = 'vintage';

function handleShareProgress() {
  openShareModal();
}

function syncShareStyleButtons() {
  const vBtn = document.getElementById('shareStyleVintageBtn');
  const cBtn = document.getElementById('shareStyleCyberBtn');
  if (vBtn) vBtn.classList.toggle('active-toggle', currentShareStyle === 'vintage');
  if (cBtn) cBtn.classList.toggle('active-toggle', currentShareStyle === 'cyber');
}

function setShareStyle(style) {
  currentShareStyle = (style === 'cyber') ? 'cyber' : 'vintage';
  syncShareStyleButtons();
  renderShareCardPreview();
  const wrap = document.getElementById('shareImgPreviewWrap');
  if (wrap && wrap.style.display !== 'none') {
    updateShareCanvasPreviewImg();
  }
  if (typeof SFX !== 'undefined') SFX.playClick();
}

function openShareModal() {
  currentShareComment = pickShareComment(currentShareComment);
  currentShareStyle = (state.settings && state.settings.theme === 'cyber') ? 'cyber' : 'vintage';
  const input = document.getElementById('assistantNameInput');
  if (input) {
    input.value = (state.settings && state.settings.assistantName) || '';
  }
  const wrap = document.getElementById('shareImgPreviewWrap');
  if (wrap) wrap.style.display = 'none';
  syncShareStyleButtons();
  renderShareCardPreview();
  const modal = document.getElementById('shareModal');
  if (modal) modal.style.display = 'flex';
}

function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) modal.style.display = 'none';
}

function onAssistantNameInput() {
  const input = document.getElementById('assistantNameInput');
  if (!state.settings) state.settings = {};
  state.settings.assistantName = input ? input.value.slice(0, 24) : '';
  saveGame();
  renderShareCardPreview();
  const wrap = document.getElementById('shareImgPreviewWrap');
  if (wrap && wrap.style.display !== 'none') {
    updateShareCanvasPreviewImg();
  }
}

function rerollShareComment() {
  currentShareComment = pickShareComment(currentShareComment);
  state.shareRerolls = (state.shareRerolls || 0) + 1;
  if (state.shareRerolls >= 10) {
    unlockAchievement('ach_reviewer2');
  }
  saveGame();
  renderShareCardPreview();
  const wrap = document.getElementById('shareImgPreviewWrap');
  if (wrap && wrap.style.display !== 'none') {
    updateShareCanvasPreviewImg();
  }
  if (typeof SFX !== 'undefined') SFX.playClick();
}

function handleStampClick() {
  state.stampClicks = (state.stampClicks || 0) + 1;
  if (typeof SFX !== 'undefined') SFX.playClick();
  if (state.stampClicks === 5) {
    unlockAchievement('ach_stamp_click');
  } else if (state.stampClicks < 5) {
    showToast(`你戳了一下红色印章（${state.stampClicks}/5）`, 1400);
  } else {
    showToast('印章已经被你戳得有点掉色了，但上面依然写着退稿。', 1800);
  }
  saveGame();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderShareCardPreview() {
  const box = document.getElementById('shareReportPreview');
  if (!box) return;
  const d = getShareReportData(currentShareComment);
  const isCyber = currentShareStyle === 'cyber';
  box.className = isCyber ? 'report-paper share-cyber' : 'report-paper';

  const docPrefix = isCyber ? 'LAB TELEMETRY' : 'LAB REPORT';
  const commentLabel = isCyber ? d.commentTitleCyber : d.commentTitleVintage;

  box.innerHTML = `
    <div class="report-header">
      <div class="report-doc-no mono">${docPrefix} · NO. ${d.version.toUpperCase()} · ${escapeHtml(d.dateStr)}</div>
      <div class="report-title">「永动」实验台运行阶段性评估报告</div>
      <div class="report-subtitle">${escapeHtml(d.stage)}</div>
      <div class="report-stamp">${escapeHtml(d.stampLine1)}<br/>${escapeHtml(d.stampLine2)}</div>
    </div>

    <div class="report-people">
      <div><span class="lbl">实验负责人：</span><strong>卢卡·巴尔萨</strong></div>
      <div><span class="lbl">实验助手：</span><strong>${escapeHtml(d.assistant)}</strong></div>
      <div><span class="lbl">指导教授：</span><strong>阿尔瓦·洛伦兹</strong></div>
      <div><span class="lbl">最高装置：</span><strong>${escapeHtml(d.highestUnit)}</strong></div>
    </div>

    <div class="report-grid">
      <div class="report-metric">
        <div class="report-metric-label">累计产出能量</div>
        <div class="report-metric-val mono">${escapeHtml(d.totalEnergy)} E</div>
        <div class="report-metric-sub mono">当前稳态：${escapeHtml(d.eps)} E/秒</div>
      </div>
      <div class="report-metric">
        <div class="report-metric-label">累计被打回次数</div>
        <div class="report-metric-val mono">共 ${d.totalRejects} 次</div>
        <div class="report-metric-sub mono">本轮报告 ${d.reports} 次 · 论文初稿 ${d.drafts} 次</div>
      </div>
      <div class="report-metric">
        <div class="report-metric-label">正式答辩与专利</div>
        <div class="report-metric-val mono">答辩 ${d.defenses} 次</div>
        <div class="report-metric-sub mono">${escapeHtml(d.pp)} PP · ${escapeHtml(d.rp)} RP · ${d.totalTT} TT</div>
      </div>
      <div class="report-metric">
        <div class="report-metric-label">质询挑战通关</div>
        <div class="report-metric-val mono">${d.challengesDone} / ${d.challengesMax} 次</div>
        <div class="report-metric-sub mono">${escapeHtml(d.ecDetail)}</div>
      </div>
      <div class="report-metric">
        <div class="report-metric-label">实验台规模与超频</div>
        <div class="report-metric-val mono">${d.totalUnits} 台装置</div>
        <div class="report-metric-sub mono">超频 Lv.${d.tickspeed} · L4献祭 ×${escapeHtml(d.sacrificeMult)}</div>
      </div>
      <div class="report-metric">
        <div class="report-metric-label">在岗黄油猫 · 成就进度</div>
        <div class="report-metric-val mono">${d.cats} 只 · ${escapeHtml(d.achStr)}</div>
        <div class="report-metric-sub mono">历史最高 RP：${escapeHtml(d.maxRp)}</div>
      </div>
    </div>

    <div class="report-comment-box">
      <div class="report-comment-title">${commentLabel}</div>
      <div class="report-comment-text">“${escapeHtml(d.comment)}”</div>
      <div class="report-sign">${escapeHtml(d.commentSign)}</div>
    </div>
  `;
}

function wrapCanvasText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of String(text)) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawShareReportCanvas(style = currentShareStyle) {
  const d = getShareReportData(currentShareComment);
  const isCyber = style === 'cyber';
  const W = 880;
  const padX = 56;
  const contentW = W - padX * 2;
  const fontSans = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  const fontMono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  const palette = isCyber ? {
    bg0: '#0b111e', bg1: '#111b2e', bg2: '#0c1424',
    outerBorder: '#2dd4bf', innerBorder: 'rgba(45, 212, 191, 0.35)',
    docNo: '#38bdf8', title: '#f0fdfa', subtitle: '#94a3b8', divider: 'rgba(45, 212, 191, 0.55)',
    stampFill: 'rgba(248, 113, 113, 0.12)', stampStroke: '#f87171', stampText: '#fca5a5',
    infoFill: 'rgba(15, 23, 42, 0.78)', infoStroke: 'rgba(56, 189, 248, 0.35)',
    label: '#94a3b8', value: '#e2e8f0',
    cardFill: 'rgba(18, 28, 46, 0.88)', cardStroke: 'rgba(45, 212, 191, 0.3)',
    metricVal: '#2dd4bf', metricSub: '#cbd5e1',
    dashRule: 'rgba(45, 212, 191, 0.45)',
    commentTitle: '#fbbf24', commentText: '#fde68a', commentUnderline: 'rgba(251, 191, 36, 0.28)',
    sign: '#fca5a5', footer: '#64748b'
  } : {
    bg0: '#f7efd8', bg1: '#ede0bd', bg2: '#e0cca0',
    outerBorder: '#8c6f47', innerBorder: 'rgba(120, 90, 50, 0.5)',
    docNo: '#6b5336', title: '#1f160d', subtitle: '#5c462c', divider: '#4a3721',
    stampFill: 'rgba(169, 36, 36, 0.08)', stampStroke: '#a92424', stampText: '#a92424',
    infoFill: 'rgba(92, 70, 44, 0.09)', infoStroke: 'rgba(92, 70, 44, 0.3)',
    label: '#6b5336', value: '#1f160d',
    cardFill: 'rgba(255, 252, 242, 0.62)', cardStroke: 'rgba(120, 90, 50, 0.35)',
    metricVal: '#1f160d', metricSub: '#5c462c',
    dashRule: '#8c6f47',
    commentTitle: '#9e2222', commentText: '#8f1d1d', commentUnderline: 'rgba(158, 34, 34, 0.25)',
    sign: '#7c1c1c', footer: '#7c6444'
  };

  const tmpCanvas = document.createElement('canvas');
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.font = `600 22px ${fontSans}`;
  const commentLines = wrapCanvasText(tmpCtx, `“${d.comment}”`, contentW - 24);

  const H = 785 + Math.max(2, commentLines.length) * 34;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 1. 背景底色
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, palette.bg0);
  bg.addColorStop(0.55, palette.bg1);
  bg.addColorStop(1, palette.bg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (isCyber) {
    // 赛博蓝图网格与顶部青光
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 28; x < W; x += 28) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 28; y < H; y += 28) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    const glow = ctx.createRadialGradient(W / 2, 0, 20, W / 2, 0, W * 0.65);
    glow.addColorStop(0, 'rgba(45, 212, 191, 0.18)');
    glow.addColorStop(1, 'rgba(45, 212, 191, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  } else {
    const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.28, W / 2, H / 2, W * 0.72);
    vig.addColorStop(0, 'rgba(120, 86, 40, 0)');
    vig.addColorStop(1, 'rgba(92, 62, 26, 0.22)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  // 外框与内虚线框
  ctx.strokeStyle = palette.outerBorder;
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  ctx.save();
  ctx.strokeStyle = palette.innerBorder;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.restore();

  // 2. 页眉
  ctx.fillStyle = palette.docNo;
  ctx.font = `600 16px ${fontMono}`;
  const docPrefix = isCyber ? 'LAB TELEMETRY' : 'LAB REPORT';
  ctx.fillText(`${docPrefix} · NO. ${d.version.toUpperCase()} · ${d.dateStr}`, padX, 74);

  ctx.fillStyle = palette.title;
  ctx.font = `800 32px ${fontSans}`;
  ctx.fillText('「永动」实验台运行阶段性评估报告', padX, 118);

  ctx.fillStyle = palette.subtitle;
  ctx.font = `600 18px ${fontSans}`;
  ctx.fillText(d.stage, padX, 150);

  ctx.strokeStyle = palette.divider;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(padX, 170);
  ctx.lineTo(W - padX, 170);
  ctx.stroke();

  // 3. 右上角印章
  ctx.save();
  ctx.translate(W - 142, 108);
  ctx.rotate(0.14);
  ctx.fillStyle = palette.stampFill;
  ctx.strokeStyle = palette.stampStroke;
  ctx.lineWidth = 4;
  ctx.fillRect(-76, -38, 152, 76);
  ctx.strokeRect(-76, -38, 152, 76);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-70, -32, 140, 64);
  ctx.fillStyle = palette.stampText;
  ctx.font = `800 22px ${fontSans}`;
  ctx.textAlign = 'center';
  ctx.fillText(d.stampLine1, 0, -6);
  ctx.fillText(d.stampLine2, 0, 24);
  ctx.restore();
  ctx.textAlign = 'left';

  // 4. 人员与实验信息栏
  const infoY = 192;
  const infoH = 92;
  ctx.fillStyle = palette.infoFill;
  ctx.strokeStyle = palette.infoStroke;
  ctx.lineWidth = 1.5;
  ctx.fillRect(padX, infoY, contentW, infoH);
  ctx.strokeRect(padX, infoY, contentW, infoH);

  const drawField = (label, val, x, y) => {
    ctx.fillStyle = palette.label;
    ctx.font = `600 18px ${fontSans}`;
    ctx.fillText(label, x, y);
    const lw = ctx.measureText(label).width;
    ctx.fillStyle = palette.value;
    ctx.font = `700 18px ${fontSans}`;
    ctx.fillText(val, x + lw, y);
  };
  drawField('实验负责人：', '卢卡·巴尔萨', padX + 18, infoY + 34);
  drawField('实验助手：', d.assistant, padX + contentW / 2 + 8, infoY + 34);
  drawField('指导教授：', '阿尔瓦·洛伦兹', padX + 18, infoY + 70);
  drawField('最高装置：', d.highestUnit, padX + contentW / 2 + 8, infoY + 70);

  // 5. 六宫格完整实验数据
  const metrics = [
    { label: '累计产出能量', val: `${d.totalEnergy} E`, sub: `当前稳态：${d.eps} E/秒` },
    { label: '累计被打回次数', val: `共 ${d.totalRejects} 次`, sub: `本轮报告 ${d.reports} 次 · 论文初稿 ${d.drafts} 次` },
    { label: '正式答辩与专利', val: `答辩 ${d.defenses} 次`, sub: `${d.pp} PP · ${d.rp} RP · ${d.totalTT} TT` },
    { label: '质询挑战通关', val: `${d.challengesDone} / ${d.challengesMax} 次`, sub: d.ecDetail },
    { label: '实验台规模与超频', val: `${d.totalUnits} 台装置`, sub: `超频 Lv.${d.tickspeed} · L4献祭 ×${d.sacrificeMult}` },
    { label: '在岗黄油猫 · 成就进度', val: `${d.cats} 只 · ${d.achStr}`, sub: `历史最高 RP：${d.maxRp}` }
  ];
  const gap = 14;
  const boxW = (contentW - gap) / 2;
  const boxH = 104;
  const gridY = infoY + infoH + 20;

  metrics.forEach((m, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = padX + col * (boxW + gap);
    const y = gridY + row * (boxH + gap);

    ctx.fillStyle = palette.cardFill;
    ctx.strokeStyle = palette.cardStroke;
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeRect(x, y, boxW, boxH);

    ctx.fillStyle = palette.label;
    ctx.font = `600 15px ${fontSans}`;
    ctx.fillText(m.label, x + 16, y + 28);

    ctx.fillStyle = palette.metricVal;
    ctx.font = `800 23px ${fontMono}`;
    ctx.fillText(m.val, x + 16, y + 60);

    ctx.fillStyle = palette.metricSub;
    ctx.font = `500 13.5px ${fontMono}`;
    ctx.fillText(m.sub, x + 16, y + 86);
  });

  // 6. 阿尔瓦教授批语区
  const commentTop = gridY + boxH * 3 + gap * 2 + 24;
  ctx.save();
  ctx.strokeStyle = palette.dashRule;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(padX, commentTop);
  ctx.lineTo(W - padX, commentTop);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = palette.commentTitle;
  ctx.font = `700 18px ${fontSans}`;
  ctx.fillText(isCyber ? d.commentTitleCyber : d.commentTitleCanvasVintage, padX, commentTop + 34);

  ctx.fillStyle = palette.commentText;
  ctx.font = `600 22px ${fontSans}`;
  let curY = commentTop + 72;
  for (const line of commentLines) {
    ctx.fillText(line, padX + 10, curY);
    const lw = ctx.measureText(line).width;
    ctx.strokeStyle = palette.commentUnderline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX + 10, curY + 6);
    ctx.lineTo(padX + 10 + lw, curY + 6);
    ctx.stroke();
    curY += 34;
  }

  ctx.fillStyle = palette.sign;
  ctx.font = `700 20px ${fontSans}`;
  ctx.textAlign = 'right';
  ctx.fillText(d.commentSign, W - padX, curY + 12);

  // 7. 底部极简水印
  ctx.fillStyle = palette.footer;
  ctx.font = `500 14px ${fontSans}`;
  ctx.textAlign = 'center';
  const styleTag = isCyber ? '赛博终端版' : '复古手记版';
  ctx.fillText(`《卢卡的“永动”实验手记》 ${d.version} · ${styleTag} · 同人放置小游戏`, W / 2, H - 34);
  ctx.textAlign = 'left';

  return canvas;
}

function updateShareCanvasPreviewImg() {
  const canvas = drawShareReportCanvas(currentShareStyle);
  const dataUrl = canvas.toDataURL('image/png');
  const img = document.getElementById('shareGeneratedImg');
  const wrap = document.getElementById('shareImgPreviewWrap');
  if (img) img.src = dataUrl;
  if (wrap) wrap.style.display = 'block';
  return dataUrl;
}

function handleDownloadShareImage() {
  try {
    const dataUrl = updateShareCanvasPreviewImg();
    const d = getShareReportData(currentShareComment);
    const safeName = d.assistant.replace(/[\/:*?"<>|\s]+/g, '_');
    const styleSuffix = currentShareStyle === 'cyber' ? '赛博' : '复古';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `卢卡永动实验报告_${safeName}_${styleSuffix}_${d.version}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (typeof SFX !== 'undefined') SFX.playClick();
    if (state.settings && state.settings.assistantName && state.settings.assistantName.trim()) {
      unlockAchievement('ach_coauthor');
    }
    showToast(`🖼️ ${styleSuffix}风战绩分享图已生成（手机端可长按下方图片保存）`);
  } catch (e) {
    showToast('生成分享图失败，请改用「复制文字版战绩」。', 3200);
  }
}

function handleCopyShareText() {
  if (state.settings && state.settings.assistantName && state.settings.assistantName.trim()) {
    unlockAchievement('ach_coauthor');
  }
  const text = getShareText(currentShareComment);
  copyToClipboard(text, '文字版实验报告战绩已复制！快去分享给同好吧~', '请复制以下战绩分享文案：');
}

function handleManualSave() {
  saveGame();
  showToast('实验进度已手动保存！');
}

function handleExportToBox() {
  const b64 = exportSaveString();
  const box = document.getElementById('saveDataBox');
  if (box) {
    box.value = b64;
    box.focus();
    box.select();
  }
  addLog('📋 已导出 Base64 存档代码。');
  copyToClipboard(b64, '存档代码已导出并复制到剪贴板！');
}

function handleCopyDiagnostic() {
  const report = getDiagnosticReport();
  copyToClipboard(report, 'Bug 诊断包（含版本号与存档）已复制，可直接粘贴到邮件中！', '请复制以下诊断信息：');
}

function handleImportFromBox() {
  const box = document.getElementById('saveDataBox');
  const raw = box ? box.value : '';
  const res = importSaveString(raw);
  if (!res.ok) {
    showToast(`导入失败：${res.msg}`, 3400);
    return;
  }

  document.getElementById('tuneGrowthMult').value = state.tuning.growthMult;
  document.getElementById('tuneThesisReq').value = state.tuning.thesisReq;
  document.getElementById('tuneDefenseReq').value = state.tuning.defenseReq;
  document.getElementById('tuneTimeScale').value = state.tuning.timeScale;
  applySettingsToDOM();
  setBuyMode(state.buyMode || 1);
  renderAll();
  closeSettingsModal();
  showToast('📂 存档导入成功！欢迎回到实验室。');
}

function syncTabVisibility() {
  const gated = [
    { tab: 'shop',    btnId: 'tabShopBtn' },
    { tab: 'auto',    btnId: 'tabAutoBtn' },
    { tab: 'defense', btnId: 'tabDefenseBtn' }
  ];
  for (const g of gated) {
    const btn = document.getElementById(g.btnId);
    const unlocked = isTabUnlocked(g.tab);
    if (btn) btn.style.display = unlocked ? '' : 'none';
    if (!unlocked && state.activeTab === g.tab) {
      switchTab('lab');
    }
  }
}

function switchTab(tab) {
  if (!isTabUnlocked(tab)) tab = 'lab';
  state.activeTab = tab;
  const tabs = ['lab', 'shop', 'auto', 'defense', 'ach', 'stats'];
  for (const t of tabs) {
    const cap = t.charAt(0).toUpperCase() + t.slice(1);
    const panel = document.getElementById('tab' + cap);
    const btn = document.getElementById('tab' + cap + 'Btn');
    if (panel) panel.style.display = (tab === t) ? 'block' : 'none';
    if (btn) btn.classList.toggle('active-tab', tab === t);
  }
  const fab = document.getElementById('mobileFabMaxAll');
  if (fab) fab.classList.toggle('fab-visible', tab === 'lab');
  renderAll();
}

function setBuyMode(mode) {
  state.buyMode = mode;
  document.getElementById('buy1Btn').classList.toggle('active-toggle', mode === 1);
  document.getElementById('buy10Btn').classList.toggle('active-toggle', mode === 10);
  document.getElementById('buyMaxBtn').classList.toggle('active-toggle', mode === 'max');
  renderUnits();
}

function toggleTuning() {
  const c = document.getElementById('tuningCard');
  c.style.display = c.style.display === 'none' ? 'block' : 'none';
}

function updateTuning() {
  state.tuning.growthMult = Math.max(0.5, parseFloat(document.getElementById('tuneGrowthMult').value) || 1);
  state.tuning.thesisReq = Math.max(500, parseFloat(document.getElementById('tuneThesisReq').value) || 2.5e7);
  state.tuning.defenseReq = Math.max(100, parseFloat(document.getElementById('tuneDefenseReq').value) || 10000);
  state.tuning.timeScale = Math.max(1, parseFloat(document.getElementById('tuneTimeScale').value) || 1);
  saveGame();
  renderAll();
}

function renderEventBanner() {
  const banner = document.getElementById('eventBanner');
  if (!pendingEvent) {
    banner.style.display = 'none';
    return;
  }
  const c = COPY.randomEvents[pendingEvent.data.id];
  banner.style.display = 'flex';
  document.getElementById('eventBannerTitle').textContent = `${c.title}（剩余 ${Math.ceil(pendingEvent.expireIn)}s）`;
  document.getElementById('eventBannerDesc').textContent = c.desc;
  document.getElementById('eventActionBtn').textContent = c.btnText;
}

function renderChallengeBanner() {
  const bar = document.getElementById('challengeBanner');
  if (!state.activeChallenge) {
    bar.style.display = 'none';
    return;
  }
  const id = state.activeChallenge;
  const c = COPY.challenges[id];
  const goal = getChallengeGoal(id);
  const canComplete = state.rp >= goal;
  const extraInfo = (id === 'ec2')
    ? ` · 当前高熵效率：${(getEntropyPenalty() * 100).toFixed(2)}%`
    : '';

  bar.style.display = 'flex';
  document.getElementById('chBannerTitle').textContent =
    `⚖️ 质询挑战中：${c.name} (${getChallengeComp(id) + 1}/5)${extraInfo}`;
  document.getElementById('chBannerProgress').textContent =
    `当前 RP：${formatNum(state.rp)} / 目标 RP：${formatNum(goal)}`;

  const compBtn = document.getElementById('chCompleteBtn');
  compBtn.disabled = !canComplete;
  compBtn.textContent = canComplete ? '🏆 达标！提交质询结果' : '尚未达标';
}

function renderBuffBar() {
  const bar = document.getElementById('buffBar');
  if (activeBuffs.length === 0) {
    if (bar.innerHTML !== '') bar.innerHTML = '';
    return;
  }
  bar.innerHTML = activeBuffs.map(b => {
    const tags = [];
    if (b.epsMult > 1) tags.push(`产能×${b.epsMult}`);
    if (b.clickMult > 1) tags.push(`点击×${b.clickMult}`);
    return `<span class="buff-pill">⚡ ${b.name} (${tags.join(' / ')}) · ${Math.ceil(b.remaining)}s</span>`;
  }).join('');
}

function setProgressBar(barId, textId, current, target) {
  const ratio = Math.max(0, Math.min(1, target > 0 ? current / target : 1));
  const pct = (ratio * 100).toFixed(1);
  const bar = document.getElementById(barId);
  const txt = document.getElementById(textId);
  if (bar) bar.style.width = `${pct}%`;
  if (txt) txt.textContent = `${pct}%`;
}

function renderTop() {
  const stage = (getLayerCount('L4') > 0) ? '阶段 IV · AI与前沿'
    : (getLayerCount('L3') > 0) ? '阶段 III · 自控与信息'
    : (getLayerCount('L2') > 0) ? '阶段 II · 经典电磁学'
    : '阶段 I · 民科悖论';

  document.getElementById('stageBadge').textContent = stage;
  document.getElementById('energyVal').textContent = formatNum(state.energy);
  const curEps = getEpS();
  document.getElementById('epsVal').textContent = formatNum(curEps);
  const orbEl = document.getElementById('emOrbWrap');
  if (orbEl) {
    const speedSec = curEps > 0 ? Math.max(2.0, 13 - Math.log10(Math.max(1, curEps)) * 0.85) : 16;
    orbEl.style.setProperty('--orb-speed', `${speedSec.toFixed(2)}s`);
  }
  document.getElementById('clickVal').textContent = formatNum(getClickPower());
  document.getElementById('reportVal').textContent = `${state.reports} (×${getReportMult().toFixed(1)})`;
  document.getElementById('rpVal').textContent = formatNum(state.rp);
  document.getElementById('ppVal').textContent = formatNum(state.pp);

  const defCountEl = document.getElementById('defenseCountBadge');
  if (defCountEl) defCountEl.textContent = `已答辩 ${state.defenses} 次`;

  const tabRpBadge = document.getElementById('tabRpBadge');
  if (tabRpBadge) tabRpBadge.textContent = formatNum(state.rp);
  const tabAchBadge = document.getElementById('tabAchBadge');
  if (tabAchBadge) {
    tabAchBadge.textContent = `${getAchievementCount()}/${BALANCE.achievements.length}`;
  }

  // L1 实验报告
  const repReq = getReportReq();
  const repBtn = document.getElementById('reportBtn');
  repBtn.disabled = state.runEnergy < repReq;
  repBtn.textContent = state.runEnergy >= repReq
    ? `提交实验报告（倍率 → ×${(getReportMult() * (hasUpg('u_error') ? 2.5 : 2)).toFixed(1)}）`
    : `需本轮累计 ${formatNum(repReq)} E`;
  setProgressBar('reportProgBar', 'reportProgText', state.runEnergy, repReq);

  // L2 论文初稿
  const thesisReq = state.tuning.thesisReq || 2.5e7;
  const pendingRP = getPendingRP();
  const thBtn = document.getElementById('thesisBtn');
  thBtn.disabled = pendingRP <= 0;
  thBtn.textContent = pendingRP > 0
    ? `提交论文初稿 (+${formatNum(pendingRP)} RP)`
    : `需本轮累计 ${formatNum(thesisReq)} E`;
  setProgressBar('thesisProgBar', 'thesisProgText', state.runEnergy, thesisReq);

  // L3 正式答辩
  const defReq = state.tuning.defenseReq || 10000;
  const pendingPP = getPendingPP();
  const defBtn = document.getElementById('defenseBtn');
  defBtn.disabled = pendingPP <= 0;
  defBtn.textContent = pendingPP > 0
    ? `正式答辩 (+${formatNum(pendingPP)} PP)`
    : `需当前拥有 ${formatNum(defReq)} RP`;
  setProgressBar('defenseProgBar', 'defenseProgText', state.rp, defReq);

  document.getElementById('prestigeHints').textContent =
    `本轮产出 ${formatNum(state.runEnergy)} · 历史总产出 ${formatNum(state.totalEnergy)} · 交论文 ${state.totalDrafts} 次`;

  const showL2 = isPrestigeVisible(2);
  const showL3 = isPrestigeVisible(3);
  const l2El = document.getElementById('prestigeItemL2');
  const l3El = document.getElementById('prestigeItemL3');
  if (l2El) l2El.style.display = showL2 ? '' : 'none';
  if (l3El) l3El.style.display = showL3 ? '' : 'none';

  const pHint = document.getElementById('prestigeHiddenHint');
  if (pHint) pHint.style.display = 'none';

  renderBuffBar();
  renderChallengeBanner();

  syncTabVisibility();

  const setDot = (btnId, tabName, show) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.toggle('has-dot', show && isTabUnlocked(tabName) && state.activeTab !== tabName);
  };
  setDot('tabShopBtn', 'shop', hasAffordableShop());
  setDot('tabAutoBtn', 'auto', hasAffordableAuto());
  setDot('tabDefenseBtn', 'defense', hasAffordableDefense());
}

// 局部更新常规实验升级（防止 100ms 刷新吞点击）
function renderLabUpgrades() {
  if (state.activeTab !== 'lab') return;
  const cardWrap = document.getElementById('labUpgradesCard');
  const container = document.getElementById('labUpgradesContainer');

  if (!container.dataset.initialized) {
    container.innerHTML = '';
    for (const upg of BALANCE.labUpgrades) {
      const c = COPY.labUpgrades[upg.id];
      const card = document.createElement('div');
      card.id = `lab-upg-card-${upg.id}`;
      card.className = 'upgrade-card';
      card.style.display = 'none';
      card.innerHTML = `
        <div>
          <div class="between">
            <strong>${c.name}</strong>
            <span class="badge gold mono" id="lab-upg-badge-${upg.id}"></span>
          </div>
          <div style="font-size:12px; margin-top:4px;">${c.desc}</div>
          <div class="luca-quote" style="margin-top:3px;">${c.flavor}</div>
        </div>
        <button id="lab-upg-btn-${upg.id}" onclick="buyLabUpgrade('${upg.id}')"></button>
      `;
      container.appendChild(card);
    }
    container.dataset.initialized = '1';
  }

  let unlockedCount = 0;
  const hideBought = !!(state.settings && state.settings.hideBoughtLab);
  for (const upg of BALANCE.labUpgrades) {
    const card = document.getElementById(`lab-upg-card-${upg.id}`);
    const unlocked = isLabUpgradeUnlocked(upg);
    if (unlocked) unlockedCount++;

    const bought = hasLabUpg(upg.id);
    const shouldShow = unlocked && !(hideBought && bought);
    card.style.display = shouldShow ? '' : 'none';
    if (!shouldShow) continue;

    const canAfford = !bought && state.energy >= upg.cost;
    card.classList.toggle('bought', bought);
    document.getElementById(`lab-upg-badge-${upg.id}`).textContent = bought ? '已生效' : `${formatNum(upg.cost)} E`;

    const btn = document.getElementById(`lab-upg-btn-${upg.id}`);
    btn.disabled = !canAfford;
    btn.className = canAfford ? 'primary' : '';
    btn.textContent = bought ? '已购入' : `消耗 ${formatNum(upg.cost)} 能量购买`;
  }

  if (cardWrap) {
    cardWrap.style.display = unlockedCount > 0 ? 'block' : 'none';
  }
}

// 局部更新实验组件（防止 100ms 刷新吞点击，且仅显示已触发或快要可触发的组件）
function renderUnits() {
  if (state.activeTab !== 'lab') return;
  const container = document.getElementById('unitsContainer');

  if (!container.dataset.initialized) {
    container.innerHTML = '';
    for (const u of BALANCE.units) {
      const c = COPY.units[u.id];
      const div = document.createElement('div');
      div.id = `unit-card-${u.id}`;
      div.className = `unit-card layer-${u.layerGroup}`;
      div.style.display = 'none';
      div.innerHTML = `
        <div class="unit-top">
          <div class="unit-info">
            <div class="unit-title-row">
              <span class="unit-name">${c.name}</span>
              <span class="badge ${u.layerGroup}">${c.layer}</span>
            </div>
            <div class="unit-meta-row mono" id="unit-meta-${u.id}"></div>
          </div>
          <button class="unit-buy-btn mono" id="unit-btn-${u.id}" onclick="buyUnit('${u.id}'); renderAll();"></button>
        </div>
        <div class="unit-flavor">
          <div class="luca-quote">${c.luca}</div>
          <div class="science">${c.science}</div>
        </div>
      `;
      container.appendChild(div);
    }
    const hint = document.createElement('div');
    hint.id = 'unitsHiddenHint';
    hint.className = 'muted';
    hint.style.cssText = 'text-align:center; padding:8px 4px 2px; font-size:12px; display:none;';
    container.appendChild(hint);
    container.dataset.initialized = '1';
  }

  let hiddenCount = 0;
  const totalEps = getEpS();
  for (let i = 0; i < BALANCE.units.length; i++) {
    const u = BALANCE.units[i];
    const card = document.getElementById(`unit-card-${u.id}`);
    const visible = isUnitVisible(u, i);
    card.style.display = visible ? '' : 'none';
    if (!visible) {
      hiddenCount++;
      continue;
    }

    const count = state.units[u.id] || 0;
    const info = getBulkBuyInfo(u, state.buyMode);
    const disabledByEc1 = (state.activeChallenge === 'ec1' && u.layerGroup === 'L1');
    const canAfford = !disabledByEc1 && info.count > 0 && state.energy >= info.cost;

    const unitEps = getUnitEpS(u);
    const pct = totalEps > 0 ? ((unitEps / totalEps) * 100).toFixed(1) : '0.0';
    const metaEl = document.getElementById(`unit-meta-${u.id}`);
    metaEl.textContent = `拥有 ${count} · 产出 ${formatNum(unitEps)}/s (${pct}%) · 里程碑 ×${getMilestoneMult(count).toFixed(1)} · r=${getEffectiveR(u).toFixed(3)}`;

    const btn = document.getElementById(`unit-btn-${u.id}`);
    btn.disabled = !canAfford;
    btn.className = `unit-buy-btn mono${canAfford ? ' primary' : ''}`;
    btn.textContent = disabledByEc1
      ? '质询挑战禁用'
      : `买 ${info.count > 0 ? info.count : 1} 个 (${formatNum(info.cost)})`;
  }

  const hintEl = document.getElementById('unitsHiddenHint');
  if (hintEl) hintEl.style.display = 'none';
}

function renderShop() {
  if (state.activeTab !== 'shop') return;
  document.getElementById('shopRpDisplay').textContent = formatNum(state.rp);
  document.getElementById('draftCountDisplay').textContent = state.totalDrafts;

  const container = document.getElementById('shopContainer');
  container.innerHTML = '';
  let hiddenCount = 0;

  for (const upg of BALANCE.rpUpgrades) {
    if (!isRpUpgradeVisible(upg)) {
      hiddenCount++;
      continue;
    }
    const c = COPY.rpUpgrades[upg.id];
    const lvl = getUpgLevel(upg.id);
    const isMaxed = !upg.repeatable && lvl > 0;
    const cost = upg.repeatable ? upg.baseCost * Math.pow(upg.costMult || 4, lvl) : upg.cost;
    const canAfford = !isMaxed && state.rp >= cost;

    const card = document.createElement('div');
    card.className = 'upgrade-card' + (isMaxed ? ' bought' : '');
    card.innerHTML = `
      <div>
        <div class="between">
          <strong>[${upg.tier}] ${c.name}${upg.repeatable ? ` (Lv.${lvl})` : ''}</strong>
          <span class="badge red mono">${isMaxed ? '已购入' : `${formatNum(cost)} RP`}</span>
        </div>
        <div style="font-size:12px; margin-top:5px;">${c.desc}</div>
        <div class="luca-quote" style="margin-top:4px;">${c.flavor}</div>
      </div>
      <button id="shop-upg-btn-${upg.id}" ${canAfford ? 'class="thesis-btn"' : ''} ${canAfford ? '' : 'disabled'} onclick="buyRpUpgrade('${upg.id}')">
        ${isMaxed ? '已生效' : `消耗 ${formatNum(cost)} RP 购买`}
      </button>
    `;
    container.appendChild(card);
  }


}

function syncShopStates() {
  if (state.activeTab !== 'shop') return;
  const rpEl = document.getElementById('shopRpDisplay');
  if (rpEl) rpEl.textContent = formatNum(state.rp);
  const draftEl = document.getElementById('draftCountDisplay');
  if (draftEl) draftEl.textContent = state.totalDrafts;

  for (const upg of BALANCE.rpUpgrades) {
    const visible = isRpUpgradeVisible(upg);
    const btn = document.getElementById(`shop-upg-btn-${upg.id}`);
    if (visible && !btn) {
      renderShop();
      return;
    }
    if (!visible || !btn) continue;
    const lvl = getUpgLevel(upg.id);
    const isMaxed = !upg.repeatable && lvl > 0;
    const cost = upg.repeatable ? upg.baseCost * Math.pow(upg.costMult || 4, lvl) : upg.cost;
    const canAfford = !isMaxed && state.rp >= cost;
    btn.disabled = !canAfford;
    btn.className = canAfford ? 'thesis-btn' : '';
  }
}

function renderAuto() {
  if (state.activeTab !== 'auto') return;
  const container = document.getElementById('autoContainer');
  container.innerHTML = '';
  let hiddenCount = 0;

  for (const a of BALANCE.automators) {
    if (!isAutomatorVisible(a)) {
      hiddenCount++;
      continue;
    }
    const c = COPY.automators[a.id];
    const st = state.autos[a.id];
    const curInterval = BALANCE.autoIntervals[st.speedLvl || 0];
    const nextSpeedCost = BALANCE.autoSpeedCosts[st.speedLvl || 0];

    const div = document.createElement('div');
    div.className = 'item-box';
    div.innerHTML = `
      <div class="between">
        <div>
          <strong>${c.name}</strong>
          <span class="badge ${st.unlocked ? '' : 'red'} mono">
            ${st.unlocked ? (st.enabled ? `运行中 (${curInterval}s/次)` : `已暂停 (${curInterval}s/次)`) : `需 ${a.cost} RP 解锁`}
          </span>
          <div class="luca-quote" style="margin-top:3px;">${c.flavor}</div>
        </div>
        <div class="row">
          ${st.unlocked ? `
            ${a.isReport
              ? `<button class="${state.autoReportStopAtThesis ? 'active-toggle' : ''}" onclick="toggleAutoReportStopAtThesis()" title="开启后，当本轮能量已足够提交论文初稿时，暂停自动提交实验报告，避免误清进度">${state.autoReportStopAtThesis ? '达论文门槛暂停：开' : '达论文门槛暂停：关'}</button>`
              : ''}
            ${nextSpeedCost !== undefined
              ? `<button id="auto-speed-btn-${a.id}" ${state.rp >= nextSpeedCost ? 'class="thesis-btn"' : ''} ${state.rp >= nextSpeedCost ? '' : 'disabled'} onclick="upgradeAutoSpeed('${a.id}')">提速 (${nextSpeedCost} RP)</button>`
              : `<span class="badge gold">已满速</span>`}
            <button class="${st.enabled ? 'primary' : ''}" onclick="toggleAutomator('${a.id}')">${st.enabled ? '点击暂停' : '点击开启'}</button>
          ` : `
            <button id="auto-unlock-btn-${a.id}" ${state.rp >= a.cost ? 'class="thesis-btn"' : ''} ${state.rp >= a.cost ? '' : 'disabled'} onclick="unlockAutomator('${a.id}')">消耗 ${a.cost} RP 解锁</button>
          `}
        </div>
      </div>
    `;
    container.appendChild(div);
  }

}

function syncAutoStates() {
  if (state.activeTab !== 'auto') return;
  for (const a of BALANCE.automators) {
    const visible = isAutomatorVisible(a);
    const st = state.autos[a.id];
    const unlockBtn = document.getElementById(`auto-unlock-btn-${a.id}`);
    const speedBtn = document.getElementById(`auto-speed-btn-${a.id}`);
    if (visible && !st.unlocked && !unlockBtn) {
      renderAuto();
      return;
    }
    if (!visible) continue;
    if (!st.unlocked && unlockBtn) {
      const canUnlock = state.rp >= a.cost;
      unlockBtn.disabled = !canUnlock;
      unlockBtn.className = canUnlock ? 'thesis-btn' : '';
    } else if (st.unlocked && speedBtn) {
      const nextCost = BALANCE.autoSpeedCosts[st.speedLvl || 0];
      if (nextCost !== undefined) {
        const canSpeed = state.rp >= nextCost;
        speedBtn.disabled = !canSpeed;
        speedBtn.className = canSpeed ? 'thesis-btn' : '';
      }
    }
  }
}


function handleRenamePreset(slotIdx) {
  const cur = (state.paradigmPresets && state.paradigmPresets[slotIdx]) ? state.paradigmPresets[slotIdx].name : '';
  const next = window.prompt('请输入新的配装预设名称（最多 18 字）：', cur);
  if (next !== null && next.trim()) {
    renameParadigmPreset(slotIdx, next);
    showToast(`预设已重命名为「${next.trim().slice(0, 18)}」`);
  }
}

function renderParadigmPresets() {
  const box = document.getElementById('paradigmPresetsContainer');
  if (!box || !Array.isArray(state.paradigmPresets)) return;
  box.innerHTML = state.paradigmPresets.map((preset, idx) => {
    const nodes = Array.isArray(preset.nodes) ? preset.nodes : [];
    const totalCost = nodes.reduce((sum, id) => {
      const p = BALANCE.paradigms.find(x => x.id === id);
      return sum + (p ? p.costTT : 0);
    }, 0);
    const nodeNames = nodes
      .map(id => COPY.paradigms[id] ? COPY.paradigms[id].name : id)
      .join(' + ');
    return `
      <div class="preset-card">
        <div>
          <div class="between">
            <strong style="font-size:12.5px; color:var(--text);">${escapeHtml(preset.name)}</strong>
            <span class="badge ${nodes.length ? 'gold' : ''} mono">${nodes.length ? `${totalCost} TT` : '空'}</span>
          </div>
          <div class="preset-nodes">${nodes.length ? escapeHtml(nodeNames) : '尚未保存范式节点'}</div>
        </div>
        <div class="row" style="gap:5px;">
          <button ${nodes.length ? 'class="primary"' : 'disabled'} style="flex:1; padding:4px 8px;" onclick="loadParadigmPreset(${idx})">一键载入</button>
          <button style="padding:4px 8px;" onclick="saveParadigmPreset(${idx})">保存当前</button>
          <button class="ghost" style="padding:4px 6px;" title="重命名预设" onclick="handleRenamePreset(${idx})">✏️</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderDefense() {
  if (state.activeTab !== 'defense') return;
  const activeBranches = getActiveParadigmBranches().size;
  const maxBranches = getMaxParadigmBranches();
  document.getElementById('ttSummary').textContent =
    `可用学分：${getAvailableTT()} / ${getTotalTT()} TT · 分支上限：${activeBranches}/${maxBranches}（8次答辩双修，15次全修）`;

  document.getElementById('ttBuyRow').innerHTML = `
    <button id="tt-buy-e" ${state.energy >= getTTCost('e') ? 'class="primary"' : 'disabled'} onclick="buyTT('e')">用能量买 1 TT (${formatNum(getTTCost('e'))} E)</button>
    <button id="tt-buy-rp" ${state.rp >= getTTCost('rp') ? 'class="thesis-btn"' : 'disabled'} onclick="buyTT('rp')">用 RP 买 1 TT (${formatNum(getTTCost('rp'))} RP)</button>
    <button id="tt-buy-pp" ${state.pp >= getTTCost('pp') ? 'class="report-btn" style="width:auto;"' : 'disabled'} onclick="buyTT('pp')">用 PP 买 1 TT (${formatNum(getTTCost('pp'))} PP)</button>
    <button onclick="respecParadigms()">免费洗点</button>
  `;

  renderParadigmPresets();

  const pBox = document.getElementById('paradigmContainer');
  pBox.innerHTML = '';
  let hiddenParadigms = 0;
  for (const p of BALANCE.paradigms) {
    if (!isParadigmVisible(p)) {
      hiddenParadigms++;
      continue;
    }
    const c = COPY.paradigms[p.id];
    const bought = hasParadigm(p.id);
    const unlocked = !p.req || hasParadigm(p.req);
    const branchAllowed = canPickParadigmBranch(p.branch);
    const canBuy = !bought && unlocked && branchAllowed && getAvailableTT() >= p.costTT;
    let btnText = `消耗 ${p.costTT} TT 点亮`;
    if (bought) btnText = '生效中';
    else if (!unlocked) btnText = '需先点亮前置节点';
    else if (!branchAllowed) btnText = '已达分支上限（可洗点切换）';
    const card = document.createElement('div');
    card.className = 'upgrade-card' + (bought ? ' bought' : '');
    card.innerHTML = `
      <div>
        <div class="between">
          <strong>[${c.branch}] ${c.name}</strong>
          <span class="badge gold mono">${bought ? '已点亮' : `${p.costTT} TT`}</span>
        </div>
        <div style="font-size:12px; margin-top:4px;">${c.desc}</div>
        <div class="luca-quote" style="margin-top:3px;">${c.flavor}</div>
      </div>
      <button ${canBuy ? 'class="primary"' : 'disabled'} onclick="buyParadigm('${p.id}')">
        ${btnText}
      </button>
    `;
    pBox.appendChild(card);
  }


  const mBox = document.getElementById('milestoneContainer');
  mBox.innerHTML = COPY.defenseMilestones.map(m => {
    const reached = hasMilestone(m.req);
    const autoToggle = (m.req === 4 && reached)
      ? `<button class="${state.autoThesisEnabled ? 'primary' : ''}" onclick="toggleAutoThesis()" style="margin-left:8px;">自动交论文：${state.autoThesisEnabled ? '开' : '关'}</button>`
      : '';
    const autoThresholdRow = (m.req === 4 && reached)
      ? `<div class="row" style="margin-top:8px; gap:6px; align-items:center;">
           <span class="muted" style="font-size:12px;">自动交稿阈值（至少可领 RP）：</span>
           <input type="number" min="1" step="1" value="${state.autoThesisMinRP || 1}" onchange="setAutoThesisMinRP(this.value)" style="width:120px; margin-top:0; padding:4px 7px; font-size:12px;" title="设为更大数值可避免破壁后刚过线就被瞬间重置" />
         </div>`
      : '';
    return `
      <div class="item-box" style="${reached ? 'border-color: rgba(52, 211, 153, 0.35); background: rgba(16, 42, 34, 0.55);' : ''}">
        <div class="between">
          <strong>${m.req} 次答辩 · ${m.name}</strong>
          <div><span class="badge ${reached ? '' : 'red'}">${reached ? '已达成' : '未达成'}</span>${autoToggle}</div>
        </div>
        <div style="font-size:12px; margin-top:4px;">${m.desc}</div>
        <div class="luca-quote" style="margin-top:3px;">${m.flavor}</div>
        ${autoThresholdRow}
      </div>
    `;
  }).join('');

  renderChallenges();
}

function syncDefenseStates() {
  if (state.activeTab !== 'defense') return;
  const eBtn = document.getElementById('tt-buy-e');
  if (eBtn) {
    const canE = state.energy >= getTTCost('e');
    eBtn.disabled = !canE;
    eBtn.className = canE ? 'primary' : '';
  }
  const rpBtn = document.getElementById('tt-buy-rp');
  if (rpBtn) {
    const canRp = state.rp >= getTTCost('rp');
    rpBtn.disabled = !canRp;
    rpBtn.className = canRp ? 'thesis-btn' : '';
  }
  const ppBtn = document.getElementById('tt-buy-pp');
  if (ppBtn) {
    const canPp = state.pp >= getTTCost('pp');
    ppBtn.disabled = !canPp;
    ppBtn.className = canPp ? 'report-btn' : '';
    ppBtn.style.width = 'auto';
  }
}

function renderChallenges() {
  if (state.activeTab !== 'defense') return;
  const cardEl = document.getElementById('challengeCard');
  const unlocked = isChallengesSectionUnlocked();
  if (cardEl) cardEl.style.display = unlocked ? '' : 'none';
  if (!unlocked) return;
  const box = document.getElementById('challengeContainer');
  box.innerHTML = '';

  let hiddenCh = 0;
  for (let idx = 0; idx < BALANCE.challenges.length; idx++) {
    const ch = BALANCE.challenges[idx];
    if (!isChallengeVisible(ch, idx)) {
      hiddenCh++;
      continue;
    }
    const c = COPY.challenges[ch.id];
    const comp = getChallengeComp(ch.id);
    const isMax = comp >= ch.maxComp;
    const isRunning = state.activeChallenge === ch.id;
    const goal = getChallengeGoal(ch.id);

    const card = document.createElement('div');
    card.className = 'upgrade-card' + (isMax ? ' bought' : '');
    card.innerHTML = `
      <div>
        <div class="between">
          <strong>${c.name}</strong>
          <span class="badge ${isMax ? '' : 'gold'} mono">通关 ${comp}/${ch.maxComp}</span>
        </div>
        <div style="font-size:12px; color:var(--red-soft); margin-top:5px;">限制：${c.restriction}</div>
        <div style="font-size:12px; color:var(--green-soft); margin-top:4px;">奖励：${c.rewardDesc}</div>
        <div class="luca-quote" style="margin-top:4px;">${c.quote}</div>
      </div>
      <div class="between" style="margin-top:6px;">
        <span class="muted mono">${isMax ? '已全部通关' : `目标：${formatNum(goal)} RP`}</span>
        ${isRunning
          ? `<button class="thesis-btn" onclick="exitChallenge()">退出当前挑战</button>`
          : `<button ${isMax ? 'disabled' : 'class="primary"'} onclick="requestChallengeConfirm('${ch.id}')">${isMax ? '已满级' : '接受质询'}</button>`
        }
      </div>
    `;
    box.appendChild(card);
  }

}

function buildAchievementCard(a) {
  const unlocked = hasAchievement(a.id);
  const c = COPY.achievements[a.id];
  const isSecretLocked = a.hidden && !unlocked;

  const card = document.createElement('div');
  card.className = 'upgrade-card' + (unlocked ? ' bought' : '');
  const titleText = isSecretLocked ? '？？？' : c.name;
  const badgeText = unlocked ? '已解锁' : (a.hidden ? '隐藏彩蛋' : '未达成');
  const badgeCls = unlocked ? '' : (a.hidden ? 'gold' : 'red');
  const descText = isSecretLocked ? '条件：未知的实验室彩蛋，留心身边的细节吧……' : `条件：${c.desc}`;
  const flavorText = unlocked ? c.flavor : '？？？';

  let extraBtn = '';
  if (a.hasCG) {
    extraBtn = `
      <button ${unlocked ? 'class="primary"' : 'disabled'} onclick="openCgModal('${a.id}')">
        ${unlocked ? '🖼️ 查看黑历史 CG' : '解锁成就后可查看 CG'}
      </button>
    `;
  }

  card.innerHTML = `
    <div>
      <div class="between">
        <strong>${unlocked ? '🏅' : '🔒'} ${titleText}</strong>
        <span class="badge ${badgeCls}">${badgeText}</span>
      </div>
      <div style="font-size:12px; margin-top:4px;">${descText}</div>
      <div class="luca-quote" style="margin-top:3px;">${flavorText}</div>
    </div>
    ${extraBtn}
  `;
  return card;
}

function renderAchievements() {
  if (state.activeTab !== 'ach') return;
  const count = getAchievementCount();
  const total = BALANCE.achievements.length;
  const bonusPct = ((getAchievementMult() - 1) * 100).toFixed(0);
  document.getElementById('achSummary').textContent =
    `总计解锁 ${count}/${total} · 永久全局加成 +${bonusPct}%`;

  const mainBox = document.getElementById('achMainContainer');
  const easterBox = document.getElementById('achEasterContainer');
  if (!mainBox || !easterBox) return;
  mainBox.innerHTML = '';
  easterBox.innerHTML = '';

  let easterUnlocked = 0;
  let easterTotal = 0;

  for (const a of BALANCE.achievements) {
    const card = buildAchievementCard(a);
    if (a.cat === 'easter') {
      easterTotal++;
      if (hasAchievement(a.id)) easterUnlocked++;
      easterBox.appendChild(card);
    } else {
      mainBox.appendChild(card);
    }
  }

  const easterSum = document.getElementById('achEasterSummary');
  if (easterSum) easterSum.textContent = `已发现 ${easterUnlocked}/${easterTotal} 个彩蛋`;
}

// --- 顶部快讯点击互动与隐藏反物质菜单 ---
function handleTickerClick() {
  const txtEl = document.getElementById('tickerText');
  const curText = txtEl ? txtEl.textContent : '';
  state.tickerClicks = (state.tickerClicks || 0) + 1;
  if (typeof SFX !== 'undefined') SFX.playClick();

  if (curText.includes('猫薄荷森林中的一只小猫')) {
    unlockAchievement('ach_kg_forest');
    showToast('🌿 喵！你点进了猫薄荷森林，但这里除了黑猫什么也没有。');
  } else if (curText.includes('弯折成一个回形针') || curText.includes('把这根铁丝弯折')) {
    if ((state.energy || 0) < 1) {
      showToast('📎 能量不足 1 E！先手动扰动一次实验台，再借它一点能量弯折铁丝吧。', 3000);
    } else {
      state.energy -= 1;
      state.paperclips = (state.paperclips || 0) + 1;
      addLog(`📎 你借出了 1 E 能量，帮未知 AI 把一根铁丝弯折成了回形针（当前共拥有 ${state.paperclips} 个毫无用处的回形针）。`);
      showToast(`📎 咔哒！失去 1 E，获得了 1 个回形针（共 ${state.paperclips} 个）。某台 AI 记住了你的慷慨。`, 3400);
      unlockAchievement('ach_up_paperclip');
      renderTop();
      if (state.activeTab === 'stats') renderStats();
    }
  } else if (curText.includes('免费领取 1000 份')) {
    showToast('🎣 阿尔瓦：“巴尔萨同学，在广播里发钓鱼链接是想多写三千字检讨吗？”', 3200);
  } else if (curText.includes('第 九 维 度 泄 漏')) {
    showToast('🌀 都说了不要点！还好什么都没发生——大概吧。');
  } else if (curText.includes('lkjhg') || curText.includes('qwerty') || curText.includes('asdzxc') || curText.includes('踩在了') || curText.includes('踩了过去')) {
    showToast('🐈‍⬛ 喵呜——（黑猫被你从键盘上抱了下来，并留下了一根黑毛）', 2800);
  } else if (curText.includes('大卡车')) {
    showToast('🐈‍⬛ 阿尔瓦：“它只是骨架比较大，而且最近毛发比较蓬松。”', 2800);
  } else if (state.tickerClicks === 1) {
    showToast('📻 卢卡：“别戳收音机啦，这是学院广播站！”');
  }
  if (state.tickerClicks >= 10) {
    unlockAchievement('ach_ad_news_click');
  }
  saveGame();
}



function openCgModal(id) {
  const a = BALANCE.achievements.find(x => x.id === id);
  const c = COPY.achievements[id];
  if (!a || !c || !hasAchievement(id)) return;

  document.getElementById('cgModalTitle').textContent = c.cgTitle || c.name;
  const mediaBox = document.getElementById('cgMediaContainer');

  if (a.cgImg) {
    mediaBox.innerHTML = `<img src="${a.cgImg}" alt="${c.name}" class="cg-img" />`;
  } else {
    mediaBox.innerHTML = `
      <div class="cg-placeholder">
        <div style="color: var(--gold); font-weight: 700; margin-bottom: 6px;">🎨 实验手稿记录</div>
        <div style="font-size: 13px; color: var(--text);">${c.cgDesc}</div>
      </div>
    `;
  }

  document.getElementById('cgModal').style.display = 'flex';
}

function closeCgModal() { document.getElementById('cgModal').style.display = 'none'; }

function renderLogs() {
  document.getElementById('logBox').innerHTML = state.logs
    .map(l => `<div class="log-line"><span class="time">[${l.time}]</span>${l.text}</div>`)
    .join('');
}


function renderTickspeedAndSacrifice() {
  if (state.activeTab !== 'lab') return;
  const grid = document.getElementById('boostGrid');
  const tsCard = document.getElementById('tickspeedCard');
  const sacCard = document.getElementById('sacrificeCard');
  if (!grid || !tsCard || !sacCard) return;

  const showTs = isTickspeedVisible();
  const showSac = isSacrificeVisible();
  grid.style.display = (showTs || showSac) ? 'grid' : 'none';
  tsCard.style.display = showTs ? 'flex' : 'none';
  sacCard.style.display = showSac ? 'flex' : 'none';

  if (showTs) {
    const lvl = state.tickspeed || 0;
    const step = getTickspeedStep();
    const mult = getTickspeedMult();
    const cost = getTickspeedCost();
    const canBuy = isFinite(cost) && state.energy >= cost;

    document.getElementById('tsLevelBadge').textContent = `Lv.${lvl} · ×${formatNum(mult)}`;
    document.getElementById('tsDesc').textContent =
      `每级使全实验台产出 ×${step.toFixed(3)}（每份实验报告额外 +0.015，上限 ×1.35）`;

    const oneBtn = document.getElementById('tsBuyOneBtn');
    oneBtn.disabled = !canBuy;
    oneBtn.className = `mono${canBuy ? ' primary' : ''}`;
    oneBtn.textContent = `超频 +1 (${formatNum(cost)} E)`;

    const maxBtn = document.getElementById('tsBuyMaxBtn');
    maxBtn.disabled = !canBuy;
    maxBtn.className = `mono${canBuy ? ' primary' : ''}`;
  }

  if (showSac) {
    const cur = state.sacrificeMult || 1;
    const target = getSacrificeTargetMult();
    const ok = canSacrifice();
    const fodder = getSacrificeFodderCount();

    document.getElementById('sacCurBadge').textContent = `L4 ×${formatNum(cur)}`;
    document.getElementById('sacDesc').textContent =
      `清空当前 ${fodder} 台 L1~L3 装置，为所有 L4 组件提供本轮过载倍率（保留能量、升级与 L4 组件）。`;

    const sacBtn = document.getElementById('sacActionBtn');
    sacBtn.disabled = !ok;
    sacBtn.textContent = ok
      ? `执行过载献祭：×${formatNum(cur)} → ×${formatNum(target)}`
      : (getLayerCount('L4') <= 0 ? '需拥有至少 1 台 L4 组件' : `当前收益不足 +5%（目标 ×${formatNum(target)}）`);
  }
}

function renderStats() {
  if (state.activeTab !== 'stats') return;
  const runBadge = document.getElementById('statsRunTimeBadge');
  if (runBadge) runBadge.textContent = `本轮运行 ${formatDuration(state.runTime || 0)}`;

  const totalComp = BALANCE.challenges.reduce((sum, ch) => sum + getChallengeComp(ch.id), 0);
  const maxComp = BALANCE.challenges.reduce((sum, ch) => sum + ch.maxComp, 0);
  const visibleAch = BALANCE.achievements.filter(a => !a.hidden || hasAchievement(a.id)).length;

  const tiles = [
    { label: '历史总产出能量', val: `${formatNum(state.totalEnergy)} E` },
    { label: '本轮累计能量', val: `${formatNum(state.runEnergy)} E` },
    { label: '当前稳态产能', val: `${formatNum(getEpS())} E/s` },
    { label: '手动点击收益', val: `${formatNum(getClickPower())} E/次` },
    { label: '实验报告 / 论文 / 答辩', val: `${state.reports} / ${state.totalDrafts} / ${state.defenses}` },
    { label: '历史最高 RP', val: `${formatNum(state.maxRpEver || 0)} RP` },
    { label: '超频刻度 / L4 献祭', val: `Lv.${state.tickspeed || 0} · ×${formatNum(state.sacrificeMult || 1)}` },
    { label: '组件总数 / 黄油猫', val: `${getTotalUnitsCount()} 台 · ${state.units.butteredCat || 0} 只` },
    { label: '质询挑战 / 成就', val: `${totalComp}/${maxComp} · ${getAchievementCount()}/${visibleAch}` }
  ];
  if ((state.antimatter || 0) > 0) {
    tiles.push({ label: '反物质', val: `你拥有 ${state.antimatter} 个毫无用处的反物质` });
  }
  if ((state.paperclips || 0) > 0) {
    tiles.push({ label: '回形针', val: `你拥有 ${state.paperclips} 个毫无用处的回形针` });
  }

  const gridEl = document.getElementById('statsGeneralGrid');
  if (gridEl) {
    gridEl.innerHTML = tiles.map(t => `
      <div class="stat-tile">
        <div class="stat-tile-label">${t.label}</div>
        <div class="stat-tile-val mono">${t.val}</div>
      </div>
    `).join('');
  }

  // Layer share bar
  const layers = ['L1', 'L2', 'L3', 'L4'];
  const layerEps = { L1: 0, L2: 0, L3: 0, L4: 0 };
  for (const u of BALANCE.units) {
    layerEps[u.layerGroup] += getUnitEpS(u);
  }
  const totalEps = Object.values(layerEps).reduce((a, b) => a + b, 0);
  const barEl = document.getElementById('layerShareBar');
  const legendEl = document.getElementById('layerShareLegend');
  if (barEl && legendEl) {
    if (totalEps <= 0) {
      barEl.innerHTML = '';
      legendEl.textContent = '暂无产能';
    } else {
      barEl.innerHTML = layers.map(lg => {
        const pct = (layerEps[lg] / totalEps) * 100;
        return pct > 0 ? `<div class="layer-seg-${lg}" style="width:${pct.toFixed(2)}%;" title="${lg}: ${pct.toFixed(1)}%"></div>` : '';
      }).join('');
      legendEl.textContent = layers.map(lg => `${lg} ${((layerEps[lg] / totalEps) * 100).toFixed(1)}%`).join(' · ');
    }
  }

  // Multiplier breakdown table
  const { rows, totalGlobal } = getMultiplierBreakdown();
  const totalBadge = document.getElementById('statsTotalMultBadge');
  if (totalBadge) totalBadge.textContent = `全局总计 ×${formatNum(totalGlobal)}`;

  const tbody = document.getElementById('multBreakdownBody');
  if (tbody) {
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.name}</strong></td>
        <td class="muted">${r.note}</td>
        <td class="val mono">×${formatNum(r.mult)}</td>
      </tr>
    `).join('') + `
      <tr class="total-row">
        <td colspan="2">全局产出总倍率（乘算合计）</td>
        <td class="val mono" style="color:var(--gold);">×${formatNum(totalGlobal)}</td>
      </tr>
    `;
  }

  const l4Hint = document.getElementById('statsL4ExtraHint');
  if (l4Hint) {
    l4Hint.textContent = `注：以上为全组件共享的全局倍率；此外，各组件还独立享有数量里程碑（×1.5~×15）、常规实验升级、跨层联动，以及 L4 专属的「过载献祭 ×${formatNum(state.sacrificeMult || 1)}」。`;
  }

  const throwBtn = document.getElementById('throwEnergyBtn');
  const throwHint = document.getElementById('throwEnergyHint');
  if (throwBtn) throwBtn.disabled = (state.energy || 0) < 10;
  if (throwHint) {
    const thrown = state.thrownEnergyCount || 0;
    if (thrown === 0) throwHint.textContent = '实验台角落有一块微微发凉的空地。';
    else if (thrown < 10) throwHint.textContent = `地上已经消散了 ${thrown * 10} 点能量，似乎毫无意义。`;
    else throwHint.textContent = `地上已经累计消散了 ${thrown * 10} 点能量，地板微微暖和了一点。`;
  }
}

function renderAll() {
  renderTop();
  renderTickspeedAndSacrifice();
  renderLabUpgrades();
  renderUnits();
  renderShop();
  renderAuto();
  renderDefense();
  renderAchievements();
  renderStats();
  renderLogs();
}

function buildDynamicTickerPool() {
  const pool = [...(COPY.tickerNews || [])];
  const occult = COPY.tickerOccultNews || [];
  const late = COPY.tickerLateNews || [];

  const progressedMid = (state.reports || 0) >= 1 || (state.totalDrafts || 0) >= 1 || getLayerCount('L2') > 0;
  const progressedLate = getLayerCount('L3') > 0 || (state.totalDrafts || 0) >= 1 || (state.defenses || 0) >= 1;

  if (occult.length) {
    if (progressedMid) pool.push(...occult);
    else pool.push(occult[0], occult[1]);
  }
  if (late.length && progressedLate) {
    pool.push(...late);
  }

  // 读取真实状态的动态快讯
  const cats = state.units.butteredCat || 0;
  if (cats >= 5) {
    pool.push(`据统计，实验室当前挤着 ${cats} 只黄油猫，动物保护协会的马车正在距离学院 3 公里的地方全速赶来。`);
  }
  if ((state.totalClicks || 0) >= 30) {
    pool.push(`实验助手，你已经帮卢卡手动敲了 ${state.totalClicks} 次实验台，扳手都要磨出火星子了，建议喝口水歇会儿。`);
  }
  const totalRejects = (state.reports || 0) + (state.totalDrafts || 0);
  if (totalRejects >= 3) {
    pool.push(`累计已被阿尔瓦教授退回 ${totalRejects} 次，但卢卡墙上的错题本看起来居然颇具现代艺术气息。`);
  }
  if ((state.antimatter || 0) > 0) {
    pool.push(`提醒：实验台角落里仍然静静躺着 ${state.antimatter} 个毫无用处的反物质，请勿拿它当镇纸。`);
  }
  if ((state.paperclips || 0) > 0) {
    pool.push(`提醒：实验台抽屉里莫名多出了 ${state.paperclips} 个回形针，且它们的数量似乎随时准备指数级增长。`);
  }
  if ((state.thrownEnergyCount || 0) > 0) {
    pool.push(`实验室地板今天微微发烫——大概是因为某位实验助手已经往地上扔了 ${state.thrownEnergyCount * 10} 点能量。`);
  }
  return pool;
}

let recentTickerHistory = [];

function maybeCorruptWithCatKeyboard(htmlStr) {
  if (!htmlStr || htmlStr.includes('<span') || htmlStr.includes('lkjhg') || htmlStr.includes('qwerty')) {
    return htmlStr;
  }
  const hasCat = (state.units && (state.units.butteredCat || 0) >= 1) || (state.reports || 0) >= 1;
  if (!hasCat || Math.random() >= 0.11) return htmlStr;

  const plain = String(htmlStr);
  if (plain.length < 18) return htmlStr;
  const cutPos = Math.floor(plain.length * (0.42 + Math.random() * 0.28));
  const smashes = [
    '——；lkjhgfdsa[p0987654321mnbvcxz',
    'asdzxcvbnm,./；lkjhgfdsa[09876543=',
    '——qwertyuiop[]asdfghjkl;zxcvbnm',
    '；’【】、=-0987654321poiuytrewq'
  ];
  const smash = smashes[Math.floor(Math.random() * smashes.length)];
  return `${escapeHtml(plain.slice(0, cutPos))}${smash} <span class="muted">（广播中断：黑猫刚刚从控制台键盘上踩了过去）</span>`;
}

function rotateTicker() {
  const pool = buildDynamicTickerPool();
  if (!pool.length) return;

  const maxHistory = Math.min(28, Math.max(5, Math.floor(pool.length * 0.55)));
  if (recentTickerHistory.length > maxHistory) {
    recentTickerHistory = recentTickerHistory.slice(-maxHistory);
  }

  let candidates = pool.filter(item => !recentTickerHistory.includes(item));
  if (candidates.length === 0) {
    const lastShown = recentTickerHistory[recentTickerHistory.length - 1];
    recentTickerHistory = lastShown ? [lastShown] : [];
    candidates = pool.filter(item => item !== lastShown);
    if (candidates.length === 0) candidates = pool;
  }

  // Fisher-Yates 洗牌抽选
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const rawChosen = candidates[0] || '';
  recentTickerHistory.push(rawChosen);

  const displayHtml = maybeCorruptWithCatKeyboard(rawChosen);
  const el = document.getElementById('tickerText');
  if (!el) return;

  const isFast = displayHtml.includes('ticker-fast');
  el.classList.toggle('ticker-speed-fast', isFast);
  if (isFast) {
    el.style.animationDuration = '';
  } else {
    const jitterSec = (18.5 + Math.random() * 6.5).toFixed(1);
    el.style.animationDuration = `${jitterSec}s`;
  }
  el.innerHTML = displayHtml;
}

function showOfflineReport(report) {
  if (!report) return;
  const pool = (state.units.butteredCat || 0) > 0
    ? COPY.offlineQuotes.withCat
    : COPY.offlineQuotes.noCat;
  const catQuote = pool[Math.floor(Math.random() * pool.length)];

  const capHint = report.capped ? '（已达 24 小时单次结算上限）' : '';
  const parts = [
    `离线时长：${formatDuration(report.elapsedSec)}${capHint}`,
    `能量产出：+${formatNum(report.gainedEnergy)}`
  ];
  if (report.gainedRP > 0) parts.push(`收获 RP：+${formatNum(report.gainedRP)}`);
  if (report.autoUnitsBought > 0) parts.push(`自动采购：+${report.autoUnitsBought} 台`);
  if (report.autoTickspeedBought > 0) parts.push(`自动超频：+${report.autoTickspeedBought} 级`);
  if (report.autoReportsTriggered > 0) parts.push(`自动实验报告：${report.autoReportsTriggered} 次`);
  if (report.autoThesesTriggered > 0) parts.push(`自动论文初稿：${report.autoThesesTriggered} 次`);

  showModal('实验室 · 离线报告', catQuote, parts.join(' · '), false);
}


// --- 转生前确认弹窗 ---
let pendingPrestigeType = null;

function toggleSkipPrestigeConfirmSetting() {
  state.settings.skipPrestigeConfirm = !state.settings.skipPrestigeConfirm;
  saveGame();
  syncSettingsUI();
  showToast(state.settings.skipPrestigeConfirm ? '已开启：跳过提交前确认弹窗' : '已恢复提交前确认弹窗');
}

function toggleSkipPrestigeConfirmFromModal() {
  const el = document.getElementById('skipPrestigeConfirmCheck');
  state.settings.skipPrestigeConfirm = !!(el && el.checked);
  saveGame();
  syncSettingsUI();
}

function closePrestigeConfirmModal() {
  pendingPrestigeType = null;
  const el = document.getElementById('prestigeConfirmModal');
  if (el) el.style.display = 'none';
}

function confirmPrestigeAction() {
  const type = pendingPrestigeType;
  closePrestigeConfirmModal();
  if (type === 'report') submitReport(false);
  else if (type === 'thesis') submitThesis(false);
  else if (type === 'defense') submitDefense();
}

function requestPrestigeConfirm(type) {
  if (type === 'report' && state.runEnergy < getReportReq()) return;
  if (type === 'thesis' && getPendingRP() <= 0) return;
  if (type === 'defense' && getPendingPP() <= 0) return;

  if (state.settings && state.settings.skipPrestigeConfirm) {
    if (type === 'report') submitReport(false);
    else if (type === 'thesis') submitThesis(false);
    else if (type === 'defense') submitDefense();
    return;
  }

  pendingPrestigeType = type;
  const titleEl = document.getElementById('pcTitle');
  const subEl = document.getElementById('pcSubtitle');
  const gainEl = document.getElementById('pcGainList');
  const resetEl = document.getElementById('pcResetList');
  const keepEl = document.getElementById('pcKeepList');
  const btnEl = document.getElementById('pcConfirmBtn');
  const checkEl = document.getElementById('skipPrestigeConfirmCheck');
  if (checkEl) checkEl.checked = !!(state.settings && state.settings.skipPrestigeConfirm);

  const prevCats = state.units.butteredCat || 0;
  const keptCats = hasUpg('u_cans') ? Math.min(50, Math.ceil(prevCats * 0.2)) : 0;

  if (type === 'report') {
    const stepMult = hasUpg('u_error') ? 2.5 : 2.0;
    const curMult = getReportMult();
    const nextMult = curMult * stepMult;
    titleEl.textContent = '📄 确认提交实验报告？';
    subEl.textContent = '清空当前实验台，换取永久产出倍率以推进下一轮实验。';
    gainEl.innerHTML = `
      <li>已退回实验报告次数：<strong>${state.reports} 次 → ${state.reports + 1} 次</strong></li>
      <li>全局产出倍率永久翻倍：<strong>×${curMult.toFixed(1)} → ×${nextMult.toFixed(1)}</strong>（单次 ×${stepMult.toFixed(1)}）</li>
      <li>推进「论文初稿」的解锁进度</li>
    `;
    resetEl.innerHTML = `
      <li>当前有效能量 (E) 与本轮累计能量清零${hasUpg('u_wire') ? '（快捷接线将保留 150 开局能量）' : ''}</li>
      <li>所有 10 级实验组件数量归零${keptCats > 0 && state.activeChallenge !== 'ec1' ? `（罐头基金将保留 <strong>${keptCats}</strong> 只黄油猫）` : ''}</li>
      <li>本轮购入的「常规实验升级」全部清空</li>
    `;
    keepEl.innerHTML = `
      <li>红笔批注 (RP)、红笔商店升级、自动化外包与提速等级</li>
      <li>专利点数 (PP)、范式树学分、挑战通关数与所有成就</li>
    `;
    btnEl.className = 'report-btn';
    btnEl.style.width = 'auto';
    btnEl.textContent = `确认提交（倍率 ×${nextMult.toFixed(1)}）`;
  } else if (type === 'thesis') {
    const gainRP = getPendingRP();
    const nextRP = state.rp + gainRP;
    titleEl.textContent = '📕 确认提交论文初稿？';
    subEl.textContent = '以当前整轮实验积累换取「红笔批注 (RP)」，解锁永久天赋与自动化！';
    gainEl.innerHTML = `
      <li>立即获得 <strong>+${formatNum(gainRP)} RP</strong>（交稿后总计 <strong>${formatNum(nextRP)} RP</strong>）</li>
      <li>累计提交论文初稿次数：<strong>${state.totalDrafts} 次 → ${state.totalDrafts + 1} 次</strong>${hasUpg('u_frame') ? `（错题本裱框加成提升至 ×${(1 + 0.5 * (state.totalDrafts + 1)).toFixed(1)}）` : ''}</li>
      <li>可在「红笔商店」购买永久天赋，或在「自动化」解锁自动买组件</li>
    `;
    resetEl.innerHTML = `
      <li>当前能量、本轮累计能量、所有实验组件与常规实验升级${keptCats > 0 && state.activeChallenge !== 'ec1' ? `（罐头基金保留 <strong>${keptCats}</strong> 只黄油猫）` : ''}</li>
      <li><strong>已退回实验报告次数归零</strong>（倍率重置回 ×1.0${hasUpg('u_wire') ? '；快捷接线开局自带 1 份报告与 150 E' : ''}）</li>
    `;
    keepEl.innerHTML = `
      <li>所有已购的「红笔商店」升级与「自动化外包」模块</li>
      <li>专利点数 (PP)、范式树、质询挑战进度与全部成就</li>
    `;
    btnEl.className = 'thesis-btn';
    btnEl.style.width = 'auto';
    btnEl.textContent = `确认交稿 (+${formatNum(gainRP)} RP)`;
  } else if (type === 'defense') {
    const gainPP = getPendingPP();
    const nextPP = state.pp + gainPP;
    const nextMult = 1 + nextPP * 2;
    const nextDefCount = state.defenses + 1;
    const newMilestone = COPY.defenseMilestones.find(m => m.req === nextDefCount);

    titleEl.textContent = '🎓 确认进行正式答辩？';
    subEl.textContent = '最高层级的学术飞跃：重置前两层所有进度，换取强大的「专利点数 (PP)」与永久答辩里程碑！';
    gainEl.innerHTML = `
      <li>获得 <strong>+${formatNum(gainPP)} PP</strong>（答辩后共 <strong>${formatNum(nextPP)} PP</strong>，全局产出常驻 <strong>×${nextMult.toFixed(0)}</strong>）</li>
      <li>累计正式答辩次数：<strong>${state.defenses} 次 → ${nextDefCount} 次</strong></li>
      ${newMilestone ? `<li>🎉 将达成答辩里程碑【<strong>${newMilestone.name}</strong>】：${newMilestone.desc}</li>` : ''}
    `;
    const willKeepAuto = nextDefCount >= 1;
    const willKeepBreak = nextDefCount >= 2;
    const willKeepCats = nextDefCount >= 15;
    resetEl.innerHTML = `
      <li>能量、实验组件、常规升级与实验报告次数${willKeepCats ? `（荣誉顾问小猫将保留 ${prevCats} 只黄油猫与猫猫升级）` : ''}</li>
      <li><strong>全部红笔批注 (RP) 与红笔商店升级</strong>${willKeepBreak ? '（免审通道将保留「绕过初审（破壁）」与「教授的怒火」）' : ''}</li>
      ${willKeepAuto ? '' : '<li><strong>自动化外包解锁状态与提速等级</strong></li>'}
    `;
    keepEl.innerHTML = `
      ${willKeepAuto ? '<li>自动化外包解锁状态与提速等级（由「实验室编制转正」里程碑永久保留）</li>' : ''}
      <li>已有的专利点数 (PP)、理论学分 (TT) 与跨学科范式树</li>
      <li>已达成的答辩里程碑、质询挑战通关次数与全部成就</li>
    `;
    btnEl.className = 'defense-btn';
    btnEl.style.width = 'auto';
    btnEl.textContent = `确认答辩 (+${formatNum(gainPP)} PP)`;
  }

  document.getElementById('prestigeConfirmModal').style.display = 'flex';
}


// --- 质询挑战进入前确认弹窗 ---
let pendingChallengeId = null;

function closeChallengeConfirmModal() {
  pendingChallengeId = null;
  const el = document.getElementById('challengeConfirmModal');
  if (el) el.style.display = 'none';
}

function confirmChallengeEntry() {
  const id = pendingChallengeId;
  closeChallengeConfirmModal();
  if (id) enterChallenge(id);
}

function requestChallengeConfirm(id) {
  if (!isChallengesSectionUnlocked()) return;
  const ch = BALANCE.challenges.find(x => x.id === id);
  const c = COPY.challenges[id];
  if (!ch || !c || getChallengeComp(id) >= ch.maxComp) return;
  if (state.activeChallenge === id) return;

  pendingChallengeId = id;
  const comp = getChallengeComp(id);
  const goal = getChallengeGoal(id);

  document.getElementById('ccTitle').textContent = `⚖️ 接受质询：${c.name}`;
  document.getElementById('ccSubtitle').textContent = `第 ${comp + 1} / ${ch.maxComp} 次质询挑战`;
  document.getElementById('ccQuote').textContent = c.quote;

  document.getElementById('ccGoalList').innerHTML = `
    <li><strong>通关目标：</strong>在本次质询中累计拥有 <strong>${formatNum(goal)} RP</strong>（达标后在顶部横幅点击「提交质询结果」即可通关）</li>
    <li><strong>永久奖励：</strong>${c.rewardDesc}</li>
  `;

  let limitItems = [];
  if (id === 'ec1') {
    limitItems = [
      '<strong>不能购买与使用 L1 组件：</strong>仓鼠动能跑轮、黄油猫反重力阵列、饮水鸟矩阵全部禁用且产出归零。',
      '常规猫猫升级与跨层猫猫加成在本次挑战中失效。'
    ];
  } else if (id === 'ec2') {
    limitItems = [
      '<strong>高熵指数衰减：</strong>全局产出随时间持续下降（最低可降至 0.01%）。',
      '购买新组件或主频超频可将当前衰减减半；提交「实验报告」或「论文初稿」可重置衰减。'
    ];
  } else if (id === 'ec3') {
    limitItems = [
      '<strong>不能手动点击：</strong>禁用手动扰动实验台与电磁球点击。',
      '<strong>禁用随机事件：</strong>挑战期间不会刷新突发事件（进入时将清空当前未领取的事件与生效中的 Buff）。',
      'L1 与 L2 组件的产出被大幅削弱（开平方 EpS^0.5）。'
    ];
  } else if (id === 'ec4') {
    limitItems = [
      '<strong>仅电磁学组件产出：</strong>只有莱顿瓶、特斯拉线圈、超导线圈能产出能量。',
      '其余 7 种组件产出归零（但仍可购买以触发跨层联动与升级效果）。'
    ];
  }
  document.getElementById('ccLimitList').innerHTML = limitItems.map(x => `<li>${x}</li>`).join('');

  const keepBreak = hasMilestone(2);
  document.getElementById('ccResetList').innerHTML = `
    <li>当前有效能量、本轮累计能量、所有实验组件与常规实验升级</li>
    <li>本轮实验报告次数、主频超频等级与 L4 过载献祭倍率</li>
    <li><strong>当前红笔批注 (RP)、累计论文初稿次数与红笔商店升级</strong>${keepBreak ? '（免审绿色通道将保留「绕过初审（破壁）」与「教授的怒火」）' : ''}</li>
  `;

  let grantLine = '若在红笔商店购入「快捷接线」，开局自带 150 E；否则从 0 能量起步。';
  if (id === 'ec1' || id === 'ec4') {
    grantLine = '<strong>学院特批启动经费：1.00e5 E</strong>（可直接购买首台「琥珀棒与莱顿瓶」启动；0 产能前自动化不会误花经费）。';
  } else if (id === 'ec3') {
    grantLine = '<strong>学院特批启动经费：150 E</strong>（无需手动点击即可直接购置仓鼠启动）。';
  }
  document.getElementById('ccKeepList').innerHTML = `
    <li><strong>开局发放：</strong>${grantLine}</li>
    <li><strong>永久保留：</strong>专利点数 (PP)、理论学分 (TT) 与跨学科范式树（建议挑战前先洗点切换对应流派）</li>
    <li><strong>永久保留：</strong>所有已解锁的自动化外包及提速等级、答辩里程碑、历史质询通关数与全部成就</li>
  `;

  document.getElementById('challengeConfirmModal').style.display = 'flex';
}

// 键盘快捷键：M 一键 Max All；Esc 关闭弹窗
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeHardResetModal();
    closeChallengeConfirmModal();
    closeShareModal();
    closePrestigeConfirmModal();
    closeSettingsModal();
    closeChangelogModal();
    closeAboutModal();
    closeCgModal();
    closeModal();
    return;
  }
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.key === 'm' || e.key === 'M') {
    buyAllMax();
  }
});

function initGame() {
  loadGame();
  const offlineReport = processOfflineProgress();

  const verEl = document.getElementById('versionTag');
  if (verEl) verEl.textContent = BALANCE.version;

  document.getElementById('tuneGrowthMult').value = state.tuning.growthMult;
  document.getElementById('tuneThesisReq').value = state.tuning.thesisReq;
  document.getElementById('tuneDefenseReq').value = state.tuning.defenseReq;
  document.getElementById('tuneTimeScale').value = state.tuning.timeScale;

  applySettingsToDOM();
  setBuyMode(state.buyMode || 1);
  switchTab(state.activeTab || 'lab');
  rotateTicker();
  renderAll();

  if (offlineReport) showOfflineReport(offlineReport);

  const tickerEl = document.getElementById('tickerText');
  if (tickerEl) {
    tickerEl.addEventListener('animationiteration', rotateTicker);
  }

  window.addEventListener('pointerdown', recordUserInteraction, { passive: true });
  window.addEventListener('keydown', recordUserInteraction, { passive: true });

  window._tickIntervalId = setInterval(tick, 100);
  window._saveIntervalId = setInterval(saveGame, 3000);
}

window.addEventListener('DOMContentLoaded', initGame);
