import { createWebSocketClient } from './websocket.js';

/**
 * @typedef {Object} ThunderSession
 * @property {() => Promise<void>} connect - Establishes a WebSocket connection to Thunder.
 * @property {() => Promise<Object>} disconnect - Closes the Thunder connection.
 * @property {() => Promise<Object>} stop - Stops the currently running instance and returns the response.
 * @property {() => Promise<void>} start - Starts a new instance of the console.
 * @property {() => Promise<void>} resume - Resumes a previously stopped instance.
 * @property {(url: string) => void} setURL - Sets the WebSocket or API URL for communication.
 * @property {(eventType: string, matchParams: Object) => Promise<Object>} waitForEvent - Waits for a specific event notification from Thunder.
 * @property {() => boolean} isConnected - Returns true if the WebSocket connection is open.
 *
 * @typedef {Object} ThunderSessionConfig
 * @property {string} url - WebSocket URL of the Thunder instance.
 * @property {string} callsign - Callsign for the module (e.g., "UX" or "Browser").
 * @property {number} [jsonRpcId=1] - Starting JSON-RPC message ID.
 *
 * Creates a Thunder session to control WebKitBrowser via WebSocket.
 * @param {ThunderSessionConfig} config - Configuration for the session.
 * @returns {ThunderSession} Thunder session with control methods.
 */
export function createThunderSession(config) {
    const { url, callsign, jsonRpcId = 1 } = config;
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
     * Is thunder connected?
     * @returns {boolean} Returns true if the WebSocket connection is open.
     */
    function isConnected() {
        return wsClient.isConnected();
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
            const payload = { jsonrpc: '2.0', id, method, params };

            wsClient.send(JSON.stringify(payload));

            wsClient.on('message', (/** @type {string} */ data) => {
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
    function stop() {
        return sendRpc('Controller.1.deactivate', { callsign });
    }

    /**
     * Waits for a specific event notification from Thunder.
     * @param {string} eventType - The event type to wait for.
     * @param {Object} matchParams - The parameters to match in the event.
     * @returns {Promise<Object>} Resolves when the matching event is received.
     */
    function waitForEvent(eventType, matchParams = {}) {
        return new Promise((resolve) => {
            const handleEvent = (data) => {
                try {
                    const response = JSON.parse(data);
                    if (
                        response.method === 'client.Controller.events.all' &&
                        response.params.event === eventType
                    ) {
                        if (
                            Object.entries(matchParams).every(
                                ([key, value]) => response.params.params[key] === value
                            )
                        ) {
                            wsClient.off('message', handleEvent);
                            resolve(response);
                        }
                    }
                } catch (_) {}
            };

            wsClient.on('message', handleEvent);
        });
    }

    /**
     * Starts the instance and waits for activation.
     * @returns {Promise<void>} Resolves when the instance is activated.
     */
    async function start() {
        await sendRpc('Controller.1.activate', { callsign });
        await waitForEvent('statechange', { state: 'activated' });
    }

    /**
     * Resumes the instance after it has been started.
     * @returns {Promise<void>} Resolves when the instance is resumed.
     */
    async function resume() {
        await sendRpc('Controller.1.resume', { callsign });
        await waitForEvent('statechange', { suspended: false });
    }

    /**
     * Sets the URL for the WebKitBrowser instance.
     * @param {string} newUrl - The URL to be set.
     * @returns {Promise<void>} Resolves when the URL is set and loaded.
     */
    async function setURL(newUrl) {
        await sendRpc('WebKitBrowser.1.url', newUrl);
        await waitForEvent('urlchange', { url: newUrl, loaded: true });
    }

    /**
     * Closes the WebSocket connection.
     * @returns {Promise<void>} Resolves when the connection is closed.
     */
    async function disconnect() {
        await wsClient.close();
    }

    return { connect, disconnect, stop, start, resume, setURL, waitForEvent, isConnected };
}
