/**
 * Endi's Chat – Frontend Config
 * Change backendHost to the IP of the machine running the LAN Chat backend.
 * Port must match the backend (default 8765).
 */
window.ENDI_CONFIG = {
  backendHost: "https://1c98d82b94a806de-117-227-11-71.serveousercontent.com/",   // ← change this
  backendPort: 443,

  get wsUrl() {
    return `ws://${this.backendHost}:${this.backendPort}`;
  }
};
