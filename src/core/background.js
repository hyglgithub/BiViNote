/**
 * BiViNote Core Background Script (Service Worker)
 * 核心后台逻辑：视频页检测、图标状态管理、Bilibili API 代理
 * 不包含 DeepSeek 相关代码
 */

// ── 消息处理器注册 ──

/**
 * 消息处理器存储（Service Worker 环境无法使用 window.BiViNote）
 */
const messageHandlers = {};

/**
 * 注册消息处理器
 * @param {string} type - 消息类型
 * @param {Function} handler - 处理函数 (message, sender, sendResponse) => boolean
 */
function registerHandler(type, handler) {
  if (typeof handler !== 'function') {
    console.error('[BiViNote] registerHandler: handler must be a function');
    return;
  }
  messageHandlers[type] = handler;
}

/**
 * 处理消息
 * @param {Object} message - 消息对象，必须包含 type 属性
 * @param {Object} sender - 发送者信息
 * @param {Function} sendResponse - 回调函数
 * @returns {boolean} - 是否需要保持消息通道开放
 */
function handleMessage(message, sender, sendResponse) {
  if (!message || !message.type) {
    return false;
  }

  const handler = messageHandlers[message.type];
  if (handler) {
    return handler(message, sender, sendResponse);
  }
  return false;
}

// ── 图标状态管理 ──

/**
 * 判断是否为 B 站视频页面
 * @param {string} url - 页面 URL
 * @returns {boolean}
 */
function isVideoPage(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('bilibili.com') &&
      (parsed.pathname.startsWith('/video/') || parsed.pathname.startsWith('/list/'));
  } catch {
    return false;
  }
}

/**
 * 根据页面 URL 更新扩展图标状态
 * @param {number} tabId - 标签页 ID
 * @param {string} url - 页面 URL
 */
function updateIconForTab(tabId, url) {
  const enabled = isVideoPage(url || '');
  if (enabled) {
    chrome.action.setIcon({
      tabId,
      path: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png'
      }
    }).catch(() => {});
    chrome.action.setTitle({ tabId, title: 'BiViNote - 点击打开' }).catch(() => {});
  } else {
    chrome.action.setIcon({
      tabId,
      path: {
        16: 'icons/icon-16-disabled.png',
        32: 'icons/icon-32-disabled.png',
        48: 'icons/icon-48-disabled.png',
        128: 'icons/icon-128-disabled.png'
      }
    }).catch(() => {});
    chrome.action.setTitle({ tabId, title: 'BiViNote - 仅在B站视频页可用' }).catch(() => {});
  }
}

// ── Chrome 事件监听器 ──

/**
 * 监听标签页 URL 变化
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateIconForTab(tabId, tab.url);
  }
});

/**
 * 监听标签页切换
 */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    updateIconForTab(tabId, tab.url);
  } catch {}
});

/**
 * 扩展安装/更新时，刷新所有标签页图标
 */
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        updateIconForTab(tab.id, tab.url);
      }
    }
  } catch {}
});

/**
 * 扩展图标点击 → 切换面板
 */
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' }).catch(() => {});
});

/**
 * 统一消息监听器
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return handleMessage(message, sender, sendResponse);
});

// ── 核心消息处理器注册 ──

/**
 * 注册 fetch-video-meta 处理器
 */
registerHandler('fetch-video-meta', (message, sender, sendResponse) => {
  fetchVideoMeta(message.bvid)
    .then(data => sendResponse({ ok: true, data }))
    .catch(err => sendResponse({ ok: false, error: err.message }));
  return true;
});

/**
 * 注册 fetch-subtitle-list 处理器
 */
registerHandler('fetch-subtitle-list', (message, sender, sendResponse) => {
  fetchSubtitleList(message.bvid, message.cid, message.aid)
    .then(data => sendResponse({ ok: true, data }))
    .catch(err => sendResponse({ ok: false, error: err.message }));
  return true;
});

/**
 * 注册 fetch-subtitle-body 处理器
 */
registerHandler('fetch-subtitle-body', (message, sender, sendResponse) => {
  fetchSubtitleBody(message.url)
    .then(data => sendResponse({ ok: true, data }))
    .catch(err => sendResponse({ ok: false, error: err.message }));
  return true;
});

// ── Bilibili API 代理 ──

/**
 * 获取视频元信息
 * @param {string} bvid - 视频 BV 号
 * @returns {Promise<Object>} 视频元信息
 */
