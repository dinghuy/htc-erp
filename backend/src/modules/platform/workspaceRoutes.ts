import type { Express, Request, Response } from 'express';
import { getDb } from '../../../sqlite-db';
import type { AuthenticatedRequest } from '../../shared/auth/httpAuth';
import { canUserApproveRequest, hasGlobalWorkspaceAccess, resolveApprovalLane as resolveApprovalLaneForUser } from '../../shared/auth/permissions';
import { normalizeRoleCodes, resolvePrimaryRole } from '../../shared/auth/roles';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterPlatformWorkspaceRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  getProjectWorkspaceById: (db: any, projectId: string, currentUser?: any) => Promise<any>;
};

function getPersonaMode(roleCodes: string[]) {
  if (roleCodes.includes('admin')) return 'admin';
  if (roleCodes.includes('procurement')) return 'procurement';
  if (roleCodes.includes('accounting')) return 'accounting';
  if (roleCodes.includes('legal')) return 'legal';
  if (roleCodes.includes('director')) return 'director';
  if (roleCodes.includes('project_manager')) return 'project_manager';
  if (roleCodes.includes('sales')) return 'sales';
  return 'viewer';
}

function buildPriorityItems(mode: string, summary: any) {
  if (mode === 'procurement') {
    return [
      { metricKey: 'po_needed', label: 'PO cần tạo', value: Number(summary.procurementPending ?? 0), tone: 'warn' },
      { metricKey: 'eta_overdue', label: 'ETA trễ', value: Number(summary.overdueEta ?? 0), tone: 'bad' },
      { metricKey: 'shortages', label: 'Line thiếu hàng', value: Number(summary.shortages ?? 0), tone: 'bad' },
    ];
  }

  if (mode === 'accounting') {
    return [
      { metricKey: 'payment_due', label: 'Thanh toán đến hạn', value: Number(summary.paymentDue ?? 0), tone: 'warn' },
      { metricKey: 'erp_failed', label: 'ERP lỗi', value: Number(summary.erpFailed ?? 0), tone: 'bad' },
      { metricKey: 'receivable_risk', label: 'Rủi ro công nợ', value: Number(summary.receivableRisk ?? 0), tone: 'bad' },
    ];
  }

  if (mode === 'legal') {
    return [
      { metricKey: 'contract_review', label: 'Hợp đồng chờ review', value: Number(summary.legalPending ?? 0), tone: 'warn' },
      { metricKey: 'missing_docs', label: 'Hồ sơ thiếu', value: Number(summary.missingDocuments ?? 0), tone: 'bad' },
    ];
  }

  if (mode === 'director') {
    return [
      { metricKey: 'profit_risk', label: 'Profit + risk', value: Number(summary.executiveRiskProjects ?? 0), tone: 'bad' },
      { metricKey: 'pending_approvals', label: 'Quyết định chờ duyệt', value: Number(summary.pendingApprovals ?? 0), tone: 'warn' },
    ];
  }

  if (mode === 'admin') {
    return [
      { metricKey: 'active_projects', label: 'Workspace đang mở', value: Number(summary.activeProjects ?? 0), tone: 'good' },
      { metricKey: 'blockers', label: 'Blockers hệ thống', value: Number(summary.blockers ?? 0), tone: 'bad' },
      { metricKey: 'pending_approvals', label: 'Approvals đang chờ', value: Number(summary.pendingApprovals ?? 0), tone: 'warn' },
      { metricKey: 'missing_documents', label: 'Hồ sơ thiếu', value: Number(summary.missingDocuments ?? 0), tone: 'warn' },
    ];
  }

  return [
    { metricKey: 'active_projects', label: 'Dự án đang hoạt động', value: Number(summary.activeProjects ?? 0), tone: 'good' },
    { metricKey: 'pending_approvals', label: 'Approvals chờ', value: Number(summary.pendingApprovals ?? 0), tone: 'warn' },
  ];
}

