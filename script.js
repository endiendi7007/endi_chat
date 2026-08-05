/**
 * Login page – color wheel + validation
 */
document.addEventListener("DOMContentLoaded", () => {
  if (typeof iro === "undefined") return;

  const colorPicker = new iro.ColorPicker("#color-wheel", {
    width: 150,
    color: "#007aff",
    borderWidth: 2,
    borderColor: "#ffffff",
    layout: [
      { component: iro.ui.Wheel },
      { component: iro.ui.Slider, sliderType: "value" },
    ],
  });

  // Kill laggy transitions on the wheel
  const noLag = document.createElement("style");
  noLag.textContent = `
    .IroColorPicker, .IroColorPicker *, .IroColorPicker svg,
    .IroWheel, .IroSlider { transition: none !important; animation: none !important; }
  `;
  document.head.appendChild(noLag);

  const colorText = document.getElementById("color-text");
  const colorPreview = document.getElementById("color-preview");
  const toggleBtn = document.getElementById("color-toggle-btn");
  const popover = document.getElementById("wheel-popover");
  const header = document.getElementById("wheel-header");
  const closeBtn = document.getElementById("close-wheel-btn");
  const colorError = document.getElementById("color-error");
  const loginForm = document.querySelector(".login-form");

  let isWheelDragging = false;

  function getHexFromColorName(name) {
    if (!name) return null;
    const formatted = name.trim().toLowerCase().replace(/\s+/g, "");
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.fillStyle = "#123456";
    ctx.fillStyle = formatted;
    if (ctx.fillStyle !== "#123456") return ctx.fillStyle;
    ctx.fillStyle = "#abcdef";
    ctx.fillStyle = formatted;
    if (ctx.fillStyle !== "#abcdef") return ctx.fillStyle;
    return null;
  }

  function isValidHex(str) {
    return /^#([0-9A-F]{3}){1,2}$/i.test(str);
  }

  function updatePreview(color) {
    if (!colorPreview) return;
    colorPreview.style.backgroundColor = color && color !== "transparent" ? color : "#888888";
  }

  function showError() {
    if (colorText) colorText.classList.add("invalid-color");
    if (colorError) colorError.classList.add("show");
    updatePreview("#888888");
  }

  function hideError() {
    if (colorText) colorText.classList.remove("invalid-color");
    if (colorError) colorError.classList.remove("show");
  }

  if (toggleBtn && popover) {
    toggleBtn.addEventListener("click", () => popover.classList.toggle("show"));
  }
  if (closeBtn && popover) {
    closeBtn.addEventListener("click", () => popover.classList.remove("show"));
  }

  if (popover && header) makeDraggable(popover, header);

  function makeDraggable(element, handle) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("#close-wheel-btn")) return;
      const rect = element.getBoundingClientRect();
      element.style.position = "fixed";
      element.style.top = rect.top + "px";
      element.style.left = rect.left + "px";
      element.style.margin = "0";
      element.style.transform = "translate3d(0,0,0)";

      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = rect.left;
      const startTop = rect.top;
      const elW = rect.width;
      const elH = rect.height;
      const pad = 8;

      try { handle.setPointerCapture(e.pointerId); } catch (_) {}

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const maxL = window.innerWidth - elW - pad;
        const maxT = window.innerHeight - elH - pad;
        const cl = Math.min(Math.max(startLeft + dx, pad), Math.max(pad, maxL));
        const ct = Math.min(Math.max(startTop + dy, pad), Math.max(pad, maxT));
        element.style.transform = `translate3d(${cl - startLeft}px, ${ct - startTop}px, 0)`;
      };

      const end = (ev) => {
        const r = element.getBoundingClientRect();
        element.style.left = r.left + "px";
        element.style.top = r.top + "px";
        element.style.transform = "translate3d(0,0,0)";
        try { handle.releasePointerCapture(ev.pointerId); } catch (_) {}
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    });
  }

  colorPicker.on("input:start", () => {
    isWheelDragging = true;
    if (colorPreview) colorPreview.classList.add("no-transition");
  });
  colorPicker.on("input:end", () => {
    isWheelDragging = false;
    if (colorPreview) colorPreview.classList.remove("no-transition");
  });
  colorPicker.on("color:change", (color) => {
    if (colorText && document.activeElement !== colorText) {
      colorText.value = color.hexString;
    }
    updatePreview(color.hexString);
    hideError();
  });

  if (colorText) {
    colorText.addEventListener("input", (e) => {
      if (isWheelDragging) return;
      hideError();
      const val = e.target.value.trim();
      if (!val) { updatePreview("#888888"); return; }
      if (isValidHex(val)) {
        colorPicker.color.set(val);
        updatePreview(val);
      } else {
        const hex = getHexFromColorName(val);
        if (hex) {
          colorPicker.color.set(hex);
          updatePreview(hex);
        } else {
          updatePreview("#888888");
        }
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      if (!colorText) return;
      const val = colorText.value.trim();
      if (val && !isValidHex(val) && !getHexFromColorName(val)) {
        e.preventDefault();
        showError();
        colorText.focus();
      }
    });
  }

  // Mobile keyboard detection
  const originalHeight = window.innerHeight;
  window.addEventListener("resize", () => {
    if (window.innerHeight < originalHeight - 100) {
      document.body.classList.add("keyboard-open");
    } else {
      document.body.classList.remove("keyboard-open");
    }
  });
});
