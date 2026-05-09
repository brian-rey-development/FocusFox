import type { ReactNode } from 'react';

interface StageProps {
  children: ReactNode;
}

export function Stage({ children }: StageProps) {
  return (
    <div className="blocked-stage">
      <div className="blocked-stage__inner">
        {children}
      </div>
    </div>
  );
}
