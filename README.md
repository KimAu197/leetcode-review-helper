# LeetCode Review Helper

A Chrome extension that uses **SM-2 adaptive spaced repetition** to intelligently schedule LeetCode problem reviews, with a built-in coaching system, achievement badges, and Google Calendar integration.

> Never forget how to solve a problem again.

[中文版 README](#中文版)

---

## Features

### Core — Adaptive Spaced Repetition (SM-2)

- **One-Click Add**: Floating buttons on LeetCode pages — "Review" (add to schedule) and "Log" (track only)
- **SM-2 Algorithm**: After each review, rate yourself (Easy / Good / Hard / Forgot) — the system dynamically adjusts your next review interval
- **Priority Scoring**: Reviews are ranked by urgency (overdue days, difficulty, past performance, ease factor)
- **SPA Navigation Support**: Buttons auto-update when switching problems without page refresh

### Coach — Smart Daily Planning

- **Daily Plan Card**: Shows due reviews, progress rings, new problem targets, and estimated time remaining
- **Blind Spot Detection**: Analyzes your weak tags (low EF + high fail rate) and recommends focus areas
- **Weekend Catch-Up Mode**: Auto 1.5x review target on weekends to clear backlogs
- **Customizable Goals**: Set daily new/review counts and time budget in Settings

### Gamification

- **Streak Tracking**: Current & longest consecutive day streaks with visual tiers (normal → hot → legendary)
- **12 Achievement Badges**: Milestones for reviews, streaks, problems solved, and success rate
- **"Top 3 Today" Card**: Shareable card showing your 3 highest-priority reviews — screenshot-ready
- **Review Success Rate**: Personal stats dashboard with win rate tracking

### Review Queue (LeetCode Page Overlay)

- **Floating Queue Panel**: Bottom-right panel on LeetCode pages showing all due reviews sorted by priority
- **In-Page Rating**: Rate the current problem directly from the queue — no need to open the popup
- **One-Click Next**: "Next →" button jumps to the highest-priority problem
- **Auto-Refresh**: Queue updates after each rating and periodically

### More

- **Optional Duration & Notes**: When adding/logging a problem, optionally record solve time and thoughts
- **Donut Difficulty Charts**: LeetCode-style donut charts for difficulty distribution
- **Tag Filtering**: Browse all problems by tag with auto-fetching from LeetCode GraphQL API
- **Google Calendar Sync**: Sync review events with reminders
- **Data Export/Import**: Full JSON backup and restore
- **Daily Notifications**: Chrome badge + notifications for due reviews

## SM-2 Adaptive Algorithm

Instead of fixed intervals, the system learns from your performance:

| Rating | Effect | Ease Factor |
|--------|--------|-------------|
| Easy | interval × EF × 1.3 | EF + 0.15 |
| Good | interval × EF | unchanged |
| Hard | interval × 1.2 | EF - 0.15 |
| Forgot | reset to 1 day | EF - 0.20 |

- EF (Ease Factor) ranges from 1.3 to 3.0 (default 2.5)
- Example progression (all Good): 1d → 3d → 8d → 20d → 50d → 125d...

## Priority Score

Each due review gets a priority score for smart ordering:

| Factor | Weight |
|--------|--------|
| Days overdue | +10 per day |
| Low ease factor | up to +25 |
| Difficulty (Hard/Med/Easy) | +15 / +10 / +5 |
| Last rating was Forgot/Hard | +20 |

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/KimAu197/leetcode-review-helper.git
cd leetcode-review-helper
```

### 2. Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the project folder

### 3. (Optional) Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **Google Calendar API**
3. Set up **OAuth consent screen** (add yourself as test user)
4. Create **OAuth 2.0 Client ID** (type: Chrome Extension)
5. Paste the Client ID into `manifest.json` → `oauth2.client_id`

## Usage

### On LeetCode Pages

1. Open any problem page (`leetcode.com` or `leetcode.cn`)
2. **"Log"** button (orange) — record practice without scheduling reviews
3. **"Review"** button (purple) — add to spaced repetition schedule
4. Both buttons optionally prompt for solve time and notes
5. **Queue panel** (bottom-right) — see all due reviews, rate current problem, jump to next

### In the Popup

| Tab | Description |
|-----|-------------|
| Today | Daily plan, top 3 card, difficulty chart, practice log |
| Review | Due reviews with 4-rating buttons, completed reviews |
| Stats | Streak, achievements, difficulty donut, daily bar chart |
| Tags | Browse problems by tag, refresh from LeetCode API |
| Settings | Daily goals, review intervals, Calendar, data management |

## Tech Stack

- **Chrome Manifest V3**
- **Vanilla JavaScript** — zero dependencies
- **SM-2 Algorithm** — adaptive spaced repetition
- **Google Calendar API** — optional sync
- **LeetCode GraphQL API** — tag fetching
- **Chrome Storage / Alarms / Notifications APIs**

## Project Structure

```
leetcode-spaced-repetition/
├── manifest.json        # Extension config
├── background.js        # Service worker (SM-2, scheduling, coaching, achievements)
├── content.js           # Content script (floating buttons, queue panel, rating)
├── content.css          # Content script styles
├── popup.html           # Popup layout
├── popup.js             # Popup logic (plan, stats, charts, goals)
├── popup.css            # Popup styles
├── icons/               # Extension icons (16/32/192)
└── README.md
```

## Privacy

- All data stored **locally** in Chrome Storage
- Google Calendar accessed **only** with explicit authorization
- **No analytics, no tracking, no server**
- Fully open source

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Buttons not showing | Refresh LeetCode page; must be on `/problems/*` |
| "Extension context invalidated" | Refresh page after reloading extension |
| Calendar connection failed | Check Client ID; add yourself as test user |
| No tags showing | Click "Refresh Tags" in Tags tab |
| Queue panel not visible | Only appears when there are due reviews |

## Changelog

### v2.0.0
- SM-2 adaptive spaced repetition algorithm
- 4-level rating system (Easy / Good / Hard / Forgot)
- Priority scoring and smart review ordering
- Floating review queue panel on LeetCode pages
- Daily coaching plan with progress rings and time estimates
- Blind spot tag detection and recommendations
- Weekend catch-up mode (1.5x reviews)
- Customizable daily goals (new problems, reviews, time budget)
- Streak tracking (current + longest)
- 12 achievement badges
- "Top 3 Today" shareable card
- Review success rate stats
- Optional solve duration and notes per problem
- LeetCode-style donut difficulty charts
- SPA navigation detection (no refresh needed)

### v1.0.0
- Initial release
- Fixed-interval Ebbinghaus forgetting curve
- Google Calendar integration
- Floating button on LeetCode pages
- Problem tag extraction
- Data export & import

## License

MIT License

## Author

Made with ❤️ by Kenzie

---

If you find this useful, give it a ⭐!

---

<a id="中文版"></a>

# LeetCode 复习助手

一个使用 **SM-2 自适应间隔重复算法** 智能安排 LeetCode 题目复习的 Chrome 扩展，内置智能教练系统、成就徽章和 Google Calendar 集成。

> 再也不会忘记怎么做一道题。

## 功能特性

### 核心 — SM-2 自适应间隔重复

- **一键添加**：LeetCode 题目页面上的浮动按钮 —— "复习"（加入计划）和 "记录"（仅统计）
- **SM-2 算法**：每次复习后自评（简单 / 记得 / 困难 / 忘了），系统动态调整下次复习间隔
- **优先级评分**：根据逾期天数、难度、历史表现、掌握度自动排序复习
- **SPA 导航支持**：切换题目时按钮自动更新，无需刷新页面

### 教练 — 智能每日计划

- **每日计划卡片**：显示待复习数量、进度环、新题目标、预计剩余时间
- **盲区检测**：分析薄弱标签（低 EF + 高失败率），推荐重点突破方向
- **周末清仓模式**：周末自动将复习目标 ×1.5，清理积压
- **自定义目标**：在设置中调整每日新题/复习数量和时间预算

### 成就系统

- **连续天数**：当前和最长连续刷题天数，三级视觉效果（普通 → 热度 → 传奇）
- **12 个成就徽章**：复习次数、连续天数、题目数量、成功率里程碑
- **"今日最该复习" 卡片**：展示优先级最高的 3 道题，适合截图分享
- **复习成功率**：个人数据面板，追踪胜率

### 复习队列（LeetCode 页面浮窗）

- **浮动队列面板**：LeetCode 页面右下角，按优先级排列所有待复习题
- **页内评分**：直接在队列中对当前题目评分，无需打开弹窗
- **一键下一题**："下一题 →" 跳转最高优先级题目
- **自动刷新**：每次评分后队列自动更新

### 更多

- **可选用时 & 心得**：添加/记录题目时可选填完成时间和思路笔记
- **甜甜圈难度图**：LeetCode 风格的环形难度分布图
- **标签筛选**：按标签浏览题目，自动从 LeetCode GraphQL API 获取标签
- **Google Calendar 同步**：将复习事件同步到日历
- **数据导入导出**：完整 JSON 备份和恢复
- **每日通知**：Chrome 徽章 + 通知提醒今日复习

## SM-2 自适应算法

不再是固定间隔，而是根据你的表现动态学习：

| 评分 | 效果 | 掌握因子 (EF) |
|------|------|---------------|
| 简单 | 间隔 × EF × 1.3 | EF + 0.15 |
| 记得 | 间隔 × EF | 不变 |
| 困难 | 间隔 × 1.2 | EF - 0.15 |
| 忘了 | 重置为 1 天 | EF - 0.20 |

- EF 范围 1.3 ~ 3.0（默认 2.5）
- 示例（全部评"记得"）：1天 → 3天 → 8天 → 20天 → 50天 → 125天...

## 优先级评分

每道待复习题目有一个优先级分数：

| 因素 | 权重 |
|------|------|
| 逾期天数 | +10 / 天 |
| 低掌握度 | 最高 +25 |
| 难度 (Hard/Med/Easy) | +15 / +10 / +5 |
| 上次评分差 | +20 |

## 安装

### 1. 克隆仓库

```bash
git clone https://github.com/KimAu197/leetcode-review-helper.git
cd leetcode-review-helper
```

### 2. 加载扩展

1. 打开 `chrome://extensions/`
2. 开启**开发者模式**（右上角）
3. 点击**加载已解压的扩展程序**
4. 选择项目文件夹

### 3.（可选）设置 Google Calendar

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目 → 启用 **Google Calendar API**
3. 设置 **OAuth 同意屏幕**（将自己添加为测试用户）
4. 创建 **OAuth 2.0 客户端 ID**（类型：Chrome 扩展程序）
5. 将 Client ID 粘贴到 `manifest.json` 的 `oauth2.client_id`

## 使用方法

### 在 LeetCode 页面

1. 打开任意题目页面（支持 `leetcode.com` 和 `leetcode.cn`）
2. **"记录"** 按钮（橙色）—— 记录刷题，不加入复习计划
3. **"复习"** 按钮（紫色）—— 加入间隔重复计划
4. 两个按钮都可选填完成时间和心得
5. **队列面板**（右下角）—— 查看所有待复习题、评分当前题、跳转下一题

### 在弹窗中

| 标签页 | 内容 |
|--------|------|
| 今日 | 每日计划、Top 3 卡片、难度分布、刷题记录 |
| 复习 | 待复习（4 级评分按钮）、已完成复习 |
| 统计 | 连续天数、成就、难度甜甜圈、每日柱状图 |
| 标签 | 按标签浏览题目，从 LeetCode API 刷新 |
| 设置 | 每日目标、复习间隔、日历、数据管理 |

## 技术栈

- **Chrome Manifest V3**
- **原生 JavaScript** — 零依赖
- **SM-2 算法** — 自适应间隔重复
- **Google Calendar API** — 可选同步
- **LeetCode GraphQL API** — 标签获取
- **Chrome Storage / Alarms / Notifications API**

## 项目结构

```
leetcode-spaced-repetition/
├── manifest.json        # 扩展配置
├── background.js        # Service Worker（SM-2、调度、教练、成就）
├── content.js           # 内容脚本（浮动按钮、队列面板、评分）
├── content.css          # 内容脚本样式
├── popup.html           # 弹窗布局
├── popup.js             # 弹窗逻辑（计划、统计、图表、目标）
├── popup.css            # 弹窗样式
├── icons/               # 扩展图标 (16/32/192)
└── README.md
```

## 隐私

- 所有数据**本地存储**在 Chrome Storage 中
- Google Calendar **仅在**用户明确授权后访问
- **无分析、无追踪、无服务器**
- 完全开源

## 更新日志

### v2.0.0
- SM-2 自适应间隔重复算法
- 四级评分系统（简单 / 记得 / 困难 / 忘了）
- 优先级评分和智能复习排序
- LeetCode 页面浮动复习队列面板
- 每日教练计划（进度环 + 时间估算）
- 薄弱标签检测和推荐
- 周末清仓模式（复习量 ×1.5）
- 自定义每日目标（新题、复习、时间预算）
- 连续天数追踪（当前 + 最长）
- 12 个成就徽章
- "今日最该复习" 分享卡片
- 复习成功率统计
- 可选完成时间和心得笔记
- LeetCode 风格甜甜圈难度图
- SPA 导航检测（无需刷新）

### v1.0.0
- 首次发布
- 固定间隔遗忘曲线
- Google Calendar 集成
- LeetCode 页面浮动按钮
- 题目标签提取
- 数据导入导出

## 许可证

MIT License

## 作者

Made with ❤️ by Kenzie

---

觉得有用的话，给个 ⭐ 吧！
