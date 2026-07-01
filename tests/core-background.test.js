/**
 * Core Background Tests
 * 运行方式: node tests/core-background.test.js
 */

// 模拟 Chrome API
global.chrome = {
  tabs: {
    onUpdated: { addListener: () => {} },
    onActivated: { addListener: () => {} },
    get: () => Promise.resolve({ url: '' }),
    query: () => Promise.resolve([]),
    sendMessage: () => Promise.resolve()
  },
  action: {
    setIcon: () => Promise.resolve(),
    setTitle: () => Promise.resolve(),
    onClicked: { addListener: () => {} }
  },
  runtime: {
    onInstalled: { addListener: () => {} },
    onMessage: { addListener: () => {} }
  }
};

// 模拟 fetch
global.fetch = () => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({})
});

// 模拟 globalThis
global.globalThis = global;

// 加载核心模块
require('../src/core/background.js');

const core = globalThis.BiViNoteCore;

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
  assert(core !== undefined, 'BiViNoteCore 应该存在');
  assert(typeof core.registerHandler === 'function', 'registerHandler 应该是函数');
  assert(typeof core.handleMessage === 'function', 'handleMessage 应该是函数');
  assert(typeof core.isVideoPage === 'function', 'isVideoPage 应该是函数');
  assert(typeof core.updateIconForTab === 'function', 'updateIconForTab 应该是函数');
  assert(typeof core.fetchVideoMeta === 'function', 'fetchVideoMeta 应该是函数');
  assert(typeof core.fetchSubtitleList === 'function', 'fetchSubtitleList 应该是函数');
  assert(typeof core.fetchSubtitleBody === 'function', 'fetchSubtitleBody 应该是函数');
  assert(typeof core.normalizeSubtitleUrl === 'function', 'normalizeSubtitleUrl 应该是函数');
  assert(typeof core.subtitlePriority === 'function', 'subtitlePriority 应该是函数');
  assert(typeof core.normalizeSubtitleTracks === 'function', 'normalizeSubtitleTracks 应该是函数');
  assert(typeof core.normalizeChapterTime === 'function', 'normalizeChapterTime 应该是函数');
  assert(typeof core.normalizeChapters === 'function', 'normalizeChapters 应该是函数');
  assert(typeof core.formatDate === 'function', 'formatDate 应该是函数');
  assert(typeof core.buildSubtitleInfoRequests === 'function', 'buildSubtitleInfoRequests 应该是函数');
});

// ── 测试 2: 消息处理器注册 ──

test('消息处理器注册', () => {
  let handlerCalled = false;
  const handler = () => { handlerCalled = true; return true; };

  core.registerHandler('test-register', handler);
  assert(core.messageHandlers['test-register'] === handler, '处理器应该被注册');

  // 测试非函数注册
  const originalConsoleError = console.error;
  let errorCalled = false;
  console.error = (...args) => {
    if (args[0].includes('handler must be a function')) {
      errorCalled = true;
    }
  };

  core.registerHandler('invalid', 'not a function');
  assert(errorCalled, '非函数注册应该打印错误');
  assert(core.messageHandlers['invalid'] === undefined, '非函数不应该被注册');

  console.error = originalConsoleError;
});

// ── 测试 3: 消息处理 ──

test('消息处理', () => {
  // 注册处理器
  let receivedMessage = null;
  core.registerHandler('test-handle', (message, sender, sendResponse) => {
    receivedMessage = message;
    sendResponse({ success: true });
    return true;
  });

  // 处理已注册消息
  const message = { type: 'test-handle', data: 'test' };
  let response = null;
  const result = core.handleMessage(message, {}, (res) => { response = res; });

  assert(result === true, '应该返回 true（保持通道开放）');
  assert(receivedMessage === message, '处理器应该收到正确的消息');
  assert(response && response.success === true, 'sendResponse 应该被调用');

  // 处理未注册消息
  const unknownResult = core.handleMessage({ type: 'unknown' }, {}, () => {});
  assert(unknownResult === false, '未注册消息应该返回 false');

  // 处理无效消息
  assert(core.handleMessage(null, {}, () => {}) === false, 'null 消息应该返回 false');
  assert(core.handleMessage({}, {}, () => {}) === false, '无 type 消息应该返回 false');
  assert(core.handleMessage(undefined, {}, () => {}) === false, 'undefined 消息应该返回 false');
});

// ── 测试 4: isVideoPage ──

