import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createProjectRepository } from './repository';
import type { AuthenticatedRequest } from '../../shared/auth/httpAuth';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProjectWriteRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  normalizeProjectStage: (value: unknown, fallback?: string) => string;
};

const PROJECT_DOCUMENT_STATUSES = ['missing', 'requested', 'pending', 'received', 'approved', 'rejected'] as const;
const PROJECT_DOCUMENT_REVIEW_STATUSES = ['draft', 'in_review', 'approved', 'changes_requested', 'archived'] as const;
const PROJECT_BLOCKER_STATUSES = ['open', 'watch', 'resolved'] as const;
const PROJECT_BLOCKER_TONES = ['warning', 'danger', 'info'] as const;

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown) {
  const normalized = stringValue(value);
  return normalized || null;
}

function normalizeProjectDocumentStatus(value: unknown, fallback = 'missing') {
  const normalized = stringValue(value).toLowerCase();
  return PROJECT_DOCUMENT_STATUSES.includes(normalized as (typeof PROJECT_DOCUMENT_STATUSES)[number]) ? normalized : fallback;
}

function normalizeProjectDocumentReviewStatus(value: unknown, fallback = 'draft') {
  const normalized = stringValue(value).toLowerCase();
  return PROJECT_DOCUMENT_REVIEW_STATUSES.includes(normalized as (typeof PROJECT_DOCUMENT_REVIEW_STATUSES)[number]) ? normalized : fallback;
}

function resolveProjectDocumentReceivedAt(
  status: string,
  requestedReceivedAt: unknown,
  existingReceivedAt?: unknown,
) {
  const normalizedRequestedReceivedAt = optionalString(requestedReceivedAt);
  const normalizedExistingReceivedAt = optionalString(existingReceivedAt);

  if (normalizedRequestedReceivedAt) {
    return normalizedRequestedReceivedAt;
  }

  if (status === 'received' || status === 'approved') {
    return normalizedExistingReceivedAt || new Date().toISOString();
  }

  return normalizedExistingReceivedAt;
}

function normalizeProjectBlockerStatus(value: unknown, fallback = 'open') {
  const normalized = stringValue(value).toLowerCase();
  return PROJECT_BLOCKER_STATUSES.includes(normalized as (typeof PROJECT_BLOCKER_STATUSES)[number]) ? normalized : fallback;
}

function normalizeProjectBlockerTone(value: unknown, fallback = 'warning') {
  const normalized = stringValue(value).toLowerCase();
  return PROJECT_BLOCKER_TONES.includes(normalized as (typeof PROJECT_BLOCKER_TONES)[number]) ? normalized : fallback;
}

function getRequestUserId(req: Request) {
  return (req as AuthenticatedRequest).user?.id || null;
}

