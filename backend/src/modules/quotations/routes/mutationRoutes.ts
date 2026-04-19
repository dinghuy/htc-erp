import type { Request, Response } from 'express';
import {
  parseCreateProjectQuotationBody,
  parseCreateStandaloneQuotationBody,
  parseReviseQuotationBody,
  parseUpdateQuotationBody,
} from '../schemas/index';
import {
  validateCreateProjectQuotationRequest,
  validateCreateStandaloneQuotationRequest,
  validateReviseQuotationRequest,
  validateUpdateQuotationRequest,
} from '../validators/index';
import type { ExpressApp, QuotationMutationServices, RegisterQuotationSubrouteDeps } from './types';

type RegisterQuotationMutationRoutesParams = {
  app: ExpressApp;
  deps: RegisterQuotationSubrouteDeps;
  quotationMutationServices: QuotationMutationServices;
};

export function registerQuotationMutationRoutes(params: RegisterQuotationMutationRoutesParams) {
  const { app, deps, quotationMutationServices } = params;
  const { ah, requireAuth, requireRole, getCurrentUserId } = deps;

  app.post('/api/projects/:id/quotations', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const actorUserId = getCurrentUserId(req);
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parsedBody = parseCreateProjectQuotationBody(req.body);
    if (parsedBody.ok === false) {
      return res.status(parsedBody.httpStatus).json(parsedBody.payload);
    }
    const createValidation = validateCreateProjectQuotationRequest(parsedBody.normalizedBody);
    if (!createValidation.ok) {
      return res.status(400).json(createValidation);
    }
    try {
      const created = await quotationMutationServices.createProjectQuotation({
        projectId,
        body: parsedBody.normalizedBody,
        actorUserId,
      });
      if (!created) return res.status(404).json({ error: 'Project not found' });
      res.status(201).json(created);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }));

  app.post('/api/quotations', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const actorUserId = getCurrentUserId(req);
    const parsedBody = parseCreateStandaloneQuotationBody(req.body);
    if (parsedBody.ok === false) {
      return res.status(parsedBody.httpStatus).json(parsedBody.payload);
    }
    const createValidation = validateCreateStandaloneQuotationRequest(parsedBody.normalizedBody);
    if (!createValidation.ok) {
      return res.status(400).json(createValidation);
    }
    try {
      const created = await quotationMutationServices.createStandaloneQuotation({
        body: parsedBody.normalizedBody,
        actorUserId,
      });
      res.status(201).json(created);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }));

  app.put('/api/quotations/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const actorUserId = getCurrentUserId(req);
    const parsedBody = parseUpdateQuotationBody(req.body);
    if (parsedBody.ok === false) {
      return res.status(parsedBody.httpStatus).json(parsedBody.payload);
    }
    const quotationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const current = await quotationMutationServices.getQuotationForUpdate(quotationId);
    if (!current) return res.status(404).json({ error: 'Not found' });

    const validation = validateUpdateQuotationRequest({
      currentStatus: current.status,
      body: parsedBody.normalizedBody,
    });
    if (validation.ok === false) {
      return res.status(validation.httpStatus).json(validation.payload);
    }

    const updated = await quotationMutationServices.updateQuotation({
      quotationId,
      body: parsedBody.normalizedBody,
      current,
      actorUserId,
      hasStatusField: validation.hasStatusField,
      nextStatus: validation.nextStatus,
    });
    res.json(updated);
  }));

  app.post('/api/quotations/:id/revise', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const quotationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parsedBody = parseReviseQuotationBody(req.body);
    if (parsedBody.ok === false) {
      return res.status(parsedBody.httpStatus).json(parsedBody.payload);
    }
    const reviseValidation = validateReviseQuotationRequest(parsedBody.normalizedBody);
    if (reviseValidation.ok === false) {
      return res.status(reviseValidation.httpStatus).json(reviseValidation.payload);
    }
    const revised = await quotationMutationServices.reviseQuotation({
      quotationId,
      body: reviseValidation.normalizedBody,
    });
    if (!revised) return res.status(404).json({ error: 'Quotation not found' });
    res.status(201).json(revised);
  }));

  app.delete('/api/quotations/:id', requireAuth, requireRole('admin', 'manager', 'sales'), ah(async (req: Request, res: Response) => {
    const quotationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await quotationMutationServices.deleteQuotation(quotationId);
    if (!deleted) return res.status(404).json({ error: 'Quotation not found' });
    res.json({ success: true });
  }));
}
