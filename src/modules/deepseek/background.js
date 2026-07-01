/**
 * BiViNote DeepSeek Background Module
 * DeepSeek 文档整理后台逻辑：登录检测、标签页管理、SSE 处理
 * 依赖核心 background.js 的 registerHandler 函数
 */

// ── DeepSeek 常量 ──

const DS_URL = 'https://chat.deepseek.com';

const DS_DEFAULT_PROMPT = `你是一个视频笔记整理助手，将视频导出的 Markdown 文档整理为简洁、高质量、适合长期保存的 Markdown 学习笔记。

要求：

1. 删除口语化内容、重复内容、无意义过渡语句，例如：好的、然后、这里呢、兄弟、就是说等。
2. 删除所有字幕时间戳，例如 \`00:12\`、\`05:30\`。
3. 不要逐句输出字幕，将连续字幕整理为简洁、连贯、易阅读的知识内容。
4. 字幕可能由 AI 识别生成，存在错别字、同音字、术语错误、英文大小写错误，请结合上下文修正，并统一技术术语写法。
5. 若文档存在章节结构，严格按原始章节整理；若无章节，则按内容自然分段。
6. 不要新增原文不存在的标题、章节或目录层级，不要改变原始内容顺序。
7. 文档中形如 ![xxx](assets/数字.png) 的 Markdown 标记属于特殊文本块，() 内为相对资源路径且默认与前一句字幕内容关联；必须保留全部此类标记，禁止修改语法、alt 文本、路径或文件名，不得遗漏，可根据整理后的内容适当调整其在当前语义块中的位置。
8. 保留所有技术名词、工具名、框架名、产品名，不要删除、替换或省略。
9. 若存在 Frontmatter（文档开头 YAML），必须完整原样保留，禁止修改字段、字段值和字段顺序。
10. 仅整理原文，禁止总结、解释、扩展原文不存在的信息或补充额外知识。

待整理文档：

{markdown}

直接输出整理后的 Markdown 文档，不要输出任何额外内容。`;

// ── DeepSeek 状态变量 ──

let dsInjectedTabs = new Set();
let dsChatId = null;
let dsSseProcessors = {};
let dsSenderTabId = null;

// 恢复 chatId
chrome.storage.local.get('chatId', (stored) => {
  if (stored.chatId) dsChatId = stored.chatId;
});

// ── DeepSeek 工具函数 ──

/**
 * 确保 DeepSeek 标签页存在
 * @returns {Promise<Object>} 标签页对象
 */
async function dsEnsureTab() {
  const tabs = await chrome.tabs.query({ url: '*://chat.deepseek.com/*' });
  if (tabs.length > 0 && tabs[0].id) return tabs[0];
  const tab = await chrome.tabs.create({ url: DS_URL, active: false });
  await dsWaitTabComplete(tab.id, 20000);
  return tab;
}

/**
 * 等待标签页加载完成
 * @param {number} tabId - 标签页 ID
 * @param {number} timeout - 超时时间（毫秒）
 */
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

/**
 * 注入 DeepSeek 脚本到标签页
 * @param {number} tabId - 标签页 ID
 */
async function dsInjectScripts(tabId) {
  if (dsInjectedTabs.has(tabId)) return;
  await chrome.scripting.executeScript({ target: { tabId }, world: 'ISOLATED', files: ['modules/deepseek/bridge.js'] });
  await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['modules/deepseek/wasm-solver.js'] });
  await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['modules/deepseek/api.js'] });
  dsInjectedTabs.add(tabId);
}

// 标签页关闭时清理注入记录
chrome.tabs.onRemoved.addListener((tabId) => { dsInjectedTabs.delete(tabId); });

/**
 * 检测 DeepSeek 登录状态
 * @returns {Promise<Object>} 登录状态
 */
