# 文档整理缓存功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为文档整理功能添加缓存，使用户打开同一个视频时无需再次整理，并在 options 页面提供历史记录查看功能。

**Architecture:** 使用 chrome.storage.local 存储缓存数据，采用索引+数据分离的 key 设计，支持分P视频独立缓存。

**Tech Stack:** JavaScript, Chrome Extension API (chrome.storage.local)

## Global Constraints

- 最大缓存视频数：50
- 存储限制：chrome.storage.local 5MB
- 复合 Key 格式：`{bvid}_p{pageIndex}`
- 缓存触发时机：整理完成（state === 'done'）时自动保存

---

### Task 1: 创建缓存管理模块 (js/cache.js)

**Files:**
- Create: `js/cache.js`

**Interfaces:**
- Produces: `window.BiViNote.cache` 对象，提供 `getCache`, `saveCache`, `deleteCache`, `getRecentVideos` 方法

- [ ] **Step 1: 创建 cache.js 文件框架**

```javascript
// js/cache.js - 文档整理缓存模块
(function () {
  'use strict';
  const BN = window.BiViNote;
  if (!BN) return;

  const MAX_CACHE_SIZE = 50;

  // 模块实现...
})();
```

- [ ] **Step 2: 实现 buildCacheKey 函数**

```javascript
function buildCacheKey(bvid, pageIndex) {
  return `${bvid}_p${pageIndex || 1}`;
}
```

- [ ] **Step 3: 实现 getIndex 和 saveIndex 函数**

```javascript
async function getIndex() {
  return new Promise((resolve) => {
    chrome.storage.local.get('cache_index', (result) => {
      resolve(result.cache_index || {});
    });
  });
}

async function saveIndex(index) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ cache_index: index }, resolve);
  });
}
```

- [ ] **Step 4: 实现 getCache 函数**

```javascript
async function getCache(bvid, pageIndex) {
  const key = buildCacheKey(bvid, pageIndex);
  return new Promise((resolve) => {
    chrome.storage.local.get(`cache_${key}`, (result) => {
      resolve(result[`cache_${key}`] || null);
    });
  });
}
```

- [ ] **Step 5: 实现 saveCache 函数**

```javascript
async function saveCache(bvid, pageIndex, title, promptType, think, response) {
  const key = buildCacheKey(bvid, pageIndex);

  // 1. 更新数据
  const data = await getCache(bvid, pageIndex) || {};
  data[promptType] = { think, response };
  await new Promise(resolve => {
    chrome.storage.local.set({ [`cache_${key}`]: data }, resolve);
  });

  // 2. 更新索引
  const index = await getIndex();
  index[key] = {
    title,
    bvid,
    pageIndex: pageIndex || 1,
    timestamp: Date.now(),
    promptTypes: Object.keys(data)
  };
  await saveIndex(index);

  // 3. 清理超限缓存
  await cleanup();
}
```

- [ ] **Step 6: 实现 deleteCache 函数**

```javascript
async function deleteCache(bvid, pageIndex) {
  const key = buildCacheKey(bvid, pageIndex);
  const index = await getIndex();
  delete index[key];
  await saveIndex(index);
  await new Promise(resolve => {
    chrome.storage.local.remove(`cache_${key}`, resolve);
  });
}
```

- [ ] **Step 7: 实现 cleanup 函数**

```javascript
async function cleanup() {
  const index = await getIndex();
  const entries = Object.entries(index);
  if (entries.length <= MAX_CACHE_SIZE) return;

  entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
  const toDelete = entries.slice(MAX_CACHE_SIZE);

  for (const [key] of toDelete) {
    delete index[key];
    await new Promise(resolve => {
      chrome.storage.local.remove(`cache_${key}`, resolve);
    });
  }
  await saveIndex(index);
}
```

- [ ] **Step 8: 实现 getRecentVideos 函数**

```javascript
async function getRecentVideos() {
  const index = await getIndex();
  return Object.entries(index)
    .map(([key, data]) => ({ key, ...data }))
    .sort((a, b) => b.timestamp - a.timestamp);
}
```

- [ ] **Step 9: 暴露公开接口**

