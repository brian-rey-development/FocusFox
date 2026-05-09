import type { TodayMiniStatsProps } from '../types';

export function TodayMiniStats({ today, streakDays }: TodayMiniStatsProps) {
  return (
    <div className="today-mini-stats">
      <span className="today-mini-stats__chip">
        {today.workPomodoros} pomodoros hoy
      </span>
      <span className="today-mini-stats__chip">
        {today.distractions} distracciones
      </span>
      <span className="today-mini-stats__chip">
        {streakDays}d racha
      </span>
    </div>
  );
}