async function dsCheckLogin() {
  try {
    // 自动获取或创建 DeepSeek 标签页
    const tab = await dsEnsureTab();
    if (!tab?.id) return { loggedIn: false };

    // 主要方式：通过 localStorage token 验证
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
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
      const r = results?.[0]?.result;
      if (r && typeof r.loggedIn === 'boolean') return r;
    } catch {}

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

/**
 * 发送消息到 Bilibili 标签页
 * @param {Object} msg - 消息对象
 */
function dsSendToBilibiliTab(msg) {
  if (!dsSenderTabId) return;
  chrome.tabs.sendMessage(dsSenderTabId, msg).catch(() => {});
}

/**
 * 处理 DeepSeek 发送请求
 * @param {string} markdown - Markdown 内容
 * @param {string} prompt - 提示词
 * @param {string} requestId - 请求 ID
 */
async function dsHandleSend(markdown, prompt, requestId) {
  dsSseProcessors = {};
  dsSenderTabId = null;

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

  let fullPrompt = prompt;
  try {
    const stored = await chrome.storage.local.get('deepseekPrompt');
    const sysPrompt = stored.deepseekPrompt || DS_DEFAULT_PROMPT;
    if (sysPrompt.includes('{markdown}')) {
      fullPrompt = sysPrompt.replace('{markdown}', markdown);
    } else {
      fullPrompt = sysPrompt + '\n\n' + markdown;
    }
  } catch {
    fullPrompt = DS_DEFAULT_PROMPT.replace('{markdown}', markdown);
  }

  chrome.tabs.sendMessage(tab.id, {
    type: 'ds-inject-request',
    payload: { prompt: fullPrompt, chatId: dsChatId, requestId }
  }).catch((e) => {
    if (String(e).includes('Receiving end does not exist')) {
      dsInjectedTabs.delete(tab.id);
      dsInjectScripts(tab.id).then(() => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'ds-inject-request',
          payload: { prompt: fullPrompt, chatId: dsChatId, requestId }
        });
      });
    } else {
      dsSendToBilibiliTab({ type: 'ds-error', error: `发送请求失败: ${String(e)}`, requestId });
    }
  });
}

/**
 * 创建 SSE 处理器
 * @returns {Object} SSE 处理器对象
 */
function dsCreateSSEProcessor() {
  let inThink = false;
  let chatId = null;
  let messageId = null;
  let dataLineBuf = '';

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
            if (data.type === 'deepseek:chat_session_id') { chatId = data.chat_session_id; continue; }
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
              if (data.type === 'deepseek:chat_session_id') { chatId = data.chat_session_id; continue; }
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

// ── DeepSeek 消息处理器注册 ──

/**
 * 注册 DeepSeek 相关的消息处理器
 * 依赖核心 background.js 的 registerHandler 函数
 */
function registerDeepSeekHandlers() {
  registerHandler('ds-check-login', (message, sender, sendResponse) => {
    dsCheckLogin().then(result => sendResponse(result));
    return true;
  });

  registerHandler('ds-abort', (message, sender, sendResponse) => {
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
  });

  registerHandler('ds-send', (message, sender, sendResponse) => {
    const requestId = message.requestId || crypto.randomUUID();
    dsHandleSend(message.markdown, message.prompt, requestId);
    sendResponse({ ok: true, requestId });
    return true;
  });

  registerHandler('ds-open-login', (message, sender, sendResponse) => {
    chrome.tabs.query({ url: '*://chat.deepseek.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
      } else {
        chrome.tabs.create({ url: 'https://chat.deepseek.com' });
      }
    });
    return false;
  });

  registerHandler('ds-open-chat', (message, sender, sendResponse) => {
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
  });

  // DeepSeek bridge → bilibili tab 转发
  registerHandler('DEEPSEEK_CHUNK', (message, sender, sendResponse) => {
    const rid = message.requestId;
    if (!dsSseProcessors[rid]) dsSseProcessors[rid] = dsCreateSSEProcessor();
    const processor = dsSseProcessors[rid];
    const text = processor.processChunk(message.chunk);
    dsSendToBilibiliTab({ type: 'ds-chunk', text, requestId: rid, chatId: processor.getChatId() });
    return false;
  });

  registerHandler('DEEPSEEK_DONE', (message, sender, sendResponse) => {
    const rid = message.requestId;
    if (dsSseProcessors[rid]) {
      const tail = dsSseProcessors[rid].flush();
      if (tail) dsSendToBilibiliTab({ type: 'ds-chunk', text: tail, requestId: rid });
      delete dsSseProcessors[rid];
    }
    dsSendToBilibiliTab({ type: 'ds-done', requestId: rid });
    return false;
  });

  registerHandler('DEEPSEEK_ERROR', (message, sender, sendResponse) => {
    delete dsSseProcessors[message.requestId];
    dsSendToBilibiliTab({ type: 'ds-error', error: message.error, requestId: message.requestId });
    return false;
  });
}

// ── 模块初始化 ──

/**
 * 初始化 DeepSeek 模块
 * 注册所有消息处理器
 */
function initDeepSeekModule() {
  registerDeepSeekHandlers();
}

// 自动初始化
initDeepSeekModule();

// ── 导出（用于测试） ──

if (typeof globalThis !== 'undefined') {
  globalThis.BiViNoteDeepSeek = {
    // 常量
    DS_URL,
    DS_DEFAULT_PROMPT,

    // 状态
    dsInjectedTabs,
    dsChatId,
    dsSseProcessors,
    dsSenderTabId,

    // 工具函数
    dsEnsureTab,
    dsWaitTabComplete,
    dsInjectScripts,
    dsCheckLogin,
    dsSendToBilibiliTab,
    dsHandleSend,
    dsCreateSSEProcessor,

    // 初始化
    initDeepSeekModule,
    registerDeepSeekHandlers
  };
}
