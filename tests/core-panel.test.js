/**
 * Core Panel Tests
 * 运行方式: node tests/core-panel.test.js
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
  addEventListener: () => {},
  createElement: (tag) => createElementMock(),
  body: {
    appendChild: () => {}
  },
  getElementById: () => createElementMock()
};
global.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://test/${path}`
  }
};
global.navigator = {
  clipboard: {
    writeText: () => Promise.resolve()
  }
};
global.location = {
  href: 'https://www.bilibili.com/video/BV1xx411c7mD'
};

// 模拟 window.BiViNote.state
window.BiViNote = {
  state: {
    settings: {
      darkMode: false,
      fontSize: 'default',
      lineHeight: 'standard',
      frameStep: 1,
      autoScroll: true,
      docOrganizeMode: 'manual',
      lastOpenMode: 'panel'
    },
    collapsed: false,
    panelVisible: false,
    activeTab: 'subtitle',
    screenshots: new Map(),
    subtitleBody: [],
    bvid: '',
    cid: '',
    title: '测试视频'
  },
  settings: {
    save: () => {},
    resetDefaults: () => {}
  }
};

// 加载 panel.js
require('../src/core/panel.js');

const panel = window.BiViNote.panel;

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

// 测试 1: 面板模块初始化
test('面板模块初始化', () => {
  assert(panel !== undefined, 'panel 应该存在');
  assert(typeof panel.registerTab === 'function', 'registerTab 应该是函数');
  assert(typeof panel.getRegisteredTabs === 'function', 'getRegisteredTabs 应该是函数');
  assert(typeof panel.create === 'function', 'create 应该是函数');
  assert(typeof panel.show === 'function', 'show 应该是函数');
  assert(typeof panel.hide === 'function', 'hide 应该是函数');
  assert(typeof panel.toggle === 'function', 'toggle 应该是函数');
  assert(typeof panel.switchTab === 'function', 'switchTab 应该是函数');
  assert(typeof panel.updateSubtitleSelect === 'function', 'updateSubtitleSelect 应该是函数');
  assert(typeof panel.showToast === 'function', 'showToast 应该是函数');
  assert(typeof panel.renderDoc === 'function', 'renderDoc 应该是函数');
  assert(typeof panel.resetDocAuto === 'function', 'resetDocAuto 应该是函数');
  assert(typeof panel.getPanelEl === 'function', 'getPanelEl 应该是函数');
  assert(typeof panel.getScrollWrap === 'function', 'getScrollWrap 应该是函数');
  assert(typeof panel.loadSettingsToUI === 'function', 'loadSettingsToUI 应该是函数');
});

// 测试 2: 标签页注册
test('标签页注册', () => {
  const tabDef = {
    id: 'test-tab',
    label: '测试标签',
    footer: false,
    buildHTML: () => '<div>测试内容</div>',
    bindEvents: () => {}
  };

  panel.registerTab(tabDef);
  const tabs = panel.getRegisteredTabs();
  assert(tabs.length === 1, '应该有 1 个注册的标签页');
  assert(tabs[0].id === 'test-tab', '标签页 ID 应该正确');
  assert(tabs[0].label === '测试标签', '标签页标签应该正确');
  assert(tabs[0].footer === false, 'footer 属性应该正确');
  assert(typeof tabs[0].buildHTML === 'function', 'buildHTML 应该是函数');
  assert(typeof tabs[0].bindEvents === 'function', 'bindEvents 应该是函数');
});

// 测试 3: 注册无效标签页
test('注册无效标签页', () => {
  const originalConsoleError = console.error;
  let errorCalled = false;
  console.error = (...args) => {
    if (args[0].includes('registerTab')) {
      errorCalled = true;
    }
  };

  // 测试 null
  panel.registerTab(null);
  assert(errorCalled, '注册 null 应该打印错误');

  errorCalled = false;
  // 测试缺少 id
  panel.registerTab({ label: '测试' });
  assert(errorCalled, '缺少 id 应该打印错误');

  errorCalled = false;
  // 测试缺少 label
  panel.registerTab({ id: 'test' });
  assert(errorCalled, '缺少 label 应该打印错误');

  errorCalled = false;
  // 测试空 id
  panel.registerTab({ id: '', label: '测试' });
  assert(errorCalled, '空 id 应该打印错误');

  console.error = originalConsoleError;
});

// 测试 4: 重复注册同一标签页
test('重复注册同一标签页', () => {
  const tabDef1 = {
    id: 'duplicate-tab',
    label: '第一次注册',
    footer: false
  };

  const tabDef2 = {
    id: 'duplicate-tab',
    label: '第二次注册',
    footer: true
  };

  panel.registerTab(tabDef1);
  panel.registerTab(tabDef2);

  const tabs = panel.getRegisteredTabs();
  const found = tabs.find(t => t.id === 'duplicate-tab');
  assert(found !== undefined, '应该找到重复注册的标签页');
  assert(found.label === '第二次注册', '应该使用最后一次注册的定义');
  assert(found.footer === true, 'footer 属性应该更新');
});

// 测试 5: 获取注册的标签页
test('获取注册的标签页', () => {
  // 清空之前的测试注册
  const registry = panel._tabRegistry;
  Object.keys(registry).forEach(key => delete registry[key]);

  panel.registerTab({ id: 'tab1', label: '标签1' });
  panel.registerTab({ id: 'tab2', label: '标签2' });
  panel.registerTab({ id: 'tab3', label: '标签3' });

  const tabs = panel.getRegisteredTabs();
  assert(tabs.length === 3, '应该有 3 个注册的标签页');
  assert(tabs.some(t => t.id === 'tab1'), '应该包含 tab1');
  assert(tabs.some(t => t.id === 'tab2'), '应该包含 tab2');
  assert(tabs.some(t => t.id === 'tab3'), '应该包含 tab3');
});

// 测试 6: 面板创建
test('面板创建', () => {
  // 清空之前的测试注册
  const registry = panel._tabRegistry;
  Object.keys(registry).forEach(key => delete registry[key]);

  // 注册测试标签页
  panel.registerTab({
    id: 'subtitle',
    label: '字幕',
    footer: true,
    buildHTML: () => '<div id="bn-subtitle-list"></div>'
  });

  panel.registerTab({
    id: 'setting',
    label: '设置',
    footer: false,
    buildHTML: panel._buildSettingHTML
  });

  // 创建面板
  panel.create();

  const panelEl = panel.getPanelEl();
  assert(panelEl !== undefined, '面板元素应该存在');
  assert(panelEl.className.includes('bn-panel'), '面板应该有正确的类名');
  assert(panelEl.className.includes('bn-hidden'), '面板初始应该隐藏');
});

// 测试 7: 标签页切换
test('标签页切换', () => {
  // 清空之前的测试注册
  const registry = panel._tabRegistry;
  Object.keys(registry).forEach(key => delete registry[key]);

  // 注册测试标签页
  panel.registerTab({ id: 'tab1', label: '标签1', footer: true });
  panel.registerTab({ id: 'tab2', label: '标签2', footer: false });

  // 重新创建面板
  panel.create();

  // 切换到 tab2
  panel.switchTab('tab2');
  assert(window.BiViNote.state.activeTab === 'tab2', '活动标签页应该更新');

  // 切换回 tab1
  panel.switchTab('tab1');
  assert(window.BiViNote.state.activeTab === 'tab1', '活动标签页应该切换回来');
});

// 测试 8: 显示/隐藏面板
test('显示/隐藏面板', () => {
  // 清空之前的测试注册
  const registry = panel._tabRegistry;
  Object.keys(registry).forEach(key => delete registry[key]);

  // 注册测试标签页
  panel.registerTab({ id: 'test', label: '测试' });

  // 创建面板
  panel.create();

  // 显示面板
  panel.show();
  assert(window.BiViNote.state.panelVisible === true, '面板应该可见');
  assert(window.BiViNote.state.collapsed === false, '不应该折叠');

  // 隐藏面板
  panel.hide();
  assert(window.BiViNote.state.panelVisible === false, '面板应该隐藏');
  assert(window.BiViNote.state.collapsed === false, '折叠状态应该重置');
});

// 测试 9: 切换面板
test('切换面板', () => {
  // 清空之前的测试注册
  const registry = panel._tabRegistry;
  Object.keys(registry).forEach(key => delete registry[key]);

  // 注册测试标签页
  panel.registerTab({ id: 'test', label: '测试' });

  // 创建面板
  panel.create();

  // 初始状态
  window.BiViNote.state.panelVisible = false;

  // 切换到显示
  panel.toggle();
  assert(window.BiViNote.state.panelVisible === true, '面板应该显示');

  // 切换到隐藏
  panel.toggle();
  assert(window.BiViNote.state.panelVisible === false, '面板应该隐藏');
});

// 测试 10: 设置页 HTML 构建
test('设置页 HTML 构建', () => {
  const html = panel._buildSettingHTML();
  assert(html.includes('bn-settings-main'), '应该包含设置主容器');
  assert(html.includes('bn-lang-select'), '应该包含字幕语言选择');
  assert(html.includes('bn-docMode'), '应该包含文档整理模式');
  assert(html.includes('bn-fontSize'), '应该包含字体大小设置');
  assert(html.includes('bn-lineHeight'), '应该包含行高设置');
  assert(html.includes('bn-frameStep'), '应该包含帧步长设置');
  assert(html.includes('bn-auto-scroll'), '应该包含自动滚动开关');
  assert(html.includes('bn-dark-mode'), '应该包含夜间模式开关');
  assert(html.includes('bn-reset-btn'), '应该包含恢复默认按钮');
});

// 测试 11: 文档整理页 HTML 构建
test('文档整理页 HTML 构建', () => {
  // 测试手动模式
  window.BiViNote.state.settings.docOrganizeMode = 'manual';
  const manualHtml = panel._buildDocHTML();
  assert(manualHtml.includes('bn-download-dir'), '手动模式应该包含下载目录输入');
  assert(manualHtml.includes('bn-prompt-display'), '手动模式应该包含提示词显示');
  assert(manualHtml.includes('bn-prompt-copy'), '手动模式应该包含复制按钮');

  // 测试自动模式
  window.BiViNote.state.settings.docOrganizeMode = 'auto';
  const autoHtml = panel._buildDocHTML();
  assert(autoHtml.includes('bn-ds-status'), '自动模式应该包含状态显示');
  assert(autoHtml.includes('bn-ds-action'), '自动模式应该包含操作按钮');
  assert(autoHtml.includes('bn-ds-prompt'), '自动模式应该包含提示词显示');
  assert(autoHtml.includes('bn-ds-think'), '自动模式应该包含思考区域');
  assert(autoHtml.includes('bn-ds-result'), '自动模式应该包含结果区域');

  // 恢复默认
  window.BiViNote.state.settings.docOrganizeMode = 'manual';
});

// 测试 12: 显示设置应用
test('显示设置应用', () => {
  // 清空之前的测试注册
  const registry = panel._tabRegistry;
  Object.keys(registry).forEach(key => delete registry[key]);

  // 注册测试标签页
  panel.registerTab({ id: 'test', label: '测试' });

  // 创建面板
  panel.create();

  // 测试字体大小设置
  window.BiViNote.state.settings.fontSize = 'large';
  panel._applyDisplaySettings();
  const panelEl = panel.getPanelEl();
  assert(panelEl._styleStore['--bn-font-size'] === '15px', '字体大小应该设置为 15px');

  // 测试行高设置
  window.BiViNote.state.settings.lineHeight = 'wide';
  panel._applyDisplaySettings();
  assert(panelEl._styleStore['--bn-line-height'] === '1.8', '行高应该设置为 1.8');

  // 恢复默认
  window.BiViNote.state.settings.fontSize = 'default';
  window.BiViNote.state.settings.lineHeight = 'standard';
});

// 输出测试结果
console.log('\n' + '='.repeat(50));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
