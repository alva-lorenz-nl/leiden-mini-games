/* ---------------- 同步码 ---------------- */
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

function doExport() {
  // Store progress only; achievements are derived from these fields.
  const payload = JSON.stringify({
    v: 3,
    d: [...new Set(REC.done || [])],
    w: [...new Set(REC.wins || [])],
    s: [...new Set(REC.story || [])],
    y: [...new Set(REC.daily || [])],
    t: REC.solved || {},
  });
  const body = b64enc(payload);
  const code = "ZBR3-" + body + "-" + checksum(body);
  const box = document.getElementById("syncBox");
  box.classList.remove("hidden");
  document.getElementById("syncLabel").textContent =
    "本地进度码 · 包含题目、成就进度与统计，不含游玩流水，不上传服务器";
  document.getElementById("syncText").value = code;
  document.getElementById("syncText").select();
  try {
    document.execCommand("copy");
  } catch (e) {}
}
function doImport() {
  const box = document.getElementById("syncBox");
  box.classList.remove("hidden");
  document.getElementById("syncLabel").textContent =
    "把另一台设备的同步码粘进来";
  document.getElementById("syncText").value = "";
  document.getElementById("syncText").focus();
}
function syncConfirm() {
  const txt = document.getElementById("syncText").value.trim();
  if (!txt) return;
  if (txt.startsWith("ZBR1-") || txt.startsWith("ZBR3-")) {
    const body = txt.slice(5);
    const cut = body.lastIndexOf("-");
    if (cut < 0) return alert("同步码不完整。");
    const payload = body.slice(0, cut),
      sum = body.slice(cut + 1);
    if (checksum(payload) !== sum)
      return alert("同步码校验失败，可能复制时漏了字符。");
    try {
      const data = JSON.parse(b64dec(payload));
      const compact = data.v === 3;
      const strings = (value) => {
        if (!Array.isArray(value) || value.some((x) => typeof x !== "string"))
          throw new Error("Invalid progress");
        return [...new Set(value)];
      };
      const story = compact ? data.s : data.story || [];
      if (
        !Array.isArray(story) ||
        story.some((x) => !Number.isInteger(x) || x < 0 || x >= CHAPTERS.length)
      )
        throw new Error("Invalid story");
      const stats = (compact ? data.t : data.solved) || {};
      const solved = {};
      for (const key of Object.keys(DIFF_NAMES)) {
        if (!stats[key]) continue;
        const { n, best, total } = stats[key];
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
      const next = {
        solved,
        done: strings((compact ? data.d : data.done) || []),
        wins: strings((compact ? data.w : data.wins) || []),
        story: [...new Set(story)],
        daily: strings((compact ? data.y : data.daily) || []),
        history: compact ? [] : Array.isArray(data.history) ? data.history : [],
      };
      REC = next;
      saveRec(REC);
      renderStats();
      document.getElementById("syncBox").classList.add("hidden");
      alert("档案已导入。");
    } catch (e) {
      alert("同步码解析失败。");
    }
  } else {
    alert("这不像是一个同步码。");
  }
}
