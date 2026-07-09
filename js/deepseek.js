// js/deepseek.js - DeepSeek 文档整理通信模块（任务工厂模式）
(function () {
  'use strict';
  const BN = window.BiViNote;
  if (!BN) return;

  // 任务存储
  const tasks = {};

  // 全局登录状态（所有任务共享）
  let globalLoginState = 'not_logged_in'; // 'not_logged_in' | 'ready' | 'checking'

  // 创建新任务
  function createTask(taskId) {
    const task = {
      id: taskId,
      state: globalLoginState, // 使用全局登录状态
      thinkText: '',
      responseText: '',
      inThink: false,
      chatId: null,
      activeRequestId: null,
      listeners: { chunk: [], state: [], done: [], error: [] },
    };

    // 恢复 chatId（统一用 chatId_${taskId} 格式，ds 保留兼容旧 key）
    let storageKey;
    if (taskId === 'clear') storageKey = 'chatId_clear';
    else if (taskId === 'summary') storageKey = 'chatId_summary';
    else storageKey = 'chatId_' + taskId;
    try {
      chrome.storage.local.get(storageKey, (stored) => {
        if (stored[storageKey]) task.chatId = stored[storageKey];
      });
    } catch {}

    tasks[taskId] = task;
    return task;
  }

  // 获取任务
  function getTask(taskId) {
    if (!tasks[taskId]) {
      createTask(taskId);
      // 新任务同步当前全局登录状态
      if (globalLoginState === 'ready') {
        setState(tasks[taskId], 'ready');
      }
    }
    return tasks[taskId];
  }

  // 发送事件
  function emit(task, event, data) {
    for (const fn of task.listeners[event]) {
      try { fn(data); } catch (e) { console.error('[BN-DeepSeek]', e); }
    }
  }

  // 设置状态
  function setState(task, newState) {
    if (task.state === newState) return;
    task.state = newState;
    emit(task, 'state', task.state);
  }

  // 检查登录状态（全局）
  async function checkLogin(taskId) {
    const task = getTask(taskId);
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'ds-check-login' }, (result) => {
        if (chrome.runtime.lastError) {
          globalLoginState = 'not_logged_in';
          // 同步到所有任务
          Object.values(tasks).forEach(t => setState(t, 'not_logged_in'));
          resolve({ loggedIn: false, reason: chrome.runtime.lastError.message });
          return;
        }
        if (result?.loggedIn) {
          globalLoginState = 'ready';
          // 同步到所有任务
          Object.values(tasks).forEach(t => setState(t, 'ready'));
          resolve(result);
        } else {
          globalLoginState = 'not_logged_in';
          // 同步到所有任务
          Object.values(tasks).forEach(t => setState(t, 'not_logged_in'));
          resolve(result || { loggedIn: false });
        }
      });
    });
  }

  // 发送 markdown
  function sendMarkdown(taskId, markdown, prompt, thinking = true) {
    const task = getTask(taskId);
    if (task.state === 'reading' || task.state === 'responding') return;

    task.thinkText = '';
    task.responseText = '';
    task.inThink = false;
    setState(task, 'reading');

    const requestId = crypto.randomUUID();
    task.activeRequestId = requestId;

    chrome.runtime.sendMessage({
      type: 'ds-send',
      markdown,
      prompt,
      chatId: task.chatId,
      requestId,
      thinking,
      taskId,
    });

    setTimeout(() => {
      if (task.state === 'reading' || task.state === 'responding') {
        emit(task, 'error', '请求超时（120s）');
        setState(task, 'error');
      }
    }, 120000);
  }

  // 处理 chunk
  function processChunk(task, text, newChatId) {
    if (!text) return;

    if (newChatId && newChatId !== task.chatId) {
      task.chatId = newChatId;
      let storageKey;
      if (task.id === 'clear') storageKey = 'chatId_clear';
      else if (task.id === 'summary') storageKey = 'chatId_summary';
      else storageKey = 'chatId_' + task.id;
      try { chrome.storage.local.set({ [storageKey]: newChatId }); } catch {}
    }

    if (text.includes('<think>') && !task.inThink) {
      task.inThink = true;
      const parts = text.split('<think>');
      if (parts[0]) {
        if (task.state === 'reading') setState(task, 'responding');
        task.responseText += parts[0];
        emit(task, 'chunk', { type: 'response', text: parts[0] });
      }
      task.thinkText += parts[1] || '';
      emit(task, 'chunk', { type: 'think', text: parts[1] || '' });
      return;
    }

    if (text.includes('</think>') && task.inThink) {
      task.inThink = false;
      const parts = text.split('</think>');
      task.thinkText += parts[0] || '';
      emit(task, 'chunk', { type: 'think', text: parts[0] || '' });
      setState(task, 'responding');
      if (parts[1]) {
        task.responseText += parts[1];
        emit(task, 'chunk', { type: 'response', text: parts[1] });
      }
      return;
    }

    if (task.inThink) {
      task.thinkText += text;
      emit(task, 'chunk', { type: 'think', text });
    } else {
      if (task.state === 'reading') setState(task, 'responding');
      task.responseText += text;
      emit(task, 'chunk', { type: 'response', text });
    }
  }

  // 刷新
  function flush(task) {
    if (task.inThink) task.inThink = false;
  }

  // 获取结果
  function getResult(taskId) {
    const task = getTask(taskId);
    return { think: task.thinkText.trim(), response: task.responseText.trim() };
  }

  // 清除
  function clear(taskId) {
    const task = getTask(taskId);
    task.thinkText = '';
    task.responseText = '';
    task.inThink = false;
    setState(task, 'ready');
  }

  // 中断
  function abort(taskId) {
    const task = getTask(taskId);
    chrome.runtime.sendMessage({ type: 'ds-abort' });
    task.activeRequestId = null;
    clear(taskId);
  }

  // 打开登录页面
  function openLogin() {
    chrome.runtime.sendMessage({ type: 'ds-open-login' });
  }

  // 监听消息
  chrome.runtime.onMessage.addListener((msg) => {
    // 找到对应的任务
    let task = null;
    for (const id in tasks) {
      if (tasks[id].activeRequestId === msg.requestId) {
        task = tasks[id];
        break;
      }
    }

    // 如果找不到任务，可能是全局登录检查消息
    if (!task) {
      // 尝试匹配所有任务
      for (const id in tasks) {
        if (msg.type === 'ds-chunk' || msg.type === 'ds-done' || msg.type === 'ds-error') {
          task = tasks[id];
          break;
        }
      }
    }

    if (!task) return;

    if (msg.type === 'ds-chunk') {
      if (msg.requestId && msg.requestId !== task.activeRequestId) return;
      processChunk(task, msg.text, msg.chatId);
    } else if (msg.type === 'ds-done') {
      if (msg.requestId && msg.requestId !== task.activeRequestId) return;
      flush(task);
      setState(task, 'done');
      emit(task, 'done', getResult(task.id));
    } else if (msg.type === 'ds-error') {
      if (msg.requestId && msg.requestId !== task.activeRequestId) return;
      emit(task, 'error', msg.error);
      setState(task, 'error');
    }
  });

  // 初始化默认任务
  createTask('clear');
  createTask('summary');

  BN.deepseek = {
    checkLogin,
    sendMarkdown,
    getTask,
    getResult,
    clear,
    abort,
    openLogin,
    getChatId: (taskId) => getTask(taskId).chatId,
    getState: (taskId) => getTask(taskId).state,
    onChunk: (taskId, fn) => getTask(taskId).listeners.chunk.push(fn),
    onStateChange: (taskId, fn) => getTask(taskId).listeners.state.push(fn),
    onDone: (taskId, fn) => getTask(taskId).listeners.done.push(fn),
    onError: (taskId, fn) => getTask(taskId).listeners.error.push(fn),
  };
})();
