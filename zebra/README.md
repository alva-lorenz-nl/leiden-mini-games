# 莱顿逻辑馆：小猫斑马谜题

在线游戏：https://alva-lorenz.top/minigames/zebra_puzzle.html

一款离线可玩的斑马谜题合集：144 道自由题、36 道加强题（含六列运河街区）、19 个独立故事、按北京时间生成的永久每日题。发布产物是仓库根目录的单个 `zebra_puzzle.html`，题库、样式与脚本全部内联，双击即可打开。

生产页由 `src_v4/` 构建；`src/` 是上一版前端，只作对照与回归基线，构建产物为 `zebra_puzzle_legacy.html`，不再上线。

试验页：https://alva-lorenz.top/minigames/zebra_puzzle_test.html 。改动先 `python3 build_v4.py --out ../zebra_puzzle_test.html` 发到这里看效果，确认后再 `python3 build_v4.py` 覆盖正式页；两页同一份源码，只差构建输出。

## 快速开始

```sh
cd zebra
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci
.venv/bin/python build_v4.py                 # 生成生产页 ../zebra_puzzle.html
.venv/bin/python build_v4.py --out ../zebra_puzzle_test.html   # 另存一份试验页
.venv/bin/python build.py                    # 旧前端，生成 ../zebra_puzzle_legacy.html
npm test                                     # 两套 DOM 行为回归
npm run format:check                         # 前端格式检查
```

`npm run format` 会格式化 `src/` 与 `src_v4/`。Python 统一四空格缩进。构建、生成脚本都用自身路径定位文件，可从任意目录调用。发布前在仓库根目录执行 `sh publish.sh '提交说明'`；发布依赖现有 Git 凭据与站点写权限，仓库里不保存凭据。

## 目录结构

```text
zebra/
├─ build_v4.py         生产构建：校验题库并拼装 src_v4 单文件
├─ build.py            旧版构建（src/ → ../zebra_puzzle_legacy.html）
├─ generator.py        Z3 唯一解题目生成器（自由题与每日题）
├─ generator_x.py      扩展生成器：六列、否定/间隔/相邻线索（加强题）
├─ regen_free.py       按新词表重算 144 道自由题与每日题（一次性，改了词表才跑）
├─ daily.py            按日期追加每日题
├─ stage_stories.py    一次性内容迁移工具（不要重复运行）
├─ story_difficulty.py 故事题难度重建工具（一次性，含 difficultyVersion 保护）
├─ data/
│  ├─ free.json        144 道自由题
│  ├─ story.json       19 个故事、分阶段谜题
│  ├─ extra.json       36 道加强题（含六列运河街区）
│  ├─ daily.json       永久每日档案
│  └─ legacy_daily.json 旧版循环题，仅用于去重
├─ docs/chapters.md    故事设定与章节草稿
├─ src_v4/             当前前端源码（见下表）
├─ src/                上一版前端源码，仅作对照
└─ tests/
   ├─ ui_v4.cjs        生产页 jsdom 行为回归
   ├─ browser_v4.cjs   生产页 Playwright 截图与溢出检查
   ├─ ui.cjs           旧版页面 jsdom 回归
   └─ browser.cjs      旧版页面截图检查
```

## 前端模块

源码按职责拆分，`build_v4.py` 按固定顺序拼接成一个 `<script>`；发布 HTML 不要手改。`src/` 与 `src_v4/` 的模块名和顺序一致，换前端只换目录，题库校验共用 `build.py` 里的函数。

| 顺序 | 文件 | 职责 |
| --- | --- | --- |
| 1 | `core.js` | 题库解压、主题/难度名称表、全局状态 `S` 与模式变量 |
| 2 | `generator.js` | 在线出题：随机解 → 候选线索 → 约束传播删冗余 → 中文渲染（自由模式与每日兜底） |
| 3 | `dom.js` | `$`/`el`/`button`/`setMessage` 等轻量 DOM 工具 |
| 4 | `records.js` | 档案读取校验、保存、统计与历史、单题记账 |
| 5 | `clues.js` | 线索三态判断（待确定 / 已满足 / 冲突）与实时刷新 |
| 6 | `story.js` | 故事通关档案、收尾小剧场、下一阶段入口 |
| 7 | `session.js` | 选题、开局初始化、标题与导语、计时、返回首页 |
| 8 | `board.js` | 表格渲染、填值、撤回/重置、提交判定、看答案 |
| 9 | `home.js` | 自由模式的主题/难度筛选与题目列表 |
| 10 | `achievements.js` | 六个成就的推导与渲染 |
| 11 | `modes.js` | 模式切换、故事标签与阶段、每日档案、`dayKey` |
| 12 | `sync.js` | ZBR3/ZBR1 进度码导出与导入 |
| 13 | `events.js` | 事件绑定、启动入口、`window.ZEBRA` 调试接口 |