export function registerProjectWriteRoutes(app: Express, deps: RegisterProjectWriteRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    normalizeProjectStage,
  } = deps;
  const projectRepository = createProjectRepository();

  app.post('/api/projects', requireAuth, requireRole('admin', 'manager', 'project_manager'), ah(async (req: Request, res: Response) => {
    const { code, name, description, managerId, accountId, startDate, endDate, status = 'pending', projectStage = 'new' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await projectRepository.insertProject({
      code,
      name,
      description,
      managerId,
      accountId,
      projectStage: normalizeProjectStage(projectStage, 'new'),
      startDate,
      endDate,
      status,
    });
    res.status(201).json(await projectRepository.findProjectSummaryById(result.lastID));
  }));

  app.put('/api/projects/:id', requireAuth, requireRole('admin', 'manager', 'project_manager'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await projectRepository.findProjectSummaryById(projectId);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { code, name, description, managerId, accountId, projectStage, startDate, endDate, status } = req.body;
    await projectRepository.updateProjectById({
      id: projectId,
      code,
      name,
      description,
      managerId,
      accountId,
      projectStage: normalizeProjectStage(projectStage, existing.projectStage || 'new'),
      startDate,
      endDate,
      status,
    });
    res.json(await projectRepository.findProjectSummaryById(projectId));
  }));

  app.delete('/api/projects/:id', requireAuth, requireRole('admin'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await projectRepository.deleteTasksByProjectId(projectId);
    await projectRepository.deleteProjectById(projectId);
    res.json({ success: true });
  }));

  app.post('/api/projects/:id/documents', requireAuth, requireRole('admin', 'sales', 'project_manager', 'procurement', 'accounting', 'legal', 'director', 'manager'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await projectRepository.findProjectSummaryById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const documentName = stringValue(req.body?.documentName);
    const department = stringValue(req.body?.department);
    if (!documentName) return res.status(400).json({ error: 'documentName is required' });
    if (!department) return res.status(400).json({ error: 'department is required' });

    const id = uuidv4();
    const payload = {
      id,
      projectId,
      quotationId: optionalString(req.body?.quotationId),
      documentCode: optionalString(req.body?.documentCode),
      documentName,
      category: optionalString(req.body?.category),
      department,
      status: normalizeProjectDocumentStatus(req.body?.status, 'missing'),
      requiredAtStage: optionalString(req.body?.requiredAtStage),
      note: optionalString(req.body?.note),
      receivedAt: resolveProjectDocumentReceivedAt(
        normalizeProjectDocumentStatus(req.body?.status, 'missing'),
        req.body?.receivedAt,
      ),
    };

    await projectRepository.insertProjectDocument(payload);
    await projectRepository.insertTimelineEvent({
      projectId,
      eventType: 'document.created',
      title: `Thêm checklist hồ sơ: ${documentName}`,
      description: `Trạng thái ${payload.status} · ${department}${payload.requiredAtStage ? ` · Cần tại ${payload.requiredAtStage}` : ''}`,
      eventDate: payload.receivedAt,
      entityType: 'ProjectDocument',
      entityId: id,
      payload: JSON.stringify(payload),
      createdBy: getRequestUserId(req),
    });

    res.status(201).json(await projectRepository.findProjectDocumentById(id));
  }));

  app.patch('/api/project-documents/:id', requireAuth, requireRole('admin', 'sales', 'project_manager', 'procurement', 'accounting', 'legal', 'director', 'manager'), ah(async (req: Request, res: Response) => {
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await projectRepository.findProjectDocumentById(documentId);
    if (!existing) return res.status(404).json({ error: 'Project document not found' });

    const payload = {
      id: documentId,
      quotationId: optionalString(req.body?.quotationId ?? existing.quotationId),
      documentCode: optionalString(req.body?.documentCode ?? existing.documentCode),
      documentName: stringValue(req.body?.documentName ?? existing.documentName),
      category: optionalString(req.body?.category ?? existing.category),
      department: stringValue(req.body?.department ?? existing.department),
      status: normalizeProjectDocumentStatus(req.body?.status, normalizeProjectDocumentStatus(existing.status, 'missing')),
      requiredAtStage: optionalString(req.body?.requiredAtStage ?? existing.requiredAtStage),
      note: optionalString(req.body?.note ?? existing.note),
      receivedAt: resolveProjectDocumentReceivedAt(
        normalizeProjectDocumentStatus(req.body?.status, normalizeProjectDocumentStatus(existing.status, 'missing')),
        req.body?.receivedAt,
        existing.receivedAt,
      ),
    };

    if (!payload.documentName) return res.status(400).json({ error: 'documentName is required' });
    if (!payload.department) return res.status(400).json({ error: 'department is required' });

    await projectRepository.updateProjectDocumentById(payload);
    await projectRepository.insertTimelineEvent({
      projectId: existing.projectId,
      eventType: 'document.updated',
      title: `Cập nhật checklist hồ sơ: ${payload.documentName}`,
      description: `Trạng thái ${payload.status} · ${payload.department}${payload.requiredAtStage ? ` · Cần tại ${payload.requiredAtStage}` : ''}`,
      eventDate: payload.receivedAt,
      entityType: 'ProjectDocument',
      entityId: documentId,
      payload: JSON.stringify(payload),
      createdBy: getRequestUserId(req),
    });

    res.json(await projectRepository.findProjectDocumentById(documentId));
  }));

  app.patch('/api/project-documents/:id/review-state', requireAuth, requireRole('admin', 'sales', 'project_manager', 'procurement', 'accounting', 'legal', 'director', 'manager'), ah(async (req: Request, res: Response) => {
    const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await projectRepository.findProjectDocumentById(documentId);
    if (!existing) return res.status(404).json({ error: 'Project document not found' });

    const reviewStatus = normalizeProjectDocumentReviewStatus(req.body?.reviewStatus, normalizeProjectDocumentReviewStatus(existing.reviewStatus, 'draft'));
    const reviewerUserId = optionalString(req.body?.reviewerUserId) || getRequestUserId(req);
    const reviewNote = optionalString(req.body?.reviewNote);
    const storageKey = optionalString(req.body?.storageKey);
    const threadId = optionalString(req.body?.threadId ?? existing.threadId);
    const reviewedAt = req.body?.reviewStatus !== undefined ? new Date().toISOString() : existing.reviewedAt || null;

    await projectRepository.updateProjectDocumentReviewStateById({
      id: documentId,
      reviewStatus,
      reviewerUserId,
      reviewedAt,
      reviewNote,
      storageKey,
      threadId,
    });
    await projectRepository.insertTimelineEvent({
      projectId: existing.projectId,
      eventType: 'document.review_state_updated',
      title: `Cập nhật review state: ${existing.documentName || existing.documentCode || documentId}`,
      description: `Review ${reviewStatus}${reviewNote ? ` · ${reviewNote}` : ''}`,
      eventDate: reviewedAt,
      entityType: 'ProjectDocument',
      entityId: documentId,
      payload: JSON.stringify({
        reviewStatus,
        reviewerUserId,
        reviewNote,
        storageKey,
        threadId,
      }),
      createdBy: getRequestUserId(req),
    });

    res.json(await projectRepository.findProjectDocumentById(documentId));
  }));

  app.post('/api/projects/:id/blockers', requireAuth, requireRole('admin', 'sales', 'project_manager', 'procurement', 'accounting', 'legal', 'director', 'manager'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await projectRepository.findProjectSummaryById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const title = stringValue(req.body?.title);
    if (!title) return res.status(400).json({ error: 'title is required' });

    const id = uuidv4();
    const payload = {
      id,
      projectId,
      source: optionalString(req.body?.source) || 'manual',
      category: optionalString(req.body?.category) || 'workflow',
      ownerRole: optionalString(req.body?.ownerRole),
      status: normalizeProjectBlockerStatus(req.body?.status, 'open'),
      tone: normalizeProjectBlockerTone(req.body?.tone, 'warning'),
      title,
      detail: optionalString(req.body?.detail),
      action: optionalString(req.body?.action),
      linkedEntityType: optionalString(req.body?.linkedEntityType),
      linkedEntityId: optionalString(req.body?.linkedEntityId),
      createdBy: getRequestUserId(req),
    };

    await projectRepository.insertProjectBlocker(payload);
    await projectRepository.insertTimelineEvent({
      projectId,
      eventType: 'blocker.created',
      title: `Thêm blocker: ${title}`,
      description: `${payload.category} · ${payload.status}${payload.ownerRole ? ` · owner ${payload.ownerRole}` : ''}`,
      entityType: 'ProjectBlocker',
      entityId: id,
      payload: JSON.stringify(payload),
      createdBy: getRequestUserId(req),
    });

    res.status(201).json(await projectRepository.findProjectBlockerById(id));
  }));

  app.patch('/api/project-blockers/:id', requireAuth, requireRole('admin', 'sales', 'project_manager', 'procurement', 'accounting', 'legal', 'director', 'manager'), ah(async (req: Request, res: Response) => {
    const blockerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await projectRepository.findProjectBlockerById(blockerId);
    if (!existing) return res.status(404).json({ error: 'Project blocker not found' });

    const nextStatus = normalizeProjectBlockerStatus(req.body?.status, normalizeProjectBlockerStatus(existing.status, 'open'));
    const payload = {
      id: blockerId,
      source: optionalString(req.body?.source ?? existing.source) || 'manual',
      category: optionalString(req.body?.category ?? existing.category) || 'workflow',
      ownerRole: optionalString(req.body?.ownerRole ?? existing.ownerRole),
      status: nextStatus,
      tone: normalizeProjectBlockerTone(req.body?.tone, normalizeProjectBlockerTone(existing.tone, 'warning')),
      title: stringValue(req.body?.title ?? existing.title),
      detail: optionalString(req.body?.detail ?? existing.detail),
      action: optionalString(req.body?.action ?? existing.action),
      linkedEntityType: optionalString(req.body?.linkedEntityType ?? existing.linkedEntityType),
      linkedEntityId: optionalString(req.body?.linkedEntityId ?? existing.linkedEntityId),
      resolvedAt: nextStatus === 'resolved' ? new Date().toISOString() : null,
      resolvedBy: nextStatus === 'resolved' ? getRequestUserId(req) : null,
    };

    if (!payload.title) return res.status(400).json({ error: 'title is required' });

    await projectRepository.updateProjectBlockerById(payload);
    await projectRepository.insertTimelineEvent({
      projectId: existing.projectId,
      eventType: 'blocker.updated',
      title: `Cập nhật blocker: ${payload.title}`,
      description: `${payload.category} · ${payload.status}${payload.ownerRole ? ` · owner ${payload.ownerRole}` : ''}`,
      entityType: 'ProjectBlocker',
      entityId: blockerId,
      payload: JSON.stringify(payload),
      createdBy: getRequestUserId(req),
    });

    res.json(await projectRepository.findProjectBlockerById(blockerId));
  }));
}
