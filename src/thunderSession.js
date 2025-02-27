import { createWebSocketClient } from "./lib/websocket.js";

/**
 * @typedef {Object} ThunderWPEConsole
 * @property {() => Promise<void>} run - Starts the ThunderWPEConsole process.
 * @property {() => Promise<Object>} stopInstance - Stops the currently running instance and returns the response.
 * @property {() => Promise<void>} startInstance - Starts a new instance of the console.
 * @property {() => Promise<void>} resumeInstance - Resumes a previously stopped instance.
 * @property {(url: string) => void} setURL - Sets the WebSocket or API URL for communication.
 */

/**
 * Creates a Thunder session to control WebKitBrowser via WebSocket.
 * @param {Object} config - Configuration for the session.
 * @param {string} config.url - WebSocket URL of the Thunder instance.
 * @param {string} config.callsign - Callsign for the module (e.g., "UX" or "Browser").
 * @param {number} [config.jsonRpcId=1] - Starting JSON-RPC message ID.
 * @param {string} config.targetUrl - The URL to be set in WebKitBrowser.
 * @param {Function} [config.onConsoleLog] - Callback function for console log messages.
 * @returns {ThunderWPEConsole} Thunder session with control methods.
 */
export function createThunderSession(config) {
  const { url, callsign, jsonRpcId = 1, targetUrl, onConsoleLog } = config;
  const wsClient = createWebSocketClient();
  let messageId = jsonRpcId;

  /**
   * Generates the next unique JSON-RPC message ID.
   * @returns {number} The next message ID.
   */
  function nextId() {
    return messageId++;
  }

  /**
   * Establishes a WebSocket connection.
   * @returns {Promise<void>} Resolves when the connection is successful.
   */
  async function connect() {
    await wsClient.connect({ url });
  }

  /**
   * Sends a JSON-RPC request over the WebSocket.
   * @param {string} method - The JSON-RPC method to call.
   * @param {Object} [params={}] - The parameters for the method.
   * @returns {Promise<Object>} Resolves with the response data.
   */
  function sendRpc(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId();
      const payload = { jsonrpc: "2.0", id, method, params };

      wsClient.send(JSON.stringify(payload));

      wsClient.on("message", (/** @type {string} */ data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            resolve(response.result || response);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Sends a request to stop the current instance.
   * @returns {Promise<Object>} Resolves when the instance is stopped.
   */
  function stopInstance() {
    return sendRpc("Controller.1.deactivate", { callsign });
  }

  /**
   * Waits for a specific event notification from Thunder.
   * @param {string} eventType - The event type to wait for.
   * @param {Object} matchParams - The parameters to match in the event.
   * @returns {Promise<Object>} Resolves when the matching event is received.
   */
  function waitForEvent(eventType, matchParams = {}) {
    return new Promise((resolve) => {
      wsClient.on("message", (/** @type {string} */ data) => {
        try {
          const response = JSON.parse(data);
          if (response.method === "client.Controller.events.all" && response.params.event === eventType) {
            if (Object.entries(matchParams).every(([key, value]) => response.params.params[key] === value)) {
              resolve(response);
            }
          }
        } catch (_) {}
      });
    });
  }

  /**
   * Starts the instance and waits for activation.
   * @returns {Promise<void>} Resolves when the instance is activated.
   */
  async function startInstance() {
    await sendRpc("Controller.1.activate", { callsign });
    await waitForEvent("statechange", { state: "activated" });
  }

  /**
   * Resumes the instance after it has been started.
   * @returns {Promise<void>} Resolves when the instance is resumed.
   */
  async function resumeInstance() {
    await sendRpc("Controller.1.resume", { callsign });
    await waitForEvent("statechange", { suspended: false });
  }

  /**
   * Sets the URL for the WebKitBrowser instance.
   * @param {string} newUrl - The URL to be set.
   * @returns {Promise<void>} Resolves when the URL is set and loaded.
   */
  async function setURL(newUrl) {
    await sendRpc("WebKitBrowser.1.url", newUrl);
    await waitForEvent("urlchange", { url: newUrl, loaded: true });
  }

  /**
   * Runs the full Thunder session workflow:
   * 1. Connect to WebSocket.
   * 2. Stop the instance if it's running.
   * 3. Wait for deactivation.
   * 4. Start the instance.
   * 5. Resume it.
   * 6. Set the URL.
   * 7. Start listening for console logs.
   * @returns {Promise<void>} Resolves when the full sequence is completed.
   */
  async function run() {
    await connect();
    await stopInstance().catch(() => {}); // Ignore errors if instance is not running
    await waitForEvent("statechange", { state: "Deactivated" });
    await startInstance();
    await resumeInstance();
    // await setURL(targetUrl);
  }

  return { run, stopInstance, startInstance, resumeInstance, setURL };
}
