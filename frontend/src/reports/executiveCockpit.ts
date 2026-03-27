import { resolveApprovalLane } from '../shared/domain/contracts';

type ExecutiveHighlight = {
  projectId: string;
  projectCode?: string | null;
  projectName?: string | null;
  projectStage?: string | null;
  projectStatus?: string | null;
  accountName?: string | null;
  openTaskCount?: number | null;
  pendingApprovalCount?: number | null;
  missingDocumentCount?: number | null;
};

type ExecutiveApproval = {
  id: string;
  title: string;
  requestType: string;
  status: string;
  note?: string | null;
  dueDate?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  requestedByName?: string | null;
  department?: string | null;
  approverRole?: string | null;
  approverUserId?: string | null;
};

type ExecutiveCockpitInput = {
  highlights?: ExecutiveHighlight[];
  approvals?: ExecutiveApproval[];
};

export function buildExecutiveCockpitSummary(input: ExecutiveCockpitInput) {
  const approvals = Array.isArray(input.approvals) ? input.approvals : [];
  const highlights = Array.isArray(input.highlights) ? input.highlights : [];
  const pendingApprovals = approvals.filter((approval) => String(approval.status || '').toLowerCase() === 'pending');
  const executiveApprovals = pendingApprovals.filter((approval) => resolveApprovalLane(approval) === 'executive');
  const topRiskProjects = highlights
    .map((project) => {
      const pendingApprovalCount = Number(project.pendingApprovalCount || 0);
      const missingDocumentCount = Number(project.missingDocumentCount || 0);
      const openTaskCount = Number(project.openTaskCount || 0);

      return {
        ...project,
        riskScore: pendingApprovalCount * 3 + missingDocumentCount * 2 + openTaskCount,
      };
    })
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 5);

  const bottlenecksByDepartment = Object.entries(
    pendingApprovals.reduce<Record<string, number>>((acc, approval) => {
      const department = String(approval.department || '').trim() || 'Unknown';
      acc[department] = (acc[department] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([department, count]) => ({ department, count }))
    .sort((left, right) => right.count - left.count);

  return {
    executiveApprovals,
    pendingExecutiveApprovals: executiveApprovals.length,
    topRiskProjects,
    bottlenecksByDepartment,
    totalOpenTasks: highlights.reduce((sum, project) => sum + Number(project.openTaskCount || 0), 0),
    totalMissingDocuments: highlights.reduce((sum, project) => sum + Number(project.missingDocumentCount || 0), 0),
  };
}
