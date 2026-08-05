/**
 * Guest-mode detection via SERVER_INFO from the LAN Chat backend.
 * Uses window.ENDI_CONFIG.wsUrl (see config.js).
 */

window.guestmode = null;

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

window.setGuestMode = function (state, silent = false) {
  window.guestmode = state;
  localStorage.setItem("saved_guestmode", state);
  if (state === "on") {
    if (!silent) window.showToast("Guest mode available");
    handleGuestModeOn();
  } else {
    handleGuestModeOff();
  }
};

// ---------- WebSocket probe for SERVER_INFO ----------
(function probeServer() {
  const CFG = window.ENDI_CONFIG || {
    get wsUrl() { return "ws://127.0.0.1:8765"; }
  };

  let ws;
  try {
    ws = new WebSocket(CFG.wsUrl);
  } catch {
    window.setGuestMode("off", true);
    return;
  }

  const timeout = setTimeout(() => {
    try { ws.close(); } catch (_) {}
    window.setGuestMode("off", true);
  }, 4000);

  ws.onmessage = (event) => {
    try {
      const frame = JSON.parse(event.data);
      if (frame.type === "SERVER_INFO") {
        clearTimeout(timeout);
        const info = JSON.parse(atob(frame.payload));
        window.setGuestMode(info.enable_guest_access === true ? "on" : "off", true);
        ws.close();
      }
    } catch (_) {
      window.setGuestMode("off", true);
    }
  };

  ws.onerror = () => {
    clearTimeout(timeout);
    window.setGuestMode("off", true);
  };

  ws.onclose = () => clearTimeout(timeout);
})();

// ---------- Login form logic ----------
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("saved_guestmode");
  if (saved) window.setGuestMode(saved, true);

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
    toggleVisibilityBtn.addEventListener("click", () => {
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

      if (currentStep === 1) {
        const userName = document.getElementById("name")?.value?.trim();
        const userColor = document.getElementById("color-text")?.value?.trim() || "#888888";

        if (!userName) {
          window.showToast("Please enter a name");
          return;
        }

        localStorage.setItem("chat_username", userName);
        localStorage.setItem("chat_usercolor", userColor);
        // Clear previous token unless going to step 2
        localStorage.removeItem("chat_token");

        const action = document.getElementById("submit-btn-text")?.textContent;

        if (action === "Next") {
          step1Div.classList.add("step-hidden");
          step2Div.classList.remove("step-hidden");
          cardTitle.textContent = "Authentication";
          cardSubtitle.textContent = "Please enter your access token";
          currentStep = 2;
        } else {
          // Guest join
          window.location.href = "chat.html";
        }
      } else if (currentStep === 2) {
        const userToken = document.getElementById("token-input")?.value?.trim();
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
