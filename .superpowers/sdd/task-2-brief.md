# Task 2: 创建核心消息总线

## 目标

创建核心消息总线模块，用于模块间通信。这是模块化架构的基础组件，其他模块将依赖它进行消息传递。

## 需求

### 文件
- Create: `src/core/message-bus.js`

### 接口
- Produces: `window.BiViNote.messageBus` 全局对象
  - `registerHandler(type, handler)` - 注册消息处理器
  - `handleMessage(message, sender, sendResponse)` - 处理消息

## 实现步骤

### Step 1: 创建消息总线文件

创建 `src/core/message-bus.js`，实现以下功能：

1. 使用 IIFE 包装，避免全局作用域污染
2. 初始化 `window.BiViNote` 命名空间（如果不存在）
3. 实现 `registerHandler(type, handler)` 方法
   - 验证 handler 是函数类型
   - 存储到 handlers 对象中
4. 实现 `handleMessage(message, sender, sendResponse)` 方法
   - 验证消息有效性和 type 属性
   - 查找并调用对应的处理器
   - 返回处理器结果或 false

### Step 2: 编写测试

创建 `tests/message-bus.test.js`，覆盖以下场景：

1. 消息总线初始化
2. 注册处理器
3. 注册非函数处理器（应该失败）
4. 处理已注册的消息
5. 处理未注册的消息
6. 处理无效消息（null, undefined, 无type）
7. 多个处理器
8. 覆盖处理器

### Step 3: 运行测试并提交

```bash
node tests/message-bus.test.js
git add src/core/message-bus.js tests/message-bus.test.js
git commit -m "feat: add message bus for module communication"
```

## 验收标准

- [ ] `src/core/message-bus.js` 文件存在且语法正确
- [ ] `window.BiViNote.messageBus` 对象包含 `registerHandler` 和 `handleMessage` 方法
- [ ] 所有测试通过（19/19）
- [ ] 代码遵循现有代码库模式（IIFE + 全局对象）
- [ ] 提交信息符合规范