async function fetchVideoMeta(bvid) {
  const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
  const payload = await fetchJson(url);
  if (payload.code !== 0) {
    throw new Error(payload?.message || '无法获取视频信息');
  }
  const data = payload.data || {};
  const pubdate = Number(data.pubdate || 0);
  const uploadDate = pubdate > 0 ? formatDate(pubdate * 1000) : '';
  const pages = Array.isArray(data.pages) ? data.pages : [];
  return {
    aid: data.aid ? String(data.aid) : '',
    title: String(data.title || ''),
    author: String(data.owner?.name || ''),
    description: String(data.desc || ''),
    uploadDate,
    defaultCid: data.cid ? String(data.cid) : '',
    defaultDuration: Number(data.duration || 0) || 0,
    pages: pages.map(item => ({
      cid: String(item.cid || ''),
      page: Number(item.page || 0) || 0,
      part: String(item.part || '').trim(),
      duration: Number(item.duration || 0) || 0
    }))
  };
}

/**
 * 获取字幕列表和章节
 * 完全遵循 Bilibili-Obsidian-Clipper 的双源策略：
 * 1. 主源：player/wbi/v2?aid=xxx&cid=xxx (用 aid 作为主标识)
 * 2. 回退：player/v2?bvid=xxx&cid=xxx
 * @param {string} bvid - 视频 BV 号
 * @param {string} cid - 分 P ID
 * @param {string} aid - 视频 AV 号（可选）
 * @returns {Promise<Object>} 字幕列表和章节
 */
async function fetchSubtitleList(bvid, cid, aid = '') {
  const requests = buildSubtitleInfoRequests({ bvid, cid, aid });

  for (const request of requests) {
    try {
      const payload = await fetchJson(request.url);
      if (payload.code !== 0) {
        console.warn(`[BiViNote] ${request.source} failed:`, payload?.message);
        continue;
      }
      const data = payload.data || {};
      const subtitles = normalizeSubtitleTracks(
        (data.subtitle?.subtitles || []).map(item => ({
          id: item?.id === undefined || item?.id === null ? '' : String(item.id),
          lan: item?.lan || '',
          lanDoc: item?.lan_doc || '',
          subtitleUrl: normalizeSubtitleUrl(item?.subtitle_url || ''),
          source: request.source
        })).filter(item => item.subtitleUrl)
      );

      const chapters = normalizeChapters(
        (data.view_points || []).map(item => ({
          title: String(item?.content || item?.title || item?.label || '').trim(),
          from: normalizeChapterTime(item?.from ?? item?.start ?? item?.start_time),
          to: normalizeChapterTime(item?.to ?? item?.end ?? item?.end_time)
        }))
      );

      return { subtitles, chapters };
    } catch (err) {
      console.warn(`[BiViNote] ${request.source} error:`, err.message);
      continue;
    }
  }

  // 所有源都失败
  return { subtitles: [], chapters: [] };
}

/**
 * 构建字幕 API 请求列表（双源策略）
 * @param {Object} params - { bvid, cid, aid }
 * @returns {Array<Object>} 请求列表
 */
function buildSubtitleInfoRequests({ bvid, cid, aid }) {
  const safeBvid = encodeURIComponent(String(bvid || ''));
  const safeCid = encodeURIComponent(String(cid || ''));
  const safeAid = encodeURIComponent(String(aid || ''));
  const requests = [];

  // 主源：player/wbi/v2 用 aid 作为主标识
  if (aid) {
    requests.push({
      source: 'player-wbi-v2',
      url: `https://api.bilibili.com/x/player/wbi/v2?aid=${safeAid}&cid=${safeCid}&bvid=${safeBvid}`
    });
  }

  // 回退：player/v2 用 bvid 作为主标识
  requests.push({
    source: 'player-v2',
    url: `https://api.bilibili.com/x/player/v2?bvid=${safeBvid}&cid=${safeCid}` +
      (aid ? `&aid=${safeAid}` : '')
  });

  return requests;
}

/**
 * 获取字幕正文
 * CDN 域名 (hdslb.com) 响应头为 Access-Control-Allow-Origin: *
 * 不能带 credentials，否则 CORS 报错
 * @param {string} url - 字幕 URL
 * @returns {Promise<Array>} 字幕数据
 */
async function fetchSubtitleBody(url) {
  const normalizedUrl = normalizeSubtitleUrl(url);
  const isCdn = normalizedUrl.includes('hdslb.com');
  const resp = await fetch(normalizedUrl, {
    credentials: isCdn ? 'omit' : 'include',
    cache: 'no-store'
  });
  if (!resp.ok) {
    throw new Error(`字幕请求失败：${resp.status}`);
  }
  const data = await resp.json();
  return Array.isArray(data.body) ? data.body : [];
}

