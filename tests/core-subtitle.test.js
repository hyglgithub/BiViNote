/**
 * Tests for src/core/subtitle.js
 */

// Mock window
global.window = global;

// Mock chrome API
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => cb({}),
      set: (items, cb) => cb && cb()
    }
  },
  runtime: {
    lastError: null,
    sendMessage: (msg, cb) => {
      if (cb) cb({ ok: true, data: {} });
    }
  }
};

// Mock document
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  createElement: () => ({
    className: '',
    innerHTML: '',
    dataset: {},
    addEventListener: () => {},
    appendChild: () => {},
    closest: () => null
  }),
  body: {
    appendChild: () => {}
  }
};

// Mock navigator.clipboard
global.navigator = {
  clipboard: {
    writeText: () => Promise.resolve()
  }
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function test(name, fn) {
  console.log(`\n测试: ${name}`);
  fn();
}

// Load modules
require('../src/core/state.js');
require('../src/core/subtitle.js');

test('模块初始化', () => {
  assert(typeof window.BiViNote.subtitle === 'object', 'window.BiViNote.subtitle 存在');
  assert(typeof window.BiViNote.subtitle.refresh === 'function', 'refresh 是函数');
  assert(typeof window.BiViNote.subtitle.switchSubtitle === 'function', 'switchSubtitle 是函数');
  assert(typeof window.BiViNote.subtitle.copyText === 'function', 'copyText 是函数');
  assert(typeof window.BiViNote.subtitle.renderSubtitleList === 'function', 'renderSubtitleList 是函数');
  assert(typeof window.BiViNote.subtitle.getVideoElement === 'function', 'getVideoElement 是函数');
  assert(typeof window.BiViNote.subtitle.jumpToTime === 'function', 'jumpToTime 是函数');
  assert(typeof window.BiViNote.subtitle.startSync === 'function', 'startSync 是函数');
  assert(typeof window.BiViNote.subtitle.stopSync === 'function', 'stopSync 是函数');
  assert(typeof window.BiViNote.subtitle.formatTime === 'function', 'formatTime 是函数');
  assert(typeof window.BiViNote.subtitle.fetchVideoMeta === 'function', 'fetchVideoMeta 是函数');
  assert(typeof window.BiViNote.subtitle.extractBvid === 'function', 'extractBvid 是函数');
  assert(typeof window.BiViNote.subtitle.extractPageIndex === 'function', 'extractPageIndex 是函数');
  assert(typeof window.BiViNote.subtitle.findActiveIndex === 'function', 'findActiveIndex 是函数');
});

test('extractBvid', () => {
  assert(window.BiViNote.subtitle.extractBvid('https://www.bilibili.com/video/BV1xx411c7mD') === 'BV1xx411c7mD', '提取标准 BV 号');
  assert(window.BiViNote.subtitle.extractBvid('https://www.bilibili.com/video/BV1xx411c7mD?p=1') === 'BV1xx411c7mD', '带参数的 BV 号');
  assert(window.BiViNote.subtitle.extractBvid('https://example.com') === '', '非 B 站 URL 返回空');
});

test('extractPageIndex', () => {
  assert(window.BiViNote.subtitle.extractPageIndex('https://www.bilibili.com/video/BV123?p=2') === 2, '提取 p=2');
  assert(window.BiViNote.subtitle.extractPageIndex('https://www.bilibili.com/video/BV123') === 1, '无 p 参数默认 1');
  assert(window.BiViNote.subtitle.extractPageIndex('https://www.bilibili.com/video/BV123?p=abc') === 1, '无效 p 参数默认 1');
});

test('formatTime', () => {
  assert(window.BiViNote.subtitle.formatTime(0) === '00:00', '0 秒');
  assert(window.BiViNote.subtitle.formatTime(65) === '01:05', '65 秒');
  assert(window.BiViNote.subtitle.formatTime(-5) === '00:00', '负数');
  assert(window.BiViNote.subtitle.formatTime(null) === '00:00', 'null');
});

test('findActiveIndex', () => {
  window.BiViNote.state.subtitleBody = [
    { from: 0, to: 2, content: '第一句' },
    { from: 2, to: 4, content: '第二句' },
    { from: 4, to: 6, content: '第三句' }
  ];

  assert(window.BiViNote.subtitle.findActiveIndex(1) === 0, '时间 1 秒 -> 索引 0');
  assert(window.BiViNote.subtitle.findActiveIndex(3) === 1, '时间 3 秒 -> 索引 1');
  assert(window.BiViNote.subtitle.findActiveIndex(5) === 2, '时间 5 秒 -> 索引 2');
  assert(window.BiViNote.subtitle.findActiveIndex(7) === -1, '时间 7 秒 -> 索引 -1');
  assert(window.BiViNote.subtitle.findActiveIndex(-1) === -1, '负时间 -> 索引 -1');
});

test('getVideoElement', () => {
  // 返回 null 因为 document.querySelector 返回 null
  const video = window.BiViNote.subtitle.getVideoElement();
  assert(video === null, '无视频元素时返回 null');
});

console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
