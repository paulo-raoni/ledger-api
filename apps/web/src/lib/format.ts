/**
 * USD currency formatter for cents-denominated amounts (D07 + D08).
 *
 * Amounts are stored/transmitted as integer cents (D07). All display code
 * must divide by 100 and format via Intl.NumberFormat with currency: USD (D08).
 */
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatAmount(cents: number): string {
  const n = Number(cents);
  if (!Number.isFinite(n)) return String(cents);
  return USD.format(n / 100);
}

/**
 * Format a duration in milliseconds with at most one decimal place.
 * Used by the Terminal log lines and the Graph block latency chips so
 * both views render "42.3ms" / "42ms" with identical precision.
 */
export function formatDuration(ms: number): string {
  return `${Math.round(ms * 10) / 10}ms`;
}
