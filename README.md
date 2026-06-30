# BiViNote｜B站视频字幕笔记

[![GitHub all releases downloads](https://img.shields.io/github/downloads/hyglgithub/BiViNote/total?style=flat-square&logo=github&label=downloads)](https://github.com/hyglgithub/BiViNote/releases)
[![GitHub release](https://img.shields.io/github/v/release/hyglgithub/BiViNote?style=flat-square&label=version)](https://github.com/hyglgithub/BiViNote/releases)
[![License](https://img.shields.io/github/license/hyglgithub/BiViNote?style=flat-square)](LICENSE)

在 B 站视频页抓取字幕、截取视频帧画面，生成带有截图的 Markdown 笔记。

## 功能

- 📝 **字幕抓取** — 自动获取 B 站视频字幕，支持多语言切换
- 📷 **视频截图** — 为字幕/章节添加视频帧截图，支持上一帧/下一帧微调
- ✂️ **截图裁剪** — 基于 Cropper.js 的图片裁剪、缩放、旋转、翻转
- 📋 **章节支持** — 展示视频章节，按章节分段导出
- 📄 **多格式导出** — SRT 字幕、Markdown 笔记（含截图时打包 ZIP）
- 🔄 **自动刷新** — 视频切换时自动获取新字幕
- 🎯 **字幕同步** — 播放时高亮当前字幕，支持自动滚动
- 🌙 **夜间模式** — 日/夜两套配色全局切换
- ⚙️ **自定义设置** — 字体大小、行高、帧步长、自动滚动等
- 🖼️ **图标状态** — 视频页图标正常显示，非视频页图标变暗
- 💬 **提示词** — AI 笔记整理提示词，根据有无截图自动切换

## 功能演示

![BiViNote 功能演示](演示图片.png)

## 安装方式

### Chrome / Edge

1. 在 GitHub 的 [Releases](https://github.com/hyglgithub/BiViNote/releases) 页面下载最新的 `bivinote-v*-chrome.zip` 包
2. 解压到任意本地目录
3. 打开扩展管理页：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
4. 开启"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择解压后的扩展目录（包含 `manifest.json` 的目录）

### 从源码安装

```bash
git clone https://github.com/hyglgithub/BiViNote.git
```

然后按照上述步骤 3-6 加载扩展。

## 使用方法

1. 打开 B 站视频页（支持 `/video/BV*` 和 `/list/*` 页面）
2. 点击浏览器工具栏上的 BiViNote 图标打开面板（图标正常表示可用）
3. 面板自动获取当前视频字幕
4. 为需要的字幕/章节添加截屏
5. 点击「下载（.md）」导出笔记

### 面板功能

| 标签页 | 功能 |
|--------|------|
| 字幕 | 字幕列表、添加截屏、复制、跳转、高亮同步 |
| 章节 | 章节列表、添加截屏、复制、跳转 |
| 视频信息 | 勾选需要写入笔记的视频属性（标题/作者/日期/时长/地址/简介/时间戳） |
| 提示词 | AI 笔记整理提示词，可配置路径前缀，支持复制/修改/恢复默认 |
| 设置 | 字幕语言、字体大小、行高、帧步长、自动滚动、夜间模式 |

### 底部按钮

| 按钮 | 功能 |
|------|------|
| 刷新 | 重新获取当前视频字幕 |
| 复制 | 复制全部字幕文本到剪贴板 |
| 导出（.srt） | 下载 SRT 格式字幕文件 |
| 下载（.md） | 下载 Markdown 笔记（含截图时打包 ZIP） |

### 截图功能

- 点击字幕/章节行的「截屏」按钮，自动跳转到对应时间点并截取当前帧
- 点击缩略图打开截图浏览界面
- 浏览界面支持：拖动图片、上一帧/下一帧、下载、复制到剪贴板
- 点击「裁剪」进入裁剪模式：支持裁剪框调整、缩放、旋转、翻转
- 点击「取消截屏」可移除已添加的截图

### 导出格式

**纯 Markdown**（无截屏时直接下载 .md 文件）

```markdown
---
title: "视频标题"
author: "作者名"
---

# 视频标题

## 章节

- 章节一
- 章节二

## 字幕

### 章节一

字幕文本
```

**含截图**（有截屏时打包为 .zip）

```
note.zip
├── note.md
└── assets/
    ├── 0009.png
    ├── chapter-1.png
    └── ...
```

> 章节/字幕时间戳可在「视频信息」页勾选控制，默认不带时间戳。

## 项目结构

```
BiViNote/
├── manifest.json      # 扩展配置 (Manifest V3)
├── background.js      # Service Worker - API 代理、图标状态管理
├── content.js         # 入口脚本 - 面板注入、路由监听
├── js/
│   ├── state.js       # 全局状态管理
│   ├── panel.js       # 面板 UI - 标签页、折叠、拖动、设置、提示词
│   ├── subtitle.js    # 字幕 - 获取、渲染、高亮同步、跳转
│   ├── chapter.js     # 章节 - 获取、渲染、跳转
│   ├── video-info.js  # 视频信息展示
│   ├── capture.js     # 截图 - OffscreenCanvas、保存、剪贴板
│   ├── crop-viewer.js # 截图浏览 - Cropper.js 裁剪、缩放、旋转、翻转
│   ├── export.js      # 导出 - SRT、Markdown、ZIP
│   └── settings.js    # 设置 - chrome.storage.local 持久化
├── css/
│   └── panel.css      # 面板样式（含暗色主题）
├── libs/
│   ├── jszip.min.js   # ZIP 打包库
│   ├── cropper.min.js # Cropper.js 裁剪库
│   └── cropper.min.css
└── icons/             # 扩展图标（正常 + 变暗状态）
```

## 技术要点

- **Manifest V3** Chrome 扩展
- **双源 API 策略**：优先 `player/wbi/v2`（aid），回退 `player/v2`（bvid）
- **字幕轨道排序**：按语言优先级稳定排序（中文 > 英文 > 其他）
- **SPA 路由监听**：MutationObserver 检测 URL 变化，自动刷新
- **CORS 处理**：CDN 域名使用 `credentials: 'omit'`
- **图标状态**：根据页面类型动态切换正常/变暗图标
- **事件委托**：单次绑定避免监听器泄漏
- **请求取消**：fetchRunId 机制防止过期请求污染状态
- **截图裁剪**：基于 Cropper.js，支持裁剪、缩放、旋转、翻转
- **折叠面板**：可拖动圆形图标，点击展开，功能菜单快捷操作

## 兼容性

- Chrome 88+ (Manifest V3)
- Edge 88+ (Manifest V3)

## 许可证

[MIT](LICENSE)

## 免责声明

> ▎ **用户自负责任条款**：本工具仅在用户已登录 B 站、且有访问权限的前提下获取数据。所有数据通过用户自己的浏览器获取，不经过任何第三方服务器。本工具不存储、不分发任何 B 站内容。使用本工具产生的所有后果由用户自行承担。请遵守 B 站用户协议与相关法律法规。
