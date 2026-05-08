export type MessageHandler = (payload: unknown) => Promise<unknown>;
export type MessageRouter = Record<string, MessageHandler>;