function buildMyWorkView(mode: string, input: { tasks?: any[]; approvals?: any[]; projects?: any[] }) {
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const approvals = Array.isArray(input.approvals) ? input.approvals : [];
  const projects = Array.isArray(input.projects) ? input.projects : [];
  const summary = {
    taskCount: tasks.length,
    approvalCount: approvals.length,
    projectCount: projects.length,
    blockedTaskCount: tasks.filter((task) => String(task.blockedReason || '').trim()).length,
    overdueTaskCount: tasks.filter((task) => {
      const dueDate = String(task.dueDate || '');
      return dueDate && dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10) && String(task.status || '').toLowerCase() !== 'completed';
    }).length,
    pendingApprovalCount: approvals.filter((approval) => String(approval.status || '').toLowerCase() === 'pending').length,
  };

  const byMode: Record<string, any> = {
    sales: {
      title: 'My Work',
      description: 'Queue commercial theo assignment thực tế: follow-up, quotation và các yêu cầu bổ sung để đẩy deal.',
      taskTitle: 'Sales Queue',
      taskDescription: 'Các follow-up và handoff task đang gắn trực tiếp cho bạn.',
      approvalTitle: 'Commercial Queue',
      approvalDescription: 'Các approval thương mại bạn đang theo dõi hoặc đã khởi tạo.',
      cards: [
        { label: 'Deals cần chốt', value: summary.taskCount, tone: 'info' },
        { label: 'Commercial approvals', value: summary.approvalCount, tone: 'warn' },
        { label: 'Projects theo dõi', value: summary.projectCount, tone: 'good' },
      ],
    },
    project_manager: {
      title: 'My Work',
      description: 'Queue hợp nhất để PM vừa đẩy commercial handoff vừa điều phối execution trên cùng project.',
      taskTitle: 'Commercial + Execution Queue',
      taskDescription: 'Các đầu việc từ quotation, handoff tới delivery đang gắn trực tiếp cho bạn.',
      approvalTitle: 'Cross-functional Approvals',
      approvalDescription: 'Các approval ảnh hưởng trực tiếp tới margin, handoff và tiến độ delivery.',
      cards: [
        { label: 'Deals cần chốt', value: summary.taskCount, tone: 'info' },
        { label: 'Handoff / approvals', value: summary.approvalCount, tone: 'warn' },
        { label: 'Projects cần đẩy', value: summary.projectCount, tone: 'good' },
      ],
    },
    procurement: {
      title: 'My Work',
      description: 'Queue exception-driven cho vendor, PO, ETA và delivery risk.',
      taskTitle: 'Procurement Queue',
      taskDescription: 'Các đầu việc mua hàng, follow-up vendor và shortage handling đang gắn cho bạn.',
      approvalTitle: 'PO / Supplier Queue',
      approvalDescription: 'Các approval liên quan supplier selection, PO hoặc escalation supply risk.',
      cards: [
        { label: 'Procurement tasks', value: summary.taskCount, tone: 'info' },
        { label: 'PO / vendor approvals', value: summary.approvalCount, tone: 'warn' },
        { label: 'Delivery risk projects', value: summary.projectCount, tone: 'good' },
      ],
    },
    accounting: {
      title: 'My Work',
      description: 'Queue tài chính để xử lý invoice, payment milestone, công nợ và lỗi ERP.',
      taskTitle: 'Finance Queue',
      taskDescription: 'Các đầu việc tài chính đang gắn trực tiếp cho bạn.',
      approvalTitle: 'Finance Approval Queue',
      approvalDescription: 'Những quyết định tài chính đang chờ review hoặc đã được bạn khởi tạo.',
      cards: [
        { label: 'Finance tasks', value: summary.taskCount, tone: 'info' },
        { label: 'Finance approvals', value: summary.approvalCount, tone: 'warn' },
        { label: 'Projects payment-related', value: summary.projectCount, tone: 'good' },
      ],
    },
    legal: {
      title: 'My Work',
      description: 'Queue pháp lý để review hợp đồng, deviation và hồ sơ thiếu.',
      taskTitle: 'Legal Review Queue',
      taskDescription: 'Các đầu việc contract review và legal follow-up đang gắn cho bạn.',
      approvalTitle: 'Legal Approval Queue',
      approvalDescription: 'Các approval pháp lý đang chờ quyết định hoặc cần trả lại với comment.',
      cards: [
        { label: 'Contract reviews', value: summary.taskCount, tone: 'info' },
        { label: 'Legal approvals', value: summary.approvalCount, tone: 'warn' },
        { label: 'Projects thiếu hồ sơ', value: summary.projectCount, tone: 'good' },
      ],
    },
    director: {
      title: 'My Work',
      description: 'Queue điều hành tập trung vào escalations, risk projects và approvals vượt ngưỡng.',
      taskTitle: 'Escalation Queue',
      taskDescription: 'Các item cần can thiệp ở cấp điều hành.',
      approvalTitle: 'Executive Queue',
      approvalDescription: 'Các approval cần quyết định ở vai trò điều hành.',
      cards: [
        { label: 'Escalations theo dõi', value: summary.taskCount, tone: 'info' },
        { label: 'Executive approvals', value: summary.approvalCount, tone: 'warn' },
        { label: 'Projects at risk', value: summary.projectCount, tone: 'good' },
      ],
    },
    admin: {
      title: 'My Work',
      description: 'Queue system-only để support workflow, phân quyền và các project đang cần can thiệp vận hành.',
      taskTitle: 'Support Queue',
      taskDescription: 'Các đầu việc support hoặc vận hành hệ thống đang gắn cho bạn.',
      approvalTitle: 'Approval Watchlist',
      approvalDescription: 'Theo dõi approval queue toàn cục, nhưng không mặc định là approver business.',
      cards: [
        { label: 'System tasks', value: summary.taskCount, tone: 'info' },
        { label: 'Approval watchlist', value: summary.approvalCount, tone: 'warn' },
        { label: 'Projects cần support', value: summary.projectCount, tone: 'good' },
      ],
    },
    viewer: {
      title: 'My Work',
      description: 'Queue theo dõi read-only cho các project, task và approval liên quan.',
      taskTitle: 'Task Queue',
      taskDescription: 'Các đầu việc đang gắn trực tiếp cho bạn.',
      approvalTitle: 'Approval Queue',
      approvalDescription: 'Yêu cầu duyệt bạn đang xử lý hoặc đã khởi tạo.',
      cards: [
        { label: 'Items đang theo', value: summary.taskCount, tone: 'info' },
        { label: 'Approvals liên quan', value: summary.approvalCount, tone: 'warn' },
        { label: 'Projects active', value: summary.projectCount, tone: 'good' },
      ],
    },
  };

  const view = byMode[mode] || byMode.viewer;
  return { summary, view, cards: view.cards };
}

