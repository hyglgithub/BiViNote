/**
 * BiViNote Background Script (Service Worker)
 * 代理 Bilibili API 请求，处理 CORS，管理图标状态
 */

// ── 图标状态管理 ──

function isVideoPage(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('bilibili.com') &&
      (parsed.pathname.startsWith('/video/') || parsed.pathname.startsWith('/list/'));
  } catch {
    return false;
  }
}

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

// 监听标签页 URL 变化
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateIconForTab(tabId, tab.url);
  }
});

// 监听标签页切换
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    updateIconForTab(tabId, tab.url);
  } catch {}
});

// 扩展安装/更新时，刷新所有标签页图标
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

// ── 消息监听 ──

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

  // 打开选项页面
  if (message.type === 'open-options') {
    chrome.runtime.openOptionsPage();
    return false;
  }

  // ── DeepSeek 文档整理 ──

  if (message.type === 'ds-check-login') {
    dsCheckLogin().then(result => sendResponse(result));
    return true;
  }

  if (message.type === 'ds-abort') {
    // 获取当前请求的 chatId 和 messageId，发送 stop_stream 到 DeepSeek 标签页
    const processorIds = Object.keys(dsSseProcessors);
    if (processorIds.length > 0) {
      const processor = dsSseProcessors[processorIds[0]];
      const chatId = processor.getChatId();
      const messageId = processor.getMessageId();
      chrome.tabs.query({ url: '*://chat.deepseek.com/*' }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ds-abort-stop',
            chatId,
            messageId,
          }).catch(() => {});
        }
      });
    }
    dsSseProcessors = {};
    return false;
  }

  if (message.type === 'ds-send') {
    const requestId = message.requestId || crypto.randomUUID();
    dsHandleSend(message.markdown, message.prompt, requestId, message.thinking, message.taskId || 'clear');
    sendResponse({ ok: true, requestId });
    return true;
  }

  if (message.type === 'ds-open-login') {
    chrome.tabs.query({ url: '*://chat.deepseek.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
      } else {
        chrome.tabs.create({ url: 'https://chat.deepseek.com' });
      }
    });
    return false;
  }

  if (message.type === 'ds-open-chat') {
    const url = message.url || 'https://chat.deepseek.com';
    const isStreaming = Object.keys(dsSseProcessors).length > 0;
    chrome.tabs.query({ url: '*://chat.deepseek.com/*' }, (tabs) => {
      if (isStreaming || tabs.length === 0) {
        // 流式处理中或无标签页：新建标签页，避免中断正在运行的脚本
        chrome.tabs.create({ url });
      } else {
        // 空闲：复用已有标签页
        chrome.tabs.update(tabs[0].id, { url, active: true });
      }
    });
    return false;
  }

  // DeepSeek bridge → bilibili tab 转发
  if (message.type === 'DEEPSEEK_CHUNK') {
    const rid = message.requestId;
    if (!dsSseProcessors[rid]) dsSseProcessors[rid] = dsCreateSSEProcessor(rid);
    const processor = dsSseProcessors[rid];
    const text = processor.processChunk(message.chunk);
    dsSendToBilibiliTab({ type: 'ds-chunk', text, requestId: rid, chatId: processor.getChatId() });
    return false;
  }

  if (message.type === 'DEEPSEEK_DONE') {
    const rid = message.requestId;
    if (dsSseProcessors[rid]) {
      const tail = dsSseProcessors[rid].flush();
      if (tail) dsSendToBilibiliTab({ type: 'ds-chunk', text: tail, requestId: rid });
      delete dsSseProcessors[rid];
    }
    dsSendToBilibiliTab({ type: 'ds-done', requestId: rid });
    return false;
  }

  if (message.type === 'DEEPSEEK_ERROR') {
    delete dsSseProcessors[message.requestId];
    dsSendToBilibiliTab({ type: 'ds-error', error: message.error, requestId: message.requestId });
    return false;
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
 * 完全遵循 Bilibili-Obsidian-Clipper 的双源策略：
 * 1. 主源：player/wbi/v2?aid=xxx&cid=xxx (用 aid 作为主标识)
 * 2. 回退：player/v2?bvid=xxx&cid=xxx
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
 * 字幕语言优先级（数值越小越优先）
 * 中文 > 英文 > 其他
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

// ── DeepSeek 文档整理 ──

const DS_URL = 'https://chat.deepseek.com';

let dsInjectedTabs = new Set();
let chatIds = { ds: null, summary: null };
let dsSseProcessors = {};
let dsSenderTabId = null;
let dsRequestIdToTaskId = {};  // requestId -> taskId 映射

// 恢复 chatId
chrome.storage.local.get(['chatId_clear', 'chatId_summary'], (stored) => {
  if (stored.chatId_clear) chatIds.clear = stored.chatId_clear;
  if (stored.chatId_summary) chatIds.summary = stored.chatId_summary;
});

async function dsEnsureTab() {
  const tabs = await chrome.tabs.query({ url: '*://chat.deepseek.com/*' });
  if (tabs.length > 0 && tabs[0].id) return tabs[0];
  const tab = await chrome.tabs.create({ url: DS_URL, active: false });
  await dsWaitTabComplete(tab.id, 20000);
  return tab;
}

async function dsWaitTabComplete(tabId, timeout) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return;
  } catch { return; }
  await new Promise((resolve) => {
    const listener = (tid, changeInfo) => {
      if (tid === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, timeout);
  });
}

