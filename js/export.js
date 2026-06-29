/**
 * BiViNote Export Module
 * 导出功能（SRT、Markdown、ZIP）
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  // ── SRT 导出 ──

  function buildSrt(body) {
    return body.map((item, i) => {
      const from = formatSrtTime(item.from);
      const to = formatSrtTime(item.to || item.from + 2);
      const text = String(item.content || '').trim();
      return `${i + 1}\n${from} --> ${to}\n${text}`;
    }).join('\n\n');
  }

  function formatSrtTime(seconds) {
    const msTotal = Math.max(0, Math.floor((seconds || 0) * 1000));
    const h = Math.floor(msTotal / 3600000);
    const m = Math.floor((msTotal % 3600000) / 60000);
    const s = Math.floor((msTotal % 60000) / 1000);
    const ms = msTotal % 1000;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(ms).padStart(3, '0')}`;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function downloadSrt() {
    const s = window.BiViNote.state;
    const panel = window.BiViNote.panel;

    if (!s.subtitleBody || s.subtitleBody.length === 0) {
      panel.showToast('没有可导出的字幕');
      return;
    }

    const content = buildSrt(s.subtitleBody);
    const filename = `${sanitize(s.title || 'subtitle')}.srt`;
    downloadText(content, filename, 'text/plain;charset=utf-8');
    panel.showToast('已导出 SRT');
  }

  // ── Markdown 导出 ──

  function buildMarkdown(state) {
    const s = state;
    const lines = [];

    // Frontmatter
    const frontLines = [];
    if (s.videoInfoChecked.title) frontLines.push(`title: "${yamlEscape(s.title)}"`);
    if (s.videoInfoChecked.author) frontLines.push(`author: "${yamlEscape(s.author)}"`);
    if (s.videoInfoChecked.date) frontLines.push(`date: "${yamlEscape(s.uploadDate)}"`);
    if (s.videoInfoChecked.url) {
      const cleanUrl = location.href.match(/(https?:\/\/www\.bilibili\.com\/video\/BV[\w]+\/?)/);
      const url = (cleanUrl ? cleanUrl[1] : location.href).replace(/\/$/, '');
      frontLines.push(`url: "${yamlEscape(url)}"`);
    }
    if (s.videoInfoChecked.duration) {
      const video = window.BiViNote.subtitle?.getVideoElement();
      const dur = video?.duration || s.videoDuration || 0;
      frontLines.push(`duration: "${formatDuration(dur)}"`);
    }
    if (s.videoInfoChecked.description) frontLines.push(`description: "${yamlEscape(s.description)}"`);

    if (frontLines.length > 0) {
      lines.push('---');
      lines.push(...frontLines);
      lines.push('---');
      lines.push('');
    }

    // 标题
    if (s.title) {
      lines.push(`# ${s.title}`, '');
    }

    // 章节
    const chapters = s.chapters || [];
    const chTs = s.videoInfoChecked.chapterTimestamp;
    if (chapters.length > 0) {
      lines.push('## 章节', '');
      chapters.forEach((ch, idx) => {
        const snapKey = -idx - 1;
        const snap = s.screenshots.get(snapKey);
        const prefix = chTs ? `- \`${formatCompactTime(ch.from)}\` ` : '- ';
        lines.push(`${prefix}${ch.title}`);
        if (snap) {
          lines.push(`  ![章节截图](assets/chapter-${idx + 1}.png)`);
        }
      });
      lines.push('');
    }

    // 字幕
    const body = s.subtitleBody || [];
    const subTs = s.videoInfoChecked.subtitleTimestamp;
    if (body.length > 0) {
      lines.push('## 字幕', '');

      if (chapters.length > 0) {
        // 按章节分段
        const usedIndexes = new Set();
        chapters.forEach((ch, idx) => {
          const start = ch.from;
          const next = chapters[idx + 1];
          const end = next ? next.from : Infinity;

          const sectionEntries = [];
          body.forEach((item, i) => {
            if (item.from >= start && item.from < end) {
              sectionEntries.push({ item, index: i });
              usedIndexes.add(i);
            }
          });

          if (sectionEntries.length === 0) return;

          lines.push(`### ${ch.title}`, '');
          sectionEntries.forEach(({ item, index }) => {
            const snap = s.screenshots.get(index);
            const prefix = subTs ? `\`${formatCompactTime(item.from)}\` ` : '';
            lines.push(`${prefix}${item.content}`);
            if (snap) {
              lines.push(`![截图](assets/${index + 1}.png)`);
            }
          });
          lines.push('');
        });

        // 剩余不属于任何章节的字幕
        const remaining = body.filter((_, i) => !usedIndexes.has(i));
        if (remaining.length > 0) {
          lines.push('### 其他片段', '');
          remaining.forEach((item) => {
            const index = body.indexOf(item);
            const snap = s.screenshots.get(index);
            const prefix = subTs ? `\`${formatCompactTime(item.from)}\` ` : '';
            lines.push(`${prefix}${item.content}`);
            if (snap) {
              lines.push(`![截图](assets/${index + 1}.png)`);
            }
          });
          lines.push('');
        }
      } else {
        // 无章节，直接列出
        body.forEach((item, i) => {
          const snap = s.screenshots.get(i);
          const prefix = subTs ? `\`${formatCompactTime(item.from)}\` ` : '';
          lines.push(`${prefix}${item.content}`);
          if (snap) {
            lines.push(`![截图](assets/${i + 1}.png)`);
          }
        });
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  async function downloadMarkdown() {
    const s = window.BiViNote.state;
    const panel = window.BiViNote.panel;

    if (!s.subtitleBody || s.subtitleBody.length === 0) {
      panel.showToast('没有可导出的内容');
      return;
    }

    const md = buildMarkdown(s);
    const hasScreenshots = s.screenshots.size > 0;

    if (hasScreenshots && typeof JSZip !== 'undefined') {
      // 打包 ZIP
      const zip = new JSZip();
      zip.file('note.md', md);

      for (const [index, { blob }] of s.screenshots) {
        let filename;
        if (index < 0) {
          filename = `assets/chapter-${-index}.png`;
        } else {
          filename = `assets/${index + 1}.png`;
        }
        zip.file(filename, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${sanitize(s.title || 'note')}.zip`);
      panel.showToast('已下载 ZIP');
    } else {
      // 纯 MD
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      downloadBlob(blob, `${sanitize(s.title || 'note')}.md`);
      panel.showToast('已下载 Markdown');
    }
  }

  // ── 工具函数 ──

  function downloadText(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    downloadBlob(blob, filename);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function sanitize(str) {
    return String(str || 'untitled')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
  }

  function yamlEscape(str) {
    return String(str || '').replace(/"/g, '\\"');
  }

  function formatCompactTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    if (h > 0) {
      return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    }
    return `${pad2(m)}:${pad2(s)}`;
  }

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '-';
    const safe = Math.floor(seconds);
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    if (h > 0) {
      return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    }
    return `${pad2(m)}:${pad2(s)}`;
  }

  window.BiViNote.exportUtil = {
    buildSrt,
    buildMarkdown,
    downloadSrt,
    downloadMarkdown
  };
})();
