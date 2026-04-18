import { describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({ API_BASE: '/api' }));
vi.mock('../ui/tokens', () => ({
  tokens: {
    colors: {
      textSecondary: '#000000',
      primary: '#000000',
      border: '#000000',
    },
    spacing: {
      sm: '8px',
    },
  },
}));
vi.mock('../ui/styles', () => ({
  ui: {
    badge: { info: {}, success: {}, error: {}, neutral: {} },
    card: { base: {} },
    btn: { primary: {}, outline: {}, ghost: {} },
    table: { thSortable: {}, thStatic: {}, td: {} },
    input: { base: {} },
    form: { label: {} },
  },
}));

import {
  buildSaveQuotationGuard,
  resetDependentSelections,
  resolveSubmissionContactId,
} from './quotationShared';

describe('saveQuotation readiness guards', () => {
  it('blocks save + maps notify message when account is missing', () => {
    const guard = buildSaveQuotationGuard({
      selectedAccId: '',
      lineItems: [{ sku: 'P-001', quantity: 1 }],
    });

    expect(guard.canSave).toBe(false);
    expect(guard.blockers).toContain('missing_account');
    expect(guard.notifyMessage).toBe('Vui lòng chọn Khách hàng');
  });

  it('blocks save + maps notify message when lineItems are empty', () => {
    const guard = buildSaveQuotationGuard({
      selectedAccId: 'acc-1',
      lineItems: [],
    });

    expect(guard.canSave).toBe(false);
    expect(guard.blockers).toContain('empty_line_items');
    expect(guard.notifyMessage).toBe('Vui lòng thêm ít nhất 1 sản phẩm');
  });

  it('allows save when account and lineItems are present', () => {
    const guard = buildSaveQuotationGuard({
      selectedAccId: 'acc-1',
      lineItems: [{ sku: 'P-001', quantity: 1 }],
    });

    expect(guard).toEqual({
      canSave: true,
      blockers: [],
      notifyMessage: null,
    });
  });
});

describe('account-change reset and stale contact submission guard', () => {
  it('switching account clears selectedContactId', () => {
    const result = resetDependentSelections({
      previousAccountId: 'acc-1',
      nextAccountId: 'acc-2',
      selectedContactId: 'contact-1',
      contacts: [
        { id: 'contact-1', accountId: 'acc-1' },
        { id: 'contact-2', accountId: 'acc-2' },
      ],
    });

    expect(result.selectedContactId).toBe('');
  });

  it('submitted payload drops stale cross-account contact after account switch', () => {
    const submittedContactId = resolveSubmissionContactId({
      selectedAccId: 'acc-2',
      selectedContactId: 'contact-1',
      contacts: [
        { id: 'contact-1', accountId: 'acc-1' },
        { id: 'contact-2', accountId: 'acc-2' },
      ],
    });

    expect(submittedContactId).toBe('');
  });

  it('submitted payload keeps valid contact belonging to selected account', () => {
    const submittedContactId = resolveSubmissionContactId({
      selectedAccId: 'acc-2',
      selectedContactId: 'contact-2',
      contacts: [
        { id: 'contact-1', accountId: 'acc-1' },
        { id: 'contact-2', accountId: 'acc-2' },
      ],
    });

    expect(submittedContactId).toBe('contact-2');
  });
});
