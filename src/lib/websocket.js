/**
 * @typedef {Object} WebSocketOptions
 * @property {string} url - WebSocket server URL.
 * @property {number} [timeout=5000] - Connection timeout in milliseconds.
 * @property {string[]} [protocols=[]] - Subprotocols for the WebSocket connection.
 * 
 * @typedef {Object} WebSocketClient
 * @property {(options: WebSocketOptions) => Promise<void>} connect - Connects to a WebSocket server.
 * @property {(message: string | ArrayBuffer | Blob) => void} send - Sends a message to the WebSocket server.
 * @property {() => void} close - Closes the WebSocket connection and returns with the response data.
 * @property {(event: string, handler: Function) => void} on - Registers an event listener for WebSocket events.
 */

/**
 * Creates a simple WebSocket client with event-based messaging.
 * @returns {WebSocketClient} WebSocket client with methods for communication.
 */
export function createWebSocketClient() {
    /**
     * @type {WebSocket | null}
     */
    let socket = null;
    let events = new EventTarget();
    /**
     * @type {string | number | NodeJS.Timeout | undefined}
     */
    let timeoutId = undefined;


    /**
     * Connects to a WebSocket server.
     * @param {WebSocketOptions} WebSocketOptions - Connection options.
     * @returns {Promise<void>} Resolves on successful connection, rejects on failure or timeout.
     */
    function connect({ url, timeout = 5000, protocols = [] }) {
        return new Promise((resolve, reject) => {
            if (socket) close();

            socket = new WebSocket(url, protocols);
            let connected = false;

            const onOpen = () => {
                clearTimeout(timeoutId);
                connected = true;
                events.dispatchEvent(new Event('open'));
                resolve();
            };

            const onError = (/** @type {Event} */ err) => {
                if (!connected) reject(new Error('WebSocket connection failed'));
                events.dispatchEvent(new CustomEvent('error', { detail: err }));
            };

            const onClose = () => {
                events.dispatchEvent(new Event('close'));
            };

            const onMessage = (/** @type {{ data: any; }} */ message) => {
                events.dispatchEvent(new CustomEvent('message', { detail: message.data }));
            };

            socket.addEventListener('open', onOpen);
            socket.addEventListener('error', onError);
            socket.addEventListener('close', onClose);
            socket.addEventListener('message', onMessage);

            timeoutId = setTimeout(() => {
                if (!connected) {
                    close();
                    reject(new Error('WebSocket connection timed out'));
                }
            }, timeout);
        });
    }

    /**
     * Sends a message to the WebSocket server.
     * @param {string | ArrayBuffer | Blob} data - Data to send.
     * @throws {Error} Throws an error if the WebSocket is not open.
     */
    function send(data) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            console.log('Sending data', data);
            socket.send(data);
        } else {
            throw new Error('WebSocket is not open');
        }
    }

    /**
     * Closes the WebSocket connection.
     */
    function close() {
        if (socket) {
            socket.removeEventListener('open', () => {});
            socket.removeEventListener('error', () => {});
            socket.removeEventListener('close', () => {});
            socket.removeEventListener('message', () => {});
            socket.close();
            socket = null;
        }
    }

    /**
     * Registers an event listener for WebSocket events.
     * @param {string} event - Event name (e.g., "open", "message", "close", "error").
     * @param {Function} handler - Callback function to handle the event.
     */
    function on(event, handler) {
        events.addEventListener(event, (e) => handler(e));
    }

    return { connect, send, close, on };
}
