// js/bili-note.js - B站笔记保存模块（「记笔记」）
// 把 DeepSeek 文档整理的 AI 结果(Markdown) 转为 /x/note/add 所需 payload，
// 交由 background 注入视频页 MAIN world 上传图片并保存为私有草稿。
// 一个视频一篇：note_id 按 bvid 持久化于 chrome.storage.local['biliNoteIds']。
(function () {
  'use strict';
  const BN = window.BiViNote;
  if (!BN) return;

  const STORE_KEY = 'biliNoteIds';   // { [bvid]: note_id }

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  // 截图 blob → {dataUrl, width}（width 取图原始宽，失败默认 600）
  function blobToImageData(blob) {
    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          if (!dataUrl) { resolve(null); return; }
          try {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => { const w = img.naturalWidth || 0; URL.revokeObjectURL(url); resolve({ dataUrl, width: w || 600 }); };
            img.onerror = () => { URL.revokeObjectURL(url); resolve({ dataUrl, width: 600 }); };
            img.src = url;
          } catch { resolve({ dataUrl, width: 600 }); }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      } catch { resolve(null); }
    });
  }

  // 由 md + 本次会话截图快照 构建 payload；缺图时返回 { error }
  async function buildPayload(md, shots) {
    const s = BN.state;
    const BiliMarkup = window.BiliMarkup;
    if (!BiliMarkup) return { error: '解析器未加载，请刷新页面后重试' };

    const plan = BiliMarkup.plan(md);
    if (!plan.length) return null;

    // 集图：去重后的 label -> {dataUrl,width}；label 形如 "0043.png"
    const seen = new Set();
    const unique = [];
    for (const l of BiliMarkup.imgLabels(md)) {
      if (l && !seen.has(l)) { seen.add(l); unique.push(l); }
    }
    const images = {};
    if (unique.length) {
      if (!shots || typeof shots.forEach !== 'function') {
        return { error: '缺少本次会话的截图（截图仅在整理当时可用，请重新整理后再记笔记）' };
      }
      // shots: Map<index,{blob,url,timeCode,timeSeconds}>；md 里 assets 文件名 = (timeCode||'0000')+'.png'
      const byFile = new Map();
      for (const [, v] of shots) {
        const file = (v.timeCode || '0000') + '.png';
        if (!byFile.has(file)) byFile.set(file, v.blob);
      }
      const missing = [];
      for (const label of unique) {
        const blob = byFile.get(label);
        if (!blob) { missing.push(label); continue; }
        const data = await blobToImageData(blob);
        if (data) images[label] = data;
        else missing.push(label);
      }
      if (missing.length) {
        return { error: '缺少截图 ' + missing.join('、') + '（截图仅在整理当时可用，请重新整理后再记笔记）' };
      }
    }

    // 读 note_id（一个视频一篇，跨会话）
    let noteId = '';
    try {
      const stored = await new Promise((res) => chrome.storage.local.get(STORE_KEY, res));
      const map = stored[STORE_KEY] || {};
      if (s.bvid && map[s.bvid]) noteId = map[s.bvid];
    } catch {}

    return {
      payload: {
        plan,
        images,
        noteId,
        aid: s.aid,
        cid: s.cid,
        title: (s.title || '').slice(0, 40),
      },
    };
  }

  async function save({ response, shots }) {
    const md = String(response || '').trim();
    if (!md) return { ok: false, error: '没有可保存的内容' };
    const s = BN.state;
    if (!s.bvid) return { ok: false, error: '未识别到当前视频' };
    // 登录预检：csrf(bili_jct) 非 HttpOnly，本世界可读；读不到多半未登录
    if (!getCookie('bili_jct')) return { ok: false, error: '请先在 bilibili 登录后再记笔记' };

    let built;
    try {
      built = await buildPayload(md, shots);
    } catch (e) {
      return { ok: false, error: '解析失败：' + String((e && e.message) || e) };
    }
    if (!built) return { ok: false, error: '没有可保存的内容' };
    if (built.error) return { ok: false, error: built.error };

    const resp = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'bn-note-save', payload: built.payload }, resolve);
      } catch (e) {
        resolve({ ok: false, error: String((e && e.message) || e) });
      }
    });
    if (!resp) return { ok: false, error: '后台无响应，请刷新页面后重试' };
    if (!resp.ok) return { ok: false, error: resp.error || '保存失败' };

    const result = resp.result || {};
    // 成功：回写 note_id（覆盖更新用）
    if (result.note_id) {
      try {
        const stored = await new Promise((res) => chrome.storage.local.get(STORE_KEY, res));
        const map = Object.assign({}, stored[STORE_KEY] || {});
        map[s.bvid] = String(result.note_id);
        await new Promise((res) => chrome.storage.local.set({ [STORE_KEY]: map }, res));
      } catch {}
    }
    return { ok: true, created: !!result.created, note_id: result.note_id };
  }

  window.BiViNote.biliNote = { save };
})();
