export interface MessageEnvelope {
  type: string;
  payload?: unknown;
}

export interface BroadcastEvent {
  type: string;
  data?: unknown;
}

export async function sendMessage<T = unknown>(type: string, payload?: unknown): Promise<T> {
  return browser.runtime.sendMessage({ type, payload }) as Promise<T>;
}

export function connectPort(name?: string): browser.runtime.Port {
  return browser.runtime.connect({ name });
}
