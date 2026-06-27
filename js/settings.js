/**
 * BiViNote Settings Module
 * 读写 chrome.storage.local，管理设置项
 */
(function () {
  'use strict';

  window.BiViNote = window.BiViNote || {};

  const DEFAULTS = {
    fontSize: 'default',
    lineHeight: 'standard',
    frameStep: 0.2,
    autoScroll: true,
    darkMode: false,
    subtitleLang: ''
  };

  async function load() {
    return new Promise(resolve => {
      chrome.storage.local.get(['bivinote_settings'], result => {
        if (chrome.runtime.lastError) {
          console.warn('[BiViNote] Storage load error:', chrome.runtime.lastError);
          resolve({ ...DEFAULTS });
          return;
        }
        const saved = result.bivinote_settings || {};
        Object.assign(window.BiViNote.state.settings, { ...DEFAULTS, ...saved });
        resolve(window.BiViNote.state.settings);
      });
    });
  }

  async function save() {
    return new Promise(resolve => {
      const settings = window.BiViNote.state.settings;
      chrome.storage.local.set({ bivinote_settings: { ...settings } }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[BiViNote] Storage save error:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  function resetDefaults() {
    Object.assign(window.BiViNote.state.settings, { ...DEFAULTS });
    save();
  }

  window.BiViNote.settings = {
    load,
    save,
    resetDefaults,
    DEFAULTS: { ...DEFAULTS }
  };
})();
