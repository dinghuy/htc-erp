import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('login reset flow source contract', () => {
  it('keeps forgot-password and reset-password flow wired in Login screen', () => {
    const source = readFileSync(path.resolve(__dirname, './Login.tsx'), 'utf8');

    expect(source).toContain("mode, setMode");
    expect(source).toContain("/auth/forgot-password");
    expect(source).toContain("/auth/reset-password");
    expect(source).toContain("login.forgot_password");
    expect(source).toContain("login.reset.request_submit");
    expect(source).toContain("login.reset.submit");
  });
});