function buildInboxView(mode: string, items: any[]) {
  const summary = {
    totalCount: items.length,
    documentCount: items.filter((item) => item.source === 'documents').length,
    blockedTaskCount: items.filter((item) => item.source === 'blocked_tasks').length,
    notificationCount: items.filter((item) => item.source === 'notifications').length,
  };

  const byMode: Record<string, any> = {
    sales: {
      title: 'Sales Inbox',
      description: 'Tập trung hồ sơ thiếu, blocked task và notifications ảnh hưởng tới commercial follow-up hoặc handoff.',
    },
    project_manager: {
      title: 'Project Inbox',
      description: 'Một inbox xuyên commercial tới delivery để gom hồ sơ thiếu, blockers và notifications quan trọng.',
    },
    procurement: {
      title: 'Procurement Inbox',
      description: 'Tập trung shortage, chứng từ thiếu và các exception từ vendor hoặc delivery.',
    },
    accounting: {
      title: 'Finance Inbox',
      description: 'Tập trung chứng từ tài chính thiếu, milestone cần follow-up và các cảnh báo ERP liên quan.',
    },
    legal: {
      title: 'Legal Inbox',
      description: 'Tập trung contract package thiếu, deviation notes và các hồ sơ pháp lý cần hoàn tất.',
    },
    director: {
      title: 'Executive Inbox',
      description: 'Tập trung escalations, risk signals và các item cần nhìn ở cấp điều hành.',
    },
    admin: {
      title: 'Admin Inbox',
      description: 'Tập trung support issues, workflow exceptions và các item cần can thiệp vận hành hệ thống.',
    },
    viewer: {
      title: 'Inbox',
      description: 'Tập trung hồ sơ thiếu, blocked task và notification liên quan tới workflow của bạn.',
    },
  };

  const cards = [
    { label: 'Missing documents', value: summary.documentCount, tone: 'bad' },
    { label: 'Blocked tasks', value: summary.blockedTaskCount, tone: 'warn' },
    { label: 'Notifications', value: summary.notificationCount, tone: 'info' },
  ];

  return {
    summary,
    view: byMode[mode] || byMode.viewer,
    cards,
  };
}

