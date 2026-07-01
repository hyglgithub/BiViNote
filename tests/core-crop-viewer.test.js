/**
 * Tests for src/core/crop-viewer.js
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
  querySelector: () => null,
  createElement: () => ({
    className: '',
    innerHTML: '',
    dataset: {},
    style: {},
    addEventListener: () => {},
    appendChild: () => {},
    remove: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute: () => {},
    setProperty: () => {}
  }),
  body: {
    appendChild: () => {}
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Mock window
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Mock Cropper
global.Cropper = class {
  constructor() {}
  destroy() {}
  resize() {}
  zoom() {}
  rotate() {}
  scale() {}
  reset() {}
  replace() {}
  getCroppedCanvas() {
    return {
      toBlob: (cb) => cb(new Blob(['test'], { type: 'image/png' }))
    };
  }
  setAspectRatio() {}
};

// Mock Image
global.Image = class {
  constructor() {}
  set src(val) {
    if (this.onload) this.onload();
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
require('../src/core/crop-viewer.js');

test('模块初始化', () => {
  assert(typeof window.BiViNote.cropViewer === 'object', 'window.BiViNote.cropViewer 存在');
  assert(typeof window.BiViNote.cropViewer.open === 'function', 'open 是函数');
  assert(typeof window.BiViNote.cropViewer.close === 'function', 'close 是函数');
});

test('open 无截图时不抛出错误', () => {
  window.BiViNote.state.screenshots.clear();
  window.BiViNote.cropViewer.open(0);
  assert(true, '无截图时不抛出错误');
});

test('close 不抛出错误', () => {
  window.BiViNote.cropViewer.close();
  assert(true, 'close 不抛出错误');
});

console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
