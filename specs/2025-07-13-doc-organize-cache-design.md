# 文档整理缓存功能设计

**日期：** 2025-07-13
**状态：** 已批准

## 1. 概述

为 BiViNote 的文档整理功能添加缓存，使用户打开同一个视频时无需再次整理，并在 options 页面提供历史记录查看功能。

### 核心需求

- 缓存所有提示词的整理结果（summary, clear, 自定义）
- 保留最近 50 个视频的记录，超出自动清理
- options 页面简单列表展示（时间倒序，可查看/删除）
- 整理完成时自动保存

## 2. 数据结构

### 存储 Key 设计

| Key | 用途 | 示例 |
|-----|------|------|
| `cache_index` | 视频索引（最近视频列表） | `{ 'BV1xxxx_p1': { title, timestamp, promptTypes } }` |
| `cache_{bvid}_{p}` | 单个视频的缓存数据 | `{ 'summary': { think, response } }` |

### 复合 Key 格式

```javascript
function buildCacheKey(bvid, pageIndex) {
  return `${bvid}_p${pageIndex || 1}`;
}
```

**示例：**
- `BV1xxxx_p1` — 第 1P
- `BV1xxxx_p2` — 第 2P
- `BV1xxxx` — 无分P视频（默认 p1）

### cache_index 结构

```javascript
{
  'BV1xxxx_p1': {
    title: '视频标题 - P1',
    bvid: 'BV1xxxx',
    pageIndex: 1,
    timestamp: 1234567890,
    promptTypes: ['summary', 'clear']
  }
}
```

### cache_{bvid}_{p} 结构

```javascript
{
  'summary': { think: '思考过程...', response: '整理结果...' },
  'clear': { think: '...', response: '...' },
  'custom_xxx': { think: '...', response: '...' }
}
```

### 容量估算

- 每个视频平均：50-100KB
- 5MB 限制：约可存储 50-100 个视频
- 默认保留：最近 50 个视频

## 3. 缓存管理模块

**新增文件：** `js/cache.js`

### API

| 方法 | 说明 |
|------|------|
| `getCache(bvid, pageIndex)` | 获取视频缓存 |
| `saveCache(bvid, pageIndex, title, promptType, think, response)` | 保存缓存 |
| `deleteCache(bvid, pageIndex)` | 删除缓存 |
| `getRecentVideos()` | 获取最近视频列表（按时间倒序） |

### 清理策略

当缓存数量超过 `MAX_CACHE_SIZE`（50）时，自动删除最旧的记录。

## 4. 集成方案

### 4.1 自动保存（deepseek.js）

在 `ds-done` 消息处理中触发：

```javascript
if (msg.type === 'ds-done') {
  flush(task);
  setState(task, 'done');
  emit(task, 'done', getResult(task.id));
  autoSaveCache(task);  // 新增
}
```

### 4.2 加载缓存（panel.js）

在 `switchTab('doc')` 时检查缓存：

```javascript
if (tabId === 'doc') {
  const cache = window.BiViNote.cache;
  const s = window.BiViNote.state;

  cache.getCache(s.bvid, s.pageIndex || 1).then(cached => {
    if (cached) {
      Object.keys(cached).forEach(promptType => {
        const task = ds.getTask(promptType);
        const data = cached[promptType];
        task.thinkText = data.think;
        task.responseText = data.response;
        task.state = 'done';
      });
    }
    // 继续登录检测...
  });
}
```

### 4.3 清除缓存（panel.js）

清除按钮点击时同步删除缓存：

```javascript
clearBtn.addEventListener('click', async () => {
  ds.clear(currentPromptType);
  await cache.deleteCache(s.bvid, s.pageIndex || 1);
});
```

## 5. Options 页面 UI

### 历史记录区域

在提示词管理下方添加：

```html
<div class="section">
  <h2>📚 文档整理历史</h2>
  <div id="history-list" class="history-list"></div>
</div>
```

### 列表项结构

每个卡片显示：
- 视频标题
- BV号和分P信息
- 最后整理时间
- 已缓存的提示词类型标签
- 查看/删除按钮

### 交互

- **查看：** 展开显示所有提示词的结果，支持复制
- **删除：** 确认后删除该视频的所有缓存

## 6. 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `js/cache.js` | **新增** - 缓存管理模块 |
| `js/deepseek.js` | 整理完成时自动保存缓存 |
| `js/panel.js` | 打开视频时加载缓存，清除时同步删除缓存 |
| `js/options.js` | 渲染历史记录列表，查看/删除操作 |
| `options.html` | 添加历史记录区域和样式 |
| `manifest.json` | 添加 cache.js |

## 7. 加载时序

```
state.js → settings.js → cache.js → 其他模块
                                    ↓
                              cache 模块可用
                                    ↓
                    deepseek.js / panel.js 调用 cache
```
