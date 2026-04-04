import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const homeSource = readFileSync(
  resolve(process.cwd(), 'src/Home.tsx'),
  'utf8',
);

const myWorkSource = readFileSync(
  resolve(process.cwd(), 'src/MyWork.tsx'),
  'utf8',
);

const workspaceSource = readFileSync(
  resolve(process.cwd(), 'src/projects/ProjectWorkspaceHub.tsx'),
  'utf8',
);

describe('handoff workflow contract', () => {
  it('Home prioritizes backend handoffActivation before local workflow guesses', () => {
    expect(homeSource).toContain('const handoffActivation = item.handoffActivation;');
    expect(homeSource).toContain("if (handoffActivation?.nextActionLabel || handoffActivation?.status) {");
    expect(homeSource).toContain("item.handoffActivation?.status === 'awaiting_release_approval'");
  });

  it('My Work renders a dedicated handoff section from backend-enriched project rows', () => {
    expect(myWorkSource).toContain('title="Handoff trạng thái"');
    expect(myWorkSource).toContain('Phần này chỉ dùng backend handoff state.');
    expect(myWorkSource).toContain("project.handoffActivation?.nextActionLabel || 'Mở workspace'");
  });

  it('Project workspace shows a handoff activation panel separate from gate controls', () => {
    expect(workspaceSource).toContain('function HandoffActivationPanel({ handoffActivation }: { handoffActivation?: any }) {');
    expect(workspaceSource).toContain('<HandoffActivationPanel handoffActivation={workspace.handoffActivation} />');
    expect(workspaceSource).toContain('Trạng thái handoff');
  });
});
