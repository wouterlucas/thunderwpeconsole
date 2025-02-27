// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebSocketClient } from './websocket';

describe('WebSocket Client', () => {
    let wsClient;
    let mockWebSocket;

    beforeEach(() => {
        // Mock the global WebSocket object
        global.WebSocket = vi.fn(() => ({
            send: vi.fn(),
            close: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            readyState: WebSocket.CONNECTING, // Simulate initial state
        }));

        wsClient = createWebSocketClient();
        mockWebSocket = new WebSocket(); // Mock instance
    });

    afterEach(() => {
        vi.restoreAllMocks(); // Restore original functionality
    });

    it('should connect to WebSocket successfully', async () => {
        global.WebSocket.mockImplementationOnce(() => {
            return {
                send: vi.fn(),
                close: vi.fn(),
                addEventListener: (event, handler) => {
                    if (event === 'open') setTimeout(handler, 50); // Simulate open event
                },
                removeEventListener: vi.fn(),
                readyState: WebSocket.OPEN,
            };
        });

        await expect(wsClient.connect({ url: 'ws://localhost:8080' })).resolves.toBeUndefined();
    });

    it('should fail to connect on error', async () => {
        global.WebSocket.mockImplementationOnce(() => {
            return {
                send: vi.fn(),
                close: vi.fn(),
                addEventListener: (event, handler) => {
                    if (event === 'error')
                        setTimeout(() => handler(new Error('Connection failed')), 50);
                },
                removeEventListener: vi.fn(),
                readyState: WebSocket.CLOSED,
            };
        });

        await expect(wsClient.connect({ url: 'ws://invalid-url' })).rejects.toThrow(
            'WebSocket connection failed'
        );
    });

    it('should timeout if connection does not open', async () => {
        global.WebSocket.mockImplementationOnce(() => {
            return {
                send: vi.fn(),
                close: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                readyState: WebSocket.CONNECTING,
            };
        });

        await expect(wsClient.connect({ url: 'ws://timeout-url', timeout: 100 })).rejects.toThrow(
            'WebSocket connection timed out'
        );
    });

    it('should send a message when connected', async () => {
        let socketInstance;

        global.WebSocket.mockImplementationOnce(() => {
            socketInstance = {
                send: vi.fn(),
                close: vi.fn(),
                addEventListener: (event, handler) => {
                    if (event === 'open') setTimeout(handler, 50); // Simulate open event
                },
                removeEventListener: vi.fn(),
                readyState: WebSocket.OPEN,
            };
            return socketInstance;
        });

        await wsClient.connect({ url: 'ws://localhost:8080' });
        wsClient.send('Hello, Server!'); // Send a message

        expect(socketInstance.send).toHaveBeenCalledWith('Hello, Server!');
    });

    it('should not send a message if WebSocket is not open', async () => {
        expect(() => wsClient.send('Message')).toThrow('WebSocket is not open');
    });

    //   it("should close the connection properly", async () => {
    //     await wsClient.connect({ url: "ws://localhost:8080" });
    //     wsClient.close();
    //     expect(mockWebSocket.close).toHaveBeenCalled();
    //   });
});