```javascript
BN.cache = {
  getCache,
  saveCache,
  deleteCache,
  getRecentVideos,
  buildCacheKey
};
```

- [ ] **Step 10: 提交代码**

```bash
git add js/cache.js
git commit -m "feat: add cache management module for document organize"
```

---

### Task 2: 集成缓存到 deepseek.js (自动保存)

**Files:**
- Modify: `js/deepseek.js`

**Interfaces:**
- Consumes: `window.BiViNote.cache.saveCache`
- Consumes: `window.BiViNote.state.bvid`, `window.BiViNote.state.pageIndex`

- [ ] **Step 1: 添加 autoSaveCache 函数**

在 `createTask` 函数之后添加：

```javascript
// 自动保存缓存
async function autoSaveCache(task) {
  const cache = window.BiViNote.cache;
  if (!cache) return;

  const s = window.BiViNote.state;
  const bvid = s.bvid;
  const pageIndex = s.pageIndex || 1;
  const title = document.title || '未知视频';

  // 提取视频标题（去掉网站名等后缀）
  const cleanTitle = title.replace(/_哔哩哔哩.*$/, '').trim();

  await cache.saveCache(
    bvid,
    pageIndex,
    cleanTitle,
    task.id,
    task.thinkText.trim(),
    task.responseText.trim()
  );
}
```

- [ ] **Step 2: 在 ds-done 消息处理中调用 autoSaveCache**

找到 `chrome.runtime.onMessage.addListener` 中的 `ds-done` 处理：

```javascript
} else if (msg.type === 'ds-done') {
  if (msg.requestId && msg.requestId !== task.activeRequestId) return;
  flush(task);
  setState(task, 'done');
  emit(task, 'done', getResult(task.id));
  autoSaveCache(task);  // 新增
}
```

- [ ] **Step 3: 提交代码**

```bash
git add js/deepseek.js
git commit -m "feat: auto save cache when document organize completes"
```

---

### Task 3: 集成缓存到 panel.js (加载和清除)

**Files:**
- Modify: `js/panel.js`

**Interfaces:**
- Consumes: `window.BiViNote.cache.getCache`, `window.BiViNote.cache.deleteCache`
- Consumes: `window.BiViNote.state.bvid`, `window.BiViNote.state.pageIndex`

- [ ] **Step 1: 修改 switchTab 函数加载缓存**

找到 `switchTab` 函数中 `if (tabId === 'doc')` 的代码，修改为：

```javascript
if (tabId === 'doc') {
  const ds = window.BiViNote.deepseek;
  const cache = window.BiViNote.cache;

  if (ds && cache) {
    const s = window.BiViNote.state;
    const bvid = s.bvid;
    const pageIndex = s.pageIndex || 1;

    // 检查缓存
    cache.getCache(bvid, pageIndex).then(cached => {
      if (cached) {
        // 恢复所有提示词的缓存结果
        Object.keys(cached).forEach(promptType => {
          const task = ds.getTask(promptType);
          const data = cached[promptType];
          task.thinkText = data.think;
          task.responseText = data.response;
          task.state = 'done';
        });
      }

      // 继续正常的登录检测流程
      const task = ds.getTask('summary');
      if (task.state === 'not_logged_in') {
        ds.checkLogin('summary').then(() => {
          if (refreshDocUI) refreshDocUI();
        });
      } else {
        if (refreshDocUI) refreshDocUI();
      }
    });
  }
}
```

- [ ] **Step 2: 修改清除按钮事件**

找到 `bindDocAutoEvents` 函数中 `clearBtn` 的事件处理，添加缓存清除：

```javascript
if (clearBtn) {
  clearBtn.addEventListener('click', async () => {
    ds.clear(currentPromptType);

    // 新增：同步清除缓存
    const cache = window.BiViNote.cache;
    if (cache) {
      const s = window.BiViNote.state;
      await cache.deleteCache(s.bvid, s.pageIndex || 1);
    }

    if (thinkEl) thinkEl.textContent = '';
    if (resultEl) resultEl.textContent = '';
  });
}
```

- [ ] **Step 3: 提交代码**

```bash
git add js/panel.js
git commit -m "feat: load cache on doc tab and sync delete on clear"
```

