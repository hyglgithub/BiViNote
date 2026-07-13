// BiViNote Options Page Script
// 提示词管理功能

const DEFAULT_PROMPTS = {
  clear: { name: '文档清洗', prompt: `你是一个视频笔记整理助手，将视频导出的 Markdown 文档整理为简洁、高质量、适合长期保存的 Markdown 学习笔记。

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

直接输出整理后的 Markdown 文档，不要输出任何额外内容。` },

  summary: { name: '文档总结', prompt: `你是一个视频总结助手，请根据提供的视频字幕文档生成简洁、准确的视频总结。

要求：
1. 仅依据字幕内容进行总结，不得添加、猜测或推断原文未提及的信息。
2. 提炼视频的核心主题、主要观点或关键内容，忽略寒暄、口头禅、广告、重复内容等无关信息。
3. 总结长度为 3–5 句话，覆盖视频的主要内容即可，不要展开细节。
4. 使用自然流畅、客观中立的中文表达。
5. 输出一段连续文本，不使用标题、列表、Markdown、引号或其他格式。
6. 如果字幕内容不完整或存在缺失，仅总结能够确定的内容，不要补充或猜测。

待总结文档：

{markdown}

直接输出总结，不要输出任何额外说明。` }
};

// ============ 工具函数 ============

function escapeHtml(text) {
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}

function truncate(text, max) {
  return text.length > max ? text.substring(0, max) + '...' : text;
}

// ============ 加载/保存设置 ============

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bivinote_settings'], (result) => {
      resolve(result.bivinote_settings || {});
    });
  });
}

async function saveSettings(patch) {
  const settings = await loadSettings();
  const merged = { ...settings, ...patch };
  return new Promise((resolve) => {
    chrome.storage.local.set({ bivinote_settings: merged }, resolve);
  });
}

// ============ 状态 ============

let selectedCardId = null; // null = 新建模式, 'ds'|'summary'|'custom_xxx' = 编辑模式

// ============ 获取所有提示词列表 ============

async function getAllPrompts() {
  const settings = await loadSettings();
  const customPrompts = settings.customPrompts || [];
  const packImagesMap = settings.promptPackImages || {};

  const list = [
    { id: 'summary', name: '文档总结', prompt: settings.deepseekSummary || DEFAULT_PROMPTS.summary.prompt, builtin: true, packImages: packImagesMap.summary ?? false },
    { id: 'clear', name: '文档清洗', prompt: settings.deepseekPrompt || DEFAULT_PROMPTS.clear.prompt, builtin: true, packImages: packImagesMap.clear ?? true }
  ];

  customPrompts.forEach(p => {
    list.push({ id: p.id, name: p.name, prompt: p.prompt, builtin: false, packImages: p.packImages ?? false });
  });

  return list;
}

// ============ 渲染卡片网格 ============

async function renderPromptCards() {
  const grid = document.getElementById('prompt-grid');
  if (!grid) return;

  const prompts = await getAllPrompts();

  grid.innerHTML = prompts.map(p => `
    <div class="prompt-card${selectedCardId === p.id ? ' selected' : ''}" data-id="${p.id}">
      <div class="prompt-card-header">
        <span class="prompt-card-name">${escapeHtml(p.name)}</span>
        <span class="prompt-card-badge ${p.builtin ? 'builtin' : 'custom'}">${p.builtin ? '内置' : '自定义'}</span>
        <div style="position: relative;">
          <button class="more-btn" data-id="${p.id}" title="更多">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
          <div class="dropdown" data-id="${p.id}">
            ${p.builtin ? `<button class="dropdown-item reset-btn" data-id="${p.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              重置
            </button>` : `<button class="dropdown-item danger delete-btn" data-id="${p.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/></svg>
              删除
            </button>`}
          </div>
        </div>
      </div>
      <p class="prompt-card-preview">${escapeHtml(truncate(p.prompt, 80))}</p>
    </div>
  `).join('');

  // 绑定卡片点击事件
  grid.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.more-btn') || e.target.closest('.dropdown')) return;
      selectCard(card.dataset.id);
    });
  });

  // 绑定更多按钮
  grid.querySelectorAll('.more-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // 关闭其他下拉菜单
      grid.querySelectorAll('.dropdown').forEach(d => d.classList.remove('show'));
      btn.nextElementSibling.classList.toggle('show');
    });
  });

  // 绑定重置按钮
  grid.querySelectorAll('.reset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetPrompt(btn.dataset.id);
      btn.closest('.dropdown').classList.remove('show');
    });
  });

  // 绑定删除按钮
  grid.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCustomPrompt(btn.dataset.id);
      btn.closest('.dropdown').classList.remove('show');
    });
  });
}

