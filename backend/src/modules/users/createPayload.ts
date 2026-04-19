export function normalizeCreateMustChangePassword(value: unknown): number {
  return value === false || value === 0 ? 0 : 1;
}
