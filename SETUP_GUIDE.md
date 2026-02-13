# 详细安装配置指南

## 快速开始（无需Google Calendar）

如果你只想使用本地复习功能，不需要Google Calendar集成，可以直接跳过API配置：

1. 下载本项目所有文件
2. 在Chrome中加载扩展（见下方"加载扩展"部分）
3. 开始使用！

**注意**: 不配置Google Calendar API也能正常使用扩展的所有核心功能，只是无法自动同步到Google Calendar。

## Google Calendar API配置（完整版）

如果你想要Google Calendar自动同步功能，需要配置API：

### 步骤1: 创建Google Cloud项目

1. 访问 https://console.cloud.google.com/
2. 点击页面顶部的项目选择器
3. 点击"新建项目"
4. 输入项目名称（如"LeetCode Review Helper"）
5. 点击"创建"

### 步骤2: 启用Google Calendar API

1. 在项目控制台中，点击左侧菜单"API和服务" > "库"
2. 搜索"Google Calendar API"
3. 点击进入，然后点击"启用"

### 步骤3: 创建OAuth同意屏幕

1. 点击左侧菜单"API和服务" > "OAuth同意屏幕"
2. 选择"外部"用户类型（除非你有Google Workspace账号）
3. 点击"创建"
4. 填写应用信息：
   - **应用名称**: LeetCode Spaced Repetition
   - **用户支持电子邮件**: 你的邮箱
   - **开发者联系信息**: 你的邮箱
5. 点击"保存并继续"
6. 在"作用域"页面，点击"添加或移除作用域"
7. 搜索并选择：`https://www.googleapis.com/auth/calendar.events`
8. 点击"更新"，然后"保存并继续"
9. 在"测试用户"页面，添加你自己的Gmail地址
10. 点击"保存并继续"

### 步骤4: 创建OAuth客户端ID

1. 点击左侧菜单"API和服务" > "凭据"
2. 点击"创建凭据" > "OAuth客户端ID"
3. 选择应用类型："Chrome扩展程序"
4. 输入名称（如"LeetCode Review Extension"）
5. 在"扩展程序ID"字段，输入你的Chrome扩展ID（见下方"获取扩展ID"）
6. 点击"创建"
7. 复制生成的"客户端ID"（格式类似：`xxxxx.apps.googleusercontent.com`）

### 步骤5: 配置manifest.json

1. 打开项目中的`manifest.json`文件
2. 找到`oauth2`部分：
```json
"oauth2": {
  "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/calendar.events"
  ]
}
```
3. 将`YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`替换为你在步骤4中复制的客户端ID
4. 保存文件

### 获取Chrome扩展ID

首次加载扩展时，需要先获取扩展ID：

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 确保"开发者模式"已打开
4. 点击"加载已解压的扩展程序"
5. 选择本项目文件夹
6. 扩展加载后，在扩展卡片上找到"ID"（一串字母组成的字符串）
7. 复制这个ID，在Google Cloud Console中使用
8. 在Google Cloud Console配置完成后，重新加载扩展

## 加载扩展到Chrome

### 方法1: 开发者模式加载（推荐）

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 打开右上角的"开发者模式"开关
4. 点击左上角的"加载已解压的扩展程序"
5. 选择本项目的文件夹（包含manifest.json的文件夹）
6. 扩展加载成功后会显示在列表中

### 方法2: 打包为.crx文件

1. 在 `chrome://extensions/` 页面
2. 点击"打包扩展程序"
3. 选择扩展根目录
4. 点击"打包扩展程序"
5. 会生成.crx文件，可以分享给他人

## 创建图标

扩展需要三个尺寸的图标。你可以：

### 选项1: 使用设计工具创建

1. 创建icons文件夹（如果不存在）
2. 使用任何图像编辑工具（Photoshop、Figma、Canva等）
3. 创建以下尺寸的PNG图片：
   - `icon16.png` - 16x16像素（工具栏小图标）
   - `icon48.png` - 48x48像素（扩展管理页面）
   - `icon128.png` - 128x128像素（Chrome Web Store）

