import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ProjectWorkspaceModalHost source contract', () => {
  it('passes sending state to the document thread modal', () => {
    const source = readFileSync(new URL('./ProjectWorkspaceModalHost.tsx', import.meta.url), 'utf8');

    expect(source).toContain("sending={busy === 'document-thread-send'}");
    expect(source).not.toContain("saving={busy === 'document-thread-send'}");
  });
});
