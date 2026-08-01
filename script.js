document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Color Wheel
  const colorPicker = new iro.ColorPicker("#color-wheel", {
    width: 150,
    color: "#007aff",
    borderWidth: 2,
    borderColor: "#ffffff",
    layout: [
      { component: iro.ui.Wheel },
      { component: iro.ui.Slider, sliderType: 'value' }
    ]
  });

  // ========================================================
  // ANTI-LAG & TELEPORT FIX
  // Kills all CSS transitions on the wheel elements so they 
  // move instantly with your cursor, without rubber-banding.
  // ========================================================
  const noLagStyle = document.createElement('style');
  noLagStyle.innerHTML = `
    .IroColorPicker, 
    .IroColorPicker *,
    .IroColorPicker svg,
    .IroWheel,
    .IroSlider {
      transition: none !important;
      animation: none !important;
    }
  `;
  document.head.appendChild(noLagStyle);

  const colorText = document.getElementById('color-text');
  const colorPreview = document.getElementById('color-preview');
  const toggleBtn = document.getElementById('color-toggle-btn');
  const popover = document.getElementById('wheel-popover');
  const header = document.getElementById('wheel-header');
  const closeBtn = document.getElementById('close-wheel-btn');
  const colorError = document.getElementById('color-error');
  const loginForm = document.querySelector('.login-form');

  // Track if user is actively dragging to prevent infinite update loops
  let isWheelDragging = false;

  // Helper: Convert CSS color names to Hex
  function getHexFromColorName(colorName) {
    if (!colorName) return null;
    const formattedName = colorName.trim().toLowerCase().replace(/\s+/g, '');
    const ctx = document.createElement('canvas').getContext('2d');
    
    ctx.fillStyle = '#123456';
    ctx.fillStyle = formattedName;
    if (ctx.fillStyle !== '#123456') return ctx.fillStyle;

    ctx.fillStyle = '#abcdef';
    ctx.fillStyle = formattedName;
    if (ctx.fillStyle !== '#abcdef') return ctx.fillStyle;

    return null;
  }

  function isValidHex(str) {
    return /^#([0-9A-F]{3}){1,2}$/i.test(str);
  }

  function updatePreview(color) {
    if (colorPreview) {
      if (color && color !== 'transparent') {
        colorPreview.style.backgroundColor = color;
      } else {
        colorPreview.style.backgroundColor = '#888888';
      }
    }
  }

  function showError() {
    if (colorText) colorText.classList.add('invalid-color');
    if (colorError) colorError.classList.add('show');
    updatePreview('#888888');
  }

  function hideError() {
    if (colorText) colorText.classList.remove('invalid-color');
    if (colorError) colorError.classList.remove('show');
  }

  // 2. Toggle Window Visibility
  if (toggleBtn && popover) {
    toggleBtn.addEventListener('click', () => {
      popover.classList.toggle('show');
    });
  }

  if (closeBtn && popover) {
    closeBtn.addEventListener('click', () => {
      popover.classList.remove('show');
    });
  }

  // 3. Popover Drag Engine
  if (popover && header) {
    makeDraggable(popover, header);
  }

  function makeDraggable(element, handle) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#close-wheel-btn')) return;

      const rect = element.getBoundingClientRect();
      element.style.position = 'fixed';
      element.style.top = rect.top + 'px';
      element.style.left = rect.left + 'px';
      element.style.margin = '0';
      // Start from a translated (GPU-composited) baseline instead of 'none'
      element.style.transform = 'translate3d(0, 0, 0)';

      const startX = e.clientX;
      const startY = e.clientY;

      try { handle.setPointerCapture(e.pointerId); } catch (err) {}

      // ANTI-LAG FIX: move via transform (compositor-only) instead of
      // left/top (layout-triggering). This is what was causing the
      // stutter/frame-rate drop while dragging the panel.
      const onPointerMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        element.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      };

      const endDrag = (endEvent) => {
        // Bake the translated offset back into left/top and reset the
        // transform, so the element's real position stays accurate for
        // the next drag (or anything else that reads its position).
        const finalRect = element.getBoundingClientRect();
        element.style.left = finalRect.left + 'px';
        element.style.top = finalRect.top + 'px';
        element.style.transform = 'translate3d(0, 0, 0)';

        try { handle.releasePointerCapture(endEvent.pointerId); } catch (err) {}
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', endDrag);
        handle.removeEventListener('pointercancel', endDrag);
      };

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', endDrag);
      // FIX: handle interrupted drags too, or these listeners never get
      // cleaned up and stack on top of the next drag's listeners.
      handle.addEventListener('pointercancel', endDrag);
    });
  }

  // 4. Track Wheel Drag State cleanly
  colorPicker.on('input:start', () => {
    isWheelDragging = true;
    if (colorPreview) colorPreview.classList.add('no-transition');
  });

  colorPicker.on('input:end', () => {
    isWheelDragging = false;
    if (colorPreview) colorPreview.classList.remove('no-transition');
  });

  // Wheel -> Text Field Sync
  colorPicker.on('color:change', function(color) {
    // ONLY update the text input if the user isn't clicked inside it typing!
    if (colorText && document.activeElement !== colorText) {
      colorText.value = color.hexString;
    }
    updatePreview(color.hexString);
    hideError();
  });

  // 5. Live Preview Sync (Text Field -> Wheel)
  if (colorText) {
    colorText.addEventListener('input', (e) => {
      // PREVENT INFINITE LOOP: Ignore if the user is currently holding the wheel
      if (isWheelDragging) return; 

      hideError();
      const val = e.target.value.trim();

      if (val === "") {
        updatePreview('#888888');
        return;
      }

      if (isValidHex(val)) {
        colorPicker.color.set(val);
        updatePreview(val);
      } else {
        const hex = getHexFromColorName(val);
        if (hex) {
          colorPicker.color.set(hex);
          updatePreview(hex);
        } else {
          updatePreview('#888888');
        }
      }
    });
  }

  // 6. Form Submission Validation
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault(); 
      if (!colorText) return;
      const val = colorText.value.trim();

      if (val !== "") {
        const isHex = isValidHex(val);
        const isName = getHexFromColorName(val);

        if (!isHex && !isName) {
          showError();       
          colorText.focus();
          return;
        }
      }
      console.log("Form is valid! Ready to join. Guest mode state is currently:", window.guestmode);
    });
  }

  // 7. Mobile Keyboard Detection
  const originalHeight = window.innerHeight;
  window.addEventListener('resize', () => {
    if (window.innerHeight < originalHeight - 100) {
      document.body.classList.add('keyboard-open');
    } else {
      document.body.classList.remove('keyboard-open');
    }
  });
});
