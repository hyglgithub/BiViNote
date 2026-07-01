/**
 * Tests for src/core/state.js
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
  revokeObjectURL: () => {}
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

// Load module
require('../src/core/state.js');

test('模块初始化', () => {
  assert(typeof window.BiViNote === 'object', 'window.BiViNote 存在');
  assert(typeof window.BiViNote.state === 'object', 'window.BiViNote.state 存在');
});

test('初始状态值', () => {
  const s = window.BiViNote.state;
  assert(s.bvid === '', 'bvid 初始为空');
  assert(s.aid === '', 'aid 初始为空');
  assert(s.cid === '', 'cid 初始为空');
  assert(s.pageIndex === 1, 'pageIndex 初始为 1');
  assert(s.title === '', 'title 初始为空');
  assert(s.author === '', 'author 初始为空');
  assert(s.uploadDate === '', 'uploadDate 初始为空');
  assert(s.description === '', 'description 初始为空');
  assert(s.videoDuration === 0, 'videoDuration 初始为 0');
  assert(Array.isArray(s.subtitles), 'subtitles 是数组');
  assert(s.subtitles.length === 0, 'subtitles 初始为空');
  assert(s.selectedSubtitleUrl === '', 'selectedSubtitleUrl 初始为空');
  assert(s.selectedSubtitleLang === '', 'selectedSubtitleLang 初始为空');
  assert(Array.isArray(s.subtitleBody), 'subtitleBody 是数组');
  assert(s.subtitleBody.length === 0, 'subtitleBody 初始为空');
  assert(Array.isArray(s.chapters), 'chapters 是数组');
  assert(s.chapters.length === 0, 'chapters 初始为空');
  assert(s.screenshots instanceof Map, 'screenshots 是 Map');
  assert(s.screenshots.size === 0, 'screenshots 初始为空');
  assert(s.panelVisible === false, 'panelVisible 初始为 false');
  assert(s.activeTab === 'subtitle', 'activeTab 初始为 subtitle');
  assert(s.collapsed === false, 'collapsed 初始为 false');
  assert(s.fetchRunId === 0, 'fetchRunId 初始为 0');
});

test('settings 对象', () => {
  const s = window.BiViNote.state;
  assert(typeof s.settings === 'object', 'settings 存在');
  assert(s.settings.fontSize === 'default', 'fontSize 默认值');
  assert(s.settings.lineHeight === 'standard', 'lineHeight 默认值');
  assert(s.settings.frameStep === 0.2, 'frameStep 默认值');
  assert(s.settings.autoScroll === true, 'autoScroll 默认值');
  assert(s.settings.darkMode === false, 'darkMode 默认值');
  assert(s.settings.subtitleLang === '', 'subtitleLang 默认值');
});

test('videoInfoChecked 对象', () => {
  const s = window.BiViNote.state;
  assert(typeof s.videoInfoChecked === 'object', 'videoInfoChecked 存在');
  assert(s.videoInfoChecked.title === true, 'title 默认选中');
  assert(s.videoInfoChecked.author === true, 'author 默认选中');
  assert(s.videoInfoChecked.date === false, 'date 默认未选中');
  assert(s.videoInfoChecked.duration === false, 'duration 默认未选中');
  assert(s.videoInfoChecked.url === false, 'url 默认未选中');
  assert(s.videoInfoChecked.description === false, 'description 默认未选中');
});

test('reset 函数', () => {
  const s = window.BiViNote.state;

  // 修改状态
  s.bvid = 'BV123';
  s.aid = '456';
  s.cid = '789';
  s.title = '测试标题';
  s.author = '测试作者';
  s.subtitles = [{ lan: 'zh' }];
  s.subtitleBody = [{ content: 'test' }];
  s.chapters = [{ title: 'ch1' }];
  s.screenshots.set(0, { blob: {}, url: 'blob:test' });

  // 重置
  s.reset();

  assert(s.bvid === '', 'reset 后 bvid 为空');
  assert(s.aid === '', 'reset 后 aid 为空');
  assert(s.cid === '', 'reset 后 cid 为空');
  assert(s.title === '', 'reset 后 title 为空');
  assert(s.author === '', 'reset 后 author 为空');
  assert(s.subtitles.length === 0, 'reset 后 subtitles 为空');
  assert(s.subtitleBody.length === 0, 'reset 后 subtitleBody 为空');
  assert(s.chapters.length === 0, 'reset 后 chapters 为空');
  assert(s.screenshots.size === 0, 'reset 后 screenshots 为空');
  assert(s.fetchRunId === 1, 'reset 后 fetchRunId 递增');
});

test('reset 递增 fetchRunId', () => {
  const s = window.BiViNote.state;
  const before = s.fetchRunId;
  s.reset();
  assert(s.fetchRunId === before + 1, 'fetchRunId 每次 reset 递增 1');
});

console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
