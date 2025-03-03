import { createThunderSession } from './lib/thunderSession.js';
import { createWebInspectorClient } from './lib/webInspector.js';

/**
 * Creates a unified API layer for managing Thunder and WebInspector sessions
 *
 * Configuration object:
 * @typedef {Object} config - Configuration object.
 * @property {string} thunderUrl - WebSocket URL of the Thunder instance.
 * @property {string} callsign - Callsign for the module (e.g., "UX" or "Browser").
 * @property {string} targetUrl - Initial URL to launch in WebKit.
 * @property {string} webInspectorHost - IP address of the WebInspector.
 * @property {number} [webInspectorPort=9998] - Port for WebInspector.
 *
 * API object:
 * @typedef {Object} UnifiedAPI - Unified API object.
 * @property {() => Promise<void>} start - Starts a new session, launching the initial URL.
 * @property {(url: string) => Promise<void>} launch - Launches a new URL in the browser.
 * @property {() => Promise<void>} close - Closes the current browser instance.
 * @property {() => Promise<void>} quit - Stops the entire session and disposes of the Thunder API.
 *
 * Imports
 * @typedef {import("./lib/thunderSession.js").ThunderSession} ThunderSession
 * @typedef {import("./lib/thunderSession.js").ThunderSessionConfig} ThunderSessionConfig
 * @typedef {import("./lib/webInspector.js").webInspectorConfig} webInspectorConfig
 * @typedef {import("./lib/webInspector.js").WebInspectorClient} WebInspectorClient
 * @typedef {import("./lib/websocket.js").WebSocketClient} WebSocketClient
 *
 * @param {config} config - Configuration object.
 * @param {Function} onEvent - Callback function for handling events and errors.
 * @returns {UnifiedAPI} Unified API object.
 */
export function createThunderWebkitAPI(config, onEvent) {
    /** @type {ThunderSession | null} */
    let thunderSession = null;
    /** @type {WebInspectorClient | null} */
    let webInspector = null;

    /**
     * Handles WebInspector console messages.
     * @param {Error|null} error - Error, if any.
     * @param {string} message - Console message.
     */
    function handleConsoleMessage(error, message) {
        if (error) {
            onEvent({ type: 'error', source: 'WebInspector', message: error.message });
        } else {
            onEvent({ type: 'console', source: 'WebInspector', message });
        }
    }

    /**
     * Starts a new session, launching the initial URL.
     * @returns {Promise<void>} Resolves when the session is fully started.
     */
    async function start() {
        if (thunderSession) {
            onEvent({ type: 'error', source: 'Thunder', message: 'Session already started' });
            return;
        }

        thunderSession = createThunderSession({
            url: config.thunderUrl,
            callsign: config.callsign,
        });

        webInspector = createWebInspectorClient(
            {
                hostIP: config.webInspectorHost,
                port: config.webInspectorPort || 9998,
            },
            handleConsoleMessage
        );

        try {
            await thunderSession.connect();

            onEvent({ type: 'connected', source: 'Thunder', message: 'Session connected' });
        } catch (error) {
            onEvent({
                type: 'error',
                source: 'Thunder',
                message: 'Failed to start Thunder session',
            });
        }
    }

    /**
     * Launches a new URL in the browser.
     * @param {string} url - The URL to load.
     * @returns {Promise<void>} Resolves when the URL is loaded.
     */
    async function launch(url) {
        if (!thunderSession) {
            onEvent({ type: 'error', source: 'Thunder', message: 'Session not started' });
            return;
        }

        try {
            await webInspector.disconnect();
            await thunderSession.stop();
            await thunderSession.start();
            await webInspector.connect();
            await thunderSession.resume();
            await thunderSession.setURL(url);

            onEvent({ type: 'url-launch', source: 'Thunder', message: `URL launched: ${url}` });
        } catch (error) {
            onEvent({ type: 'error', source: 'Thunder', message: 'Failed to launch URL' });
        }
    }

    /**
     * Closes the current browser instance.
     * @returns {Promise<void>} Resolves when the instance is closed.
     */
    async function close() {
        if (!thunderSession) {
            onEvent({ type: 'error', source: 'Thunder', message: 'Session not started' });
            return;
        }

        try {
            await webInspector.disconnect();
            await thunderSession.stop();
            onEvent({ type: 'closed', source: 'Thunder', message: 'Browser instance closed' });
        } catch (error) {
            onEvent({ type: 'error', source: 'Thunder', message: 'Failed to close instance' });
        }
    }

    /**
     * Stops the entire session and disposes of the Thunder API.
     * @returns {Promise<void>} Resolves when the session is fully stopped.
     */
    async function quit() {
        if (webInspector) {
            webInspector.disconnect();
            webInspector = null;
        }

        if (thunderSession) {
            try {
                await thunderSession.disconnect();
            } catch (error) {
                onEvent({ type: 'error', source: 'Thunder', message: 'Failed to stop instance' });
            }
            thunderSession = null;
        }

        onEvent({ type: 'quit', source: 'UnifiedAPI', message: 'Session fully stopped' });
    }

    return { start, launch, close, quit };
}
