/**
 * BiViNote Message Bus
 * 核心消息总线，用于模块间通信
 * 支持消息处理器注册和消息分发
 */
(function() {
  'use strict';

  window.BiViNote = window.BiViNote || {};
  window.BiViNote.messageBus = {
    handlers: {},

    /**
     * 注册消息处理器
     * @param {string} type - 消息类型
     * @param {Function} handler - 处理函数 (message, sender, sendResponse) => boolean
     */
    registerHandler(type, handler) {
      if (typeof handler !== 'function') {
        console.error('[BiViNote] registerHandler: handler must be a function');
        return;
      }
      this.handlers[type] = handler;
    },

    /**
     * 处理消息
     * @param {Object} message - 消息对象，必须包含 type 属性
     * @param {Object} sender - 发送者信息
     * @param {Function} sendResponse - 回调函数
     * @returns {boolean} - 是否需要保持消息通道开放
     */
    handleMessage(message, sender, sendResponse) {
      if (!message || !message.type) {
        return false;
      }

      const handler = this.handlers[message.type];
      if (handler) {
        return handler(message, sender, sendResponse);
      }
      return false;
    }
  };
})();
