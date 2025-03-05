import { createThunderWebkitAPI } from "../src/index.js";

// Event handler for logging session events
function handleEvent(event) {
  console.log(`[${event.source}] ${event.type}:`, event.message);
}

// Create a ThunderWebkitAPI instance
const api = createThunderWebkitAPI(
  {
    host: "rpi.wouterlucas.com",
    callsign: "UX",
    webInspectorPort: 10000,
  },
  handleEvent
);

(async () => {
  console.log("Starting session...");
  await api.start();

  console.log("Launching new URL...");
  await api.launch("https://blits-demo.lightningjs.io/");

  // setTimeout(async () => {
  //   console.log("Closing browser instance...");
  //   await api.close();
  // }, 10000);

  // setTimeout(async () => {
  //   console.log("Quitting session...");
  //   await api.quit();
  // }, 20000);
})();
