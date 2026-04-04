import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const tasksSource = readFileSync(
  resolve(process.cwd(), 'src/Tasks.tsx'),
  'utf8',
);

describe('tasks workflow contract', () => {
  it('delegates workflow routing to the shared task workflow helper and still navigates through shared nav context', () => {
    expect(tasksSource).toContain('const openWorkflowFromTask = (task: TaskRecord) => {');
    expect(tasksSource).toContain("const target = buildTaskWorkflowNavigation(task);");
    expect(tasksSource).toContain('setNavContext(target.navContext);');
    expect(tasksSource).toContain('onNavigate?.(target.route);');
  });

  it('falls back to the local drawer when backend does not expose workflow navigation', () => {
    expect(tasksSource).toContain('openDrawer(task);');
  });

  it('passes workflow open handlers through both kanban and list task surfaces', () => {
    expect(tasksSource).toContain('onOpenWorkflow={openWorkflowFromTask}');
    expect(tasksSource).toContain('<TaskList');
    expect(tasksSource).toContain('tasks={filteredTasks}');
    expect(tasksSource).toContain('isMobile={isMobile}');
    expect(tasksSource).toContain('onOpenTask={openDrawer}');
    expect(tasksSource).toContain('onOpenWorkflow={openWorkflowFromTask}');
  });
});
