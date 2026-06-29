/**
 * BiViNote Crop Viewer Module
 * 截图浏览：裁剪、缩放、拖动
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
  let currentIndex = -1;
  let isChapter = false;

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
  let cropX = 0;
  let cropY = 0;
  let cropW = 0;
  let cropH = 0;
  let cropRatio = 0; // 0 = 自由
  let isDraggingCrop = false;
  let cropDragType = ''; // 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
  let cropDragStartX = 0;
  let cropDragStartY = 0;
  let cropStartRect = {};

  const MIN_CROP = 20;

  // ── 打开浏览 ──

  function open(index, chapter = false) {
    const s = window.BiViNote.state;
    isChapter = chapter;
    currentIndex = index;

    const snapKey = chapter ? (-index - 1) : index;
    const snap = s.screenshots.get(snapKey);
    if (!snap) return;

    currentBlob = snap.blob;
    currentUrl = snap.url;

    createOverlay();
    loadImage(snap.url);
  }

  // ── 创建 DOM ──

  let cropOverlayEl = null; // 裁剪模式交互层

  function createOverlay() {
    if (overlayEl) overlayEl.remove();

    overlayEl = document.createElement('div');
    overlayEl.className = 'bn-crop-overlay';
    overlayEl.setAttribute('data-bn-theme', window.BiViNote.state.settings.darkMode ? 'dark' : '');

    overlayEl.innerHTML = `
      <div class="bn-crop-canvas-wrap">
        <canvas class="bn-crop-canvas"></canvas>
        <div class="bn-crop-interaction" style="display:none;"></div>
        <div class="bn-crop-frame" style="display:none;">
          <div class="bn-crop-handle" data-handle="nw" style="top:-5px;left:-5px;cursor:nw-resize;"></div>
          <div class="bn-crop-handle" data-handle="ne" style="top:-5px;right:-5px;cursor:ne-resize;"></div>
          <div class="bn-crop-handle" data-handle="sw" style="bottom:-5px;left:-5px;cursor:sw-resize;"></div>
          <div class="bn-crop-handle" data-handle="se" style="bottom:-5px;right:-5px;cursor:se-resize;"></div>
          <div class="bn-crop-handle" data-handle="n" style="top:-5px;left:50%;margin-left:-5px;cursor:n-resize;"></div>
          <div class="bn-crop-handle" data-handle="s" style="bottom:-5px;left:50%;margin-left:-5px;cursor:s-resize;"></div>
          <div class="bn-crop-handle" data-handle="e" style="top:50%;right:-5px;margin-top:-5px;cursor:e-resize;"></div>
          <div class="bn-crop-handle" data-handle="w" style="top:50%;left:-5px;margin-top:-5px;cursor:w-resize;"></div>
        </div>
      </div>
      <div class="bn-crop-controls">
        <div class="bn-crop-btns-browse">
          <button data-act="prev">上一帧</button>
          <button data-act="next">下一帧</button>
          <button data-act="crop">裁剪</button>
          <button data-act="download">下载</button>
          <button data-act="clipboard">复制</button>
          <button data-act="close">关闭</button>
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
    `;

    canvasEl = overlayEl.querySelector('.bn-crop-canvas');
    ctx = canvasEl.getContext('2d');
    cropFrameEl = overlayEl.querySelector('.bn-crop-frame');
    cropOverlayEl = overlayEl.querySelector('.bn-crop-interaction');

    // 浏览模式事件（canvas）
    canvasEl.addEventListener('wheel', onWheel, { passive: false });
    canvasEl.addEventListener('mousedown', onCanvasMouseDown);

    // 裁剪模式事件（interaction 层）
    cropOverlayEl.addEventListener('mousedown', onInteractionMouseDown);
    cropOverlayEl.addEventListener('wheel', onWheel, { passive: false });

    // 全局事件
    document.addEventListener('mousemove', onDocMouseMove);
    document.addEventListener('mouseup', onDocMouseUp);
    overlayEl.querySelector('.bn-crop-controls').addEventListener('click', onControlClick);

    // 裁剪比例
    overlayEl.querySelector('.bn-crop-ratio').addEventListener('change', (e) => {
      cropRatio = parseFloat(e.target.value) || 0;
      if (cropRatio > 0 && cropMode) {
        applyCropRatio();
        renderCropFrame();
      }
    });

    document.body.appendChild(overlayEl);

    // 窗口大小变化时重新渲染
    window.addEventListener('resize', onResize);
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

  // ── 渲染 ──

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

    // 以鼠标位置为中心缩放
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

  let rafId = 0;

  function onDocMouseMove(e) {
    if (isDraggingImg) {
      imgX = e.clientX - dragStartX;
      imgY = e.clientY - dragStartY;
      render();
    }
    if (isDraggingCrop) {
      // 节流：用 requestAnimationFrame 避免卡顿
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        handleCropDrag(e);
      });
    }
  }

  function onDocMouseUp() {
    isDraggingImg = false;
    isDraggingCrop = false;
    if (canvasEl) canvasEl.style.cursor = '';
  }

  // ── 裁剪框 ──

  function enterCropMode() {
    cropMode = true;
    const imgRect = getImageDisplayRect();
    cropX = imgRect.x;
    cropY = imgRect.y;
    cropW = imgRect.w;
    cropH = imgRect.h;

    cropFrameEl.style.display = '';
    cropOverlayEl.style.display = '';
    canvasEl.style.pointerEvents = 'none';
    renderCropFrame();

    overlayEl.querySelector('.bn-crop-btns-browse').style.display = 'none';
    overlayEl.querySelector('.bn-crop-btns-crop').style.display = '';
  }

  function exitCropMode(save) {
    if (save) applyCrop();
    cropMode = false;
    cropFrameEl.style.display = 'none';
    cropOverlayEl.style.display = 'none';
    canvasEl.style.pointerEvents = '';
    overlayEl.querySelector('.bn-crop-btns-browse').style.display = '';
    overlayEl.querySelector('.bn-crop-btns-crop').style.display = 'none';
  }

  function getImageDisplayRect() {
    return {
      x: imgX,
      y: imgY,
      w: img.width * imgScale,
      h: img.height * imgScale
    };
  }

  function renderCropFrame() {
    cropFrameEl.style.left = cropX + 'px';
    cropFrameEl.style.top = cropY + 'px';
    cropFrameEl.style.width = cropW + 'px';
    cropFrameEl.style.height = cropH + 'px';
  }

  function applyCropRatio() {
    if (cropRatio <= 0) return;
    // 保持宽度，调整高度
    const newH = cropW / cropRatio;
    const imgRect = getImageDisplayRect();
    cropH = Math.min(newH, imgRect.y + imgRect.h - cropY);
    cropW = cropH * cropRatio;
  }

  // ── 裁剪模式交互层事件 ──

  function onInteractionMouseDown(e) {
    if (!cropMode) return;
    e.preventDefault();

    const handle = e.target.dataset?.handle;
    if (handle) {
      // 点击在手柄上
      cropDragType = handle;
    } else {
      // 判断是否在裁剪框内部
      const rect = cropFrameEl.getBoundingClientRect();
      const inFrame = e.clientX >= rect.left && e.clientX <= rect.right &&
                      e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (inFrame) {
        cropDragType = 'move';
      } else {
        return; // 点击在裁剪框外部，忽略
      }
    }

    isDraggingCrop = true;
    cropDragStartX = e.clientX;
    cropDragStartY = e.clientY;
    cropStartRect = { x: cropX, y: cropY, w: cropW, h: cropH };
  }

  function handleCropDrag(e) {
    const dx = e.clientX - cropDragStartX;
    const dy = e.clientY - cropDragStartY;
    const imgRect = getImageDisplayRect();
    const minX = imgRect.x;
    const minY = imgRect.y;
    const maxX = imgRect.x + imgRect.w;
    const maxY = imgRect.y + imgRect.h;

    if (cropDragType === 'move') {
      cropX = clamp(cropStartRect.x + dx, minX, maxX - cropW);
      cropY = clamp(cropStartRect.y + dy, minY, maxY - cropH);
    } else {
      let left = cropStartRect.x;
      let top = cropStartRect.y;
      let right = cropStartRect.x + cropStartRect.w;
      let bottom = cropStartRect.y + cropStartRect.h;

      if (cropDragType.includes('w')) left = clamp(cropStartRect.x + dx, minX, right - MIN_CROP);
      if (cropDragType.includes('e')) right = clamp(cropStartRect.x + cropStartRect.w + dx, left + MIN_CROP, maxX);
      if (cropDragType.includes('n')) top = clamp(cropStartRect.y + dy, minY, bottom - MIN_CROP);
      if (cropDragType.includes('s')) bottom = clamp(cropStartRect.y + cropStartRect.h + dy, top + MIN_CROP, maxY);

      let newW = right - left;
      let newH = bottom - top;

      // 裁剪比例约束
      if (cropRatio > 0) {
        if (cropDragType === 'se' || cropDragType === 'e' || cropDragType === 's') {
          newH = newW / cropRatio;
          if (top + newH > maxY) {
            newH = maxY - top;
            newW = newH * cropRatio;
          }
          bottom = top + newH;
          right = left + newW;
        } else if (cropDragType === 'nw' || cropDragType === 'w' || cropDragType === 'n') {
          newW = newH * cropRatio;
          left = right - newW;
          if (left < minX) {
            left = minX;
            newW = right - left;
            newH = newW / cropRatio;
            top = bottom - newH;
          }
        }
      }

      cropX = left;
      cropY = top;
      cropW = Math.max(MIN_CROP, newW);
      cropH = Math.max(MIN_CROP, newH);
    }

    renderCropFrame();
  }

  // ── 裁剪应用 ──

  function applyCrop() {
    if (!img) return;
    // 将裁剪框坐标转换为原图像素坐标
    const sx = (cropX - imgX) / imgScale;
    const sy = (cropY - imgY) / imgScale;
    const sw = cropW / imgScale;
    const sh = cropH / imgScale;

    const clampedSx = Math.max(0, Math.round(sx));
    const clampedSy = Math.max(0, Math.round(sy));
    const clampedSw = Math.min(Math.round(sw), img.width - clampedSx);
    const clampedSh = Math.min(Math.round(sh), img.height - clampedSy);

    if (clampedSw <= 0 || clampedSh <= 0) return;

    const offscreen = new OffscreenCanvas(clampedSw, clampedSh);
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(img, clampedSx, clampedSy, clampedSw, clampedSh, 0, 0, clampedSw, clampedSh);

    offscreen.convertToBlob({ type: 'image/png' }).then(blob => {
      // 替换截图
      const s = window.BiViNote.state;
      const snapKey = isChapter ? (-currentIndex - 1) : currentIndex;
      const old = s.screenshots.get(snapKey);
      if (old?.url) URL.revokeObjectURL(old.url);

      const url = URL.createObjectURL(blob);
      const timeCode = old?.timeCode || '0000';
      const timeSeconds = old?.timeSeconds || 0;
      s.screenshots.set(snapKey, { blob, url, timeCode, timeSeconds });

      // 更新浏览
      currentBlob = blob;
      currentUrl = url;
      loadImage(url);

      // 重新渲染列表
      if (isChapter) {
        window.BiViNote.chapter.render();
      } else {
        window.BiViNote.subtitle.renderSubtitleList();
      }
      window.BiViNote.panel.renderPrompt();
      window.BiViNote.panel.showToast('裁剪完成');
    });
  }

  // ── 帧步进 ──

  async function doFrameStep(direction) {
    const video = window.BiViNote.subtitle?.getVideoElement();
    if (!video) return;

    const step = window.BiViNote.state.settings.frameStep || 0.2;
    if (direction === 'prev') {
      video.currentTime = Math.max(0, video.currentTime - step);
    } else {
      video.currentTime = Math.min(video.duration, video.currentTime + step);
    }
    await new Promise(r => video.addEventListener('seeked', r, { once: true }));

    const newBlob = await window.BiViNote.capture.captureFrame(video);
    const newUrl = URL.createObjectURL(newBlob);

    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentBlob = newBlob;
    currentUrl = newUrl;
    loadImage(newUrl);

    // 更新截图数据
    const s = window.BiViNote.state;
    const snapKey = isChapter ? (-currentIndex - 1) : currentIndex;
    const old = s.screenshots.get(snapKey);
    s.screenshots.set(snapKey, {
      blob: newBlob,
      url: newUrl,
      timeCode: old?.timeCode || window.BiViNote.capture.formatTimeCode(video.currentTime),
      timeSeconds: video.currentTime
    });
  }

  // ── 按钮事件 ──

  function onControlClick(e) {
    const act = e.target.dataset?.act;
    if (!act) return;

    if (act === 'close') {
      close();
    } else if (act === 'prev') {
      doFrameStep('prev');
    } else if (act === 'next') {
      doFrameStep('next');
    } else if (act === 'crop') {
      enterCropMode();
    } else if (act === 'crop-done') {
      exitCropMode(true);
    } else if (act === 'crop-cancel') {
      exitCropMode(false);
    } else if (act === 'download') {
      const video = window.BiViNote.subtitle?.getVideoElement();
      const ts = video ? video.currentTime : 0;
      window.BiViNote.capture.saveToFile(currentBlob, window.BiViNote.capture.generateDownloadFilename(ts));
      window.BiViNote.panel.showToast('截图已保存');
    } else if (act === 'clipboard') {
      window.BiViNote.capture.copyToClipboard(currentBlob).then(ok => {
        window.BiViNote.panel.showToast(ok ? '已复制到剪贴板' : '复制失败');
      });
    }
  }

  // ── 关闭 ──

  function close() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    window.removeEventListener('resize', onResize);
    document.removeEventListener('mousemove', onDocMouseMove);
    document.removeEventListener('mouseup', onDocMouseUp);
    cropMode = false;
    img = null;
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

  // ── 工具 ──

  function clamp(val, min, max) {
    return Math.max(min, Math.min(val, max));
  }

  window.BiViNote.cropViewer = {
    open,
    close
  };
})();
