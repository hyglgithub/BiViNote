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
  let headerEl = null;
  let footerEl = null;
  let collapseContainerEl = null;
  let tabs = [];
  let views = {};
  let refreshDocUI = null; // 文档整理页刷新函数

  const TAB_DEFS = [
    { id: 'subtitle', label: '字幕' },
    { id: 'chapter', label: '章节' },
    { id: 'video', label: '视频信息' },
    { id: 'doc', label: '文档整理' },
    { id: 'setting', label: '设置' }
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
    arrowEl.title = '收起';
    arrowEl.addEventListener('click', toggleCollapse);
    headerEl.appendChild(arrowEl);

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

    // 字幕页底部工具栏（在滚动容器外面，不随字幕滚动）
    footerEl = document.createElement('div');
    footerEl.className = 'bn-sub-footer';
    footerEl.innerHTML = `
      <div class="bn-lang-box">
        <button class="bn-lang-btn" id="bn-lang-trigger">
          <span id="bn-lang-label">暂无字幕</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div class="bn-lang-menu" id="bn-lang-menu"></div>
      </div>
      <button data-action="refresh">刷新</button>
      <button data-action="copy">复制</button>
      <button data-action="export-srt">导出（.srt）</button>
      <button data-action="download-md">下载（.md）</button>
    `;
    mainWrapEl.appendChild(footerEl);

    panelEl.appendChild(mainWrapEl);

    // 注入到 #danmukuBox 作为第一个子节点
    const danmukuBox = document.getElementById('danmukuBox');
    if (danmukuBox) {
      danmukuBox.insertBefore(panelEl, danmukuBox.firstChild);
    } else {
      document.body.appendChild(panelEl);
    }

    // 监测面板是否被 Vue 重渲染移除，自动重新插入
    startPanelSurvival();

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
        <div class="bn-collapse-menu-item" data-action="add-snap" title="添加截图到字幕">
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

    // icon 点击 → 无操作（不再展开面板）
    collapseContainerEl.querySelector('.bn-collapse-icon').addEventListener('click', (e) => {
      e.stopPropagation();
      // 无操作
    });

    // 菜单项点击
    collapseContainerEl.querySelector('.bn-collapse-menu').addEventListener('click', onCollapseMenuClick);

    setupCollapseDrag(collapseContainerEl);
    document.body.appendChild(collapseContainerEl);

    // 绑定字幕页底部工具栏按钮
    const subFooter = panelEl.querySelector('.bn-sub-footer');
    if (subFooter) {
      subFooter.addEventListener('click', onFooterClick);
    }

    // 语言切换下拉菜单
    const langTrigger = panelEl.querySelector('#bn-lang-trigger');
    const langMenu = panelEl.querySelector('#bn-lang-menu');
    if (langTrigger && langMenu) {
      langTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        langMenu.classList.toggle('show');
      });
      // 点击外部关闭菜单
      document.addEventListener('click', () => {
        langMenu.classList.remove('show');
      });
    }

    // 设置页事件绑定
    bindSettingEvents();

    // 填充版本号
    const versionEl = document.getElementById('bn-version');
    if (versionEl) versionEl.textContent = 'v' + chrome.runtime.getManifest().version;

    // 应用字体和行高设置
    applyDisplaySettings();

    // 初始化显示状态（字幕页）
    switchTab('subtitle');
  }

  // ── 提示词模板 ──

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
11. 输出前必须进行一致性检查：最终文档中的图片 Markdown 数量必须与原文完全一致。若原文图片数量为 0，则输出图片数量也必须为 0，不得新增任何图片。

待整理文档：

{markdown}

直接输出整理后的 Markdown 文档，不要输出任何额外内容。`;

  const DEFAULT_DEEPSEEK_SUMMARY = `你是一个视频总结助手，请根据提供的视频字幕文档生成简洁、准确的视频总结。