async function dsInjectScripts(tabId) {
  if (dsInjectedTabs.has(tabId)) return;
  await chrome.scripting.executeScript({ target: { tabId }, world: 'ISOLATED', files: ['libs/deepseek-bridge.js'] });
  await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['libs/wasm-solver.js'] });
  await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['libs/deepseek-api.js'] });
  dsInjectedTabs.add(tabId);
}

chrome.tabs.onRemoved.addListener((tabId) => { dsInjectedTabs.delete(tabId); });

async function dsCheckLogin() {
  try {
    // 自动获取或创建 DeepSeek 标签页
    const tab = await dsEnsureTab();
    if (!tab?.id) return { loggedIn: false };

    // 主要方式：通过 localStorage token 验证
    let result = await tryCheckLoginWithToken(tab.id);
    if (result && typeof result.loggedIn === 'boolean') {
      // 如果检测失败，激活标签页并刷新后重试
      if (!result.loggedIn) {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.tabs.reload(tab.id);
        await dsWaitTabComplete(tab.id, 10000);
        result = await tryCheckLoginWithToken(tab.id);
      }
      return result;
    }

    // 降级：cookie 检测
    const cookies = await chrome.cookies.getAll({ domain: '.deepseek.com' });
    const cookieMap = Object.fromEntries(cookies.map(c => [c.name, c.value]));
    const hasSession = ['ds_session_id', 'HWSID'].some(name => !!cookieMap[name]);
    if (hasSession) return { loggedIn: true, key: 'cookie' };

    return { loggedIn: false };
  } catch (e) {
    return { loggedIn: false, reason: String(e) };
  }
}

async function tryCheckLoginWithToken(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async () => {
        function tryGetToken(raw) {
          if (!raw || typeof raw !== 'string' || raw.length <= 10) return null;
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'string' && parsed.length > 10) return parsed;
            if (typeof parsed === 'object' && parsed !== null) {
              const t = parsed.token || parsed.value || parsed.access_token || parsed.jwt;
              return (t && typeof t === 'string' && t.length > 10) ? t : null;
            }
          } catch { return raw; }
          return null;
        }
        const keys = ['userToken', 'token', 'ds_token', 'auth_token', 'access_token', 'jwt'];
        let token = null;
        for (const key of keys) {
          token = tryGetToken(localStorage.getItem(key));
          if (token) break;
        }
        if (!token) return { loggedIn: false };
        try {
          const res = await fetch('https://chat.deepseek.com/api/v1/user/profile', {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            credentials: 'include',
          });
          return { loggedIn: res.ok };
        } catch { return null; }
      },
    });
    return results?.[0]?.result || null;
  } catch {
    return null;
  }
}

function dsSendToBilibiliTab(msg) {
  if (!dsSenderTabId) return;
  chrome.tabs.sendMessage(dsSenderTabId, msg).catch(() => {});
}

async function dsHandleSend(markdown, prompt, requestId, thinking, taskId = 'clear') {
  dsSseProcessors = {};
  dsSenderTabId = null;
  dsRequestIdToTaskId[requestId] = taskId;

  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTabs[0]?.id) dsSenderTabId = activeTabs[0].id;

  let tab;
  try {
    tab = await dsEnsureTab();
  } catch (e) {
    dsSendToBilibiliTab({ type: 'ds-error', error: `获取标签页失败: ${String(e)}`, requestId });
    return;
  }

  try {
    await dsInjectScripts(tab.id);
  } catch (e) {
    dsSendToBilibiliTab({ type: 'ds-error', error: `注入脚本失败: ${String(e)}`, requestId });
    return;
  }

  // 处理 {markdown} 占位符
  let fullPrompt = prompt;
  if (fullPrompt.includes('{markdown}')) {
    fullPrompt = fullPrompt.replace('{markdown}', markdown);
  } else {
    fullPrompt = fullPrompt + '\n\n' + markdown;
  }
  const chatId = chatIds[taskId] || null;

  chrome.tabs.sendMessage(tab.id, {
    type: 'ds-inject-request',
    payload: { prompt: fullPrompt, chatId, requestId, thinking, taskId }
  }).catch((e) => {
    if (String(e).includes('Receiving end does not exist')) {
      dsInjectedTabs.delete(tab.id);
      dsInjectScripts(tab.id).then(() => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'ds-inject-request',
          payload: { prompt: fullPrompt, chatId, requestId, thinking, taskId }
        });
      });
    } else {
      dsSendToBilibiliTab({ type: 'ds-error', error: `发送请求失败: ${String(e)}`, requestId });
    }
  });
}

