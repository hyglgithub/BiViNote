/**
 * BiViNote Crop Viewer Module
 * 截图浏览：裁剪、缩放、拖动、截图导航
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  let overlayEl = null;
  let canvasEl = null;
  let ctx = null;
  let cropFrameEl = null;
  let currentBlob = null;
  let currentUrl = null;
  let currentSnapKey = -1;
  let sidebarEl = null;
  let sidebarVisible = false;

  // 图片状态
  let img = null;
  let imgScale = 1;
  let imgX = 0;
  let imgY = 0;
  let isDraggingImg = false;
  let dragStartX = 0;
  let dragStartY = 0;

  // 裁剪状态
  let cropMode = false;
  let cropX = 0, cropY = 0, cropW = 0, cropH = 0;
  let cropRatio = 0;
  let isDraggingCrop = false;
  let cropDragType = '';
  let cropDragStartX = 0, cropDragStartY = 0;
  let cropStartRect = {};

  const MIN_CROP = 20;
  const SIDEBAR_WIDTH = 200;

  // ── 获取截图文本（字幕内容或章节标题）──

  function getSnapText(snapKey) {
    const s = window.BiViNote.state;
    if (snapKey >= 0) {
      const item = s.subtitleBody[snapKey];
      return item?.content || '';
    } else {
      const chapterIndex = -snapKey - 1;
      const item = s.chapters[chapterIndex];
      return item?.title || '';
    }
  }

  // ── 获取所有截图的有序列表 ──

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
    const list = getScreenshotList();
    return list.findIndex(item => item.key === currentSnapKey);
  }

  // ── 打开浏览 ──

  function open(snapKey) {
    const s = window.BiViNote.state;
    currentSnapKey = snapKey;

    const snap = s.screenshots.get(snapKey);
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
      <button class="bn-crop-nav-btn bn-crop-nav-prev" data-dir="prev" title="上一张截图">◀</button>
      <button class="bn-crop-nav-btn bn-crop-nav-next" data-dir="next" title="下一张截图">▶</button>
      <div class="bn-crop-sidebar" style="display:none;">
        <div class="bn-crop-sidebar-title">截图目录</div>
        <div class="bn-crop-sidebar-list"></div>
      </div>
      <div class="bn-crop-body">
        <div class="bn-crop-canvas-wrap">
          <canvas class="bn-crop-canvas"></canvas>
          <div class="bn-crop-frame" style="display:none;">
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
          <div class="bn-crop-btns-browse">
            <button data-act="catalog">目录</button>
            <button data-act="prev">上一帧</button>
            <button data-act="next">下一帧</button>
            <button data-act="crop">裁剪</button>
            <button data-act="download">下载</button>
            <button data-act="clipboard">复制</button>
          </div>
          <div class="bn-crop-btns-crop" style="display:none;">
            <select class="bn-crop-ratio">
              <option value="0">自由</option>
              <option value="1.7778">16:9</option>
              <option value="1.3333">4:3</option>
              <option value="1">1:1</option>
            </select>
            <button data-act="crop-done">完成</button>
            <button data-act="crop-cancel">取消</button>
          </div>
        </div>
      </div>
    `;

    canvasEl = overlayEl.querySelector('.bn-crop-canvas');
    ctx = canvasEl.getContext('2d');
    cropFrameEl = overlayEl.querySelector('.bn-crop-frame');
    sidebarEl = overlayEl.querySelector('.bn-crop-sidebar');

    // 事件绑定
    overlayEl.querySelector('.bn-crop-controls').addEventListener('click', onControlClick);
    overlayEl.querySelector('.bn-crop-close-btn').addEventListener('click', close);
    overlayEl.querySelector('.bn-crop-nav-prev').addEventListener('click', () => navigateTo(-1));
    overlayEl.querySelector('.bn-crop-nav-next').addEventListener('click', () => navigateTo(1));
    canvasEl.addEventListener('wheel', onWheel, { passive: false });
    canvasEl.addEventListener('mousedown', onCanvasMouseDown);
    document.addEventListener('mousemove', onDocMouseMove);
    document.addEventListener('mouseup', onDocMouseUp);
    document.addEventListener('keydown', onKeyDown);
    cropFrameEl.addEventListener('mousedown', onCropMouseDown);

    overlayEl.querySelector('.bn-crop-ratio').addEventListener('change', (e) => {
      cropRatio = parseFloat(e.target.value) || 0;
      if (cropRatio > 0 && cropMode) {
        applyCropRatio();
        renderCropFrame();
      }
    });

    document.body.appendChild(overlayEl);
    window.addEventListener('resize', onResize);
  }

  // ── 截图导航（不循环）──

  function navigateTo(direction) {
    const list = getScreenshotList();
    if (list.length < 2) return;

    const idx = getCurrentIndex();
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= list.length) return; // 边界停止

    switchToScreenshot(list[newIdx].key);
  }

  function switchToScreenshot(snapKey) {
    const s = window.BiViNote.state;
    const snap = s.screenshots.get(snapKey);
    if (!snap) return;

    if (cropMode) exitCropMode(false);

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

    if (sidebarVisible) {
      sidebarEl.style.display = '';
      overlayEl.querySelector('.bn-crop-body').style.marginLeft = SIDEBAR_WIDTH + 'px';
      renderSidebar();
    } else {
      sidebarEl.style.display = 'none';
      overlayEl.querySelector('.bn-crop-body').style.marginLeft = '0';
    }
    // 重新适应画布尺寸
    setTimeout(() => {
      if (img) { fitImageToCanvas(); render(); }
    }, 50);
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
      const timeCode = item.timeCode || '0000';
      div.innerHTML = `
        <img class="bn-crop-sidebar-thumb" src="${item.url}" alt="${timeCode}">
        <div class="bn-crop-sidebar-info">
          <div class="bn-crop-sidebar-time">${timeCode}</div>
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
    // 滚动到当前项
    const activeEl = sidebarEl.querySelector('.bn-crop-sidebar-active');
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── 加载图片 ──

  function loadImage(url) {
    img = new Image();
    img.onload = () => {
      fitImageToCanvas();
      render();
    };
    img.src = url;
  }

  function fitImageToCanvas() {
    if (!img || !canvasEl) return;
    const wrap = overlayEl.querySelector('.bn-crop-canvas-wrap');
    const wrapW = wrap.clientWidth;
    const wrapH = wrap.clientHeight;

    canvasEl.width = wrapW;
    canvasEl.height = wrapH;

    const scaleX = wrapW / img.width;
    const scaleY = wrapH / img.height;
    imgScale = Math.min(scaleX, scaleY, 1);
    imgX = (wrapW - img.width * imgScale) / 2;
    imgY = (wrapH - img.height * imgScale) / 2;
  }

  function render() {
    if (!ctx || !img) return;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.save();
    ctx.translate(imgX, imgY);
    ctx.scale(imgScale, imgScale);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  // ── 缩放 ──

  function onWheel(e) {
    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, imgScale * delta));

    imgX = mouseX - (mouseX - imgX) * (newScale / imgScale);
    imgY = mouseY - (mouseY - imgY) * (newScale / imgScale);
    imgScale = newScale;
    render();
  }

  // ── 拖动图片 ──

  function onCanvasMouseDown(e) {
    if (cropMode) return;
    isDraggingImg = true;
    dragStartX = e.clientX - imgX;
    dragStartY = e.clientY - imgY;
    canvasEl.style.cursor = 'grabbing';
  }

  function onDocMouseMove(e) {
    if (isDraggingImg) {
      imgX = e.clientX - dragStartX;
      imgY = e.clientY - dragStartY;
      render();
    }
    if (isDraggingCrop) {
      handleCropDrag(e);
    }
  }

  function onDocMouseUp() {
    isDraggingImg = false;
    isDraggingCrop = false;
    if (canvasEl) canvasEl.style.cursor = '';
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (cropMode) exitCropMode(false);
      else close();
    }
  }

  // ── 裁剪框 ──

  function enterCropMode() {
    cropMode = true;
    fitImageToCanvas();
    render();

    const imgRect = getImageDisplayRect();
    cropX = imgRect.x;
    cropY = imgRect.y;
    cropW = imgRect.w;
    cropH = imgRect.h;

    cropFrameEl.style.display = '';
    renderCropFrame();

    overlayEl.querySelector('.bn-crop-btns-browse').style.display = 'none';
    overlayEl.querySelector('.bn-crop-btns-crop').style.display = '';
    overlayEl.querySelector('.bn-crop-nav-prev').style.display = 'none';
    overlayEl.querySelector('.bn-crop-nav-next').style.display = 'none';
  }

  function exitCropMode(save) {
    if (save) applyCrop();
    cropMode = false;
    cropFrameEl.style.display = 'none';
    overlayEl.querySelector('.bn-crop-btns-browse').style.display = '';
    overlayEl.querySelector('.bn-crop-btns-crop').style.display = 'none';
    updateNavButtons();
  }

  function getImageDisplayRect() {
    return { x: imgX, y: imgY, w: img.width * imgScale, h: img.height * imgScale };
  }

  function renderCropFrame() {
    cropFrameEl.style.left = cropX + 'px';
    cropFrameEl.style.top = cropY + 'px';
    cropFrameEl.style.width = cropW + 'px';
    cropFrameEl.style.height = cropH + 'px';
  }

  function applyCropRatio() {
    if (cropRatio <= 0) return;
    const newH = cropW / cropRatio;
    const imgRect = getImageDisplayRect();
    cropH = Math.min(newH, imgRect.y + imgRect.h - cropY);
    cropW = cropH * cropRatio;
  }

  // ── 裁剪框拖动 ──

  function onCropMouseDown(e) {
    if (!cropMode) return;
    e.stopPropagation();
    const handle = e.target.dataset?.handle;
    cropDragType = handle || 'move';
    isDraggingCrop = true;
    cropDragStartX = e.clientX;
    cropDragStartY = e.clientY;
    cropStartRect = { x: cropX, y: cropY, w: cropW, h: cropH };
  }

  function handleCropDrag(e) {
    const dx = e.clientX - cropDragStartX;
    const dy = e.clientY - cropDragStartY;
    const imgRect = getImageDisplayRect();
    const minX = imgRect.x, minY = imgRect.y;
    const maxX = imgRect.x + imgRect.w, maxY = imgRect.y + imgRect.h;

    if (cropDragType === 'move') {
      cropX = clamp(cropStartRect.x + dx, minX, maxX - cropW);
      cropY = clamp(cropStartRect.y + dy, minY, maxY - cropH);
    } else {
      let newX = cropStartRect.x, newY = cropStartRect.y;
      let newW = cropStartRect.w, newY2 = cropStartRect.y + cropStartRect.h;
      let newX2 = cropStartRect.x + cropStartRect.w;

      if (cropDragType.includes('w')) {
        newX = clamp(cropStartRect.x + dx, minX, newX2 - MIN_CROP);
        newW = newX2 - newX;
      }
      if (cropDragType.includes('e')) {
        newX2 = clamp(cropStartRect.x + cropStartRect.w + dx, newX + MIN_CROP, maxX);
        newW = newX2 - newX;
      }
      if (cropDragType.includes('n')) {
        newY = clamp(cropStartRect.y + dy, minY, newY2 - MIN_CROP);
        var newH = newY2 - newY;
      }
      if (cropDragType.includes('s')) {
        newY2 = clamp(cropStartRect.y + cropStartRect.h + dy, newY + MIN_CROP, maxY);
        var newH = newY2 - newY;
      }

      if (cropRatio > 0) {
        if (cropDragType === 'se' || cropDragType === 'e' || cropDragType === 's') {
          newH = newW / cropRatio;
          if (newY + newH > maxY) { newH = maxY - newY; newW = newH * cropRatio; }
        } else if (cropDragType === 'nw' || cropDragType === 'w' || cropDragType === 'n') {
          const targetW = (cropStartRect.y + cropStartRect.h - newY) * cropRatio;
          newW = targetW; newX = newX2 - newW;
          if (newX < minX) { newX = minX; newW = newX2 - newX; }
          newH = newW / cropRatio; newY = newY2 - newH;
        }
      }

      cropX = newX;
      cropY = newY;
      cropW = Math.max(MIN_CROP, newW);
      cropH = Math.max(MIN_CROP, newH || cropH);
    }

    renderCropFrame();
  }

  // ── 裁剪应用 ──

  function applyCrop() {
    if (!img) return;
    const sx = Math.max(0, Math.round((cropX - imgX) / imgScale));
    const sy = Math.max(0, Math.round((cropY - imgY) / imgScale));
    const sw = Math.min(Math.round(cropW / imgScale), img.width - sx);
    const sh = Math.min(Math.round(cropH / imgScale), img.height - sy);

    if (sw <= 0 || sh <= 0) return;

    const offscreen = new OffscreenCanvas(sw, sh);
    offscreen.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    offscreen.convertToBlob({ type: 'image/png' }).then(blob => {
      const s = window.BiViNote.state;
      const old = s.screenshots.get(currentSnapKey);
      if (old?.url) URL.revokeObjectURL(old.url);

      const url = URL.createObjectURL(blob);
      s.screenshots.set(currentSnapKey, {
        blob, url,
        timeCode: old?.timeCode || '0000',
        timeSeconds: old?.timeSeconds || 0
      });

      currentBlob = blob;
      currentUrl = url;
      loadImage(url);

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
    const act = e.target.dataset?.act;
    if (!act) return;

    if (act === 'close') close();
    else if (act === 'prev') doFrameStep('prev');
    else if (act === 'next') doFrameStep('next');
    else if (act === 'crop') enterCropMode();
    else if (act === 'crop-done') exitCropMode(true);
    else if (act === 'crop-cancel') exitCropMode(false);
    else if (act === 'catalog') toggleSidebar();
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

  // ── 关闭 ──

  function close() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    window.removeEventListener('resize', onResize);
    document.removeEventListener('mousemove', onDocMouseMove);
    document.removeEventListener('mouseup', onDocMouseUp);
    document.removeEventListener('keydown', onKeyDown);
    cropMode = false;
    img = null;
    sidebarVisible = false;
  }

  // ── 窗口大小变化 ──

  function onResize() {
    if (!overlayEl || !img) return;
    fitImageToCanvas();
    render();
    if (cropMode) {
      const imgRect = getImageDisplayRect();
      cropX = clamp(cropX, imgRect.x, imgRect.x + imgRect.w - MIN_CROP);
      cropY = clamp(cropY, imgRect.y, imgRect.y + imgRect.h - MIN_CROP);
      cropW = Math.min(cropW, imgRect.x + imgRect.w - cropX);
      cropH = Math.min(cropH, imgRect.y + imgRect.h - cropY);
      renderCropFrame();
    }
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(val, max));
  }

  function escapeHtml(str) {
    return String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  window.BiViNote.cropViewer = { open, close };
})();
