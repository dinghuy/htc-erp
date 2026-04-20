import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('user status copy contracts', () => {
  it('keeps separate Vietnamese guidance for HR status and account status', () => {
    const formSource = readFileSync(path.resolve(__dirname, './UserFormModal.tsx'), 'utf8');
    const detailSource = readFileSync(path.resolve(__dirname, './UserDetailPanel.tsx'), 'utf8');

    expect(formSource).toContain('Trạng thái nhân sự');
    expect(formSource).toContain('Trạng thái tài khoản');
    expect(formSource).toContain('Trạng thái nhân sự phản ánh tình trạng làm việc trong HR');
    expect(formSource).toContain('Trạng thái tài khoản quyết định user có thể đăng nhập');

    expect(detailSource).toContain('Trạng thái tài khoản');
    expect(detailSource).toContain('Trạng thái nhân sự');
    expect(detailSource).toContain('Trạng thái tài khoản quyết định quyền đăng nhập');
  });
});
