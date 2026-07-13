/**
 * BiViNote Cache Module
 * 管理文档整理结果的缓存，使用 chrome.storage.local 持久化
 */
(function () {
  'use strict';

  const BN = window.BiViNote;
  if (!BN) return;

  const MAX_CACHE_SIZE = 50;
  const INDEX_KEY = 'bivinote_cache_index';

  /**
   * 生成复合缓存 key
   * @param {string} bvid
   * @param {number|string} pageIndex
   * @returns {string}
   */
  function buildCacheKey(bvid, pageIndex) {
    return `${bvid}_p${pageIndex || 1}`;
  }

  /**
   * 获取缓存索引
   * @returns {Promise<Object>}
   */
  function getIndex() {
    return new Promise(resolve => {
      chrome.storage.local.get([INDEX_KEY], result => {
        if (chrome.runtime.lastError) {
          console.warn('[BiViNote Cache] Get index error:', chrome.runtime.lastError);
          resolve({});
          return;
        }
        resolve(result[INDEX_KEY] || {});
      });
    });
  }

  /**
   * 保存缓存索引
   * @param {Object} index
   * @returns {Promise<void>}
   */
  function saveIndex(index) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [INDEX_KEY]: index }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[BiViNote Cache] Save index error:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  /**
   * 获取缓存数据
   * @param {string} bvid
   * @param {number|string} pageIndex
   * @returns {Promise<Object|null>}
   */
  async function getCache(bvid, pageIndex) {
    const key = buildCacheKey(bvid, pageIndex);
    const storageKey = `bivinote_cache_${key}`;

    return new Promise(resolve => {
      chrome.storage.local.get([storageKey], result => {
        if (chrome.runtime.lastError) {
          console.warn('[BiViNote Cache] Get cache error:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(result[storageKey] || null);
      });
    });
  }

  /**
   * 保存缓存数据
   * @param {string} bvid
   * @param {number|string} pageIndex
   * @param {string} title
   * @param {string} promptType
   * @param {string} think
   * @param {string} response
   */
  async function saveCache(bvid, pageIndex, title, promptType, think, response) {
    const key = buildCacheKey(bvid, pageIndex);
    const storageKey = `bivinote_cache_${key}`;
    const now = Date.now();

    // 获取现有缓存和索引
    const [existingCache, index] = await Promise.all([
      getCache(bvid, pageIndex),
      getIndex()
    ]);

    // 更新缓存数据（包含时间戳）
    const cacheData = existingCache || {};
    cacheData[promptType] = { think, response, timestamp: now };

    // 更新索引
    const entry = index[key] || {
      title: title,
      bvid: bvid,
      pageIndex: pageIndex || 1,
      timestamp: now,
      promptTypes: []
    };

    entry.title = title;
    entry.timestamp = now;

    if (!entry.promptTypes.includes(promptType)) {
      entry.promptTypes.push(promptType);
    }

    index[key] = entry;

    // 自动清理
    await cleanup(index);

    // 保存
    return new Promise(resolve => {
      chrome.storage.local.set({ [storageKey]: cacheData }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[BiViNote Cache] Save cache error:', chrome.runtime.lastError);
        }
        // 更新索引（清理后 index 可能已改变）
        saveIndex(index).then(resolve);
      });
    });
  }

  /**
   * 删除指定 promptType 的缓存条目
   * 如果删除后无剩余 promptType，则删除整个缓存条目
   * @param {string} bvid
   * @param {number|string} pageIndex
   * @param {string} promptType
   */
  async function removePromptType(bvid, pageIndex, promptType) {
    const key = buildCacheKey(bvid, pageIndex);
    const storageKey = `bivinote_cache_${key}`;

    const [cacheData, index] = await Promise.all([
      getCache(bvid, pageIndex),
      getIndex()
    ]);

    if (!cacheData || !cacheData[promptType]) return;

    // 删除指定 promptType
    delete cacheData[promptType];

    // 更新索引中的 promptTypes 数组
    const entry = index[key];
    if (entry && entry.promptTypes) {
      entry.promptTypes = entry.promptTypes.filter(t => t !== promptType);
    }

    const remainingTypes = Object.keys(cacheData);

    if (remainingTypes.length === 0) {
      // 无剩余 promptType，删除整个缓存条目
      delete index[key];
      return new Promise(resolve => {
        chrome.storage.local.remove([storageKey], () => {
          if (chrome.runtime.lastError) {
            console.warn('[BiViNote Cache] Remove promptType error:', chrome.runtime.lastError);
          }
          saveIndex(index).then(resolve);
        });
      });
    }

    // 保存更新后的缓存数据和索引
    return new Promise(resolve => {
      chrome.storage.local.set({ [storageKey]: cacheData }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[BiViNote Cache] Remove promptType error:', chrome.runtime.lastError);
        }
        saveIndex(index).then(resolve);
      });
    });
  }

  /**
   * 删除缓存
   * @param {string} bvid
   * @param {number|string} pageIndex
   */
  async function deleteCache(bvid, pageIndex) {
    const key = buildCacheKey(bvid, pageIndex);
    const storageKey = `bivinote_cache_${key}`;

    const index = await getIndex();

    delete index[key];

    return new Promise(resolve => {
      chrome.storage.local.remove([storageKey], () => {
        if (chrome.runtime.lastError) {
          console.warn('[BiViNote Cache] Delete cache error:', chrome.runtime.lastError);
        }
        saveIndex(index).then(resolve);
      });
    });
  }

  /**
   * 自动清理：当缓存数量超过 MAX_CACHE_SIZE 时删除最旧的记录
   * @param {Object} index - 当前索引（会被就地修改）
   */
  async function cleanup(index) {
    const keys = Object.keys(index);

    if (keys.length <= MAX_CACHE_SIZE) return;

    // 按时间排序，最旧的在前
    keys.sort((a, b) => (index[a].timestamp || 0) - (index[b].timestamp || 0));

    // 计算需要删除的数量
    const toRemove = keys.length - MAX_CACHE_SIZE;
    const removeKeys = keys.slice(0, toRemove);

    // 删除对应的缓存数据
    const storageKeysToRemove = removeKeys.map(k => `bivinote_cache_${k}`);

    return new Promise(resolve => {
      chrome.storage.local.remove(storageKeysToRemove, () => {
        if (chrome.runtime.lastError) {
          console.warn('[BiViNote Cache] Cleanup error:', chrome.runtime.lastError);
        }
        // 从索引中移除
        for (const k of removeKeys) {
          delete index[k];
        }
        resolve();
      });
    });
  }

  /**
   * 获取最近视频列表（按时间倒序）
   * @returns {Promise<Array>}
   */
  async function getRecentVideos() {
    const index = await getIndex();

    const videos = Object.values(index).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return videos;
  }

  // 暴露公开接口
  BN.cache = {
    getCache,
    saveCache,
    deleteCache,
    removePromptType,
    getRecentVideos,
    buildCacheKey
  };
})();