约定：

- 状态集中在 `core.js` 的 `S`，模块只读写 `S`，不各自缓存副本。
- 渲染函数幂等：重绘前先 `replaceChildren()`，避免残留监听与重复节点。
- 档案是唯一持久层，成就、统计、通关标记都从 `REC` 推导，不额外存字段。
- 事件绑定只在 `events.js` 出现一次，其他模块只导出函数。

## 数据结构

`data/free.json` 按 `主题_难度` 分组；构建时压成 `BANK.puzzles`，运行时由 `hydrate()` 还原成页面结构。`data/story.json` 每章包含 `title`、`tags`、`intro`、`stages[]`；每阶段要么自带 `puzzle`（自建题），要么用 `src` 引用自由题。自建故事题至少三类属性、五到七个位置，线索集经过极小化；每章最后一阶段升为四类并标为困难。`stage.intro` 只放阶段说明，题目导语由 `puzzle.intro` 提供，避免重复。`BANK.daily` 每项带 `date`、`theme`、`diff`，日期即唯一 ID。

题目在页面里的统一结构：

```js
{
  id, theme_key, theme, intro, difficulty,
  categories: { 类别: [值...] },
  clues: ["文字线索"], rawClues: [["same", "猫", "小白", "饮品", "咖啡"]],
  question, answer: { value }, solution: { 类别: [值...] },
  fragments, ending   // 仅故事
}
```

线索是结构化数组：`["pos", 类别, 值, 位置]` 或 `["same" | "next" | "left", 类别, 值, 另一类别, 另一值]`，扩展生成器另有 `["not" | "gap" | "adj"]` 等否定、间隔、相邻变体。判定只看玩家填表，不读标准答案；已无可能满足时标红，涉及的值都落位且关系成立时划线，其余待定。单条线索满足不代表整题正确。

## 词表与拼句

饮料、衣领颜色、手里东西、房间这几类取值在题内互不重复。生成器把结构化线索渲染成中文时有两道过滤：

- `AVOID_SAME`：容易造成歧义或重复的类别对，不给它们出“同一格”线索（目前为空表，留作后续扩充）。
- `gramClash`：同一条线索里两个取值只要字面有交集（如“咖啡杯”与“黑咖啡”），整条丢弃，避免句子读起来别扭。

改词表后必须跑 `python3 regen_free.py` 重算自由题与每日题，再跑 `build_v4.py`，否则题库里的旧取值会和新词表对不上。

## 游戏规则与行为约定

- 自由模式可按主题、难度筛选；随机只抽 `done` 里没有的题，看答案也算已做，抽空后不偷偷重用。题目列表允许主动重玩。
- 故事和每日模式隐藏整个筛选区。故事 19 章各自开放，按小猫、赫尔曼叔叔、卢卡、本格推理等标签筛选；章节内阶段必须依次通关，看答案不解锁下一阶段。故事题按多类别交叉推理设计，前置阶段为中等，终局阶段升至四类属性标为困难。所有故事章节导语、阶段叙述、线索措辞与追问设问均已做全文情境化润色，消除生硬模板感。
- 每日题以北京时间为日期边界，每个日期对应不可变的 `daily-v2-YYYY-MM-DD`；前端只显示今天及过去，未来预备题不下发到列表。
- 撤回一步恢复整张表快照，移动重复值造成的原格清空也一起恢复。重置需确认，只清填写，计时与档案不变，重置本身也可撤回。
- 通关或看答案后锁定棋盘，需从列表或每日档案重玩；同一题重复通关不重复累计解题数，每个日期只计一次每日成就。
- 线索区独立滚动，支持滚轮、触屏与键盘；手机表格可左右滑动，并有文字提示。
- 故事题重建时保持题目 ID 不变，已通关进度与成就继续有效，不因难度调整而回退。

## 档案与进度码

档案只存当前浏览器的 `localStorage`（键：`zebra_records`、`zebra_theme`、`zebra_diff`、`zebra_tag`），没有账号、数据库或同步 API。读取时会校验结构，损坏字段回退为空，不影响页面启动。

