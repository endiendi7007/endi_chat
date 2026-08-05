/**
 * Endi's Chat – Frontend Config
 * Change backendHost to the IP of the machine running the LAN Chat backend.
 * Port must match the backend (default 8765).
 */
window.ENDI_CONFIG = {
  backendHost: "192.168.1.10",   // ← change this
  backendPort: 8765,

  get wsUrl() {
    return `ws://${this.backendHost}:${this.backendPort}`;
  }
};