function buildApprovalsView(mode: string, approvals: any[]) {
  const pendingApprovals = approvals.filter((approval) => String(approval.status || '').toLowerCase() === 'pending');
  const summary = {
    totalCount: approvals.length,
    pendingCount: pendingApprovals.length,
    executiveCount: approvals.filter((approval) => resolveApprovalLane(approval) === 'executive').length,
    financeCount: approvals.filter((approval) => resolveApprovalLane(approval) === 'finance').length,
    legalCount: approvals.filter((approval) => resolveApprovalLane(approval) === 'legal').length,
    procurementCount: approvals.filter((approval) => resolveApprovalLane(approval) === 'procurement').length,
  };

  const byMode: Record<string, any> = {
    sales: {
      title: 'Commercial Approvals',
      description: 'Theo dõi yêu cầu commercial và handoff đang chờ phản hồi từ các phòng ban liên quan.',
    },
    project_manager: {
      title: 'Execution Approvals',
      description: 'Một queue duy nhất để theo dõi commercial handoff, project blockers và các phê duyệt ảnh hưởng tới margin hoặc tiến độ.',
    },
    procurement: {
      title: 'Procurement Approvals',
      description: 'Ưu tiên supplier selection, PO approvals và các exception làm trễ ETA hoặc delivery.',
    },
    accounting: {
      title: 'Finance Approvals',
      description: 'Xử lý payment milestone, invoice/deposit release và các approval tài chính đang chờ quyết định.',
    },
    legal: {
      title: 'Legal Approvals',
      description: 'Tập trung contract review, deviation và các hồ sơ pháp lý cần approve hoặc trả lại với comment.',
    },
    director: {
      title: 'Executive Approvals',
      description: 'Cockpit quyết định cho margin exception, dự án at-risk và các request vượt ngưỡng phê duyệt điều hành.',
    },
    admin: {
      title: 'Approval Oversight',
      description: 'Admin theo dõi toàn cục và hỗ trợ workflow, nhưng không mặc định là approver nghiệp vụ nếu chưa có role business tương ứng.',
    },
    viewer: {
      title: 'Approval Watchlist',
      description: 'Theo dõi approvals liên quan trong chế độ read-only.',
    },
  };

  return {
    summary,
    view: byMode[mode] || byMode.viewer,
    cards: [
      { label: 'Pending approvals', value: summary.pendingCount, tone: 'warn' },
      { label: 'Finance + Legal', value: summary.financeCount + summary.legalCount, tone: 'info' },
      { label: 'Executive lane', value: summary.executiveCount, tone: 'bad' },
    ],
  };
}

function resolveApprovalLane(approval: any) {
  const requestType = String(approval?.requestType || '').trim().toLowerCase();
  const department = String(approval?.department || '').trim().toLowerCase();
  const approverRole = String(approval?.approverRole || '').trim().toLowerCase();

  if (approverRole === 'procurement' || requestType.includes('po') || requestType.includes('procurement') || department === 'procurement') {
    return 'procurement';
  }

  if (approverRole === 'legal' || requestType.includes('contract') || requestType.includes('legal') || department === 'legal') {
    return 'legal';
  }

  if (
    approverRole === 'director'
    || requestType.includes('margin')
    || requestType.includes('executive')
    || department === 'bod'
    || department === 'executive'
  ) {
    return 'executive';
  }

  if (approverRole === 'accounting' || requestType.includes('payment') || requestType.includes('finance') || department === 'finance') {
    return 'finance';
  }

  return 'commercial';
}

function decorateApprovalForCurrentUser(approval: any, currentUser?: any) {
  const canDecide = canUserApproveRequest(currentUser, approval);
  return {
    ...approval,
    actionAvailability: {
      lane: resolveApprovalLaneForUser(approval),
      canDecide,
      isRequester: Boolean(currentUser?.id) && String(approval?.requestedBy || '') === currentUser?.id,
      isAssignedApprover: !approval?.approverUserId || String(approval.approverUserId) === currentUser?.id,
      availableDecisions: canDecide ? ['approved', 'rejected', 'changes_requested'] : [],
    },
  };
}

function resolveWorkspaceTabForTask(task: any) {
  const taskType = String(task?.taskType || '').trim().toLowerCase();
  const stage = String(task?.projectStage || '').trim().toLowerCase();
  if (taskType.includes('handoff') || taskType.includes('quotation') || taskType.includes('commercial')) return 'commercial';
  if (taskType.includes('procurement') || taskType.includes('supplier') || ['order_released', 'procurement_active'].includes(stage)) return 'procurement';
  if (taskType.includes('delivery') || taskType.includes('inbound') || ['delivery_active', 'delivery', 'delivery_completed', 'closed'].includes(stage)) return 'delivery';
  if (taskType.includes('document') || taskType.includes('contract')) return 'documents';
  return 'timeline';
}

function decorateTaskForCurrentUser(task: any) {
  const workspaceTab = resolveWorkspaceTabForTask(task);
  const blockers = String(task?.blockedReason || '').trim() ? [String(task.blockedReason).trim()] : [];
  return {
    ...task,
    actionAvailability: {
      workspaceTab,
      canOpenTask: true,
      canOpenProject: Boolean(task?.projectId),
      canOpenQuotation: Boolean(task?.quotationId),
      primaryActionLabel: blockers.length > 0 ? 'Gỡ blocker' : 'Mở workspace',
      blockers,
    },
  };
}

