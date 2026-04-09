import { resolveApprovalLane } from '../../shared/auth/permissions';

export type WorkspaceBuildUtils = {
  projectHubText: (value: unknown) => string;
  projectHubNumber: (value: unknown, fallback?: number) => number;
};

export function buildWorkspacePhaseControl(
  input: {
    projectStage?: string | null;
    actionAvailability?: any;
    gateStates?: any[];
    documents?: any[];
    procurementLines?: any[];
    milestones?: any[];
    taskCount?: number;
    openTaskCount?: number;
    overdueTaskCount?: number;
    deliveryLines?: any[];
  },
  utils: WorkspaceBuildUtils
) {
  const { projectHubText, projectHubNumber } = utils;
  const stage = String(input.projectStage || 'new').trim().toLowerCase();
  const gateStates = Array.isArray(input.gateStates) ? input.gateStates : [];
  const documents = Array.isArray(input.documents) ? input.documents : [];
  const procurementLines = Array.isArray(input.procurementLines) ? input.procurementLines : [];
  const milestones = Array.isArray(input.milestones) ? input.milestones : [];
  const deliveryLines = Array.isArray(input.deliveryLines) ? input.deliveryLines : [];

  const quotationGate = gateStates.find((gate) => gate.gateType === 'quotation_commercial');
  const deliveryCompletionGate = gateStates.find((gate) => gate.gateType === 'delivery_completion');
  const missingDocuments = documents.filter((document) => ['missing', 'requested'].includes(String(document?.status || '').toLowerCase()));
  const overdueEtaCount = procurementLines.filter((line) => {
    const etaDate = projectHubText(line?.etaDate);
    if (!etaDate) return false;
    const deliveredEnough = projectHubNumber(line?.receivedQty, 0) >= Math.max(projectHubNumber(line?.orderedQty, 0), projectHubNumber(line?.contractQty, 0));
    return !deliveredEnough && etaDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
  }).length;
  const shortageCount = procurementLines.filter((line) => projectHubNumber(line?.shortageQty, 0) > 0).length;
  const unorderedCount = procurementLines.filter((line) => projectHubNumber(line?.orderedQty, 0) < projectHubNumber(line?.contractQty, 0)).length;
  const overdueDeliveryCount = procurementLines.filter((line) => {
    const committed = projectHubText(line?.committedDeliveryDate);
    if (!committed) return false;
    const deliveredEnough = projectHubNumber(line?.deliveredQty, 0) >= projectHubNumber(line?.contractQty, 0);
    return !deliveredEnough && committed.slice(0, 10) < new Date().toISOString().slice(0, 10);
  }).length;
  const pendingMilestoneCount = milestones.filter((milestone) => String(milestone?.status || '').toLowerCase() !== 'completed').length;
  const openTaskCount = projectHubNumber(input.openTaskCount, 0);
  const overdueTaskCount = projectHubNumber(input.overdueTaskCount, 0);

  const items = [
    {
      id: 'commercial-gate',
      label: 'Commercial gate',
      status: quotationGate?.status === 'approved' ? 'ready' : quotationGate?.status === 'pending' || quotationGate?.status === 'changes_requested' ? 'warning' : 'blocked',
      detail: quotationGate
        ? `Quotation commercial đang ở trạng thái ${String(quotationGate.status || 'not_requested')}.`
        : 'Chưa có commercial gate phù hợp cho project này.',
      action: 'openApprovals',
    },
    {
      id: 'document-checklist',
      label: 'Document checklist',
      status: missingDocuments.length === 0 ? 'ready' : missingDocuments.length > 2 ? 'blocked' : 'warning',
      detail: missingDocuments.length === 0 ? 'Không còn hồ sơ thiếu hoặc requested.' : `${missingDocuments.length} hồ sơ đang thiếu hoặc mới chỉ requested.`,
      action: 'openDocuments',
    },
    {
      id: 'execution-queue',
      label: 'Execution queue',
      status: overdueTaskCount > 0 ? 'blocked' : openTaskCount > 0 || pendingMilestoneCount > 0 ? 'warning' : 'ready',
      detail: overdueTaskCount > 0 ? `${overdueTaskCount} task overdue đang chặn execution.` : `${openTaskCount} task mở · ${pendingMilestoneCount} milestone pending.`,
      action: 'openTasks',
    },
    {
      id: 'supply-readiness',
      label: 'Supply readiness',
      status: shortageCount > 0 || overdueEtaCount > 0 ? 'blocked' : unorderedCount > 0 ? 'warning' : 'ready',
      detail: shortageCount > 0 || overdueEtaCount > 0 ? `${shortageCount} line thiếu · ${overdueEtaCount} ETA trễ.` : unorderedCount > 0 ? `${unorderedCount} line chưa đặt mua đủ.` : 'Không có shortage hoặc ETA trễ đáng chú ý.',
      action: 'openProcurement',
    },
    {
      id: 'delivery-close',
      label: 'Delivery completion',
      status: overdueDeliveryCount > 0 ? 'blocked' : deliveryCompletionGate?.status === 'approved' ? 'ready' : deliveryCompletionGate?.status === 'pending' || deliveryCompletionGate?.status === 'changes_requested' ? 'warning' : 'blocked',
      detail: overdueDeliveryCount > 0 ? `${overdueDeliveryCount} line đã quá committed delivery date.` : deliveryCompletionGate ? `Delivery completion gate đang ở trạng thái ${String(deliveryCompletionGate.status || 'not_requested')}.` : 'Chưa có delivery completion gate.',
      action: overdueDeliveryCount > 0 ? 'openDelivery' : 'openApprovals',
    },
  ];

  const blockers = [
    ...gateStates.flatMap((gate: any) =>
      (Array.isArray(gate?.actionAvailability?.blockers) ? gate.actionAvailability.blockers : []).map((blocker: string, index: number) => ({
        id: `${gate.gateType}-blocker-${index}`,
        tone: 'danger',
        title: gate.title || gate.gateType || 'Workflow gate',
        detail: blocker,
        action: 'openApprovals',
      })),
    ),
    ...missingDocuments.slice(0, 3).map((document: any) => ({
      id: `document-${document.id}`,
      tone: 'warning',
      title: document.documentName || document.title || 'Document missing',
      detail: `${document.department || 'cross-functional'} · required at ${document.requiredAtStage || 'any stage'}`,
      action: 'openDocuments',
    })),
  ];

  if (shortageCount > 0) {
    blockers.push({
      id: 'shortage-lines',
      tone: 'danger',
      title: 'Procurement shortage',
      detail: `${shortageCount} line đang thiếu so với contract/ordered quantity.`,
      action: 'openProcurement',
    });
  }
  if (overdueTaskCount > 0) {
    blockers.push({
      id: 'overdue-tasks',
      tone: 'warning',
      title: 'Execution overdue',
      detail: `${overdueTaskCount} task overdue cần kéo lại ngay.`,
      action: 'openTasks',
    });
  }
  if (overdueDeliveryCount > 0) {
    blockers.push({
      id: 'delivery-overdue',
      tone: 'danger',
      title: 'Delivery pressure',
      detail: `${overdueDeliveryCount} line đã quá committed delivery date.`,
      action: 'openDelivery',
    });
  }

  const readyCount = items.filter((item) => item.status === 'ready').length;
  const readinessScore = Math.round((readyCount / Math.max(items.length, 1)) * 100);
  const readinessTone = readinessScore >= 80 ? 'good' : readinessScore >= 50 ? 'warn' : 'bad';
  const nextStepLabel =
    ['quoting', 'negotiating', 'internal-review'].includes(stage)
      ? 'Commercial approval / sales order'
      : ['commercial_approved', 'won', 'order_released', 'procurement_active'].includes(stage)
        ? 'Procurement readiness'
        : ['delivery_active', 'delivery'].includes(stage)
          ? 'Delivery completion'
          : 'Project close / operating review';

  return {
    stageLabel: stage,
    nextStepLabel,
    readinessScore,
    readinessTone,
    summary:
      readinessTone === 'good'
        ? `Project đang khá sạch để đi tiếp sang bước ${nextStepLabel.toLowerCase()}.`
        : readinessTone === 'warn'
          ? `Project có thể đi tiếp nhưng nên dọn một số warning trước khi sang ${nextStepLabel.toLowerCase()}.`
          : `Project chưa sẵn sàng cho bước ${nextStepLabel.toLowerCase()}; cần xử lý blockers trước.`,
    items,
    blockers: blockers.slice(0, 6),
  };
}