// ============ 选中卡片 ============

async function selectCard(id) {
  selectedCardId = id;
  const prompts = await getAllPrompts();
  const p = prompts.find(item => item.id === id);
  if (!p) return;

  document.getElementById('edit-content').value = p.prompt;
  document.getElementById('edit-name').value = p.name;
  document.getElementById('edit-pack-images').checked = p.packImages;

  document.getElementById('edit-title').textContent = '编辑提示词';

  document.getElementById('btn-cancel').classList.add('show');
  updateSaveButton();

  // 更新卡片选中状态
  document.querySelectorAll('.prompt-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });
}

// ============ 取消选中（回到新建模式） ============

function resetToCreateMode() {
  selectedCardId = null;
  document.getElementById('edit-content').value = '';
  document.getElementById('edit-name').value = '';
  document.getElementById('edit-pack-images').checked = false;

  document.getElementById('edit-title').textContent = '新建提示词';

  document.getElementById('btn-cancel').classList.remove('show');
  updateSaveButton();

  document.querySelectorAll('.prompt-card').forEach(c => c.classList.remove('selected'));
}

// ============ 更新保存按钮状态 ============

function updateSaveButton() {
  const name = document.getElementById('edit-name').value.trim();
  const content = document.getElementById('edit-content').value.trim();
  document.getElementById('btn-save').disabled = !(name && content);
}

// ============ 保存提示词 ============

async function savePrompt() {
  const name = document.getElementById('edit-name').value.trim();
  const content = document.getElementById('edit-content').value.trim();
  const packImages = document.getElementById('edit-pack-images').checked;
  if (!name || !content) return;

  if (selectedCardId) {
    // 编辑模式
    if (selectedCardId === 'clear') {
      const settings = await loadSettings();
      const packImagesMap = settings.promptPackImages || {};
      packImagesMap.clear = packImages;
      await saveSettings({ deepseekPrompt: content, promptPackImages: packImagesMap });
    } else if (selectedCardId === 'summary') {
      const settings = await loadSettings();
      const packImagesMap = settings.promptPackImages || {};
      packImagesMap.summary = packImages;
      await saveSettings({ deepseekSummary: content, promptPackImages: packImagesMap });
    } else {
      // 自定义提示词
      const settings = await loadSettings();
      const customPrompts = settings.customPrompts || [];
      const index = customPrompts.findIndex(p => p.id === selectedCardId);
      if (index !== -1) {
        customPrompts[index] = { ...customPrompts[index], name, prompt: content, packImages };
        await saveSettings({ customPrompts });
      }
    }
  } else {
    // 新建模式
    const settings = await loadSettings();
    const customPrompts = settings.customPrompts || [];
    const id = 'custom_' + Date.now();
    customPrompts.push({ id, name, prompt: content, packImages });
    await saveSettings({ customPrompts });
  }

  await renderPromptCards();
  resetToCreateMode();
}

// ============ 重置提示词 ============

async function resetPrompt(id) {
  if (id === 'clear') {
    await saveSettings({ deepseekPrompt: DEFAULT_PROMPTS.clear.prompt });
  } else if (id === 'summary') {
    await saveSettings({ deepseekSummary: DEFAULT_PROMPTS.summary.prompt });
  } else {
    // 自定义提示词重置 = 删除
    await deleteCustomPrompt(id);
    return;
  }

  // 如果当前正在编辑这个提示词，刷新编辑区
  if (selectedCardId === id) {
    const prompts = await getAllPrompts();
    const p = prompts.find(item => item.id === id);
    if (p) {
      document.getElementById('edit-content').value = p.prompt;
      document.getElementById('edit-name').value = p.name;
    }
  }

  await renderPromptCards();
}

// ============ 删除自定义提示词 ============

async function deleteCustomPrompt(id) {
  if (!confirm('确定删除此提示词？')) return;

  const settings = await loadSettings();
  const customPrompts = (settings.customPrompts || []).filter(p => p.id !== id);
  await saveSettings({ customPrompts });

  if (selectedCardId === id) {
    resetToCreateMode();
  }

  await renderPromptCards();
}

// ============ 历史记录 ============

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';

  return date.toLocaleDateString('zh-CN');
}

