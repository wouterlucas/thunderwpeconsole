import { createWebSocketClient } from './websocket.js';

/**
 * @typedef {Object} ThunderSession
 * @property {() => Promise<void>} connect - Establishes a WebSocket connection to Thunder.
 * @property {() => Promise<Object>} disconnect - Closes the Thunder connection.
 * @property {(boolean) => Promise<Object>} stop - Stops the currently running instance and returns the response.
 * @property {() => Promise<void>} start - Starts a new instance of the console.
 * @property {() => Promise<void>} resume - Resumes a previously stopped instance.
 * @property {(url: string) => void} setURL - Sets the WebSocket or API URL for communication.
 * @property {(eventType: string, matchParams: Object) => Promise<Object>} waitForEvent - Waits for a specific event notification from Thunder.
 * @property {() => boolean} isConnected - Returns true if the WebSocket connection is open.
 *
 * @typedef {Object} ThunderSessionConfig
 * @property {string} host - WebSocket URL of the Thunder instance.
 * @property {string} callsign - Callsign for the module (e.g., "UX" or "Browser").
 * @property {number} [jsonRpcId=1] - Starting JSON-RPC message ID.
 *
 * Creates a Thunder session to control WebKitBrowser via WebSocket.
 * @param {ThunderSessionConfig} config - Configuration for the session.
 * @returns {ThunderSession} Thunder session with control methods.
 */
export function createThunderSession(config) {
    const { host, callsign, jsonRpcId = 1 } = config;
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
        await wsClient.connect({ url: `ws://${host}:80/jsonrpc` });

        // once connected subscribe to events
        wsClient.send(
            JSON.stringify({
                jsonrpc: '2.0',
                id: nextId(),
                method: 'Controller.1.register',
                params: { event: 'all', id: 'client.Controller.events' }
            })
        );
    }

    /**
     * Is thunder connected?
     * @returns {boolean} Returns true if the WebSocket connection is open.
     */
    function isConnected() {
        return wsClient.isConnected();
    }

    /**
     * Get the controller status
     * @returns {Promise<Object>} Resolves with the controller status.
     */
    function status() {
        return sendRpc('Controller.1.status');
    }

    /**
     * Get instance state
     * @returns {Promise<'Activated'|'Deactivated'|'Suspended'|'Resumed'>} Resolves with true if an instance is running.
     */
    async function getState() {
        const result = await status();
        return result.filter((instance) => instance.callsign === callsign)[0].state;
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

            wsClient.on('message', (event) => {
                if (!event || !event.detail) return;

                try {
                    const response = JSON.parse(event.detail);
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
     * Waits for a specific event notification from Thunder.
     * @param {string} eventType - The event type to wait for.
     * @param {Object} matchParams - The parameters to match in the event.
     * @returns {Promise<Object>} Resolves when the matching event is received.
     */
    function waitForEvent(eventType, matchParams = {}) {
        return new Promise((resolve) => {
            const handleEvent = (event) => {
                if (!event || !event.detail) return;

                try {
                    const response = JSON.parse(event.detail);
                    if (
                        response.method === 'client.Controller.events.all' ||
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
                } catch (_) {
                    wsClient.off('message', handleEvent);
                }
            };

            wsClient.on('message', handleEvent);
        });
    }

    /**
     * Sends a request to stop the current instance.
     * @returns {Promise<Object>} Resolves when the instance is stopped.
     */
    function stop() {
        return new Promise(async (resolve, reject) => {
            const state = await getState();

            // If the instance is not running, resolve immediately
            if (state === 'Deactivated') {
                resolve();
                return;
            }

            waitForEvent('statechange', { state: 'deactivated' }).then(resolve).catch(reject);
            await sendRpc('Controller.1.deactivate', { callsign });
        });
    }

    /**
     * Starts the instance and waits for activation.
     * @returns {Promise<void>} Resolves when the instance is activated.
     */
    function start() {
        return new Promise(async (resolve, reject) => {
            const state = await getState();

            // If the instance is not running, resolve immediately
            if (state === 'Activated' || state === 'Resumed') {
                resolve();
                return;
            }

            waitForEvent('statechange', { state: 'activated' }).then(resolve).catch(reject);

            // Send the activate command
            await sendRpc('Controller.1.activate', { callsign });
        });
    }

    /**
     * Resumes the instance after it has been started.
     * @returns {Promise<void>} Resolves when the instance is resumed.
     */
    function resume() {
        return new Promise(async (resolve, reject) => {
            const state = await getState();

            // If the instance is not running, resolve immediately
            if (state === 'Activated' || state === 'Resumed') {
                resolve();
                return;
            }

            waitForEvent('statechange', { suspended: false }).then(resolve).catch(reject);

            // Send the activate command
            await  sendRpc('Controller.1.resume', { callsign })
        });
    }

    /**
     * Sets the URL for the WebKitBrowser instance.
     * @param {string} newUrl - The URL to be set.
     * @returns {Promise<void>} Resolves when the URL is set and loaded.
     */
    function setURL(newUrl) {
        return new Promise(async (resolve, reject) => {
            // The below doesn't work even though it is per spec, we need to do a workaround
            // const state = await getState();

            // // If the instance is not running, resolve immediately
            // if (state === 'Deactivated' || state === 'Suspended') {
            //     console.error('setUrl Instance not running, state is:', state);
            //     reject();
            //     return;
            // }

            // waitForEvent('urlchange', { url: newUrl, loaded: true }).then(resolve).catch(reject);
            // await sendRpc('WebKitBrowser.1.url', newUrl);


            // work arround because WS doesnt work setting the url
            // we have to post a message to the browser

            // do a HTTP POST to http://<host>/Service/<callsign>/URL
            // with body {url: "http://<url>"}

            const url = `http://${config.host}/Service/${callsign}/URL`;
            const body = { url: newUrl };

            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }).then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to set URL');
                }
                resolve();
            }).catch((error) => {
                console.error('Failed to set URL:', error);
                reject(error);
            });
        });
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
