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
    subtitleLang: '',
    downloadDir: '',
    promptNoImage: '',
    promptWithImage: '',
    lastOpenMode: 'panel',
    docOrganizeMode: 'manual',
    deepseekPrompt: ''
  };

  const DEFAULT_CHECKED = {
    title: true,
    author: true,
    date: false,
    duration: false,
    url: false,
    description: false,
    chapterTimestamp: false,
    subtitleTimestamp: false
  };

  async function load() {
    return new Promise(resolve => {
      chrome.storage.local.get(['bivinote_settings', 'bivinote_videoInfoChecked'], result => {
        if (chrome.runtime.lastError) {
          console.warn('[BiViNote] Storage load error:', chrome.runtime.lastError);
          resolve({ ...DEFAULTS });
          return;
        }
        const saved = result.bivinote_settings || {};
        Object.assign(window.BiViNote.state.settings, { ...DEFAULTS, ...saved });

        const savedChecked = result.bivinote_videoInfoChecked || {};
        Object.assign(window.BiViNote.state.videoInfoChecked, { ...DEFAULT_CHECKED, ...savedChecked });

        resolve(window.BiViNote.state.settings);
      });
    });
  }

  async function save() {
    return new Promise(resolve => {
      const settings = window.BiViNote.state.settings;
      const checked = window.BiViNote.state.videoInfoChecked;
      chrome.storage.local.set({
        bivinote_settings: { ...settings },
        bivinote_videoInfoChecked: { ...checked }
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[BiViNote] Storage save error:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  function resetDefaults() {
    Object.assign(window.BiViNote.state.settings, { ...DEFAULTS });
    Object.assign(window.BiViNote.state.videoInfoChecked, { ...DEFAULT_CHECKED });
    save();
  }

  window.BiViNote.settings = {
    load,
    save,
    resetDefaults,
    DEFAULTS: { ...DEFAULTS }
  };
})();
