/**
 * Tests for src/core/chapter.js
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
  runtime: { lastError: null }
};

// Mock document
global.document = {
  getElementById: () => null,
  createElement: () => ({
    className: '',
    innerHTML: '',
    dataset: {},
    addEventListener: () => {},
    appendChild: () => {},
    closest: () => null
  })
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
require('../src/core/chapter.js');

test('模块初始化', () => {
  assert(typeof window.BiViNote.chapter === 'object', 'window.BiViNote.chapter 存在');
  assert(typeof window.BiViNote.chapter.render === 'function', 'render 是函数');
  assert(typeof window.BiViNote.chapter.jumpToChapter === 'function', 'jumpToChapter 是函数');
  assert(typeof window.BiViNote.chapter.formatTime === 'function', 'formatTime 是函数');
});

test('formatTime', () => {
  assert(window.BiViNote.chapter.formatTime(0) === '00:00', '0 秒');
  assert(window.BiViNote.chapter.formatTime(65) === '01:05', '65 秒');
  assert(window.BiViNote.chapter.formatTime(3661) === '01:01:01', '3661 秒');
  assert(window.BiViNote.chapter.formatTime(-5) === '00:00', '负数');
  assert(window.BiViNote.chapter.formatTime(null) === '00:00', 'null');
  assert(window.BiViNote.chapter.formatTime(undefined) === '00:00', 'undefined');
});

test('jumpToChapter', () => {
  // 无视频元素，应该不抛出错误
  window.BiViNote.chapter.jumpToChapter(10);
  assert(true, '无视频元素时不抛出错误');
});

console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
