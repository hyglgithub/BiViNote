// markup.js —— 白名单语法 → plan 令牌流（保存/预览共用）。只支持下面 8 种，其余一律按字面保留。
//
// 支持（白名单，改前先同步 README / AI-PROMPT）：
//   行内：**加粗** ==下划线== ~~删除线~~
//   标题：行首 `# ` `## ` `### ` → bold + 24/22/20px（B站无标题格式，用大字号模拟标题层级）
//   列表：行首 `- ` 无序列表；行首 `1. ` 有序列表（数字只用来识别，显示编号平台自动生成）
//   时间：`` `MM:SS` `` / `` `h:mm:ss` ``（字幕导出的原样写法）→ 视频时间点
//   截图：`![说明](assets/0005.png)` → 图片槽位，记文件名供 popup 按名对号
//
// 不支持（出现即当普通文字，不报错）：`[c:]`/`[bg:]` 颜色、`[px]` 字号、`@0:43` 时间、
//   裸 `[图]`、raw Quill Delta JSON、`####` 及更深的标题。
//
// 输出 token：{kind:'t', t, a?} 文字（a = bold/underline/strike/size）；
//            {kind:'nl', list?} 段界（list = 'bullet'|'ordered'）；
//            {kind:'img', slot, label?} 图片占位（label = 期望文件名）；
//            {kind:'tag', seconds} 视频时间点。
'use strict';

// `` `[h:]mm:ss` `` 或 `![alt](路径)`（在行内切开，各成独立块）
const MARK_RE = /(`(?:[0-9]{1,2}:)?[0-9]{1,2}:[0-9]{2}`)|(!\[[^\]\r\n]*\]\([^)\r\n]*\))/g;

// "1:02:03" / "0:43" / "00:43" → 秒数
function parseClock(str) {
  const p = String(str).split(':').map((n) => parseInt(n, 10) || 0);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : (p[0] || 0) * 60 + (p[1] || 0);
}

/* ---------- 行内格式：把一段纯文字切成 {t, attrs} 叶子（支持 ** == ~~ 互相嵌套） ---------- */
function parseInlineRuns(src) {
  const root = { attrs: {}, segs: [], closer: null };
  const stack = [root];
  let acc = '';
  const flush = () => { if (acc) { stack[stack.length - 1].segs.push({ t: acc }); acc = ''; } };
  let i = 0;
  while (i < src.length) {
    const top = stack[stack.length - 1];
    if (top.closer && src.startsWith(top.closer, i)) { flush(); stack.pop(); i += top.closer.length; continue; }
    let m = null;
    if (src.startsWith('**', i)) m = { open: '**', close: '**', attrs: { bold: true } };
    else if (src.startsWith('==', i)) m = { open: '==', close: '==', attrs: { underline: true } };
    else if (src.startsWith('~~', i)) m = { open: '~~', close: '~~', attrs: { strike: true } };
    if (m) {
      flush();
      const run = { attrs: m.attrs, segs: [], closer: m.close };
      stack[stack.length - 1].segs.push(run);
      stack.push(run);
      i += m.open.length;
      continue;
    }
    acc += src[i]; i++;
  }
  flush();
  const leaves = [];
  (function walk(node, inh) {
    const cur = Object.assign({}, inh, node.attrs);
    for (const s of node.segs) {
      if (s.t) leaves.push({ text: s.t, attrs: cur });
      else walk(s, cur);
    }
  })(root, {});
  return leaves;
}

// 只放行白名单 inline 属性（**==~~ 只会产出这三个）
function sanitizeAttrs(raw) {
  const a = {};
  const r = raw || {};
  if (r.bold) a.bold = true;
  if (r.underline) a.underline = true;
  if (r.strike) a.strike = true;
  return a;
}

