/**
 * DeepSeek Panel Module Tests
 * 运行方式: node tests/deepseek-panel.test.js
 */

// 模拟浏览器环境
global.window = {};

// 创建可链式调用的元素模拟
function createElementMock() {
  const styleStore = {};
  const mock = {
    className: '',
    id: '',
    style: {
      setProperty: (key, value) => { styleStore[key] = value; },
      left: '',
      top: '',
      right: ''
    },
    setAttribute: () => {},
    appendChild: () => {},
    addEventListener: () => {},
    querySelector: () => createElementMock(),
    querySelectorAll: () => [],
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false
    },
    innerHTML: '',
    textContent: '',
    dataset: {},
    closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    _styleStore: styleStore
  };
  return mock;
}

global.document = {
  addListener: () => {},
  createElement: (tag) => createElementMock(),
  body: {
    appendChild: () => {}
  },
  getElementById: () => createElementMock()
};

// 模拟核心 panel 模块
window.BiViNote = {
  panel: {
    registerTab: function(tabDef) {
      if (!window.BiViNote._registeredTabs) {
        window.BiViNote._registeredTabs = {};
      }
      window.BiViNote._registeredTabs[tabDef.id] = tabDef;
    },
    getRegisteredTabs: function() {
      return Object.values(window.BiViNote._registeredTabs || {});
    }
  },
  _registeredTabs: {}
};

// 加载 DeepSeek panel 模块
require('../src/modules/deepseek/panel.js');

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

// ── 测试 1: 标签页注册 ──

test('标签页注册', () => {
  const registeredTabs = window.BiViNote._registeredTabs;
  assert(registeredTabs !== undefined, '应该有注册的标签页');
  assert(registeredTabs['doc'] !== undefined, '应该注册 doc 标签页');
});

// ── 测试 2: doc 标签页定义 ──

test('doc 标签页定义', () => {
  const docTab = window.BiViNote._registeredTabs['doc'];
  assert(docTab.id === 'doc', '标签页 ID 应该是 doc');
  assert(docTab.label === '文档整理', '标签页标签应该是 文档整理');
  assert(docTab.footer === false, 'footer 应该是 false');
});

// ── 测试 3: registerTab 函数调用 ──

test('registerTab 函数调用', () => {
  // 验证 registerTab 被正确调用
  const tabs = window.BiViNote.panel.getRegisteredTabs();
  assert(tabs.length > 0, '应该有注册的标签页');
  assert(tabs.some(t => t.id === 'doc'), '应该包含 doc 标签页');
});

// ── 测试结果 ──

console.log('\n' + '='.repeat(50));
console.log(`DeepSeek Panel 模块测试结果:`);
console.log(`  通过: ${passed}`);
console.log(`  失败: ${failed}`);
console.log(`  总计: ${passed + failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
