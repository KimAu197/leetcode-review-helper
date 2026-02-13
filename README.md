# LeetCode Spaced Repetition - LeetCode刷题遗忘曲线助手

基于遗忘曲线的智能LeetCode复习系统，帮助你高效记忆算法题目。

## ✨ 功能特性

### 🎯 核心功能
- **一键添加题目**: 在LeetCode题目页面浮动按钮，一键加入复习计划
- **智能复习调度**: 基于艾宾浩斯遗忘曲线自动安排复习时间
- **Google Calendar集成**: 自动将复习计划同步到Google Calendar
- **每日提醒**: 通过Chrome通知和日历提醒你按时复习

### 📊 遗忘曲线间隔
默认复习间隔遵循艾宾浩斯遗忘曲线：
- 第1次复习：1天后
- 第2次复习：3天后
- 第3次复习：7天后
- 第4次复习：14天后
- 第5次复习：30天后
- 第6次复习：60天后

### 🎨 界面特性
- 美观的浮动按钮设计
- 实时状态显示
- 统计数据面板
- 今日复习和全部题目视图

## 📦 安装步骤

### 1. 下载扩展

克隆或下载本项目到本地：

```bash
git clone <repository-url>
cd leetcode-spaced-repetition
```

### 2. 配置Google Calendar API（可选）

如果你想使用Google Calendar集成功能：

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用Google Calendar API
4. 创建OAuth 2.0客户端ID（类型选择"Chrome扩展"）
5. 将客户端ID复制到`manifest.json`中的`oauth2.client_id`字段

### 3. 加载扩展到Chrome

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 打开右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目的文件夹

### 4. 创建图标（可选）

在`icons`文件夹中添加以下尺寸的图标：
- `icon16.png` - 16x16像素
- `icon48.png` - 48x48像素
- `icon128.png` - 128x128像素

如果不添加图标，扩展仍可正常使用，只是会显示默认图标。

## 🚀 使用方法

### 添加题目

1. 打开任意LeetCode题目页面（支持leetcode.com和leetcode.cn）
2. 页面右侧会出现"加入复习"浮动按钮
3. 点击按钮，题目会自动添加到复习计划
4. 系统会自动生成6次复习日程

### 查看复习计划

1. 点击Chrome工具栏中的扩展图标
2. 在弹出窗口中查看：
   - **今日复习**: 今天需要复习的题目
   - **全部题目**: 所有已添加的题目
   - **设置**: 配置选项和数据管理

### 完成复习

1. 在"今日复习"标签页中找到要复习的题目
2. 点击"打开题目"按钮，在LeetCode上重新做一遍
3. 完成后点击"完成复习"按钮
4. 系统会自动安排下一次复习时间

### Google Calendar集成

1. 在"设置"标签页中点击"连接Google Calendar"
2. 授权扩展访问你的Google Calendar
3. 之后添加的题目会自动创建日历事件
4. 你会收到Google Calendar的提醒通知

## 📱 功能截图

### 浮动按钮
- 自动显示在LeetCode题目页面右侧
- 显示题目状态和下次复习时间
- 美观的渐变色设计

### 弹出窗口
- **统计面板**: 总题数、今日复习、已完成
- **题目列表**: 显示题目编号、标题、难度、复习进度
- **一键操作**: 完成复习、打开题目、删除题目

## 🛠️ 技术栈

- **Manifest V3**: 最新的Chrome扩展标准
- **Vanilla JavaScript**: 无框架依赖，轻量高效
- **Google Calendar API**: 日历集成
- **Chrome Storage API**: 本地数据存储
- **Chrome Alarms API**: 定时提醒

## 📂 项目结构

```
leetcode-spaced-repetition/
├── manifest.json          # 扩展配置文件
├── background.js          # 后台服务脚本（调度和API）
├── content.js            # 内容脚本（页面交互）
├── content.css           # 内容脚本样式
├── popup.html            # 弹出窗口HTML
├── popup.css             # 弹出窗口样式
├── popup.js              # 弹出窗口逻辑
├── icons/                # 图标文件夹
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # 项目说明
```

## 🎯 核心算法

### 遗忘曲线调度

基于艾宾浩斯遗忘曲线理论：

```javascript
reviewIntervals = [1, 3, 7, 14, 30, 60] // 天数
```

### 题目信息抓取

自动识别：
- 题目编号
- 题目标题
- 难度等级
- 题目链接
- 支持中英文版本

### Google Calendar同步

为每次复习创建日历事件：
- 事件时间：默认晚上8点
- 提醒设置：提前30分钟弹窗，提前1天邮件
- 事件描述：包含题目信息和复习进度

## ⚙️ 配置选项

### 复习时间设置
在设置页面可以自定义每日复习提醒时间（默认20:00）

### 数据管理
- **导出数据**: 导出所有复习记录为JSON文件
- **导入数据**: 从JSON文件导入复习记录
- **清空数据**: 删除所有复习记录

## 🔒 隐私说明

- 所有题目数据存储在本地（Chrome Storage）
- 仅在用户授权后访问Google Calendar
- 不收集或上传任何个人信息
- 开源透明，可审查所有代码

## 🐛 故障排除

### 浮动按钮不显示
1. 确认扩展已启用
2. 刷新LeetCode页面
3. 检查是否在题目详情页（URL包含`/problems/`）

### Google Calendar连接失败
1. 确认已配置正确的Client ID
2. 检查Google账号是否已登录
3. 尝试清除扩展存储后重新连接

### 题目信息抓取不完整
1. LeetCode可能更新了页面结构
2. 刷新页面后重试
3. 提交Issue反馈问题

## 🚧 未来计划

- [ ] 支持自定义复习间隔
- [ ] 添加统计图表和学习曲线
- [ ] 支持题目标签和分类
- [ ] 支持导出为Anki卡片
- [ ] 添加每日打卡功能
- [ ] 支持多语言界面
- [ ] 移动端适配

## 📝 更新日志

### v1.0.0 (2024-02-10)
- ✨ 初始版本发布
- 🎯 实现遗忘曲线调度系统
- 📅 集成Google Calendar
- 🎨 美观的UI设计
- 📊 统计数据面板

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 👨‍💻 作者

Made with Kenzie

---

如果这个项目对你有帮助，请给个⭐️吧！
