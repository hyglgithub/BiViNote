# Task 5: 移动核心功能文件

## 目标

将核心功能文件从 `js/` 目录复制到 `src/core/` 目录，保持代码结构和功能不变。这是模块化架构迁移的一部分，为后续的模块分离做准备。

## 需求

### 文件复制清单

| 源文件 | 目标文件 | 说明 |
|--------|----------|------|
| `js/state.js` | `src/core/state.js` | 运行时状态管理 |
| `js/settings.js` | `src/core/settings.js` | 设置读写 |
| `js/capture.js` | `src/core/capture.js` | 截图功能 |
| `js/subtitle.js` | `src/core/subtitle.js` | 字幕获取与渲染 |
| `js/chapter.js` | `src/core/chapter.js` | 章节获取与渲染 |
| `js/video-info.js` | `src/core/video-info.js` | 视频信息展示 |
| `js/export.js` | `src/core/export.js` | 导出功能 |
| `js/crop-viewer.js` | `src/core/crop-viewer.js` | 截图浏览与裁剪 |

### 复制要求

1. **保持代码不变**: 复制时保持原有代码结构和功能完全不变
2. **保持全局对象**: 所有文件继续使用 `window.BiViNote.*` 命名空间
3. **保持依赖关系**: 文件之间的依赖关系不变
4. **保持 IIFE 包装**: 使用 IIFE 包装的文件保持原有包装

## 实现步骤

### Step 1: 复制文件

将上述 8 个文件从 `js/` 复制到 `src/core/`，保持代码完全不变。

### Step 2: 编写测试

为每个复制的文件创建测试，验证：

1. 文件语法正确
2. 模块正确初始化
3. 公开接口存在且类型正确
4. 核心功能正常工作

### Step 3: 验证并提交

```bash
# 运行所有测试
node tests/core-state.test.js
node tests/core-settings.test.js
node tests/core-capture.test.js
node tests/core-subtitle.test.js
node tests/core-chapter.test.js
node tests/core-video-info.test.js
node tests/core-export.test.js
node tests/core-crop-viewer.test.js

# 提交
git add src/core/*.js tests/core-*.test.js
git commit -m "feat: copy core functionality files to src/core/"
```

## 验收标准

- [ ] 所有 8 个文件成功复制到 `src/core/`
- [ ] 文件语法正确
- [ ] 所有测试通过
- [ ] 代码保持原有功能不变
- [ ] 提交信息符合规范
