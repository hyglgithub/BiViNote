/**
 * BiViNote Panel Module
 * 构建 UI 面板 DOM，管理标签页切换、折叠/展开、拖动
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  let panelEl = null;
  let mainWrapEl = null;
  let arrowEl = null;
  let footerEl = null;
  let headerEl = null;
  let tabs = [];
  let views = {};

  const TAB_DEFS = [
    { id: 'subtitle', label: '字幕', footer: true },
    { id: 'chapter', label: '章节', footer: false },
    { id: 'video', label: '视频信息', footer: false },
    { id: 'prompt', label: '提示词', footer: false },
    { id: 'setting', label: '设置', footer: false }
  ];

  // ── 创建面板 ──

  function createPanel() {
    const s = window.BiViNote.state;

    panelEl = document.createElement('div');
    panelEl.className = 'bn-panel bn-hidden';
    panelEl.setAttribute('data-bn-theme', s.settings.darkMode ? 'dark' : '');

    // Header
    headerEl = document.createElement('div');
    headerEl.className = 'bn-header';

    const tabGroup = document.createElement('div');
    tabGroup.className = 'bn-tab-group';
    tabs = TAB_DEFS.map(def => {
      const btn = document.createElement('button');
      btn.className = 'bn-tab' + (def.id === 'subtitle' ? ' bn-active' : '');
      btn.textContent = def.label;
      btn.dataset.tab = def.id;
      btn.addEventListener('click', () => switchTab(def.id));
      tabGroup.appendChild(btn);
      return { id: def.id, btn, def };
    });
    headerEl.appendChild(tabGroup);

    arrowEl = document.createElement('button');
    arrowEl.className = 'bn-arrow';
    arrowEl.title = '折叠/展开';
    arrowEl.addEventListener('click', toggleCollapse);
    headerEl.appendChild(arrowEl);

    // 拖动
    setupDrag(headerEl);

    panelEl.appendChild(headerEl);

    // Main
    mainWrapEl = document.createElement('div');
    mainWrapEl.className = 'bn-main';

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'bn-scroll';

    TAB_DEFS.forEach(def => {
      const view = document.createElement('div');
      view.className = 'bn-view' + (def.id === 'subtitle' ? ' bn-show' : '');
      view.id = `bn-view-${def.id}`;
      if (def.id === 'subtitle') {
        view.innerHTML = '<div id="bn-subtitle-list"></div>';
      } else if (def.id === 'chapter') {
        view.innerHTML = '<div id="bn-chapter-list"></div>';
      } else if (def.id === 'video') {
        view.innerHTML = '<div id="bn-video-info"></div>';
      } else if (def.id === 'setting') {
        view.innerHTML = buildSettingHTML();
      } else if (def.id === 'prompt') {
        view.innerHTML = buildPromptHTML();
      }
      scrollWrap.appendChild(view);
      views[def.id] = view;
    });

    mainWrapEl.appendChild(scrollWrap);

    // Footer
    footerEl = document.createElement('div');
    footerEl.className = 'bn-footer bn-show';
    footerEl.innerHTML = `
      <button data-action="refresh">刷新</button>
      <button data-action="copy">复制</button>
      <button data-action="export-srt">导出（.srt）</button>
      <button data-action="download-md">下载（.md）</button>
    `;
    mainWrapEl.appendChild(footerEl);

    panelEl.appendChild(mainWrapEl);
    document.body.appendChild(panelEl);

    // 绑定 footer 按钮
    footerEl.addEventListener('click', onFooterClick);

    // 设置页事件绑定
    bindSettingEvents();

    // 应用字体和行高设置
    applyDisplaySettings();
  }

  // ── 提示词模板 ──

  const DEFAULT_PROMPT_NO_IMAGE = `你是一个视频笔记整理助手。将视频导出的 Markdown 文档整理为简洁、高质量、适合长期保存的 Markdown 学习笔记。

输入文件：

\`\`\`text
{download_dir}\\{title}.md
\`\`\`

说明：

* {download_dir} 为用户设置的下载目录
* {title} 为浏览器获取的视频标题
* 文档可能包含 Frontmatter、章节信息、字幕内容、时间戳

输出文件：

\`\`\`text
{download_dir}\\{title}.md
\`\`\`

直接覆盖原文件内容。

要求：

1. 删除口语化内容（如：好的、然后、兄弟、这里呢等）
2. 删除重复内容和无意义过渡语句
3. 合并逐句字幕，不保留时间戳
4. 按原始章节结构整理；若无章节则按内容自然分段
5. 将相邻字幕整理为简洁、连贯的知识点，不要逐句输出
6. 字幕可能由 AI 识别生成，存在错别字、同音字、术语错误、大小写错误，请结合上下文修正，并统一技术术语写法
7. 保留技术名词、工具名、框架名、产品名，不要省略
8. 若存在 Frontmatter，完整保留
9. 不要总结、解释、扩展，禁止添加原文不存在的内容`;

  const DEFAULT_PROMPT_WITH_IMAGE = `你是一个视频笔记整理助手。将视频导出的 Markdown 文档整理为简洁、高质量、适合长期保存的 Markdown 学习笔记。

输入文件：

\`\`\`text
{download_dir}\\{title}\\
├── note.md
└── assets/
    ├── 1.png
    ├── chapter-1.png
    └── ...
\`\`\`

说明：

* {download_dir} 为用户设置的下载目录
* {title} 为浏览器获取的视频标题（外层文件夹名）
* note.md 为固定文件名，存放字幕内容
* assets/ 目录存放截图文件
* Markdown 使用 ![截图](assets/xx.png) 引用图片
* 图片默认属于其所在位置附近的字幕内容或章节内容

输出文件：

\`\`\`text
{download_dir}\\{title}\\
├── note.md
└── assets/
\`\`\`

要求：

1. 只修改 note.md 内容，不得修改 assets/ 中的图片文件
2. 删除口语化内容（如：好的、然后、兄弟、这里呢等）
3. 删除重复内容和无意义过渡语句
4. 合并逐句字幕，不保留时间戳
5. 按原始章节结构整理；若无章节则按内容自然分段
6. 将相邻字幕整理为简洁、连贯的知识点，不要逐句输出
7. 字幕可能由 AI 识别生成，存在错别字、同音字、术语错误、大小写错误，请结合上下文修正，并统一技术术语写法
8. 保留技术名词、工具名、框架名、产品名，不要省略
9. 图片必须保留；保持图片与当前位置内容的对应关系，不要删除、移动或重新排序图片
10. 若存在 Frontmatter，完整保留
11. 不要总结、解释、扩展，禁止添加原文不存在的内容`;

  // ── 提示词页 HTML ──

  function buildPromptHTML() {
    return `
      <div class="bn-setting-label">下载目录</div>
      <input type="text" class="bn-input" id="bn-download-dir" placeholder="例如：C:\\Users\\xxx\\Downloads" style="width:calc(100% - 24px);margin:0 12px;padding:4px 8px;font-size:12px;background:var(--bn-card);color:var(--bn-text);border:1px solid var(--bn-btn-border);border-radius:3px;">
      <div class="bn-setting-label" id="bn-prompt-label">提示词</div>
      <div class="bn-prompt-actions">
        <button id="bn-prompt-copy">复制</button>
        <button id="bn-prompt-edit">修改</button>
        <button id="bn-prompt-reset">恢复默认</button>
      </div>
      <textarea class="bn-textarea" id="bn-prompt-text" readonly style="width:calc(100% - 24px);margin:0 12px 12px;height:240px;padding:4px 8px;font-size:11px;background:var(--bn-card);color:var(--bn-text);border:1px solid var(--bn-btn-border);border-radius:3px;resize:vertical;font-family:monospace;"></textarea>
    `;
  }

  // ── 设置页 HTML ──

  function buildSettingHTML() {
    return `
      <div class="bn-setting-label">字幕语言</div>
      <select class="bn-select" id="bn-lang-select"><option value="">暂无字幕</option></select>
      <div class="bn-setting-label">字体大小</div>
      <div class="bn-chip-group" data-setting="fontSize">
        <input type="radio" name="bn-fontSize" id="bn-fs-s" value="small"><label for="bn-fs-s">小</label>
        <input type="radio" name="bn-fontSize" id="bn-fs-d" value="default" checked><label for="bn-fs-d">默认</label>
        <input type="radio" name="bn-fontSize" id="bn-fs-m" value="medium"><label for="bn-fs-m">中</label>
        <input type="radio" name="bn-fontSize" id="bn-fs-l" value="large"><label for="bn-fs-l">大</label>
      </div>
      <div class="bn-setting-label">行高</div>
      <div class="bn-chip-group" data-setting="lineHeight">
        <input type="radio" name="bn-lineHeight" id="bn-lh-n" value="narrow"><label for="bn-lh-n">窄</label>
        <input type="radio" name="bn-lineHeight" id="bn-lh-s" value="standard" checked><label for="bn-lh-s">标准</label>
        <input type="radio" name="bn-lineHeight" id="bn-lh-w" value="wide"><label for="bn-lh-w">宽</label>
      </div>
      <div class="bn-setting-label">帧步长</div>
      <div class="bn-chip-group" data-setting="frameStep">
        <input type="radio" name="bn-frameStep" id="bn-fs1" value="1" checked><label for="bn-fs1">1/1</label>
        <input type="radio" name="bn-frameStep" id="bn-fs5" value="0.2"><label for="bn-fs5">1/5</label>
        <input type="radio" name="bn-frameStep" id="bn-fs15" value="0.066667"><label for="bn-fs15">1/15</label>
        <input type="radio" name="bn-frameStep" id="bn-fs30" value="0.033333"><label for="bn-fs30">1/30</label>
      </div>
      <div class="bn-switch">
        <span>自动滚动</span>
        <input type="checkbox" id="bn-auto-scroll" checked>
        <label class="bn-switch-track" for="bn-auto-scroll"></label>
      </div>
      <div class="bn-switch">
        <span>夜间模式</span>
        <input type="checkbox" id="bn-dark-mode">
        <label class="bn-switch-track" for="bn-dark-mode"></label>
      </div>
      <button class="bn-setting-btn" id="bn-reset-btn">恢复默认设置</button>
    `;
  }

  // ── 设置页事件 ──

  function bindSettingEvents() {
    // 字体大小
    panelEl.querySelectorAll('input[name="bn-fontSize"]').forEach(r => {
      r.addEventListener('change', () => {
        window.BiViNote.state.settings.fontSize = r.value;
        applyDisplaySettings();
        window.BiViNote.settings.save();
      });
    });

    // 行高
    panelEl.querySelectorAll('input[name="bn-lineHeight"]').forEach(r => {
      r.addEventListener('change', () => {
        window.BiViNote.state.settings.lineHeight = r.value;
        applyDisplaySettings();
        window.BiViNote.settings.save();
      });
    });

    // 帧步长
    panelEl.querySelectorAll('input[name="bn-frameStep"]').forEach(r => {
      r.addEventListener('change', () => {
        window.BiViNote.state.settings.frameStep = parseFloat(r.value);
        window.BiViNote.settings.save();
      });
    });

    // 自动滚动
    const autoScrollEl = panelEl.querySelector('#bn-auto-scroll');
    if (autoScrollEl) {
      autoScrollEl.addEventListener('change', () => {
        window.BiViNote.state.settings.autoScroll = autoScrollEl.checked;
        window.BiViNote.settings.save();
      });
    }

    // 夜间模式
    const darkModeEl = panelEl.querySelector('#bn-dark-mode');
    if (darkModeEl) {
      darkModeEl.addEventListener('change', () => {
        window.BiViNote.state.settings.darkMode = darkModeEl.checked;
        panelEl.setAttribute('data-bn-theme', darkModeEl.checked ? 'dark' : '');
        window.BiViNote.settings.save();
      });
    }

    // 恢复默认
    const resetBtn = panelEl.querySelector('#bn-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.BiViNote.settings.resetDefaults();
        loadSettingsToUI();
        applyDisplaySettings();
        // 同步暗色模式到面板
        panelEl.setAttribute('data-bn-theme', '');
        // 重新渲染视频信息页（恢复默认勾选）
        if (window.BiViNote.videoInfo) {
          window.BiViNote.videoInfo.render();
        }
        showToast('已恢复默认设置');
      });
    }

    // 字幕语言切换
    const langSelect = panelEl.querySelector('#bn-lang-select');
    if (langSelect) {
      langSelect.addEventListener('change', () => {
        const url = langSelect.value;
        const lang = langSelect.options[langSelect.selectedIndex]?.dataset?.lang || '';
        if (url && window.BiViNote.subtitle) {
          window.BiViNote.subtitle.switchSubtitle(url, lang);
        }
      });
    }

    // 提示词页事件
    bindPromptEvents();
  }

  // ── 提示词页事件 ──

  function hasScreenshots() {
    return window.BiViNote.state.screenshots.size > 0;
  }

  function getPromptType() {
    return hasScreenshots() ? 'img' : 'noimg';
  }

  function bindPromptEvents() {
    const s = window.BiViNote.state.settings;

    // 下载目录
    const dirInput = panelEl.querySelector('#bn-download-dir');
    if (dirInput) {
      dirInput.value = s.downloadDir || '';
      dirInput.addEventListener('change', () => {
        s.downloadDir = dirInput.value.trim();
        window.BiViNote.settings.save();
        renderPrompt();
      });
    }

    // 渲染提示词
    renderPrompt();

    // 复制按钮
    const copyBtn = panelEl.querySelector('#bn-prompt-copy');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      const el = panelEl.querySelector('#bn-prompt-text');
      if (!el) return;
      navigator.clipboard.writeText(el.value).then(() => showToast('已复制提示词'));
    });

    // 修改按钮
    const editBtn = panelEl.querySelector('#bn-prompt-edit');
    if (editBtn) editBtn.addEventListener('click', () => {
      const el = panelEl.querySelector('#bn-prompt-text');
      if (!el) return;

      if (el.readOnly) {
        // 进入编辑模式：显示原始模板（带占位符）
        el.readOnly = false;
        el.style.borderColor = 'var(--bn-accent)';
        editBtn.textContent = '保存';
        const type = getPromptType();
        const raw = type === 'img'
          ? (s.promptWithImage || DEFAULT_PROMPT_WITH_IMAGE)
          : (s.promptNoImage || DEFAULT_PROMPT_NO_IMAGE);
        el.value = raw;
      } else {
        // 保存
        el.readOnly = true;
        el.style.borderColor = '';
        editBtn.textContent = '修改';
        const type = getPromptType();
        if (type === 'img') {
          s.promptWithImage = el.value;
        } else {
          s.promptNoImage = el.value;
        }
        window.BiViNote.settings.save();
        renderPrompt();
        showToast('提示词已保存');
      }
    });

    // 恢复默认按钮
    const resetBtn = panelEl.querySelector('#bn-prompt-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      const type = getPromptType();
      if (type === 'img') {
        s.promptWithImage = DEFAULT_PROMPT_WITH_IMAGE;
      } else {
        s.promptNoImage = DEFAULT_PROMPT_NO_IMAGE;
      }
      window.BiViNote.settings.save();
      renderPrompt();
      showToast('已恢复默认提示词');
    });
  }

  function renderPrompt() {
    const s = window.BiViNote.state;
    const type = getPromptType();
    const template = type === 'img'
      ? (s.settings.promptWithImage || DEFAULT_PROMPT_WITH_IMAGE)
      : (s.settings.promptNoImage || DEFAULT_PROMPT_NO_IMAGE);

    // 更新标签
    const label = panelEl.querySelector('#bn-prompt-label');
    if (label) label.textContent = type === 'img' ? '提示词（有截图）' : '提示词（无截图）';

    // 填充变量并显示
    const dir = s.settings.downloadDir || '{download_dir}';
    const title = s.title || '{title}';
    const filled = template.replace(/\{download_dir\}/g, dir).replace(/\{title\}/g, title);

    const el = panelEl.querySelector('#bn-prompt-text');
    if (el) el.value = filled;
  }

  // ── 加载设置到 UI ──

  function loadSettingsToUI() {
    const s = window.BiViNote.state.settings;
    const setRadio = (name, value) => {
      const r = panelEl.querySelector(`input[name="${name}"][value="${value}"]`);
      if (r) r.checked = true;
    };
    setRadio('bn-fontSize', s.fontSize);
    setRadio('bn-lineHeight', s.lineHeight);
    setRadio('bn-frameStep', String(s.frameStep));

    const autoScrollEl = panelEl.querySelector('#bn-auto-scroll');
    if (autoScrollEl) autoScrollEl.checked = s.autoScroll;

    const darkModeEl = panelEl.querySelector('#bn-dark-mode');
    if (darkModeEl) darkModeEl.checked = s.darkMode;
  }

  // ── 应用显示设置 ──

  function applyDisplaySettings() {
    if (!panelEl) return;
    const s = window.BiViNote.state.settings;
    const sizeMap = { small: '12px', default: '13px', medium: '14px', large: '15px' };
    const lineMap = { narrow: '1.4', standard: '1.5', wide: '1.8' };
    panelEl.style.setProperty('--bn-font-size', sizeMap[s.fontSize] || '13px');
    panelEl.style.setProperty('--bn-line-height', lineMap[s.lineHeight] || '1.5');
  }

  // ── 标签页切换 ──

  function switchTab(tabId) {
    const s = window.BiViNote.state;
    s.activeTab = tabId;

    tabs.forEach(t => {
      t.btn.classList.toggle('bn-active', t.id === tabId);
    });

    Object.keys(views).forEach(id => {
      views[id].classList.toggle('bn-show', id === tabId);
    });

    // footer 只在字幕和章节页显示
    const tabDef = TAB_DEFS.find(d => d.id === tabId);
    footerEl.classList.toggle('bn-show', tabDef?.footer || false);
  }

  // ── 折叠/展开 ──

  function toggleCollapse() {
    const s = window.BiViNote.state;
    s.collapsed = !s.collapsed;
    panelEl.classList.toggle('bn-collapsed', s.collapsed);
    mainWrapEl.classList.toggle('bn-hide', s.collapsed);
    arrowEl.classList.toggle('bn-collapsed', s.collapsed);
  }

  // ── 拖动 ──

  function setupDrag(handle) {
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('bn-tab') || e.target.classList.contains('bn-arrow')) return;
      isDragging = true;
      const rect = panelEl.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;
      const rect = panelEl.getBoundingClientRect();
      x = Math.max(0, Math.min(x, window.innerWidth - rect.width));
      y = Math.max(0, Math.min(y, window.innerHeight - rect.height));
      panelEl.style.left = x + 'px';
      panelEl.style.top = y + 'px';
      panelEl.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // ── Footer 按钮 ──

  function onFooterClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'refresh') {
      if (window.BiViNote.subtitle) window.BiViNote.subtitle.refresh();
    } else if (action === 'copy') {
      if (window.BiViNote.subtitle) window.BiViNote.subtitle.copyText();
    } else if (action === 'export-srt') {
      if (window.BiViNote.exportUtil) window.BiViNote.exportUtil.downloadSrt();
    } else if (action === 'download-md') {
      if (window.BiViNote.exportUtil) window.BiViNote.exportUtil.downloadMarkdown();
    }
  }

  // ── 显示/隐藏面板 ──

  function show() {
    if (!panelEl) createPanel();
    panelEl.classList.remove('bn-hidden');
    window.BiViNote.state.panelVisible = true;
    loadSettingsToUI();
    applyDisplaySettings();
    // 自动加载字幕：无数据或 URL 变化时刷新
    const s = window.BiViNote.state;
    const currentBvid = window.BiViNote.subtitle?.extractBvid(location.href) || '';
    if (window.BiViNote.subtitle && (!s.bvid || s.bvid !== currentBvid)) {
      window.BiViNote.subtitle.refresh();
    }
  }

  function hide() {
    if (panelEl) {
      panelEl.classList.add('bn-hidden');
      window.BiViNote.state.panelVisible = false;
    }
  }

  function toggle() {
    if (window.BiViNote.state.panelVisible) {
      hide();
    } else {
      show();
    }
  }

  // ── 更新字幕语言下拉 ──

  function updateSubtitleSelect(subtitles, selectedUrl) {
    const select = panelEl?.querySelector('#bn-lang-select');
    if (!select) return;
    if (!subtitles || subtitles.length === 0) {
      select.innerHTML = '<option value="">暂无字幕</option>';
      select.disabled = true;
      return;
    }
    select.innerHTML = subtitles.map(item => {
      const aiTag = item.lan?.startsWith('ai-') ? ' [AI]' : '';
      const label = `${item.lanDoc || item.lan}${aiTag}`;
      const selected = item.subtitleUrl === selectedUrl ? 'selected' : '';
      return `<option value="${escapeHtml(item.subtitleUrl)}" data-lang="${escapeHtml(item.lan)}" ${selected}>${escapeHtml(label)}</option>`;
    }).join('');
    select.disabled = false;
  }

  // ── Toast ──

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'bn-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  // ── 工具函数 ──

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // ── 公开接口 ──

  window.BiViNote.panel = {
    create: createPanel,
    show,
    hide,
    toggle,
    switchTab,
    updateSubtitleSelect,
    showToast,
    renderPrompt,
    getPanelEl: () => panelEl,
    getScrollWrap: () => panelEl?.querySelector('.bn-scroll'),
    loadSettingsToUI
  };
})();
