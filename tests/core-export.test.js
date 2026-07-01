/**
 * Tests for src/core/export.js
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

// Mock URL
global.URL = {
  createObjectURL: () => 'blob:test',
  revokeObjectURL: () => {}
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
require('../src/core/export.js');

test('模块初始化', () => {
  assert(typeof window.BiViNote.exportUtil === 'object', 'window.BiViNote.exportUtil 存在');
  assert(typeof window.BiViNote.exportUtil.buildSrt === 'function', 'buildSrt 是函数');
  assert(typeof window.BiViNote.exportUtil.buildMarkdown === 'function', 'buildMarkdown 是函数');
  assert(typeof window.BiViNote.exportUtil.downloadSrt === 'function', 'downloadSrt 是函数');
  assert(typeof window.BiViNote.exportUtil.downloadMarkdown === 'function', 'downloadMarkdown 是函数');
});

test('buildSrt', () => {
  const body = [
    { from: 0, to: 2, content: '第一句' },
    { from: 2, to: 4, content: '第二句' },
    { from: 4, to: 6, content: '第三句' }
  ];
  const srt = window.BiViNote.exportUtil.buildSrt(body);
  assert(srt.includes('1\n00:00:00,000 --> 00:00:02,000\n第一句'), '第一句正确');
  assert(srt.includes('2\n00:00:02,000 --> 00:00:04,000\n第二句'), '第二句正确');
  assert(srt.includes('3\n00:00:04,000 --> 00:00:06,000\n第三句'), '第三句正确');
});

test('buildSrt 无 to 时默认 +2 秒', () => {
  const body = [{ from: 10, content: '测试' }];
  const srt = window.BiViNote.exportUtil.buildSrt(body);
  assert(srt.includes('00:00:10,000 --> 00:00:12,000'), '无 to 时默认 +2 秒');
});

test('buildMarkdown', () => {
  const state = {
    title: '测试标题',
    author: '测试作者',
    uploadDate: '2024-01-01',
    description: '测试简介',
    videoDuration: 120,
    videoInfoChecked: {
      title: true,
      author: true,
      date: true,
      duration: true,
      url: true,
      description: true,
      chapterTimestamp: false,
      subtitleTimestamp: false
    },
    chapters: [],
    subtitleBody: [
      { from: 0, content: '第一句' },
      { from: 2, content: '第二句' }
    ],
    screenshots: new Map()
  };

  const md = window.BiViNote.exportUtil.buildMarkdown(state);
  assert(md.includes('title: "测试标题"'), '包含标题 frontmatter');
  assert(md.includes('author: "测试作者"'), '包含作者 frontmatter');
  assert(md.includes('# 测试标题'), '包含标题');
  assert(md.includes('第一句'), '包含字幕内容');
  assert(md.includes('第二句'), '包含字幕内容');
});

test('buildMarkdown 带章节', () => {
  const state = {
    title: '测试',
    videoInfoChecked: {
      title: true,
      author: false,
      date: false,
      duration: false,
      url: false,
      description: false,
      chapterTimestamp: false,
      subtitleTimestamp: false
    },
    chapters: [
      { from: 0, title: '章节一' },
      { from: 5, title: '章节二' }
    ],
    subtitleBody: [
      { from: 0, content: '字幕1' },
      { from: 3, content: '字幕2' },
      { from: 6, content: '字幕3' }
    ],
    screenshots: new Map()
  };

  const md = window.BiViNote.exportUtil.buildMarkdown(state);
  assert(md.includes('## 章节'), '包含章节标题');
  assert(md.includes('章节一'), '包含章节一');
  assert(md.includes('章节二'), '包含章节二');
  assert(md.includes('### 章节一'), '字幕按章节分段');
  assert(md.includes('字幕1'), '包含字幕1');
  assert(md.includes('字幕2'), '包含字幕2');
});

console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