---

### Task 4: 更新 manifest.json 添加 cache.js

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: 在 content_scripts 中添加 cache.js**

在 `js/settings.js` 之后添加 `js/cache.js`：

```json
"js": [
  "libs/jszip.min.js",
  "libs/cropper.min.js",
  "libs/wasm-solver.js",
  "js/state.js",
  "js/panel.js",
  "js/subtitle.js",
  "js/chapter.js",
  "js/video-info.js",
  "js/capture.js",
  "js/export.js",
  "js/settings.js",
  "js/cache.js",
  "js/crop-viewer.js",
  "js/deepseek.js",
  "content.js"
],
```

- [ ] **Step 2: 提交代码**

```bash
git add manifest.json
git commit -m "feat: add cache.js to content scripts"
```

---

### Task 5: 更新 options.html 添加历史记录区域

**Files:**
- Modify: `options.html`

- [ ] **Step 1: 添加历史记录区域 HTML**

在 `</div>` 结束标签（section-about 之前）添加：

```html
<!-- 历史记录页面 -->
<div class="section" id="section-history">
    <h2 class="section-title">📚 文档整理历史</h2>
    <div id="history-list" class="history-list">
        <!-- 动态生成 -->
    </div>
</div>
```

- [ ] **Step 2: 添加导航项**

在导航列表中添加历史记录入口：

```html
<ul class="nav-list">
    <li class="nav-item active" data-section="prompts">提示词管理</li>
    <li class="nav-item" data-section="history">整理历史</li>
    <li class="nav-item" data-section="about">更多信息</li>
</ul>
```

- [ ] **Step 3: 添加历史记录样式**

在 `<style>` 标签内添加：

```css
/* ============ 历史记录 ============ */
.history-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.history-card {
    background: #fff;
    border-radius: 8px;
    border: 1px solid #e8e8e8;
    padding: 16px;
    transition: all 0.2s ease;
}

.history-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.history-title {
    font-weight: 600;
    font-size: 15px;
    color: #1a1a1a;
}

.history-time {
    font-size: 12px;
    color: #999;
}

.history-meta {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
    font-size: 13px;
}

.history-bvid {
    color: #666;
}

.history-prompt-types {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.history-tag {
    background: #f0f0ff;
    color: #4f46e5;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
}

.history-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.btn-view {
    padding: 6px 16px;
    background: #409EFF;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.btn-view:hover { background: #337ecc; }

.btn-delete {
    padding: 6px 16px;
    background: #fff;
    color: #ef4444;
    border: 1px solid #ef4444;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.btn-delete:hover { background: #fef2f2; }

.history-empty {
    text-align: center;
    color: #999;
    padding: 60px 20px;
    font-size: 14px;
}

/* 历史详情模态框 */
.history-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
    align-items: center;
    justify-content: center;
}

.history-modal.show {
    display: flex;
}

.history-modal-content {
    background: #fff;
    border-radius: 12px;
    width: 80%;
    max-width: 800px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.history-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #e8e8e8;
}

.history-modal-title {
    font-size: 16px;
    font-weight: 600;
}

.history-modal-close {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    transition: all 0.15s ease;
}

.history-modal-close:hover { background: #f5f5f5; }

.history-modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
}

.history-result-item {
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #f0f0f0;
}

.history-result-item:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
}

.history-result-label {
    font-size: 13px;
    font-weight: 500;
    color: #666;
    margin-bottom: 8px;
}

.history-result-content {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 12px;
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 300px;
    overflow-y: auto;
}
```

- [ ] **Step 4: 添加 cache.js 引入**

在 `<script src="js/options.js"></script>` 之前添加：

```html
<script src="js/cache.js"></script>
```

- [ ] **Step 5: 提交代码**

```bash
git add options.html
git commit -m "feat: add history section to options page"
```

---

### Task 6: 更新 options.js 实现历史记录功能

**Files:**
- Modify: `js/options.js`

**Interfaces:**
- Consumes: `window.BiViNote.cache.getRecentVideos`, `window.BiViNote.cache.getCache`, `window.BiViNote.cache.deleteCache`

- [ ] **Step 1: 添加 renderHistory 函数**

