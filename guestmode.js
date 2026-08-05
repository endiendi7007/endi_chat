/**
 * Guest-mode detection via SERVER_INFO from the LAN Chat backend.
 * Uses window.ENDI_CONFIG.wsUrl (see config.js).
 *
 * Shows a custom status on the login screen when:
 *  - still waiting for SERVER_INFO (guestmode null)
 *  - server is disconnected / unreachable
 *  - guest mode is on or off
 */

window.guestmode = null; // "on" | "off" | null (unknown / probing)
window.serverReachable = null; // true | false | null (probing)

function onDOMReady(fn) {
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn);
}

function morphButtonText(newText) {
  onDOMReady(() => {
    const el = document.getElementById("submit-btn-text");
    if (!el || el.textContent === newText) return;
    el.classList.remove("text-shapeshift");
    void el.offsetWidth;
    el.classList.add("text-shapeshift");
    setTimeout(() => { el.textContent = newText; }, 180);
    setTimeout(() => { el.classList.remove("text-shapeshift"); }, 450);
  });
}

/**
 * Update the login-screen status banner.
 * kind: "pending" | "ok" | "err" | "warn"
 */
function setServerStatus(text, kind) {
  onDOMReady(() => {
    const el = document.getElementById("serverStatus");
    if (el) {
      el.textContent = text;
      el.className = "server-status " + (kind || "");
    }
    const elReady = document.getElementById("serverStatusReady");
    if (elReady) {
      elReady.textContent = text;
      elReady.className = "server-status " + (kind || "");
    }
    const checkingSub = document.getElementById("checking-subtitle");
    if (checkingSub && (kind === "pending" || !kind)) {
      checkingSub.textContent = text;
    }
  });
}

/**
 * Swap checking panel ↔ login form.
 * Only reveal the form when the server is reachable and working.
 * On failure, stay on the same checking card and show the error + Retry.
 */
function setLoginCardMode(mode, opts = {}) {
  // mode: "checking" | "ready" | "error"
  // Single status message in the colored banner only (no title/subtitle duplicates).
  // Checking: spinner only, no photo.
  // Success: sweet.webp + "Rista pakka"
  // Fail: mouse.webp + wire message
  onDOMReady(() => {
    const checking = document.getElementById("loginChecking");
    const ready = document.getElementById("loginReady");
    const statusEl = document.getElementById("serverStatus");
    const spinner = checking && checking.querySelector(".checking-spinner");
    const img = document.getElementById("checking-image");
    const retryBtn = document.getElementById("serverRetryBtn");

    const MSG_CHECKING = "Checking....";
    const MSG_SUCCESS = "Rista pakka";
    const MSG_FAIL = "server ka wire chune ne kha lia Shayad";
    const IMG_SWEET = "pictures/sweet.webp";
    const IMG_MOUSE = "pictures/mouse.webp";

    if (mode === "ready") {
      if (checking) checking.classList.remove("hidden");
      if (ready) ready.classList.add("hidden");
      if (statusEl) {
        statusEl.textContent = MSG_SUCCESS;
        statusEl.className = "server-status ok";
      }
      if (spinner) spinner.classList.add("hidden");
      if (img) {
        img.src = IMG_SWEET;
        img.classList.remove("hidden");
        img.alt = "Rista pakka";
      }
      if (retryBtn) retryBtn.classList.add("hidden");

      setTimeout(() => {
        if (checking) checking.classList.add("hidden");
        if (ready) ready.classList.remove("hidden");
        const readyStatus = document.getElementById("serverStatusReady");
        if (readyStatus) {
          readyStatus.textContent = opts.message || MSG_SUCCESS;
          readyStatus.className = "server-status ok";
        }
      }, 1200);
      return;
    }

    if (checking) checking.classList.remove("hidden");
    if (ready) ready.classList.add("hidden");

    if (mode === "error") {
      if (statusEl) {
        statusEl.textContent = MSG_FAIL;
        statusEl.className = "server-status err";
      }
      if (spinner) spinner.classList.add("hidden");
      if (img) {
        img.src = IMG_MOUSE;
        img.classList.remove("hidden");
        img.alt = "mouse ate the wire";
      }
      if (retryBtn) retryBtn.classList.remove("hidden");
    } else {
      // checking — message once in yellow banner, no photo
      if (statusEl) {
        statusEl.textContent = MSG_CHECKING;
        statusEl.className = "server-status pending";
      }
      if (spinner) spinner.classList.remove("hidden");
      if (img) {
        img.removeAttribute("src");
        img.classList.add("hidden");
        img.alt = "";
      }
      if (retryBtn) retryBtn.classList.add("hidden");
    }
  });
}


