import { describe, expect, it } from 'vitest';

import { buildRolePreviewNotice } from './rolePreviewNotice';

describe('role preview notice', () => {
  it('explains approval lane filters without implying extra permission', () => {
    expect(buildRolePreviewNotice({
      screen: 'approvals',
      previewLabel: 'Accounting',
      approvalLane: 'finance',
    })).toMatchObject({
      tone: 'warning',
      title: 'Preview approvals lane: finance',
    });
  });

  it('explains inbox and my work preview contexts', () => {
    expect(buildRolePreviewNotice({
      screen: 'inbox',
      previewLabel: 'Procurement',
      departmentFilter: 'procurement',
    })).toMatchObject({
      tone: 'warning',
    });

    expect(buildRolePreviewNotice({
      screen: 'my_work',
      previewLabel: 'Sales + Project Manager',
      workFocus: 'combined',
    })).toMatchObject({
      tone: 'warning',
    });

    expect(buildRolePreviewNotice({
      screen: 'my_work',
      previewLabel: 'Director',
    })).toMatchObject({
      tone: 'info',
    });
  });
});