进度码为 `ZBR3-<base64>-<校验和>`，包含题目 ID、通关 ID、故事章节、每日日期和汇总统计，不含游玩流水与题目正文；成就由这些字段重建。Base64 只是编码，校验和用于发现复制错误，不是安全签名。导入覆盖本机进度，失败时保留原档案。仍支持旧 ZBR1 导入。

## 每日题与自动化

生成器检查答案排列不与自由题、旧版每日题、已归档每日题重复，每题都通过线索一致性与唯一解校验；没有 60 天轮回。默认预备未来七天，今日题缺失时明确提示，不回退旧题冒充新题。历史题可补做，七日成就按不同日期累计，不要求连续。

生产机用系统 cron 每小时运行 `update_daily.sh`：`flock` 加锁后补题，用 `build_v4.py` 重建生产页、`build.py` 重建旧版页，跑两套回归，原子替换站点文件，再提交档案与构建产物。无新题不产生提交，推送失败下次重试，失败时保留旧站点并写日志。

```cron
5 * * * * /bin/sh /data/games/mini-games/zebra/update_daily.sh >> /data/games/mini-games/zebra/daily.log 2>&1
```

默认 Python 为 `/data/AstrBot/.venv/bin/python`（可用 `ZEBRA_PYTHON` 覆盖），站点目录默认 `/data/games/cat-walk/minigames`（可用 `ZEBRA_SITE_DIR` 覆盖）。维护时看 `crontab -l`、`daily.log` 与 `git log -- zebra/data/daily.json`。

## 测试

`tests/ui_v4.cjs` 用 jsdom 加载生产页 `zebra_puzzle.html`，覆盖点击选值、同列取值互斥、撤回/重置、线索三态实时刷新、提示、自动收尾；`tests/browser_v4.cjs` 在桌面与手机两档截取首页、对局、选择器、填满、提示、通关六个画面并检查横向溢出与控制台异常。`npm test` 同时跑新旧两套 jsdom 回归。

`tests/ui.cjs` 用 jsdom 加载旧版产物，覆盖：四章解锁与阶段推进、每日固定题与历史归属、未来日期隐藏、隐藏筛选、下拉填表与重复值清空、撤回/重置、线索三态、成就、同步码往返与损坏码拒绝、看答案不算通关、旧短篇标题与异常存档恢复。

`tests/browser.cjs` 用 Playwright Chromium 截取桌面 1440×1000 与手机 390×844 的主要页面、结果页、同步界面、七列表格和异常存档恢复，检查页面横向溢出与控制台异常。可用环境变量指定运行时：

```sh
ZEBRA_PLAYWRIGHT=/path/to/playwright \
ZEBRA_CHROME=/path/to/chrome \
ZEBRA_SCREENSHOT_DIR=/tmp/shots \
node tests/browser.cjs
```

截图只留在本机，不进入网页或玩家进度；截图检查不等于保证所有设备、所有状态都无缺陷。

## 已知限制

- 源码不是防作弊设计，答案随单文件分发。
- 离线页面只包含下载时已生成的题目，获取后续每日题需要联网刷新。
- 七天预备题依赖服务器与定时任务持续可用，不等于永久离线生成。
- 自动化依赖 cron、Python/Node 依赖和 Git 推送凭据。

## 变更记录

- 2026-11-12 上线 v4：`src_v4` 成为生产前端，新增加强与六列运河街区题、ZebraLogic 风格线索、按钮置灰与列表滚动条配色；`build_v4.py` 直接产出 `zebra_puzzle.html`，旧前端降为 `zebra_puzzle_legacy.html`。
- 2026-11-12 词表修订：永动轮往事把“状态”换成“衣领颜色”（白、深蓝、酒红、墨绿、浅灰），咖啡杯改马克杯，并加入字面重叠过滤，自由题、每日题、加强题全部重算重验。
- 2026-11-11 重构：`game.js` 按职责拆为 `session` / `board` / `home` / `story`，档案与成就分家，新增 `dom.js` 工具层；构建顺序与行为保持不变，回归测试与截图检查通过。
- 2026-11-11 界面维护：清理自由推理主题，修复缓存与阶段状态，手机表格加滑动提示，存档读取容错，加入浏览器截图回归。
- 2026-11-11 故事改版：19 个独立故事、章节内分阶段、标签筛选，旧 story 索引仅用于兼容。
