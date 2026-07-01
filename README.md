# BiViNote｜B站视频字幕笔记（模块化架构）

> 这是 `modular-architecture` 分支，尝试将 BiViNote 拆分为两个版本。  
> 主分支请查看 [`main`](https://github.com/hyglgithub/BiViNote/tree/main)。

## 版本说明

| 版本 | 说明 | 分发方式 |
|------|------|----------|
| **Main（增强实验版）** | 核心功能 + DeepSeek AI 文档整理 | [GitHub Release](https://github.com/hyglgithub/BiViNote/releases) |
| **Lite（绿色精简版）** | 仅核心功能，无 DeepSeek 依赖 | Chrome / Edge 应用商店 |

> DeepSeek 集成需要 MAIN world 脚本注入读取第三方 localStorage token，违反 Chrome Web Store 政策，因此分两个版本。

## 构建

```bash
node scripts/build.js           # 构建两个版本
node scripts/build.js main      # 仅构建 Main
node scripts/build.js lite      # 仅构建 Lite
```

输出到 `dist/main/` 和 `dist/lite/`，在浏览器扩展页面加载即可。

## 项目结构

```
src/
├── core/                    # 核心功能（两个版本共享）
│   ├── message-bus.js       # 消息总线
│   ├── background.js        # Service Worker
│   ├── panel.js             # 面板 UI
│   ├── subtitle.js          # 字幕
│   ├── chapter.js           # 章节
│   ├── video-info.js        # 视频信息
│   ├── capture.js           # 截图
│   ├── crop-viewer.js       # 截图浏览/裁剪
│   ├── export.js            # 导出
│   ├── settings.js          # 设置
│   └── content.js           # 入口脚本
├── modules/deepseek/        # DeepSeek 模块（仅 Main）
└── manifests/               # 两个版本的 manifest
```

## 技术要点

- 模块化架构：核心模块 + 可选功能模块
- 构建时合并：background.js 和 panel.js 在构建时合并
- 标签页注册机制：`registerTab()` 动态注册
- DeepSeek 模块隔离：所有 DeepSeek 代码在 `src/modules/deepseek/`
