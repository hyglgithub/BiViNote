/**
 * Message Bus Tests
 * 运行方式: node tests/message-bus.test.js
 */

// 模拟浏览器环境
global.window = {};

// 加载 message-bus.js
require('../src/core/message-bus.js');

const messageBus = window.BiViNote.messageBus;

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
  fn();
}

// 测试 1: 消息总线初始化
test('消息总线初始化', () => {
  assert(messageBus !== undefined, 'messageBus 应该存在');
  assert(typeof messageBus.handlers === 'object', 'handlers 应该是对象');
  assert(typeof messageBus.registerHandler === 'function', 'registerHandler 应该是函数');
  assert(typeof messageBus.handleMessage === 'function', 'handleMessage 应该是函数');
});

// 测试 2: 注册处理器
test('注册处理器', () => {
  const handler = () => true;
  messageBus.registerHandler('test-type', handler);
  assert(messageBus.handlers['test-type'] === handler, '处理器应该被注册');
});

// 测试 3: 注册非函数处理器应该失败
test('注册非函数处理器', () => {
  const originalConsoleError = console.error;
  let errorCalled = false;
  console.error = (...args) => {
    if (args[0].includes('handler must be a function')) {
      errorCalled = true;
    }
  };

  messageBus.registerHandler('invalid', 'not a function');
  assert(errorCalled, '应该打印错误信息');
  assert(messageBus.handlers['invalid'] === undefined, '不应该注册非函数处理器');

  console.error = originalConsoleError;
});

// 测试 4: 处理已注册的消息
test('处理已注册的消息', () => {
  let handlerCalled = false;
  let receivedMessage = null;

  messageBus.registerHandler('fetch-data', (message, sender, sendResponse) => {
    handlerCalled = true;
    receivedMessage = message;
    sendResponse({ success: true });
    return true;
  });

  const message = { type: 'fetch-data', url: 'https://example.com' };
  const sender = { tab: { id: 1 } };
  let response = null;
  const sendResponse = (res) => { response = res; };

  const result = messageBus.handleMessage(message, sender, sendResponse);

  assert(handlerCalled, '处理器应该被调用');
  assert(receivedMessage === message, '处理器应该收到正确的消息');
  assert(result === true, '应该返回 true（保持通道开放）');
  assert(response && response.success === true, 'sendResponse 应该被调用');
});

// 测试 5: 处理未注册的消息
test('处理未注册的消息', () => {
  const message = { type: 'unknown-type' };
  const result = messageBus.handleMessage(message, {}, () => {});
  assert(result === false, '未注册的消息应该返回 false');
});

// 测试 6: 处理无效消息
test('处理无效消息', () => {
  assert(messageBus.handleMessage(null, {}, () => {}) === false, 'null 消息应该返回 false');
  assert(messageBus.handleMessage({}, {}, () => {}) === false, '无 type 消息应该返回 false');
  assert(messageBus.handleMessage(undefined, {}, () => {}) === false, 'undefined 消息应该返回 false');
});

// 测试 7: 多个处理器
test('多个处理器', () => {
  let handler1Called = false;
  let handler2Called = false;

  messageBus.registerHandler('type-1', () => { handler1Called = true; return true; });
  messageBus.registerHandler('type-2', () => { handler2Called = true; return false; });

  messageBus.handleMessage({ type: 'type-1' }, {}, () => {});
  messageBus.handleMessage({ type: 'type-2' }, {}, () => {});

  assert(handler1Called, 'type-1 处理器应该被调用');
  assert(handler2Called, 'type-2 处理器应该被调用');
});

// 测试 8: 覆盖处理器
test('覆盖处理器', () => {
  let firstHandlerCalled = false;
  let secondHandlerCalled = false;

  messageBus.registerHandler('override-test', () => { firstHandlerCalled = true; return true; });
  messageBus.registerHandler('override-test', () => { secondHandlerCalled = true; return true; });

  messageBus.handleMessage({ type: 'override-test' }, {}, () => {});

  assert(!firstHandlerCalled, '第一个处理器不应该被调用');
  assert(secondHandlerCalled, '第二个处理器应该被调用');
});

// 输出测试结果
console.log('\n' + '='.repeat(50));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