```javascript
// 渲染历史记录列表
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

  listEl.innerHTML = videos.map(video => `
    <div class="history-card" data-key="${video.key}">
      <div class="history-header">
        <div class="history-title">${escapeHtml(video.title)}</div>
        <div class="history-time">${formatTime(video.timestamp)}</div>
      </div>
      <div class="history-meta">
        <span class="history-bvid">${video.bvid}${video.pageIndex > 1 ? ' P' + video.pageIndex : ''}</span>
        <span class="history-prompt-types">
          ${video.promptTypes.map(t => `<span class="history-tag">${getPromptName(t)}</span>`).join('')}
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
```

- [ ] **Step 2: 添加 formatTime 辅助函数**

```javascript
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
```

- [ ] **Step 3: 添加 getPromptName 辅助函数**

```javascript
function getPromptName(promptType) {
  if (promptType === 'summary') return '文档总结';
  if (promptType === 'clear') return '文档清洗';

  const customPrompts = JSON.parse(localStorage.getItem('customPrompts') || '[]');
  const custom = customPrompts.find(p => p.id === promptType);
  return custom ? custom.name : promptType;
}
```

- [ ] **Step 4: 添加 viewHistory 函数**

```javascript
async function viewHistory(bvid, pageIndex) {
  const cache = window.BiViNote.cache;
  const data = await cache.getCache(bvid, pageIndex);
  if (!data) return;

  showHistoryModal(bvid, pageIndex, data);
}
```

- [ ] **Step 5: 添加 showHistoryModal 函数**

```javascript
function showHistoryModal(bvid, pageIndex, data) {
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

  const body = modal.querySelector('.history-modal-body');
  body.innerHTML = Object.entries(data).map(([promptType, result]) => `
    <div class="history-result-item">
      <div class="history-result-label">${getPromptName(promptType)}</div>
      <div class="history-result-content">${escapeHtml(result.response)}</div>
    </div>
  `).join('');

  modal.classList.add('show');
}
```

- [ ] **Step 6: 添加 deleteHistory 函数**

```javascript
async function deleteHistory(bvid, pageIndex) {
  if (!confirm('确定删除这条记录？')) return;

  const cache = window.BiViNote.cache;
  await cache.deleteCache(bvid, pageIndex);
  await renderHistory();
}
```

- [ ] **Step 7: 添加 escapeHtml 函数（如果不存在）**

```javascript
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
```

- [ ] **Step 8: 在页面加载时调用 renderHistory**

在文件末尾的初始化代码中添加：

```javascript
// 初始化历史记录
renderHistory();
```

- [ ] **Step 9: 添加导航切换时刷新历史记录**

找到导航切换逻辑，在切换到 history 时刷新：

```javascript
if (section === 'history') {
  renderHistory();
}
```

- [ ] **Step 10: 提交代码**

```bash
git add js/options.js
git commit -m "feat: implement history list UI in options page"
```

---

### Task 7: 测试和验证

- [ ] **Step 1: 构建扩展**

```bash
node scripts/build.js
```

- [ ] **Step 2: 加载扩展到浏览器**

1. 打开 `chrome://extensions/`
2. 开启开发者模式
3. 点击"加载已解压的扩展程序"
4. 选择 `dist/main/` 目录

- [ ] **Step 3: 测试缓存功能**

1. 打开一个 Bilibili 视频
2. 点击文档整理标签
3. 登录 DeepSeek
4. 选择提示词并开始整理
5. 等待整理完成
6. 刷新页面
7. 再次点击文档整理标签
8. 验证结果是否自动加载

- [ ] **Step 4: 测试历史记录页面**

1. 打开扩展选项页面
2. 点击"整理历史"导航
3. 验证历史记录列表显示
4. 点击"查看"按钮，验证模态框显示
5. 点击"删除"按钮，验证记录删除

- [ ] **Step 5: 测试分P视频**

1. 打开一个分P视频
2. 对不同分P进行整理
3. 验证每个分P独立缓存
4. 在历史记录中验证分P显示

- [ ] **Step 6: 提交最终代码**

```bash
git add -A
git commit -m "feat: complete document organize cache feature"
```