export function buildWorkspaceBlockerRegister(
  input: {
    phaseControl?: any;
    gateStates?: any[];
    actionAvailability?: any;
    documents?: any[];
    tasks?: any[];
    manualBlockers?: any[];
  },
  utils: Pick<WorkspaceBuildUtils, 'projectHubText'>
) {
  const { projectHubText } = utils;
  const phaseBlockers = Array.isArray(input.phaseControl?.blockers) ? input.phaseControl.blockers : [];
  const gateStates = Array.isArray(input.gateStates) ? input.gateStates : [];
  const documents = Array.isArray(input.documents) ? input.documents : [];
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const salesOrderBlockers = Array.isArray(input.actionAvailability?.salesOrder?.blockers) ? input.actionAvailability.salesOrder.blockers : [];
  const logisticsBlockers = Array.isArray(input.actionAvailability?.project?.logisticsBlockers) ? input.actionAvailability.project.logisticsBlockers : [];
  const overdueTasks = tasks.filter((task) => {
    const dueDate = projectHubText(task?.dueDate);
    return Boolean(dueDate) && dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10) && String(task?.status || '').toLowerCase() !== 'completed';
  });
  const manualBlockers = Array.isArray(input.manualBlockers) ? input.manualBlockers : [];

  const register = [
    ...manualBlockers.map((blocker: any) => ({
      id: blocker.id,
      source: blocker.source || 'manual',
      category: blocker.category || 'workflow',
      tone: blocker.tone || 'warning',
      title: blocker.title || 'Manual blocker',
      detail: blocker.detail || 'Manual blocker',
      action: blocker.action || null,
      owner: blocker.ownerRole || blocker.createdByName || null,
      ownerRole: blocker.ownerRole || null,
      status: blocker.status || 'open',
      linkedEntityType: blocker.linkedEntityType || null,
      linkedEntityId: blocker.linkedEntityId || null,
      isManual: true,
      createdAt: blocker.createdAt || null,
      resolvedAt: blocker.resolvedAt || null,
    })),
    ...phaseBlockers.map((blocker: any, index: number) => ({
      id: blocker.id || `phase-control-${index}`,
      source: 'phase_control',
      category: 'workflow',
      tone: blocker.tone || 'warning',
      title: blocker.title || 'Blocker giai đoạn',
      detail: blocker.detail || blocker.description || 'Project chưa sẵn sàng để đi tiếp.',
      action: blocker.action || null,
      owner: 'cross-functional',
    })),
    ...gateStates.flatMap((gate: any) =>
      (Array.isArray(gate?.actionAvailability?.blockers) ? gate.actionAvailability.blockers : []).map((detail: string, index: number) => ({
        id: `${gate.gateType}-gate-${index}`,
        source: 'approval_gate',
        category: 'approval',
        tone: gate.gateType === 'delivery_completion' ? 'danger' : 'warning',
        title: gate.title || gate.gateType || 'Approval gate',
        detail,
        action: 'openApprovals',
        owner: gate.pendingApprovers?.[0]?.approverRole || null,
        ownerRole: gate.pendingApprovers?.[0]?.approverRole || null,
      })),
    ),
    ...salesOrderBlockers.map((detail: string, index: number) => ({
      id: `sales-order-${index}`,
      source: 'sales_order',
      category: 'commercial',
      tone: 'warning',
      title: 'Sales order release',
      detail,
      action: 'openCommercial',
      owner: 'project_manager',
      ownerRole: 'project_manager',
    })),
    ...logisticsBlockers.map((detail: string, index: number) => ({
      id: `logistics-${index}`,
      source: 'logistics',
      category: 'execution',
      tone: 'danger',
      title: 'Logistics / delivery',
      detail,
      action: 'openDelivery',
      owner: 'procurement',
      ownerRole: 'procurement',
    })),
    ...documents
      .filter((document) => ['missing', 'requested', 'rejected'].includes(String(document?.status || '').toLowerCase()))
      .slice(0, 6)
      .map((document) => ({
        id: `document-${document.id}`,
        source: 'document_checklist',
        category: 'documents',
        tone: String(document.status || '').toLowerCase() === 'rejected' ? 'danger' : 'warning',
        title: document.documentName || document.documentCode || 'Checklist document',
        detail: `${document.department || 'cross-functional'} · required at ${document.requiredAtStage || 'any stage'} · status ${String(document.status || 'missing')}.`,
        action: 'openDocuments',
        owner: document.department || null,
        ownerRole: document.department || null,
      })),
    ...overdueTasks.slice(0, 6).map((task: any) => ({
      id: `task-${task.id}`,
      source: 'task',
      category: 'execution',
      tone: 'warning',
      title: task.title || 'Task overdue',
      detail: `Due ${projectHubText(task.dueDate) || 'n/a'} · owner ${projectHubText(task.assigneeName || task.assigneeId) || 'unassigned'}.`,
      action: 'openTasks',
      owner: task.assigneeId || null,
      ownerRole: null,
    })),
  ];

  return register
    .filter((item) => String(item.status || 'open').toLowerCase() !== 'resolved')
    .slice(0, 16);
}