function resolveWorkspaceTabForInboxItem(item: any) {
  const source = String(item?.source || '').trim().toLowerCase();
  const department = String(item?.department || '').trim().toLowerCase();
  const entityType = String(item?.entityType || '').trim().toLowerCase();
  if (source === 'documents' || entityType === 'projectdocument') return 'documents';
  if (source === 'blocked_tasks' || entityType === 'task') return 'timeline';
  if (department.includes('legal')) return 'legal';
  if (department.includes('finance') || department.includes('account')) return 'finance';
  if (department.includes('procurement') || department.includes('purchase')) return 'procurement';
  return 'overview';
}

function decorateInboxItem(item: any) {
  const workspaceTab = resolveWorkspaceTabForInboxItem(item);
  const blockers: string[] = [];
  if (String(item?.status || '').trim().toLowerCase() === 'missing') {
    blockers.push('Thiếu hồ sơ hoặc điều kiện đầu vào');
  }
  if (String(item?.description || '').trim()) {
    blockers.push(String(item.description).trim());
  }
  return {
    ...item,
    actionAvailability: {
      workspaceTab,
      canOpenProject: Boolean(item?.projectId),
      canOpenEntity: Boolean(item?.entityId),
      primaryActionLabel: sourceLabelForInboxItem(item),
      blockers,
    },
  };
}

function sourceLabelForInboxItem(item: any) {
  const source = String(item?.source || '').trim().toLowerCase();
  if (source === 'documents') return 'Mở documents';
  if (source === 'blocked_tasks') return 'Mở timeline';
  return 'Mở workspace';
}