function handleGuestModeOn() {
  onDOMReady(() => {
    const moreBtn = document.getElementById("more-btn");
    const tokenCheckbox = document.getElementById("has-token-checkbox");
    if (moreBtn) moreBtn.classList.remove("hidden");
    const text = tokenCheckbox && tokenCheckbox.checked ? "Next" : "Enter Chat";
    morphButtonText(text);
  });
}

function handleGuestModeOff() {
  onDOMReady(() => {
    const moreBtn = document.getElementById("more-btn");
    const tokenGroup = document.getElementById("token-option-group");
    if (moreBtn) {
      moreBtn.classList.add("hidden");
      moreBtn.setAttribute("aria-expanded", "false");
    }
    if (tokenGroup) {
      tokenGroup.classList.add("hidden");
      tokenGroup.classList.remove("open");
    }
    morphButtonText("Next");
  });
}

window.showToast = function (text) {
  onDOMReady(() => {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = text;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  });
};

/**
 * @param {"on"|"off"|null} state
 * @param {boolean} [silent]
 * @param {{ reachable?: boolean, message?: string }} [opts]
 */
window.setGuestMode = function (state, silent = false, opts = {}) {
  window.guestmode = state;

  if (state === "on" || state === "off") {
    localStorage.setItem("saved_guestmode", state);
  }

  if (typeof opts.reachable === "boolean") {
    window.serverReachable = opts.reachable;
  }

  if (state === "on") {
    if (!silent) window.showToast("Guest mode available");
    handleGuestModeOn();
    setServerStatus(
      opts.message || "Connected · Guest mode on",
      "ok"
    );
  } else if (state === "off") {
    handleGuestModeOff();
    if (window.serverReachable === false) {
      setServerStatus(
        opts.message || "server ka wire chune ne kha lia Shayad",
        "err"
      );
    } else if (window.serverReachable === true) {
      setServerStatus(
        opts.message || "Connected · Guest mode off (token required)",
        "ok"
      );
    } else {
      setServerStatus(
        opts.message || "Guest mode off",
        "warn"
      );
    }
  } else {
    // null — still unknown / failed without a clear guest flag
    handleGuestModeOff();
    setServerStatus(
      opts.message || "Waiting for server info…",
      window.serverReachable === false ? "err" : "pending"
    );
  }
};

// ---------- WebSocket probe for SERVER_INFO ----------
(function probeServer() {
  const CFG = window.ENDI_CONFIG || {
    get wsUrl() { return "ws://127.0.0.1:8765"; }
  };

  // Initial UI state — hide form, show checking only
  window.guestmode = null;
  window.serverReachable = null;
  setLoginCardMode("checking");
  setServerStatus("Checking....", "pending");

  let settled = false;
  function settle(state, reachable, message) {
    if (settled) return;
    settled = true;
    window.setGuestMode(state, true, {
      reachable: reachable,
      message: message,
    });
    // Reveal login form (even on error so user can see the message / retry by refresh)
    setLoginCardMode(reachable ? "ready" : "error", {
      message: message,
      kind: reachable ? "ok" : "err",
    });
  }

  let ws;
  try {
    ws = new WebSocket(CFG.wsUrl);
  } catch (e) {
    settle(
      null,
      false,
      "server ka wire chune ne kha lia Shayad"
    );
    return;
  }

  const timeout = setTimeout(function () {
    try { ws.close(); } catch (_) {}
    settle(
      null,
      false,
      "server ka wire chune ne kha lia Shayad"
    );
  }, 4000);

  ws.onopen = function () {
    if (!settled) {
      setServerStatus("Checking....", "pending");
    }
  };

  ws.onmessage = function (event) {
    try {
      const frame = JSON.parse(event.data);
      if (frame.type === "SERVER_INFO") {
        clearTimeout(timeout);
        const info = JSON.parse(atob(frame.payload));
        const on = info.enable_guest_access === true;
        settle(
          on ? "on" : "off",
          true,
          on
            ? "Rista pakka"
            : "Rista pakka"
        );
        try { ws.close(); } catch (_) {}
      }
    } catch (_) {
      clearTimeout(timeout);
      settle(null, false, "server ka wire chune ne kha lia Shayad");
      try { ws.close(); } catch (_) {}
    }
  };

  ws.onerror = function () {
    clearTimeout(timeout);
    settle(null, false, "server ka wire chune ne kha lia Shayad");
  };

  ws.onclose = function (ev) {
    clearTimeout(timeout);
    if (!settled) {
      const reason = ev.reason && String(ev.reason).trim();
      settle(
        null,
        false,
        "server ka wire chune ne kha lia Shayad"
      );
    }
  };
})();

