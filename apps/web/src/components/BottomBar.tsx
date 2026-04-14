import type { ReactNode } from 'react';

interface BottomBarProps {
  children: ReactNode;
}

export function BottomBar({ children }: BottomBarProps) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-4 py-3 mt-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {children}
    </div>
  );
}
