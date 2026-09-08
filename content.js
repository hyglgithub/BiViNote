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
        const currentPage = BN.subtitle?.extractPageIndex(location.href) || 1;
        if (BN.subtitle && currentBvid) {
          lastBvid = currentBvid;
          lastPage = currentPage;
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
  // 恢复 MutationObserver 方式（B站 SPA 导航依赖此机制）
  // 优化：节流回调，避免高频触发

  let lastUrl = location.href;
  let lastBvid = '';
  let lastPage = 1;
  let urlCheckTimer = null;
  let navRefreshTimer = null; // 导航后的防抖刷新定时器

  const urlObserver = new MutationObserver(() => {
    if (urlCheckTimer) return;
    urlCheckTimer = setTimeout(() => {
      urlCheckTimer = null;
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        onRouteChange();
      }
    }, 300);
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  // B站 SPA 导航途中同一条视频 URL 可能被改写多次（追加/清理 ?spm_id_from=、p 参数等
  // pushState/replaceState）。这类"同视频"改写不能 reset 状态——否则会把正在进行的
  // subtitle.refresh() 用 fetchRunId 静默取消，又因 bvid 没变不会调度新刷新，面板就
  // 一直停在"正在获取字幕..."。只有 BVID 或分P 真正变化时才取消旧请求并防抖重刷一次。
  function onRouteChange() {
    const newBvid = BN.subtitle?.extractBvid(location.href) || '';
    const newPage = BN.subtitle?.extractPageIndex(location.href) || 1;

    // 非视频页 / 目标没变（同视频 URL 改写）：不动状态，让进行中的刷新正常完成
    if (!newBvid || (newBvid === lastBvid && newPage === lastPage)) return;

    lastBvid = newBvid;
    lastPage = newPage;
    // BVID/分P 真正变化：立即重置（作废旧视频的进行中请求），再防抖刷新最终 URL
    BN.state.reset();
    scheduleNavRefresh();
  }

  function scheduleNavRefresh() {
    if (navRefreshTimer) clearTimeout(navRefreshTimer);
    navRefreshTimer = setTimeout(async () => {
      navRefreshTimer = null;
      if (!BN.state.panelVisible || !BN.subtitle) return;
      // 防抖期间又发生新导航时，上一定时器已被清掉并重新调度，这里按当前 URL 刷新即可
      if (!BN.subtitle.extractBvid(location.href)) return;
      await BN.subtitle.refresh();
      BN.panel.resetDocAuto();
      BN.panel.renderDoc();
    }, 800);
  }

  // ── 启动 ──

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