// 一段普通文本（不含时间/截图标记）→ 文字 token + 段界（可带标题基础属性 / 列表）
function pushParagraph(plan, raw) {
  let line = String(raw || '').trim();
  if (!line) return;
  const base = {};   // 标题附加到每个文字令牌上的基础属性
  let list = null;
  const h = line.match(/^(#{1,3})\s+(.+)$/);
  if (h) {
    base.bold = true;
    base.size = ['', '24px', '22px', '20px'][h[1].length];
    line = h[2].trim();
  } else {
    const b = line.match(/^-\s+(.+)$/);
    if (b) { list = 'bullet'; line = b[1].trim(); }
    else { const o = line.match(/^(\d+)\.\s+(.+)$/); if (o) { list = 'ordered'; line = o[2].trim(); } }
  }
  if (!line) return;
  for (const L of parseInlineRuns(line)) {
    if (!L.text) continue;
    const a = sanitizeAttrs(L.attrs);
    if (base.bold) a.bold = true;
    if (base.size) a.size = base.size;
    plan.push(Object.keys(a).length ? { kind: 't', t: L.text, a } : { kind: 't', t: L.text });
  }
  plan.push(list ? { kind: 'nl', list } : { kind: 'nl' });
}

// 把一行按时间/截图标记切开：纯文本各成一段；标记各自独立成块（后接段界）
function pushMarkedLine(plan, line, imgState) {
  const re = new RegExp(MARK_RE.source, 'g');
  let last = 0;
  let m;
  let any = false;
  while ((m = re.exec(line))) {
    any = true;
    const pre = line.slice(last, m.index);
    if (pre.trim()) pushParagraph(plan, pre);
    const s = m[0];
    if (s[0] === '!') {
      // markdown 图 → 图片槽；label 记文件名
      const path = s.slice(s.indexOf('(') + 1, -1);
      const file = path.replace(/\\/g, '/').split('/').pop().split('#')[0].split('?')[0].trim();
      plan.push({ kind: 'img', slot: imgState.next++, label: file || undefined });
    } else {
      // `mm:ss`（字幕导出写法）
      plan.push({ kind: 'tag', seconds: parseClock(s.slice(1, -1)) });
    }
    plan.push({ kind: 'nl' });
    last = re.lastIndex;
  }
  if (!any) { pushParagraph(plan, line); return; }
  const tail = line.slice(last);
  if (tail.trim()) pushParagraph(plan, tail);
}

/* ---------- 统一入口：text → plan ---------- */
function toPlan(text) {
  const plan = [];
  const imgState = { next: 0 };
  for (const line of String(text == null ? '' : text).split(/\r?\n/)) {
    if (!line.trim()) continue;
    pushMarkedLine(plan, line, imgState);
  }
  return plan;
}

/* ---------- 工具 ---------- */
function fmtTime(seconds) {
  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), ss = seconds % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? h + ':' + p(m) + ':' + p(ss) : m + ':' + p(ss);
}

// plan → 安全预览 HTML
function htmlFromPlan(plan) {
  const bEsc = (v) => String(v).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const itemHtml = (it, imgCounter) => {
    if (it.ph === 'img') return '<span class="ph-img" title="' + bEsc(it.label || '') + '">📷 本地图 ' + (++imgCounter.n) + (it.label ? ' · ' + bEsc(it.label) : '') + '</span>';
    if (it.ph === 'tag') return '<span class="ph-tag">▶ ' + fmtTime(it.tag.seconds) + '</span>';
    const a = it.a || {};
    let inner = bEsc(it.t);
    const sp = [];
    if (a.size) sp.push('font-size:' + a.size);
    if (a.bold) inner = '<b>' + inner + '</b>';
    if (a.underline) inner = '<u>' + inner + '</u>';
    if (a.strike) inner = '<s>' + inner + '</s>';
    if (sp.length) inner = '<span style="' + sp.join(';') + '">' + inner + '</span>';
    return inner;
  };

  const blocks = [];
  let cur = null;
  for (const tok of plan) {
    if (tok.kind === 'nl') {
      if (cur) { cur.list = tok.list || null; blocks.push(cur); cur = null; }
      continue;
    }
    if (!cur) cur = { list: null, items: [] };
    if (tok.kind === 't') cur.items.push(tok);
    else if (tok.kind === 'img') cur.items.push({ ph: 'img', label: tok.label });
    else if (tok.kind === 'tag') cur.items.push({ ph: 'tag', tag: tok });
  }
  if (cur) blocks.push(cur);

  let out = '';
  let listTag = null;
  const imgCounter = { n: 0 };
  const render = (b) => b.items.map((it) => itemHtml(it, imgCounter)).join('');
  for (const b of blocks) {
    if (!b.items.length) continue;
    if (b.list) {
      const tag = b.list === 'bullet' ? 'ul' : 'ol';
      if (listTag !== tag) { if (listTag) out += '</' + listTag + '>'; out += '<' + tag + '>'; listTag = tag; }
      out += '<li>' + render(b) + '</li>';
    } else {
      if (listTag) { out += '</' + listTag + '>'; listTag = null; }
      out += '<p>' + render(b) + '</p>';
    }
  }
  if (listTag) out += '</' + listTag + '>';
  return out;
}

const BiliMarkup = {
  plan: toPlan,
  html: (text) => htmlFromPlan(toPlan(text)),
  imgCount: (text) => { let n = 0; for (const t of toPlan(text)) if (t.kind === 'img') n++; return n; },
  imgLabels: (text) => toPlan(text).filter((t) => t.kind === 'img').map((t) => t.label || ''),
};

if (typeof module !== 'undefined' && module.exports) module.exports = BiliMarkup;
if (typeof window !== 'undefined') window.BiliMarkup = BiliMarkup;
