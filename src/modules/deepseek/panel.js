/**
 * BiViNote DeepSeek Panel Module
 * 注册文档整理标签页到核心面板
 */
(function() {
  'use strict';

  const panel = window.BiViNote.panel;
  if (!panel) {
    console.error('[BiViNote] DeepSeek panel module: core panel not found');
    return;
  }

  // 注册文档整理标签页
  panel.registerTab({ id: 'doc', label: '文档整理', footer: false });
})();