// ── 工具函数 ──

/**
 * 通用 JSON 请求
 * @param {string} url - 请求 URL
 * @returns {Promise<Object>} JSON 响应
 */
async function fetchJson(url) {
  const resp = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!resp.ok) {
    throw new Error(`请求失败：${resp.status}`);
  }
  return resp.json();
}

/**
 * 标准化字幕 URL
 * @param {string} url - 原始 URL
 * @returns {string} 标准化后的 URL
 */
function normalizeSubtitleUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url.replace(/^\/+/, '')}`;
}

/**
 * 字幕语言优先级（数值越小越优先）
 * 中文 > 英文 > 其他
 * @param {Object} item - 字幕项
 * @returns {number} 优先级数值
 */
function subtitlePriority(item) {
  const lan = String(item?.lan || '').toLowerCase();
  const label = String(item?.lanDoc || '').toLowerCase();

  if (lan === 'zh-cn' || lan === 'zh-hans') return 0;
  if (lan === 'zh') return 1;
  if (lan.includes('zh')) return 2;
  if (label.includes('中文')) return 3;

  if (lan === 'en' || lan === 'en-us' || lan === 'en-gb') return 10;
  if (lan.includes('en')) return 11;
  if (label.includes('英文') || label.includes('英语') || label.includes('english')) return 12;

  return 50;
}

/**
 * 提取 URL 的稳定部分（去掉 auth_key 等动态参数）
 * @param {string} url - URL
 * @returns {string} URL 路径
 */
function urlPathKey(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return String(url || '').split('?')[0];
  }
}

/**
 * 按语言优先级排序字幕轨道，保证每次顺序一致
 * @param {Array} subtitles - 字幕列表
 * @returns {Array} 排序后的字幕列表
 */
function normalizeSubtitleTracks(subtitles) {
  return [...(subtitles || [])].sort((a, b) => {
    const p = subtitlePriority(a) - subtitlePriority(b);
    if (p !== 0) return p;

    const lanA = String(a.lanDoc || a.lan || '').toLowerCase();
    const lanB = String(b.lanDoc || b.lan || '').toLowerCase();
    if (lanA < lanB) return -1;
    if (lanA > lanB) return 1;

    const idA = Number.parseInt(String(a.id || '0'), 10);
    const idB = Number.parseInt(String(b.id || '0'), 10);
    if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) return idA - idB;

    // 用 URL path 比较，忽略 auth_key 等动态查询参数
    return urlPathKey(a.subtitleUrl).localeCompare(urlPathKey(b.subtitleUrl));
  });
}

/**
 * 标准化章节时间
 * @param {*} value - 时间值
 * @returns {number} 标准化后的秒数
 */
function normalizeChapterTime(value) {
  if (value === undefined || value === null || value === '') return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num > 60 * 60 * 24 ? num / 1000 : num;
}

/**
 * 标准化章节列表
 * @param {Array} chapters - 章节列表
 * @returns {Array} 标准化后的章节列表
 */
function normalizeChapters(chapters) {
  const normalized = (chapters || [])
    .map(item => ({
      title: String(item?.title || '').trim(),
      from: Number(item?.from || 0) || 0,
      to: Number(item?.to || 0) || 0
    }))
    .filter(item => item.title && item.from >= 0)
    .sort((a, b) => a.from - b.from);

  // 去重
  const unique = [];
  const seen = new Set();
  for (const item of normalized) {
    const key = `${Math.floor(item.from * 10)}|${item.title.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

/**
 * 格式化日期
 * @param {number} timestamp - 时间戳（毫秒）
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(timestamp) {
  const d = new Date(timestamp);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── 导出（用于测试） ──

/**
 * 导出核心函数供测试使用
 * 在 Service Worker 环境中，使用全局对象导出
 */
if (typeof globalThis !== 'undefined') {
  globalThis.BiViNoteCore = {
    // 消息处理
    registerHandler,
    handleMessage,
    messageHandlers,

    // 图标状态
    isVideoPage,
    updateIconForTab,

    // API 函数
    fetchVideoMeta,
    fetchSubtitleList,
    fetchSubtitleBody,

    // 工具函数
    fetchJson,
    normalizeSubtitleUrl,
    subtitlePriority,
    urlPathKey,
    normalizeSubtitleTracks,
    normalizeChapterTime,
    normalizeChapters,
    formatDate,
    buildSubtitleInfoRequests
  };
}