function dsCreateSSEProcessor(requestId) {
  let inThink = false;
  let chatId = null;
  let messageId = null;
  let dataLineBuf = '';
  const taskId = dsRequestIdToTaskId[requestId] || 'clear';

  function processChunk(chunk) {
    let text = '';
    try {
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') { dataLineBuf = ''; continue; }
          try {
            const data = JSON.parse(jsonStr);
            dataLineBuf = '';
            if (data.type === 'deepseek:chat_session_id') {
              chatId = data.chat_session_id;
              // 更新对应任务的 chatId
              chatIds[taskId] = chatId;
              let storageKey;
              if (taskId === 'clear') storageKey = 'chatId_clear';
              else if (taskId === 'summary') storageKey = 'chatId_summary';
              else storageKey = 'chatId_' + taskId;
              chrome.storage.local.set({ [storageKey]: chatId });
              continue;
            }
            if (data.response_message_id != null) messageId = data.response_message_id;
            const result = processEvent(data);
            if (result) text += result;
          } catch {
            dataLineBuf = line;
          }
        } else {
          if (dataLineBuf) {
            dataLineBuf += '\n' + line;
            try {
              const jsonStr = dataLineBuf.slice(6).trim();
              const data = JSON.parse(jsonStr);
              dataLineBuf = '';
              if (data.type === 'deepseek:chat_session_id') {
                chatId = data.chat_session_id;
                // 更新对应任务的 chatId
                chatIds[taskId] = chatId;
                let storageKey;
                if (taskId === 'clear') storageKey = 'chatId_clear';
                else if (taskId === 'summary') storageKey = 'chatId_summary';
                else storageKey = 'chatId_' + taskId;
                chrome.storage.local.set({ [storageKey]: chatId });
                continue;
              }
              if (data.response_message_id != null) messageId = data.response_message_id;
              const result = processEvent(data);
              if (result) text += result;
            } catch {}
          }
        }
      }
    } catch {}
    return text;
  }

  function processEvent(data) {
    if (data.o === 'SET' || data.o === 'BATCH') return null;
    const path = Array.isArray(data.p) ? data.p.join('/') : data.p;
    const resp = data.v?.response;

    if (resp?.fragments && Array.isArray(resp.fragments)) {
      const parts = [];
      for (const frag of resp.fragments) {
        const content = frag.content || '';
        if (!content) continue;
        if (frag.type === 'THINK' || frag.type === 'THINKING' || frag.type === 'reasoning') {
          if (!inThink) { inThink = true; parts.push('<think>'); }
          parts.push(content);
        } else {
          if (inThink) { inThink = false; parts.push('</think>'); }
          parts.push(content);
        }
      }
      return parts.length > 0 ? parts.join('') : null;
    }

    if (data.o === 'APPEND' && Array.isArray(data.v)) {
      const parts = [];
      for (const item of data.v) {
        const content = item.content || '';
        if (item.type === 'THINK' || item.type === 'THINKING' || item.type === 'reasoning') {
          if (!inThink) { inThink = true; parts.push('<think>'); }
          if (content) parts.push(content);
        } else if (item.type === 'RESPONSE' || item.type === 'TEXT' || item.type === 'text') {
          if (inThink) { inThink = false; parts.push('</think>'); }
          if (content) parts.push(content);
        } else {
          if (content) parts.push(content);
        }
      }
      return parts.length > 0 ? parts.join('') : null;
    }

    if (data.o === 'APPEND' && typeof data.v === 'string') {
      return data.v || null;
    }

    if (path?.includes('reasoning') && typeof data.v === 'string') {
      if (!data.v) return null;
      if (!inThink) { inThink = true; return `<think>${data.v}`; }
      return data.v;
    }

    if (data.type === 'thinking') {
      const content = typeof data.v === 'string' ? data.v : data.content || '';
      if (!content) return null;
      if (!inThink) { inThink = true; return `<think>${content}`; }
      return content;
    }

    const delta = data.choices?.[0]?.delta;
    if (delta) {
      const parts = [];
      if (delta.reasoning_content) {
        if (!inThink) { inThink = true; parts.push('<think>'); }
        parts.push(delta.reasoning_content);
      }
      if (delta.content) {
        if (inThink) { inThink = false; parts.push('</think>'); }
        parts.push(delta.content);
      }
      return parts.length > 0 ? parts.join('') : null;
    }

    if (typeof data.v === 'string') {
      if (!data.v) return null;
      if (!path && inThink) return data.v;
      if (inThink) { inThink = false; return `</think>${data.v}`; }
      return data.v;
    }

    if (data.type === 'text' && typeof data.content === 'string') {
      const content = data.content.trim();
      if (!content) return null;
      if (inThink) { inThink = false; return `</think>${content}`; }
      return content;
    }

    return null;
  }

  function flush() {
    if (inThink) { inThink = false; return '</think>'; }
    return '';
  }

  return { processChunk, flush, getChatId: () => chatId, getMessageId: () => messageId };
}

