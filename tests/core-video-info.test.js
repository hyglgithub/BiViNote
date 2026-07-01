/**
 * Tests for src/core/video-info.js
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
    querySelectorAll: () => []
  })
};

// Mock navigator.clipboard
global.navigator = {
  clipboard: {
    writeText: () => Promise.resolve()
  }
};

// Mock location
global.location = {
  href: 'https://www.bilibili.com/video/BV123456'
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
require('../src/core/video-info.js');

test('模块初始化', () => {
  assert(typeof window.BiViNote.videoInfo === 'object', 'window.BiViNote.videoInfo 存在');
  assert(typeof window.BiViNote.videoInfo.render === 'function', 'render 是函数');
  assert(typeof window.BiViNote.videoInfo.formatDuration === 'function', 'formatDuration 是函数');
});

test('formatDuration', () => {
  assert(window.BiViNote.videoInfo.formatDuration(0) === '-', '0 秒返回 -');
  assert(window.BiViNote.videoInfo.formatDuration(-1) === '-', '负数返回 -');
  assert(window.BiViNote.videoInfo.formatDuration(null) === '-', 'null 返回 -');
  assert(window.BiViNote.videoInfo.formatDuration(undefined) === '-', 'undefined 返回 -');
  assert(window.BiViNote.videoInfo.formatDuration(65) === '01:05', '65 秒');
  assert(window.BiViNote.videoInfo.formatDuration(3661) === '01:01:01', '3661 秒');
});

console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
