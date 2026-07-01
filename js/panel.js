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
  let collapseContainerEl = null;
  let tabs = [];
  let views = {};

  const TAB_DEFS = [
    { id: 'subtitle', label: '字幕', footer: true },
    { id: 'chapter', label: '章节', footer: false },
    { id: 'video', label: '视频信息', footer: false },
    { id: 'doc', label: '文档整理', footer: false },
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
    arrowEl.title = '折叠';
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
      } else if (def.id === 'doc') {
        view.innerHTML = buildDocHTML();
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

    // 阻止滚轮事件穿透到背景网页
    panelEl.addEventListener('wheel', (e) => {
      const el = e.target;
      // 找到最近的可滚动祖先
      const scrollable = el.closest('.bn-scroll, .bn-result-area, .bn-doc-think, .bn-prompt-textarea, .bn-prompt-pre, .bn-sub-list, textarea, [style*="overflow"]');
      if (scrollable) {
        const { scrollTop, scrollHeight, clientHeight } = scrollable;
        const atTop = scrollTop <= 0 && e.deltaY < 0;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;
        // 可滚动元素在中间时，不阻止（让它自己滚动）
        if (!atTop && !atBottom) return;
      }
      // 不可滚动或已到边界，阻止默认行为防止背景滚动
      e.preventDefault();
    }, { passive: false });

    // 折叠浮动组件（icon + 快捷菜单）
    collapseContainerEl = document.createElement('div');
    collapseContainerEl.className = 'bn-collapse-container bn-hidden';
    collapseContainerEl.setAttribute('data-bn-theme', s.settings.darkMode ? 'dark' : '');

    const iconUrl = chrome.runtime.getURL('icons/icon-32.png');
    collapseContainerEl.innerHTML = `
      <div class="bn-collapse-icon" title="展开">
        <img src="${iconUrl}" alt="BiViNote">
      </div>
      <div class="bn-collapse-menu">
        <div class="bn-collapse-menu-item" data-action="add-snap" title="添加截屏到字幕">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div class="bn-collapse-menu-divider"></div>
        <div class="bn-collapse-menu-item" data-action="download-snap" title="下载截图">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <div class="bn-collapse-menu-divider"></div>
        <div class="bn-collapse-menu-item" data-action="copy-snap" title="复制到剪贴板">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </div>
      </div>
    `;

    // icon 点击 → 展开面板
    collapseContainerEl.querySelector('.bn-collapse-icon').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isDraggingCollapse) toggleCollapse();
    });

    // 菜单项点击
    collapseContainerEl.querySelector('.bn-collapse-menu').addEventListener('click', onCollapseMenuClick);

    setupCollapseDrag(collapseContainerEl);
    document.body.appendChild(collapseContainerEl);

    // 绑定 footer 按钮
    footerEl.addEventListener('click', onFooterClick);

    // 设置页事件绑定
    bindSettingEvents();

    // 应用字体和行高设置
    applyDisplaySettings();
  }

  // ── 提示词模板 ──

  const DEFAULT_PROMPT_NO_IMAGE = `你是一个视频笔记整理助手。将视频导出的 Markdown 文档整理为简洁、高质量、适合长期保存的 Markdown 学习笔记。

输入文件：{download_dir}\\{title}.md
输出文件：直接覆盖原文件内容。

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
{download_dir}\\{title}\\
├── note.md
└── assets/

输出文件：直接覆盖原文件内容。

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

  // ── 文档整理页 HTML ──

  const DEFAULT_DEEPSEEK_PROMPT = `你是一个视频笔记整理助手，将视频导出的 Markdown 文档整理为简洁、高质量、适合长期保存的 Markdown 学习笔记。

要求：