function buildExecutiveCockpitSummary(input: { highlights?: any[]; approvals?: any[] }) {
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

async function queryHighlightsForUser(userId: string, globalAccess = false) {
  const db = getDb();
  const sharedSelect = `
    SELECT
      p.id AS projectId,
      p.code AS projectCode,
      p.name AS projectName,
      p.projectStage,
      p.status AS projectStatus,
      a.companyName AS accountName,
      (
        SELECT COUNT(*) FROM Task t
        WHERE t.projectId = p.id AND t.status != 'completed'
      ) AS openTaskCount,
      (
        SELECT COUNT(*) FROM ApprovalRequest ar
        WHERE ar.projectId = p.id AND ar.status = 'pending'
      ) AS pendingApprovalCount,
      (
        SELECT COUNT(*) FROM ProjectDocument pd
        WHERE pd.projectId = p.id AND pd.status IN ('missing', 'requested')
      ) AS missingDocumentCount
    FROM Project p
    LEFT JOIN Account a ON a.id = p.accountId
  `;

  if (globalAccess) {
    return db.all(
      `
        ${sharedSelect}
        ORDER BY COALESCE(p.updatedAt, p.createdAt) DESC
        LIMIT 8
      `,
    );
  }

  return db.all(
    `
      ${sharedSelect}
      WHERE p.managerId = ?
         OR EXISTS (
           SELECT 1 FROM Task t
           WHERE t.projectId = p.id AND t.assigneeId = ?
         )
         OR EXISTS (
           SELECT 1 FROM ApprovalRequest ar
           WHERE ar.projectId = p.id AND (ar.requestedBy = ? OR ar.approverUserId = ?)
         )
      ORDER BY COALESCE(p.updatedAt, p.createdAt) DESC
      LIMIT 8
    `,
    [userId, userId, userId, userId],
  );
}

async function queryApprovalsForUser(userId: string, globalAccess = false) {
  const db = getDb();
  return db.all(
    `
      SELECT
        ar.*,
        p.name AS projectName,
        p.code AS projectCode,
        q.quoteNumber AS quotationNumber,
        approver.fullName AS approverName,
        requester.fullName AS requestedByName
      FROM ApprovalRequest ar
      LEFT JOIN Project p ON p.id = ar.projectId
      LEFT JOIN Quotation q ON q.id = ar.quotationId
      LEFT JOIN User approver ON approver.id = ar.approverUserId
      LEFT JOIN User requester ON requester.id = ar.requestedBy
      ${globalAccess ? '' : 'WHERE ar.approverUserId = ? OR ar.requestedBy = ?'}
      ORDER BY CASE WHEN ar.status = 'pending' THEN 0 ELSE 1 END, ar.dueDate ASC, ar.createdAt DESC
      LIMIT 50
    `,
    globalAccess ? [] : [userId, userId],
  );
}

export function registerPlatformWorkspaceRoutes(app: Express, deps: RegisterPlatformWorkspaceRoutesDeps) {
  const { ah, requireAuth, getProjectWorkspaceById } = deps;

  async function enrichProjectHighlights(highlights: any[], currentUser?: any) {
    const db = getDb();
    return Promise.all((Array.isArray(highlights) ? highlights : []).map(async (highlight) => {
      const projectId = String(highlight?.projectId || '').trim();
      if (!projectId) return highlight;
      const workspace = await getProjectWorkspaceById(db, projectId, currentUser).catch(() => null);
      return {
        ...highlight,
        approvalGateStates: Array.isArray(workspace?.approvalGateStates) ? workspace.approvalGateStates : [],
        actionAvailability: workspace?.actionAvailability || null,
        pendingApproverState: Array.isArray(workspace?.pendingApproverState) ? workspace.pendingApproverState : [],
      };
    }));
  }

  app.get('/api/workspace/home', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const authUser = req.user;
    const roleCodes = normalizeRoleCodes(authUser?.roleCodes, authUser?.systemRole);
    const primaryRole = resolvePrimaryRole(roleCodes, authUser?.systemRole);
    const personaMode = getPersonaMode(roleCodes);
    const globalAccess = hasGlobalWorkspaceAccess(roleCodes, authUser?.systemRole, authUser?.baseRoleCodes, authUser?.baseSystemRole);
    const userId = authUser?.id || '';

    const [summary, rawHighlights] = await Promise.all([
      db.get(
        `
          SELECT
            SUM(CASE WHEN t.taskType = 'handoff' AND t.status != 'completed' THEN 1 ELSE 0 END) AS handoffPending,
            SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) AS activeProjects,
            SUM(CASE WHEN t.blockedReason IS NOT NULL AND trim(t.blockedReason) != '' AND t.status != 'completed' THEN 1 ELSE 0 END) AS blockers,
            SUM(CASE WHEN ar.status = 'pending' THEN 1 ELSE 0 END) AS pendingApprovals,
            SUM(CASE WHEN pd.status IN ('missing', 'requested') THEN 1 ELSE 0 END) AS missingDocuments,
            SUM(CASE WHEN ppl.shortageQty > 0 THEN 1 ELSE 0 END) AS shortages,
            SUM(CASE WHEN ppl.etaDate IS NOT NULL AND date(ppl.etaDate) < date('now') AND COALESCE(ppl.receivedQty, 0) < MAX(COALESCE(ppl.orderedQty, 0), COALESCE(ppl.contractQty, 0)) THEN 1 ELSE 0 END) AS overdueEta,
            SUM(CASE WHEN ppl.orderedQty < ppl.contractQty THEN 1 ELSE 0 END) AS procurementPending,
            SUM(CASE WHEN so.status = 'processing' THEN 1 ELSE 0 END) AS paymentDue,
            SUM(CASE WHEN eo.status = 'failed' THEN 1 ELSE 0 END) AS erpFailed,
            SUM(CASE WHEN ar.department = 'Finance' AND ar.status = 'pending' THEN 1 ELSE 0 END) AS receivableRisk,
            SUM(CASE WHEN ar.department = 'Legal' AND ar.status = 'pending' THEN 1 ELSE 0 END) AS legalPending,
            SUM(CASE WHEN p.projectStage IN ('won', 'order_released', 'procurement_active', 'delivery_active', 'delivery', 'delivery_completed') AND ((SELECT COUNT(*) FROM ApprovalRequest ap WHERE ap.projectId = p.id AND ap.status = 'pending') > 0 OR (SELECT COUNT(*) FROM ProjectDocument doc WHERE doc.projectId = p.id AND doc.status IN ('missing', 'requested')) > 0) THEN 1 ELSE 0 END) AS executiveRiskProjects
          FROM Project p
          LEFT JOIN Task t ON t.projectId = p.id
          LEFT JOIN ApprovalRequest ar ON ar.projectId = p.id
          LEFT JOIN ProjectDocument pd ON pd.projectId = p.id
          LEFT JOIN ProjectProcurementLine ppl ON ppl.projectId = p.id AND COALESCE(ppl.isActive, 1) = 1
          LEFT JOIN SalesOrder so ON so.projectId = p.id
          LEFT JOIN ErpOutbox eo ON eo.entityId = p.id
          ${globalAccess ? '' : `WHERE p.managerId = ?
             OR EXISTS (SELECT 1 FROM Task ownTask WHERE ownTask.projectId = p.id AND ownTask.assigneeId = ?)
             OR EXISTS (SELECT 1 FROM ApprovalRequest ownApproval WHERE ownApproval.projectId = p.id AND (ownApproval.requestedBy = ? OR ownApproval.approverUserId = ?))`}
        `,
        globalAccess ? [] : [userId, userId, userId, userId],
      ).catch(() => ({
        handoffPending: 0,
        activeProjects: 0,
        blockers: 0,
        pendingApprovals: 0,
        missingDocuments: 0,
        shortages: 0,
        overdueEta: 0,
        procurementPending: 0,
        paymentDue: 0,
        erpFailed: 0,
        receivableRisk: 0,
        legalPending: 0,
        executiveRiskProjects: 0,
      })),
      queryHighlightsForUser(userId, globalAccess),
    ]);
    const highlights = await enrichProjectHighlights(rawHighlights, authUser);

    res.json({
      persona: {
        primaryRole,
        roleCodes,
        mode: personaMode,
      },
      priorities: buildPriorityItems(personaMode, summary || {}),
      highlights,
    });
  }));

  app.get('/api/workspace/my-work', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const authUser = req.user;
    const roleCodes = normalizeRoleCodes(authUser?.roleCodes, authUser?.systemRole);
    const primaryRole = resolvePrimaryRole(roleCodes, authUser?.systemRole);
    const personaMode = getPersonaMode(roleCodes);
    const userId = authUser?.id || '';
    const globalAccess = hasGlobalWorkspaceAccess(authUser?.roleCodes, authUser?.systemRole, authUser?.baseRoleCodes, authUser?.baseSystemRole);

    const [tasks, approvals, projects] = await Promise.all([
      db.all(
        `
          SELECT
            t.*,
            p.name AS projectName,
            p.code AS projectCode,
            p.projectStage,
            q.quoteNumber AS quotationNumber
          FROM Task t
          LEFT JOIN Project p ON p.id = t.projectId
          LEFT JOIN Quotation q ON q.id = t.quotationId
          ${globalAccess ? '' : 'WHERE t.assigneeId = ?'}
          ORDER BY
            CASE WHEN t.status = 'active' THEN 0 WHEN t.status = 'pending' THEN 1 ELSE 2 END,
            CASE WHEN t.dueDate IS NULL THEN 1 ELSE 0 END,
            t.dueDate ASC,
            t.createdAt DESC
          LIMIT 24
        `,
        globalAccess ? [] : [userId],
      ),
      db.all(
        `
          SELECT
            ar.*,
            p.name AS projectName,
            p.code AS projectCode,
            q.quoteNumber AS quotationNumber
          FROM ApprovalRequest ar
          LEFT JOIN Project p ON p.id = ar.projectId
          LEFT JOIN Quotation q ON q.id = ar.quotationId
          ${globalAccess ? '' : 'WHERE ar.approverUserId = ? OR ar.requestedBy = ?'}
          ORDER BY CASE WHEN ar.status = 'pending' THEN 0 ELSE 1 END, ar.dueDate ASC, ar.createdAt DESC
          LIMIT 24
        `,
        globalAccess ? [] : [userId, userId],
      ),
      queryHighlightsForUser(userId, globalAccess),
    ]);

    const decoratedTasks = (Array.isArray(tasks) ? tasks : []).map((task: any) => decorateTaskForCurrentUser(task));
    const decoratedApprovals = (Array.isArray(approvals) ? approvals : []).map((approval: any) => decorateApprovalForCurrentUser(approval, authUser));

    const myWorkView = buildMyWorkView(personaMode, { tasks: decoratedTasks, approvals: decoratedApprovals, projects });

    res.json({
      persona: {
        primaryRole,
        roleCodes,
        mode: personaMode,
      },
      summary: myWorkView.summary,
      view: myWorkView.view,
      cards: myWorkView.cards,
      tasks: decoratedTasks,
      approvals: decoratedApprovals,
      projects,
    });
  }));

  app.get('/api/workspace/inbox', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const authUser = req.user;
    const roleCodes = normalizeRoleCodes(authUser?.roleCodes, authUser?.systemRole);
    const primaryRole = resolvePrimaryRole(roleCodes, authUser?.systemRole);
    const personaMode = getPersonaMode(roleCodes);
    const userId = authUser?.id || '';
    const globalAccess = hasGlobalWorkspaceAccess(authUser?.roleCodes, authUser?.systemRole, authUser?.baseRoleCodes, authUser?.baseSystemRole);

    const [documentItems, notificationItems, blockedTasks] = await Promise.all([
      db.all(
        `
          SELECT
            pd.id AS entityId,
            'ProjectDocument' AS entityType,
            pd.documentName AS title,
            pd.status,
            pd.department,
            pd.requiredAtStage,
            pd.updatedAt AS createdAt,
            p.id AS projectId,
            p.name AS projectName
          FROM ProjectDocument pd
          INNER JOIN Project p ON p.id = pd.projectId
          WHERE pd.status IN ('missing', 'requested')
            ${globalAccess ? '' : `AND (
              p.managerId = ?
              OR EXISTS (SELECT 1 FROM Task t WHERE t.projectId = p.id AND t.assigneeId = ?)
              OR EXISTS (SELECT 1 FROM ApprovalRequest ar WHERE ar.projectId = p.id AND (ar.requestedBy = ? OR ar.approverUserId = ?))
            )`}
          ORDER BY pd.updatedAt DESC, pd.createdAt DESC
          LIMIT 20
        `,
        globalAccess ? [] : [userId, userId, userId, userId],
      ),
      db.all(
        `
          SELECT
            n.id AS entityId,
            COALESCE(n.entityType, 'Notification') AS entityType,
            n.content AS title,
            n.link,
            n.createdAt
          FROM Notification n
          WHERE n.userId = ?
          ORDER BY n.createdAt DESC
          LIMIT 20
        `,
        [userId],
      ),
      db.all(
        `
          SELECT
            t.id AS entityId,
            'Task' AS entityType,
            t.name AS title,
            t.blockedReason AS description,
            t.updatedAt AS createdAt,
            p.id AS projectId,
            p.name AS projectName
          FROM Task t
          LEFT JOIN Project p ON p.id = t.projectId
          WHERE ${globalAccess ? '1 = 1 AND' : 't.assigneeId = ? AND'} t.blockedReason IS NOT NULL
            AND trim(t.blockedReason) != ''
            AND t.status != 'completed'
          ORDER BY t.updatedAt DESC, t.createdAt DESC
          LIMIT 20
        `,
        globalAccess ? [] : [userId],
      ),
    ]);

    const items = [
      ...documentItems.map((item: any) => ({ ...item, source: 'documents' })),
      ...notificationItems.map((item: any) => ({ ...item, source: 'notifications' })),
      ...blockedTasks.map((item: any) => ({ ...item, source: 'blocked_tasks' })),
    ].sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
      .map((item) => decorateInboxItem(item));

    const inboxView = buildInboxView(personaMode, items);

    res.json({
      persona: {
        primaryRole,
        roleCodes,
        mode: personaMode,
      },
      summary: inboxView.summary,
      view: inboxView.view,
      cards: inboxView.cards,
      items,
    });
  }));

  app.get('/api/workspace/approvals', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const authUser = req.user;
    const roleCodes = normalizeRoleCodes(authUser?.roleCodes, authUser?.systemRole);
    const primaryRole = resolvePrimaryRole(roleCodes, authUser?.systemRole);
    const personaMode = getPersonaMode(roleCodes);
    const userId = authUser?.id || '';
    const globalAccess = hasGlobalWorkspaceAccess(authUser?.roleCodes, authUser?.systemRole, authUser?.baseRoleCodes, authUser?.baseSystemRole);
    const approvals = (await queryApprovalsForUser(userId, globalAccess)).map((approval: any) => decorateApprovalForCurrentUser(approval, authUser));
    const approvalsView = buildApprovalsView(personaMode, approvals);

    res.json({
      persona: {
        primaryRole,
        roleCodes,
        mode: personaMode,
      },
      summary: approvalsView.summary,
      view: approvalsView.view,
      cards: approvalsView.cards,
      approvals,
    });
  }));

  app.get('/api/workspace/executive-cockpit', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const authUser = req.user;
    const roleCodes = normalizeRoleCodes(authUser?.roleCodes, authUser?.systemRole);
    if (!roleCodes.includes('director')) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const primaryRole = resolvePrimaryRole(roleCodes, authUser?.systemRole);
    const globalAccess = hasGlobalWorkspaceAccess(roleCodes, authUser?.systemRole, authUser?.baseRoleCodes, authUser?.baseSystemRole);
    const userId = authUser?.id || '';

    const [highlights, approvals] = await Promise.all([
      queryHighlightsForUser(userId, globalAccess),
      queryApprovalsForUser(userId, globalAccess),
    ]);

    res.json({
      persona: {
        primaryRole,
        roleCodes,
        mode: 'director',
      },
      summary: buildExecutiveCockpitSummary({ highlights, approvals }),
    });
  }));
}
