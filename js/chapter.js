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
      showChapterPreview(index);
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
    const snapKey = -index - 1;
    if (window.BiViNote.cropViewer) {
      window.BiViNote.cropViewer.open(snapKey);
    }
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
