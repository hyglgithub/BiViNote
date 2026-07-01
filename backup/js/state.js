/**
 * BiViNote State Module
 * 集中管理运行时状态
 */
window.BiViNote = window.BiViNote || {};

window.BiViNote.state = {
  // 视频信息
  bvid: '',
  aid: '',
  cid: '',
  pageIndex: 1,
  title: '',
  author: '',
  uploadDate: '',
  description: '',
  videoDuration: 0,

  // 字幕
  subtitles: [],
  selectedSubtitleUrl: '',
  selectedSubtitleLang: '',
  selectedSubtitleId: '',
  subtitleBody: [],

  // 章节
  chapters: [],

  // 截图 Map<subtitleIndex, {blob, url}>
  screenshots: new Map(),

  // UI 状态
  panelVisible: false,
  activeTab: 'subtitle',
  collapsed: false,
  fetchRunId: 0,

  // 设置
  settings: {
    fontSize: 'default',
    lineHeight: 'standard',
    frameStep: 0.2,
    autoScroll: true,
    darkMode: false,
    subtitleLang: ''
  },

  // 视频信息页勾选状态
  videoInfoChecked: {
    title: true,
    author: true,
    date: false,
    duration: false,
    url: false,
    description: false
  }
};

/**
 * 重置运行时状态（视频切换时调用）
 */
window.BiViNote.state.reset = function () {
  const s = window.BiViNote.state;
  s.bvid = '';
  s.aid = '';
  s.cid = '';
  s.pageIndex = 1;
  s.title = '';
  s.author = '';
  s.uploadDate = '';
  s.description = '';
  s.videoDuration = 0;
  s.subtitles = [];
  s.selectedSubtitleUrl = '';
  s.selectedSubtitleLang = '';
  s.selectedSubtitleId = '';
  s.subtitleBody = [];
  s.chapters = [];
  // 递增 runId，取消所有进行中的请求
  s.fetchRunId++;
  // 释放截图 Blob URL
  for (const [, val] of s.screenshots) {
    if (val.url) URL.revokeObjectURL(val.url);
  }
  s.screenshots.clear();
};
