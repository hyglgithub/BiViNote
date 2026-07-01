/**
 * BiViNote Chapter Module
 * 章节获取、解析、渲染
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  let chapterListenerAttached = false;

  function render() {
    const s = window.BiViNote.state;
    const container = document.getElementById('bn-chapter-list');
    if (!container) return;

    container.innerHTML = '';

    // 只绑定一次事件委托
    if (!chapterListenerAttached) {
      container.addEventListener('click', onChapterClick);
      chapterListenerAttached = true;
    }

    if (!s.chapters || s.chapters.length === 0) {
      container.innerHTML = '<div class="bn-empty">当前视频无章节</div>';
      return;
    }

    s.chapters.forEach((item, index) => {
      // 章节截图用负索引存储
      const snapKey = -index - 1;
      const screenshot = s.screenshots.get(snapKey);
      const el = document.createElement('div');
      el.dataset.index = index;

      if (screenshot) {
        el.className = 'bn-row-img';
        el.innerHTML = `
          <img class="bn-snap-thumb" src="${screenshot.url}" alt="截屏" data-index="${index}">
          <div class="bn-text-wrap">
            <div class="bn-time-text">${formatTime(item.from)}</div>
            <div class="bn-sub-text">${escapeHtml(item.title)}</div>
          </div>
          <div class="bn-btns">
            <button data-action="copy">复制</button>
            <button data-action="cancel-snap">取消截屏</button>
          </div>
        `;
      } else {
        el.className = 'bn-row';
        el.innerHTML = `
          <span class="bn-row-time">${formatTime(item.from)}</span>
          <span class="bn-row-text">${escapeHtml(item.title)}</span>
          <div class="bn-btns">
            <button data-action="copy">复制</button>
            <button data-action="add-snap">截屏</button>
          </div>
        `;
      }

      // 点击跳转
      el.addEventListener('click', (e) => {
        if (e.target.closest('.bn-btns') || e.target.closest('.bn-snap-thumb')) return;
        jumpToChapter(item.from);
      });

      container.appendChild(el);
    });
  }

  function onChapterClick(e) {
    const btn = e.target.closest('button');
    const thumb = e.target.closest('.bn-snap-thumb');
    const s = window.BiViNote.state;

    // 点击缩略图 → 预览
    if (thumb) {
      const index = parseInt(thumb.dataset.index);
      window.BiViNote.cropViewer.open(-index - 1);
      return;
    }

    if (!btn) return;

    const row = btn.closest('.bn-row') || btn.closest('.bn-row-img');
    if (!row) return;
    const index = parseInt(row.dataset.index);
    const item = s.chapters[index];
    if (!item) return;

    if (btn.dataset.action === 'copy') {
      const text = item.title;
      navigator.clipboard.writeText(text).then(() => {
        window.BiViNote.panel.showToast('已复制');
      });
    } else if (btn.dataset.action === 'add-snap') {
      if (window.BiViNote.capture) {
        window.BiViNote.capture.addChapterScreenshot(index);
      }
    } else if (btn.dataset.action === 'cancel-snap') {
      if (window.BiViNote.capture) {
        const snapKey = -index - 1;
        const old = s.screenshots.get(snapKey);
        if (old?.url) URL.revokeObjectURL(old.url);
        s.screenshots.delete(snapKey);
        render();
        window.BiViNote.panel.showToast('已取消截屏');
      }
    }
  }

  function showChapterPreview(index) {
    const s = window.BiViNote.state;
    const snapKey = -index - 1;
    const screenshot = s.screenshots.get(snapKey);
    if (!screenshot) return;

    const video = window.BiViNote.subtitle?.getVideoElement();

    const overlay = document.createElement('div');
    overlay.className = 'bn-preview-overlay';
    overlay.setAttribute('data-bn-theme', window.BiViNote.state.settings.darkMode ? 'dark' : '');

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
    let frameActionBusy = false;

    async function doFrameAction(act) {
      if (!video || frameActionBusy) return;
      frameActionBusy = true;
      try {
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
        s.screenshots.set(snapKey, { blob: currentBlob, url: currentUrl });
      } finally {
        frameActionBusy = false;
      }
    }

    overlay.addEventListener('click', async (e) => {
      const act = e.target.dataset?.act;
      if (act === 'close' || e.target === overlay) {
        overlay.remove();
        return;
      }
      if (act === 'prev' || act === 'next') {
        await doFrameAction(act);
      } else if (act === 'download') {
        const video = window.BiViNote.subtitle?.getVideoElement();
        const ts = video ? video.currentTime : 0;
        window.BiViNote.capture.saveToFile(currentBlob, window.BiViNote.capture.generateDownloadFilename(ts));
        window.BiViNote.panel.showToast('截图已保存');
      } else if (act === 'clipboard') {
        const ok = await window.BiViNote.capture.copyToClipboard(currentBlob);
        window.BiViNote.panel.showToast(ok ? '已复制到剪贴板' : '复制失败');
      }
    });

    document.body.appendChild(overlay);
  }

  function jumpToChapter(seconds) {
    const video = window.BiViNote.subtitle?.getVideoElement();
    if (!video) return;
    const wasPaused = video.paused;
    video.currentTime = seconds;
    if (wasPaused) {
      video.pause();
    }
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  window.BiViNote.chapter = {
    render,
    jumpToChapter,
    formatTime
  };
})();
