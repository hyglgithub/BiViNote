// js/deepseek.js - DeepSeek 文档整理通信模块
(function () {
  'use strict';
  const BN = window.BiViNote;
  if (!BN) return;

  let state = 'not_logged_in';
  let thinkText = '';
  let responseText = '';
  let inThink = false;
  let chatId = null;
  let activeRequestId = null;

  const listeners = { chunk: [], state: [], done: [], error: [] };

  function emit(event, data) {
    for (const fn of listeners[event]) {
      try { fn(data); } catch (e) { console.error('[BN-DeepSeek]', e); }
    }
  }

  function setState(newState) {
    if (state === newState) return;
    state = newState;
    emit('state', state);
  }

  // 恢复 chatId
  try {
    chrome.storage.local.get('chatId', (stored) => {
      if (stored.chatId) chatId = stored.chatId;
    });
  } catch {}

  async function checkLogin() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'ds-check-login' }, (result) => {
        if (chrome.runtime.lastError) {
          resolve({ loggedIn: false, reason: chrome.runtime.lastError.message });
          return;
        }
        if (result?.loggedIn) {
          setState('ready');
          resolve(result);
        } else {
          setState('not_logged_in');
          resolve(result || { loggedIn: false });
        }
      });
    });
  }

  function sendMarkdown(markdown, prompt) {
    if (state === 'reading' || state === 'responding') return;

    thinkText = '';
    responseText = '';
    inThink = false;
    setState('reading');

    const requestId = crypto.randomUUID();
    activeRequestId = requestId;

    chrome.runtime.sendMessage({
      type: 'ds-send',
      markdown,
      prompt,
      chatId,
      requestId,
    });

    setTimeout(() => {
      if (state === 'reading' || state === 'responding') {
        emit('error', '请求超时（120s）');
        setState('error');
      }
    }, 120000);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'ds-chunk') {
      if (msg.requestId && msg.requestId !== activeRequestId) return;
      processChunk(msg.text, msg.chatId);
    } else if (msg.type === 'ds-done') {
      if (msg.requestId && msg.requestId !== activeRequestId) return;
      flush();
      setState('done');
      emit('done', getResult());
    } else if (msg.type === 'ds-error') {
      if (msg.requestId && msg.requestId !== activeRequestId) return;
      emit('error', msg.error);
      setState('error');
    }
  });

  function processChunk(text, newChatId) {
    if (!text) return;

    if (newChatId && newChatId !== chatId) {
      chatId = newChatId;
      try { chrome.storage.local.set({ chatId }); } catch {}
    }

    if (text.includes('<think>') && !inThink) {
      inThink = true;
      const parts = text.split('<think>');
      if (parts[0]) {
        if (state === 'reading') setState('responding');
        responseText += parts[0];
        emit('chunk', { type: 'response', text: parts[0] });
      }
      thinkText += parts[1] || '';
      emit('chunk', { type: 'think', text: parts[1] || '' });
      return;
    }

    if (text.includes('</think>') && inThink) {
      inThink = false;
      const parts = text.split('</think>');
      thinkText += parts[0] || '';
      emit('chunk', { type: 'think', text: parts[0] || '' });
      setState('responding');
      if (parts[1]) {
        responseText += parts[1];
        emit('chunk', { type: 'response', text: parts[1] });
      }
      return;
    }

    if (inThink) {
      thinkText += text;
      emit('chunk', { type: 'think', text });
    } else {
      if (state === 'reading') setState('responding');
      responseText += text;
      emit('chunk', { type: 'response', text });
    }
  }

  function flush() {
    if (inThink) inThink = false;
  }

  function getResult() {
    return { think: thinkText.trim(), response: responseText.trim() };
  }

  function clear() {
    thinkText = '';
    responseText = '';
    inThink = false;
    setState('ready');
  }

  function abort() {
    chrome.runtime.sendMessage({ type: 'ds-abort' });
    activeRequestId = null;
    clear();
  }

  function openLogin() {
    chrome.runtime.sendMessage({ type: 'ds-open-login' });
  }

  BN.deepseek = {
    checkLogin,
    sendMarkdown,
    getState: () => state,
    getChatId: () => chatId,
    onChunk: (fn) => listeners.chunk.push(fn),
    onStateChange: (fn) => listeners.state.push(fn),
    onDone: (fn) => listeners.done.push(fn),
    onError: (fn) => listeners.error.push(fn),
    getResult,
    clear,
    abort,
    openLogin,
  };
})();
