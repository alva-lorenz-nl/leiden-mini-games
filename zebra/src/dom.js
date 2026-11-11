/* 轻量 DOM 工具，避免各模块重复拼节点 */
const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(text, onClick, className = "btn") {
  const node = el("button", className, text);
  node.onclick = onClick;
  return node;
}

/* 统一消息区的文字与状态样式："" | "ok" | "no" */
function setMessage(id, text, kind = "") {
  const node = $(id);
  node.textContent = text;
  node.className = "msg" + (kind ? " " + kind : "");
}

function toggleHidden(id, hidden) {
  $(id).classList.toggle("hidden", hidden);
}

function formatClock(sec) {
  sec = Math.round(sec);
  const m = Math.floor(sec / 60),
    s = sec % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}
