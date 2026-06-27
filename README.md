# BiViNote｜B站视频字幕笔记

[![GitHub all releases downloads](https://img.shields.io/github/downloads/hyglgithub/BiViNote/total?style=flat-square&logo=github&label=downloads)](https://github.com/hyglgithub/BiViNote/releases)
[![GitHub release](https://img.shields.io/github/v/release/hyglgithub/BiViNote?style=flat-square&label=version)](https://github.com/hyglgithub/BiViNote/releases)
[![License](https://img.shields.io/github/license/hyglgithub/BiViNote?style=flat-square)](LICENSE)

读取 B 站视频字幕，截取视频帧画面，生成带有截图的 Markdown 笔记。

## 功能

- 📝 **字幕抓取** — 自动获取 B 站视频字幕，支持多语言切换
- 📷 **视频截图** — 为字幕添加视频帧截图，支持上一帧/下一帧微调
- 📋 **章节支持** — 展示视频章节，按章节分段导出
- 📄 **多格式导出** — SRT 字幕、Markdown 笔记（含截图时打包 ZIP）
- 🌙 **夜间模式** — 日/夜两套配色全局切换
- ⚙️ **自定义设置** — 字体大小、行高、帧步长、自动滚动等

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

1. 打开 B 站视频页
2. 点击浏览器工具栏上的 BiViNote 图标打开面板
3. 点击「刷新」获取字幕
4. 为需要的字幕添加截屏
5. 点击「下载（.md）」导出笔记

### 面板功能

| 标签页 | 功能 |
|--------|------|
| 字幕 | 字幕列表、添加截屏、复制、跳转 |
| 章节 | 章节列表、添加截屏、复制、跳转 |
| 视频信息 | 勾选需要写入笔记的视频属性 |
| 设置 | 字幕语言、字体大小、行高、帧步长、自动滚动、夜间模式 |

### 底部按钮

| 按钮 | 功能 |
|------|------|
| 刷新 | 重新获取当前视频字幕 |
| 复制 | 复制全部字幕文本到剪贴板 |
| 导出（.srt） | 下载 SRT 格式字幕文件 |
| 下载（.md） | 下载 Markdown 笔记（含截图时打包 ZIP） |

### 导出格式

**纯 Markdown**（无截屏时直接下载 .md 文件）

```markdown
---
title: "视频标题"
author: "作者名"
url: "https://www.bilibili.com/video/BV..."
---

# 视频标题

## 章节

- `00:00` 章节一
- `05:30` 章节二

## 字幕

### 章节一

`00:09` 字幕文本
`00:15` 字幕文本
```

**含截图**（有截屏时打包为 .zip）

```
note.zip
├── note.md
└── screenshots/
    ├── 1.png
    ├── 2.png
    └── ...
```

## 项目结构

```
BiViNote/
├── manifest.json      # 扩展配置 (Manifest V3)
├── background.js      # Service Worker - API 代理
├── content.js         # 入口脚本
├── js/
│   ├── state.js       # 状态管理
│   ├── panel.js       # 面板 UI
│   ├── subtitle.js    # 字幕模块
│   ├── chapter.js     # 章节模块
│   ├── video-info.js  # 视频信息
│   ├── capture.js     # 截图模块
│   ├── export.js      # 导出模块
│   └── settings.js    # 设置模块
├── css/
│   └── panel.css      # 面板样式
├── libs/
│   └── jszip.min.js   # ZIP 打包库
└── icons/             # 扩展图标
```

## 兼容性

- Chrome 88+ (Manifest V3)
- Edge 88+ (Manifest V3)

## 许可证

[MIT](LICENSE)

## 免责声明

> ▎ **用户自负责任条款**：本工具仅在用户已登录 B 站、且有访问权限的前提下获取数据。所有数据通过用户自己的浏览器获取，不经过任何第三方服务器。本工具不存储、不分发任何 B 站内容。使用本工具产生的所有后果由用户自行承担。请遵守 B 站用户协议与相关法律法规。
