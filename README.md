# TransGemma 翻译助手

<p align="center">
  <img src="icons/icon128.png" alt="TransGemma Logo" width="128">
</p>

<p align="center">
  基于 TransGemma AI 的智能浏览器翻译插件，支持划词翻译和段落翻译
</p>

## ✨ 功能特点

- **🔍 划词翻译** - 选中任意文本，自动弹出翻译结果
- **📝 段落翻译** - 按住 Ctrl/Cmd 点击段落，直接在页面上显示译文
- **🌐 多语言支持** - 支持中文、英语、日语、韩语等多种语言
- **🤖 智能检测** - 自动识别源语言，智能选择翻译方向
- **⚡ 快速响应** - 基于 TransGemma AI 模型，翻译速度快、质量高

## 📦 安装方法

### Chrome / Edge 浏览器

1. 下载本仓库代码（点击 Code → Download ZIP）
2. 解压到本地文件夹
3. 打开浏览器，进入扩展程序页面：
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
4. 开启「开发者模式」（右上角开关）
5. 点击「加载已解压的扩展程序」
6. 选择解压后的文件夹

## 🚀 使用方法

### 划词翻译
1. 在任意网页上选中文本
2. 翻译结果自动弹出
3. 点击「复制」按钮复制译文

### 段落翻译
1. 按住 `Ctrl` 键（Mac 用户按 `Cmd`）
2. 移动鼠标到要翻译的段落（段落会高亮显示）
3. 点击段落，译文显示在原文下方
4. 再次点击可移除译文

### 弹窗翻译
1. 点击浏览器工具栏的插件图标
2. 在输入框中输入或粘贴文本
3. 自动翻译并显示结果

## ⚙️ 设置选项

在插件弹窗底部可以控制：
- **Ctrl+悬停翻译** - 开启/关闭段落翻译功能
- **划词翻译** - 开启/关闭划词翻译功能

## 🔑 授权说明

- 免费用户有每日使用次数限制
- 购买授权码可解锁无限使用
- 购买授权码请联系微信：**zouclang**

## 📁 项目结构

```
├── manifest.json          # 插件配置文件
├── background/
│   └── service-worker.js  # 后台服务
├── content/
│   ├── content.js         # 内容脚本（翻译核心逻辑）
│   ├── content.css        # 翻译样式
│   └── license.js         # 授权验证
├── popup/
│   ├── popup.html         # 弹窗界面
│   ├── popup.js           # 弹窗逻辑
│   └── popup.css          # 弹窗样式
└── icons/                 # 插件图标
```

## 🛠️ 技术栈

- Chrome Extension Manifest V3
- Vanilla JavaScript
- TransGemma AI API

## 📄 License

MIT License

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/zouclang">zouclang</a>
</p>