// ---------- Login form logic ----------
document.addEventListener("DOMContentLoaded", function () {
  // Do NOT apply saved guestmode until the live probe finishes.
  // A stale "on/off" while the server is down is misleading.

  const retryBtn = document.getElementById("serverRetryBtn");
  if (retryBtn) {
    retryBtn.addEventListener("click", function () {
      // Full reload re-runs the WebSocket probe cleanly
      window.location.reload();
    });
  }

  const moreBtn = document.getElementById("more-btn");
  const tokenGroup = document.getElementById("token-option-group");
  const tokenCheckbox = document.getElementById("has-token-checkbox");
  const loginForm = document.querySelector(".login-form");

  if (moreBtn && tokenGroup) {
    moreBtn.addEventListener("click", function () {
      const next = this.getAttribute("aria-expanded") !== "true";
      this.setAttribute("aria-expanded", String(next));
      if (next) {
        tokenGroup.classList.remove("hidden");
        tokenGroup.classList.add("open");
      } else {
        tokenGroup.classList.add("hidden");
        tokenGroup.classList.remove("open");
      }
    });
  }

  if (tokenCheckbox) {
    tokenCheckbox.addEventListener("change", function () {
      if (window.guestmode === "on") {
        morphButtonText(this.checked ? "Next" : "Enter Chat");
      }
    });
  }

  const tokenInput = document.getElementById("token-input");
  const toggleVisibilityBtn = document.getElementById("toggle-token-visibility");
  const eyeIconOff = document.getElementById("eye-icon-off");
  const eyeIconOn = document.getElementById("eye-icon-on");

  if (toggleVisibilityBtn && tokenInput) {
    toggleVisibilityBtn.addEventListener("click", function () {
      const isPassword = tokenInput.getAttribute("type") === "password";
      tokenInput.setAttribute("type", isPassword ? "text" : "password");
      if (eyeIconOff && eyeIconOn) {
        eyeIconOff.classList.toggle("hidden", isPassword);
        eyeIconOn.classList.toggle("hidden", !isPassword);
      }
    });
  }

  if (loginForm) {
    let currentStep = 1;
    const step1Div = document.getElementById("step-1");
    const step2Div = document.getElementById("step-2");
    const cardTitle = document.getElementById("card-title");
    const cardSubtitle = document.getElementById("card-subtitle");
    const closeTokenBtn = document.getElementById("close-token-btn");

    function resetToStep1() {
      if (step2Div) step2Div.classList.add("step-hidden");
      if (step1Div) step1Div.classList.remove("step-hidden");
      if (cardTitle) cardTitle.textContent = "Welcome";
      if (cardSubtitle) cardSubtitle.textContent = "Enter your details below";
      currentStep = 1;
    }

    if (closeTokenBtn) closeTokenBtn.addEventListener("click", resetToStep1);

    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();

      // Block join while server status is unknown or disconnected
      if (window.serverReachable !== true || window.guestmode === null) {
        const msg =
          window.serverReachable === false
            ? "Server is disconnected. Fix the backend (or config.js) and refresh."
            : "Still waiting for server info. Please wait a moment.";
        window.showToast(msg);
        setServerStatus(msg, "err");
        return;
      }

      if (currentStep === 1) {
        const userName = document.getElementById("name") && document.getElementById("name").value
          ? document.getElementById("name").value.trim()
          : "";
        const colorEl = document.getElementById("color-text");
        const userColor = (colorEl && colorEl.value.trim()) || "#888888";

        if (!userName) {
          window.showToast("Please enter a name");
          return;
        }

        localStorage.setItem("chat_username", userName);
        localStorage.setItem("chat_usercolor", userColor);
        localStorage.removeItem("chat_token");

        const actionEl = document.getElementById("submit-btn-text");
        const action = actionEl ? actionEl.textContent : "";

        if (action === "Next") {
          step1Div.classList.add("step-hidden");
          step2Div.classList.remove("step-hidden");
          cardTitle.textContent = "Authentication";
          cardSubtitle.textContent = "Please enter your access token";
          currentStep = 2;
        } else {
          if (window.guestmode !== "on") {
            window.showToast("Guest mode is off — a token is required");
            setServerStatus("Guest mode is off — enter a token via More", "warn");
            return;
          }
          window.location.href = "chat.html";
        }
      } else if (currentStep === 2) {
        const tokenEl = document.getElementById("token-input");
        const userToken = tokenEl && tokenEl.value ? tokenEl.value.trim() : "";
        if (!userToken) {
          window.showToast("Token cannot be empty");
          return;
        }
        localStorage.setItem("chat_token", userToken);
        window.location.href = "chat.html";
      }
    });
  }
});
