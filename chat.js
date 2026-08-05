/**
 * Endi's Chat – WebSocket client + crypto + UI
 * Protocol: LAN Chat backend v2.4.x
 * (X25519 ECDH → HKDF-SHA256 → AES-256-GCM)
 */

(function () {
  "use strict";

  // ---------- Config ----------
  const CFG = window.ENDI_CONFIG || {
    backendHost: "127.0.0.1",
    backendPort: 8765,
    get wsUrl() {
      return `ws://${this.backendHost}:${this.backendPort}`;
    },
  };

  const HKDF_INFO = new TextEncoder().encode("lan-chat-app/session-key/v1");

  // ---------- State ----------
  let ws = null;
  let sessionId = null;
  let aesKey = null;          // CryptoKey
  let myNickname = null;
  let myColor = null;
  let myRole = "user";
  let joined = false;
  let privateKey = null;      // CryptoKey (X25519)

  // ---------- DOM ----------
  const chatBox = document.getElementById("chatBox");
  const messageInput = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const plusBtn = document.getElementById("plusBtn");
  const bottomSheet = document.getElementById("bottomSheet");
  const overlay = document.getElementById("bottomSheetOverlay");
  const photoOption = document.getElementById("photoOption");
  const documentOption = document.getElementById("documentOption");
  const photoInput = document.getElementById("photoInput");
  const documentInput = document.getElementById("documentInput");
  const statusEl = document.getElementById("connectionStatus");

  // ---------- Helpers ----------
  function b64(buf) {
    const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function unb64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "connection-status " + (kind || "");
  }

  // Server may send zlib-compressed chat text when running with the
  // low_internet environment profile (see config/environment.py:
  // compress_chat_text uses zlib.compress, i.e. raw zlib/DEFLATE framing).
  async function decompressText(b64) {
    try {
      const compressed = unb64(b64);
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate"));
      const buf = await new Response(stream).arrayBuffer();
      return new TextDecoder().decode(buf);
    } catch (e) {
      console.error("decompress failed", e);
      return "[Could not decompress message]";
    }
  }

  function toast(text) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 300);
    }, 2200);
  }

  // ---------- Crypto (Web Crypto API) ----------
  async function generateKeypair() {
    const keyPair = await crypto.subtle.generateKey(
      { name: "X25519" },
      true,
      ["deriveBits"]
    );
    privateKey = keyPair.privateKey;
    const rawPub = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    return b64(rawPub);
  }

  async function deriveSessionKey(serverPubB64, sid) {
    const serverPub = await crypto.subtle.importKey(
      "raw",
      unb64(serverPubB64),
      { name: "X25519" },
      false,
      []
    );
    const shared = await crypto.subtle.deriveBits(
      { name: "X25519", public: serverPub },
      privateKey,
      256
    );
    const baseKey = await crypto.subtle.importKey(
      "raw",
      shared,
      "HKDF",
      false,
      ["deriveKey"]
    );
    const salt = new TextEncoder().encode(sid);
    return crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt,
        info: HKDF_INFO,
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptBody(obj) {
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const pt = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      pt
    );
    const combined = new Uint8Array(12 + ct.byteLength);
    combined.set(nonce, 0);
    combined.set(new Uint8Array(ct), 12);
    return b64(combined);
  }

  async function decryptPayload(payloadB64) {
    const blob = unb64(payloadB64);
    const nonce = blob.slice(0, 12);
    const ct = blob.slice(12);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      ct
    );
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // ---------- Envelope helpers ----------
  function makeEnvelope(type, payloadB64, sid = null) {
    return JSON.stringify({
      type,
      session_id: sid,
      timestamp: nowIso(),
      payload: payloadB64,
    });
  }

  // ---------- UI: messages ----------
  function addMessage(text, type, meta = {}) {
    if (!chatBox) return;
    const div = document.createElement("div");
    div.className = "message " + type;
    if (meta.message_id) div.dataset.id = meta.message_id;

    if (type === "received" && meta.nickname) {
      const name = document.createElement("div");
      name.className = "msg-nickname";
      name.textContent = meta.nickname;
      if (meta.color) name.style.color = meta.color;
      div.appendChild(name);
    }

    const body = document.createElement("div");
    body.className = "msg-text";
    body.textContent = text;
    div.appendChild(body);

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function setInputEnabled(on) {
    if (messageInput) messageInput.disabled = !on;
    if (sendBtn) sendBtn.disabled = !on;
    if (plusBtn) plusBtn.disabled = !on;
  }

  // ---------- Protocol ----------
  async function sendJoin() {
    myNickname = localStorage.getItem("chat_username") || "Guest";
    myColor = localStorage.getItem("chat_usercolor") || "#888888";
    const token = localStorage.getItem("chat_token") || null;

    const clientPubB64 = await generateKeypair();

    const joinBody = {
      nickname: myNickname,
      color: myColor,
      token: null, // v2.4: token goes via AUTH after key derivation
      handshake_data: { client_public_key: clientPubB64 },
    };

    const payload = b64(new TextEncoder().encode(JSON.stringify(joinBody)));
    ws.send(makeEnvelope("JOIN", payload, null));
  }

  async function handleJoinAck(env) {
    const body = JSON.parse(new TextDecoder().decode(unb64(env.payload)));
    sessionId = body.session_id;
    myRole = body.role || "user";
    aesKey = await deriveSessionKey(body.server_public_key, sessionId);

    const token = localStorage.getItem("chat_token");
    if (token) {
      const authPayload = await encryptBody({ token });
      ws.send(makeEnvelope("AUTH", authPayload, sessionId));
    } else {
      finishJoin();
    }
  }

  function finishJoin() {
    joined = true;
    setInputEnabled(true);
    setStatus("Connected", "ok");
    if (messageInput) messageInput.focus();
  }

  async function handleFrame(raw) {
    let env;
    try {
      env = JSON.parse(raw);
    } catch {
      return;
    }

    const type = env.type;

    if (type === "SERVER_INFO") {
      // already handled on login page; ignore here
      return;
    }

    if (type === "JOIN_ACK") {
      await handleJoinAck(env);
      return;
    }

    if (type === "AUTH_ACK") {
      try {
        const body = await decryptPayload(env.payload);
        if (body.role) myRole = body.role;
      } catch (_) {}
      finishJoin();
      return;
    }

    if (type === "ERROR") {
      let msg = "Error";
      try {
        if (env.payload && aesKey) {
          const body = await decryptPayload(env.payload);
          msg = body.message || body.error || JSON.stringify(body);
        } else if (env.payload) {
          const body = JSON.parse(new TextDecoder().decode(unb64(env.payload)));
          msg = body.message || body.error || JSON.stringify(body);
        }
      } catch (_) {}
      toast(msg);
      if (!joined) setStatus("Join failed", "err");
      return;
    }

    if (!aesKey) return;

    // Encrypted frames
    let body;
    try {
      body = await decryptPayload(env.payload);
    } catch {
      return;
    }

    if (type === "CHAT") {
      const isMe = body.session_id === sessionId;
      const text = body.compressed ? await decompressText(body.text || "") : (body.text || "");
      addMessage(text, isMe ? "sent" : "received", {
        message_id: body.message_id,
        nickname: body.nickname,
        color: body.color,
      });
      return;
    }

    if (type === "USER_LIST" || type === "FEATURES") {
      // optional future use
      return;
    }
  }

  async function sendChat(text) {
    if (!joined || !aesKey || !text.trim()) return;
    const body = { text: text.trim(), compressed: false };
    const payload = await encryptBody(body);
    ws.send(makeEnvelope("CHAT", payload, sessionId));
    // Server echoes CHAT to everyone (including sender) — rendered in handleFrame
  }

  // ---------- WebSocket lifecycle ----------
  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus("Connecting…", "pending");
    setInputEnabled(false);

    try {
      ws = new WebSocket(CFG.wsUrl);
    } catch (e) {
      setStatus("Invalid URL", "err");
      toast("Bad WebSocket URL");
      return;
    }

    ws.onopen = () => {
      setStatus("Handshaking…", "pending");
      sendJoin().catch((e) => {
        console.error(e);
        setStatus("Join error", "err");
        toast("Could not join");
      });
    };

    ws.onmessage = (ev) => {
      handleFrame(ev.data).catch((e) => console.error("frame error", e));
    };

    ws.onclose = (ev) => {
      joined = false;
      aesKey = null;
      sessionId = null;
      setInputEnabled(false);

      // 1013 = server busy/full (retryable). Anything else with a reason
      // (1008 policy rejection: banned, bad nickname, JOIN timeout, server
      // full at capacity gate, etc.) means retrying won't help — surface it
      // and stop, rather than looping every 3s.
      const retryable = ev.code === 1013 || !ev.reason;
      if (retryable) {
        setStatus("Disconnected", "err");
        setTimeout(connect, 3000);
      } else {
        setStatus(ev.reason, "err");
        toast(ev.reason);
      }
    };

    ws.onerror = () => {
      setStatus("Connection error", "err");
    };
  }

  // ---------- Bottom sheet (Photos / Documents) ----------
  function closeSheet() {
    if (bottomSheet) bottomSheet.classList.remove("show");
    if (overlay) overlay.classList.remove("show");
  }

  function openSheet() {
    if (bottomSheet) bottomSheet.classList.add("show");
    if (overlay) overlay.classList.add("show");
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    // Require login data
    if (!localStorage.getItem("chat_username")) {
      window.location.href = "login.html";
      return;
    }

    setInputEnabled(false);
    connect();

    // Send
    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        const t = messageInput.value;
        messageInput.value = "";
        sendChat(t);
        messageInput.focus();
      });
    }
    if (messageInput) {
      messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          const t = messageInput.value;
          messageInput.value = "";
          sendChat(t);
        }
      });
    }

    // + button → sheet
    if (plusBtn) plusBtn.addEventListener("click", openSheet);
    if (overlay) overlay.addEventListener("click", closeSheet);

    if (photoOption && photoInput) {
      photoOption.addEventListener("click", () => {
        photoInput.click();
        closeSheet();
      });
      photoInput.addEventListener("change", () => {
        if (photoInput.files?.length) {
          toast(`${photoInput.files.length} photo(s) selected (upload coming soon)`);
          photoInput.value = "";
        }
      });
    }

    if (documentOption && documentInput) {
      documentOption.addEventListener("click", () => {
        documentInput.click();
        closeSheet();
      });
      documentInput.addEventListener("change", () => {
        if (documentInput.files?.length) {
          toast(`${documentInput.files.length} file(s) selected (upload coming soon)`);
          documentInput.value = "";
        }
      });
    }
  });
})();