export function buildWorkspaceAuditTrail(input: {
  approvals?: any[];
  timeline?: any[];
  activities?: any[];
}) {
  const approvals = Array.isArray(input.approvals) ? input.approvals : [];
  const timeline = Array.isArray(input.timeline) ? input.timeline : [];
  const activities = Array.isArray(input.activities) ? input.activities : [];

  return [
    ...approvals.map((approval: any) => ({
      id: `approval-${approval.id}`,
      source: 'approval',
      category: resolveApprovalLane(approval),
      title: approval.title || approval.requestType || approval.id,
      detail: approval.note || approval.description || 'Approval request',
      status: approval.status || 'pending',
      actor: approval.approverName || approval.approverRole || approval.requestedByName || null,
      entityType: 'ApprovalRequest',
      entityId: approval.id,
      linkedEntityType: approval.quotationId ? 'Quotation' : 'Project',
      linkedEntityId: approval.quotationId || approval.projectId || null,
      eventDate: approval.updatedAt || approval.createdAt || null,
    })),
    ...timeline.map((event: any) => ({
      id: `timeline-${event.id}`,
      source: 'timeline',
      category: event.eventType || 'timeline',
      title: event.title || event.eventType || event.id,
      detail: event.description || 'Timeline event',
      status: null,
      actor: event.createdBy || null,
      entityType: event.entityType || 'ProjectTimelineEvent',
      entityId: event.entityId || event.id,
      linkedEntityType: event.entityType || null,
      linkedEntityId: event.entityId || null,
      eventDate: event.eventDate || event.createdAt || null,
    })),
    ...activities.map((activity: any) => ({
      id: `activity-${activity.id}`,
      source: 'activity',
      category: activity.entityType || 'activity',
      title: activity.action || activity.entityType || activity.id,
      detail: activity.description || activity.note || 'Activity log',
      status: null,
      actor: activity.actorDisplayName || activity.userName || activity.actorRoles || 'system',
      entityType: activity.entityType || 'Activity',
      entityId: activity.entityId || activity.id,
      linkedEntityType: activity.entityType || null,
      linkedEntityId: activity.entityId || null,
      actorRoles: activity.actorRoles || null,
      actingCapability: activity.actingCapability || null,
      eventDate: activity.timestamp || activity.createdAt || null,
    })),
  ]
    .sort((left, right) => String(right.eventDate || '').localeCompare(String(left.eventDate || '')))
    .slice(0, 16);
}
