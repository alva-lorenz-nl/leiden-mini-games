#!/usr/bin/env bash
# ============================================================
# deploy.sh — 永动轮实验室日常 · 一键静态部署脚本
# 用法：
#   sudo bash deploy.sh                  # 默认部署到 /var/www/lab_idle
#   sudo bash deploy.sh /你的/网站根目录  # 部署到指定目录
# ============================================================

set -euo pipefail

TARGET_DIR="${1:-/var/www/lab_idle}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FILES=(
  "index.html"
  "style.css"
  "balance.js"
  "story.js"
  "ticker.js"
  "changelog.js"
  "scene.js"
  "game.js"
)

echo ">>> 准备部署「永动轮实验室日常」"
echo "    源目录: ${SRC_DIR}"
echo "    目标目录: ${TARGET_DIR}"

# 检查必需文件
for f in "${FILES[@]}"; do
  if [[ ! -f "${SRC_DIR}/${f}" ]]; then
    echo "错误：缺少必需文件 ${f}，请确认脚本在 lab_idle_project 目录内运行。"
    exit 1
  fi
done

# 创建目标目录并复制静态文件
mkdir -p "${TARGET_DIR}"
for f in "${FILES[@]}"; do
  cp -f "${SRC_DIR}/${f}" "${TARGET_DIR}/${f}"
done

# 修正静态文件权限（目录 755，文件 644）
chmod 755 "${TARGET_DIR}"
for f in "${FILES[@]}"; do
  chmod 644 "${TARGET_DIR}/${f}"
done

echo ">>> 静态文件已同步完成。"

# 如果服务器装了 Nginx 且正在运行，自动检查配置并平滑重载
if command -v nginx >/dev/null 2>&1; then
  if nginx -t >/dev/null 2>&1; then
    if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
      systemctl reload nginx
      echo ">>> 已平滑重载 Nginx。"
    fi
  else
    echo "提示：检测到 Nginx，但配置测试未通过，请手动执行 sudo nginx -t 检查。"
  fi
fi

echo ">>> 部署完成！现在可以通过浏览器访问你的站点。"
