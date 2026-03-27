export type CanonicalGender = 'male' | 'female' | 'unknown';

export const GENDER_OPTIONS: Array<{ value: CanonicalGender; label: string }> = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'unknown', label: 'Chưa xác định' },
];

export function normalizeGender(value: unknown): CanonicalGender {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '');

  if (!normalized) return 'unknown';
  if (['male', 'm', 'nam', 'mr', 'man', 'boy'].includes(normalized)) return 'male';
  if (['female', 'f', 'nu', 'ms', 'mrs', 'miss', 'woman', 'girl'].includes(normalized)) return 'female';
  return 'unknown';
}

export function getGenderLabel(value: unknown): string {
  const canonical = normalizeGender(value);
  return GENDER_OPTIONS.find(option => option.value === canonical)?.label || 'Chưa xác định';
}
