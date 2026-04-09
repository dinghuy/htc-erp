import type { Express, Request, Response } from 'express';
import type { PlatformWorkspaceServices } from '../../bootstrap/createOperationalServices';
import type { AuthenticatedRequest } from '../../shared/auth/httpAuth';
import { canUserApproveRequest, hasGlobalWorkspaceAccess, resolveApprovalLane as resolveApprovalLaneForUser } from '../../shared/auth/permissions';
import { normalizeRoleCodes, resolvePrimaryRole } from '../../shared/auth/roles';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterPlatformWorkspaceRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  workspaceServices: PlatformWorkspaceServices;
  getProjectWorkspaceById?: (db: any, projectId: number | string, currentUser?: any) => Promise<any>;
};

function getPersonaMode(roleCodes: string[]) {
  if (roleCodes.includes('admin')) return 'admin';
  if (roleCodes.includes('sales') && roleCodes.includes('project_manager')) return 'sales_pm_combined';
  if (roleCodes.includes('procurement')) return 'procurement';
  if (roleCodes.includes('accounting')) return 'accounting';
  if (roleCodes.includes('legal')) return 'legal';
  if (roleCodes.includes('director')) return 'director';
  if (roleCodes.includes('project_manager')) return 'project_manager';
  if (roleCodes.includes('sales')) return 'sales';
  return 'viewer';
}

function buildPriorityItems(mode: string, summary: any) {
  if (mode === 'sales_pm_combined') {
    return [
      { metricKey: 'handoff_pending', label: 'Handoff cần chốt', value: Number(summary.handoffPending ?? 0), tone: 'warn' },
      { metricKey: 'active_projects', label: 'Projects đang chạy', value: Number(summary.activeProjects ?? 0), tone: 'good' },
      { metricKey: 'pending_approvals', label: 'Approvals chờ', value: Number(summary.pendingApprovals ?? 0), tone: 'bad' },
    ];
  }

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
    sales_pm_combined: {
      title: 'My Work',
      description: 'Queue hợp nhất cho vai trò sales + PM, gom commercial handoff, execution blockers và approval trong cùng một lớp điều phối.',
      taskTitle: 'Deals + Projects',
      taskDescription: 'Các đầu việc đang kéo từ quotation sang execution, ưu tiên theo blocker và tiến độ dự án.',
      approvalTitle: 'Unified Approvals',
      approvalDescription: 'Một hàng chờ approval duy nhất cho commercial, legal, finance và delivery milestones.',
      cards: [
        { label: 'Deals cần chốt', value: summary.taskCount, tone: 'info' },
        { label: 'Handoff / approvals', value: summary.approvalCount, tone: 'warn' },
        { label: 'Projects cần đẩy', value: summary.projectCount, tone: 'good' },
      ],
    },
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
    sales_pm_combined: {
      title: 'Unified Inbox',
      description: 'Một inbox hợp nhất cho hồ sơ thiếu, blocked task và notifications ảnh hưởng trực tiếp tới deal-to-delivery flow.',
    },
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
    sales_pm_combined: {
      title: 'Unified Approvals',
      description: 'Cockpit approval hợp nhất cho commercial, execution và các lane điều phối liên quan tới sales + PM.',
    },
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
      isRequester: Boolean(currentUser?.id) && String(approval?.requestedBy || '') === String(currentUser?.id || ''),
      isAssignedApprover: !approval?.approverUserId || String(approval.approverUserId) === String(currentUser?.id || ''),
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

export function registerPlatformWorkspaceRoutes(app: Express, deps: RegisterPlatformWorkspaceRoutesDeps) {
  const { ah, requireAuth, workspaceServices } = deps;

  app.get('/api/workspace/home', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const authUser = req.user;
    const roleCodes = normalizeRoleCodes(authUser?.roleCodes, authUser?.systemRole);
    const primaryRole = resolvePrimaryRole(roleCodes, authUser?.systemRole);
    const personaMode = getPersonaMode(roleCodes);
    const globalAccess = hasGlobalWorkspaceAccess(roleCodes, authUser?.systemRole, authUser?.baseRoleCodes, authUser?.baseSystemRole);
    const userId = authUser?.id || '';

    const [summary, rawHighlights] = await Promise.all([
      workspaceServices.getHomeSummary(userId, globalAccess),
      workspaceServices.listHighlights(userId, globalAccess, authUser),
    ]);

    res.json({
      persona: {
        primaryRole,
        roleCodes,
        mode: personaMode,
      },
      priorities: buildPriorityItems(personaMode, summary || {}),
      highlights: rawHighlights,
    });
  }));

  app.get('/api/workspace/my-work', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const authUser = req.user;
    const roleCodes = normalizeRoleCodes(authUser?.roleCodes, authUser?.systemRole);
    const primaryRole = resolvePrimaryRole(roleCodes, authUser?.systemRole);
    const personaMode = getPersonaMode(roleCodes);
    const userId = authUser?.id || '';
    const globalAccess = hasGlobalWorkspaceAccess(authUser?.roleCodes, authUser?.systemRole, authUser?.baseRoleCodes, authUser?.baseSystemRole);

    const { tasks, approvals } = await workspaceServices.getMyWork(userId, globalAccess);
    const projects = await workspaceServices.listHighlights(userId, globalAccess, authUser);

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
    const authUser = req.user;
    const roleCodes = normalizeRoleCodes(authUser?.roleCodes, authUser?.systemRole);
    const primaryRole = resolvePrimaryRole(roleCodes, authUser?.systemRole);
    const personaMode = getPersonaMode(roleCodes);
    const userId = authUser?.id || '';
    const globalAccess = hasGlobalWorkspaceAccess(authUser?.roleCodes, authUser?.systemRole, authUser?.baseRoleCodes, authUser?.baseSystemRole);

    const { documentItems, notificationItems, blockedTasks } = await workspaceServices.getInboxItems(userId, globalAccess);

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
    const approvals = (await workspaceServices.listApprovals(userId, globalAccess)).map((approval: any) => decorateApprovalForCurrentUser(approval, authUser));
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

  app.get('/api/v1/approvals/queue', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const authUser = req.user;
    const roleCodes = normalizeRoleCodes(authUser?.roleCodes, authUser?.systemRole);
    const userId = authUser?.id || '';
    const globalAccess = hasGlobalWorkspaceAccess(authUser?.roleCodes, authUser?.systemRole, authUser?.baseRoleCodes, authUser?.baseSystemRole);
    const approvals = (await workspaceServices.listApprovals(userId, globalAccess))
      .map((approval: any) => decorateApprovalForCurrentUser(approval, authUser))
      .map((approval: any) => ({
        id: approval.id,
        approvalRequestId: approval.id,
        lane: approval.actionAvailability?.lane || resolveApprovalLane(approval),
        status: approval.status,
        requestType: approval.requestType || null,
        projectId: approval.projectId || null,
        taskId: approval.taskId || null,
        dueAt: approval.dueDate || null,
        assigneeUserId: approval.approverUserId || null,
        createdAt: approval.createdAt || null,
        updatedAt: approval.updatedAt || null,
        createdBy: approval.requestedBy || null,
        updatedBy: approval.decidedBy || null,
      }));

    res.json({
      items: approvals,
      persona: {
        primaryRole: resolvePrimaryRole(roleCodes, authUser?.systemRole),
        roleCodes,
        mode: getPersonaMode(roleCodes),
      },
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
      workspaceServices.listHighlights(userId, globalAccess),
      workspaceServices.listApprovals(userId, globalAccess),
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
