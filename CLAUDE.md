# BiViNote - Claude Code Context

## Project Overview

BiViNote is a Chrome/Edge browser extension (Manifest V3) that captures Bilibili video subtitles and screenshots, generating Markdown notes with embedded images.

## Architecture

### Modular Structure

The project uses a modular architecture with two layers:

1. **Core modules** (`src/core/`): Essential functionality shared by all versions
2. **Feature modules** (`src/modules/deepseek/`): Optional DeepSeek AI functionality

### Message Bus

Modules communicate through a centralized message bus (`src/core/message-bus.js`):
- `registerHandler(type, handler)`: Register message handlers
- `handleMessage(message, sender, sendResponse)`: Dispatch messages to handlers

### Core Modules

- **src/core/message-bus.js**: Centralized message bus for inter-module communication
- **src/core/background.js** (Service Worker): Proxies Bilibili API requests (CORS), manages extension icon state
- **src/core/panel.js**: Floating panel UI (400x600px), 5 tabs (字幕/章节/视频信息/文档整理/设置), collapse to draggable icon with quick menu, prompt full-page editor
- **src/core/subtitle.js**: Subtitle fetch, render, highlight sync, click-to-seek, preview popup
- **src/core/chapter.js**: Chapter fetch, render, click-to-seek, preview popup
- **src/core/video-info.js**: Video metadata display with checkboxes (including chapter/subtitle timestamp toggles)
- **src/core/capture.js**: OffscreenCanvas screenshot, save file, clipboard
- **src/core/crop-viewer.js**: Screenshot viewer with Cropper.js (crop, zoom, rotate, flip), sidebar navigation, frame stepping
- **src/core/export.js**: SRT/Markdown/ZIP export (assets/ directory, timestamp toggles)
- **src/core/settings.js**: chrome.storage.local persistence (settings, videoInfoChecked, prompts, downloadDir)
- **src/core/state.js**: Centralized runtime state with fetchRunId for stale request cancellation

### DeepSeek Module

- **src/modules/deepseek/background.js**: DeepSeek backend logic - SSE stream processing, message routing, stop_stream abort
- **src/modules/deepseek/panel.js**: DeepSeek panel extension - document organization tab
- **src/modules/deepseek/client.js**: DeepSeek client - state machine, think/response chunk parsing, request lifecycle, abort with activeRequestId filtering
- **src/modules/deepseek/api.js**: Injected into DeepSeek MAIN world - auth token extraction, PoW solving, completion API, stop_stream API
- **src/modules/deepseek/bridge.js**: Injected into DeepSeek ISOLATED world - message bridge between MAIN world and background
- **src/modules/deepseek/wasm-solver.js**: DeepSeek PoW WASM solver for DeepSeekHashV1 algorithm

### Build System

The build script (`scripts/build.js`) generates two versions:
- **Main version** (`dist/main/`): Core + DeepSeek modules merged
- **Lite version** (`dist/lite/`): Core only, no DeepSeek dependencies

Build process:
1. Core files copied to `js/` directory
2. For Main version: DeepSeek background.js and panel.js merged with core versions
3. DeepSeek module files copied to `modules/deepseek/`
4. Manifest adjusted based on version

## Key Technical Decisions

1. **Modular architecture**: Core modules in `src/core/`, feature modules in `src/modules/`
2. **Message bus pattern**: Centralized `message-bus.js` for inter-module communication
3. **Dual-source API**: Primary `player/wbi/v2?aid=xxx` (more stable), fallback `player/v2?bvid=xxx`
4. **Subtitle sorting**: By language priority (zh > en > other) with URL pathname tiebreaker (ignoring auth_key)
5. **CORS**: CDN requests (hdslb.com) use `credentials: 'omit'`
6. **Icon state**: `chrome.tabs.onUpdated/onActivated` + dimmed PNG variants (black-on-white)
7. **Auto-scroll**: Subtitle page - 3s pause on user scroll; Doc organize page - pause on scroll up, resume on scroll to bottom
8. **Event delegation**: Click handlers attached once per container to prevent listener leaks
9. **Preview dark mode**: Overlay inherits `data-bn-theme` attribute for CSS variable resolution
10. **Crop viewer**: Cropper.js library for image manipulation, sidebar always visible, icon+text toolbar
11. **DeepSeek multi-world injection**: MAIN world (deepseek-api.js) for API calls, ISOLATED world (deepseek-bridge.js) for message bridging
12. **SSE stream parsing**: 7 event formats (fragments, APPEND array/string, path reasoning, thinking type, OpenAI delta, text fallback)
13. **Request lifecycle**: activeRequestId filtering to discard stale chunks after abort; stop_stream API to terminate server-side generation
14. **Build system**: Two versions (Main with DeepSeek, Lite without) generated from modular source

