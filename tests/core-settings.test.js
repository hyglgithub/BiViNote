/**
 * Tests for src/core/settings.js
 */

// Mock window
global.window = global;

// Mock chrome API
let storageData = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const result = {};
        keys.forEach(key => {
          if (storageData[key]) result[key] = storageData[key];
        });
        cb(result);
      },
      set: (items, cb) => {
        Object.assign(storageData, items);
        if (cb) cb();
      }
    }
  },
  runtime: { lastError: null }
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

// Load state first
require('../src/core/state.js');
// Load settings
require('../src/core/settings.js');

test('模块初始化', () => {
  assert(typeof window.BiViNote.settings === 'object', 'window.BiViNote.settings 存在');
  assert(typeof window.BiViNote.settings.load === 'function', 'load 是函数');
  assert(typeof window.BiViNote.settings.save === 'function', 'save 是函数');
  assert(typeof window.BiViNote.settings.resetDefaults === 'function', 'resetDefaults 是函数');
  assert(typeof window.BiViNote.settings.DEFAULTS === 'object', 'DEFAULTS 存在');
});

test('DEFAULTS 值', () => {
  const d = window.BiViNote.settings.DEFAULTS;
  assert(d.fontSize === 'default', 'fontSize 默认值');
  assert(d.lineHeight === 'standard', 'lineHeight 默认值');
  assert(d.frameStep === 0.2, 'frameStep 默认值');
  assert(d.autoScroll === true, 'autoScroll 默认值');
  assert(d.darkMode === false, 'darkMode 默认值');
  assert(d.subtitleLang === '', 'subtitleLang 默认值');
  assert(d.downloadDir === '', 'downloadDir 默认值');
  assert(d.promptNoImage === '', 'promptNoImage 默认值');
  assert(d.promptWithImage === '', 'promptWithImage 默认值');
  assert(d.lastOpenMode === 'panel', 'lastOpenMode 默认值');
  assert(d.docOrganizeMode === 'auto', 'docOrganizeMode 默认值');
  assert(d.deepseekPrompt === '', 'deepseekPrompt 默认值');
});

test('load 函数', async () => {
  storageData = {};
  const settings = await window.BiViNote.settings.load();
  assert(typeof settings === 'object', 'load 返回对象');
  assert(settings.fontSize === 'default', 'load 后 fontSize 为默认值');
});

test('load 从存储恢复', async () => {
  storageData = {
    bivinote_settings: { fontSize: 'large', darkMode: true },
    bivinote_videoInfoChecked: { title: false }
  };
  await window.BiViNote.settings.load();
  assert(window.BiViNote.state.settings.fontSize === 'large', 'load 恢复 fontSize');
  assert(window.BiViNote.state.settings.darkMode === true, 'load 恢复 darkMode');
  assert(window.BiViNote.state.videoInfoChecked.title === false, 'load 恢复 videoInfoChecked');
});

test('save 函数', async () => {
  window.BiViNote.state.settings.fontSize = 'small';
  await window.BiViNote.settings.save();
  assert(storageData.bivinote_settings.fontSize === 'small', 'save 保存 fontSize');
});

test('resetDefaults 函数', () => {
  window.BiViNote.state.settings.fontSize = 'large';
  window.BiViNote.state.settings.darkMode = true;
  window.BiViNote.state.settings.promptNoImage = '自定义提示词';
  window.BiViNote.state.settings.promptWithImage = '带图提示词';
  window.BiViNote.state.settings.deepseekPrompt = 'ds 提示词';

  window.BiViNote.settings.resetDefaults();

  assert(window.BiViNote.state.settings.fontSize === 'default', 'resetDefaults 恢复 fontSize');
  assert(window.BiViNote.state.settings.darkMode === false, 'resetDefaults 恢复 darkMode');
  assert(window.BiViNote.state.settings.promptNoImage === '自定义提示词', 'resetDefaults 保留 promptNoImage');
  assert(window.BiViNote.state.settings.promptWithImage === '带图提示词', 'resetDefaults 保留 promptWithImage');
  assert(window.BiViNote.state.settings.deepseekPrompt === 'ds 提示词', 'resetDefaults 保留 deepseekPrompt');
});

console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
