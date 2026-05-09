import { create } from 'zustand';
import type { BlockedStore } from './types';

export const useBlockedStore = create<BlockedStore>((set) => ({
  snapshot: null,
  remainingMs: 0,
  today: null,
  streakDays: 0,
  error: null,
  confirmCancel: false,

  setSnapshot(s) {
    set({ snapshot: s, error: null });
  },
  setRemainingMs(ms) {
    set({ remainingMs: ms });
  },
  setToday(t) {
    set({ today: t });
  },
  setStreakDays(d) {
    set({ streakDays: d });
  },
  setError(e) {
    set({ error: e });
  },
  setConfirmCancel(v) {
    set({ confirmCancel: v });
  },
}));
