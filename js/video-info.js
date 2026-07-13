/**
 * BiViNote Video Info Module
 * 视频信息获取与展示
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  let infoListenerAttached = false;

  function render() {
    const s = window.BiViNote.state;
    const container = document.getElementById('bn-video-info');
    if (!container) return;

    container.innerHTML = '';

    // 只绑定一次事件委托
    if (!infoListenerAttached) {
      container.addEventListener('click', onInfoClick);
      infoListenerAttached = true;
    }

    const video = window.BiViNote.subtitle?.getVideoElement();
    const duration = video?.duration || s.videoDuration || 0;

    const items = [
      { key: 'title', label: '标题', value: s.title || '-' },
      { key: 'author', label: '作者', value: s.author || '-' },
      { key: 'date', label: '日期', value: s.uploadDate || '-' },
      { key: 'duration', label: '时长', value: formatDuration(duration) },
      { key: 'url', label: '地址', value: cleanVideoUrl().replace(/\/$/, '') },
      { key: 'description', label: '简介', value: s.description || '-' }
    ];

    container.innerHTML = items.map(item => {
      const checked = s.videoInfoChecked[item.key] ? 'checked' : '';
      const displayValue = escapeHtml(item.value).replace(/\n/g, '<br>');
      return `<div class="bn-info-item" data-copy="${escapeHtml(item.value)}">
        <input type="checkbox" data-key="${item.key}" ${checked}>
        <span><strong>${item.label}：</strong>${displayValue}</span>
        <div class="bn-btns"><button data-action="copy">复制</button></div>
      </div>`;
    }).join('') + `
      <div class="bn-info-item">
        <input type="checkbox" data-key="chapterTimestamp" ${s.videoInfoChecked.chapterTimestamp ? 'checked' : ''}>
        <span><strong>章节时间戳</strong></span>
      </div>
      <div class="bn-info-item">
        <input type="checkbox" data-key="subtitleTimestamp" ${s.videoInfoChecked.subtitleTimestamp ? 'checked' : ''}>
        <span><strong>字幕时间戳</strong></span>
      </div>
    `;

    // 绑定复选框事件
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        s.videoInfoChecked[cb.dataset.key] = cb.checked;
        window.BiViNote.settings.save();
      });
    });

    // 底部说明文字
    const footer = document.createElement('div');
    footer.className = 'bn-video-info-footer';
    footer.textContent = '勾选的内容将出现在导出的 Markdown 文件中';
    container.appendChild(footer);
  }

  function onInfoClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.dataset.action !== 'copy') return;
    const row = btn.closest('.bn-info-item');
    if (!row) return;
    const text = row.dataset.copy || '';
    navigator.clipboard.writeText(text).then(() => {
      window.BiViNote.panel.showToast('已复制');
    });
  }

  function cleanVideoUrl() {
    const match = location.href.match(/(https?:\/\/www\.bilibili\.com\/video\/BV[\w]+\/?)/);
    return match ? match[1] : location.href;
  }

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '-';
    const safe = Math.floor(seconds);
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

  window.BiViNote.videoInfo = {
    render,
    formatDuration
  };
})();
