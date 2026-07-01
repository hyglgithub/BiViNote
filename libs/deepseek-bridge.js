// deepseek-bridge.js - 消息桥接（运行在 chat.deepseek.com 的 ISOLATED world）
// 职责：在 MAIN world 脚本（deepseek-api.js）和 background.js 之间转发消息

if (!window.__dsBridgeInjected) {
  window.__dsBridgeInjected = true;

  function safeSendMessage(msg) {
    try {
      if (!chrome.runtime || !chrome.runtime.id) return;
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch (e) {
      // 扩展上下文已失效，忽略
    }
  }

  // MAIN world → background
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'DEEPSEEK_CHUNK' || msg.type === 'DEEPSEEK_DONE' || msg.type === 'DEEPSEEK_ERROR') {
      safeSendMessage(msg);
    }
  });

  // background → MAIN world
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'ds-inject-request') {
        window.postMessage({ type: 'DEEPSEEK_SEND', ...msg.payload }, window.location.origin);
        sendResponse({ ok: true });
      }
      if (msg.type === 'ds-abort-stop') {
        window.postMessage({ type: 'DEEPSEEK_ABORT', chatId: msg.chatId, messageId: msg.messageId }, window.location.origin);
        sendResponse({ ok: true });
      }
      return true;
    });
  } catch (e) {
    // 扩展上下文已失效
  }
}
