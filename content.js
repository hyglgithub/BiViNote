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

      // 延迟 2 秒初始化 UI，等待 B 站 Vue 应用渲染
      setTimeout(() => {
        // 创建嵌入面板
        BN.panel.create();

        // 自动显示面板
        BN.panel.show();

        // 根据设置显示悬浮功能条
        if (BN.state.settings.showFloatToolbar !== false) {
          BN.panel.showCollapse();
        }

        // 自动加载字幕
        const currentBvid = BN.subtitle?.extractBvid(location.href) || '';
        if (BN.subtitle && (!BN.state.bvid || BN.state.bvid !== currentBvid)) {
          BN.subtitle.refresh();
        }

        console.log('[BiViNote] UI initialized');
      }, 2000);

      console.log('[BiViNote] Initialized successfully');
    } catch (err) {
      console.error('[BiViNote] Initialization failed:', err);
    }
  }

  // ── SPA 路由监听 ──
  // 使用 History API 钩子替代 MutationObserver，避免高频回调

  let lastUrl = location.href;

  // 监听 pushState/replaceState
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;

  history.pushState = function (...args) {
    origPushState.apply(this, args);
    checkUrlChange();
  };

  history.replaceState = function (...args) {
    origReplaceState.apply(this, args);
    checkUrlChange();
  };

  // 监听 popstate（浏览器前进/后退）
  window.addEventListener('popstate', checkUrlChange);

  // 节流：500ms 内只触发一次
  let urlCheckTimer = null;
  function checkUrlChange() {
    if (urlCheckTimer) return;
    urlCheckTimer = setTimeout(() => {
      urlCheckTimer = null;
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        onRouteChange();
      }
    }, 500);
  }

  let lastBvid = '';
  let lastPage = 1;

  function onRouteChange() {
    const oldBvid = lastBvid;
    const oldPage = lastPage;
    // 重置状态
    BN.state.reset();
    // 如果面板可见，检测 BVID 或分P 变化则自动刷新
    if (BN.state.panelVisible && BN.subtitle) {
      const newBvid = BN.subtitle.extractBvid(location.href);
      const newPage = BN.subtitle.extractPageIndex(location.href);
      if (newBvid && (newBvid !== oldBvid || newPage !== oldPage)) {
        lastBvid = newBvid;
        lastPage = newPage;
        setTimeout(async () => {
          if (BN.state.panelVisible) {
            await BN.subtitle.refresh();
            BN.panel.resetDocAuto();
            BN.panel.renderDoc();
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
