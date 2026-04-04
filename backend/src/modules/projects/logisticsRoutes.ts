import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { canStartLogisticsExecution } from '../../shared/workflow/revenueFlow';
import { finalizeDeliveryCompletion } from './deliveryCompletion';
import { createProjectRepository } from './repository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProjectLogisticsRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  getCurrentUserId: (req: Request) => string;
  projectHubText: (value: unknown) => string;
  projectHubNumber: (value: unknown, fallback?: number) => number;
  recalculateProjectProcurementRollup: (db: any, procurementLineId: string) => Promise<any>;
  mapProjectInboundLineRow: (row: any) => any;
  mapProjectDeliveryLineRow: (row: any) => any;
  createProjectTimelineEvent: (db: any, event: any) => Promise<any>;
  getProjectWorkspaceById: (db: any, projectId: string, currentUser?: any) => Promise<any>;
};

export function registerProjectLogisticsRoutes(app: Express, deps: RegisterProjectLogisticsRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    getCurrentUserId,
    projectHubText,
    projectHubNumber,
    recalculateProjectProcurementRollup,
    mapProjectInboundLineRow,
    mapProjectDeliveryLineRow,
    createProjectTimelineEvent,
    getProjectWorkspaceById,
  } = deps;
  const projectRepository = createProjectRepository();
  const STAGE_PRIORITY: Record<string, number> = {
    new: 0,
    quoting: 1,
    negotiating: 2,
    'internal-review': 3,
    commercial_approved: 4,
    won: 5,
    order_released: 6,
    procurement_active: 7,
    delivery_active: 8,
    delivery_completed: 9,
    closed: 10,
    lost: -1,
  };

  async function ensureReleasedExecutionOrder(projectId: string) {
    const salesOrders = await projectRepository.listProjectSalesOrders(projectId);
    const latestSalesOrder = Array.isArray(salesOrders) ? salesOrders[0] : null;
    if (!latestSalesOrder) {
      return { ok: false as const, httpStatus: 409, error: 'Sales order is required before logistics execution' };
    }
    if (!canStartLogisticsExecution(latestSalesOrder.status)) {
      return { ok: false as const, httpStatus: 409, error: 'Sales order must be released before logistics execution' };
    }
    return { ok: true as const, salesOrder: latestSalesOrder };
  }

  async function ensureLogisticsReadiness(projectId: string, currentUser: any) {
    const workspace = await getProjectWorkspaceById(null, projectId, currentUser);
    const projectActions = workspace?.actionAvailability?.project;
    if (!projectActions?.canRecordLogistics) {
      return {
        ok: false as const,
        httpStatus: 409,
        error:
          Array.isArray(projectActions?.logisticsBlockers) && projectActions.logisticsBlockers.length
            ? projectActions.logisticsBlockers[0]
            : 'Workspace chưa sẵn sàng để ghi nhận logistics',
        code: 'LOGISTICS_READINESS_BLOCKED',
        blockers: projectActions?.logisticsBlockers || [],
      };
    }
    return { ok: true as const };
  }

  async function promoteProjectStage(projectId: string, targetStage: string) {
    const project = await projectRepository.findProjectSummaryById(projectId);
    if (!project) return;
    const currentStage = String(project.projectStage || 'new').trim().toLowerCase();
    if (['delivery_completed', 'closed', 'lost'].includes(currentStage)) return;
    const currentPriority = STAGE_PRIORITY[currentStage] ?? 0;
    const targetPriority = STAGE_PRIORITY[targetStage] ?? currentPriority;
    if (targetPriority > currentPriority) {
      await projectRepository.updateProjectStageById(projectId, targetStage);
    }
  }

  app.patch('/api/project-procurement-lines/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const lineId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await projectRepository.findProcurementLineById(lineId);
    if (!existing) return res.status(404).json({ error: 'Procurement line not found' });
    const readiness = await ensureLogisticsReadiness(existing.projectId, (req as any).user);
    if (!readiness.ok) return res.status(readiness.httpStatus).json({ error: readiness.error, code: readiness.code, blockers: readiness.blockers });

    await projectRepository.updateProcurementLineById({
      id: lineId,
      supplierId: projectHubText(req.body?.supplierId) || existing.supplierId || null,
      poNumber: projectHubText(req.body?.poNumber) || existing.poNumber || null,
      orderedQty: req.body?.orderedQty == null ? projectHubNumber(existing.orderedQty, 0) : projectHubNumber(req.body?.orderedQty, 0),
      etaDate: projectHubText(req.body?.etaDate) || existing.etaDate || null,
      committedDeliveryDate: projectHubText(req.body?.committedDeliveryDate) || existing.committedDeliveryDate || null,
      status: projectHubText(req.body?.status) || existing.status || 'planned',
      note: projectHubText(req.body?.note) || existing.note || null,
    });

    const updated = await recalculateProjectProcurementRollup(null, lineId);
    await promoteProjectStage(existing.projectId, 'procurement_active');
    await createProjectTimelineEvent(null, {
      projectId: existing.projectId,
      eventType: 'procurement.updated',
      title: `Cập nhật line mua hàng ${updated?.itemCode || updated?.itemName || ''}`.trim(),
      description: `PO ${projectHubText(req.body?.poNumber) || updated?.poNumber || 'chưa gán'} · Ordered ${projectHubNumber(updated?.orderedQty, 0)}`,
      eventDate: projectHubText(req.body?.etaDate) || existing.etaDate || null,
      entityType: 'ProjectProcurementLine',
      entityId: lineId,
      payload: updated,
      createdBy: getCurrentUserId(req),
    });

    res.json(updated);
  }));

  app.post('/api/projects/:id/inbound-lines', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const releaseCheck = await ensureReleasedExecutionOrder(projectId);
    if (!releaseCheck.ok) return res.status(releaseCheck.httpStatus).json({ error: releaseCheck.error });
    const readiness = await ensureLogisticsReadiness(projectId, (req as any).user);
    if (!readiness.ok) return res.status(readiness.httpStatus).json({ error: readiness.error, code: readiness.code, blockers: readiness.blockers });
    const procurementLineId = projectHubText(req.body?.procurementLineId);
    if (!procurementLineId) return res.status(400).json({ error: 'procurementLineId is required' });
    const procurementLine = await projectRepository.findProcurementLineByIdForProject(procurementLineId, projectId);
    if (!procurementLine) return res.status(404).json({ error: 'Procurement line not found' });

    const id = uuidv4();
    await projectRepository.insertInboundLine({
      id,
      projectId,
      procurementLineId,
      baselineId: procurementLine.baselineId || null,
      sourceLineKey: procurementLine.sourceLineKey || null,
      receivedQty: projectHubNumber(req.body?.receivedQty, 0),
      etaDate: projectHubText(req.body?.etaDate) || null,
      actualReceivedDate: projectHubText(req.body?.actualReceivedDate) || null,
      status: projectHubText(req.body?.status) || 'pending',
      receiptRef: projectHubText(req.body?.receiptRef) || null,
      note: projectHubText(req.body?.note) || null,
      createdBy: getCurrentUserId(req) || null,
    });

    const line = mapProjectInboundLineRow(await projectRepository.findInboundLineById(id));
    const procurement = await recalculateProjectProcurementRollup(null, procurementLineId);
    await promoteProjectStage(projectId, 'procurement_active');
    await createProjectTimelineEvent(null, {
      projectId,
      eventType: 'inbound.created',
      title: `Nhập hàng ${procurement?.itemCode || procurement?.itemName || ''}`.trim(),
      description: `Nhập ${projectHubNumber(line?.receivedQty, 0)} đơn vị${line?.receiptRef ? ` · ${line.receiptRef}` : ''}`,
      eventDate: line?.actualReceivedDate || line?.etaDate || null,
      entityType: 'ProjectInboundLine',
      entityId: id,
      payload: { line, procurement },
      createdBy: getCurrentUserId(req),
    });

    res.status(201).json(line);
  }));

  app.patch('/api/project-inbound-lines/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const inboundLineId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await projectRepository.findInboundLineById(inboundLineId);
    if (!existing) return res.status(404).json({ error: 'Inbound line not found' });
    const releaseCheck = await ensureReleasedExecutionOrder(existing.projectId);
    if (!releaseCheck.ok) return res.status(releaseCheck.httpStatus).json({ error: releaseCheck.error });
    const readiness = await ensureLogisticsReadiness(existing.projectId, (req as any).user);
    if (!readiness.ok) return res.status(readiness.httpStatus).json({ error: readiness.error, code: readiness.code, blockers: readiness.blockers });

    const procurementLineId = projectHubText(req.body?.procurementLineId) || existing.procurementLineId;
    const procurementLine = await projectRepository.findProcurementLineByIdForProject(procurementLineId, existing.projectId);
    if (!procurementLine) return res.status(404).json({ error: 'Procurement line not found' });

    await projectRepository.updateInboundLineById({
      id: inboundLineId,
      procurementLineId,
      baselineId: procurementLine.baselineId || null,
      sourceLineKey: procurementLine.sourceLineKey || null,
      receivedQty: req.body?.receivedQty == null ? projectHubNumber(existing.receivedQty, 0) : projectHubNumber(req.body?.receivedQty, 0),
      etaDate: projectHubText(req.body?.etaDate) || existing.etaDate || null,
      actualReceivedDate: projectHubText(req.body?.actualReceivedDate) || existing.actualReceivedDate || null,
      status: projectHubText(req.body?.status) || existing.status || 'pending',
      receiptRef: projectHubText(req.body?.receiptRef) || existing.receiptRef || null,
      note: projectHubText(req.body?.note) || existing.note || null,
    });

    const line = mapProjectInboundLineRow(await projectRepository.findInboundLineById(inboundLineId));
    const procurement = await recalculateProjectProcurementRollup(null, procurementLineId);
    await promoteProjectStage(existing.projectId, 'procurement_active');
    await createProjectTimelineEvent(null, {
      projectId: existing.projectId,
      eventType: 'inbound.updated',
      title: `Cập nhật inbound ${procurement?.itemCode || procurement?.itemName || ''}`.trim(),
      description: `Nhập ${projectHubNumber(line?.receivedQty, 0)} đơn vị${line?.receiptRef ? ` · ${line.receiptRef}` : ''}`,
      eventDate: line?.actualReceivedDate || line?.etaDate || null,
      entityType: 'ProjectInboundLine',
      entityId: inboundLineId,
      payload: { line, procurement },
      createdBy: getCurrentUserId(req),
    });

    res.json(line);
  }));

  app.post('/api/projects/:id/delivery-lines', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const releaseCheck = await ensureReleasedExecutionOrder(projectId);
    if (!releaseCheck.ok) return res.status(releaseCheck.httpStatus).json({ error: releaseCheck.error });
    const readiness = await ensureLogisticsReadiness(projectId, (req as any).user);
    if (!readiness.ok) return res.status(readiness.httpStatus).json({ error: readiness.error, code: readiness.code, blockers: readiness.blockers });
    const procurementLineId = projectHubText(req.body?.procurementLineId);
    if (!procurementLineId) return res.status(400).json({ error: 'procurementLineId is required' });
    const procurementLine = await projectRepository.findProcurementLineByIdForProject(procurementLineId, projectId);
    if (!procurementLine) return res.status(404).json({ error: 'Procurement line not found' });

    const id = uuidv4();
    await projectRepository.insertDeliveryLine({
      id,
      projectId,
      procurementLineId,
      baselineId: procurementLine.baselineId || null,
      sourceLineKey: procurementLine.sourceLineKey || null,
      deliveredQty: projectHubNumber(req.body?.deliveredQty, 0),
      committedDate: projectHubText(req.body?.committedDate) || null,
      actualDeliveryDate: projectHubText(req.body?.actualDeliveryDate) || null,
      status: projectHubText(req.body?.status) || 'pending',
      deliveryRef: projectHubText(req.body?.deliveryRef) || null,
      note: projectHubText(req.body?.note) || null,
      createdBy: getCurrentUserId(req) || null,
    });

    const line = mapProjectDeliveryLineRow(await projectRepository.findDeliveryLineById(id));
    const procurement = await recalculateProjectProcurementRollup(null, procurementLineId);
    await promoteProjectStage(projectId, 'delivery_active');
    await createProjectTimelineEvent(null, {
      projectId,
      eventType: 'delivery.created',
      title: `Giao hàng ${procurement?.itemCode || procurement?.itemName || ''}`.trim(),
      description: `Giao ${projectHubNumber(line?.deliveredQty, 0)} đơn vị${line?.deliveryRef ? ` · ${line.deliveryRef}` : ''}`,
      eventDate: line?.actualDeliveryDate || line?.committedDate || null,
      entityType: 'ProjectDeliveryLine',
      entityId: id,
      payload: { line, procurement },
      createdBy: getCurrentUserId(req),
    });

    res.status(201).json(line);
  }));

  app.patch('/api/project-delivery-lines/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const deliveryLineId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await projectRepository.findDeliveryLineById(deliveryLineId);
    if (!existing) return res.status(404).json({ error: 'Delivery line not found' });
    const releaseCheck = await ensureReleasedExecutionOrder(existing.projectId);
    if (!releaseCheck.ok) return res.status(releaseCheck.httpStatus).json({ error: releaseCheck.error });
    const readiness = await ensureLogisticsReadiness(existing.projectId, (req as any).user);
    if (!readiness.ok) return res.status(readiness.httpStatus).json({ error: readiness.error, code: readiness.code, blockers: readiness.blockers });

    const procurementLineId = projectHubText(req.body?.procurementLineId) || existing.procurementLineId;
    const procurementLine = await projectRepository.findProcurementLineByIdForProject(procurementLineId, existing.projectId);
    if (!procurementLine) return res.status(404).json({ error: 'Procurement line not found' });

    await projectRepository.updateDeliveryLineById({
      id: deliveryLineId,
      procurementLineId,
      baselineId: procurementLine.baselineId || null,
      sourceLineKey: procurementLine.sourceLineKey || null,
      deliveredQty: req.body?.deliveredQty == null ? projectHubNumber(existing.deliveredQty, 0) : projectHubNumber(req.body?.deliveredQty, 0),
      committedDate: projectHubText(req.body?.committedDate) || existing.committedDate || null,
      actualDeliveryDate: projectHubText(req.body?.actualDeliveryDate) || existing.actualDeliveryDate || null,
      status: projectHubText(req.body?.status) || existing.status || 'pending',
      deliveryRef: projectHubText(req.body?.deliveryRef) || existing.deliveryRef || null,
      note: projectHubText(req.body?.note) || existing.note || null,
    });

    const line = mapProjectDeliveryLineRow(await projectRepository.findDeliveryLineById(deliveryLineId));
    const procurement = await recalculateProjectProcurementRollup(null, procurementLineId);
    await promoteProjectStage(existing.projectId, 'delivery_active');
    await createProjectTimelineEvent(null, {
      projectId: existing.projectId,
      eventType: 'delivery.updated',
      title: `Cập nhật delivery ${procurement?.itemCode || procurement?.itemName || ''}`.trim(),
      description: `Giao ${projectHubNumber(line?.deliveredQty, 0)} đơn vị${line?.deliveryRef ? ` · ${line.deliveryRef}` : ''}`,
      eventDate: line?.actualDeliveryDate || line?.committedDate || null,
      entityType: 'ProjectDeliveryLine',
      entityId: deliveryLineId,
      payload: { line, procurement },
      createdBy: getCurrentUserId(req),
    });

    res.json(line);
  }));

  app.post('/api/projects/:id/delivery-completion', requireAuth, requireRole('admin', 'sales', 'director'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await projectRepository.findProjectSummaryById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const workspace = await getProjectWorkspaceById(null, projectId, (req as any).user);
    const projectActions = workspace?.actionAvailability?.project;
    if (!projectActions?.canFinalizeDeliveryCompletion) {
      return res.status(409).json({
        error: Array.isArray(projectActions?.blockers) && projectActions.blockers.length
          ? projectActions.blockers[0]
          : 'Workspace chưa sẵn sàng để finalize delivery',
        code: 'DELIVERY_COMPLETION_READINESS_BLOCKED',
        blockers: projectActions?.blockers || [],
      });
    }

    const releaseCheck = await ensureReleasedExecutionOrder(projectId);
    if (!releaseCheck.ok) return res.status(releaseCheck.httpStatus).json({ error: releaseCheck.error });
    const approvedCompletionRequest = await projectRepository.findLatestApprovalRequest(projectId, 'delivery_completion', 'approved');
    if (!approvedCompletionRequest) {
      return res.status(409).json({ error: 'Approved delivery completion request is required before finalizing delivery', code: 'DELIVERY_COMPLETION_APPROVAL_REQUIRED' });
    }

    const completion = await finalizeDeliveryCompletion({
      db: null,
      projectRepository,
      projectId,
      actorUserId: getCurrentUserId(req) || null,
      sourceApprovalId: approvedCompletionRequest.id,
      createProjectTimelineEvent,
    });
    if (completion.ok === false) {
      return res.status(completion.httpStatus).json({ error: completion.error, code: completion.code });
    }

    res.json(completion.project);
  }));

  app.post('/api/projects/:id/milestones', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await projectRepository.findProjectSummaryById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const title = projectHubText(req.body?.title);
    if (!title) return res.status(400).json({ error: 'title is required' });

    const id = uuidv4();
    await projectRepository.insertMilestone({
      id,
      projectId,
      milestoneType: projectHubText(req.body?.milestoneType) || null,
      title,
      plannedDate: projectHubText(req.body?.plannedDate) || null,
      actualDate: projectHubText(req.body?.actualDate) || null,
      status: projectHubText(req.body?.status) || 'pending',
      note: projectHubText(req.body?.note) || null,
      createdBy: getCurrentUserId(req) || null,
    });
    const milestone = await projectRepository.findMilestoneById(id);
    await createProjectTimelineEvent(null, {
      projectId,
      eventType: 'milestone.created',
      title: `Milestone: ${title}`,
      description: projectHubText(req.body?.note) || null,
      eventDate: milestone.actualDate || milestone.plannedDate || null,
      entityType: 'ProjectMilestone',
      entityId: id,
      payload: milestone,
      createdBy: getCurrentUserId(req),
    });

    res.status(201).json(milestone);
  }));

  app.patch('/api/project-milestones/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const milestoneId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await projectRepository.findMilestoneById(milestoneId);
    if (!existing) return res.status(404).json({ error: 'Project milestone not found' });

    const title = projectHubText(req.body?.title) || existing.title || null;
    if (!title) return res.status(400).json({ error: 'title is required' });

    await projectRepository.updateMilestoneById({
      id: milestoneId,
      milestoneType: projectHubText(req.body?.milestoneType) || existing.milestoneType || null,
      title,
      plannedDate: projectHubText(req.body?.plannedDate) || existing.plannedDate || null,
      actualDate: projectHubText(req.body?.actualDate) || existing.actualDate || null,
      status: projectHubText(req.body?.status) || existing.status || 'pending',
      note: projectHubText(req.body?.note) || existing.note || null,
    });

    const milestone = await projectRepository.findMilestoneById(milestoneId);
    await createProjectTimelineEvent(null, {
      projectId: existing.projectId,
      eventType: 'milestone.updated',
      title: `Cập nhật milestone: ${title}`,
      description: projectHubText(req.body?.note) || existing.note || null,
      eventDate: milestone.actualDate || milestone.plannedDate || null,
      entityType: 'ProjectMilestone',
      entityId: milestoneId,
      payload: milestone,
      createdBy: getCurrentUserId(req),
    });

    res.json(milestone);
  }));
}
