import { describe, expect, it } from 'vitest';

import { buildHomeTemplateViewModel, resolveHomeTemplate } from './homeViewModel';

describe('homeViewModel', () => {
  it('maps persona modes to the correct template family', () => {
    expect(resolveHomeTemplate('director')).toBe('executive');
    expect(resolveHomeTemplate('admin')).toBe('executive');
    expect(resolveHomeTemplate('accounting')).toBe('executive-lite');
    expect(resolveHomeTemplate('legal')).toBe('executive-lite');
    expect(resolveHomeTemplate('sales')).toBe('operator');
    expect(resolveHomeTemplate('project_manager')).toBe('operator');
    expect(resolveHomeTemplate('procurement')).toBe('operator');
    expect(resolveHomeTemplate('viewer')).toBe('operator');
  });

  it('prioritizes metrics before actions for executive personas', () => {
    const viewModel = buildHomeTemplateViewModel('director');
    expect(viewModel.template).toBe('executive');
    expect(viewModel.sectionOrder.slice(0, 3)).toEqual(['hero', 'metrics', 'highlights']);
  });

  it('keeps executive-lite personas on the cockpit-first order', () => {
    const viewModel = buildHomeTemplateViewModel('legal');
    expect(viewModel.template).toBe('executive-lite');
    expect(viewModel.sectionOrder.slice(0, 3)).toEqual(['hero', 'metrics', 'highlights']);
  });

  it('prioritizes actions before metrics for operator personas', () => {
    const viewModel = buildHomeTemplateViewModel('sales');
    expect(viewModel.template).toBe('operator');
    expect(viewModel.sectionOrder.slice(0, 3)).toEqual(['hero', 'actions', 'highlights']);
  });
});
