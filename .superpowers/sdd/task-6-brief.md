# Task 6: 提取 DeepSeek 模块

## 目标

从现有 `background.js` 中提取 DeepSeek 相关代码到 `src/modules/deepseek/` 目录，创建模块化的 DeepSeek 功能文件。

## 需求

### 文件清单

| 操作 | 源文件 | 目标文件 | 说明 |
|------|--------|----------|------|
| Create | `background.js` (DeepSeek 部分) | `src/modules/deepseek/background.js` | DeepSeek background 逻辑 |
| Create | - | `src/modules/deepseek/panel.js` | 标签页注册 |
| Copy | `js/deepseek.js` | `src/modules/deepseek/client.js` | DeepSeek 客户端 |
| Copy | `libs/deepseek-api.js` | `src/modules/deepseek/api.js` | DeepSeek API |
| Copy | `libs/deepseek-bridge.js` | `src/modules/deepseek/bridge.js` | 消息桥接 |
| Copy | `libs/wasm-solver.js` | `src/modules/deepseek/wasm-solver.js` | PoW 求解器 |

### 提取内容

从 `background.js` 第 431 行到文件末尾提取：
- `DS_URL`, `DS_DEFAULT_PROMPT` 常量
- `dsInjectedTabs`, `dsChatId`, `dsSseProcessors`, `dsSenderTabId` 状态变量
- `dsEnsureTab()`, `dsWaitTabComplete()`, `dsInjectScripts()` 工具函数
- `dsCheckLogin()` 登录检测
- `dsSendToBilibiliTab()` 消息发送
- `dsHandleSend()` 请求处理
- `dsCreateSSEProcessor()` SSE 处理器
- DeepSeek 相关的消息处理器

### 接口

- Consumes: `registerHandler` (from core background.js)
- Produces: `window.BiViNote.modules.deepseek.init()` - 模块初始化函数

## 实现步骤

### Step 1: 提取 DeepSeek background 逻辑

### Step 2: 创建 DeepSeek 标签页注册

### Step 3: 复制 DeepSeek 客户端文件

### Step 4: 编写测试

### Step 5: 验证并提交

## 验收标准

- [ ] 所有 DeepSeek 模块文件存在于 `src/modules/deepseek/`
- [ ] 文件语法正确
- [ ] 所有测试通过
- [ ] 提交信息符合规范
