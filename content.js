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

  function onRouteChange() {
    // 重置状态
    BN.state.reset();
    // 如果面板可见，提示用户点击刷新
    if (BN.state.panelVisible) {
      BN.panel.showToast('视频已切换，请点击刷新');
    }
  }

  // ── 启动 ──

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