### 选项2: 使用在线工具

1. 使用favicon生成器（如 https://favicon.io/）
2. 上传一个图片或创建文字图标
3. 下载生成的图标包
4. 重命名并放入icons文件夹

### 选项3: 使用代码生成（临时方案）

如果暂时不想创建图标，可以创建简单的纯色图标：

```bash
# 在项目根目录运行
mkdir -p icons
```

然后使用任何图像编辑软件创建三个紫色方块图标，或者临时使用任何PNG图片。

**注意**: 即使没有图标文件，扩展也能运行，只是会显示Chrome默认图标。

## 首次使用

### 1. 连接Google Calendar（可选）

1. 点击Chrome工具栏中的扩展图标
2. 切换到"设置"标签页
3. 点击"连接Google Calendar"
4. 在弹出的窗口中授权访问
5. 看到"已成功连接"提示即可

### 2. 添加第一道题

1. 访问任意LeetCode题目页面，例如：
   - https://leetcode.com/problems/two-sum/
   - https://leetcode.cn/problems/two-sum/
2. 页面右侧会出现"加入复习"按钮
3. 点击按钮添加题目
4. 查看弹出的成功提示

### 3. 查看复习计划

1. 点击扩展图标打开弹出窗口
2. 在"今日复习"标签页查看今天的任务
3. 在"全部题目"标签页查看所有已添加的题目

## 常见问题

### Q: 扩展加载失败

**A**: 检查以下几点：
- 确保所有文件都在同一个文件夹中
- manifest.json文件格式正确（可以用JSON验证器检查）
- 文件夹权限允许Chrome访问

### Q: 浮动按钮不显示

**A**: 可能的原因：
- 确保在LeetCode题目详情页（URL包含`/problems/`）
- 刷新页面重试
- 检查控制台是否有错误（F12打开开发者工具）

### Q: Google Calendar连接失败

**A**: 检查以下几点：
- Client ID是否正确配置在manifest.json中
- 是否在OAuth同意屏幕中添加了测试用户
- Google账号是否已登录Chrome
- 是否启用了Google Calendar API

### Q: 题目信息抓取不完整

**A**: 可能原因：
- LeetCode更新了页面结构
- 页面还未完全加载
- 解决方法：等待页面完全加载后刷新

### Q: 如何备份数据

**A**: 在设置页面点击"导出数据"，保存JSON文件即可。

### Q: 如何在多台电脑间同步

**A**: 
1. 在第一台电脑上导出数据
2. 在第二台电脑上安装扩展
3. 使用"导入数据"功能导入之前导出的文件

## 开发调试

### 查看日志

1. 打开Chrome开发者工具（F12）
2. 切换到"Console"标签
3. 查看扩展输出的日志信息

### 调试后台脚本

1. 访问 `chrome://extensions/`
2. 找到本扩展，点击"检查视图 service worker"
3. 在打开的开发者工具中查看后台脚本日志

### 调试弹出窗口

1. 右键点击扩展图标
2. 选择"审查弹出内容"
3. 在开发者工具中调试popup.js

### 重新加载扩展

修改代码后需要重新加载扩展：

1. 访问 `chrome://extensions/`
2. 找到本扩展
3. 点击刷新图标按钮
4. 或者使用快捷键：在扩展页面按 `Ctrl+R` (Windows/Linux) 或 `Cmd+R` (Mac)

## 性能优化建议

1. **定期清理**: 删除已完成所有复习的题目，保持数据库轻量
2. **合理使用**: 不要一次性添加太多题目（建议<100道）
3. **定期备份**: 每月导出一次数据作为备份

## 安全提示

1. **不要分享Client ID**: 你的Google OAuth Client ID是私密信息
2. **定期检查权限**: 在Google账号设置中检查扩展权限
3. **保护数据文件**: 导出的JSON文件包含你的学习记录，注意保管

## 获取帮助

如果遇到问题：

1. 查看本文档的常见问题部分
2. 检查浏览器控制台的错误信息
3. 在GitHub上提交Issue（如果项目开源）
4. 联系开发者

---

祝你刷题愉快！💪
