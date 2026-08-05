/**
 * Endi's Chat – Frontend Config
 * Change backendHost to the IP of the machine running the LAN Chat backend.
 * Port must match the backend (default 8765).
 */
window.ENDI_CONFIG = {
  backendHost: "superseraphic-chi-paradoxically.ngrok-free.dev",   // ← change this
  backendPort: 443,

  get wsUrl() {
    return `wss://${this.backendHost}:${this.backendPort}`;
  }
};