function getPromptName(promptType) {
  if (promptType === 'summary') return Promise.resolve('文档总结');
  if (promptType === 'clear') return Promise.resolve('文档清洗');

  // 从 chrome.storage.local 获取自定义提示词
  return new Promise((resolve) => {
    chrome.storage.local.get('bivinote_settings', (result) => {
      const settings = result.bivinote_settings || {};
      const customPrompts = settings.customPrompts || [];
      const custom = customPrompts.find(p => p.id === promptType);
      resolve(custom ? custom.name : promptType);
    });
  });
}

async function renderHistory() {
  const cache = window.BiViNote.cache;
  if (!cache) return;

  const listEl = document.getElementById('history-list');
  if (!listEl) return;

  const videos = await cache.getRecentVideos();

  if (videos.length === 0) {
    listEl.innerHTML = '<div class="history-empty">暂无整理记录</div>';
    return;
  }

  // 预加载所有提示词名称
  const promptNameCache = {};
  const allPromptTypes = [...new Set(videos.flatMap(v => v.promptTypes))];
  await Promise.all(allPromptTypes.map(async (t) => {
    promptNameCache[t] = await getPromptName(t);
  }));

  listEl.innerHTML = videos.map(video => `
    <div class="history-card">
      <div class="history-header">
        <div class="history-title">${escapeHtml(video.title)}</div>
        <div class="history-time">${formatTime(video.timestamp)}</div>
      </div>
      <div class="history-meta">
        <span class="history-bvid">${video.bvid}${video.pageIndex > 1 ? ' P' + video.pageIndex : ''}</span>
        <span class="history-prompt-types">
          ${video.promptTypes.map(t => `<span class="history-tag">${escapeHtml(promptNameCache[t])}</span>`).join('')}
        </span>
      </div>
      <div class="history-actions">
        <button class="btn-view" data-bvid="${video.bvid}" data-page="${video.pageIndex}">查看</button>
        <button class="btn-delete" data-bvid="${video.bvid}" data-page="${video.pageIndex}">删除</button>
      </div>
    </div>
  `).join('');

  // 绑定事件
  listEl.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', () => viewHistory(btn.dataset.bvid, parseInt(btn.dataset.page)));
  });
  listEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteHistory(btn.dataset.bvid, parseInt(btn.dataset.page)));
  });
}

async function viewHistory(bvid, pageIndex) {
  const cache = window.BiViNote.cache;
  const data = await cache.getCache(bvid, pageIndex);
  if (!data) return;

  showHistoryModal(bvid, pageIndex, data);
}