test('isVideoPage', () => {
  // B 站视频页
  assert(core.isVideoPage('https://www.bilibili.com/video/BV1xx411c7mD') === true, '应该识别视频页');
  assert(core.isVideoPage('https://www.bilibili.com/list/watchlater') === true, '应该识别稍后再看页');

  // 非视频页
  assert(core.isVideoPage('https://www.bilibili.com/') === false, '首页不是视频页');
  assert(core.isVideoPage('https://www.bilibili.com/channel/tech') === false, '频道页不是视频页');
  assert(core.isVideoPage('https://example.com') === false, '其他网站不是视频页');
  assert(core.isVideoPage('') === false, '空字符串不是视频页');
  assert(core.isVideoPage('invalid-url') === false, '无效 URL 不是视频页');
});

// ── 测试 5: normalizeSubtitleUrl ──

test('normalizeSubtitleUrl', () => {
  assert(core.normalizeSubtitleUrl('') === '', '空字符串应该返回空');
  assert(core.normalizeSubtitleUrl('//example.com/sub.json') === 'https://example.com/sub.json', '应该处理双斜杠');
  assert(core.normalizeSubtitleUrl('https://example.com/sub.json') === 'https://example.com/sub.json', '应该保持 HTTPS');
  assert(core.normalizeSubtitleUrl('http://example.com/sub.json') === 'http://example.com/sub.json', '应该保持 HTTP');
  assert(core.normalizeSubtitleUrl('example.com/sub.json') === 'https://example.com/sub.json', '应该添加 https://');
  assert(core.normalizeSubtitleUrl('/example.com/sub.json') === 'https://example.com/sub.json', '应该去掉开头斜杠');
});

// ── 测试 6: subtitlePriority ──

test('subtitlePriority', () => {
  // 中文优先级
  assert(core.subtitlePriority({ lan: 'zh-cn' }) === 0, 'zh-cn 应该是最高优先级');
  assert(core.subtitlePriority({ lan: 'zh-hans' }) === 0, 'zh-hans 应该是最高优先级');
  assert(core.subtitlePriority({ lan: 'zh' }) === 1, 'zh 应该是第二优先级');
  assert(core.subtitlePriority({ lan: 'zh-TW' }) === 2, 'zh-TW 应该是第三优先级');
  assert(core.subtitlePriority({ lanDoc: '中文' }) === 3, '中文标签应该是第四优先级');

  // 英文优先级
  assert(core.subtitlePriority({ lan: 'en' }) === 10, 'en 应该是英文最高优先级');
  assert(core.subtitlePriority({ lan: 'en-us' }) === 10, 'en-us 应该是英文最高优先级');
  assert(core.subtitlePriority({ lan: 'en-gb' }) === 10, 'en-gb 应该是英文最高优先级');
  assert(core.subtitlePriority({ lan: 'en-GB' }) === 10, 'en-GB 应该是英文最高优先级');
  assert(core.subtitlePriority({ lan: 'en-AU' }) === 11, 'en-AU 应该是英文第二优先级');
  assert(core.subtitlePriority({ lanDoc: '英文' }) === 12, '英文标签应该是英文第三优先级');

  // 其他语言
  assert(core.subtitlePriority({ lan: 'ja' }) === 50, '日语应该是默认优先级');
  assert(core.subtitlePriority({ lan: 'ko' }) === 50, '韩语应该是默认优先级');
  assert(core.subtitlePriority({}) === 50, '空对象应该是默认优先级');
});

// ── 测试 7: urlPathKey ──

test('urlPathKey', () => {
  assert(core.urlPathKey('https://example.com/path?auth_key=123') === '/path', '应该提取路径');
  assert(core.urlPathKey('https://example.com/path') === '/path', '应该处理无参数 URL');
  assert(core.urlPathKey('invalid-url') === 'invalid-url', '无效 URL 应该返回原字符串');
  assert(core.urlPathKey('') === '', '空字符串应该返回空');
});

// ── 测试 8: normalizeSubtitleTracks ──

test('normalizeSubtitleTracks', () => {
  // 空输入
  assert(JSON.stringify(core.normalizeSubtitleTracks([])) === '[]', '空数组应该返回空数组');
  assert(JSON.stringify(core.normalizeSubtitleTracks(null)) === '[]', 'null 应该返回空数组');

  // 排序测试
  const tracks = [
    { lan: 'en', lanDoc: '英文', id: '1', subtitleUrl: 'https://example.com/en.json' },
    { lan: 'zh-cn', lanDoc: '中文', id: '2', subtitleUrl: 'https://example.com/zh.json' },
    { lan: 'ja', lanDoc: '日文', id: '3', subtitleUrl: 'https://example.com/ja.json' }
  ];

  const sorted = core.normalizeSubtitleTracks(tracks);
  assert(sorted[0].lan === 'zh-cn', '中文应该排第一');
  assert(sorted[1].lan === 'en', '英文应该排第二');
  assert(sorted[2].lan === 'ja', '日语应该排第三');
});

// ── 测试 9: normalizeChapterTime ──

