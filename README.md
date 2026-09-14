# BiViNote｜B站视频字幕笔记

[![GitHub all releases downloads](https://img.shields.io/github/downloads/hyglgithub/BiViNote/total?style=flat-square&logo=github&label=downloads)](https://github.com/hyglgithub/BiViNote/releases)
[![GitHub release](https://img.shields.io/github/v/release/hyglgithub/BiViNote?style=flat-square&label=version)](https://github.com/hyglgithub/BiViNote/releases)
[![License](https://img.shields.io/github/license/hyglgithub/BiViNote?style=flat-square)](LICENSE)

在 B站视频页抓取字幕、截取视频帧画面，生成带有截图的 Markdown 笔记。支持接入 DeepSeek AI 自动整理文档。

🌐 官网：<https://hyglgithub.github.io/BiViNote/>

## 功能亮点

- 📝 **字幕抓取** — 自动获取视频字幕，支持多语言切换
- 📷 **视频截图与裁剪** — 一键截取视频帧，支持上一帧/下一帧微调；基于 Cropper.js 裁剪、缩放、旋转、翻转
- 📄 **多格式导出** — SRT 字幕、Markdown 笔记（含截图时打包 ZIP）
- 🤖 **AI 文档整理** — 接入 DeepSeek 自动整理字幕文档，流式输出思考过程和整理结果
- ✍️ **B站笔记保存** — 整理结果一键保存为 B站笔记，随时「查看笔记」回看
- 💬 **发评论** — 整理结果一键发到当前视频的评论区，可开启「帮作者推广」
- 🎛️ **Options 统一配置** — 提示词、模型类型、联网搜索、深度思考集中管理，对所有整理任务生效
- 🌙 **界面与设置** — 夜间模式、字体大小、行高、帧步长、自动滚动

## 功能演示

![字幕抓取功能](docs/screenshots/demo-subtitle.png?v=2)

<br>

![文档整理功能](docs/screenshots/demo-doc-organize.png?v=2)

📺 **视频教程**：[BiViNote 使用教程](https://www.bilibili.com/video/BV18HTj6mEPP)

## 安装

### Chrome / Edge

1. 在 [Releases](https://github.com/hyglgithub/BiViNote/releases) 页面下载最新的 `bivinote-v*-chrome.zip` 包
2. 解压到任意本地目录
3. 打开扩展管理页：Chrome 为 `chrome://extensions/`，Edge 为 `edge://extensions/`
4. 开启「开发者模式」
5. 点击「加载已解压的扩展程序」，选择解压后的目录（包含 `manifest.json` 的目录）

### 从源码安装

```bash
git clone https://github.com/hyglgithub/BiViNote.git
```

然后按上述步骤 3-5 加载扩展。

## 使用

1. 打开 B站视频页（支持 `/video/BV*` 和 `/list/*` 页面）
2. 面板自动显示在视频页（可折叠为可拖动的圆形悬浮图标）；工具栏图标亮起表示当前页面可用，点击工具栏图标可打开 Options 设置页
3. 面板自动获取当前视频字幕
4. 为需要的字幕/章节添加截图
5. 点击「下载（.md）」导出笔记

### 面板功能

| 标签页 | 功能 |
|--------|------|
| 字幕 | 字幕列表、添加截图、复制、跳转；跟随播放高亮，切换视频自动刷新 |
| 章节 | 章节列表、添加截图、复制、跳转 |
| 视频信息 | 勾选需要写入笔记的视频属性（标题/作者/日期/时长/地址/简介/时间戳） |
| 文档整理 | DeepSeek AI 自动整理（详见下节） |
| 设置 | 字体大小、行高、帧步长、自动滚动、夜间模式、悬浮功能条、默认展开面板 |

### 文档整理（AI）

1. 首次使用需登录 DeepSeek（点击「打开 DeepSeek 登录」跳转）
2. 选择提示词类型（视频总结/内容整理/B站专属笔记/自定义）
3. 点击「开始整理」，AI 自动处理，流式输出思考过程和整理结果
4. 整理过程中可点击「停止整理」终止
5. 整理完成后可下载 Markdown（含截图时打包 ZIP）、复制文本、继续在 DeepSeek 追问
6. 整理结果自动缓存，同一视频无需重复整理

> ⚠️ **保持 DeepSeek 页面活动**：插件通过后台 DeepSeek 页面判断登录状态。若已登录 DeepSeek 但插件仍显示「未登录」，请把 `chat.deepseek.com` 加入浏览器的「保持活动」名单，避免后台页面被浏览器休眠：
> - **Edge**：设置 → 系统和性能 → 性能 →「使这些站点保持活动状态」→ 添加 `chat.deepseek.com`
> - **Chrome**：设置 → 性能 →「始终让这些网站保持活动状态」→ 添加 `chat.deepseek.com`
>
> Edge 用户尤其建议添加该设置。更多排查见 Options 页「常见问题」。

> ✍️ **B站笔记保存**：整理完成后点击「记笔记」可将结果保存为 B站笔记（需开通 B站「记笔记」权限），保存成功后按钮切换为「查看笔记」，点击即跳转查看。

提示词可在 Options 页面自定义，支持新增自定义提示词。DeepSeek 的模型类型、联网搜索、深度思考可在 Options 页「模型设置」统一配置，对所有整理任务生效。

### 截图与导出

| 按钮 | 功能 |
|------|------|
| 刷新 | 重新获取当前视频字幕 |
| 复制 | 复制全部字幕文本到剪贴板 |
| 导出（.srt） | 下载 SRT 格式字幕文件 |
| 下载（.md） | 下载 Markdown 笔记（含截图时打包 ZIP） |

**截图操作**

- 点击字幕/章节行的「截图」按钮，自动跳转到对应时间点并截取当前帧
- 点击缩略图打开截图浏览界面，支持拖动图片、上一帧/下一帧、下载、复制到剪贴板
- 浏览界面点「裁剪」进入裁剪模式（裁剪框调整、缩放、旋转、翻转）；点「取消截图」移除已添加的截图

**导出格式**

无截图时直接下载 `.md` 文件：

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

有截图时打包为 `.zip`，笔记正文为 `note.md`，图片统一存放在 `assets/` 目录。

> 章节/字幕时间戳可在「视频信息」页勾选控制，默认不带时间戳。

## 技术栈

<details>
<summary>展开查看</summary>

- **Manifest V3** — Chrome / Edge 扩展，无自建服务器，数据全部经由用户自己的浏览器获取
- **DeepSeek 集成** — MAIN + ISOLATED 双世界脚本注入，SSE 流式解析（7 种事件格式），PoW 挑战求解，stop_stream 终止
- **字幕获取** — 双源 API 策略（`player/wbi/v2` 优先，`player/v2` 回退），按语言优先级排序（中文 > 英文 > 其他）
- **页面鲁棒性** — SPA 路由监听自动刷新，面板存活保护（应对 B站 `#app` 替换），请求 ID 过滤过期响应
- **截图** — OffscreenCanvas 采集视频帧，Cropper.js 提供裁剪、缩放、旋转、翻转
- **导出** — Markdown / SRT / ZIP，图片统一放入 `assets/`

模块职责：

| 模块 | 职责 |
|------|------|
| `background.js` | Service Worker — API 代理、图标状态、SSE 流式中转 |
| `content.js` | 入口脚本 — 面板注入、路由监听、视频切换检测 |
| `js/panel.js` | 面板 UI — 标签页、折叠拖动、设置与整理交互 |
| `js/subtitle.js` · `js/chapter.js` | 字幕/章节的获取、渲染与跳转 |
| `js/deepseek.js` · `js/export.js` | AI 整理通信；SRT / Markdown / ZIP 导出 |

</details>

## 兼容性

- Chrome 88+ (Manifest V3)
- Edge 88+ (Manifest V3)

## 许可证

[MIT](LICENSE)

## 免责声明

> ▎ **用户自负责任条款**：本工具仅在用户已登录 B 站、且有访问权限的前提下获取数据。所有数据通过用户自己的浏览器获取，不经过任何第三方服务器。本工具不存储、不分发任何 B 站内容。使用本工具产生的所有后果由用户自行承担。请遵守 B 站用户协议与相关法律法规。
