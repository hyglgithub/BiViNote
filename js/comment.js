// js/comment.js - 发评论模块（「发评论」）
// 把 DeepSeek 文档整理的 AI 结果(Markdown) 剥成纯文本，做 ≤950 字安全线/登录预检后，
// 交由 background 注入视频页 MAIN world 自动填入评论区并发布（移植自 bilibili-comment-extension）。
(function () {
  'use strict';
  const BN = window.BiViNote;
  if (!BN) return;

  const LIMIT = 950; // 安全线：B 站评论上限 1000 字，留 50 字余量规避边界判定差异

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  // Markdown → 纯文本（评论不支持格式/图片；对本来就是纯文本的结果是无损 no-op）
  function toPlain(md) {
    let s = String(md || '');
    // 整行图片 ![alt](assets/x.png) → 删除（图片发不进评论）
    s = s.replace(/^\s*!\[[^\]]*\]\([^)]*\)\s*$/gm, '');
    // 代码块围栏
    s = s.replace(/```[\s\S]*?(```|$)/g, '');
    // 行首标题符
    s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    // 链接保留文字
    s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    // 行首列表符号
    s = s.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '');
    // 强调/代码/删除线等残留符号
    s = s.replace(/[*_`~#]/g, '');
    // 折叠空白、换行转空格
    return s.replace(/\s+/g, ' ').trim();
  }

  // 后台 step 码 → 中文提示（文案对齐独立扩展 popup）
  function stepText(step, raw) {
    const map = {
      meta: '不是可识别的 bilibili 视频页（拿不到视频信息）',
      csrf: '未登录：读不到 bili_jct cookie',
      empty: '评论内容为空',
      input: '写入评论区输入框失败（未发送）',
      publish: '找不到「发布」按钮，页面结构可能变了',
      api: '直连接口发送失败：',
      risk: '发布被拦截：',
      unknown: '发生未知错误：',
    };
    return (map[step] || '') + (raw || '');
  }

  async function send(text) {
    const msg = String(text || '').replace(/\u0000/g, '').trim();
    if (!msg) return { ok: false, error: '评论内容为空' };
    if (msg.length > LIMIT) {
      return { ok: false, error: `评论过长(${msg.length}字，超过 ${LIMIT} 字安全线)，未发送，请调整提示词重新整理` };
    }
    // 登录预检：csrf(bili_jct) 非 HttpOnly，本世界可读；读不到多半未登录（同 bili-note）
    if (!getCookie('bili_jct')) return { ok: false, error: '请先在 bilibili 登录后再发评论' };

    const resp = await new Promise((resolve) => {
      let settled = false;
      const finish = (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
      const timer = setTimeout(() => finish({ ok: false, error: '发送超时，请重试' }), 20000);
      try {
        chrome.runtime.sendMessage({ type: 'bn-send-comment', text: msg }, finish);
      } catch (e) {
        finish({ ok: false, error: String((e && e.message) || e) });
      }
    });
    if (!resp) return { ok: false, error: '后台无响应，请刷新页面后重试' };
    if (!resp.ok) return { ok: false, error: (resp.result && resp.result.error) || resp.error || '发送失败' };

    const r = resp.result || {};
    if (!r.ok) return { ok: false, error: stepText(r.step, r.error || '') };
    // 成功：UI 路线拿不到网络响应，uncertain 时提示回页面确认
    if (r.method === 'ui') {
      if (r.uncertain) return { ok: true, uncertain: true, detail: r.detail || '已点击发布，请回页面确认' };
      return { ok: true, uncertain: false, detail: '' };
    }
    // API 路线有 rpid
    return { ok: true, uncertain: false, detail: 'rpid=' + (r.rpid || '?') };
  }

  window.BiViNote.comment = { LIMIT, toPlain, send };
})();
