interface ArrowProps {
  direction: 'right' | 'down';
  active: boolean;
  color?: string;
}

export function Arrow({ direction, active, color }: ArrowProps) {
  const stroke = color ?? 'var(--text-muted)';
  const className = active ? 'arrow-active' : '';

  if (direction === 'right') {
    return (
      <svg
        className={className}
        width="80"
        height="24"
        viewBox="0 0 80 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <line x1="4" y1="12" x2="68" y2="12" stroke={stroke} strokeWidth="2" />
        <path
          d="M62 6 L74 12 L62 18"
          stroke={stroke}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width="24"
      height="48"
      viewBox="0 0 24 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <line x1="12" y1="4" x2="12" y2="36" stroke={stroke} strokeWidth="2" />
      <path
        d="M6 30 L12 42 L18 30"
        stroke={stroke}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
