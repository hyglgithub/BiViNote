/**
 * BiViNote Video Info Module
 * 视频信息获取与展示
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  function render() {
    const s = window.BiViNote.state;
    const container = document.getElementById('bn-video-info');
    if (!container) return;

    const video = window.BiViNote.subtitle?.getVideoElement();
    const duration = video?.duration || s.videoDuration || 0;

    const items = [
      { key: 'title', label: '标题', value: s.title || '-' },
      { key: 'author', label: '作者', value: s.author || '-' },
      { key: 'date', label: '日期', value: s.uploadDate || '-' },
      { key: 'duration', label: '时长', value: formatDuration(duration) },
      { key: 'url', label: '网络地址', value: location.href },
      { key: 'description', label: '简介', value: s.description || '-' }
    ];

    container.innerHTML = items.map(item => {
      const checked = s.videoInfoChecked[item.key] ? 'checked' : '';
      return `<div class="bn-info-item">
        <input type="checkbox" data-key="${item.key}" ${checked}>
        <span><strong>${item.label}：</strong>${escapeHtml(item.value)}</span>
      </div>`;
    }).join('');

    // 绑定复选框事件
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        s.videoInfoChecked[cb.dataset.key] = cb.checked;
      });
    });
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
