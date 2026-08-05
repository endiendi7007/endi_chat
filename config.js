/**
 * Endi's Chat – Frontend Config
 */
window.ENDI_CONFIG = {
  // Your ngrok domain (without https:// or port numbers)
  backendHost: "superseraphic-chi-paradoxically.ngrok-free.dev",

  get wsUrl() {
    return `wss://${this.backendHost}`;
  }
};
