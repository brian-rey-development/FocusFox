export interface BlockedAttemptEvent {
  url: string;
  domain: string;
  at: number;
  pomodoroId: string;
}

export interface BlockDecision {
  block: boolean;
  domain: string | null;
}
