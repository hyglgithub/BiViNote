# Task 4: 提取核心 panel.js

## 目标

从现有的 `js/panel.js` 文件中提取核心面板逻辑，实现动态标签页注册机制。现有的 `panel.js` 包含硬编码的 `TAB_DEFS`，需要替换为允许模块注册自己标签页的动态机制。

## 需求

### 文件
- Create: `src/core/panel.js`

### 核心功能
1. **面板创建和管理**: 创建面板 DOM 元素，管理面板生命周期
2. **标签页切换**: 动态标签页注册和切换逻辑
3. **折叠/展开功能**: 面板折叠为浮动图标，展开恢复
4. **拖动功能**: 面板和折叠图标的拖动
5. **设置绑定**: 设置页面事件绑定
6. **显示设置**: 字体大小、行高等显示设置应用

### 动态标签页注册机制
- 替换硬编码的 `TAB_DEFS` 为动态注册机制
- 提供 `registerTab(tabDef)` 方法供模块注册标签页
- 标签页定义格式: `{ id, label, footer, buildHTML, bindEvents }`
- 支持模块在运行时注册自己的标签页

### 接口
- Produces: `window.BiViNote.panel` 全局对象
  - `registerTab(tabDef)` - 注册标签页
  - `create()` - 创建面板
  - `show()` - 显示面板
  - `hide()` - 隐藏面板
  - `toggle()` - 切换面板显示
  - `switchTab(tabId)` - 切换标签页
  - `updateSubtitleSelect(subtitles, selectedUrl)` - 更新字幕语言下拉
  - `showToast(message)` - 显示提示
  - `renderDoc()` - 渲染文档整理页
  - `resetDocAuto()` - 重置自动整理状态
  - `getPanelEl()` - 获取面板元素
  - `getScrollWrap()` - 获取滚动容器
  - `loadSettingsToUI()` - 加载设置到 UI

## 实现步骤

### Step 1: 创建核心 panel.js 文件

创建 `src/core/panel.js`，实现以下功能：

1. 使用 IIFE 包装，避免全局作用域污染
2. 初始化 `window.BiViNote` 命名空间（如果不存在）
3. 实现标签页注册机制:
   - `tabRegistry` 对象存储注册的标签页
   - `registerTab(tabDef)` 方法验证并存储标签页定义
   - 标签页定义必须包含 `id` 和 `label` 属性
4. 实现面板创建逻辑:
   - `createPanel()` 函数创建面板 DOM
   - 使用注册的标签页动态生成标签按钮和视图
   - 保持现有的折叠/展开、拖动等功能
5. 实现设置绑定和显示设置
6. 导出公开接口到 `window.BiViNote.panel`

### Step 2: 编写测试

创建 `tests/core-panel.test.js`，覆盖以下场景：

1. 面板模块初始化
2. 标签页注册
3. 注册无效标签页（缺少 id 或 label）
4. 重复注册同一标签页
5. 面板创建
6. 标签页切换
7. 折叠/展开功能
8. 设置绑定
9. 显示设置应用

### Step 3: 运行测试并提交

```bash
node tests/core-panel.test.js
git add src/core/panel.js tests/core-panel.test.js
git commit -m "feat: extract core panel.js with dynamic tab registration"
```

## 验收标准

- [ ] `src/core/panel.js` 文件存在且语法正确
- [ ] `window.BiViNote.panel` 对象包含所有指定方法
- [ ] 动态标签页注册机制工作正常
- [ ] 所有测试通过
- [ ] 代码遵循现有代码库模式（IIFE + 全局对象）
- [ ] 提交信息符合规范
