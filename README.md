# 永动轮实验室日常 · 部署与维护交接文档

纯前端静态放置/增量小游戏（HTML + CSS + 原生 JS），**无需 Node.js、数据库或任何后端服务**，双击 `index.html` 即可本地运行，放到任意静态 Web 服务器即可上线。

---

## 一、目录结构说明

| 文件 | 用途 | 需上传至服务器 |
| :--- | :--- | :---: |
| `index.html` | 页面结构、设置/说明/更新日志浮层、像素小猫 Favicon | 是 |
| `style.css` | 整体样式、昼夜主题、定制滚动条、PC 双栏与手机竖屏独立滑动适配 | 是 |
| `balance.js` | **数值参数表**：上限公式、散热比曲线、工位价格与产出、事件间隔 | 是 |
| `story.js` | **剧情与文案库**：场景描述、收藏室、随机事件、里程碑、成就、结局 | 是 |
| `ticker.js` | **顶部滚动条词库**：常规日常、科普冷知识、多周目与后日谈台词 | 是 |
| `changelog.js` | **版本号与更新日志**：控制当前版本显示与老玩家更新小红点 | 是 |
| `scene.js` | 像素画布渲染（6 个主线场景 + 小猫的小鱼工厂） | 是 |
| `game.js` | 核心循环、存档/读档（含 Base64 存档码）、自动化与 UI 交互 | 是 |
| `deploy.sh` | Linux 一键部署脚本（仅同步上述 8 个静态文件到网站目录） | 否 |
| `build_single.py` | 本地一键合并成单文件 HTML（`lab_idle_bundle.html`）的打包工具 | 否 |
| `README.md` | 本交接文档 | 否 |

---

## 二、快速部署指南

### 方式 1：Linux 服务器使用一键脚本（推荐）

将压缩包上传并解压到服务器任意临时目录后，进入 `lab_idle_project` 执行：

```bash
# 默认部署到 /var/www/lab_idle
sudo bash deploy.sh

# 或指定你的网站根目录
sudo bash deploy.sh /www/wwwroot/your-domain.com
```

脚本会自动复制 8 个静态文件、设置 `644/755` 权限，并在检测到 Nginx 运行时自动平滑重载。

### 方式 2：Nginx 最小配置参考

新建 `/etc/nginx/conf.d/lab_idle.conf`：

```nginx
server {
    listen 80;
    server_name 你的域名或服务器IP;

    root /var/www/lab_idle;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

保存后执行 `sudo nginx -t && sudo systemctl reload nginx`，并确保云服务器安全组已放行 `80`（或 HTTPS `443`）端口。

### 方式 3：宝塔面板 / 1Panel

1. 新建「纯静态」网站，进入网站根目录并清空默认文件。
2. 将上述 8 个静态文件直接上传到网站根目录（确保 `index.html` 在根目录第一层）。

---

## 三、日常更新与维护

* **加滚动条词条 / 科普**：直接编辑 `ticker.js` 的 `base` / `loop` / `good` 数组。
* **改剧情 / 收藏室 / 事件**：直接编辑 `story.js`。
* **调数值 / 价格 / 场景阈值**：直接编辑 `balance.js`。
* **发布新版本并提醒老玩家**：
  1. 打开 `changelog.js`，将顶部的 `APP_VERSION` 改为新版本号（如 `'1.7'`）。
  2. 在 `CHANGELOG` 数组最前面新增一条更新记录（建议保持无剧透写法）。
  3. 覆盖上传改过的文件到服务器；老玩家下次打开时，左上角 `⚙` 会自动亮起琥珀色小圆点，点开看过后消失。
* **强制刷新浏览器缓存**：若玩家反馈没看到最新改动，可让其按 `Ctrl+F5` 强制刷新，或在 `index.html` 对应 `<script src="xxx.js?v=1.7">` 后加版本号参数。
* **打包单文件发给朋友**：在本地运行 `python3 build_single.py`，会在同目录生成单个 `lab_idle_bundle.html`，无需服务器即可直接双击游玩。

---

## 四、存档与反馈

* 玩家进度保存在浏览器本地 `localStorage`（键名 `leiden_lab_idle_v1`），支持在 `⚙ 设置` 中导出/导入 `.json` 文件，或使用 **Base64 文本存档码**跨设备迁移。
* 内置开发者反馈邮箱：`eleanorsch@outlook.com`。
