import { normalizeRoleCodes } from '../shared/domain/contracts';

type ReviewAction = {
  id: 'in_review' | 'changes_requested' | 'approved';
  label: string;
  nextStatus: 'in_review' | 'changes_requested' | 'approved';
  tone: 'primary' | 'secondary';
};

export function buildDocumentReviewActions(roleCodes: unknown, reviewStatus?: string | null): ReviewAction[] {
  const roles = normalizeRoleCodes(roleCodes);
  const status = String(reviewStatus || 'draft').toLowerCase();
  const canReview = roles.some((role) => ['sales', 'project_manager', 'procurement', 'accounting', 'legal', 'director', 'admin', 'manager'].includes(role));
  const canApproveFinal = roles.some((role) => ['accounting', 'legal', 'director', 'admin'].includes(role));

  if (!canReview) return [];
  if (status === 'draft') {
    return [{ id: 'in_review', label: 'Start review', nextStatus: 'in_review', tone: 'secondary' }];
  }
  if (status === 'changes_requested') {
    return [{ id: 'in_review', label: 'Mark in review', nextStatus: 'in_review', tone: 'secondary' }];
  }
  if (status === 'in_review') {
    const actions: ReviewAction[] = [
      { id: 'changes_requested', label: 'Request changes', nextStatus: 'changes_requested', tone: 'secondary' },
    ];
    if (canApproveFinal) {
      actions.push({ id: 'approved', label: 'Approve review', nextStatus: 'approved', tone: 'primary' });
    }
    return actions;
  }
  return [];
}
