# Endi's Chat – Frontend 1.0

Web client for the **LAN Chat** backend (v2.4.x).

## Features

- Login with name + color (optional token / guest mode)
- Dark / light theme
- Encrypted WebSocket chat (X25519 + HKDF + AES-256-GCM)
- Sent / received message bubbles styled per theme
- Attach sheet (Photos / Documents) – file upload UI ready
- Configurable backend IP via `config.js`

## Quick start

1. Copy your image assets into `pictures/`  
   (darksettings.png, lightsettings.png, bardark.jpg, barlight.jpg,  
   darkbackground.jpg, lightbackground.jpg, dark.png, light.png,  
   darktolight.webp, lighttodark.webp, backdark.png, backlight.png)

2. Edit **`config.js`**:

```js
window.ENDI_CONFIG = {
  backendHost: "192.168.1.42",  // ← your backend machine IP
  backendPort: 8765,
  // ...
};
```

3. Serve the folder over HTTP (required for Web Crypto + WebSocket):

```bash
# simple local server
python3 -m http.server 8080
# then open http://localhost:8080/login.html
```

4. Start the LAN Chat backend on the same network, then open the login page on your phone/PC.

## Files

| File | Role |
|------|------|
| `config.js` | Backend host / port |
| `login.html` + `guestmode.js` + `script.js` | Login, guest detection, color picker |
| `chat.html` + `chat.js` | Chat UI + protocol client |
| `settings.html` | Theme + shows current backend URL |
| `style.css` | Shared styles |

## Protocol notes

- Connects to `ws://<host>:<port>`
- Performs JOIN with X25519 public key
- Derives session AES key from JOIN_ACK
- Optional AUTH with token after key derivation (v2.4)
- CHAT messages are AES-GCM encrypted

## Browser support

Requires Web Crypto **X25519** support: Chrome/Edge 133+, Firefox 130+, Safari 17+. On an older or non-updating browser, JOIN will fail with a "Join error" toast — check the browser console for a `NotSupportedError` from `crypto.subtle.generateKey`.

## Version

`endi_chat_frontend_1.0` – matches LAN Chat backend **2.4.1**
