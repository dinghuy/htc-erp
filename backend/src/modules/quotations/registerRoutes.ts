import type { Express } from 'express';
import { createQuotationRepository } from './repository';
import { createQuotationMutationServices } from './service';
import { registerQuotationMutationRoutes } from './routes/mutationRoutes';
import { registerQuotationPdfRoutes } from './routes/pdfRoutes';
import { registerQuotationReadRoutes } from './routes/readRoutes';
import type { RegisterQuotationRoutesDeps } from './routes/types';

export function registerQuotationRoutes(app: Express, deps: RegisterQuotationRoutesDeps) {
  const quotationMutationServices = createQuotationMutationServices({
    autoCreateProjectForQuotation: deps.autoCreateProjectForQuotation,
    getNextQuotationRevisionNo: deps.getNextQuotationRevisionNo,
    buildRevisionLabel: deps.buildRevisionLabel,
    updateProjectStageFromQuotation: deps.updateProjectStageFromQuotation,
    markWinningQuotation: deps.markWinningQuotation,
    createProjectTasksFromTemplate: deps.createProjectTasksFromTemplate,
    triggerQuotationAutomation: deps.triggerQuotationAutomation,
    createProjectTimelineEvent: deps.createProjectTimelineEvent,
    logAct: deps.logAct,
  });
  const quotationRepository = createQuotationRepository();

  registerQuotationMutationRoutes({
    app,
    deps,
    quotationMutationServices,
    quotationRepository,
  });
  registerQuotationReadRoutes(app, deps);
  registerQuotationPdfRoutes({
    app,
    deps,
    quotationRepository,
  });
}
