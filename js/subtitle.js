/**
 * BiViNote Subtitle Module
 * 字幕获取、解析、渲染、高亮同步
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  let syncTimer = null;

  // ── API 通信 ──

  async function fetchFromBg(type, params) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, ...params }, resp => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!resp?.ok) {
          reject(new Error(resp?.error || '请求失败'));
          return;
        }
        resolve(resp.data);
      });
    });
  }

  // ── 获取视频元信息 ──

  async function fetchVideoMeta(bvid) {
    return fetchFromBg('fetch-video-meta', { bvid });
  }

  // ── 获取字幕列表 ──

  async function fetchSubtitleList(bvid, cid, aid) {
    return fetchFromBg('fetch-subtitle-list', { bvid, cid, aid });
  }

  // ── 获取字幕正文 ──

  async function fetchSubtitleBody(url) {
    return fetchFromBg('fetch-subtitle-body', { url });
  }

  // ── 提取 BVID ──

  function extractBvid(url) {
    const match = url.match(/\/video\/(BV[\w]+)/);
    return match ? match[1] : '';
  }

  // ── 获取视频元素 ──

  function getVideoElement() {
    const selectors = [
      '.bpx-player-video-wrap video',
      '#bilibili-player video',
      'video'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // ── 提取分P索引 ──

  function extractPageIndex(url) {
    try {
      const page = Number(new URL(url).searchParams.get('p') || '1');
      return Number.isFinite(page) && page > 0 ? page : 1;
    } catch {
      return 1;
    }
  }

  // ── 从 pages 数组中按索引选页 ──

  function pickPageFromPages(pages, pageIndex) {
    const safePages = Array.isArray(pages) ? pages : [];
    // 按数组下标
    const byIndex = safePages[pageIndex - 1];
    if (byIndex?.cid) return byIndex;
    // 按 page 字段
    const byNo = safePages.find(item => Number(item.page) === pageIndex);
    if (byNo?.cid) return byNo;
    return null;
  }

  // ── 刷新（主流程） ──

  async function refresh() {
    const s = window.BiViNote.state;
    const panel = window.BiViNote.panel;

    const newBvid = extractBvid(location.href);
    if (!newBvid) {
      panel.showToast('当前页面不是 B 站视频页');
      return;
    }

    // BVID 变化时重置旧状态，防止残留数据
    if (newBvid !== s.bvid) {
      s.reset();
    }
    s.bvid = newBvid;

    // 每次刷新递增 runId，取消过期请求
    const runId = ++s.fetchRunId;

    panel.showToast('正在获取字幕...');

    try {
      // 获取视频元信息
      const meta = await fetchVideoMeta(s.bvid);
      if (runId !== s.fetchRunId) return; // 请求已过期

      s.aid = meta.aid || '';
      s.title = meta.title || '';
      s.author = meta.author || '';
      s.uploadDate = meta.uploadDate || '';
      s.description = meta.description || '';
      s.videoDuration = meta.defaultDuration || 0;

      // 用 URL 中的 ?p= 参数选择正确的分P，获取对应 CID
      const pageIndex = extractPageIndex(location.href);
      const currentPage = pickPageFromPages(meta.pages, pageIndex);
      s.cid = currentPage?.cid || meta.defaultCid || meta.pages?.[0]?.cid || '';

      if (!s.cid) {
        panel.showToast('无法获取视频 CID');
        return;
      }

      // 获取字幕列表和章节
      const bundle = await fetchSubtitleList(s.bvid, s.cid, s.aid);
      if (runId !== s.fetchRunId) return; // 请求已过期

      s.subtitles = bundle.subtitles || [];
      s.chapters = bundle.chapters || [];

      // 渲染视频信息
      if (window.BiViNote.videoInfo) {
        window.BiViNote.videoInfo.render();
      }

      // 渲染章节
      if (window.BiViNote.chapter) {
        window.BiViNote.chapter.render();
      }

      // 更新字幕语言下拉
      panel.updateSubtitleSelect(s.subtitles, s.selectedSubtitleUrl);

      if (s.subtitles.length === 0) {
        s.subtitleBody = [];
        renderSubtitleList();
        panel.showToast('当前视频无字幕');
        return;
      }

      // 优先选择上次使用的字幕语言，否则选第一个
      let preferred = s.subtitles[0];
      if (s.selectedSubtitleLang) {
        const found = s.subtitles.find(t => t.lan === s.selectedSubtitleLang);
        if (found) preferred = found;
      }
      await loadSubtitle(preferred.subtitleUrl, preferred.lan);

      if (runId !== s.fetchRunId) return; // 请求已过期
      panel.showToast('字幕获取成功');
    } catch (err) {
      if (runId !== s.fetchRunId) return; // 请求已过期
      console.error('[BiViNote] refresh error:', err);
      panel.showToast('获取失败：' + err.message);
    }
  }

  // ── 加载字幕正文 ──

  async function loadSubtitle(url, lang) {
    const s = window.BiViNote.state;
    const panel = window.BiViNote.panel;
    const runId = s.fetchRunId;

    try {
      const body = await fetchSubtitleBody(url);
      if (runId !== s.fetchRunId) return; // 请求已过期
      s.subtitleBody = body;
      s.selectedSubtitleUrl = url;
      s.selectedSubtitleLang = lang || '';
      renderSubtitleList();
      startSync();
    } catch (err) {
      if (runId !== s.fetchRunId) return;
      console.error('[BiViNote] loadSubtitle error:', err);
      panel.showToast('字幕加载失败：' + err.message);
    }
  }

  // ── 切换字幕语言 ──

  async function switchSubtitle(url, lang) {
    stopSync();
    await loadSubtitle(url, lang);
  }

  // ── 渲染字幕列表 ──

  function renderSubtitleList() {
    const s = window.BiViNote.state;
    const container = document.getElementById('bn-subtitle-list');
    if (!container) return;

    container.innerHTML = '';

    if (!s.subtitleBody || s.subtitleBody.length === 0) {
      container.innerHTML = '<div class="bn-empty">暂无字幕</div>';
      return;
    }

    s.subtitleBody.forEach((item, index) => {
      const text = String(item.content || '').trim();
      if (!text) return;

      const screenshot = s.screenshots.get(index);
      const el = document.createElement('div');

      if (screenshot) {
        el.className = 'bn-row-img';
        el.dataset.index = index;
        el.innerHTML = `
          <img class="bn-snap-thumb" src="${screenshot.url}" alt="截屏" data-index="${index}">
          <div class="text-wrap">
            <div class="bn-time-text">${formatTime(item.from)}</div>
            <div class="bn-sub-text">${escapeHtml(text)}</div>
          </div>
          <div class="bn-btns">
            <button data-action="copy">复制</button>
            <button data-action="cancel-snap">取消截屏</button>
          </div>
        `;
      } else {
        el.className = 'bn-row';
        el.dataset.index = index;
        el.innerHTML = `
          <span class="bn-row-time">${formatTime(item.from)}</span>
          <span class="bn-row-text">${escapeHtml(text)}</span>
          <div class="bn-btns">
            <button data-action="copy">复制</button>
            <button data-action="add-snap">截屏</button>
          </div>
        `;
      }

      // 点击行跳转
      el.addEventListener('click', (e) => {
        if (e.target.closest('.bn-btns') || e.target.closest('.bn-snap-thumb')) return;
        jumpToTime(item.from);
      });

      container.appendChild(el);
    });

    // 事件委托
    container.addEventListener('click', onSubtitleClick);
  }

  // ── 字幕列表点击事件 ──

  function onSubtitleClick(e) {
    const btn = e.target.closest('button');
    const thumb = e.target.closest('.bn-snap-thumb');
    const s = window.BiViNote.state;

    if (thumb) {
      const index = parseInt(thumb.dataset.index);
      showPreview(index);
      return;
    }

    if (!btn) return;

    const row = btn.closest('.bn-row') || btn.closest('.bn-row-img');
    if (!row) return;
    const index = parseInt(row.dataset.index);
    const action = btn.dataset.action;

    if (action === 'copy') {
      copySingleText(index);
    } else if (action === 'add-snap') {
      if (window.BiViNote.capture) {
        window.BiViNote.capture.addScreenshot(index);
      }
    } else if (action === 'cancel-snap') {
      if (window.BiViNote.capture) {
        window.BiViNote.capture.removeScreenshot(index);
      }
    }
  }

  // ── 跳转到时间点 ──

  function jumpToTime(seconds) {
    const video = getVideoElement();
    if (!video) return;
    const wasPaused = video.paused;
    video.currentTime = seconds;
    if (wasPaused) {
      video.pause();
    }
  }

  // ── 字幕高亮同步 ──

  function startSync() {
    stopSync();
    const video = getVideoElement();
    if (!video) return;

    const onTimeUpdate = () => {
      const s = window.BiViNote.state;
      if (s.activeTab !== 'subtitle') return;

      const currentTime = video.currentTime;
      const activeIndex = findActiveIndex(currentTime);
      updateHighlight(activeIndex);

      if (s.settings.autoScroll && activeIndex >= 0) {
        scrollToItem(activeIndex);
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    syncTimer = { video, handler: onTimeUpdate };
  }

  function stopSync() {
    if (syncTimer) {
      syncTimer.video.removeEventListener('timeupdate', syncTimer.handler);
      syncTimer = null;
    }
  }

  function findActiveIndex(currentTime) {
    const body = window.BiViNote.state.subtitleBody;
    for (let i = 0; i < body.length; i++) {
      const item = body[i];
      const to = item.to || item.from + 2;
      if (currentTime >= item.from && currentTime < to) {
        return i;
      }
    }
    return -1;
  }

  function updateHighlight(activeIndex) {
    const container = document.getElementById('bn-subtitle-list');
    if (!container) return;
    const rows = container.querySelectorAll('.bn-row, .bn-row-img');
    rows.forEach((row, i) => {
      row.classList.toggle('bn-active', i === activeIndex);
    });
  }

  function scrollToItem(index) {
    const container = document.getElementById('bn-subtitle-list');
    if (!container) return;
    const rows = container.querySelectorAll('.bn-row, .bn-row-img');
    const target = rows[index];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ── 复制单条字幕 ──

  function copySingleText(index) {
    const s = window.BiViNote.state;
    const item = s.subtitleBody[index];
    if (!item) return;
    navigator.clipboard.writeText(item.content).then(() => {
      window.BiViNote.panel.showToast('已复制');
    });
  }

  // ── 复制全部字幕文本 ──

  function copyText() {
    const s = window.BiViNote.state;
    if (!s.subtitleBody || s.subtitleBody.length === 0) {
      window.BiViNote.panel.showToast('没有可复制的字幕');
      return;
    }
    const text = s.subtitleBody
      .map(item => item.content)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      window.BiViNote.panel.showToast('已复制全部字幕');
    });
  }

  // ── 预览弹窗 ──

  function showPreview(index) {
    const s = window.BiViNote.state;
    const screenshot = s.screenshots.get(index);
    if (!screenshot) return;

    const video = getVideoElement();

    const overlay = document.createElement('div');
    overlay.className = 'bn-preview-overlay';

    let currentUrl = screenshot.url;
    let currentBlob = screenshot.blob;

    overlay.innerHTML = `
      <div class="bn-preview-box">
        <img class="bn-preview-img" src="${currentUrl}" alt="预览">
        <div class="bn-preview-btns">
          <button data-act="prev">上一帧</button>
          <button data-act="next">下一帧</button>
          <button data-act="download">下载截图</button>
          <button data-act="clipboard">复制到剪贴板</button>
          <button data-act="close">关闭</button>
        </div>
      </div>
    `;

    const imgEl = overlay.querySelector('.bn-preview-img');

    async function doFrameAction(act) {
      if (!video) return;
      const step = s.settings.frameStep || 0.2;
      if (act === 'prev') {
        video.currentTime = Math.max(0, video.currentTime - step);
      } else {
        video.currentTime = Math.min(video.duration, video.currentTime + step);
      }
      await new Promise(r => video.addEventListener('seeked', r, { once: true }));
      const newBlob = await window.BiViNote.capture.captureFrame(video);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = URL.createObjectURL(newBlob);
      currentBlob = newBlob;
      imgEl.src = currentUrl;
      s.screenshots.set(index, { blob: currentBlob, url: currentUrl });
    }

    overlay.addEventListener('click', async (e) => {
      const act = e.target.dataset?.act;
      if (act === 'close' || e.target === overlay) {
        overlay.remove();
        return;
      }
      if (act === 'prev' || act === 'next') {
        doFrameAction(act);
      } else if (act === 'download') {
        window.BiViNote.capture.saveToFile(currentBlob, `subtitle-${index + 1}.png`);
        window.BiViNote.panel.showToast('截图已保存');
      } else if (act === 'clipboard') {
        const ok = await window.BiViNote.capture.copyToClipboard(currentBlob);
        window.BiViNote.panel.showToast(ok ? '已复制到剪贴板' : '复制失败');
      }
    });

    document.body.appendChild(overlay);
  }

  // ── 工具函数 ──

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  // ── 公开接口 ──

  window.BiViNote.subtitle = {
    refresh,
    switchSubtitle,
    copyText,
    renderSubtitleList,
    getVideoElement,
    jumpToTime,
    startSync,
    stopSync,
    formatTime,
    fetchVideoMeta,
    extractBvid
  };
})();