1. 删除口语化内容、重复内容、无意义过渡语句，例如：好的、然后、这里呢、兄弟、就是说等。
2. 删除所有字幕时间戳，例如 \`00:12\`、\`05:30\`。
3. 不要逐句输出字幕，将连续字幕整理为简洁、连贯、易阅读的知识内容。
4. 字幕可能由 AI 识别生成，存在错别字、同音字、术语错误、英文大小写错误，请结合上下文修正，并统一技术术语写法。
5. 若文档存在章节结构，严格按原始章节整理；若无章节，则按内容自然分段。
6. 不要新增原文不存在的标题、章节或目录层级，不要改变原始内容顺序。
7. 文档中形如 ![xxx](assets/数字.png) 的 Markdown 标记属于特殊文本块，() 内为相对资源路径且默认与前一句字幕内容关联；必须保留全部此类标记，禁止修改语法、alt 文本、路径或文件名，不得遗漏，可根据整理后的内容适当调整其在当前语义块中的位置。
8. 保留所有技术名词、工具名、框架名、产品名，不要删除、替换或省略。
9. 若存在 Frontmatter（文档开头 YAML），必须完整原样保留，禁止修改字段、字段值和字段顺序。
10. 仅整理原文，禁止总结、解释、扩展原文不存在的信息或补充额外知识。

待整理文档：

{markdown}

直接输出整理后的 Markdown 文档，不要输出任何额外内容。`;

  function buildDocHTML() {
    const mode = window.BiViNote.state.settings.docOrganizeMode || 'manual';
    if (mode === 'auto') return buildDocAutoHTML();
    return buildDocManualHTML();
  }

  function buildDocManualHTML() {
    return `
      <div class="bn-doc-auto">
        <div class="bn-label">路径前缀</div>
        <input type="text" id="bn-download-dir" class="bn-input" placeholder="例如: D:\\Notes\\Bilibili">
        <div class="bn-hint">提示词中 {download_dir} 会替换为此值</div>
        <div class="bn-doc-body">
          <pre id="bn-prompt-display" class="bn-prompt-pre"></pre>
        </div>
        <div class="bn-doc-actions">
          <button id="bn-prompt-copy" class="bn-btn-primary">复制提示词</button>
        </div>
      </div>
    `;
  }

  function buildDocAutoHTML() {
    return `
      <div class="bn-doc-auto">
        <div class="bn-doc-header">
          <div class="bn-doc-title">DeepSeek 文档整理</div>
          <span id="bn-ds-status" class="bn-status bn-status-off"><span class="bn-dot bn-dot-red"></span>未登录</span>
        </div>
        <div class="bn-doc-body">
          <pre id="bn-ds-prompt" class="bn-prompt-pre"></pre>
          <div id="bn-ds-think" class="bn-doc-think" style="display:none"></div>
          <div id="bn-ds-result" class="bn-result-area" style="display:none"></div>
        </div>
        <div class="bn-doc-actions">
          <button id="bn-ds-action" class="bn-btn-primary">打开 DeepSeek 登录</button>
          <button id="bn-ds-download" class="bn-btn-primary" style="display:none">下载 Markdown</button>
          <button id="bn-ds-copy" style="display:none">复制</button>
          <button id="bn-ds-clear" style="display:none">清除</button>
          <button id="bn-ds-continue" style="display:none">继续询问</button>
        </div>
      </div>
    `;
  }

  // ── 设置页 HTML ──

  function buildSettingHTML() {
    return `
      <div id="bn-settings-main">
        <div class="bn-setting-label">字幕语言</div>
        <select class="bn-select" id="bn-lang-select"><option value="">暂无字幕</option></select>
        <div class="bn-setting-label">文档整理方式</div>
        <label class="bn-radio-line">
          <input type="radio" name="bn-docMode" id="bn-dm-manual" value="manual" checked>
          <div><div class="bn-radio-title">手动整理</div><div class="bn-radio-desc">复制提示词，自行处理</div></div>
        </label>
        <label class="bn-radio-line">
          <input type="radio" name="bn-docMode" id="bn-dm-auto" value="auto">
          <div><div class="bn-radio-title">自动整理</div><div class="bn-radio-desc">调用 DeepSeek</div></div>
        </label>
        <div class="bn-setting-label">提示词管理</div>
        <div class="bn-prompt-toggle" data-prompt="noimg">▸ 手动 · 无截图</div>
        <div class="bn-prompt-toggle" data-prompt="img">▸ 手动 · 有截图</div>
        <div class="bn-prompt-toggle" data-prompt="ds">▸ 自动 · DeepSeek</div>
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
      </div>
      <div id="bn-settings-editor" style="display:none">
        <div class="bn-editor-title">提示词管理</div>
        <div class="bn-prompt-toggle bn-editor-back" id="bn-editor-back">▾ 手动 · 无截图</div>
        <textarea class="bn-prompt-textarea" id="bn-editor-textarea"></textarea>
        <div class="bn-doc-actions">
          <button id="bn-editor-save" class="bn-btn-primary">保存</button>
          <button id="bn-editor-reset">重置</button>
        </div>
      </div>
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
        const theme = darkModeEl.checked ? 'dark' : '';
        panelEl.setAttribute('data-bn-theme', theme);
        if (collapseContainerEl) collapseContainerEl.setAttribute('data-bn-theme', theme);
        window.BiViNote.settings.save();
      });
    }

    // 文档整理模式
    panelEl.querySelectorAll('input[name="bn-docMode"]').forEach(r => {
      r.addEventListener('change', () => {
        window.BiViNote.state.settings.docOrganizeMode = r.value;
        window.BiViNote.settings.save();
        // 重新构建文档整理页
        const docView = views['doc'];
        if (docView) {
          docView.innerHTML = buildDocHTML();
          bindDocEvents();
        }
      });
    });

    // 提示词管理 - 全屏编辑模式
    const PROMPT_MAP = {
      noimg: { key: 'promptNoImage', default: DEFAULT_PROMPT_NO_IMAGE, label: '手动 · 无截图' },
      img:   { key: 'promptWithImage', default: DEFAULT_PROMPT_WITH_IMAGE, label: '手动 · 有截图' },
      ds:    { key: 'deepseekPrompt', default: DEFAULT_DEEPSEEK_PROMPT, label: '自动 · DeepSeek' },
    };
    let editingType = null;

    function openEditor(type) {
      const info = PROMPT_MAP[type];
      if (!info) return;
      editingType = type;
      const mainEl = document.getElementById('bn-settings-main');
      const editorEl = document.getElementById('bn-settings-editor');
      const textarea = document.getElementById('bn-editor-textarea');
      const backBtn = document.getElementById('bn-editor-back');
      if (mainEl) mainEl.style.display = 'none';
      if (editorEl) editorEl.style.display = '';
      if (textarea) textarea.value = window.BiViNote.state.settings[info.key] || info.default;
      if (backBtn) backBtn.textContent = '▾ ' + info.label;
    }

    function closeEditor() {
      editingType = null;
      const mainEl = document.getElementById('bn-settings-main');
      const editorEl = document.getElementById('bn-settings-editor');
      if (mainEl) mainEl.style.display = '';
      if (editorEl) editorEl.style.display = 'none';
    }

    const settingView = views['setting'];
    if (settingView) {
      settingView.addEventListener('click', (e) => {
        const toggle = e.target.closest('.bn-prompt-toggle');
        if (!toggle) return;
        const type = toggle.dataset.prompt;
        if (type) openEditor(type);
      });
    }

    const editorBack = document.getElementById('bn-editor-back');
    if (editorBack) editorBack.addEventListener('click', closeEditor);

    const editorSave = document.getElementById('bn-editor-save');
    if (editorSave) editorSave.addEventListener('click', () => {
      if (!editingType) return;
      const info = PROMPT_MAP[editingType];
      const textarea = document.getElementById('bn-editor-textarea');
      if (info && textarea) {
        window.BiViNote.state.settings[info.key] = textarea.value;
        window.BiViNote.settings.save();
        showToast('已保存');
      }
      closeEditor();
    });

    const editorReset = document.getElementById('bn-editor-reset');
    if (editorReset) editorReset.addEventListener('click', () => {
      if (!editingType) return;
      const info = PROMPT_MAP[editingType];
      const textarea = document.getElementById('bn-editor-textarea');
      if (info && textarea) {
        window.BiViNote.state.settings[info.key] = '';
        textarea.value = info.default;
        window.BiViNote.settings.save();
        showToast('已重置');
      }
    });

    // 恢复默认
    const resetBtn = panelEl.querySelector('#bn-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.BiViNote.settings.resetDefaults();
        loadSettingsToUI();
        applyDisplaySettings();
        // 同步暗色模式到面板和折叠按钮
        panelEl.setAttribute('data-bn-theme', '');
        if (collapseContainerEl) collapseContainerEl.setAttribute('data-bn-theme', '');
        // 重新渲染视频信息页（恢复默认勾选）
        if (window.BiViNote.videoInfo) {
          window.BiViNote.videoInfo.render();
        }
        // 重新渲染文档整理页面
        const docView = views['doc'];
        if (docView) {
          docView.innerHTML = buildDocHTML();
          bindDocEvents();
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

    // 文档整理页事件
    bindDocEvents();
  }

  // ── 文档整理页事件 ──

  function hasScreenshots() {
    return window.BiViNote.state.screenshots.size > 0;
  }

  function getPromptType() {
    return hasScreenshots() ? 'img' : 'noimg';
  }

  function bindDocEvents() {
    const mode = window.BiViNote.state.settings.docOrganizeMode || 'manual';
    if (mode === 'auto') bindDocAutoEvents();
    else bindDocManualEvents();
  }

  function bindDocManualEvents() {
    const s = window.BiViNote.state.settings;

    const dirInput = panelEl.querySelector('#bn-download-dir');
    if (dirInput) {
      dirInput.value = s.downloadDir || '';
      dirInput.addEventListener('change', () => {
        s.downloadDir = dirInput.value.trim();
        window.BiViNote.settings.save();
        renderDoc();
      });
    }

    renderDoc();

    const copyBtn = panelEl.querySelector('#bn-prompt-copy');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      const displayEl = panelEl.querySelector('#bn-prompt-display');
      if (displayEl) navigator.clipboard.writeText(displayEl.textContent).then(() => showToast('已复制提示词'));
    });
  }

  function bindDocAutoEvents() {
    const ds = window.BiViNote.deepseek;
    if (!ds) return;

    const statusEl = panelEl.querySelector('#bn-ds-status');
    const actionBtn = panelEl.querySelector('#bn-ds-action');
    const promptEl = panelEl.querySelector('#bn-ds-prompt');
    const thinkEl = panelEl.querySelector('#bn-ds-think');
    const resultEl = panelEl.querySelector('#bn-ds-result');
    const downloadBtn = panelEl.querySelector('#bn-ds-download');
    const copyBtn = panelEl.querySelector('#bn-ds-copy');
    const clearBtn = panelEl.querySelector('#bn-ds-clear');
    const continueBtn = panelEl.querySelector('#bn-ds-continue');
    let savedScreenshots = null;

    if (promptEl) {
      const stored = window.BiViNote.state.settings.deepseekPrompt || DEFAULT_DEEPSEEK_PROMPT;
      promptEl.textContent = stored;
    }

    function updateUI(dsState) {
      if (!statusEl) return;
      const stateMap = {
        'not_logged_in': { cls: 'bn-status-off', dot: 'bn-dot-red', text: '未登录', action: '打开 DeepSeek 登录' },
        'ready': { cls: 'bn-status-ok', dot: 'bn-dot-green', text: '已登录', action: '开始整理' },
        'reading': { cls: 'bn-status-warn', dot: 'bn-spinner', text: '读取中', action: '停止整理' },
        'responding': { cls: 'bn-status-warn', dot: 'bn-spinner', text: '整理中', action: '停止整理' },
        'done': { cls: 'bn-status-ok', dot: 'bn-dot-green', text: '已完成', action: null },
        'error': { cls: 'bn-status-off', dot: 'bn-dot-red', text: '错误', action: '重试' },
      };
      const info = stateMap[dsState] || stateMap['not_logged_in'];
      statusEl.className = `bn-status ${info.cls}`;
      statusEl.innerHTML = `<span class="${info.dot}"></span>${info.text}`;

      if (actionBtn) {
        if (info.action) {
          actionBtn.textContent = info.action;
          actionBtn.style.display = '';
          actionBtn.disabled = false;
        } else {
          actionBtn.style.display = 'none';
        }
      }

      if (dsState === 'reading' || dsState === 'responding' || dsState === 'done') {
        if (promptEl) promptEl.style.display = 'none';
      } else {
        if (promptEl) promptEl.style.display = '';
        if (thinkEl) thinkEl.style.display = 'none';
        if (resultEl) resultEl.style.display = 'none';
      }

      if (dsState === 'reading') {
        if (thinkEl) { thinkEl.style.display = ''; thinkEl.textContent = ''; }
        if (resultEl) { resultEl.style.display = 'none'; resultEl.textContent = ''; }
      } else if (dsState === 'responding' || dsState === 'done') {
        if (thinkEl) thinkEl.style.display = 'none';
        if (resultEl) resultEl.style.display = '';
      }

      if (dsState === 'done') {
        if (downloadBtn) downloadBtn.style.display = '';
        if (copyBtn) copyBtn.style.display = '';
        if (clearBtn) clearBtn.style.display = '';
        if (continueBtn) continueBtn.style.display = '';
      } else {
        if (downloadBtn) downloadBtn.style.display = 'none';
        if (copyBtn) copyBtn.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
        if (continueBtn) continueBtn.style.display = 'none';
      }
    }

    ds.onStateChange(updateUI);
    updateUI(ds.getState());

    // 自动滚动：离开底部暂停，回到底部恢复
    let autoScroll = true;
    const isAtBottom = (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
    if (thinkEl) {
      thinkEl.addEventListener('scroll', () => { autoScroll = isAtBottom(thinkEl); }, { passive: true });
    }
    if (resultEl) {
      resultEl.addEventListener('scroll', () => { autoScroll = isAtBottom(resultEl); }, { passive: true });
    }

    ds.onChunk((chunk) => {
      if (chunk.type === 'think' && thinkEl) {
        thinkEl.textContent += chunk.text;
        if (autoScroll) thinkEl.scrollTop = thinkEl.scrollHeight;
      } else if (chunk.type === 'response' && resultEl) {
        resultEl.textContent += chunk.text;
        if (autoScroll) resultEl.scrollTop = resultEl.scrollHeight;
      }
    });

    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        const currentState = ds.getState();
        if (currentState === 'not_logged_in') {
          ds.openLogin();
          let attempts = 0;
          const poll = setInterval(async () => {
            attempts++;
            await ds.checkLogin();
            if (ds.getState() === 'ready' || attempts >= 15) clearInterval(poll);
          }, 2000);
        } else if (currentState === 'reading' || currentState === 'responding') {
          ds.abort();
          if (thinkEl) thinkEl.textContent = '';
          if (resultEl) resultEl.textContent = '';
        } else if (currentState === 'ready' || currentState === 'error') {
          autoScroll = true;
          // 快照当前截图，防止整理过程中用户调整图片
          const s = window.BiViNote.state;
          savedScreenshots = s.screenshots ? new Map(s.screenshots) : null;
          const md = window.BiViNote.exportUtil
            ? window.BiViNote.exportUtil.buildMarkdown(s)
            : buildExportMarkdown();
          const prompt = s.settings.deepseekPrompt || DEFAULT_DEEPSEEK_PROMPT;
          ds.sendMarkdown(md, prompt);
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        const result = ds.getResult();
        if (!result.response) return;
        const shots = savedScreenshots;
        const hasScreenshots = shots && shots.size > 0;
        if (hasScreenshots && typeof JSZip !== 'undefined') {
          const zip = new JSZip();
          zip.file('note.md', result.response);
          for (const [index, { blob, timeCode }] of shots) {
            const tc = timeCode || '0000';
            zip.file(`assets/${tc}.png`, blob);
          }
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = extractFilename(result.response).replace(/\.md$/, '.zip');
          a.click();
          URL.revokeObjectURL(url);
        } else {
          const blob = new Blob([result.response], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = extractFilename(result.response);
          a.click();
          URL.revokeObjectURL(url);
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const result = ds.getResult();
        if (result.response) navigator.clipboard.writeText(result.response).then(() => showToast('已复制'));
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        ds.clear();
        savedScreenshots = null;
        if (thinkEl) thinkEl.textContent = '';
        if (resultEl) resultEl.textContent = '';
      });
    }

    // 继续询问：跳转到 DeepSeek 会话页面
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        const chatId = ds.getChatId();
        const url = chatId ? `https://chat.deepseek.com/a/chat/s/${chatId}` : 'https://chat.deepseek.com';
        chrome.runtime.sendMessage({ type: 'ds-open-chat', url });
      });
    }

    // 登录检测延迟到用户点击文档整理标签时触发（见 switchTab）
  }

  function extractFilename(text) {
    const fmMatch = text.match(/^---\s*\n[\s\S]*?title:\s*["']?(.+?)["']?\s*\n[\s\S]*?---/);
    if (fmMatch) {
      const title = fmMatch[1].trim().replace(/[<>:"/\\|?*]/g, '_');
      if (title) return title + '.md';
    }
    const h1Match = text.match(/^#\s+(.+)$/m);
    if (h1Match) {
      const title = h1Match[1].trim().replace(/[<>:"/\\|?*]/g, '_');
      if (title) return title + '.md';
    }
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `整理结果_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.md`;
  }

  function buildExportMarkdown() {
    // 构建导出的 markdown 内容
    const s = window.BiViNote.state;
    let md = '';
    if (s.title) md += `# ${s.title}\n\n`;
    // 从字幕列表获取内容
    const subtitleList = document.getElementById('bn-subtitle-list');
    if (subtitleList) {
      const items = subtitleList.querySelectorAll('.bn-sub-item');
      items.forEach(item => {
        const time = item.querySelector('.bn-sub-time')?.textContent || '';
        const text = item.querySelector('.bn-sub-text')?.textContent || '';
        if (text) md += (time ? `[${time}] ` : '') + text + '\n';
      });
    }
    return md || '(无内容)';
  }

  function resetDocAuto() {
    const ds = window.BiViNote.deepseek;
    if (ds) ds.abort();
    const thinkEl = panelEl?.querySelector('#bn-ds-think');
    const resultEl = panelEl?.querySelector('#bn-ds-result');
    if (thinkEl) thinkEl.textContent = '';
    if (resultEl) resultEl.textContent = '';
  }

  function renderDoc() {
    const mode = window.BiViNote.state.settings.docOrganizeMode || 'manual';
    if (mode === 'auto') return;

    const type = getPromptType();
    const stored = type === 'img'
      ? window.BiViNote.state.settings.promptWithImage
      : window.BiViNote.state.settings.promptNoImage;
    const template = stored || (type === 'img' ? DEFAULT_PROMPT_WITH_IMAGE : DEFAULT_PROMPT_NO_IMAGE);

    const displayEl = panelEl.querySelector('#bn-prompt-display');
    if (displayEl) {
      displayEl.textContent = template
        .replace(/\{download_dir\}/g, window.BiViNote.state.settings.downloadDir || '{download_dir}')
        .replace(/\{title\}/g, window.BiViNote.state.title || '{title}');
    }
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
    setRadio('bn-docMode', s.docOrganizeMode || 'manual');

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

    // 点击文档整理标签时检测 DeepSeek 登录状态（仅空闲时检测）
    if (tabId === 'doc' && s.settings.docOrganizeMode === 'auto') {
      const ds = window.BiViNote.deepseek;
      const st = ds?.getState?.();
      if (ds?.checkLogin && (st === 'not_logged_in' || st === 'ready')) {
        ds.checkLogin();
      }
    }
  }

  // ── 工具函数 ──

  function formatCompactTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}${pad(m)}${pad(s)}` : `${pad(m)}${pad(s)}`;
  }

  // ── 折叠/展开 ──

  let isDraggingCollapse = false;
  const BTN_SIZE = 36;
  const EDGE_MARGIN = 20; // 距右边界的距离，避免覆盖滚动条

  function clamp(val, min, max) {
    return Math.max(min, Math.min(val, max));
  }

  // 保存/恢复 icon 位置
  let savedIconLeft = null;
  let savedIconTop = null;

  function toggleCollapse() {
    if (!panelEl) createPanel();
    const s = window.BiViNote.state;
    s.collapsed = !s.collapsed;

    if (s.collapsed) {
      // 折叠：隐藏面板，显示浮动组件
      if (savedIconLeft !== null) {
        // 先显示以获取实际尺寸
        collapseContainerEl.style.left = savedIconLeft + 'px';
        collapseContainerEl.style.top = savedIconTop + 'px';
        collapseContainerEl.classList.remove('bn-hidden');
        const rect = collapseContainerEl.getBoundingClientRect();
        const x = clamp(savedIconLeft, EDGE_MARGIN, window.innerWidth - rect.width - EDGE_MARGIN);
        const y = clamp(savedIconTop, EDGE_MARGIN, window.innerHeight - rect.height - EDGE_MARGIN);
        collapseContainerEl.style.left = x + 'px';
        collapseContainerEl.style.top = y + 'px';
      } else {
        // 默认位置：右上角（与面板 CSS 默认 right:20px top:100px 对齐）
        const panelRight = window.innerWidth - 20;
        const x = clamp(panelRight - BTN_SIZE - 8, EDGE_MARGIN, window.innerWidth - BTN_SIZE - EDGE_MARGIN);
        const y = clamp(100 + 2, EDGE_MARGIN, window.innerHeight - BTN_SIZE - EDGE_MARGIN);
        collapseContainerEl.style.left = x + 'px';
        collapseContainerEl.style.top = y + 'px';
        savedIconLeft = x;
        savedIconTop = y;
      }
      panelEl.classList.add('bn-hidden');
      collapseContainerEl.classList.remove('bn-hidden');
      // 记住用户选择的模式
      window.BiViNote.state.settings.lastOpenMode = 'menu';
      window.BiViNote.settings.save();
    } else {
      // 展开：隐藏浮动组件，显示面板
      const iconRect = collapseContainerEl.getBoundingClientRect();
      const panelW = 400;
      const panelH = 600;
      const x = clamp(iconRect.left - panelW + BTN_SIZE + 8, EDGE_MARGIN, window.innerWidth - panelW - EDGE_MARGIN);
      const y = clamp(iconRect.top - 2, EDGE_MARGIN, window.innerHeight - panelH - EDGE_MARGIN);
      panelEl.style.left = x + 'px';
      panelEl.style.top = y + 'px';
      panelEl.style.right = 'auto';
      collapseContainerEl.classList.add('bn-hidden');
      panelEl.classList.remove('bn-hidden');
      s.panelVisible = true;
      // 记住用户选择的模式
      window.BiViNote.state.settings.lastOpenMode = 'panel';
      window.BiViNote.settings.save();
      loadSettingsToUI();
      applyDisplaySettings();
      // 自动加载字幕
      const currentBvid = window.BiViNote.subtitle?.extractBvid(location.href) || '';
      if (window.BiViNote.subtitle && (!s.bvid || s.bvid !== currentBvid)) {
        window.BiViNote.subtitle.refresh();
      }
    }
  }

  // ── 折叠菜单点击 ──

  async function onCollapseMenuClick(e) {
    const item = e.target.closest('.bn-collapse-menu-item');
    if (!item) return;
    e.stopPropagation();

    const action = item.dataset.action;
    const capture = window.BiViNote.capture;
    const subtitle = window.BiViNote.subtitle;
    const video = subtitle?.getVideoElement();

    if (!video) {
      showToast('未找到视频元素');
      return;
    }

    if (action === 'add-snap') {
      // 如果字幕未加载，先刷新
      if (!window.BiViNote.state.subtitleBody.length) {
        showToast('正在获取字幕...');
        await subtitle.refresh();
      }
      // 找到当前时间对应的字幕
      const activeIndex = subtitle.findActiveIndex(video.currentTime);
      if (activeIndex >= 0) {
        await capture.addScreenshot(activeIndex);
      } else {
        showToast('当前时间无对应字幕');
      }
    } else if (action === 'download-snap') {
      try {
        const blob = await capture.captureFrame(video);
        capture.saveToFile(blob, capture.generateDownloadFilename(video.currentTime));
        showToast('截图已保存');
      } catch (err) {
        showToast('截图失败：' + err.message);
      }
    } else if (action === 'copy-snap') {
      try {
        const blob = await capture.captureFrame(video);
        const ok = await capture.copyToClipboard(blob);
        showToast(ok ? '已复制到剪贴板' : '复制失败');
      } catch (err) {
        showToast('复制失败：' + err.message);
      }
    }
  }

  // ── 折叠按钮拖动 ──

  function setupCollapseDrag(el) {
    let isDragging = false;
    let hasMoved = false;
    let offsetX = 0, offsetY = 0;

    el.addEventListener('mousedown', (e) => {
      // 只有点击 icon 区域才触发拖动
      if (!e.target.closest('.bn-collapse-icon')) return;
      isDragging = true;
      hasMoved = false;
      isDraggingCollapse = false;
      const rect = el.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      hasMoved = true;
      isDraggingCollapse = true;
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;
      x = clamp(x, EDGE_MARGIN, window.innerWidth - w - EDGE_MARGIN);
      y = clamp(y, EDGE_MARGIN, window.innerHeight - h - EDGE_MARGIN);
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      savedIconLeft = x;
      savedIconTop = y;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      hasMoved = false;
    });
  }

  // ── 面板拖动 ──

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
      x = Math.max(EDGE_MARGIN, Math.min(x, window.innerWidth - rect.width - EDGE_MARGIN));
      y = Math.max(EDGE_MARGIN, Math.min(y, window.innerHeight - rect.height - EDGE_MARGIN));
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
    // 确保非折叠状态
    window.BiViNote.state.collapsed = false;
    panelEl.classList.remove('bn-hidden');
    if (collapseContainerEl) collapseContainerEl.classList.add('bn-hidden');
    window.BiViNote.state.panelVisible = true;
    // 记住用户选择的模式
    window.BiViNote.state.settings.lastOpenMode = 'panel';
    window.BiViNote.settings.save();
    loadSettingsToUI();
    applyDisplaySettings();
    // 自动加载字幕：无数据或 URL 变化时刷新
    const s = window.BiViNote.state;
    const currentBvid = window.BiViNote.subtitle?.extractBvid(location.href) || '';
    const currentBvidChanged = currentBvid && s.bvid !== currentBvid;
    const currentPage = window.BiViNote.subtitle?.extractPageIndex(location.href) || 1;
    const currentPageChanged = s.cid && currentPage !== (s.pageIndex || 1);
    if (window.BiViNote.subtitle && (!s.bvid || currentBvidChanged || currentPageChanged)) {
      window.BiViNote.subtitle.refresh();
    }
  }

  function hide() {
    if (panelEl) {
      panelEl.classList.add('bn-hidden');
      if (collapseContainerEl) collapseContainerEl.classList.add('bn-hidden');
      window.BiViNote.state.panelVisible = false;
      window.BiViNote.state.collapsed = false;
    }
  }

  function hideCollapse() {
    if (collapseContainerEl) {
      collapseContainerEl.classList.add('bn-hidden');
    }
    window.BiViNote.state.collapsed = false;
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
    hideCollapse,
    toggle,
    toggleCollapse,
    switchTab,
    updateSubtitleSelect,
    showToast,
    renderDoc,
    resetDocAuto,
    getPanelEl: () => panelEl,
    getScrollWrap: () => panelEl?.querySelector('.bn-scroll'),
    loadSettingsToUI
  };
})();
