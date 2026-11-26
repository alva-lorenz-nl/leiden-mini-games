#!/usr/bin/env python3
"""一键将拆分后的文件合并成单个 HTML 发布版（lab_idle_bundle.html），方便发给朋友或在手机上直接打开。"""
from pathlib import Path

root = Path(__file__).resolve().parent
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "style.css").read_text(encoding="utf-8")

scripts = ["balance.js", "story.js", "ticker.js", "changelog.js", "scene.js", "game.js"]
merged_js = "\n\n".join((root / name).read_text(encoding="utf-8") for name in scripts)

html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>\n{css}</style>", 1)

script_tags = "\n".join(f'<script src="{name}"></script>' for name in scripts)
assert script_tags in html, "index.html 中的脚本引入顺序被修改过，请检查"
html = html.replace(script_tags, f"<script>\n{merged_js}\n</script>", 1)

out = root / "lab_idle_bundle.html"
out.write_text(html, encoding="utf-8")
print(f"已生成单文件版: {out} ({len(html)} 字符)")