要求：
1. 仅依据字幕内容进行总结，不得添加、猜测或推断原文未提及的信息。
2. 提炼视频的核心主题、主要观点或关键内容，忽略寒暄、口头禅、广告、重复内容等无关信息。
3. 总结长度为 3–5 句话，覆盖视频的主要内容即可，不要展开细节。
4. 使用自然流畅、客观中立的中文表达。
5. 输出一段连续文本，不使用标题、列表、Markdown、引号或其他格式。
6. 如果字幕内容不完整或存在缺失，仅总结能够确定的内容，不要补充或猜测。

待总结文档：

{markdown}

直接输出总结，不要输出任何额外说明。`;

  function buildDocHTML() {
    return buildDocAutoHTML();
  }

  function buildDocAutoHTML() {
    return `
      <div class="bn-doc-auto">
        <div class="bn-doc-header">
          <div class="bn-doc-title">DeepSeek 文档整理</div>
          <span id="bn-ds-status" class="bn-status bn-status-off"><span class="bn-dot bn-dot-red"></span>未登录</span>
        </div>
        <div class="bn-prompt-switcher" id="bn-prompt-switcher"></div>
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
        <div class="bn-setting-label">帧步长 <span class="bn-tooltip-icon" data-tooltip="帧步长控制逐帧浏览时每次移动的时间间隔。1/5 表示每帧 0.2 秒（适用于 5fps 视频），1/30 表示每帧约 0.033 秒（适用于 30fps 视频）。数值越小，帧精度越高。">?</span></div>
        <div class="bn-chip-group" data-setting="frameStep">
          <input type="radio" name="bn-frameStep" id="bn-fs1" value="1" checked><label for="bn-fs1">1/1</label>
          <input type="radio" name="bn-frameStep" id="bn-fs5" value="0.2"><label for="bn-fs5">1/5</label>
          <input type="radio" name="bn-frameStep" id="bn-fs15" value="0.066667"><label for="bn-fs15">1/15</label>
          <input type="radio" name="bn-frameStep" id="bn-fs30" value="0.033333"><label for="bn-fs30">1/30</label>
        </div>
        <div class="bn-switch">
          <span>字幕自动滚动</span>
          <input type="checkbox" id="bn-auto-scroll" checked>
          <label class="bn-switch-track" for="bn-auto-scroll"></label>
        </div>
        <div class="bn-switch">
          <span>夜间模式</span>
          <input type="checkbox" id="bn-dark-mode">
          <label class="bn-switch-track" for="bn-dark-mode"></label>
        </div>
        <div class="bn-switch">
          <span>预览截图暂停视频</span>
          <input type="checkbox" id="bn-pause-preview" checked>
          <label class="bn-switch-track" for="bn-pause-preview"></label>
        </div>
        <div class="bn-switch">
          <span>显示悬浮功能条</span>
          <input type="checkbox" id="bn-show-float-toolbar" checked>
          <label class="bn-switch-track" for="bn-show-float-toolbar"></label>
        </div>
        <div class="bn-switch">
          <span>默认展开面板</span>
          <input type="checkbox" id="bn-default-expand" checked>
          <label class="bn-switch-track" for="bn-default-expand"></label>
        </div>
        <div class="bn-setting-actions">
          <button class="bn-setting-btn" id="bn-reset-btn">恢复默认设置</button>
          <button class="bn-setting-btn" id="bn-open-options-btn">更多设置</button>
        </div>
        <div class="bn-about">
          <div class="bn-about-version">BiViNote <span id="bn-version"></span></div>
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

    // 预览暂停
    const pausePreviewEl = panelEl.querySelector('#bn-pause-preview');
    if (pausePreviewEl) {
      pausePreviewEl.addEventListener('change', () => {
        window.BiViNote.state.settings.pauseOnPreview = pausePreviewEl.checked;
        window.BiViNote.settings.save();
      });
    }

    // 显示悬浮功能条
    const showFloatToolbarEl = panelEl.querySelector('#bn-show-float-toolbar');
    if (showFloatToolbarEl) {
      showFloatToolbarEl.addEventListener('change', () => {
        window.BiViNote.state.settings.showFloatToolbar = showFloatToolbarEl.checked;
        window.BiViNote.settings.save();

        // 实时更新悬浮功能条显示状态
        if (showFloatToolbarEl.checked) {
          showCollapse();
        } else {
          hideCollapse();
        }
      });
    }

    // 默认展开面板
    const defaultExpandEl = panelEl.querySelector('#bn-default-expand');
    if (defaultExpandEl) {
      defaultExpandEl.addEventListener('change', () => {
        window.BiViNote.state.settings.defaultExpand = defaultExpandEl.checked;
        window.BiViNote.settings.save();
      });
    }

    // 打开选项页面
    const openOptionsBtn = document.getElementById('bn-open-options-btn');
    if (openOptionsBtn) {
      openOptionsBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'open-options' });
      });
    }

    // 恢复默认
    const resetBtn = panelEl.querySelector('#bn-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.BiViNote.settings.resetDefaults();
        loadSettingsToUI();
        applyDisplaySettings();
        // 恢复悬浮功能条显示状态
        showCollapse();
        // 恢复面板展开状态（默认展开）
        window.BiViNote.state.collapsed = false;
        panelEl.classList.remove('bn-collapsed');
        if (arrowEl) arrowEl.classList.remove('bn-collapsed');
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

    // 文档整理页事件
    bindDocEvents();
  }

  // ── 文档整理页事件 ──

  function bindDocEvents() {
    bindDocAutoEvents();
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
    let savedScreenshots = {};
    let currentPromptType = 'summary';
    let autoScroll = true;

    // 渲染提示词切换按钮
    function renderPromptSwitcher() {
      const switcherEl = panelEl.querySelector('#bn-prompt-switcher');
      if (!switcherEl) return;
      const settings = window.BiViNote.state.settings;
      const customPrompts = settings.customPrompts || [];
      const summaryName = settings.deepseekSummaryName || '文档总结';
      const clearName = settings.deepseekPromptName || '文档清洗';
      let html = `
        <button class="bn-prompt-btn${currentPromptType === 'summary' ? ' active' : ''}" data-prompt="summary">${escapeHtml(summaryName)}</button>
        <button class="bn-prompt-btn${currentPromptType === 'clear' ? ' active' : ''}" data-prompt="clear">${escapeHtml(clearName)}</button>
      `;
      customPrompts.forEach(p => {
        html += `<button class="bn-prompt-btn${currentPromptType === p.id ? ' active' : ''}" data-prompt="${p.id}">${escapeHtml(p.name)}</button>`;
        bindTaskEvents(p.id);
      });
      html += `<button class="bn-prompt-add-btn" id="bn-prompt-add-btn" title="新增提示词"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`;
      switcherEl.innerHTML = html;

      // 绑定按钮点击事件
      const promptBtns = switcherEl.querySelectorAll('.bn-prompt-btn');
      promptBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          promptBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentPromptType = btn.dataset.prompt;
          updatePromptPreview();
          refreshCurrentTaskUI();
        });
      });

      // 绑定"+"按钮点击事件 - 打开提示词管理
      const addBtn = switcherEl.querySelector('#bn-prompt-add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'open-options', section: 'prompts' });
        });
      }
    }

    // 提示词预览
    function updatePromptPreview() {
      if (!promptEl) return;
      if (currentPromptType === 'clear') {
        promptEl.textContent = window.BiViNote.state.settings.deepseekPrompt || DEFAULT_DEEPSEEK_PROMPT;
      } else if (currentPromptType === 'summary') {
        promptEl.textContent = window.BiViNote.state.settings.deepseekSummary || DEFAULT_DEEPSEEK_SUMMARY;
      } else {
        // 自定义提示词
        const customPrompts = window.BiViNote.state.settings.customPrompts || [];
        const custom = customPrompts.find(p => p.id === currentPromptType);
        promptEl.textContent = custom ? custom.prompt : '';
      }
    }

    // 刷新当前任务的UI
    function refreshCurrentTaskUI() {
      const task = ds.getTask(currentPromptType);
      // 使用任务状态（已同步全局登录状态）
      updateUI(task.state);
      // 恢复结果内容
      if (thinkEl) thinkEl.textContent = task.thinkText;
      if (resultEl) resultEl.textContent = task.responseText;
    }

    // 暴露给 switchTab 使用
    refreshDocUI = refreshCurrentTaskUI;

    // 已绑定事件的任务 ID 集合（防止重复绑定）
    const boundTaskIds = new Set();

    // 为任务绑定状态和 chunk 监听（包括自定义提示词）
    function bindTaskEvents(taskId) {
      if (boundTaskIds.has(taskId)) return;
      boundTaskIds.add(taskId);

      ds.onStateChange(taskId, (newState) => {
        if (taskId === currentPromptType) {
          updateUI(newState);
        }
      });

      ds.onChunk(taskId, (chunk) => {
        if (taskId !== currentPromptType) return;
        if (chunk.type === 'think' && thinkEl) {
          thinkEl.textContent += chunk.text;
          if (autoScroll) thinkEl.scrollTop = thinkEl.scrollHeight;
        } else if (chunk.type === 'response' && resultEl) {
          resultEl.textContent += chunk.text;
          if (autoScroll) resultEl.scrollTop = resultEl.scrollHeight;
        }
      });
    }

    // 绑定内置任务
    ['clear', 'summary'].forEach(bindTaskEvents);

    // 绑定自定义提示词任务
    const initCustomPrompts = window.BiViNote.state.settings.customPrompts || [];
    initCustomPrompts.forEach(p => bindTaskEvents(p.id));

    // 渲染提示词切换按钮
    renderPromptSwitcher();
    updatePromptPreview();

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

    // 初始化UI
    const initialTask = ds.getTask(currentPromptType);
    updateUI(initialTask.state);

    // 自动滚动：离开底部暂停，回到底部恢复
    const isAtBottom = (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
    if (thinkEl) {
      thinkEl.addEventListener('scroll', () => { autoScroll = isAtBottom(thinkEl); }, { passive: true });
    }
    if (resultEl) {
      resultEl.addEventListener('scroll', () => { autoScroll = isAtBottom(resultEl); }, { passive: true });
    }

    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        const task = ds.getTask(currentPromptType);
        const currentState = task.state;
        if (currentState === 'not_logged_in') {
          ds.openLogin();
          let attempts = 0;
          const poll = setInterval(async () => {
            attempts++;
            await ds.checkLogin(currentPromptType);
            const t = ds.getTask(currentPromptType);
            if (t.state === 'ready' || attempts >= 15) clearInterval(poll);
          }, 2000);
        } else if (currentState === 'reading' || currentState === 'responding') {
          ds.abort(currentPromptType);
          if (thinkEl) thinkEl.textContent = '';
          if (resultEl) resultEl.textContent = '';
        } else if (currentState === 'ready' || currentState === 'error') {
          autoScroll = true;
          const s = window.BiViNote.state;
          savedScreenshots[currentPromptType] = s.screenshots ? new Map(s.screenshots) : null;
          const md = window.BiViNote.exportUtil
            ? window.BiViNote.exportUtil.buildMarkdown(s)
            : buildExportMarkdown();

          // 获取提示词
          let prompt;
          let thinking = false;
          if (currentPromptType === 'clear') {
            prompt = s.settings.deepseekPrompt || DEFAULT_DEEPSEEK_PROMPT;
            thinking = true;
          } else if (currentPromptType === 'summary') {
            prompt = s.settings.deepseekSummary || DEFAULT_DEEPSEEK_SUMMARY;
          } else {
            // 自定义提示词
            const customPrompts = s.settings.customPrompts || [];
            const custom = customPrompts.find(p => p.id === currentPromptType);
            prompt = custom ? custom.prompt : '';
          }
          ds.sendMarkdown(currentPromptType, md, prompt, thinking);
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        downloadResult(ds, savedScreenshots[currentPromptType], currentPromptType);
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const result = ds.getResult(currentPromptType);
        if (result.response) navigator.clipboard.writeText(result.response).then(() => showToast('已复制'));
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        ds.clear(currentPromptType);
        savedScreenshots[currentPromptType] = null;

        // 同步清除缓存（仅移除当前 promptType，不影响其他类型）
        const cache = window.BiViNote.cache;
        if (cache) {
          const s = window.BiViNote.state;
          await cache.removePromptType(s.bvid, s.pageIndex || 1, currentPromptType);
        }

        if (thinkEl) thinkEl.textContent = '';
        if (resultEl) resultEl.textContent = '';
      });
    }

    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        const chatId = ds.getChatId(currentPromptType);
        const url = chatId ? `https://chat.deepseek.com/a/chat/s/${chatId}` : 'https://chat.deepseek.com';
        chrome.runtime.sendMessage({ type: 'ds-open-chat', url });
      });
    }

    // 监听存储变化，实时更新提示词切换按钮
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.bivinote_settings) {
        const newSettings = changes.bivinote_settings.newValue || {};
        // 更新内存中的设置
        Object.assign(window.BiViNote.state.settings, newSettings);
        // 重新渲染提示词切换按钮
        renderPromptSwitcher();
        updatePromptPreview();
      }
    });
  }

  function sanitize(str) {
    return String(str || 'untitled')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
  }

  // 根据 taskId 获取提示词名称
  function getPromptName(taskId) {
    const settings = window.BiViNote.state.settings;
    if (taskId === 'clear') return settings.deepseekPromptName || '文档清洗';
    if (taskId === 'summary') return settings.deepseekSummaryName || '文档总结';
    const customPrompts = settings.customPrompts || [];
    const custom = customPrompts.find(p => p.id === taskId);
    return custom ? custom.name : '整理结果';
  }

  // 获取提示词的打包图片设置
  function getPromptPackImages(taskId) {
    const settings = window.BiViNote.state.settings;
    if (taskId === 'clear' || taskId === 'summary') {
      const packImagesMap = settings.promptPackImages || {};
      return packImagesMap[taskId] ?? (taskId === 'clear');
    }
    const customPrompts = settings.customPrompts || [];
    const custom = customPrompts.find(p => p.id === taskId);
    return custom ? (custom.packImages ?? false) : false;
  }

  // 生成下载文件名：视频标题_提示词名
  function buildDownloadFilename(taskId) {
    const s = window.BiViNote.state;
    const videoTitle = s.title || 'note';
    const promptName = getPromptName(taskId);
    return sanitize(`${videoTitle}_${promptName}`);
  }

  async function downloadResult(ds, savedScreenshots, taskId = 'clear') {
    const result = ds.getResult(taskId);
    if (!result.response) return;
    const shots = savedScreenshots;
    const filename = buildDownloadFilename(taskId);
    const packImages = getPromptPackImages(taskId);
    const hasScreenshots = packImages && shots && shots.size > 0;
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
      a.download = `${filename}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([result.response], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
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
    if (ds) {
      ds.abort('clear');
      ds.abort('summary');
    }
    const thinkEl = panelEl?.querySelector('#bn-ds-think');
    const resultEl = panelEl?.querySelector('#bn-ds-result');
    if (thinkEl) thinkEl.textContent = '';
    if (resultEl) resultEl.textContent = '';
  }

  function renderDoc() {
    // No-op: manual mode removed, auto mode handles its own rendering
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

    const pausePreviewEl = panelEl.querySelector('#bn-pause-preview');
    if (pausePreviewEl) pausePreviewEl.checked = s.pauseOnPreview;

    const showFloatToolbarEl = panelEl.querySelector('#bn-show-float-toolbar');
    if (showFloatToolbarEl) showFloatToolbarEl.checked = s.showFloatToolbar !== false;

    const defaultExpandEl = panelEl.querySelector('#bn-default-expand');
    if (defaultExpandEl) defaultExpandEl.checked = s.defaultExpand !== false;
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

    // 底部工具栏只在字幕页显示
    if (footerEl) {
      footerEl.classList.toggle('bn-show', tabId === 'subtitle');
    }

    // 点击文档整理标签时加载缓存并恢复任务状态 UI
    if (tabId === 'doc') {
      const ds = window.BiViNote.deepseek;
      const cache = window.BiViNote.cache;

      if (ds && cache) {
        const bvid = s.bvid;
        const pageIndex = s.pageIndex || 1;

        cache.getCache(bvid, pageIndex).then(cached => {
          if (cached) {
            Object.keys(cached).forEach(promptType => {
              const task = ds.getTask(promptType);
              const data = cached[promptType];
              task.thinkText = data.think;
              task.responseText = data.response;
              // Direct assignment is intentional here: we're hydrating from cache before
              // any listeners are active, and refreshDocUI() is called immediately after.
              task.state = 'done';
            });
          }

          const task = ds.getTask('summary');
          if (task.state === 'not_logged_in') {
            ds.checkLogin('summary').then(() => {
              if (refreshDocUI) refreshDocUI();
            });
          } else {
            if (refreshDocUI) refreshDocUI();
          }
        });
      } else if (ds) {
        const task = ds.getTask('summary');
        if (task.state === 'not_logged_in') {
          ds.checkLogin('summary').then(() => {
            if (refreshDocUI) refreshDocUI();
          });
        } else {
          if (refreshDocUI) refreshDocUI();
        }
      }
    }
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
      // 收起：隐藏主内容区域，显示扁平标签导航条
      panelEl.classList.add('bn-collapsed');
      if (arrowEl) arrowEl.classList.add('bn-collapsed');
      // 记住用户选择的模式
      window.BiViNote.state.settings.lastOpenMode = 'collapsed';
      window.BiViNote.settings.save();
    } else {
      // 展开：显示主内容区域
      panelEl.classList.remove('bn-collapsed');
      if (arrowEl) arrowEl.classList.remove('bn-collapsed');
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
    let startX = 0, startY = 0;

    el.addEventListener('mousedown', (e) => {
      // 只有点击 icon 区域才触发拖动
      if (!e.target.closest('.bn-collapse-icon')) return;
      isDragging = true;
      hasMoved = false;
      isDraggingCollapse = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      // 5px 距离阈值，避免微小移动误判为拖动
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.sqrt(dx * dx + dy * dy) <= 5) return;
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

  // ── 面板存活保护 ──
  // B站视频脚本会多次替换整个 #app，用 setInterval 持续守护面板

  let panelSurvivalTimer = null;

  function startPanelSurvival() {
    stopPanelSurvival();
    if (!panelEl) return;

    panelSurvivalTimer = setInterval(() => {
      if (!panelEl) return;
      if (panelEl.isConnected) return; // 面板正常在 DOM 中

      // 面板被移除了，等新 #danmukuBox 出现后重新插入
      console.warn('[BiViNote] Panel detached, re-inserting...');
      reinsertWhenReady();
    }, 200);
  }

  function stopPanelSurvival() {
    if (panelSurvivalTimer) {
      clearInterval(panelSurvivalTimer);
      panelSurvivalTimer = null;
    }
  }

  // 等待新 #app 渲染完成后重新插入面板
  function reinsertWhenReady(attempts) {
    attempts = attempts || 0;
    requestAnimationFrame(() => {
      if (panelEl.isConnected) return; // 已被其他逻辑插入
      const box = document.getElementById('danmukuBox');
      if (box) {
        box.insertBefore(panelEl, box.firstChild);
        console.log('[BiViNote] Panel re-inserted into new #danmukuBox');
        // 延迟检查导航栏（等 Vue 渲染完成）
        setTimeout(checkNavRecovery, 500);
      } else if (attempts < 60) {
        reinsertWhenReady(attempts + 1);
      } else {
        document.body.appendChild(panelEl);
        console.warn('[BiViNote] Panel re-inserted into body (fallback)');
        setTimeout(checkNavRecovery, 500);
      }
    });
  }

  // 检测导航栏丢失并尝试恢复
  // B站视频脚本替换 #app 后，新的 MainHeaderV3 组件可能未正确渲染
  // 此时从 Vue 组件树中找到旧的（已分离但内容完整）的 MainHeaderV3，复制其 HTML
  function checkNavRecovery() {
    const nav = document.getElementById('biliMainHeader');
    if (nav && nav.childElementCount > 0) return; // 导航栏有内容，正常

    const app = document.getElementById('app');
    const vue = app?.__vue__;

    // 尝试从 Vue 组件树恢复导航栏内容
    if (vue && vue.$children) {
      // 找到所有 MainHeaderV3 组件
      const headerComponents = vue.$children.filter(c => {
        const tag = c.$options?.tag || c.$options?._componentTag || c.$options?.name;
        return tag === 'MainHeaderV3';
      });

      // 找到有内容但已分离的旧组件（elConnected: false, innerHTML 有内容）
      const oldHeader = headerComponents.find(c => !c.$el.isConnected && c.$el.innerHTML.length > 0);

      if (oldHeader) {
        console.log('[BiViNote] Nav bar empty, recovering from old MainHeaderV3 component...');
        nav.innerHTML = oldHeader.$el.innerHTML;
        return;
      }

      // 备用：强制重渲染
      console.warn('[BiViNote] Nav bar empty, attempting forceUpdate...');
      try {
        vue.$forceUpdate();
      } catch(e) { console.warn(e); }
    }

    // 以上方法都无效，尝试触发 popstate
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  // ── 显示/隐藏面板 ──

  function show() {
    if (!panelEl) createPanel();
    panelEl.classList.remove('bn-hidden');
    window.BiViNote.state.panelVisible = true;

    // 根据设置决定是否展开
    const s = window.BiViNote.state;
    const defaultExpand = s.settings.defaultExpand !== false;
    if (defaultExpand) {
      // 展开面板
      s.collapsed = false;
      panelEl.classList.remove('bn-collapsed');
      if (arrowEl) arrowEl.classList.remove('bn-collapsed');
      s.settings.lastOpenMode = 'panel';
    } else {
      // 折叠面板
      s.collapsed = true;
      panelEl.classList.add('bn-collapsed');
      if (arrowEl) arrowEl.classList.add('bn-collapsed');
      s.settings.lastOpenMode = 'collapsed';
    }
    window.BiViNote.settings.save();
    loadSettingsToUI();
    applyDisplaySettings();
    // 自动加载字幕：无数据或 URL 变化时刷新
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
      window.BiViNote.state.panelVisible = false;
      window.BiViNote.state.collapsed = false;
    }
  }

  function showCollapse() {
    if (collapseContainerEl) {
      // 设置默认位置（右上角）
      if (!collapseContainerEl.style.left) {
        collapseContainerEl.style.left = (window.innerWidth - BTN_SIZE - EDGE_MARGIN) + 'px';
        collapseContainerEl.style.top = '100px';
      }
      collapseContainerEl.classList.remove('bn-hidden');
    }
  }

  function hideCollapse() {
    if (collapseContainerEl) {
      collapseContainerEl.classList.add('bn-hidden');
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
    const langLabel = panelEl?.querySelector('#bn-lang-label');
    const langMenu = panelEl?.querySelector('#bn-lang-menu');
    if (!langLabel || !langMenu) return;

    if (!subtitles || subtitles.length === 0) {
      langLabel.textContent = '暂无字幕';
      langMenu.innerHTML = '';
      return;
    }

    // 更新按钮文本
    const selected = subtitles.find(s => s.subtitleUrl === selectedUrl);
    const aiTag = selected?.lan?.startsWith('ai-') ? ' [AI]' : '';
    langLabel.textContent = selected ? `${selected.lanDoc || selected.lan}${aiTag}` : '选择语言';

    // 更新菜单项
    langMenu.innerHTML = subtitles.map(item => {
      const aiTag = item.lan?.startsWith('ai-') ? ' [AI]' : '';
      const label = `${item.lanDoc || item.lan}${aiTag}`;
      const activeClass = item.subtitleUrl === selectedUrl ? ' active' : '';
      return `<div class="bn-lang-item${activeClass}" data-url="${escapeHtml(item.subtitleUrl)}" data-lang="${escapeHtml(item.lan)}">${escapeHtml(label)}</div>`;
    }).join('');

    // 绑定菜单项点击事件
    langMenu.querySelectorAll('.bn-lang-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        const lang = item.dataset.lang;
        if (url && window.BiViNote.subtitle) {
          window.BiViNote.subtitle.switchSubtitle(url, lang);
        }
        langMenu.classList.remove('show');
      });
    });
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
    showCollapse,
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
