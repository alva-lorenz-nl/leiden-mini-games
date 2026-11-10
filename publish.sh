#!/bin/sh
# 发布：同步到站点目录（cat-walk/minigames 已在 .gitignore 里），再推 GitHub
set -e
SRC=$(cd "$(dirname "$0")" && pwd)
DST=/data/games/cat-walk/minigames
mkdir -p "$DST"
cp "$SRC"/*.html "$DST"/
cd "$SRC"
git add -A
git -c user.name="Alva Lorenz" -c user.email="alvalorenz@zohomail.com" commit -q -m "${1:-update mini games}" || echo "（没有改动）"
git push origin main
echo "已发布：https://alva-lorenz.top/minigames/"
