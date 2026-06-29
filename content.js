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
          const s = BN.state;
          // 如果有东西显示着，先隐藏
          if (s.panelVisible) {
            BN.panel.hide();
            return;
          }
          if (s.collapsed) {
            BN.panel.hideCollapse();
            return;
          }
          // 都没显示，按上次使用的模式打开
          const lastMode = s.settings.lastOpenMode || 'panel';
          if (lastMode === 'menu') {
            BN.panel.toggleCollapse();
          } else {
            BN.panel.show();
          }
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
    const oldBvid = BN.state.bvid;
    // 重置状态
    BN.state.reset();
    // 如果面板可见且 BVID 变化，自动刷新
    if (BN.state.panelVisible && BN.subtitle) {
      const newBvid = BN.subtitle.extractBvid(location.href);
      if (newBvid && newBvid !== oldBvid) {
        // 等待页面加载后再刷新
        setTimeout(async () => {
          if (BN.state.panelVisible) {
            await BN.subtitle.refresh();
            BN.panel.renderPrompt();
          }
        }, 1000);
      }
    }
  }

  // ── 启动 ──

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
