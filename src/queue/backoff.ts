export function backoffMs(attempt: number): number {
  const base = 750;
  const cap = 30_000;
  const jitter = Math.floor(Math.random() * 250);
  const ms = Math.min(cap, base * Math.pow(2, Math.max(0, attempt - 1)));
  return ms + jitter;
}
