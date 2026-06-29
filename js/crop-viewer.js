/**
 * BiViNote Crop Viewer Module
 * 基于 Cropper.js 的截图浏览和裁剪
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  let overlayEl = null;
  let cropperEl = null;
  let cropper = null;
  let sidebarEl = null;

  let currentSnapKey = -1;
  let currentBlob = null;
  let currentUrl = null;

  let imgNatW = 0;
  let imgNatH = 0;

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
    loadImage(snap.url);
    updateNavButtons();
  }

  // ── 创建 DOM ──

  // SVG 图标
  const ICONS = {
    prev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>',
    next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>',
    crop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    zoomIn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    zoomOut: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    rotateL: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    rotateR: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    flipH: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><line x1="12" y1="2" x2="12" y2="22"/></svg>',
    flipV: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h14c1.1 0 2 .9 2 2v3"/><path d="M3 16v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><line x1="2" y1="12" x2="22" y2="12"/></svg>',
    reset: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    catalog: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>'
  };

  function createOverlay() {
    if (overlayEl) overlayEl.remove();

    overlayEl = document.createElement('div');
    overlayEl.className = 'bn-crop-overlay';
    overlayEl.setAttribute('data-bn-theme', window.BiViNote.state.settings.darkMode ? 'dark' : '');

    overlayEl.innerHTML = `
      <button class="bn-crop-close-btn" title="关闭 (Esc)">✕</button>
      <div class="bn-crop-main">
        <div class="bn-crop-sidebar">
          <div class="bn-crop-sidebar-title">截图目录</div>
          <div class="bn-crop-sidebar-list"></div>
        </div>
        <div class="bn-crop-canvas-wrap">
          <button class="bn-crop-nav-btn bn-crop-nav-prev" title="上一张截图"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <button class="bn-crop-nav-btn bn-crop-nav-next" title="下一张截图"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
          <img id="bn-cropper-img" src="" alt="">
        </div>
      </div>
      <div class="bn-crop-controls">
        <div class="bn-crop-btns-browse">
          <button data-act="prev">${ICONS.prev} <span>上一帧</span></button>
          <button data-act="next">${ICONS.next} <span>下一帧</span></button>
          <button data-act="enter-crop">${ICONS.crop} <span>裁剪</span></button>
          <button data-act="download">${ICONS.download} <span>下载</span></button>
          <button data-act="clipboard">${ICONS.copy} <span>复制</span></button>
        </div>
        <div class="bn-crop-btns-crop" style="display:none;">
          <select class="bn-crop-ratio" title="裁剪比例">
            <option value="NaN">自由</option>
            <option value="1.7778">16:9</option>
            <option value="1.3333">4:3</option>
            <option value="1">1:1</option>
            <option value="0.6667">2:3</option>
            <option value="0.5625">9:16</option>
          </select>
          <span class="bn-crop-divider"></span>
          <button data-act="zoom-in">${ICONS.zoomIn} <span>放大</span></button>
          <button data-act="zoom-out">${ICONS.zoomOut} <span>缩小</span></button>
          <button data-act="rotate-left">${ICONS.rotateL} <span>左旋</span></button>
          <button data-act="rotate-right">${ICONS.rotateR} <span>右旋</span></button>
          <button data-act="flip-h">${ICONS.flipH} <span>水平翻转</span></button>
          <button data-act="flip-v">${ICONS.flipV} <span>垂直翻转</span></button>
          <button data-act="reset">${ICONS.reset} <span>重置</span></button>
          <span class="bn-crop-divider"></span>
          <button data-act="crop-done">✓ <span>完成</span></button>
          <button data-act="crop-cancel">✕ <span>取消</span></button>
        </div>
      </div>
    `;

    cropperEl = overlayEl.querySelector('#bn-cropper-img');
    sidebarEl = overlayEl.querySelector('.bn-crop-sidebar');

    // 事件
    overlayEl.querySelector('.bn-crop-controls').addEventListener('click', onControlClick);
    overlayEl.querySelector('.bn-crop-close-btn').addEventListener('click', close);
    overlayEl.querySelector('.bn-crop-nav-prev').addEventListener('click', () => navigateTo(-1));
    overlayEl.querySelector('.bn-crop-nav-next').addEventListener('click', () => navigateTo(1));
    document.addEventListener('keydown', onKeyDown);

    // 比例切换
    overlayEl.querySelector('.bn-crop-ratio').addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      if (cropper) cropper.setAspectRatio(isNaN(val) ? NaN : val);
    });

    document.body.appendChild(overlayEl);
    window.addEventListener('resize', onResize);
  }

  // ── 加载图片 ──

  function loadImage(url) {
    // 先预加载图片，加载完再替换 Cropper，避免闪烁
    const img = new Image();
    img.onload = () => {
      imgNatW = img.naturalWidth;
      imgNatH = img.naturalHeight;
      if (cropper) {
        cropper.replace(url);
      } else {
        cropperEl.src = url;
        initCropper();
      }
      renderSidebar();
    };
    img.src = url;
  }

  function initCropper() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    cropper = new Cropper(cropperEl, {
      aspectRatio: NaN,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      ready() {
        // 默认隐藏裁剪框和遮罩
        setCropperVisible(false);
      }
    });
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
    loadImage(snap.url);
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
    if (!sidebarEl) return;
    sidebarEl.querySelectorAll('.bn-crop-sidebar-item').forEach(el => {
      el.classList.toggle('bn-crop-sidebar-active', el.dataset.key === String(currentSnapKey));
    });
    const active = sidebarEl.querySelector('.bn-crop-sidebar-active');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── 裁剪模式 ──

  let currentRotation = 0;
  let flipH = false;
  let flipV = false;

  function setCropperVisible(visible) {
    if (!overlayEl) return;
    const cropBox = overlayEl.querySelector('.cropper-crop-box');
    const modal = overlayEl.querySelector('.cropper-modal');
    if (visible) {
      // 裁剪模式：正常显示
      if (cropBox) { cropBox.style.display = ''; cropBox.style.opacity = ''; }
      if (modal) { modal.style.display = ''; modal.style.opacity = ''; }
    } else {
      // 浏览模式：隐藏裁剪框，遮罩透明化（保留拖动交互）
      if (cropBox) cropBox.style.display = 'none';
      if (modal) modal.style.opacity = '0';
    }
  }

  function enterCropMode() {
    if (!cropper) return;
    setCropperVisible(true);

    overlayEl.querySelector('.bn-crop-btns-browse').style.display = 'none';
    overlayEl.querySelector('.bn-crop-btns-crop').style.display = '';
    overlayEl.querySelector('.bn-crop-nav-prev').style.display = 'none';
    overlayEl.querySelector('.bn-crop-nav-next').style.display = 'none';
  }

  function exitCropMode() {
    if (!cropper) return;
    setCropperVisible(false);

    overlayEl.querySelector('.bn-crop-btns-browse').style.display = '';
    overlayEl.querySelector('.bn-crop-btns-crop').style.display = 'none';
    updateNavButtons();
  }

  function applyCrop() {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({
      fillColor: '#fff',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });
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
      loadImage(url);
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
    loadImage(newUrl);

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
    const btn = e.target.closest('button');
    const act = btn?.dataset?.act;
    if (!act || !cropper) return;

    if (act === 'close') close();
    else if (act === 'prev') doFrameStep('prev');
    else if (act === 'next') doFrameStep('next');
    else if (act === 'enter-crop') enterCropMode();
    else if (act === 'crop-done') applyCrop();
    else if (act === 'crop-cancel') exitCropMode();
    else if (act === 'zoom-in') cropper.zoom(0.1);
    else if (act === 'zoom-out') cropper.zoom(-0.1);
    else if (act === 'rotate-left') cropper.rotate(-90);
    else if (act === 'rotate-right') cropper.rotate(90);
    else if (act === 'flip-h') {
      flipH = !flipH;
      cropper.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    }
    else if (act === 'flip-v') {
      flipV = !flipV;
      cropper.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    }
    else if (act === 'reset') {
      cropper.reset();
      flipH = false;
      flipV = false;
      currentRotation = 0;
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
      const cropBtns = overlayEl?.querySelector('.bn-crop-btns-crop');
      if (cropBtns && cropBtns.style.display !== 'none') {
        exitCropMode();
      } else {
        close();
      }
    }
  }

  // ── 关闭 ──

  function close() {
    if (cropper) { cropper.destroy(); cropper = null; }
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKeyDown);
    flipH = false;
    flipV = false;
    currentRotation = 0;
  }

  function onResize() {
    if (cropper) cropper.resize();
  }

  function escapeHtml(s) {
    return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  window.BiViNote.cropViewer = { open, close };
})();
