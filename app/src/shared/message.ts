import { z } from 'zod';

export type MessageHandler = (payload: unknown) => Promise<unknown>;
export type MessageRouter = Record<string, MessageHandler>;
export type HandlerFn = MessageHandler;

export function parsePayload<T>(payload: unknown, schema: z.ZodType<T>): T {
  return schema.parse(payload);
}
