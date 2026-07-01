/**
 * Tests for src/core/capture.js
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

// Mock URL
global.URL = {
  createObjectURL: () => 'blob:test',
  revokeObjectURL: () => {}
};

// Mock OffscreenCanvas
global.OffscreenCanvas = class {
  constructor(w, h) {
    this.width = w;
    this.height = h;
  }
  getContext() {
    return {
      drawImage: () => {}
    };
  }
  convertToBlob() {
    return Promise.resolve(new Blob(['test'], { type: 'image/png' }));
  }
};

// Mock navigator.clipboard
global.navigator = {
  clipboard: {
    write: () => Promise.resolve(),
    writeText: () => Promise.resolve()
  }
};

// Mock document
global.document = {
  createElement: () => ({
    href: '',
    download: '',
    click: () => {},
    remove: () => {}
  }),
  body: {
    appendChild: () => {}
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
require('../src/core/capture.js');

test('模块初始化', () => {
  assert(typeof window.BiViNote.capture === 'object', 'window.BiViNote.capture 存在');
  assert(typeof window.BiViNote.capture.captureFrame === 'function', 'captureFrame 是函数');
  assert(typeof window.BiViNote.capture.addScreenshot === 'function', 'addScreenshot 是函数');
  assert(typeof window.BiViNote.capture.addChapterScreenshot === 'function', 'addChapterScreenshot 是函数');
  assert(typeof window.BiViNote.capture.removeScreenshot === 'function', 'removeScreenshot 是函数');
  assert(typeof window.BiViNote.capture.saveToFile === 'function', 'saveToFile 是函数');
  assert(typeof window.BiViNote.capture.copyToClipboard === 'function', 'copyToClipboard 是函数');
  assert(typeof window.BiViNote.capture.formatTimeCode === 'function', 'formatTimeCode 是函数');
  assert(typeof window.BiViNote.capture.formatTimeDisplay === 'function', 'formatTimeDisplay 是函数');
  assert(typeof window.BiViNote.capture.generateDownloadFilename === 'function', 'generateDownloadFilename 是函数');
  assert(typeof window.BiViNote.capture.generateAssetFilename === 'function', 'generateAssetFilename 是函数');
});

test('formatTimeCode', () => {
  assert(window.BiViNote.capture.formatTimeCode(0) === '0000', '0 秒 = 0000');
  assert(window.BiViNote.capture.formatTimeCode(65) === '0105', '65 秒 = 0105');
  assert(window.BiViNote.capture.formatTimeCode(3661) === '010101', '3661 秒 = 010101');
  assert(window.BiViNote.capture.formatTimeCode(-5) === '0000', '负数 = 0000');
  assert(window.BiViNote.capture.formatTimeCode(null) === '0000', 'null = 0000');
  assert(window.BiViNote.capture.formatTimeCode(undefined) === '0000', 'undefined = 0000');
});

test('formatTimeDisplay', () => {
  assert(window.BiViNote.capture.formatTimeDisplay(0) === '00:00', '0 秒 = 00:00');
  assert(window.BiViNote.capture.formatTimeDisplay(65) === '01:05', '65 秒 = 01:05');
  assert(window.BiViNote.capture.formatTimeDisplay(3661) === '01:01:01', '3661 秒 = 01:01:01');
  assert(window.BiViNote.capture.formatTimeDisplay(-5) === '00:00', '负数 = 00:00');
});

test('generateDownloadFilename', () => {
  window.BiViNote.state.bvid = 'BV123456';
  const fn = window.BiViNote.capture.generateDownloadFilename(65);
  assert(fn === 'bivinote-BV123456-0105.png', '生成正确的下载文件名');
});

test('generateAssetFilename', () => {
  const fn = window.BiViNote.capture.generateAssetFilename(65);
  assert(fn === '0105.png', '生成正确的 assets 文件名');
});

test('captureFrame', async () => {
  const video = {
    videoWidth: 1920,
    videoHeight: 1080
  };
  const blob = await window.BiViNote.capture.captureFrame(video);
  assert(blob instanceof Blob, '返回 Blob');
  assert(blob.type === 'image/png', '类型为 image/png');
});

test('captureFrame 视频未加载', async () => {
  const video = { videoWidth: 0, videoHeight: 0 };
  try {
    await window.BiViNote.capture.captureFrame(video);
    assert(false, '应该抛出错误');
  } catch (err) {
    assert(err.message === '视频未加载，无法截取', '抛出正确的错误信息');
  }
});

console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
