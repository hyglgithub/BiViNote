/**
 * BiViNote Crop Viewer Module
 * 使用 cropperjs 实现裁剪功能
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  let overlayEl = null;
  let cropper = null;
  let cropperImage = null;
  let cropperSelection = null;
  let currentSnapKey = -1;
  let currentBlob = null;
  let currentUrl = null;
  let sidebarEl = null;
  let sidebarVisible = false;
  let cropMode = false;

  // ── 截图数据 ──

  function getScreenshotList() {
    const s = window.BiViNote.state;
    const list = [];
    for (const [key, snap] of s.screenshots) {
      list.push({ key, ...snap });
    }
    list.sort((a, b) => (a.timeSeconds || 0) - (b.timeSeconds || 0));
    return list;
  }

  function getCurrentIndex() {
    return getScreenshotList().findIndex(item => item.key === currentSnapKey);
  }

  function getSnapText(snapKey) {
    const s = window.BiViNote.state;
    if (snapKey >= 0) return s.subtitleBody[snapKey]?.content || '';
    return s.chapters[-snapKey - 1]?.title || '';
  }

  function getSnapTimeDisplay(snapKey) {
    const s = window.BiViNote.state;
    const item = snapKey >= 0 ? s.subtitleBody[snapKey] : s.chapters[-snapKey - 1];
    return item ? window.BiViNote.capture.formatTimeDisplay(item.from) : '00:00';
  }

  // ── 打开 ──

  function open(snapKey) {
    currentSnapKey = snapKey;
    const snap = window.BiViNote.state.screenshots.get(snapKey);
    if (!snap) return;
    currentBlob = snap.blob;
    currentUrl = snap.url;
    createOverlay();
    initCropper(snap.url);
    updateNavButtons();
  }

  // ── 创建 DOM ──

  function createOverlay() {
    if (overlayEl) overlayEl.remove();
    sidebarVisible = false;
    cropMode = false;

    overlayEl = document.createElement('div');
    overlayEl.className = 'bn-crop-overlay';
    overlayEl.setAttribute('data-bn-theme', window.BiViNote.state.settings.darkMode ? 'dark' : '');

    overlayEl.innerHTML = `
      <button class="bn-crop-close-btn" title="关闭 (Esc)">✕</button>
      <button class="bn-crop-nav-btn bn-crop-nav-prev" title="上一张"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <button class="bn-crop-nav-btn bn-crop-nav-next" title="下一张"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
      <div class="bn-crop-sidebar" style="display:none;">
        <div class="bn-crop-sidebar-title">截图目录</div>
        <div class="bn-crop-sidebar-list"></div>
      </div>
      <div class="bn-crop-cropper-wrap">
        <img id="bn-cropper-target" src="" alt="">
      </div>
      <div class="bn-crop-controls">
        <button class="bn-crop-catalog-btn" data-act="catalog" title="截图目录">目录</button>
        <div class="bn-crop-btns-browse">
          <button data-act="prev">上一帧</button>
          <button data-act="next">下一帧</button>
          <button data-act="enter-crop">裁剪</button>
          <button data-act="download">下载</button>
          <button data-act="clipboard">复制</button>
        </div>
        <div class="bn-crop-btns-crop" style="display:none;">
          <button data-act="zoom-in" title="放大">＋</button>
          <button data-act="zoom-out" title="缩小">－</button>
          <button data-act="rotate-left" title="左旋">↺</button>
          <button data-act="rotate-right" title="右旋">↻</button>
          <button data-act="flip-h" title="水平翻转">⇔</button>
          <button data-act="flip-v" title="垂直翻转">⇕</button>
          <button data-act="reset" title="重置">重置</button>
          <span class="bn-crop-divider"></span>
          <select class="bn-crop-ratio" title="裁剪比例">
            <option value="NaN">自由</option>
            <option value="1.7778">16:9</option>
            <option value="1.3333">4:3</option>
            <option value="1">1:1</option>
            <option value="0.6667">2:3</option>
            <option value="0.5625">9:16</option>
          </select>
          <button data-act="crop-done">完成</button>
          <button data-act="crop-cancel">取消</button>
        </div>
      </div>
    `;

    sidebarEl = overlayEl.querySelector('.bn-crop-sidebar');

    // 事件绑定
    overlayEl.querySelector('.bn-crop-controls').addEventListener('click', onControlClick);
    overlayEl.querySelector('.bn-crop-close-btn').addEventListener('click', close);
    overlayEl.querySelector('.bn-crop-nav-prev').addEventListener('click', () => navigateTo(-1));
    overlayEl.querySelector('.bn-crop-nav-next').addEventListener('click', () => navigateTo(1));
    document.addEventListener('keydown', onKeyDown);

    // 比例选择
    overlayEl.querySelector('.bn-crop-ratio').addEventListener('change', (e) => {
      const ratio = parseFloat(e.target.value);
      if (cropperSelection) {
        cropperSelection.$change(undefined, undefined, undefined, undefined, isNaN(ratio) ? NaN : ratio);
      }
    });

    document.body.appendChild(overlayEl);
  }

  // ── 初始化 cropperjs ──

  function initCropper(url) {
    const imgEl = overlayEl.querySelector('#bn-cropper-target');
    imgEl.src = url;

    imgEl.onload = () => {
      if (cropper) cropper.destroy();

      cropper = new window.Cropper.Cropper(imgEl, {
        template: [
          '<cropper-canvas background>',
          '  <cropper-image rotatable scalable skewable translatable></cropper-image>',
          '  <cropper-shade hidden></cropper-shade>',
          '  <cropper-handle action="select" plain></cropper-handle>',
          '  <cropper-selection initial-coverage="1" hidden movable resizable>',
          '    <cropper-grid role="grid" bordered covered></cropper-grid>',
          '    <cropper-crosshair centered></cropper-crosshair>',
          '    <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>',
          '    <cropper-handle action="n-resize"></cropper-handle>',
          '    <cropper-handle action="e-resize"></cropper-handle>',
          '    <cropper-handle action="s-resize"></cropper-handle>',
          '    <cropper-handle action="w-resize"></cropper-handle>',
          '    <cropper-handle action="ne-resize"></cropper-handle>',
          '    <cropper-handle action="nw-resize"></cropper-handle>',
          '    <cropper-handle action="se-resize"></cropper-handle>',
          '    <cropper-handle action="sw-resize"></cropper-handle>',
          '  </cropper-selection>',
          '</cropper-canvas>'
        ].join('')
      });

      cropperImage = cropper.getCropperImage();
      cropperSelection = cropper.getCropperSelection();
    };
  }

  // ── 截图导航 ──

  function navigateTo(direction) {
    const list = getScreenshotList();
    if (list.length < 2) return;
    const idx = getCurrentIndex();
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= list.length) return;
    switchToScreenshot(list[newIdx].key);
  }

  function switchToScreenshot(snapKey) {
    const snap = window.BiViNote.state.screenshots.get(snapKey);
    if (!snap) return;
    exitCropMode();
    currentSnapKey = snapKey;
    currentBlob = snap.blob;
    currentUrl = snap.url;
    initCropper(snap.url);
    updateNavButtons();
    updateSidebarHighlight();
  }

  function updateNavButtons() {
    if (!overlayEl) return;
    const list = getScreenshotList();
    const idx = getCurrentIndex();
    const prevBtn = overlayEl.querySelector('.bn-crop-nav-prev');
    const nextBtn = overlayEl.querySelector('.bn-crop-nav-next');
    if (prevBtn) prevBtn.style.display = (idx > 0) ? '' : 'none';
    if (nextBtn) nextBtn.style.display = (idx < list.length - 1) ? '' : 'none';
  }

  // ── 目录侧栏 ──

  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    if (!sidebarEl) return;
    sidebarEl.style.display = sidebarVisible ? '' : 'none';
    if (sidebarVisible) renderSidebar();
  }

  function renderSidebar() {
    if (!sidebarEl) return;
    const list = getScreenshotList();
    const listEl = sidebarEl.querySelector('.bn-crop-sidebar-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    list.forEach(item => {
      const div = document.createElement('div');
      div.className = 'bn-crop-sidebar-item';
      if (item.key === currentSnapKey) div.classList.add('bn-crop-sidebar-active');
      div.dataset.key = item.key;
      const text = getSnapText(item.key);
      const time = getSnapTimeDisplay(item.key);
      div.innerHTML = `
        <img class="bn-crop-sidebar-thumb" src="${item.url}" alt="">
        <div class="bn-crop-sidebar-info">
          <div class="bn-crop-sidebar-time">${time}</div>
          <div class="bn-crop-sidebar-text">${escapeHtml(text)}</div>
        </div>
      `;
      div.addEventListener('click', () => switchToScreenshot(item.key));
      listEl.appendChild(div);
    });
  }

  function updateSidebarHighlight() {
    if (!sidebarEl || !sidebarVisible) return;
    sidebarEl.querySelectorAll('.bn-crop-sidebar-item').forEach(el => {
      el.classList.toggle('bn-crop-sidebar-active', el.dataset.key === String(currentSnapKey));
    });
    const active = sidebarEl.querySelector('.bn-crop-sidebar-active');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── 裁剪模式 ──

  function enterCropMode() {
    cropMode = true;
    if (sidebarVisible) { sidebarVisible = false; sidebarEl.style.display = 'none'; }

    overlayEl.querySelector('.bn-crop-btns-browse').style.display = 'none';
    overlayEl.querySelector('.bn-crop-btns-crop').style.display = '';
    overlayEl.querySelector('.bn-crop-catalog-btn').style.display = 'none';
    overlayEl.querySelector('.bn-crop-nav-prev').style.display = 'none';
    overlayEl.querySelector('.bn-crop-nav-next').style.display = 'none';

    // 显示选区
    if (cropperSelection) {
      cropperSelection.hidden = false;
      cropperSelection.$reset();
    }
  }

  function exitCropMode() {
    cropMode = false;
    if (cropperSelection) cropperSelection.hidden = true;

    overlayEl.querySelector('.bn-crop-btns-browse').style.display = '';
    overlayEl.querySelector('.bn-crop-btns-crop').style.display = 'none';
    overlayEl.querySelector('.bn-crop-catalog-btn').style.display = '';
    updateNavButtons();
  }

  // ── 裁剪应用 ──

  function applyCrop() {
    if (!cropperSelection || !cropperImage) return;

    const canvas = cropperSelection.$toCanvas();
    if (!canvas) return;

    canvas.toBlob(blob => {
      if (!blob) return;
      const s = window.BiViNote.state;
      const old = s.screenshots.get(currentSnapKey);
      if (old?.url) URL.revokeObjectURL(old.url);
      const url = URL.createObjectURL(blob);
      s.screenshots.set(currentSnapKey, {
        blob, url, timeCode: old?.timeCode || '0000', timeSeconds: old?.timeSeconds || 0
      });
      currentBlob = blob;
      currentUrl = url;
      exitCropMode();
      initCropper(url);
      window.BiViNote.subtitle.renderSubtitleList();
      window.BiViNote.chapter.render();
      window.BiViNote.panel.renderPrompt();
      window.BiViNote.panel.showToast('裁剪完成');
    }, 'image/png');
  }

  // ── 帧步进 ──

  async function doFrameStep(direction) {
    const video = window.BiViNote.subtitle?.getVideoElement();
    if (!video) return;
    const step = window.BiViNote.state.settings.frameStep || 0.2;
    video.currentTime = direction === 'prev'
      ? Math.max(0, video.currentTime - step)
      : Math.min(video.duration, video.currentTime + step);
    await new Promise(r => video.addEventListener('seeked', r, { once: true }));

    const newBlob = await window.BiViNote.capture.captureFrame(video);
    const newUrl = URL.createObjectURL(newBlob);
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentBlob = newBlob;
    currentUrl = newUrl;
    initCropper(newUrl);

    const s = window.BiViNote.state;
    const old = s.screenshots.get(currentSnapKey);
    s.screenshots.set(currentSnapKey, {
      blob: newBlob, url: newUrl,
      timeCode: old?.timeCode || window.BiViNote.capture.formatTimeCode(video.currentTime),
      timeSeconds: video.currentTime
    });
  }

  // ── 按钮事件 ──

  function onControlClick(e) {
    const act = e.target.dataset?.act;
    if (!act) return;

    if (act === 'close') close();
    else if (act === 'catalog') toggleSidebar();
    else if (act === 'prev') doFrameStep('prev');
    else if (act === 'next') doFrameStep('next');
    else if (act === 'enter-crop') enterCropMode();
    else if (act === 'crop-done') applyCrop();
    else if (act === 'crop-cancel') exitCropMode();
    else if (act === 'zoom-in' && cropperImage) cropperImage.$zoom(0.1);
    else if (act === 'zoom-out' && cropperImage) cropperImage.$zoom(-0.1);
    else if (act === 'rotate-left' && cropperImage) cropperImage.$rotate('-45deg');
    else if (act === 'rotate-right' && cropperImage) cropperImage.$rotate('45deg');
    else if (act === 'flip-h' && cropperImage) cropperImage.$scale(-1, 1);
    else if (act === 'flip-v' && cropperImage) cropperImage.$scale(1, -1);
    else if (act === 'reset' && cropperImage) {
      cropperImage.$resetTransform();
      cropperImage.$center('contain');
      if (cropperSelection) cropperSelection.$reset();
    }
    else if (act === 'download') {
      const video = window.BiViNote.subtitle?.getVideoElement();
      window.BiViNote.capture.saveToFile(currentBlob, window.BiViNote.capture.generateDownloadFilename(video?.currentTime || 0));
      window.BiViNote.panel.showToast('截图已保存');
    } else if (act === 'clipboard') {
      window.BiViNote.capture.copyToClipboard(currentBlob).then(ok => {
        window.BiViNote.panel.showToast(ok ? '已复制到剪贴板' : '复制失败');
      });
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (cropMode) exitCropMode();
      else close();
    }
  }

  // ── 关闭 ──

  function close() {
    if (cropper) { cropper.destroy(); cropper = null; }
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    document.removeEventListener('keydown', onKeyDown);
    cropperImage = null;
    cropperSelection = null;
    cropMode = false;
    sidebarVisible = false;
  }

  function escapeHtml(s) { return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }

  window.BiViNote.cropViewer = { open, close };
})();
