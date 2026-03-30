import type { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createProjectRepository } from './repository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterProjectContractRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  getCurrentUserId: (req: Request) => string;
  projectHubText: (value: unknown) => string;
  projectHubNumber: (value: unknown, fallback?: number) => number;
  parseProjectHubJson: <T>(value: unknown, fallback: T) => T;
  normalizeContractLineItems: (items?: any[]) => any[];
  mapProjectContractRow: (row: any) => any;
  mapProjectAppendixRow: (row: any) => any;
  createExecutionBaselineFromSource: (db: any, params: any) => Promise<any>;
  createProjectTimelineEvent: (db: any, event: any) => Promise<any>;
  logAct: (...args: any[]) => Promise<void>;
};

export function registerProjectContractRoutes(app: Express, deps: RegisterProjectContractRoutesDeps) {
  const {
    ah,
    requireAuth,
    requireRole,
    getCurrentUserId,
    projectHubText,
    projectHubNumber,
    parseProjectHubJson,
    normalizeContractLineItems,
    mapProjectContractRow,
    mapProjectAppendixRow,
    createExecutionBaselineFromSource,
    createProjectTimelineEvent,
    logAct,
  } = deps;
  const projectRepository = createProjectRepository();

  app.post('/api/projects/:id/contracts', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await projectRepository.findProjectSummaryById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const quotationId = projectHubText(req.body?.quotationId) || null;
    if (quotationId) {
      const quotation = await projectRepository.findQuotationByIdForProject(quotationId, projectId);
      if (!quotation) return res.status(400).json({ error: 'Quotation does not belong to this project' });
    }

    const title = projectHubText(req.body?.title);
    const contractNumber = projectHubText(req.body?.contractNumber);
    if (!title && !contractNumber) {
      return res.status(400).json({ error: 'contractNumber or title is required' });
    }

    const id = uuidv4();
    const actorUserId = getCurrentUserId(req);
    const status = projectHubText(req.body?.status) || 'draft';
    const lineItems = normalizeContractLineItems(req.body?.lineItems || []);
    const signedDate = projectHubText(req.body?.signedDate) || null;
    const effectiveDate = projectHubText(req.body?.effectiveDate) || signedDate;
    const totalValue = projectHubNumber(req.body?.totalValue, lineItems.reduce((sum, item) => sum + projectHubNumber(item.lineTotal, 0), 0));

    await projectRepository.insertProjectContract({
      id,
      projectId,
      quotationId,
      contractNumber: contractNumber || null,
      title: title || null,
      signedDate,
      effectiveDate,
      status,
      currency: projectHubText(req.body?.currency) || 'VND',
      totalValue,
      summary: projectHubText(req.body?.summary) || null,
      lineItems: JSON.stringify(lineItems),
      createdBy: actorUserId || null,
    });

    const contract = mapProjectContractRow(await projectRepository.findProjectContractById(id));
    const baseline = await createExecutionBaselineFromSource(null, {
      projectId,
      sourceType: 'main_contract',
      sourceId: id,
      title: contract?.contractNumber || contract?.title || `Contract ${id.slice(0, 8)}`,
      effectiveDate,
      currency: contract?.currency,
      totalValue,
      lineItems,
      createdBy: actorUserId,
    });

    await createProjectTimelineEvent(null, {
      projectId,
      eventType: 'contract.main.created',
      title: `Tạo hợp đồng chính ${contract?.contractNumber || contract?.title || ''}`.trim(),
      description: projectHubText(req.body?.summary) || 'Hợp đồng chính đã được tạo cho dự án.',
      eventDate: effectiveDate,
      entityType: 'ProjectContract',
      entityId: id,
      payload: { contract, baseline },
      createdBy: actorUserId,
    });
    await logAct('Create project contract', `${contract?.contractNumber || contract?.title || id}`, 'Project', '📑', '#eff6ff', '#1d4ed8', projectId, 'Project');

    res.status(201).json({ ...contract, baseline });
  }));

  app.patch('/api/project-contracts/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const contractId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await projectRepository.findProjectContractById(contractId);
    if (!existing) return res.status(404).json({ error: 'Project contract not found' });
    const nextQuotationId = projectHubText(req.body?.quotationId) || existing.quotationId || null;
    if (nextQuotationId) {
      const quotation = await projectRepository.findQuotationByIdForProject(nextQuotationId, existing.projectId);
      if (!quotation) return res.status(400).json({ error: 'Quotation does not belong to this project' });
    }

    const lineItems = normalizeContractLineItems(req.body?.lineItems || parseProjectHubJson<any[]>(existing.lineItems, []));
    const signedDate = projectHubText(req.body?.signedDate) || existing.signedDate || null;
    const effectiveDate = projectHubText(req.body?.effectiveDate) || signedDate || existing.effectiveDate || null;
    const totalValue = req.body?.totalValue == null
      ? projectHubNumber(existing.totalValue, lineItems.reduce((sum, item) => sum + projectHubNumber(item.lineTotal, 0), 0))
      : projectHubNumber(req.body?.totalValue, 0);

    await projectRepository.updateProjectContractById({
      id: contractId,
      quotationId: nextQuotationId,
      contractNumber: projectHubText(req.body?.contractNumber) || existing.contractNumber || null,
      title: projectHubText(req.body?.title) || existing.title || null,
      signedDate,
      effectiveDate,
      status: projectHubText(req.body?.status) || existing.status || 'draft',
      currency: projectHubText(req.body?.currency) || existing.currency || 'VND',
      totalValue,
      summary: projectHubText(req.body?.summary) || existing.summary || null,
      lineItems: JSON.stringify(lineItems),
    });

    const actorUserId = getCurrentUserId(req);
    const contract = mapProjectContractRow(await projectRepository.findProjectContractById(contractId));
    const baseline = await createExecutionBaselineFromSource(null, {
      projectId: existing.projectId,
      sourceType: 'main_contract',
      sourceId: contractId,
      title: contract?.contractNumber || contract?.title || `Contract ${contractId.slice(0, 8)}`,
      effectiveDate,
      currency: contract?.currency,
      totalValue,
      lineItems,
      createdBy: actorUserId,
    });
    await createProjectTimelineEvent(null, {
      projectId: existing.projectId,
      eventType: 'contract.main.updated',
      title: `Cập nhật hợp đồng chính ${contract?.contractNumber || contract?.title || ''}`.trim(),
      description: projectHubText(req.body?.summary) || 'Hợp đồng chính được cập nhật và baseline đã được làm mới.',
      eventDate: effectiveDate,
      entityType: 'ProjectContract',
      entityId: contractId,
      payload: { contract, baseline },
      createdBy: actorUserId,
    });

    res.json({ ...contract, baseline });
  }));

  app.post('/api/projects/:id/contracts/:contractId/appendices', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const contractId = Array.isArray(req.params.contractId) ? req.params.contractId[0] : req.params.contractId;
    const contract = await projectRepository.findProjectContractByIdForProject(contractId, projectId);
    if (!contract) return res.status(404).json({ error: 'Project contract not found' });

    const appendixNumber = projectHubText(req.body?.appendixNumber);
    const title = projectHubText(req.body?.title);
    if (!appendixNumber && !title) {
      return res.status(400).json({ error: 'appendixNumber or title is required' });
    }

    const id = uuidv4();
    const actorUserId = getCurrentUserId(req);
    const lineItems = normalizeContractLineItems(req.body?.lineItems || parseProjectHubJson<any[]>(contract.lineItems, []));
    const signedDate = projectHubText(req.body?.signedDate) || null;
    const effectiveDate = projectHubText(req.body?.effectiveDate) || signedDate;
    const totalDeltaValue = projectHubNumber(req.body?.totalDeltaValue, 0);

    await projectRepository.insertProjectContractAppendix({
      id,
      projectId,
      contractId,
      appendixNumber: appendixNumber || null,
      title: title || null,
      signedDate,
      effectiveDate,
      status: projectHubText(req.body?.status) || 'draft',
      totalDeltaValue,
      summary: projectHubText(req.body?.summary) || null,
      lineItems: JSON.stringify(lineItems),
      createdBy: actorUserId || null,
    });

    const appendix = mapProjectAppendixRow(await projectRepository.findProjectContractAppendixById(id));
    const baseline = await createExecutionBaselineFromSource(null, {
      projectId,
      sourceType: 'appendix',
      sourceId: id,
      title: appendix?.appendixNumber || appendix?.title || `Appendix ${id.slice(0, 8)}`,
      effectiveDate,
      currency: contract.currency || 'VND',
      totalValue: projectHubNumber(contract.totalValue, 0) + totalDeltaValue,
      lineItems,
      createdBy: actorUserId,
    });

    await createProjectTimelineEvent(null, {
      projectId,
      eventType: 'contract.appendix.created',
      title: `Tạo phụ lục ${appendix?.appendixNumber || appendix?.title || ''}`.trim(),
      description: projectHubText(req.body?.summary) || 'Phụ lục đã được tạo và baseline thực thi đã cập nhật.',
      eventDate: effectiveDate,
      entityType: 'ProjectContractAppendix',
      entityId: id,
      payload: { appendix, baseline },
      createdBy: actorUserId,
    });
    await createProjectTimelineEvent(null, {
      projectId,
      eventType: 'appendix.created',
      title: `Appendix ${appendix?.appendixNumber || appendix?.title || ''}`.trim(),
      description: projectHubText(req.body?.summary) || 'Appendix created',
      eventDate: effectiveDate,
      entityType: 'ProjectContractAppendix',
      entityId: id,
      payload: { appendixId: id, baselineId: baseline?.id || null },
      createdBy: actorUserId,
    });
    await logAct('Create project appendix', `${appendix?.appendixNumber || appendix?.title || id}`, 'Project', '🧩', '#f5f3ff', '#7c3aed', projectId, 'Project');

    res.status(201).json({ ...appendix, baseline });
  }));

  app.patch('/api/project-contract-appendices/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const appendixId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await projectRepository.findProjectContractAppendixById(appendixId);
    if (!existing) return res.status(404).json({ error: 'Project appendix not found' });

    const lineItems = normalizeContractLineItems(req.body?.lineItems || parseProjectHubJson<any[]>(existing.lineItems, []));
    const signedDate = projectHubText(req.body?.signedDate) || existing.signedDate || null;
    const effectiveDate = projectHubText(req.body?.effectiveDate) || signedDate || existing.effectiveDate || null;
    const totalDeltaValue = req.body?.totalDeltaValue == null ? projectHubNumber(existing.totalDeltaValue, 0) : projectHubNumber(req.body?.totalDeltaValue, 0);

    await projectRepository.updateProjectContractAppendixById({
      id: appendixId,
      appendixNumber: projectHubText(req.body?.appendixNumber) || existing.appendixNumber || null,
      title: projectHubText(req.body?.title) || existing.title || null,
      signedDate,
      effectiveDate,
      status: projectHubText(req.body?.status) || existing.status || 'draft',
      totalDeltaValue,
      summary: projectHubText(req.body?.summary) || existing.summary || null,
      lineItems: JSON.stringify(lineItems),
    });

    const actorUserId = getCurrentUserId(req);
    const appendix = mapProjectAppendixRow(await projectRepository.findProjectContractAppendixById(appendixId));
    const contract = await projectRepository.findProjectContractById(existing.contractId);
    const baseline = await createExecutionBaselineFromSource(null, {
      projectId: existing.projectId,
      sourceType: 'appendix',
      sourceId: appendixId,
      title: appendix?.appendixNumber || appendix?.title || `Appendix ${appendixId.slice(0, 8)}`,
      effectiveDate,
      currency: contract?.currency || 'VND',
      totalValue: projectHubNumber(contract?.totalValue, 0) + totalDeltaValue,
      lineItems,
      createdBy: actorUserId,
    });
    await createProjectTimelineEvent(null, {
      projectId: existing.projectId,
      eventType: 'contract.appendix.updated',
      title: `Cập nhật phụ lục ${appendix?.appendixNumber || appendix?.title || ''}`.trim(),
      description: projectHubText(req.body?.summary) || 'Phụ lục được cập nhật và baseline thực thi đã được làm mới.',
      eventDate: effectiveDate,
      entityType: 'ProjectContractAppendix',
      entityId: appendixId,
      payload: { appendix, baseline },
      createdBy: actorUserId,
    });

    res.json({ ...appendix, baseline });
  }));
}
