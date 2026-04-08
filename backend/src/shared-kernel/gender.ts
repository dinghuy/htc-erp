export type CanonicalGender = 'male' | 'female' | 'unknown';

const FEMALE_VALUES = new Set([
  'female',
  'f',
  'nu',
  'nữ',
  'ms',
  'mrs',
  'miss',
  'woman',
  'girl',
  'female.',
]);

const MALE_VALUES = new Set([
  'male',
  'm',
  'nam',
  'mr',
  'man',
  'boy',
  'male.',
]);

export function normalizeGenderKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '');
}

export function normalizeGender(value: unknown): CanonicalGender {
  const normalized = normalizeGenderKey(value);
  if (!normalized) return 'unknown';
  if (MALE_VALUES.has(normalized)) return 'male';
  if (FEMALE_VALUES.has(normalized)) return 'female';
  return 'unknown';
}

export function isCanonicalGender(value: unknown): value is CanonicalGender {
  return value === 'male' || value === 'female' || value === 'unknown';
}
