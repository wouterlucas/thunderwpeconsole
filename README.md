# ThunderWPEConsole

## Overview
ThunderWPEConsole is a lightweight JavaScript library designed to:
- Launch a WPEWebKit browser instance inside Thunder.
- Connect to a WebSocket-based JSON-RPC API.
- Manage browser lifecycle (start, stop, resume, set URL, close, quit).
- Capture and process console logs from the browser.

## Features
- **WebSocket Communication**: Uses JSON-RPC over WebSockets for control.
- **Functional Programming**: No classes, just efficient, composable functions.
- **Full Lifecycle Control**: Start, stop, resume, set URLs dynamically, and quit sessions.
- **Console Log Monitoring**: Hooks into browser console logs via WebSocket events.

## Installation
```sh
npm install
```

## Usage

### Initializing the ThunderWebkitAPI
```javascript
import { createThunderWebkitAPI } from "./thunderWebkitAPI.js";

// Event handler for logging session events
function handleEvent(event) {
  console.log(`[${event.source}] ${event.type}:`, event.message);
}

// Create an API instance
const api = createThunderWebkitAPI(
  {
    thunderUrl: "ws://localhost:9998",
    callsign: "UX",
    targetUrl: "https://example.com",
    webInspectorHost: "192.168.1.100",
  },
  handleEvent
);

(async () => {
  console.log("Starting session...");
  await api.start();

  console.log("Launching new URL...");
  await api.launch("https://new-url.com");

  setTimeout(async () => {
    console.log("Closing browser instance...");
    await api.close();
  }, 10000);

  setTimeout(async () => {
    console.log("Quitting session...");
    await api.quit();
  }, 20000);
})();
```

## API Reference
### ThunderWebkitAPI (`thunderWebkitAPI.js`)
- **`start()`**: Starts a new session, launching the initial URL.
- **`launch(url)`**: Launches a new URL in the browser.
- **`close()`**: Closes the current browser instance.
- **`quit()`**: Stops the entire session and disposes of the Thunder API.

### WebSocket Client (`wsClient.js`)
- **`connect({ url })`**: Connects to the WebSocket server.
- **`send(data)`**: Sends a JSON-RPC request.
- **`close()`**: Closes the WebSocket connection.
- **`on(event, callback)`**: Listens for WebSocket events (`open`, `message`, `close`, `error`).

## Development & Testing
### Running Tests
```sh
npx vitest
```

### Formatting
```sh
npm run prettier
```

## License
Apache 2.0