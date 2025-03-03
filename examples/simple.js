import { createThunderWebkitAPI } from "./thunderWebkitAPI.js";

// Event handler for logging session events
function handleEvent(event) {
  console.log(`[${event.source}] ${event.type}:`, event.message);
}

// Create a ThunderWebkitAPI instance
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
