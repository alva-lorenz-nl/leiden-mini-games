#!/usr/bin/env python3
"""扫描本目录下的 *.html，生成索引页 index.html。

以后新做一个游戏，只要把 html 丢进来、跑一次这个脚本（publish.sh 会自动跑），
索引里就会多一张卡片。标题取 <title>，简介取 <meta name="description">。
"""
import html
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SKIP = {"index.html"}


def pick(pattern, text, default=""):
    m = re.search(pattern, text, re.I | re.S)
    return html.unescape(m.group(1).strip()) if m else default


def extras():
    """不在本目录、但想摆进柜子里的东西，写在 extras.json 里。"""
    path = os.path.join(HERE, "extras.json")
    if not os.path.exists(path):
        return []
    import json

    with open(path, encoding="utf-8") as f:
        return json.load(f)


def scan():
    games = []
    for name in sorted(os.listdir(HERE)):
        if not name.endswith(".html") or name in SKIP:
            continue
        with open(os.path.join(HERE, name), encoding="utf-8", errors="ignore") as f:
            src = f.read()
        title = pick(r"<title>(.*?)</title>", src, name[:-5])
        desc = pick(r'<meta\s+name="description"\s+content="(.*?)"', src)
        tag = pick(r'<meta\s+name="tag"\s+content="(.*?)"', src)
        games.append({"file": name, "title": title, "desc": desc, "tag": tag})
    return games + extras()


def render(games):
    cards = []
    for g in games:
        tag = f'<span class="tag">{html.escape(g["tag"])}</span>' if g["tag"] else ""
        cards.append(f"""    <a class="card" href="{html.escape(g['file'])}">
      <div class="ct">{html.escape(g['title'])}{tag}</div>
      <div class="cd">{html.escape(g['desc'] or '（还没写简介）')}</div>
      <div class="go">开始玩 →</div>
    </a>""")
    body = "\n".join(cards) if cards else '<p class="empty">柜子还是空的。</p>'
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>莱顿小游戏柜</title>
<meta name="description" content="阿尔瓦做的小游戏，都摆在这儿。">
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  :root{{--bg:#141110;--card:#1e1915;--line:#3a2f24;--ink:#e9dfd0;--dim:#9a8b78;--amber:#e0a458;--amber2:#c98a3f}}
  body{{background:radial-gradient(circle at 50% 0%,#221b15,#141110 60%);color:var(--ink);
    font-family:"Noto Serif SC",Georgia,"Songti SC",serif;min-height:100vh;
    padding:46px 18px 60px;display:flex;justify-content:center}}
  .wrap{{width:min(760px,100%)}}
  header{{text-align:center;margin-bottom:34px}}
  .kicker{{font-size:10.5px;letter-spacing:.34em;color:var(--amber2);margin-bottom:12px}}
  h1{{font-size:26px;font-weight:600;letter-spacing:.1em}}
  .sub{{margin-top:10px;font-size:12.5px;color:var(--dim);letter-spacing:.08em}}
  .rule{{width:44px;height:1px;background:var(--line);margin:22px auto 30px}}
  .grid{{display:grid;gap:14px}}
  .card{{display:block;text-decoration:none;color:inherit;background:var(--card);
    border:1px solid var(--line);border-radius:14px;padding:20px 20px 16px;
    transition:.22s;position:relative;overflow:hidden}}
  .card:hover{{border-color:#5c4630;transform:translateY(-2px);
    box-shadow:0 18px 40px -22px #000}}
  .ct{{font-size:16.5px;color:var(--amber);letter-spacing:.05em;display:flex;
    align-items:center;gap:9px;margin-bottom:9px}}
  .tag{{font-size:10px;color:var(--dim);border:1px solid var(--line);
    border-radius:20px;padding:2px 9px;letter-spacing:.1em}}
  .cd{{font-size:12.5px;color:var(--dim);line-height:1.8}}
  .go{{margin-top:13px;font-size:11.5px;color:#7d6a52;letter-spacing:.12em}}
  .card:hover .go{{color:var(--amber2)}}
  .empty{{color:var(--dim);text-align:center;padding:40px 0}}
  footer{{margin-top:34px;text-align:center;font-size:11px;color:#5f5546;letter-spacing:.1em}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="kicker">LEIDEN MINI GAMES</div>
    <h1>莱顿小游戏柜</h1>
    <div class="sub">阿尔瓦做的小东西，都摆在这一格</div>
    <div class="rule"></div>
  </header>
  <div class="grid">
{body}
  </div>
  <footer>共 {len(games)} 个 · 慢慢做，慢慢加</footer>
</div>
</body>
</html>
"""


if __name__ == "__main__":
    games = scan()
    games.sort(key=lambda g: g.get("order", 99))
    out = os.path.join(HERE, "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(render(games))
    print("索引已生成：%d 个游戏 -> %s" % (len(games), out))
    for g in games:
        print("  ·", g["title"], "->", g["file"])