async function showHistoryModal(bvid, pageIndex, data) {
  // 创建模态框
  let modal = document.getElementById('history-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'history-modal';
    modal.className = 'history-modal';
    modal.innerHTML = `
      <div class="history-modal-content">
        <div class="history-modal-header">
          <span class="history-modal-title">整理结果</span>
          <button class="history-modal-close">✕</button>
        </div>
        <div class="history-modal-body"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.history-modal-close').addEventListener('click', () => {
      modal.classList.remove('show');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('show');
    });
  }

  // 预加载所有提示词名称
  const promptNames = {};
  await Promise.all(Object.keys(data).map(async (promptType) => {
    promptNames[promptType] = await getPromptName(promptType);
  }));

  // 按时间戳排序（最新在前）
  const sortedEntries = Object.entries(data).sort((a, b) => {
    return (b[1].timestamp || 0) - (a[1].timestamp || 0);
  });

  const body = modal.querySelector('.history-modal-body');
  body.innerHTML = sortedEntries.map(([promptType, result]) => `
    <div class="history-result-item">
      <div class="history-result-label">${escapeHtml(promptNames[promptType])}</div>
      <div class="history-result-content">${escapeHtml(result.response)}</div>
    </div>
  `).join('');

  modal.classList.add('show');
}

async function deleteHistory(bvid, pageIndex) {
  if (!confirm('确定删除这条记录？')) return;

  const cache = window.BiViNote.cache;
  await cache.deleteCache(bvid, pageIndex);
  await renderHistory();
}

// ============ 关于页面 ============

function renderAboutPage() {
  // 版本号
  const versionEl = document.getElementById('about-version');
  if (versionEl) {
    const manifest = chrome.runtime.getManifest();
    versionEl.textContent = 'v' + manifest.version;
  }

  // 更新日志
  renderChangelog();
}

async function renderChangelog() {
  const container = document.getElementById('about-changelog');
  if (!container) return;

  try {
    const response = await fetch(chrome.runtime.getURL('CHANGELOG.md'));
    const text = await response.text();
    const versions = parseChangelog(text);

    container.innerHTML = versions.map(v => `
      <div class="changelog-version">
        <div class="changelog-header">
          <span class="changelog-tag">${escapeHtml(v.version)}</span>
          <span class="changelog-date">${escapeHtml(v.date)}</span>
        </div>
        <ul class="changelog-items">
          ${v.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p style="color: #999; font-size: 14px;">无法加载更新日志</p>';
  }
}

function parseChangelog(text) {
  const versions = [];
  const lines = text.split('\n');
  let currentVersion = null;

  for (const line of lines) {
    // 匹配版本标题：## [x.y.z] - YYYY-MM-DD
    const versionMatch = line.match(/^##\s+\[?(\d+\.\d+\.\d+)\]?\s*-\s*(\d{4}-\d{2}-\d{2})/);
    if (versionMatch) {
      currentVersion = {
        version: versionMatch[1],
        date: versionMatch[2],
        items: []
      };
      versions.push(currentVersion);
      continue;
    }

    // 匹配列表项：- xxx
    const itemMatch = line.match(/^-\s+(.+)/);
    if (itemMatch && currentVersion) {
      currentVersion.items.push(itemMatch[1]);
    }
  }

  return versions;
}

// ============ 初始化 ============

document.addEventListener('DOMContentLoaded', async () => {
  // 导航切换
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.getAttribute('data-section');
      navItems.forEach(nav => nav.classList.remove('active'));
      sections.forEach(sec => sec.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('section-' + sectionId).classList.add('active');
      if (sectionId === 'history') {
        renderHistory();
      }
    });
  });

  // 渲染卡片
  await renderPromptCards();

  // 渲染关于页面
  renderAboutPage();

  // 输入监听
  document.getElementById('edit-name').addEventListener('input', updateSaveButton);
  document.getElementById('edit-content').addEventListener('input', updateSaveButton);

  // 保存按钮
  document.getElementById('btn-save').addEventListener('click', savePrompt);

  // 取消按钮
  document.getElementById('btn-cancel').addEventListener('click', resetToCreateMode);

  // 点击其他地方关闭下拉菜单
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.more-btn') && !e.target.closest('.dropdown')) {
      document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('show'));
    }
  });

});
