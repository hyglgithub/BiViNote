/**
 * BiViNote Capture Module
 * OffscreenCanvas 截图、保存文件、复制剪贴板
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  /**
   * 截取当前视频帧
   */
  async function captureFrame(video) {
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error('视频未加载，无法截取');
    }
    const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    return canvas.convertToBlob({ type: 'image/png' });
  }

  /**
   * 格式化时间码（用于文件名，无冒号）
   * 不足1小时：MMSS，超过1小时：HHMMSS
   */
  function formatTimeCode(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}${pad(m)}${pad(s)}` : `${pad(m)}${pad(s)}`;
  }

  /**
   * 格式化时间显示（带冒号）
   * 不足1小时：MM:SS，超过1小时：HH:MM:SS
   */
  function formatTimeDisplay(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  /**
   * 生成下载文件名：bivinote-{bvid}-{时间码}.png
   */
  function generateDownloadFilename(timeSeconds) {
    const s = window.BiViNote.state;
    const bvid = s.bvid || 'unknown';
    const tc = formatTimeCode(timeSeconds);
    return `bivinote-${bvid}-${tc}.png`;
  }

  /**
   * 生成 assets 文件名：{时间码}.png
   */
  function generateAssetFilename(timeSeconds) {
    return `${formatTimeCode(timeSeconds)}.png`;
  }

  /**
   * 给字幕行添加截图
   */
  async function addScreenshot(subtitleIndex) {
    const s = window.BiViNote.state;
    const panel = window.BiViNote.panel;
    const video = window.BiViNote.subtitle?.getVideoElement();

    if (!video) {
      panel.showToast('未找到视频元素');
      return;
    }

    const item = s.subtitleBody[subtitleIndex];
    if (!item) return;

    try {
      // 跳转到字幕时间点
      const wasPaused = video.paused;
      video.currentTime = item.from;
      await new Promise(r => video.addEventListener('seeked', r, { once: true }));

      // 截取当前帧
      const blob = await captureFrame(video);
      const url = URL.createObjectURL(blob);

      // 如果已有截图，释放旧的
      const old = s.screenshots.get(subtitleIndex);
      if (old?.url) URL.revokeObjectURL(old.url);

      s.screenshots.set(subtitleIndex, { blob, url, timeCode: formatTimeCode(item.from), timeSeconds: item.from });

      // 恢复播放状态
      if (!wasPaused) video.play().catch(() => {});

      // 重新渲染字幕列表
      window.BiViNote.subtitle.renderSubtitleList();
      panel.renderDoc();
      panel.showToast('已添加截屏');
    } catch (err) {
      console.error('[BiViNote] addScreenshot error:', err);
      panel.showToast('截屏失败：' + err.message);
    }
  }

  /**
   * 给章节添加截图
   */
  async function addChapterScreenshot(chapterIndex) {
    const s = window.BiViNote.state;
    const panel = window.BiViNote.panel;
    const video = window.BiViNote.subtitle?.getVideoElement();

    if (!video) {
      panel.showToast('未找到视频元素');
      return;
    }

    const item = s.chapters[chapterIndex];
    if (!item) return;

    try {
      const wasPaused = video.paused;
      video.currentTime = item.from;
      await new Promise(r => video.addEventListener('seeked', r, { once: true }));

      const blob = await captureFrame(video);
      const url = URL.createObjectURL(blob);

      // 章节截图用负索引存储，避免与字幕索引冲突
      const key = -chapterIndex - 1;
      const old = s.screenshots.get(key);
      if (old?.url) URL.revokeObjectURL(old.url);
      s.screenshots.set(key, { blob, url, timeCode: formatTimeCode(item.from), timeSeconds: item.from });

      if (!wasPaused) video.play().catch(() => {});
      window.BiViNote.chapter.render();
      panel.renderDoc();
      panel.showToast('已添加截屏');
    } catch (err) {
      console.error('[BiViNote] addChapterScreenshot error:', err);
      panel.showToast('截屏失败：' + err.message);
    }
  }

  /**
   * 取消字幕截图
   */
  function removeScreenshot(subtitleIndex) {
    const s = window.BiViNote.state;
    const old = s.screenshots.get(subtitleIndex);
    if (old?.url) URL.revokeObjectURL(old.url);
    s.screenshots.delete(subtitleIndex);
    window.BiViNote.subtitle.renderSubtitleList();
    window.BiViNote.panel.renderDoc();
    window.BiViNote.panel.showToast('已取消截屏');
  }

  /**
   * 保存截图到文件
   */
  async function saveToFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'bivinote-screenshot.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 延迟释放，确保下载完成
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /**
   * 复制截图到剪贴板
   */
  async function copyToClipboard(blob) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return true;
    } catch (err) {
      console.error('[BiViNote] clipboard write failed:', err);
      return false;
    }
  }

  window.BiViNote.capture = {
    captureFrame,
    addScreenshot,
    addChapterScreenshot,
    removeScreenshot,
    saveToFile,
    copyToClipboard,
    formatTimeCode,
    formatTimeDisplay,
    generateDownloadFilename,
    generateAssetFilename
  };
})();
