import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createThunderWebkitAPI } from "./index.js";

// Mock dependencies
vi.mock("../src/thunderSession.js", () => ({
  createThunderSession: vi.fn(() => ({
    connect: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    start: vi.fn(() => Promise.resolve()),
    resume: vi.fn(() => Promise.resolve()),
    setURL: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock("../src/webInspector.js", () => ({
  createWebInspectorClient: vi.fn(() => ({
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
  })),
}));

describe("ThunderWebkitAPI", () => {
  let api;
  let mockEventHandler;

  beforeEach(() => {
    mockEventHandler = vi.fn();
    api = createThunderWebkitAPI(
      {
        thunderUrl: "ws://localhost:9998",
        callsign: "UX",
        targetUrl: "https://example.com",
        webInspectorHost: "192.168.1.100",
      },
      mockEventHandler
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should start a session successfully", async () => {
    await api.start();
    expect(mockEventHandler).toHaveBeenCalledWith({
      type: "connected",
      source: "Thunder",
      message: "Session connected",
    });
  });

  it("should handle error when starting an already started session", async () => {
    await api.start();
    await api.start();
    expect(mockEventHandler).toHaveBeenCalledWith({
      type: "error",
      source: "Thunder",
      message: "Session already started",
    });
  });

  it("should launch a new URL successfully", async () => {
    await api.start();
    await api.launch("https://new-url.com");
    expect(mockEventHandler).toHaveBeenCalledWith({
      type: "url-launch",
      source: "Thunder",
      message: "URL launched: https://new-url.com",
    });
  });

  it("should handle launching a URL without a started session", async () => {
    await api.launch("https://new-url.com");
    expect(mockEventHandler).toHaveBeenCalledWith({
      type: "error",
      source: "Thunder",
      message: "Session not started",
    });
  });

  it("should close the browser instance successfully", async () => {
    await api.start();
    await api.close();
    expect(mockEventHandler).toHaveBeenCalledWith({
      type: "closed",
      source: "Thunder",
      message: "Browser instance closed",
    });
  });

  it("should handle closing without a started session", async () => {
    await api.close();
    expect(mockEventHandler).toHaveBeenCalledWith({
      type: "error",
      source: "Thunder",
      message: "Session not started",
    });
  });

  it("should quit the session successfully", async () => {
    await api.start();
    await api.quit();
    expect(mockEventHandler).toHaveBeenCalledWith({
      type: "quit",
      source: "UnifiedAPI",
      message: "Session fully stopped",
    });
  });
});
