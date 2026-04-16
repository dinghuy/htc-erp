import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';

export const COMMON_THEME_FORBIDDEN_LITERALS = [
  '#F8FBFE',
  '#FCFDFE',
  '#F9FBFD',
  '#E8F7F0',
  '#FFF4DE',
  '#E8F5FF',
  '#7187A2',
  '#52657E',
  '#43617F',
  '#BFE8D5',
  '#0C7A57',
  '#2B6CB0',
  '#B7791F',
  '#102A43',
  '#6B7C93',
  '#d1fae5',
  '#fafafa',
  '#f8fafc',
  '#64748b',
  '#475569',
  '#16a34a',
  '#047857',
  '#991b1b',
  '#b91c1c',
  'rgba(255,152,0,0.12)',
  '#e65100',
  'rgba(15, 23, 42, 0.08)',
  'rgba(15, 23, 42, 0.06)',
  'rgba(2, 6, 23, 0.28)',
] as const;

export function expectFilesToAvoidLiterals(relativePaths: string[], forbiddenLiterals = COMMON_THEME_FORBIDDEN_LITERALS) {
  relativePaths.forEach((relativePath) => {
    const source = readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

    forbiddenLiterals.forEach((literal) => {
      expect(source, `${relativePath} should not contain ${literal}`).not.toContain(literal);
    });
  });
}
