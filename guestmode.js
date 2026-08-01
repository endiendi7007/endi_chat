// Global guestmode state attached to window so other scripts can read it
window.guestmode = null;

// Helper function: Ensures DOM manipulation runs safely even if WS fires before DOM is loaded
function onDOMReady(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

// ==========================================
// Reusable Liquid Morph Animation Function
// ==========================================
function morphButtonText(newText) {
  onDOMReady(() => {
    const submitBtnText = document.getElementById('submit-btn-text');
    
    if (!submitBtnText || submitBtnText.textContent === newText) return;

    submitBtnText.classList.remove("text-shapeshift");
    void submitBtnText.offsetWidth; // Force browser layout repaint
    
    submitBtnText.classList.add("text-shapeshift");

    setTimeout(() => {
      submitBtnText.textContent = newText;
    }, 180);

    setTimeout(() => {
      submitBtnText.classList.remove("text-shapeshift");
    }, 450);
  });
}

// ==========================================
// Guest Mode State Controllers
// ==========================================
function handleGuestModeOn() {
  onDOMReady(() => {
    console.log("Guest mode is ON -> Showing button");
    const moreBtn = document.getElementById('more-btn');
    const tokenCheckbox = document.getElementById('has-token-checkbox');

    if (moreBtn) moreBtn.classList.remove('hidden');

    const textShouldBe = (tokenCheckbox && tokenCheckbox.checked) ? "Next" : "Enter Chat";
    morphButtonText(textShouldBe);
  });
}

function handleGuestModeOff() {
  onDOMReady(() => {
    console.log("Guest mode is OFF -> Hiding elements & setting button to Next");
    const moreBtn = document.getElementById('more-btn');
    const tokenGroup = document.getElementById('token-option-group');
    
    if (moreBtn) {
      moreBtn.classList.add('hidden');
      moreBtn.setAttribute('aria-expanded', 'false');
    }
    
    if (tokenGroup) {
      tokenGroup.classList.add('hidden');
      tokenGroup.classList.remove('open');
    }

    morphButtonText("Next");
  });
}

window.showToast = function(text) {
  onDOMReady(() => {
    const toast = document.createElement("div");
    toast.textContent = text;
    Object.assign(toast.style, {
      position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
      background: "#333", color: "#fff", padding: "8px 16px", borderRadius: "4px",
      zIndex: "9999", fontSize: "14px"
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  });
};

window.setGuestMode = function(state, silent = false) {
  window.guestmode = state;
  localStorage.setItem('saved_guestmode', state);

  if (window.guestmode === "on") {
    if (!silent) window.showToast("Passed");
    handleGuestModeOn();
  } else {
    handleGuestModeOff();
  }
  console.log("Guest mode set to:", window.guestmode);
};

// ==========================================
// WebSocket Connection
// ==========================================
const ws = new WebSocket("ws://192.168.1.10:8765"); 

ws.onmessage = (event) => {
  try {
    const frame = JSON.parse(event.data);
    if (frame.type === "SERVER_INFO") {
      const serverInfo = JSON.parse(atob(frame.payload));
      
      if (serverInfo.enable_guest_access === true) {
        window.setGuestMode("on", true);
      } else {
        window.setGuestMode("off", true);
      }
    }
  } catch (err) {
    console.error("Failed to parse WebSocket message:", err);
  }
};

ws.onerror = () => {
  console.log("WebSocket offline. Backend is off -> Setting guestmode OFF.");
  window.setGuestMode("off", true);
};

// ==========================================
// DOM Element Listeners & Logic
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  
  // 1. INSTANTLY RESTORE STATE ON PAGE LOAD
  const savedState = localStorage.getItem('saved_guestmode');
  if (savedState) {
    window.setGuestMode(savedState, true);
  }

  const moreBtn = document.getElementById('more-btn');
  const tokenGroup = document.getElementById('token-option-group');
  const tokenCheckbox = document.getElementById("has-token-checkbox");
  const loginForm = document.querySelector('.login-form');

  // 2. Toggle the Token section
  if (moreBtn && tokenGroup) {
    moreBtn.addEventListener('click', function() {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      const nextState = !isExpanded;
      
      this.setAttribute('aria-expanded', String(nextState));
      
      if (nextState) {
        tokenGroup.classList.remove('hidden');
        tokenGroup.classList.add('open');
      } else {
        tokenGroup.classList.add('hidden');
        tokenGroup.classList.remove('open');
      }
    });
  }

  // 3. Animate and shapeshift the Submit Button text on Checkbox click
  if (tokenCheckbox) {
    tokenCheckbox.addEventListener("change", function() {
      if (window.guestmode === "on") {
        morphButtonText(this.checked ? "Next" : "Enter Chat");
      }
    });
  }

  // 4. Token Password Visibility Toggle
  const tokenInput = document.getElementById('token-input');
  const toggleVisibilityBtn = document.getElementById('toggle-token-visibility');
  const eyeIconOff = document.getElementById('eye-icon-off');
  const eyeIconOn = document.getElementById('eye-icon-on');

  if (toggleVisibilityBtn && tokenInput) {
    toggleVisibilityBtn.addEventListener('click', () => {
      const isPassword = tokenInput.getAttribute('type') === 'password';
      
      // Toggle input type
      tokenInput.setAttribute('type', isPassword ? 'text' : 'password');
      
      // Toggle SVG icons
      if (eyeIconOff && eyeIconOn) {
        eyeIconOff.classList.toggle('hidden', isPassword);
        eyeIconOn.classList.toggle('hidden', !isPassword);
      }
    });
  }

  // 5. Form Submission & Step Routing inside the Same Card
  if (loginForm) {
    let currentStep = 1;
    
    const step1Div = document.getElementById('step-1');
    const step2Div = document.getElementById('step-2');
    const cardTitle = document.getElementById('card-title');
    const cardSubtitle = document.getElementById('card-subtitle');
    const closeTokenBtn = document.getElementById('close-token-btn');

    // Helper: Return to Step 1 View
    function resetToStep1() {
      step2Div.classList.add('step-hidden');
      step1Div.classList.remove('step-hidden');
      cardTitle.textContent = "Welcome";
      cardSubtitle.textContent = "Enter your details below";
      currentStep = 1;
    }

    // Top Right 'X' Button Click Handler
    if (closeTokenBtn) {
      closeTokenBtn.addEventListener('click', resetToStep1);
    }

    loginForm.addEventListener('submit', function(event) {
      event.preventDefault(); 
      
      if (currentStep === 1) {
        // --- STEP 1: NAME & COLOR ---
        const userName = document.getElementById('name').value;
        const userColor = document.getElementById('color-text').value;

        // Save details to Local Storage
        localStorage.setItem('chat_username', userName);
        localStorage.setItem('chat_usercolor', userColor);

        const currentAction = document.getElementById('submit-btn-text').textContent;

        if (currentAction === "Next") {
          // Switch view to Step 2 inside the same card
          step1Div.classList.add('step-hidden');
          step2Div.classList.remove('step-hidden');
          
          cardTitle.textContent = "Authentication";
          cardSubtitle.textContent = "Please enter your access token";
          
          currentStep = 2;
        } else {
          // Direct Guest Join
          console.log("Data saved! Redirecting to Chat as Guest...");
          window.location.href = "chat.html";
        }

      } else if (currentStep === 2) {
        // --- STEP 2: TOKEN ENTRY ---
        const userToken = document.getElementById('token-input').value;
        
        if (!userToken) {
           window.showToast("Token cannot be empty!");
           return;
        }

        // Save token to Local Storage and redirect
        localStorage.setItem('chat_token', userToken);
        console.log("Token saved! Redirecting to Chat...");
        window.location.href = "chat.html";
      }
    });
  }
});
