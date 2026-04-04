import { enqueueErpEvent } from '../../../erp-sync';
import { getDb } from '../../../sqlite-db';
import { canCompleteDelivery, canStartLogisticsExecution } from '../../shared/workflow/revenueFlow';

type ProjectRepositoryLike = {
  findProjectSummaryById: (projectId: string) => Promise<any>;
  listProjectSalesOrders: (projectId: string) => Promise<any[]>;
  listDeliveryLines: (projectId: string) => Promise<any[]>;
  updateProjectStageById: (projectId: string, projectStage: string) => Promise<void>;
};

type TimelineEventFactory = (db: any, event: any) => Promise<any>;

type ReadyResult =
  | {
      ok: true;
      project: any;
      salesOrder: any;
      deliveryLines: any[];
    }
  | {
      ok: false;
      httpStatus: number;
      error: string;
      code?: string;
    };

export async function ensureDeliveryCompletionReady(projectRepository: ProjectRepositoryLike, projectId: string): Promise<ReadyResult> {
  const project = await projectRepository.findProjectSummaryById(projectId);
  if (!project) {
    return { ok: false, httpStatus: 404, error: 'Project not found', code: 'PROJECT_NOT_FOUND' };
  }

  const salesOrders = await projectRepository.listProjectSalesOrders(projectId);
  const latestSalesOrder = Array.isArray(salesOrders) ? salesOrders[0] : null;
  if (!latestSalesOrder) {
    return { ok: false, httpStatus: 409, error: 'Sales order is required before delivery completion', code: 'SALES_ORDER_REQUIRED' };
  }
  if (!canStartLogisticsExecution(latestSalesOrder.status)) {
    return { ok: false, httpStatus: 409, error: 'Sales order must be released before delivery completion', code: 'SALES_ORDER_NOT_RELEASED' };
  }

  const deliveryLines = await projectRepository.listDeliveryLines(projectId);
  const completion = canCompleteDelivery((deliveryLines || []).map((line: any) => line.status));
  if (!completion.ok) {
    const failure = 'failure' in completion ? completion.failure : { code: 'DELIVERY_NOT_COMPLETE', message: 'Delivery completion blocked' };
    return { ok: false, httpStatus: 409, error: failure.message, code: failure.code };
  }

  return {
    ok: true,
    project,
    salesOrder: latestSalesOrder,
    deliveryLines,
  };
}

export async function finalizeDeliveryCompletion(input: {
  db: any;
  projectRepository: ProjectRepositoryLike;
  projectId: string;
  actorUserId?: string | null;
  sourceApprovalId?: string | null;
  createProjectTimelineEvent?: TimelineEventFactory;
}) {
  const db = input.db || getDb();
  const ready = await ensureDeliveryCompletionReady(input.projectRepository, input.projectId);
  if (!ready.ok) return ready;

  const alreadyCompleted = String(ready.project?.projectStage || '').trim().toLowerCase() === 'delivery_completed';
  if (!alreadyCompleted) {
    await input.projectRepository.updateProjectStageById(input.projectId, 'delivery_completed');
    if (input.createProjectTimelineEvent) {
      await input.createProjectTimelineEvent(null, {
        projectId: input.projectId,
        eventType: 'delivery.completed',
        title: 'Hoàn tất giao hàng',
        description: 'Dự án đã hoàn tất toàn bộ delivery lines và sẵn sàng đóng giao hàng.',
        eventDate: new Date().toISOString(),
        entityType: 'Project',
        entityId: input.projectId,
        payload: {
          projectStage: 'delivery_completed',
          sourceApprovalId: input.sourceApprovalId || null,
        },
        createdBy: input.actorUserId || null,
      });
    }
    await enqueueErpEvent(db, {
      eventType: 'project.delivery_completed',
      entityType: 'Project',
      entityId: input.projectId,
      payload: {
        projectId: input.projectId,
        projectStage: 'delivery_completed',
        sourceApprovalId: input.sourceApprovalId || null,
      },
    });
  }

  return {
    ok: true as const,
    alreadyCompleted,
    project: await input.projectRepository.findProjectSummaryById(input.projectId),
    deliveryLines: ready.deliveryLines,
    salesOrder: ready.salesOrder,
  };
}
