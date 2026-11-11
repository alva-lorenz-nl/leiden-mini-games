#!/bin/sh
# Server-side schedule entrypoint. UTC host: run hourly, with an exclusive lock.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PYTHON=${ZEBRA_PYTHON:-/data/AstrBot/.venv/bin/python}
exec 9>"/tmp/leiden-zebra-daily.lock"
flock -n 9 || exit 0
cd "$ROOT"
"$PYTHON" zebra/daily.py
if git diff --quiet -- zebra/data/daily.json; then
    # Retry a previously failed push even if generation was already committed.
    git push origin main
    exit 0
fi
"$PYTHON" zebra/build.py
node zebra/tests/ui.cjs
python3 build_index.py
DEST=${ZEBRA_SITE_DIR:-/data/games/cat-walk/minigames}
mkdir -p "$DEST"
cp zebra_puzzle.html "$DEST/zebra_puzzle.html.tmp"
mv "$DEST/zebra_puzzle.html.tmp" "$DEST/zebra_puzzle.html"
git add zebra/data/daily.json zebra_puzzle.html index.html
git -c user.name='Alva Lorenz' -c user.email='alvalorenz@zohomail.com' commit -m 'chore(zebra): archive new daily puzzles'
git push origin main
