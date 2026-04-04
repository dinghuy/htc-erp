import type { Express, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../shared/auth/httpAuth';
import { createProjectRepository } from './repository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProjectReadRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  getProjectWorkspaceById: (db: any, projectId: string, currentUser?: any) => Promise<any>;
};

export function registerProjectReadRoutes(app: Express, deps: RegisterProjectReadRoutesDeps) {
  const {
    ah,
    requireAuth,
    getProjectWorkspaceById,
  } = deps;
  const projectRepository = createProjectRepository();

  function normalizeProjectActivitySource(value: unknown) {
    const normalized = String(value || '').trim().toLowerCase();
    return ['activity', 'timeline', 'approval', 'all'].includes(normalized) ? normalized : 'all';
  }

  app.get('/api/projects', requireAuth, ah(async (req: Request, res: Response) => {
    const { accountId, managerId, status, startDateFrom, startDateTo, endDateFrom, endDateTo } = req.query as Record<string, string | undefined>;
    const rows = await projectRepository.listProjects({
      accountId,
      managerId,
      status,
      startDateFrom,
      startDateTo,
      endDateFrom,
      endDateTo,
    });
    const enrichedRows = await Promise.all(rows.map(async (row: any) => {
      const workspace = await getProjectWorkspaceById(null, row.id, (req as AuthenticatedRequest).user).catch(() => null);
      return {
        ...row,
        approvalGateStates: Array.isArray(workspace?.approvalGateStates) ? workspace.approvalGateStates : [],
        actionAvailability: workspace?.actionAvailability || null,
        handoffActivation: workspace?.handoffActivation || null,
        pendingApproverState: Array.isArray(workspace?.pendingApproverState) ? workspace.pendingApproverState : [],
      };
    }));
    res.json(enrichedRows);
  }));

  app.get('/api/projects/:id', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await getProjectWorkspaceById(null, projectId, req.user);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  }));

  app.get('/api/v1/projects/:id/workspace', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await getProjectWorkspaceById(null, projectId, req.user);
    if (!project) return res.status(404).json({ error: 'Not found' });

    const tasks = Array.isArray(project.tasks) ? project.tasks : [];
    const milestones = Array.isArray(project.milestones) ? project.milestones : [];
    const approvalGateStates = Array.isArray(project.approvalGateStates) ? project.approvalGateStates : [];
    const auditTrail = Array.isArray(project.auditTrail) ? project.auditTrail : [];
    const phaseControl = project.phaseControl || {};
    const blockedTaskCount = tasks.filter((task: any) => String(task?.blockedReason || '').trim()).length;
    const activeTaskCount = tasks.filter((task: any) => String(task?.status || '').toLowerCase() === 'active').length;
    const overdueTaskCount = tasks.filter((task: any) => {
      const dueDate = String(task?.dueDate || '').trim();
      return Boolean(dueDate) && dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10) && String(task?.status || '').toLowerCase() !== 'completed';
    }).length;
    const completedMilestones = milestones.filter((milestone: any) => String(milestone?.status || '').toLowerCase() === 'completed').length;
    const overdueMilestones = milestones.filter((milestone: any) => {
      const targetDate = String(milestone?.targetDate || milestone?.plannedDate || '').trim();
      return Boolean(targetDate) && targetDate.slice(0, 10) < new Date().toISOString().slice(0, 10) && String(milestone?.status || '').toLowerCase() !== 'completed';
    }).length;
    const stage = String(project.projectStage || '').toLowerCase();
    const hasDeliverySignal =
      ['delivery_active', 'delivery', 'delivery_completed', 'closed'].includes(stage) ||
      tasks.some((task: any) => ['delivery_handoff', 'delivery', 'inbound'].includes(String(task?.taskType || '').toLowerCase()));
    const hasProcurementSignal =
      ['order_released', 'procurement_active'].includes(stage) ||
      tasks.some((task: any) => ['procurement', 'supplier', 'procurement_follow_up'].includes(String(task?.taskType || '').toLowerCase()));
    const hasCommercialSignal =
      ['quoting', 'negotiating', 'internal-review', 'commercial_approved', 'won'].includes(stage) ||
      tasks.some((task: any) => ['handoff', 'quotation', 'commercial'].includes(String(task?.taskType || '').toLowerCase()));

    const activeTab = hasDeliverySignal
      ? 'delivery'
      : hasProcurementSignal
        ? 'procurement'
        : hasCommercialSignal
          ? 'commercial'
          : phaseControl.items?.find((item: any) => item.action)?.action === 'openTasks'
            ? 'timeline'
            : 'overview';

    const resolveLaneKey = (gateType: string) => {
      if (gateType === 'quotation_commercial') return 'commercial';
      if (gateType === 'sales_order_release') return 'commercial';
      if (gateType === 'procurement_commitment') return 'procurement';
      if (gateType === 'delivery_release' || gateType === 'delivery_completion') return 'delivery';
      return gateType;
    };

    const byLane = approvalGateStates.reduce((acc: Record<string, number>, gate: any) => {
      if (gate?.pendingCount > 0 && gate?.gateType) {
        const laneKey = resolveLaneKey(String(gate.gateType));
        acc[laneKey] =
          (acc[laneKey] || 0) + Number(gate.pendingCount || 0);
      }
      return acc;
    }, {});

    const recentActivities = auditTrail.slice(0, 5).map((item: any) => ({
      id: item.id,
      projectId,
      entityType: item.entityType || item.linkedEntityType || 'Project',
      entityId: item.entityId || item.linkedEntityId || projectId,
      activityType:
        (item.source === 'activity' ? item.title : null) ||
        item.action ||
        item.source ||
        item.category ||
        'activity',
      title: item.title,
      body: item.detail || null,
      link: item.linkedEntityType || item.source || null,
      taskId: item.entityType === 'Task' ? item.entityId : null,
      approvalRequestId: item.entityType === 'ApprovalRequest' ? item.entityId : null,
      createdAt: item.eventDate || item.createdAt || null,
      updatedAt: item.eventDate || item.createdAt || null,
      createdBy: item.actor || null,
    }));

    res.json({
      id: project.id,
      projectId,
      quotationId: project.latestQuotationId || null,
      accountId: project.accountId || null,
      projectStage: project.projectStage || null,
      activeTab,
      taskSummary: {
        total: tasks.length,
        active: activeTaskCount,
        blocked: blockedTaskCount,
        overdue: overdueTaskCount,
      },
      approvalSummary: {
        pending: approvalGateStates.reduce((sum: number, gate: any) => sum + Number(gate?.pendingCount || 0), 0),
        byLane,
      },
      handoffActivation: project.handoffActivation || null,
      milestoneSummary: {
        total: milestones.length,
        completed: completedMilestones,
        overdue: overdueMilestones,
      },
      recentActivities,
      createdAt: project.createdAt || null,
      updatedAt: project.updatedAt || null,
      createdBy: null,
      updatedBy: null,
    });
  }));

  app.get('/api/v1/projects/:id/activities', requireAuth, ah(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await getProjectWorkspaceById(null, projectId, req.user);
    if (!project) return res.status(404).json({ error: 'Not found' });

    const query = req.query as Record<string, string | undefined>;
    const limit = Math.max(1, Math.min(Number(query.limit || 25) || 25, 200));
    const source = normalizeProjectActivitySource(query.source);
    const auditTrail = Array.isArray(project.auditTrail) ? project.auditTrail : [];
    const items = auditTrail
      .filter((item: any) => source === 'all' || String(item?.source || '').toLowerCase() === source)
      .slice(0, limit)
      .map((item: any) => ({
        id: item.id,
        projectId,
        source: item.source || 'activity',
        entityType: item.entityType || item.linkedEntityType || 'Project',
        entityId: item.entityId || item.linkedEntityId || projectId,
        linkedEntityType: item.linkedEntityType || null,
        linkedEntityId: item.linkedEntityId || null,
        activityType: item.action || item.category || item.source || 'activity',
        title: item.title || item.action || item.category || 'Activity',
        body: item.detail || null,
        actor: item.actor || null,
        status: item.status || null,
        createdAt: item.eventDate || item.createdAt || null,
        updatedAt: item.eventDate || item.createdAt || null,
      }));

    const bySource = items.reduce((acc: Record<string, number>, item: any) => {
      const key = String(item.source || 'activity').toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    res.json({
      items,
      summary: {
        total: items.length,
        bySource,
      },
    });
  }));
}
