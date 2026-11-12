/* 进度码：Base64 编码 + 校验和，仅用于手动跨设备迁移 */
const SYNC_PREFIX = "ZBR3-";

function b64enc(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/=+$/, "");
}

function b64dec(b64) {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function checksum(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/* 只导出进度字段；成就由这些字段重建，游玩流水不上传也不进码 */
function exportPayload() {
  return JSON.stringify({
    v: 3,
    d: [...new Set(REC.done || [])],
    w: [...new Set(REC.wins || [])],
    s: [...new Set(REC.story || [])],
    y: [...new Set(REC.daily || [])],
    t: REC.solved || {},
  });
}

function showSyncBox(label, value) {
  $("syncBox").classList.remove("hidden");
  $("syncLabel").textContent = label;
  $("syncText").value = value;
}

function doExport() {
  const body = b64enc(exportPayload());
  showSyncBox(
    "本地进度码 · 包含题目、成就进度与统计，不含游玩流水，不上传服务器",
    SYNC_PREFIX + body + "-" + checksum(body),
  );
  $("syncText").select();
  try {
    document.execCommand("copy");
  } catch (e) {}
}

function doImport() {
  showSyncBox("把另一台设备的同步码粘进来", "");
  $("syncText").focus();
}

function stringsOf(value) {
  if (!Array.isArray(value) || value.some((x) => typeof x !== "string"))
    throw new Error("Invalid progress");
  return [...new Set(value)];
}

function statsOf(data, compact) {
  const raw = (compact ? data.t : data.solved) || {};
  const solved = {};
  for (const key of Object.keys(DIFF_NAMES)) {
    const stat = raw[key];
    if (!stat) continue;
    const { n, best, total } = stat;
    if (
      !Number.isInteger(n) ||
      n < 0 ||
      !Number.isFinite(total) ||
      total < 0 ||
      !(best === null || (Number.isFinite(best) && best >= 0))
    )
      throw new Error("Invalid stats");
    solved[key] = { n, best, total };
  }
  return solved;
}

/* 校验并还原一份进度；任何字段不合法都拒绝导入，不覆盖本机档案 */
function decodeProgress(text) {
  const body = text.slice(5);
  const cut = body.lastIndexOf("-");
  if (cut < 0) throw syncError("incomplete");
  const payload = body.slice(0, cut),
    sum = body.slice(cut + 1);
  if (checksum(payload) !== sum) throw syncError("checksum");
  const data = JSON.parse(b64dec(payload));
  const compact = data.v === 3;
  const story = compact ? data.s : data.story || [];
  if (
    !Array.isArray(story) ||
    story.some((x) => !Number.isInteger(x) || x < 0 || x >= CHAPTERS.length)
  )
    throw new Error("Invalid story");
  return {
    solved: statsOf(data, compact),
    done: stringsOf((compact ? data.d : data.done) || []),
    wins: stringsOf((compact ? data.w : data.wins) || []),
    story: [...new Set(story)],
    daily: stringsOf((compact ? data.y : data.daily) || []),
    history: compact ? [] : Array.isArray(data.history) ? data.history : [],
  };
}

function syncError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function syncConfirm() {
  const txt = $("syncText").value.trim();
  if (!txt) return;
  if (!txt.startsWith("ZBR1-") && !txt.startsWith(SYNC_PREFIX))
    return alert("这不像是一个同步码。");
  try {
    REC = decodeProgress(txt);
  } catch (e) {
    return alert(
      e.code === "incomplete"
        ? "同步码不完整。"
        : e.code === "checksum"
          ? "同步码校验失败，可能复制时漏了字符。"
          : "同步码解析失败。",
    );
  }
  saveRec(REC);
  renderStats();
  $("syncBox").classList.add("hidden");
  alert("档案已导入。");
}
