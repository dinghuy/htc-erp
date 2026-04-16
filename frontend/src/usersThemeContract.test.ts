import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('users screen theme contracts', () => {
  it('does not keep light-only color literals in the user management surface', () => {
    const source = readFileSync(path.resolve(__dirname, './Users.tsx'), 'utf8');
    const forbiddenLiterals = [
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
      'rgba(255,152,0,0.12)',
      '#e65100',
    ];

    forbiddenLiterals.forEach((literal) => {
      expect(source).not.toContain(literal);
    });
  });
});
