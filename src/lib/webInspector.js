import { createWebSocketClient } from './websocket.js';

/** types
 * @typedef {Object} webInspectorConfig
 * @property {string} hostIP - IP address of the WebInspector host.
 * @property {number} port - Port number for the WebSocket connection.
 *
 * imports
 * @typedef {import("./websocket.js").WebSocketClient}WebSocketClient
 *
 * @typedef {Object} WebInspectorClient
 * @property {() => void} connect - Establishes a WebSocket connection to WebInspector.
 * @property {() => void} disconnect - Closes the WebSocket connection.
 * @property {() => boolean} isConnected - Returns true if the WebSocket connection is open.
 *
 * Connects to WebKit's WebInspector to retrieve console logs.
 * NOTE: Only 1 WebInspector connection is allowed per host/agent.
 * @param {webInspectorConfig} config - Configuration object.
 * @param {Function} onMessage - Callback function to handle incoming console logs.
 * @returns {WebInspectorClient} API with `connect` and `disconnect` functions.
 */
export function createWebInspectorClient(config, onMessage) {
    let ws = null;

    /**
     * Handles incoming WebSocket messages.
     * @param {CustomEvent} event - The raw message from WebInspector.
     */
    function handleMessage(event) {
        if (!event || !event.detail) return;

        try {
            const message = JSON.parse(event.detail);
            if (message.method === 'Console.messageAdded' && message.params?.message?.text) {
                onMessage(null, message.params.message.text);
            }
        } catch (error) {
            console.error('Error parsing WebInspector message:', error);
        }
    }

    /**
     * Establishes a WebSocket connection to WebInspector.
     */
    async function connect() {
        if (ws) disconnect();

        ws = createWebSocketClient();
        ws.connect({
            url: `ws://${config.hostIP}:${config.port}/socket/1/1/WebPage`
        });

        ws.on('open', () => {
            if (!ws) return;

            ws.send(JSON.stringify({ id: 1, method: 'Inspector.enable' }));
            ws.send(JSON.stringify({ id: 22, method: 'Console.enable' }));
            ws.send(JSON.stringify({ id: 23, method: 'Inspector.initialized' }));
        });

        ws.on('message', handleMessage);
        ws.on('error', (error) => {
            console.error('WebInspector connection error:', error);
        });

        ws.on('close', () => {
            console.log('WebInspector connection closed');
        });
    }

    /**
     * Closes the WebSocket connection.
     */
    function disconnect() {
        console.log('Closing WebInspector WebSocket connection');
        if (ws) {
            ws.close();
            ws = null;
        }
    }

    /**
     * Is the WebSocket connection open?
     * @returns {boolean} Returns true if the connection is open.
     */
    function isConnected() {
        return ws !== null && ws.isConnected();
    }

    return { connect, disconnect, isConnected };
}