test('normalizeChapterTime', () => {
  assert(core.normalizeChapterTime(undefined) === 0, 'undefined 应该返回 0');
  assert(core.normalizeChapterTime(null) === 0, 'null 应该返回 0');
  assert(core.normalizeChapterTime('') === 0, '空字符串应该返回 0');
  assert(core.normalizeChapterTime(-1) === 0, '负数应该返回 0');
  assert(core.normalizeChapterTime(NaN) === 0, 'NaN 应该返回 0');
  assert(core.normalizeChapterTime(60) === 60, '60 秒应该返回 60');
  assert(core.normalizeChapterTime(3600) === 3600, '3600 秒应该返回 3600');
  assert(core.normalizeChapterTime(100000) === 100, '100000 毫秒应该返回 100 秒');
});

// ── 测试 10: normalizeChapters ──

test('normalizeChapters', () => {
  // 空输入
  assert(JSON.stringify(core.normalizeChapters([])) === '[]', '空数组应该返回空数组');
  assert(JSON.stringify(core.normalizeChapters(null)) === '[]', 'null 应该返回空数组');

  // 标准化测试
  const chapters = [
    { title: 'Chapter 2', from: 60, to: 120 },
    { title: 'Chapter 1', from: 0, to: 60 },
    { title: '', from: 30, to: 60 },  // 空标题应该被过滤
    { title: 'Chapter 1', from: 0, to: 60 },  // 重复应该被去重
    { title: 'Chapter 3', from: 120, to: 180 }
  ];

  const normalized = core.normalizeChapters(chapters);
  assert(normalized.length === 3, '应该有 3 个章节');
  assert(normalized[0].title === 'Chapter 1', '第一个应该是 Chapter 1');
  assert(normalized[1].title === 'Chapter 2', '第二个应该是 Chapter 2');
  assert(normalized[2].title === 'Chapter 3', '第三个应该是 Chapter 3');
});

// ── 测试 11: formatDate ──

test('formatDate', () => {
  // 测试固定日期
  const timestamp = new Date(2024, 0, 15).getTime(); // 2024-01-15
  assert(core.formatDate(timestamp) === '2024-01-15', '应该格式化为 YYYY-MM-DD');

  // 测试单位数月日
  const timestamp2 = new Date(2024, 2, 5).getTime(); // 2024-03-05
  assert(core.formatDate(timestamp2) === '2024-03-05', '应该补零');
});

// ── 测试 12: buildSubtitleInfoRequests ──

test('buildSubtitleInfoRequests', () => {
  // 有 aid 时应该有两个请求
  const requests1 = core.buildSubtitleInfoRequests({ bvid: 'BV1xx411c7mD', cid: '123', aid: '456' });
  assert(requests1.length === 2, '有 aid 时应该有 2 个请求');
  assert(requests1[0].source === 'player-wbi-v2', '第一个应该是 player-wbi-v2');
  assert(requests1[1].source === 'player-v2', '第二个应该是 player-v2');

  // 无 aid 时应该只有一个请求
  const requests2 = core.buildSubtitleInfoRequests({ bvid: 'BV1xx411c7mD', cid: '123' });
  assert(requests2.length === 1, '无 aid 时应该有 1 个请求');
  assert(requests2[0].source === 'player-v2', '应该是 player-v2');

  // URL 编码测试
  const requests3 = core.buildSubtitleInfoRequests({ bvid: 'BV1xx411c7mD&test', cid: '123', aid: '456' });
  assert(requests3[0].url.includes('BV1xx411c7mD%26test'), '应该正确编码特殊字符');
});

// ── 测试 13: 覆盖处理器 ──

test('覆盖处理器', () => {
  let firstHandlerCalled = false;
  let secondHandlerCalled = false;

  core.registerHandler('override-test', () => { firstHandlerCalled = true; return true; });
  core.registerHandler('override-test', () => { secondHandlerCalled = true; return true; });

  core.handleMessage({ type: 'override-test' }, {}, () => {});

  assert(!firstHandlerCalled, '第一个处理器不应该被调用');
  assert(secondHandlerCalled, '第二个处理器应该被调用');
});

// ── 测试 14: 多个处理器 ──

test('多个处理器', () => {
  let handler1Called = false;
  let handler2Called = false;

  core.registerHandler('multi-1', () => { handler1Called = true; return true; });
  core.registerHandler('multi-2', () => { handler2Called = true; return false; });

  core.handleMessage({ type: 'multi-1' }, {}, () => {});
  core.handleMessage({ type: 'multi-2' }, {}, () => {});

  assert(handler1Called, 'multi-1 处理器应该被调用');
  assert(handler2Called, 'multi-2 处理器应该被调用');
});

// 输出测试结果
console.log('\n' + '='.repeat(50));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
