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
  let cropHandleEl = null;

  // 图片状态
  let img = null;
  let imgX = 0, imgY = 0;     // 图片在 canvas 中的位置
  let imgW = 0, imgH = 0;     // 图片显示尺寸
  let scale = 1;               // 缩放比例
  let imgNatW = 0, imgNatH = 0; // 图片原始尺寸

  // 拖动状态
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let dragImgStartX = 0, dragImgStartY = 0;

  // 裁剪框状态 (相对于图片的归一化坐标 0-1)
  let cropNormX = 0, cropNormY = 0, cropNormW = 1, cropNormH = 1;
  let cropChanged = false;

  // 裁剪框拖拽
  let isCropDragging = false;
  let cropDragType = ''; // 'move','n','s','e','w','nw','ne','sw','se'
  let cropDragStartX = 0, cropDragStartY = 0;
  let cropStartNorm = {};

  // 关联回调
  let screenshotIndex = -1;
  let onCloseCallback = null;

  const HANDLE_SIZE = 10;
  const MIN_CROP = 0.02; // 最小裁剪比例

  // ── 打开浏览面板 ──

  function open(index, onClose) {
    const s = window.BiViNote.state;
    const snap = s.screenshots.get(index);
    if (!snap) return;

    screenshotIndex = index;
    onCloseCallback = onClose;
    cropChanged = false;

    // 加载图片
    img = new Image();
    img.onload = () => {
      imgNatW = img.naturalWidth;
      imgNatH = img.naturalHeight;
      scale = 1;
      cropNormX = 0; cropNormY = 0; cropNormW = 1; cropNormH = 1;

      createOverlay();
      fitImageToCanvas();
      render();
    };
    img.src = snap.url;
  }

  // ── 创建 DOM ──

  function createOverlay() {
    overlayEl = document.createElement('div');
    overlayEl.className = 'bn-crop-overlay';
    overlayEl.setAttribute('data-bn-theme', window.BiViNote.state.settings.darkMode ? 'dark' : '');

    overlayEl.innerHTML = `
      <div class="bn-crop-container">
        <canvas class="bn-crop-canvas"></canvas>
        <div class="bn-crop-handle"></div>
        <div class="bn-crop-btns">
          <button data-act="download">下载</button>
          <button data-act="clipboard">复制到剪贴板</button>
          <button data-act="close">关闭</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlayEl);

    canvasEl = overlayEl.querySelector('.bn-crop-canvas');
    ctx = canvasEl.getContext('2d');
    cropHandleEl = overlayEl.querySelector('.bn-crop-handle');

    // 事件绑定
    canvasEl.addEventListener('wheel', onWheel, { passive: false });
    canvasEl.addEventListener('mousedown', onCanvasMouseDown);
    cropHandleEl.addEventListener('mousedown', onCropMouseDown);
    overlayEl.querySelector('.bn-crop-btns').addEventListener('click', onBtnClick);

    document.addEventListener('mousemove', onDocMouseMove);
    document.addEventListener('mouseup', onDocMouseUp);

    resizeCanvas();
  }

  // ── 销毁 ──

  function destroy() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    canvasEl = null;
    ctx = null;
    cropHandleEl = null;
    img = null;
    document.removeEventListener('mousemove', onDocMouseMove);
    document.removeEventListener('mouseup', onDocMouseUp);
  }

  // ── 适配图片到画布 ──

  function fitImageToCanvas() {
    if (!canvasEl || !imgNatW) return;
    const cw = canvasEl.width;
    const ch = canvasEl.height;
    const ratio = Math.min(cw / imgNatW, ch / imgNatH, 1);
    scale = ratio;
    imgW = imgNatW * ratio;
    imgH = imgNatH * ratio;
    imgX = (cw - imgW) / 2;
    imgY = (ch - imgH) / 2;
  }

  // ── 调整画布尺寸 ──

  function resizeCanvas() {
    if (!canvasEl || !overlayEl) return;
    const container = overlayEl.querySelector('.bn-crop-container');
    const rect = container.getBoundingClientRect();
    canvasEl.width = rect.width;
    canvasEl.height = rect.height - 50; // 减去按钮区域
  }

  // ── 渲染 ──

  function render() {
    if (!ctx || !img) return;
    const cw = canvasEl.width;
    const ch = canvasEl.height;

    // 清空
    ctx.clearRect(0, 0, cw, ch);

    // 绘制半透明背景
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, cw, ch);

    // 绘制图片区域（亮）
    ctx.save();
    ctx.beginPath();
    ctx.rect(imgX, imgY, imgW, imgH);
    ctx.clip();
    ctx.drawImage(img, imgX, imgY, imgW, imgH);
    ctx.restore();

    // 绘制裁剪框外的半透明遮罩
    const cx = imgX + cropNormX * imgW;
    const cy = imgY + cropNormY * imgH;
    const cw2 = cropNormW * imgW;
    const ch2 = cropNormH * imgH;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    // 上
    ctx.fillRect(imgX, imgY, imgW, cy - imgY);
    // 下
    ctx.fillRect(imgX, cy + ch2, imgW, imgY + imgH - cy - ch2);
    // 左
    ctx.fillRect(imgX, cy, cx - imgX, ch2);
    // 右
    ctx.fillRect(cx + cw2, cy, imgX + imgW - cx - cw2, ch2);
    ctx.restore();

    // 绘制裁剪框边框
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw2, ch2);

    // 绘制裁剪框手柄
    drawHandle(cx, cy);
    drawHandle(cx + cw2 / 2, cy);
    drawHandle(cx + cw2, cy);
    drawHandle(cx, cy + ch2 / 2);
    drawHandle(cx + cw2, cy + ch2 / 2);
    drawHandle(cx, cy + ch2);
    drawHandle(cx + cw2 / 2, cy + ch2);
    drawHandle(cx + cw2, cy + ch2);

    // 更新裁剪框 DOM
    updateCropHandle();
  }

  function drawHandle(x, y) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    const hs = HANDLE_SIZE / 2;
    ctx.fillRect(x - hs, y - hs, HANDLE_SIZE, HANDLE_SIZE);
    ctx.strokeRect(x - hs, y - hs, HANDLE_SIZE, HANDLE_SIZE);
  }

  // ── 更新裁剪框 DOM 位置 ──

  function updateCropHandle() {
    if (!cropHandleEl) return;
    const cx = imgX + cropNormX * imgW;
    const cy = imgY + cropNormY * imgH;
    const cw = cropNormW * imgW;
    const ch = cropNormH * imgH;
    cropHandleEl.style.left = cx + 'px';
    cropHandleEl.style.top = cy + 'px';
    cropHandleEl.style.width = cw + 'px';
    cropHandleEl.style.height = ch + 'px';
  }

  // ── 滚轮缩放 ──

  function onWheel(e) {
    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, scale * delta));

    // 以鼠标为中心缩放
    const ratio = newScale / scale;
    imgX = mx - (mx - imgX) * ratio;
    imgY = my - (my - imgY) * ratio;
    imgW *= ratio;
    imgH *= ratio;
    scale = newScale;

    render();
  }

  // ── Canvas 拖动（平移图片） ──

  function onCanvasMouseDown(e) {
    if (e.target !== canvasEl) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragImgStartX = imgX;
    dragImgStartY = imgY;
    e.preventDefault();
  }

  // ── 裁剪框拖拽 ──

  function onCropMouseDown(e) {
    e.stopPropagation();
    e.preventDefault();

    const rect = canvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const cx = imgX + cropNormX * imgW;
    const cy = imgY + cropNormY * imgH;
    const cw = cropNormW * imgW;
    const ch = cropNormH * imgH;

    // 判断点击在哪个区域
    const hs = HANDLE_SIZE;
    const onLeft = Math.abs(mx - cx) < hs;
    const onRight = Math.abs(mx - (cx + cw)) < hs;
    const onTop = Math.abs(my - cy) < hs;
    const onBottom = Math.abs(my - (cy + ch)) < hs;

    if (onTop && onLeft) cropDragType = 'nw';
    else if (onTop && onRight) cropDragType = 'ne';
    else if (onBottom && onLeft) cropDragType = 'sw';
    else if (onBottom && onRight) cropDragType = 'se';
    else if (onTop) cropDragType = 'n';
    else if (onBottom) cropDragType = 's';
    else if (onLeft) cropDragType = 'w';
    else if (onRight) cropDragType = 'e';
    else cropDragType = 'move';

    isCropDragging = true;
    cropDragStartX = mx;
    cropDragStartY = my;
    cropStartNorm = { x: cropNormX, y: cropNormY, w: cropNormW, h: cropNormH };
    cropChanged = true;
  }

  // ── 全局鼠标移动 ──

  function onDocMouseMove(e) {
    if (isDragging) {
      imgX = dragImgStartX + (e.clientX - dragStartX);
      imgY = dragImgStartY + (e.clientY - dragStartY);
      render();
      return;
    }

    if (isCropDragging) {
      const rect = canvasEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dx = (mx - cropDragStartX) / imgW;
      const dy = (my - cropDragStartY) / imgH;

      const s = cropStartNorm;

      if (cropDragType === 'move') {
        cropNormX = clamp(s.x + dx, 0, 1 - s.w);
        cropNormY = clamp(s.y + dy, 0, 1 - s.h);
      } else {
        let nx = s.x, ny = s.y, nw = s.w, nh = s.h;

        if (cropDragType.includes('w')) {
          nx = clamp(s.x + dx, 0, s.x + s.w - MIN_CROP);
          nw = s.w - (nx - s.x);
        }
        if (cropDragType.includes('e')) {
          nw = clamp(s.w + dx, MIN_CROP, 1 - s.x);
        }
        if (cropDragType.includes('n')) {
          ny = clamp(s.y + dy, 0, s.y + s.h - MIN_CROP);
          nh = s.h - (ny - s.y);
        }
        if (cropDragType.includes('s')) {
          nh = clamp(s.h + dy, MIN_CROP, 1 - s.y);
        }

        cropNormX = nx; cropNormY = ny; cropNormW = nw; cropNormH = nh;
      }

      render();
    }
  }

  // ── 全局鼠标释放 ──

  function onDocMouseUp() {
    isDragging = false;
    isCropDragging = false;
  }

  // ── 按钮点击 ──

  async function onBtnClick(e) {
    const act = e.target.dataset?.act;
    if (!act) return;

    if (act === 'close') {
      await handleClose();
    } else if (act === 'download') {
      const blob = await cropImage();
      const s = window.BiViNote.state;
      const bvid = s.bvid || 'video';
      const snap = s.screenshots.get(screenshotIndex);
      const ts = snap?.timestamp || '0000';
      window.BiViNote.capture.saveToFile(blob, `bivinote-${bvid}-${ts}.png`);
      window.BiViNote.panel.showToast('截图已保存');
    } else if (act === 'clipboard') {
      const blob = await cropImage();
      const ok = await window.BiViNote.capture.copyToClipboard(blob);
      window.BiViNote.panel.showToast(ok ? '已复制到剪贴板' : '复制失败');
    }
  }

  // ── 关闭处理 ──

  async function handleClose() {
    if (cropChanged) {
      // 裁剪并替换截图
      const blob = await cropImage();
      const url = URL.createObjectURL(blob);
      const s = window.BiViNote.state;
      const old = s.screenshots.get(screenshotIndex);
      if (old?.url) URL.revokeObjectURL(old.url);
      const ts = old?.timestamp || window.BiViNote.capture.formatTimestamp(0);
      s.screenshots.set(screenshotIndex, { blob, url, timestamp: ts });

      // 刷新 UI
      if (window.BiViNote.subtitle) window.BiViNote.subtitle.renderSubtitleList();
      window.BiViNote.panel.renderPrompt();
      window.BiViNote.panel.showToast('截图已裁剪');
    }

    destroy();
    if (onCloseCallback) onCloseCallback();
  }

  // ── 裁剪图片 ──

  async function cropImage() {
    const sx = cropNormX * imgNatW;
    const sy = cropNormY * imgNatH;
    const sw = cropNormW * imgNatW;
    const sh = cropNormH * imgNatH;

    const canvas = new OffscreenCanvas(Math.round(sw), Math.round(sh));
    const ctx2 = canvas.getContext('2d');
    ctx2.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.convertToBlob({ type: 'image/png' });
  }

  // ── 工具 ──

  function clamp(val, min, max) {
    return Math.max(min, Math.min(val, max));
  }

  window.BiViNote.cropViewer = {
    open
  };
})();
