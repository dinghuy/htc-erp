import {
  normalizeGender,
  type CanonicalGender,
} from '../../backend/src/shared-kernel/gender.ts';

export type {
  CanonicalGender,
};

export const GENDER_OPTIONS: Array<{ value: CanonicalGender; label: string }> = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'unknown', label: 'Chưa xác định' },
];

export {
  normalizeGender,
};

export function getGenderLabel(value: unknown): string {
  const canonical = normalizeGender(value);
  return GENDER_OPTIONS.find((option) => option.value === canonical)?.label || 'Chưa xác định';
}
