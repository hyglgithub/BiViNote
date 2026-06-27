/**
 * BiViNote Background Script (Service Worker)
 * 代理 Bilibili API 请求，处理 CORS
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'fetch-video-meta') {
    fetchVideoMeta(message.bvid)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'fetch-subtitle-list') {
    fetchSubtitleList(message.bvid, message.cid, message.aid)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'fetch-subtitle-body') {
    fetchSubtitleBody(message.url)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

// 扩展图标点击 → 切换面板
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' }).catch(() => {});
});

/**
 * 获取视频元信息
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
 */
async function fetchSubtitleList(bvid, cid, aid = '') {
  const safeBvid = encodeURIComponent(String(bvid || ''));
  const safeCid = encodeURIComponent(String(cid || ''));
  const safeAid = encodeURIComponent(String(aid || ''));

  // 优先 player-v2
  const url = `https://api.bilibili.com/x/player/v2?bvid=${safeBvid}&cid=${safeCid}` +
    (aid ? `&aid=${safeAid}` : '');

  const payload = await fetchJson(url);
  if (payload.code !== 0) {
    throw new Error(payload?.message || '无法获取字幕列表');
  }

  const data = payload.data || {};
  const subtitles = (data.subtitle?.subtitles || []).map(item => ({
    id: item?.id === undefined || item?.id === null ? '' : String(item.id),
    lan: item?.lan || '',
    lanDoc: item?.lan_doc || '',
    subtitleUrl: normalizeSubtitleUrl(item?.subtitle_url || '')
  })).filter(item => item.subtitleUrl);

  const chapters = normalizeChapters(
    (data.view_points || []).map(item => ({
      title: String(item?.content || item?.title || item?.label || '').trim(),
      from: normalizeChapterTime(item?.from ?? item?.start ?? item?.start_time),
      to: normalizeChapterTime(item?.to ?? item?.end ?? item?.end_time)
    }))
  );

  return { subtitles, chapters };
}

/**
 * 获取字幕正文
 */
async function fetchSubtitleBody(url) {
  const normalizedUrl = normalizeSubtitleUrl(url);
  const resp = await fetch(normalizedUrl, { credentials: 'include', cache: 'no-store' });
  if (!resp.ok) {
    throw new Error(`字幕请求失败：${resp.status}`);
  }
  const data = await resp.json();
  return Array.isArray(data.body) ? data.body : [];
}

/**
 * 通用 JSON 请求
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
 */
function normalizeSubtitleUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url.replace(/^\/+/, '')}`;
}

/**
 * 标准化章节时间
 */
function normalizeChapterTime(value) {
  if (value === undefined || value === null || value === '') return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num > 60 * 60 * 24 ? num / 1000 : num;
}

/**
 * 标准化章节列表
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
 */
function formatDate(timestamp) {
  const d = new Date(timestamp);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
