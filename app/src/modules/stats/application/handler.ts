import type { HandlerFn } from '@/shared/message';
import { RangeDaysSchema } from '../domain/types';
import type { StatsService } from './service';
import { z } from 'zod';

const RangePayloadSchema = z.object({ days: RangeDaysSchema });

export function createStatsHandlers(svc: StatsService): Record<string, HandlerFn> {
  return {
    'stats:today': () => svc.today(),
    'stats:week': () => svc.week(),
    'stats:range': (payload) => {
      const { days } = RangePayloadSchema.parse(payload);
      return svc.range(days);
    },
    'stats:streak': () => svc.streak(),
    'stats:byProject': (payload) => {
      const { days } = RangePayloadSchema.parse(payload);
      return svc.byProject(days);
    },
    'stats:summary': (payload) => {
      const { days } = RangePayloadSchema.parse(payload);
      return svc.summary(days);
    },
  };
}
