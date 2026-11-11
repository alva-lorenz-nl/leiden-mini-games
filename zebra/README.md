# 莱顿逻辑馆：开发与运维

在线游戏：https://alva-lorenz.top/minigames/zebra_puzzle.html

## 结构与构建

源代码按职责维护，发布产物仍是仓库根目录的 `zebra_puzzle.html`，包含题库、CSS 和 JS，可离线打开。不要直接修改发布 HTML，也不再使用旧的字符串补丁脚本。

- `src/page.html`、`style.css`：页面与样式。
- `src/core.js`：题库解压与当前游戏状态。
- `src/records.js`：本地档案与统计。
- `src/clues.js`：结构化线索三态判断及实时显示。
- `src/game.js`：筛选、抽题、下拉填表、计时和提交。
- `src/sync.js`：档案导出与导入。
- `src/modes.js`：故事、每日档案、成就、题目列表。
- `src/events.js`：事件绑定及初始化。
- `generator.py`：Z3 唯一解题目生成器。
- `build.py`：逐题验证线索、唯一解，按固定模块顺序构建单文件。
- `daily.py`：按日期追加每日题，补齐空缺并预备未来七天。
- `data/free.json`：144 道自由题，保留原 ID，故事引用其中四题。
- `data/daily.json`：从 2026-11-11 起的永久每日档案。
- `data/legacy_daily.json`：旧版 60 道循环题的留档，仅用于去重，不再循环发布。
- `tests/ui.cjs`：浏览器 DOM 行为回归测试。

```sh
cd zebra
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci
.venv/bin/python daily.py
.venv/bin/python build.py
npm test
npm run format:check
```

`npm run format` 格式化前端源码。Python 使用四空格缩进。构建和生成脚本通过自身路径定位文件，可从任意目录调用。发布前从仓库根目录执行 `sh publish.sh '提交说明'`。发布需要现有 Git 凭据和站点写权限，不在仓库保存凭据。

## 每日题与历史

北京时间作为日期边界。每个日期对应一个不可变的题目 ID `daily-v2-YYYY-MM-DD`，重新运行不会覆盖既有日期。生成器检查答案排列不与自由题、旧版每日题、已归档每日题重复，每道新题还须通过线索一致性和唯一解校验；没有 60 天轮回限制。

默认预备未来七天应对短暂服务故障，前端仅显示今天及过去的日期。未来题在静态源码中可见，因此这不是竞技保密系统。今日题若缺失会明确提示，不回退到旧题冒充新题。历史题可补做或重玩，通关记录归于题目日期；七日成就是累计七个不同日期，不要求连续。

旧版每日通关日期和自由题 ID 均保留。升级当日的新每日题可能与此前循环题不同，旧通关记录不清除。过去的循环版题目没有逐日存档，因此不虚构此前历史。离线页面只包含下载时已经生成的题目，获取后续题目需要联网刷新。

## 自动化

生产机使用系统 cron 每小时运行 `update_daily.sh`。脚本获得 `flock` 锁后补题、校验、运行回归测试、原子替换站点游戏文件，然后提交每日档案及构建产物到 GitHub。无新题时不产生提交；推送失败会在下次执行时重试。生成或测试失败会保留旧站点并在日志中报错。

默认 Python 路径为 `/data/AstrBot/.venv/bin/python`，可设置 `ZEBRA_PYTHON`。站点目录默认 `/data/games/cat-walk/minigames`，可设置 `ZEBRA_SITE_DIR`。示例生产配置（机器为 UTC；每小时执行不依赖 cron 时区）：

```cron
5 * * * * /bin/sh /data/games/mini-games/zebra/update_daily.sh >> /data/games/mini-games/zebra/daily.log 2>&1
```

维护时用 `crontab -l` 检查任务，查看 `daily.log` 和 `git log -- zebra/data/daily.json`。自动化依赖服务器、cron、Python/Node 依赖及 Git 推送凭据持续可用；七天预备题不等于永久离线生成。

## 行为约定与验证

自由模式可限制主题与难度，随机只抽 `done` 中没有的题；看答案也标为已做，抽空后不偷偷重用。题目列表允许主动重玩。故事和每日模式隐藏整个筛选区。线索根据当前填表自动判断：涉及的值已填入且满足关系时划线；已无可能满足该条关系时标红；其余保持待确定。判断不读取标准答案，满足单条线索不代表整题答案正确。线索区独立滚动，支持滚轮、触屏与键盘。

档案保存在 `localStorage`，同步码手动跨设备迁移；旧统计与故事进度保留。每个题目重复通关不重复累计解题数，每个日期仅计一次每日成就。源码不是防作弊设计，答案随单文件分发。

测试覆盖四章解锁、每日固定题、隐藏筛选、历史题日期归属、未来日期隐藏、下拉表格、线索划销、成就、同步码及查看答案不算通关；构建额外检查所有题目的逻辑一致性与唯一解。`daily.py` 可用 `--through YYYY-MM-DD` 指定生成截止日期，重复运行保持既有档案不变。
