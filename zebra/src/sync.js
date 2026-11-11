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
  const payload = JSON.stringify({ ...REC, v: 2 });
  const body = b64enc(payload);
  const code = "ZBR1-" + body + "-" + checksum(body);
  const box = document.getElementById("syncBox");
  box.classList.remove("hidden");
  document.getElementById("syncLabel").textContent =
    "同步码（复制到别的设备粘贴导入）";
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
  if (txt.startsWith("ZBR1-")) {
    const body = txt.slice(5);
    const cut = body.lastIndexOf("-");
    if (cut < 0) return alert("同步码不完整。");
    const payload = body.slice(0, cut),
      sum = body.slice(cut + 1);
    if (checksum(payload) !== sum)
      return alert("同步码校验失败，可能复制时漏了字符。");
    try {
      const data = JSON.parse(b64dec(payload));
      REC.solved = data.solved || {};
      REC.done = data.done || [];
      REC.history = data.history || [];
      REC.story = data.story || [];
      REC.daily = data.daily || [];
      REC.wins = data.wins || [];
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
