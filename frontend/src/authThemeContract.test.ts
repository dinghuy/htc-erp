import { describe, it } from 'vitest';
import { expectFilesToAvoidLiterals } from './qa/themeAuditContracts';

describe('auth and auxiliary theme contracts', () => {
  it('keeps auth and supporting product surfaces on semantic tokens instead of theme drift literals', () => {
    expectFilesToAvoidLiterals([
      'features/settings/SettingsScreen.tsx',
      'Login.tsx',
      'ForceChangePassword.tsx',
      'products/ProductFormModal.tsx',
      'products/productAssetUi.tsx',
      'products/productAssetEditor.tsx',
    ]);
  });
});
