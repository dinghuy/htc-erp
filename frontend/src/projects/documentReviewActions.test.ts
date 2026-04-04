import { describe, expect, it } from 'vitest';

import { buildDocumentReviewActions } from './documentReviewActions';

describe('documentReviewActions', () => {
  it('allows legal reviewers to move in-review documents to approve or request changes', () => {
    const actions = buildDocumentReviewActions(['legal'], 'in_review');
    expect(actions).toEqual([
      { id: 'changes_requested', label: 'Request changes', nextStatus: 'changes_requested', tone: 'secondary' },
      { id: 'approved', label: 'Approve review', nextStatus: 'approved', tone: 'primary' },
    ]);
  });

  it('allows project managers to start or restart review but not approve final review', () => {
    expect(buildDocumentReviewActions(['project_manager'], 'draft')).toEqual([
      { id: 'in_review', label: 'Start review', nextStatus: 'in_review', tone: 'secondary' },
    ]);
    expect(buildDocumentReviewActions(['project_manager'], 'changes_requested')).toEqual([
      { id: 'in_review', label: 'Mark in review', nextStatus: 'in_review', tone: 'secondary' },
    ]);
  });

  it('keeps viewers read-only', () => {
    expect(buildDocumentReviewActions(['viewer'], 'draft')).toEqual([]);
  });
});
