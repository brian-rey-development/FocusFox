interface PomoDotsProps {
  completed: number;
  estimated: number | null;
}

export function PomoDots({ completed, estimated }: PomoDotsProps) {
  if (estimated === null) {
    return <span className="pomo-dots__text">{completed}</span>;
  }

  const max = Math.max(estimated, completed);

  return (
    <span className="pomo-dots">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`pomo-dots__dot${i < completed ? ' pomo-dots__dot--filled' : ''}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
