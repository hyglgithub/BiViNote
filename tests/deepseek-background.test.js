/**
 * DeepSeek Background Module Tests
 * 运行方式: node tests/deepseek-background.test.js
 */

// 模拟 Chrome API
global.chrome = {
  tabs: {
    onUpdated: { addListener: () => {}, removeListener: () => {} },
    onActivated: { addListener: () => {} },
    onRemoved: { addListener: () => {} },
    get: () => Promise.resolve({ url: '', status: 'complete' }),
    query: () => Promise.resolve([]),
    create: () => Promise.resolve({ id: 123 }),
    update: () => Promise.resolve(),
    sendMessage: () => Promise.resolve()
  },
  action: {
    setIcon: () => Promise.resolve(),
    setTitle: () => Promise.resolve(),
    onClicked: { addListener: () => {} }
  },
  runtime: {
    onInstalled: { addListener: () => {} },
    onMessage: { addListener: () => {} },
    sendMessage: () => Promise.resolve()
  },
  storage: {
    local: {
      get: (key, cb) => cb({}),
      set: () => {}
    }
  },
  scripting: {
    executeScript: () => Promise.resolve([{ result: { loggedIn: true } }])
  },
  cookies: {
    getAll: () => Promise.resolve([])
  }
};

// 模拟 fetch
global.fetch = () => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({})
});

// 模拟 crypto
global.crypto = {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
};

// 模拟 globalThis
global.globalThis = global;

// 模拟核心 background.js 的 registerHandler
global.registerHandler = function(type, handler) {
  if (!global._handlers) global._handlers = {};
  global._handlers[type] = handler;
};

// 加载 DeepSeek 模块
require('../src/modules/deepseek/background.js');

const ds = globalThis.BiViNoteDeepSeek;

