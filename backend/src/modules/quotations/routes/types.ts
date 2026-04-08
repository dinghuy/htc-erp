import type { Express, Request, Response } from 'express';

export type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

export type RegisterQuotationRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth: any;
  requireRole: (...roles: string[]) => any;
  getCurrentUserId: (req: Request) => string;
  autoCreateProjectForQuotation: (db: any, payload: any, actorUserId: string | null) => Promise<string>;
  getNextQuotationRevisionNo: (db: any, projectId: string | null, parentQuotationId?: string | null) => Promise<number>;
  buildRevisionLabel: (revisionNo: number) => string;
  updateProjectStageFromQuotation: (db: any, projectId: string | null, quotationStatus: unknown, force?: boolean) => Promise<void>;
  markWinningQuotation: (db: any, quotationId: string, projectId: string | null, isWinning: boolean) => Promise<void>;
  createProjectTasksFromTemplate: (db: any, params: any) => Promise<any>;
  triggerQuotationAutomation: (
    db: any,
    quotation: any,
    status: 'submitted_for_approval' | 'won',
    actorUserId: string | null,
    extra?: { triggerSource?: string; projectId?: string | null; leadId?: string | null }
  ) => Promise<any>;
  createProjectTimelineEvent: (db: any, event: any) => Promise<any>;
  logAct: (...args: any[]) => Promise<void>;
};

export type QuotationMutationServices = {
  createProjectQuotation: (input: { projectId: string; body: any; actorUserId: string | null }) => Promise<any>;
  createStandaloneQuotation: (input: { body: any; actorUserId: string | null }) => Promise<any>;
  reviseQuotation: (input: { quotationId: string; body: any }) => Promise<any>;
  getQuotationForUpdate: (quotationId: string) => Promise<any>;
  updateQuotation: (input: {
    quotationId: string;
    body: any;
    current: any;
    actorUserId: string | null;
    hasStatusField: boolean;
    nextStatus: unknown;
  }) => Promise<any>;
  deleteQuotation: (quotationId: string) => Promise<boolean>;
};

export type QuotationRepository = {
  findById: (id: string) => Promise<any>;
  deleteById: (id: string) => Promise<void>;
  findPdfPayloadById: (id: string) => Promise<any>;
};

export type RegisterQuotationSubrouteDeps = Pick<
  RegisterQuotationRoutesDeps,
  'ah' | 'requireAuth' | 'requireRole' | 'getCurrentUserId'
>;

export type ExpressApp = Express;
