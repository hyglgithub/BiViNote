// deepseek-api.js - DeepSeek API 核心逻辑（注入到 MAIN world）
// 运行在 chat.deepseek.com 页面上下文中，可访问 localStorage 和页面 Cookie

(function () {
  "use strict";

  // 防止重复注入
  if (window.__deepseekApiInjected) return;
  window.__deepseekApiInjected = true;

  // ========== 工具函数 ==========

  // 从 localStorage 获取认证 Token
  function tryGetToken(raw) {
    if (!raw || typeof raw !== "string" || raw.length <= 10) return null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string" && parsed.length > 10) return parsed;
      if (typeof parsed === "object" && parsed !== null) {
        const t = parsed.token || parsed.value || parsed.access_token || parsed.jwt;
        return (t && typeof t === "string" && t.length > 10) ? t : null;
      }
    } catch {
      return raw;
    }
    return null;
  }

  function getToken() {
    const keys = ["userToken", "token", "ds_token", "auth_token", "access_token", "jwt"];
    for (const key of keys) {
      const t = tryGetToken(localStorage.getItem(key));
      if (t) return t;
    }
    // 模糊匹配
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const lower = k.toLowerCase();
        if (lower.includes("token") || lower.includes("auth") || lower.includes("jwt")) {
          const t = tryGetToken(localStorage.getItem(k));
          if (t) return t;
        }
      }
    } catch {}
    return null;
  }

  // PoW 求解器 (sha256)
  async function solvePowSha256(salt, challenge, difficulty) {
    const encoder = new TextEncoder();
    const targetBits = difficulty > 64 ? Math.floor(Math.log2(difficulty)) : difficulty;
    for (let nonce = 0; nonce < 1000000; nonce++) {
      const data = encoder.encode(salt + challenge + nonce);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = new Uint8Array(hashBuffer);
      const hex = Array.from(hashArray, (b) => b.toString(16).padStart(2, "0")).join("");
      let leadingZeros = 0;
      for (const ch of hex) {
        const bits = parseInt(ch, 16);
        if (bits === 0) {
          leadingZeros += 4;
        } else {
          leadingZeros += Math.clz32(bits) - 28;
          break;
        }
      }
      if (leadingZeros >= targetBits) return nonce;
    }
    return -1;
  }

  // 解析 PoW 挑战响应
  function parsePowChallenge(respJson) {
    const data = respJson.data;
    const bizData = data && typeof data === "object" ? data.biz_data : undefined;
    let challenge = (bizData && bizData.challenge) || (data && data.challenge) || respJson.challenge;
    if ((!challenge || typeof challenge !== "object") && bizData && bizData.algorithm && bizData.salt) {
      challenge = bizData;
    }
    if ((!challenge || typeof challenge !== "object") && data && typeof data === "object" && data.algorithm && data.salt) {
      challenge = data;
    }
    if (!challenge || typeof challenge !== "object") return null;
    const c = challenge;
    if (
      typeof c.algorithm !== "string" ||
      typeof c.challenge !== "string" ||
      typeof c.difficulty !== "number" ||
      typeof c.salt !== "string" ||
      typeof c.signature !== "string"
    )
      return null;
    return c;
  }

  // 获取 PoW 挑战（带 expire_at 提取）
  function parsePowChallengeFull(respJson) {
    const c = parsePowChallenge(respJson);
    if (!c) return null;
    // 尝试从各级提取 expire_at
    const data = respJson.data;
    const bizData = data && typeof data === "object" ? data.biz_data : undefined;
    if (c.expire_at === undefined) {
      c.expire_at = (bizData?.expire_at) ?? (data?.expire_at) ?? respJson.expire_at ?? 0;
    }
    return c;
  }

  // 获取页面版本信息
  function getPageVersions() {
    let clientVersion = "1.7.0";
    let appVersion = "20241129.1";
    try {
      const meta = document.querySelector('meta[name="version"]');
      if (meta && meta.getAttribute("content")) appVersion = meta.getAttribute("content");
      const nextData = window.__NEXT_DATA__;
      if (nextData && nextData.buildId) appVersion = nextData.buildId;
      const appVer = window.__APP_VERSION__;
      if (appVer) appVersion = appVer;
      const clientVer = window.__CLIENT_VERSION__;
      if (clientVer) clientVersion = clientVer;
    } catch {}
    return { clientVersion, appVersion };
  }

  // 发送消息到 content script（中转给 background）
  function postToExtension(type, data) {
    window.postMessage({ type, ...data }, window.location.origin);
  }

  // ========== 工具：带超时的 fetch ==========

  function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  // ========== 核心：发送消息并流式接收回复 ==========

  async function sendDeepSeekMessage(prompt, chatId, requestId, thinkingEnabled = true) {
    try {
    const origin = window.location.origin;

    // 1. 获取 Token
    const token = getToken();
    if (!token) {
      postToExtension("DEEPSEEK_ERROR", {
        requestId,
        error: "未找到认证 Token，请先访问 https://chat.deepseek.com 并登录。",
      });
      return;
    }

    // 构造请求头
    const { clientVersion, appVersion } = getPageVersions();
    const headers = {
      "Content-Type": "application/json",
      Accept: "*/*",
      Referer: "https://chat.deepseek.com/",
      Origin: "https://chat.deepseek.com",
      "x-client-platform": "web",
      "x-client-version": clientVersion,
      "x-app-version": appVersion,
      Authorization: `Bearer ${token}`,
    };

    // 2. 创建会话（如果没有 chatId）
    let sessionId = chatId;
    let sessionInvalid = false;
    for (let retry = 0; retry <= 1; retry++) {
      sessionInvalid = false;
    if (!sessionId) {
      try {
        const res = await fetchWithTimeout("https://chat.deepseek.com/api/v0/chat_session/create", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({}),
        }, 15000);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          postToExtension("DEEPSEEK_ERROR", {
            requestId,
            error: `创建会话失败: HTTP ${res.status} ${text.slice(0, 200)}`,
          });
          return;
        }
        const json = await res.json();
        if (json.code !== undefined && json.code !== 0) {
          postToExtension("DEEPSEEK_ERROR", {
            requestId,
            error: `创建会话错误: code=${json.code}, msg=${json.msg || "unknown"}`,
          });
          return;
        }
        const d = json.data;
        const biz = d && typeof d === "object" ? d.biz_data : undefined;
        sessionId = (biz && biz.id) || (d && d.id) || (d && d.chat_session_id) || "";
      } catch (e) {
        const hint = e.name === "AbortError" ? "（请求超时）" : "";
        postToExtension("DEEPSEEK_ERROR", { requestId, error: `创建会话异常: ${String(e)}${hint}` });
        return;
      }
    }

    // 3. 获取 PoW 挑战
    let powChallenge;
    try {
      const res = await fetchWithTimeout("https://chat.deepseek.com/api/v0/chat/create_pow_challenge", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ target_path: "/api/v0/chat/completion" }),
      }, 15000);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        postToExtension("DEEPSEEK_ERROR", {
          requestId,
          error: `获取 PoW 挑战失败: HTTP ${res.status} ${text.slice(0, 200)}`,
        });
        return;
      }
      const json = await res.json();
      if (json.code !== undefined && json.code !== 0) {
        postToExtension("DEEPSEEK_ERROR", {
          requestId,
          error: `PoW 挑战错误: code=${json.code}, msg=${json.msg || "unknown"}`,
        });
        return;
      }
      powChallenge = parsePowChallengeFull(json);
      if (!powChallenge) {
        postToExtension("DEEPSEEK_ERROR", {
          requestId,
          error: `PoW 挑战格式异常: ${JSON.stringify(Object.keys(json))}`,
        });
        return;
      }
    } catch (e) {
      const hint = e.name === "AbortError" ? "（请求超时）" : "";
      postToExtension("DEEPSEEK_ERROR", { requestId, error: `获取 PoW 异常: ${String(e)}${hint}` });
      return;
    }

    // 4. 解决 PoW
    console.log("[DeepSeek Plugin] PoW 算法:", powChallenge.algorithm, "难度:", powChallenge.difficulty);
    let answer;
    if (powChallenge.algorithm === "sha256") {
      answer = await solvePowSha256(powChallenge.salt, powChallenge.challenge, powChallenge.difficulty);
    } else if (powChallenge.algorithm === "DeepSeekHashV1") {
      if (typeof window.solvePowDeepSeekHashV1 === "function") {
        answer = await window.solvePowDeepSeekHashV1(powChallenge);
      } else {
        postToExtension("DEEPSEEK_ERROR", {
          requestId,
          error: "WASM 求解器未加载，请刷新页面后重试",
        });
        return;
      }
    } else {
      postToExtension("DEEPSEEK_ERROR", {
        requestId,
        error: `不支持的 PoW 算法: ${powChallenge.algorithm}，仅支持 sha256 和 DeepSeekHashV1`,
      });
      return;
    }
    console.log("[DeepSeek Plugin] PoW 答案:", answer);
    if (!isFinite(answer) || answer < 0) {
      postToExtension("DEEPSEEK_ERROR", { requestId, error: "PoW 求解失败，未找到答案" });
      return;
    }

    // 5. 发送消息
    const powResponse = btoa(
      JSON.stringify({
        ...powChallenge,
        answer,
        target_path: "/api/v0/chat/completion",
      })
    );

    let response;
    try {
      response = await fetchWithTimeout("https://chat.deepseek.com/api/v0/chat/completion", {
        method: "POST",
        headers: { ...headers, "x-ds-pow-response": powResponse },
        credentials: "include",
        body: JSON.stringify({
          chat_session_id: sessionId,
          parent_message_id: null,
          prompt,
          ref_file_ids: [],
          thinking_enabled: thinkingEnabled,
          search_enabled: false,
          preempt: false,
        }),
      }, 60000);
    } catch (e) {
      const hint = e.name === "AbortError" ? "（请求超时 60s）" : "";
      postToExtension("DEEPSEEK_ERROR", { requestId, error: `发送消息异常: ${String(e)}${hint}` });
      return;
    }

    console.log("[DeepSeek Plugin] 收到响应, HTTP", response.status);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const hint =
        response.status === 401 || response.status === 403
          ? " 请访问 https://chat.deepseek.com 重新登录。"
          : "";
      postToExtension("DEEPSEEK_ERROR", {
        requestId,
        error: `HTTP ${response.status}: ${response.statusText} ${text.slice(0, 300)}${hint}`,
      });
      return;
    }

    // 6. 流式读取 SSE 响应
    const reader = response.body ? response.body.getReader() : null;
    if (!reader) {
      postToExtension("DEEPSEEK_ERROR", { requestId, error: "响应体为空" });
      return;
    }

    // 先发送会话 ID
    postToExtension("DEEPSEEK_CHUNK", {
      requestId,
      chunk: `data: ${JSON.stringify({ type: "deepseek:chat_session_id", chat_session_id: sessionId })}\n\n`,
    });

    const decoder = new TextDecoder();
    let buffer = "";
    let streamComplete = false;
    let isFirstChunk = true;
    for (;;) {
      const readPromise = reader.read();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SSE 读取超时 (30s 无数据)")), 30000)
      );
      let done, value;
      try {
        ({ done, value } = await Promise.race([readPromise, timeoutPromise]));
      } catch (e) {
        // 超时或读取错误，标记不完整
        postToExtension("DEEPSEEK_ERROR", { requestId, error: "响应中断：" + e.message });
        break;
      }
      if (done) { streamComplete = true; break; }
      buffer += decoder.decode(value, { stream: true });

      // 首个 chunk 后检测是否为 JSON 错误（如会话失效）
      if (isFirstChunk) {
        isFirstChunk = false;
        if (buffer.trimStart().startsWith("{") && buffer.includes("invalid chat session id")) {
          sessionInvalid = true;
          break;
        }
      }
      while (buffer.includes("\n")) {
        const idx = buffer.indexOf("\n");
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.startsWith("data: ")) {
          // 检测无效会话
          if (line.includes("invalid chat session id")) {
            sessionInvalid = true;
            break;
          }
          postToExtension("DEEPSEEK_CHUNK", { requestId, chunk: line + "\n\n" });
        }
      }
    }

    // 处理剩余缓冲（会话失效时跳过，避免将 JSON 错误体当 SSE 处理）
    if (!sessionInvalid) {
      const remaining = decoder.decode();
      if (remaining) buffer += remaining;
      while (buffer.includes("\n")) {
        const idx = buffer.indexOf("\n");
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.startsWith("data: ")) {
          postToExtension("DEEPSEEK_CHUNK", { requestId, chunk: line + "\n\n" });
        }
      }
      const tail = buffer.trim();
      if (tail.startsWith("data: ")) {
        postToExtension("DEEPSEEK_CHUNK", { requestId, chunk: tail + "\n\n" });
      }
    }

    if (streamComplete) {
      postToExtension("DEEPSEEK_DONE", { requestId });
      break;
    }

    // 会话失效，清除 chatId 并重试
    if (sessionInvalid && retry === 0) {
      sessionId = null;
      postToExtension("DEEPSEEK_CHUNK", { requestId, chunk: "data: [会话已失效，正在重新创建...]\n\n" });
      continue;
    }
    break;
    } // end for retry
    } catch (e) {
      postToExtension("DEEPSEEK_ERROR", {
        requestId,
        error: `处理消息时出错: ${String(e)}`,
      });
    }
  }

  // ========== 终止流式响应 ==========

  async function stopStream(chatId, messageId) {
    const token = getToken();
    if (!token || !chatId) return;
    const { clientVersion, appVersion } = getPageVersions();
    try {
      await fetch("https://chat.deepseek.com/api/v0/chat/stop_stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "*/*",
          Referer: "https://chat.deepseek.com/",
          Origin: "https://chat.deepseek.com",
          "x-client-platform": "web",
          "x-client-version": clientVersion,
          "x-app-version": appVersion,
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ chat_session_id: chatId, message_id: messageId }),
      });
    } catch {}
  }

  // ========== 监听来自 content script 的消息 ==========

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg) return;

    if (msg.type === "DEEPSEEK_SEND") {
      const { prompt, chatId, requestId, thinking } = msg;
      sendDeepSeekMessage(prompt, chatId, requestId || crypto.randomUUID(), thinking !== false);
    } else if (msg.type === "DEEPSEEK_ABORT") {
      stopStream(msg.chatId, msg.messageId);
    }
  });
})();
