import { useState, useCallback, useEffect } from 'react';
import { sendMessage } from '@/shared/messages';
import type { StatsSummary, RangeDays } from '@/modules/stats/domain/types';
import { useDashStore } from '../store';
import { RangeSelector } from '../components/RangeSelector';

export function StatsView() {
  const [range, setRange] = useState<RangeDays>(7);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(false);
  const pushToast = useDashStore((s) => s.pushToast);

  const fetchSummary = useCallback(async () => {
    setInitialLoad(true);
    setError(false);
    try {
      const data = await sendMessage<StatsSummary>('stats:summary', { days: range });
      setSummary(data);
    } catch (e) {
      console.error('[FocusFox]', e);
      setError(true);
      pushToast({ message: 'No se pudieron cargar las estadísticas', kind: 'error' });
    }
    setInitialLoad(false);
  }, [range, pushToast]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const hasData = summary && (
    summary.today.workPomodoros > 0 ||
    summary.streak.longestDays > 0 ||
    summary.range.total > 0
  );

  return (
    <div className="stats-view">
      <div className="stats-view__header">
        <RangeSelector value={range} onChange={setRange} />
      </div>
      {initialLoad ? (
        <div className="dashboard-empty"><p>Cargando estadísticas...</p></div>
      ) : error ? (
        <div className="dashboard-empty"><p>Error al cargar estadísticas</p></div>
      ) : !hasData ? (
        <div className="dashboard-empty"><p>Cuando completes tu primer pomodoro, vas a verlo acá.</p></div>
      ) : (
        <div className="stats-grid">
          <div className="stats-card">
            <span className="stats-card__value">{summary.today.workPomodoros}</span>
            <span className="stats-card__label">pomodoros hoy</span>
          </div>
          <div className="stats-card">
            <span className="stats-card__value">{summary.today.focusMinutes}</span>
            <span className="stats-card__label">minutos de foco</span>
          </div>
          <div className="stats-card">
            <span className="stats-card__value">{summary.streak.currentDays}</span>
            <span className="stats-card__label">racha actual (días)</span>
          </div>
          <div className="stats-card">
            <span className="stats-card__value">{summary.streak.longestDays}</span>
            <span className="stats-card__label">racha máxima</span>
          </div>
        </div>
      )}
    </div>
  );
}
