/**
 * BiViNote Content Script
 * 入口脚本 - 初始化所有模块，监听 SPA 路由变化
 */
(async function () {
  'use strict';

  const BN = window.BiViNote;

  // ── 初始化 ──

  async function init() {
    try {
      // 加载设置
      await BN.settings.load();

      // 监听 background 消息（toggle-panel）
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'toggle-panel') {
          BN.panel.toggle();
        }
      });

      console.log('[BiViNote] Initialized successfully');
    } catch (err) {
      console.error('[BiViNote] Initialization failed:', err);
    }
  }

  // ── SPA 路由监听 ──

  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onRouteChange();
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  async function onRouteChange() {
    // 重置状态
    BN.state.reset();
    // 如果面板可见，自动刷新字幕
    if (BN.state.panelVisible) {
      // 等待页面加载完成后再刷新
      await new Promise(r => setTimeout(r, 1500));
      if (BN.subtitle) BN.subtitle.refresh();
    }
  }

  // ── 启动 ──

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