// 测试计数器
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ ${message}`);
    failed++;
  }
}

function test(name, fn) {
  console.log(`\n测试: ${name}`);
  try {
    fn();
  } catch (err) {
    console.error(`✗ ${name} - 异常: ${err.message}`);
    failed++;
  }
}

// ── 测试 1: 模块初始化 ──

test('模块初始化', () => {
  assert(ds !== undefined, 'BiViNoteDeepSeek 应该存在');
  assert(typeof ds.initDeepSeekModule === 'function', 'initDeepSeekModule 应该是函数');
  assert(typeof ds.registerDeepSeekHandlers === 'function', 'registerDeepSeekHandlers 应该是函数');
});

// ── 测试 2: 常量定义 ──

test('常量定义', () => {
  assert(typeof ds.DS_URL === 'string', 'DS_URL 应该是字符串');
  assert(ds.DS_URL === 'https://chat.deepseek.com', 'DS_URL 应该是 DeepSeek URL');
  assert(typeof ds.DS_DEFAULT_PROMPT === 'string', 'DS_DEFAULT_PROMPT 应该是字符串');
  assert(ds.DS_DEFAULT_PROMPT.includes('{markdown}'), 'DS_DEFAULT_PROMPT 应该包含 {markdown} 占位符');
});

// ── 测试 3: 状态变量 ──

test('状态变量', () => {
  assert(ds.dsInjectedTabs instanceof Set, 'dsInjectedTabs 应该是 Set');
  assert(typeof ds.dsSseProcessors === 'object', 'dsSseProcessors 应该是对象');
});

// ── 测试 4: 工具函数存在性 ──

test('工具函数存在性', () => {
  assert(typeof ds.dsEnsureTab === 'function', 'dsEnsureTab 应该是函数');
  assert(typeof ds.dsWaitTabComplete === 'function', 'dsWaitTabComplete 应该是函数');
  assert(typeof ds.dsInjectScripts === 'function', 'dsInjectScripts 应该是函数');
  assert(typeof ds.dsCheckLogin === 'function', 'dsCheckLogin 应该是函数');
  assert(typeof ds.dsSendToBilibiliTab === 'function', 'dsSendToBilibiliTab 应该是函数');
  assert(typeof ds.dsHandleSend === 'function', 'dsHandleSend 应该是函数');
  assert(typeof ds.dsCreateSSEProcessor === 'function', 'dsCreateSSEProcessor 应该是函数');
});

// ── 测试 5: SSE 处理器创建 ──

test('SSE 处理器创建', () => {
  const processor = ds.dsCreateSSEProcessor();
  assert(typeof processor === 'object', 'SSE 处理器应该是对象');
  assert(typeof processor.processChunk === 'function', 'processChunk 应该是函数');
  assert(typeof processor.flush === 'function', 'flush 应该是函数');
  assert(typeof processor.getChatId === 'function', 'getChatId 应该是函数');
  assert(typeof processor.getMessageId === 'function', 'getMessageId 应该是函数');
});

// ── 测试 6: SSE 处理器 - 普通文本处理 ──

test('SSE 处理器 - 普通文本处理', () => {
  const processor = ds.dsCreateSSEProcessor();

  // 测试 APPEND 字符串
  const result1 = processor.processChunk('data: {"o":"APPEND","v":"Hello"}\n');
  assert(result1 === 'Hello', '应该处理 APPEND 字符串');

  // 测试带路径的文本
  const result2 = processor.processChunk('data: {"p":"response","v":"World"}\n');
  assert(result2 === 'World', '应该处理带路径的文本');
});

// ── 测试 7: SSE 处理器 - think 标签处理 ──

test('SSE 处理器 - think 标签处理', () => {
  const processor = ds.dsCreateSSEProcessor();

  // 测试 reasoning 内容
  const result1 = processor.processChunk('data: {"p":"reasoning","v":"thinking..."}\n');
  assert(result1.includes('<think>'), '应该添加 <think> 标签');
  assert(result1.includes('thinking...'), '应该包含 reasoning 内容');

  // 测试 flush
  const flushResult = processor.flush();
  assert(flushResult.includes('</think>'), 'flush 应该关闭 think 标签');
});

// ── 测试 8: SSE 处理器 - fragments 处理 ──

test('SSE 处理器 - fragments 处理', () => {
  const processor = ds.dsCreateSSEProcessor();

  const chunk = 'data: {"v":{"response":{"fragments":[{"type":"RESPONSE","content":"Hello"},{"type":"THINK","content":"thinking"},{"type":"RESPONSE","content":"World"}]}}}\n';
  const result = processor.processChunk(chunk);
  assert(result.includes('Hello'), '应该包含第一个 RESPONSE 片段');
  assert(result.includes('<think>'), '应该添加 think 标签');
  assert(result.includes('thinking'), '应该包含 THINK 片段内容');
  assert(result.includes('World'), '应该包含第二个 RESPONSE 片段');
});

// ── 测试 9: SSE 处理器 - APPEND 数组处理 ──

test('SSE 处理器 - APPEND 数组处理', () => {
  const processor = ds.dsCreateSSEProcessor();

  const chunk = 'data: {"o":"APPEND","v":[{"type":"RESPONSE","content":"Hello"},{"type":"THINK","content":"思考中"},{"type":"text","content":"World"}]}\n';
  const result = processor.processChunk(chunk);
  assert(result.includes('Hello'), '应该包含 RESPONSE 内容');
  assert(result.includes('<think>'), '应该添加 think 标签');
  assert(result.includes('思考中'), '应该包含 THINK 内容');
  assert(result.includes('World'), '应该包含 text 内容');
});

// ── 测试 10: SSE 处理器 - chatId 提取 ──

test('SSE 处理器 - chatId 提取', () => {
  const processor = ds.dsCreateSSEProcessor();

  processor.processChunk('data: {"type":"deepseek:chat_session_id","chat_session_id":"test-chat-123"}\n');
  assert(processor.getChatId() === 'test-chat-123', '应该提取 chatId');
});

// ── 测试 11: SSE 处理器 - messageId 提取 ──

test('SSE 处理器 - messageId 提取', () => {
  const processor = ds.dsCreateSSEProcessor();

  processor.processChunk('data: {"response_message_id":"msg-456","v":"test"}\n');
  assert(processor.getMessageId() === 'msg-456', '应该提取 messageId');
});

// ── 测试 12: 消息处理器注册 ──

test('消息处理器注册', () => {
  assert(global._handlers !== undefined, '应该有处理器注册');
  assert(typeof global._handlers['ds-check-login'] === 'function', '应该注册 ds-check-login 处理器');
  assert(typeof global._handlers['ds-abort'] === 'function', '应该注册 ds-abort 处理器');
  assert(typeof global._handlers['ds-send'] === 'function', '应该注册 ds-send 处理器');
  assert(typeof global._handlers['ds-open-login'] === 'function', '应该注册 ds-open-login 处理器');
  assert(typeof global._handlers['ds-open-chat'] === 'function', '应该注册 ds-open-chat 处理器');
  assert(typeof global._handlers['DEEPSEEK_CHUNK'] === 'function', '应该注册 DEEPSEEK_CHUNK 处理器');
  assert(typeof global._handlers['DEEPSEEK_DONE'] === 'function', '应该注册 DEEPSEEK_DONE 处理器');
  assert(typeof global._handlers['DEEPSEEK_ERROR'] === 'function', '应该注册 DEEPSEEK_ERROR 处理器');
});

// ── 测试 13: dsSendToBilibiliTab 无 senderTabId ──

test('dsSendToBilibiliTab 无 senderTabId', () => {
  // 当 dsSenderTabId 为 null 时，不应该抛出错误
  try {
    ds.dsSendToBilibiliTab({ type: 'test' });
    assert(true, '无 senderTabId 时不应抛出错误');
  } catch (e) {
    assert(false, '无 senderTabId 时不应抛出错误');
  }
});

// ── 测试 14: SSE 处理器 - thinking 类型处理 ──

test('SSE 处理器 - thinking 类型处理', () => {
  const processor = ds.dsCreateSSEProcessor();

  const result = processor.processChunk('data: {"type":"thinking","v":"正在思考..."}\n');
  assert(result.includes('<think>'), '应该添加 think 标签');
  assert(result.includes('正在思考...'), '应该包含 thinking 内容');
});

// ── 测试 15: SSE 处理器 - OpenAI delta 格式 ──

test('SSE 处理器 - OpenAI delta 格式', () => {
  const processor = ds.dsCreateSSEProcessor();

  // 测试 reasoning_content
  const result1 = processor.processChunk('data: {"choices":[{"delta":{"reasoning_content":"推理中..."}}]}\n');
  assert(result1.includes('<think>'), '应该添加 think 标签');
  assert(result1.includes('推理中...'), '应该包含 reasoning_content');

  // 测试 content
  const processor2 = ds.dsCreateSSEProcessor();
  const result2 = processor2.processChunk('data: {"choices":[{"delta":{"content":"回答内容"}}]}\n');
  assert(result2.includes('回答内容'), '应该包含 content');
});

// ── 测试结果 ──

console.log('\n' + '='.repeat(50));
console.log(`DeepSeek Background 模块测试结果:`);
console.log(`  通过: ${passed}`);
console.log(`  失败: ${failed}`);
console.log(`  总计: ${passed + failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
