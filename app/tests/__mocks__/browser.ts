import { vi } from 'vitest';

export function mockBrowser() {
  const port = {
    name: 'test',
    postMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    onDisconnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    disconnect: vi.fn(),
  } as unknown as browser.runtime.Port;

  const mock = {
    runtime: {
      sendMessage: vi.fn(),
      connect: vi.fn(() => port),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn(),
      },
      onConnect: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn(),
      },
    },
  } as unknown as typeof browser;

  globalThis.browser = mock;

  return { mock, port };
}
