export function parseLimitParam(raw: unknown, fallback = 50, max = 200) {
  const parsed = typeof raw === 'string' ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}
