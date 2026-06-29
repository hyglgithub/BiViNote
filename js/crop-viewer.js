/**
 * BiViNote Crop Viewer Module (v2)
 * 基于 2D 仿射矩阵的裁剪浏览
 * 参考 cropperjs 架构：矩阵变换 + action 事件驱动
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  // ── DOM 引用 ──
  let overlayEl = null;
  let canvasWrapEl = null;
  let imgEl = null;
  let selectionEl = null;
  let sidebarEl = null;

  // ── 状态 ──
  let currentSnapKey = -1;
  let currentBlob = null;
  let currentUrl = null;
  let sidebarVisible = false;

  // 图片变换矩阵 [a, b, c, d, e, f]
  let matrix = [1, 0, 0, 1, 0, 0];

  // 交互模式
  let mode = 'translate'; // 'translate' | 'select'

  // 拖动状态
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragType = ''; // 'image' | 'selection' | 'nw'|'ne'|'sw'|'se'|'n'|'s'|'e'|'w'

  // 裁剪选区
  let selX = 0, selY = 0, selW = 0, selH = 0;
  let selAspectRatio = NaN; // NaN = 自由

  // 图片原始尺寸
  let imgNatW = 0;
  let imgNatH = 0;

  // ── 工具函数 ──

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function escapeHtml(s) { return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }

  // ── 矩阵运算 ──

  function multiplyMatrix(m1, m2) {
    const [a1, b1, c1, d1, e1, f1] = m1;
    const [a2, b2, c2, d2, e2, f2] = m2;
    return [
      a1 * a2 + c1 * b2,
      b1 * a2 + d1 * b2,
      a1 * c2 + c1 * d2,
      b1 * c2 + d1 * d2,
      a1 * e2 + c1 * f2 + e1,
      b1 * e2 + d1 * f2 + f1,
    ];
  }

  function applyMatrix() {
    if (!imgEl) return;
    imgEl.style.transform = `matrix(${matrix.join(',')})`;
  }

  function resetMatrix() {
    matrix = [1, 0, 0, 1, 0, 0];
    applyMatrix();
  }

  // ── 变换操作 ──

  function zoomImage(delta, cx, cy) {
    const scale = delta < 0 ? 1 / (1 - Math.abs(delta)) : 1 + delta;
    const [a, b, c, d] = matrix;
    const wrapRect = canvasWrapEl.getBoundingClientRect();
    const originX = cx !== undefined ? cx : wrapRect.width / 2;
    const originY = cy !== undefined ? cy : wrapRect.height / 2;

    // 逆矩阵计算缩放中心
    const det = a * d - c * b;
    if (Math.abs(det) < 1e-10) return;
    const moveX = originX - wrapRect.width / 2;
    const moveY = originY - wrapRect.height / 2;
    const tx = (moveX * d - c * moveY) / det;
    const ty = (moveY * a - b * moveX) / det;

    const t = [scale, 0, 0, scale, tx * (1 - scale), ty * (1 - scale)];
    matrix = multiplyMatrix(matrix, t);
    applyMatrix();
  }

  function moveImage(dx, dy) {
    const [a, b, c, d] = matrix;
    const det = a * d - c * b;
    if (Math.abs(det) < 1e-10) return;
    const tx = (dx * d - c * dy) / det;
    const ty = (dy * a - b * dx) / det;
    matrix = multiplyMatrix(matrix, [1, 0, 0, 1, tx, ty]);
    applyMatrix();
  }

  function rotateImage(deg) {
    const rad = (deg / 360) * Math.PI * 2;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    matrix = multiplyMatrix(matrix, [cos, sin, -sin, cos, 0, 0]);
    applyMatrix();
  }

  function flipImage(horizontal) {
    if (horizontal) {
      matrix = multiplyMatrix(matrix, [-1, 0, 0, 1, 0, 0]);
    } else {
      matrix = multiplyMatrix(matrix, [1, 0, 0, -1, 0, 0]);
    }
    applyMatrix();
  }

  function resetTransform() {
    resetMatrix();
  }

  // ── 选区操作 ──

  function renderSelection() {
    if (!selectionEl) return;
    selectionEl.style.left = selX + 'px';
    selectionEl.style.top = selY + 'px';
    selectionEl.style.width = selW + 'px';
    selectionEl.style.height = selH + 'px';
  }

  function initSelection() {
    if (!canvasWrapEl) return;
    const wrapW = canvasWrapEl.clientWidth;
    const wrapH = canvasWrapEl.clientHeight;
    // 默认选区 = 图片显示区域（居中，contain 模式）
    const imgDisplay = getImageDisplayRect();
    selX = imgDisplay.x;
    selY = imgDisplay.y;
    selW = imgDisplay.w;
    selH = imgDisplay.h;
    renderSelection();
  }

  function getImageDisplayRect() {
    if (!canvasWrapEl || !imgNatW) return { x: 0, y: 0, w: 0, h: 0 };
    const wrapW = canvasWrapEl.clientWidth;
    const wrapH = canvasWrapEl.clientHeight;
    const scaleX = wrapW / imgNatW;
    const scaleY = wrapH / imgNatH;
    const scale = Math.min(scaleX, scaleY, 1);
    const w = imgNatW * scale;
    const h = imgNatH * scale;
    return { x: (wrapW - w) / 2, y: (wrapH - h) / 2, w, h };
  }

  function applyAspectRatio() {
    if (!isNaN(selAspectRatio) && selAspectRatio > 0) {
      const newH = selW / selAspectRatio;
      const wrapH = canvasWrapEl.clientHeight;
      selH = Math.min(newH, wrapH - selY);
      selW = selH * selAspectRatio;
    }
  }

  // ── 获取截图数据 ──

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
    if (snapKey >= 0) {
      return s.subtitleBody[snapKey]?.content || '';
    } else {
      return s.chapters[-snapKey - 1]?.title || '';
    }
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

  function createOverlay() {
    if (overlayEl) overlayEl.remove();
    sidebarVisible = false;

    overlayEl = document.createElement('div');
    overlayEl.className = 'bn-crop-overlay';
    overlayEl.setAttribute('data-bn-theme', window.BiViNote.state.settings.darkMode ? 'dark' : '');

    overlayEl.innerHTML = `
      <button class="bn-crop-close-btn" title="关闭 (Esc)">✕</button>
      <button class="bn-crop-nav-btn bn-crop-nav-prev" title="上一张截图"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <button class="bn-crop-nav-btn bn-crop-nav-next" title="下一张截图"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
      <div class="bn-crop-sidebar" style="display:none;">
        <div class="bn-crop-sidebar-title">截图目录</div>
        <div class="bn-crop-sidebar-list"></div>
      </div>
      <div class="bn-crop-canvas-wrap">
        <img class="bn-crop-img" src="" alt="" style="position:absolute;top:50%;left:50%;transform-origin:0 0;">
        <div class="bn-crop-selection" style="display:none;">
          <div class="bn-crop-handle bn-crop-handle-nw" data-handle="nw"></div>
          <div class="bn-crop-handle bn-crop-handle-ne" data-handle="ne"></div>
          <div class="bn-crop-handle bn-crop-handle-sw" data-handle="sw"></div>
          <div class="bn-crop-handle bn-crop-handle-se" data-handle="se"></div>
          <div class="bn-crop-handle bn-crop-handle-n" data-handle="n"></div>
          <div class="bn-crop-handle bn-crop-handle-s" data-handle="s"></div>
          <div class="bn-crop-handle bn-crop-handle-e" data-handle="e"></div>
          <div class="bn-crop-handle bn-crop-handle-w" data-handle="w"></div>
        </div>
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
          <button data-act="mode-translate" class="bn-crop-mode-btn bn-crop-mode-active" title="平移模式">平移</button>
          <button data-act="mode-select" class="bn-crop-mode-btn" title="裁剪模式">裁剪</button>
          <span class="bn-crop-divider"></span>
          <button data-act="zoom-in" title="放大">＋</button>
          <button data-act="zoom-out" title="缩小">－</button>
          <button data-act="rotate-left" title="左旋45°">↺</button>
          <button data-act="rotate-right" title="右旋45°">↻</button>
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

    canvasWrapEl = overlayEl.querySelector('.bn-crop-canvas-wrap');
    imgEl = overlayEl.querySelector('.bn-crop-img');
    selectionEl = overlayEl.querySelector('.bn-crop-selection');
    sidebarEl = overlayEl.querySelector('.bn-crop-sidebar');

    // 事件绑定
    overlayEl.querySelector('.bn-crop-controls').addEventListener('click', onControlClick);
    overlayEl.querySelector('.bn-crop-close-btn').addEventListener('click', close);
    overlayEl.querySelector('.bn-crop-nav-prev').addEventListener('click', () => navigateTo(-1));
    overlayEl.querySelector('.bn-crop-nav-next').addEventListener('click', () => navigateTo(1));
    canvasWrapEl.addEventListener('wheel', onWheel, { passive: false });
    canvasWrapEl.addEventListener('mousedown', onPointerDown);
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('keydown', onKeyDown);

    // 选区手柄
    selectionEl.addEventListener('mousedown', onSelectionMouseDown);

    // 比例
    overlayEl.querySelector('.bn-crop-ratio').addEventListener('change', (e) => {
      selAspectRatio = parseFloat(e.target.value);
      if (isNaN(selAspectRatio)) selAspectRatio = NaN;
      applyAspectRatio();
      renderSelection();
    });

    // 模式切换按钮高亮
    overlayEl.querySelectorAll('.bn-crop-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.act === 'mode-select' ? 'select' : 'translate';
        updateModeButtons();
        updateCursor();
      });
    });

    document.body.appendChild(overlayEl);
    window.addEventListener('resize', onResize);
  }

  // ── 加载图片 ──

  function loadImage(url) {
    imgEl.onload = () => {
      imgNatW = imgEl.naturalWidth;
      imgNatH = imgEl.naturalHeight;
      resetMatrix();
      // 居中图片
      imgEl.style.width = imgNatW + 'px';
      imgEl.style.height = imgNatH + 'px';
      const display = getImageDisplayRect();
      imgEl.style.marginLeft = (display.x - canvasWrapEl.clientWidth / 2) + 'px';
      imgEl.style.marginTop = (display.y - canvasWrapEl.clientHeight / 2) + 'px';
      imgEl.style.width = display.w + 'px';
      imgEl.style.height = display.h + 'px';
    };
    imgEl.src = url;
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

  // ── 模式切换 ──

  function updateModeButtons() {
    if (!overlayEl) return;
    overlayEl.querySelectorAll('.bn-crop-mode-btn').forEach(btn => {
      const isActive = (btn.dataset.act === 'mode-select' && mode === 'select') ||
                       (btn.dataset.act === 'mode-translate' && mode === 'translate');
      btn.classList.toggle('bn-crop-mode-active', isActive);
    });
  }

  function updateCursor() {
    if (!canvasWrapEl) return;
    canvasWrapEl.style.cursor = mode === 'select' ? 'crosshair' : 'grab';
  }

  // ── 裁剪模式 ──

  function enterCropMode() {
    mode = 'translate';
    if (sidebarVisible) { sidebarVisible = false; sidebarEl.style.display = 'none'; }

    overlayEl.querySelector('.bn-crop-btns-browse').style.display = 'none';
    overlayEl.querySelector('.bn-crop-btns-crop').style.display = '';
    overlayEl.querySelector('.bn-crop-catalog-btn').style.display = 'none';
    overlayEl.querySelector('.bn-crop-nav-prev').style.display = 'none';
    overlayEl.querySelector('.bn-crop-nav-next').style.display = 'none';

    selectionEl.style.display = '';
    initSelection();
    updateModeButtons();
    updateCursor();
  }

  function exitCropMode() {
    mode = 'translate';
    selectionEl.style.display = 'none';

    overlayEl.querySelector('.bn-crop-btns-browse').style.display = '';
    overlayEl.querySelector('.bn-crop-btns-crop').style.display = 'none';
    overlayEl.querySelector('.bn-crop-catalog-btn').style.display = '';
    updateNavButtons();
    if (canvasWrapEl) canvasWrapEl.style.cursor = '';
  }

  // ── 裁剪应用 ──

  function applyCrop() {
    if (!imgEl || !imgNatW) return;
    // 将选区坐标转换为原图像素坐标
    const display = getImageDisplayRect();
    const scaleX = imgNatW / display.w;
    const scaleY = imgNatH / display.h;

    const sx = Math.max(0, Math.round((selX - display.x) * scaleX));
    const sy = Math.max(0, Math.round((selY - display.y) * scaleY));
    const sw = Math.min(Math.round(selW * scaleX), imgNatW - sx);
    const sh = Math.min(Math.round(selH * scaleY), imgNatH - sy);

    if (sw <= 0 || sh <= 0) return;

    const offscreen = new OffscreenCanvas(sw, sh);
    const offCtx = offscreen.getContext('2d');

    // 应用当前矩阵变换后再裁剪
    offCtx.translate(sw / 2, sh / 2);
    offCtx.transform(matrix[0], matrix[1], matrix[2], matrix[3], 0, 0);
    offCtx.translate(-sx - sw / 2, -sy - sh / 2);
    offCtx.drawImage(imgEl, 0, 0, imgNatW, imgNatH);

    offscreen.convertToBlob({ type: 'image/png' }).then(blob => {
      const s = window.BiViNote.state;
      const old = s.screenshots.get(currentSnapKey);
      if (old?.url) URL.revokeObjectURL(old.url);
      const url = URL.createObjectURL(blob);
      s.screenshots.set(currentSnapKey, {
        blob, url, timeCode: old?.timeCode || '0000', timeSeconds: old?.timeSeconds || 0
      });
      currentBlob = blob; currentUrl = url;
      loadImage(url);
      exitCropMode();
      window.BiViNote.subtitle.renderSubtitleList();
      window.BiViNote.chapter.render();
      window.BiViNote.panel.renderPrompt();
      window.BiViNote.panel.showToast('裁剪完成');
    });
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
    currentBlob = newBlob; currentUrl = newUrl;
    loadImage(newUrl);

    const s = window.BiViNote.state;
    const old = s.screenshots.get(currentSnapKey);
    s.screenshots.set(currentSnapKey, {
      blob: newBlob, url: newUrl,
      timeCode: old?.timeCode || window.BiViNote.capture.formatTimeCode(video.currentTime),
      timeSeconds: video.currentTime
    });
  }

  // ── 事件处理 ──

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
    else if (act === 'zoom-in') zoomImage(0.1);
    else if (act === 'zoom-out') zoomImage(-0.1);
    else if (act === 'rotate-left') rotateImage(-45);
    else if (act === 'rotate-right') rotateImage(45);
    else if (act === 'flip-h') flipImage(true);
    else if (act === 'flip-v') flipImage(false);
    else if (act === 'reset') resetTransform();
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

  function onWheel(e) {
    e.preventDefault();
    const rect = canvasWrapEl.getBoundingClientRect();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomImage(delta, e.clientX - rect.left, e.clientY - rect.top);
  }

  function onPointerDown(e) {
    if (mode === 'select') {
      // 在选区外点击 → 创建新选区
      const rect = canvasWrapEl.getBoundingClientRect();
      isDragging = true;
      dragType = 'new-selection';
      dragStartX = e.clientX - rect.left;
      dragStartY = e.clientY - rect.top;
      selX = dragStartX;
      selY = dragStartY;
      selW = 0;
      selH = 0;
      selectionEl.style.display = '';
      renderSelection();
      return;
    }
    // 平移模式
    isDragging = true;
    dragType = 'image';
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    canvasWrapEl.style.cursor = 'grabbing';
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    if (dragType === 'image') {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      moveImage(dx, dy);
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    } else if (dragType === 'new-selection') {
      const rect = canvasWrapEl.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      selW = Math.abs(curX - dragStartX);
      selH = Math.abs(curY - dragStartY);
      selX = Math.min(curX, dragStartX);
      selY = Math.min(curY, dragStartY);
      if (!isNaN(selAspectRatio)) {
        selH = selW / selAspectRatio;
      }
      renderSelection();
    } else if (dragType === 'selection-move') {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      const wrapW = canvasWrapEl.clientWidth;
      const wrapH = canvasWrapEl.clientHeight;
      selX = clamp(selX + dx, 0, wrapW - selW);
      selY = clamp(selY + dy, 0, wrapH - selH);
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      renderSelection();
    } else if (dragType) {
      // resize handles
      handleResize(e);
    }
  }

  function onPointerUp() {
    isDragging = false;
    dragType = '';
    if (canvasWrapEl && mode === 'translate') canvasWrapEl.style.cursor = 'grab';
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (overlayEl?.querySelector('.bn-crop-btns-crop').style.display !== 'none') {
        exitCropMode();
      } else {
        close();
      }
    }
  }

  // ── 选区拖动和调整 ──

  function onSelectionMouseDown(e) {
    e.stopPropagation();
    const handle = e.target.dataset?.handle;
    if (handle) {
      dragType = handle;
    } else {
      dragType = 'selection-move';
    }
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
  }

  function handleResize(e) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const wrapW = canvasWrapEl.clientWidth;
    const wrapH = canvasWrapEl.clientHeight;
    const MIN = 20;

    let newX = selX, newY = selY, newW = selW, newH = selH;
    let newX2 = selX + selW, newY2 = selY + selH;

    if (dragType.includes('w')) { newX = clamp(selX + dx, 0, newX2 - MIN); newW = newX2 - newX; }
    if (dragType.includes('e')) { newX2 = clamp(selX + selW + dx, newX + MIN, wrapW); newW = newX2 - newX; }
    if (dragType.includes('n')) { newY = clamp(selY + dy, 0, newY2 - MIN); newH = newY2 - newY; }
    if (dragType.includes('s')) { newY2 = clamp(selY + selH + dy, newY + MIN, wrapH); newH = newY2 - newY; }

    if (!isNaN(selAspectRatio) && selAspectRatio > 0) {
      if (dragType === 'se' || dragType === 'e' || dragType === 's') {
        newH = newW / selAspectRatio;
        if (newY + newH > wrapH) { newH = wrapH - newY; newW = newH * selAspectRatio; }
      } else if (dragType === 'nw' || dragType === 'w' || dragType === 'n') {
        newW = newH * selAspectRatio;
        newX = newX2 - newW;
        if (newX < 0) { newX = 0; newW = newX2; newH = newW / selAspectRatio; newY = newY2 - newH; }
      }
    }

    selX = newX; selY = newY;
    selW = Math.max(MIN, newW);
    selH = Math.max(MIN, newH);
    renderSelection();
  }

  // ── 关闭 ──

  function close() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    window.removeEventListener('resize', onResize);
    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('keydown', onKeyDown);
    imgEl = null; sidebarVisible = false;
  }

  function onResize() {
    if (!overlayEl || !imgNatW) return;
    const display = getImageDisplayRect();
    imgEl.style.marginLeft = (display.x - canvasWrapEl.clientWidth / 2) + 'px';
    imgEl.style.marginTop = (display.y - canvasWrapEl.clientHeight / 2) + 'px';
    imgEl.style.width = display.w + 'px';
    imgEl.style.height = display.h + 'px';
  }

  window.BiViNote.cropViewer = { open, close };
})();