## Features

### Core Features (Both Versions)

- 5 tabs: 字幕, 章节, 视频信息, 文档整理, 设置
- Chapter/subtitle timestamp toggles in export
- Export ZIP uses `assets/` directory (not `screenshots/`)
- Screenshot naming: `bivinote-{bvid}-{MMSS}.png` for download, `{MMSS}.png` for assets
- Video info checkboxes persisted (including chapterTimestamp, subtitleTimestamp), first 6 default checked
- Auto-refresh subtitles on BVID change or page param (p=) change
- Description preserved with line breaks in panel display
- Collapse to draggable circular icon with quick screenshot menu
- Screenshot viewer: Cropper.js crop, zoom, rotate, flip, sidebar navigation
- Frame stepping with flash-free image replacement
- Settings: restore defaults preserves prompts, default doc mode is auto

### Main Version Features (with DeepSeek)

- DeepSeek AI doc organize: auto mode with streaming think/response display, stop button, continue in DeepSeek
- Prompt management: full-page editor for 3 prompt types (manual no-image, manual with-image, auto DeepSeek)

## Reference Projects

- [Bilibili-Obsidian-Clipper](https://github.com/haixiong1997/Bilibili-Obsidian-Clipper): Subtitle fetching, API strategy, SRT/Markdown export
- [BiViShot](https://github.com/hyglgithub/BiViShot): Screenshot capture, frame navigation, clipboard
- [Cropper.js](https://github.com/fengyuanchen/cropperjs): Image cropping library
- [DeepSeek-Web-Plugin](https://github.com/user/DeepSeek-Web-Plugin): DeepSeek API integration, SSE parsing, PoW solving, cookie fallback

## Build & Test

### Build

```bash
# Build both versions
node scripts/build.js

# Build Main version only (core + DeepSeek)
node scripts/build.js main

# Build Lite version only (core only)
node scripts/build.js lite
```

Output:
- `dist/main/` - Main version with DeepSeek AI
- `dist/lite/` - Lite version without DeepSeek

### Load Extension

1. `chrome://extensions/` → Developer mode → Load unpacked
2. Select `dist/main/` or `dist/lite/` directory

### Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/message-bus.test.js
```

## Commit Convention

- `feat:` new feature
- `fix:` bug fix
- `chore:` version bump, release prep
- `docs:` documentation
- Use `Co-Authored-By: Claude <noreply@anthropic.com>` in commit messages

## Release & Deployment

### GitHub Repository Setup (已完成)

首次开源配置步骤：
1. 清理敏感信息（检查 `.gitignore`）
2. 提交 `LICENSE` 文件
3. 编写高质量 `README.md`，配置仓库 About 信息和 Topics 标签
4. 打 Tag 发布第一个 Release（填写 Changelog）
5. 配置 GitHub Actions 自动部署 Pages

### Version Iteration Workflow

后续版本迭代流程：

#### Step 1: 编写更新日志

编辑 `CHANGELOG.md`，在顶部添加新版本内容：

```markdown
## [x.y.z] - YYYY-MM-DD
### Added
- 新增功能描述

### Fixed
- 修复问题描述

### Changed
- 变更描述
```

#### Step 2: 更新版本号

修改 `manifest.json` 中的 `version` 字段：

```json
{
  "version": "x.y.z"
}
```

#### Step 3: 提交并推送

```bash
git add CHANGELOG.md manifest.json
git commit -m "chore: bump version to x.y.z"
git push origin main
```

#### Step 4: 自动发布

GitHub Actions 自动完成：
1. 检测 `manifest.json` 变更触发工作流
2. 打包扩展为 `bivinote-vx.y.z-chrome.zip`
3. 从 `CHANGELOG.md` 提取当前版本更新日志
4. 创建 Release `BiViNote vx.y.z`，附带格式化的更新说明

### Release Naming Convention

- Tag: `vx.y.z`（如 `v2.2.0`）
- Release Name: `BiViNote vx.y.z`
- Asset: `bivinote-vx.y.z-chrome.zip`

### GitHub Pages

- 部署源：`main` 分支 `/docs` 目录
- 访问地址：https://hyglgithub.github.io/BiViNote/
- 更新方式：推送到 main 分支自动触发部署

### Workflow Files

- `.github/workflows/release.yml` - 自动发布工作流
- `CHANGELOG.md` - 版本更新日志
- `docs/` - GitHub Pages 网站文件
