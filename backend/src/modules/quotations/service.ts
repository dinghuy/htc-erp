import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../../sqlite-db';
import { enqueueErpEvent } from '../../../erp-sync';
import { isApprovalSubmissionStatus, isWinningQuotationStatus, normalizeQuotationInputStatus } from '../../../quotation-status';
import { createQuotationRepository } from './repository';
import { mapProjectQuotationInput, mapReviseQuotationInput, mapStandaloneQuotationInput, mapUpdateQuotationInput } from './mapper';

type CreateQuotationMutationServicesDeps = {
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

export function createQuotationMutationServices(deps: CreateQuotationMutationServicesDeps) {
  const {
    autoCreateProjectForQuotation,
    getNextQuotationRevisionNo,
    buildRevisionLabel,
    updateProjectStageFromQuotation,
    markWinningQuotation,
    createProjectTasksFromTemplate,
    triggerQuotationAutomation,
    createProjectTimelineEvent,
    logAct,
  } = deps;
  const quotationRepository = createQuotationRepository();

  async function createProjectQuotation(input: {
    projectId: string;
    body: any;
    actorUserId: string | null;
  }) {
    const db = getDb();
    const project = await db.get('SELECT * FROM Project WHERE id = ?', [input.projectId]);
    if (!project) return null;

    const id = uuidv4();
    const mapped = mapProjectQuotationInput({
      body: input.body,
      projectId: input.projectId,
      projectAccountId: project.accountId || null,
    });
    const {
      quoteNumber,
      quoteDate,
      subject,
      accountId,
      contactId,
      salesperson,
      salespersonPhone,
      currency,
      opportunityId,
      items,
      financialParams,
      terms,
      validUntil,
      parentQuotationId,
      requestedRevisionNo,
      revisionLabel,
      changeReason,
      projectId,
      finalStatus,
      normalizedSubtotal,
      normalizedTaxTotal,
      normalizedGrandTotal,
    } = mapped;
    const nextRevisionNo = Number.isFinite(Number(requestedRevisionNo ?? NaN))
      ? Number(requestedRevisionNo)
      : await getNextQuotationRevisionNo(db, projectId, parentQuotationId || null);
    const finalRevisionLabel = typeof revisionLabel === 'string' && revisionLabel.trim()
      ? revisionLabel.trim()
      : buildRevisionLabel(nextRevisionNo);

    await quotationRepository.insert({
      id,
      quoteNumber,
      quoteDate: quoteDate || new Date().toISOString().slice(0, 10),
      subject,
      accountId,
      contactId,
      projectId,
      salesperson,
      salespersonPhone,
      currency,
      opportunityId: opportunityId || null,
      revisionNo: nextRevisionNo,
      revisionLabel: finalRevisionLabel,
      parentQuotationId: parentQuotationId || null,
      changeReason: changeReason || null,
      isWinningVersion: 0,
      items: JSON.stringify(items || []),
      financialParams: JSON.stringify(financialParams || {}),
      terms: JSON.stringify(terms || {}),
      subtotal: normalizedSubtotal,
      taxTotal: normalizedTaxTotal,
      grandTotal: normalizedGrandTotal,
      status: finalStatus,
      validUntil,
    });

    const created = await quotationRepository.findById(id);
    await updateProjectStageFromQuotation(db, projectId, finalStatus);
    if (isWinningQuotationStatus(finalStatus)) {
      await markWinningQuotation(db, id, projectId, true);
      await createProjectTasksFromTemplate(db, {
        projectId,
        templateKey: 'quotation-accepted',
        quotation: created,
        actorUserId: input.actorUserId,
      });
      if (projectId) {
        await createProjectTimelineEvent(db, {
          projectId,
          eventType: 'handoff_started',
          title: 'Handoff started',
          description: `Quotation ${created?.quoteNumber || id} entered won state and is ready for execution handoff.`,
          eventDate: new Date().toISOString(),
          entityType: 'Quotation',
          entityId: id,
          payload: {
            quotationId: id,
            quoteNumber: created?.quoteNumber || null,
            source: 'quotation_create',
          },
          createdBy: input.actorUserId,
        });
      }
    }
    if (isApprovalSubmissionStatus(finalStatus) || isWinningQuotationStatus(finalStatus)) {
      await triggerQuotationAutomation(db, created, isWinningQuotationStatus(finalStatus) ? 'won' : 'submitted_for_approval', input.actorUserId, {
        projectId,
      });
    }

    return created;
  }

  async function createStandaloneQuotation(input: {
    body: any;
    actorUserId: string | null;
  }) {
    const db = getDb();
    const id = uuidv4();
    const mapped = mapStandaloneQuotationInput(input.body);
    const {
      quoteNumber,
      quoteDate,
      subject,
      accountId,
      contactId,
      salesperson,
      salespersonPhone,
      currency,
      opportunityId,
      items,
      financialParams,
      terms,
      validUntil,
      parentQuotationId,
      requestedRevisionNo,
      revisionLabel,
      changeReason,
      projectName,
      projectStage,
      projectStatus,
      autoCreateProject,
      finalStatus,
      normalizedSubtotal,
      normalizedTaxTotal,
      normalizedGrandTotal,
    } = mapped;

    let { projectId } = mapped;
    if (!projectId && autoCreateProject) {
      projectId = await autoCreateProjectForQuotation(db, {
        quoteNumber,
        quoteDate,
        subject: projectName || subject,
        projectCode: quoteNumber,
        projectDescription: subject,
        accountId,
        salesperson,
        projectStage,
        projectStatus,
      }, input.actorUserId);
    }

    const nextRevisionNo = Number.isFinite(Number(requestedRevisionNo ?? NaN))
      ? Number(requestedRevisionNo)
      : await getNextQuotationRevisionNo(db, projectId, parentQuotationId || null);
    const finalRevisionLabel = typeof revisionLabel === 'string' && revisionLabel.trim()
      ? revisionLabel.trim()
      : buildRevisionLabel(nextRevisionNo);

    await quotationRepository.insert({
      id,
      quoteNumber,
      quoteDate: quoteDate || new Date().toISOString().slice(0, 10),
      subject,
      accountId,
      contactId,
      projectId,
      salesperson,
      salespersonPhone,
      currency,
      opportunityId: opportunityId || null,
      revisionNo: nextRevisionNo,
      revisionLabel: finalRevisionLabel,
      parentQuotationId: parentQuotationId || null,
      changeReason: changeReason || null,
      isWinningVersion: 0,
      items: JSON.stringify(items || []),
      financialParams: JSON.stringify(financialParams || {}),
      terms: JSON.stringify(terms || {}),
      subtotal: normalizedSubtotal,
      taxTotal: normalizedTaxTotal,
      grandTotal: normalizedGrandTotal,
      status: finalStatus,
      validUntil,
    });

    await logAct(
      'Tạo Báo giá',
      `Số hiệu: ${quoteNumber} - Tổng: ${normalizedGrandTotal.toLocaleString()} ${currency}`,
      'Quotation',
      '📄',
      '#e0f2fe',
      '#0284c7',
      id,
      'Quotation'
    );

    const created = await quotationRepository.findById(id);
    await updateProjectStageFromQuotation(db, projectId, finalStatus);
    if (isWinningQuotationStatus(finalStatus)) {
      await markWinningQuotation(db, id, projectId, true);
    }

    if (isApprovalSubmissionStatus(finalStatus) || isWinningQuotationStatus(finalStatus)) {
      await triggerQuotationAutomation(db, created, isWinningQuotationStatus(finalStatus) ? 'won' : 'submitted_for_approval', input.actorUserId, { projectId });
    }
    if (isWinningQuotationStatus(finalStatus)) {
      try {
        await enqueueErpEvent(db, {
          eventType: 'sales_order.request',
          entityType: 'Quotation',
          entityId: id,
          payload: { quotationId: id, quoteNumber: created?.quoteNumber || null },
        });
      } catch {
        // Never block CRM write-path if ERP is temporarily down or misconfigured.
      }
    }
    if (projectId && isWinningQuotationStatus(finalStatus)) {
      await createProjectTasksFromTemplate(db, {
        projectId,
        templateKey: 'quotation-accepted',
        quotation: created,
        actorUserId: input.actorUserId,
      });
      await createProjectTimelineEvent(db, {
        projectId,
        eventType: 'handoff_started',
        title: 'Handoff started',
        description: `Quotation ${created?.quoteNumber || id} entered won state and is ready for execution handoff.`,
        eventDate: new Date().toISOString(),
        entityType: 'Quotation',
        entityId: id,
        payload: {
          quotationId: id,
          quoteNumber: created?.quoteNumber || null,
          source: 'quotation_create',
        },
        createdBy: input.actorUserId,
      });
    }

    return created;
  }

  async function reviseQuotation(input: {
    quotationId: string;
    body: any;
  }) {
    const db = getDb();
    const source = await quotationRepository.findById(input.quotationId);
    if (!source) return null;

    const revisionNo = await getNextQuotationRevisionNo(db, source.projectId || null, source.id);
    const id = uuidv4();
    const mappedRevision = mapReviseQuotationInput({
      source,
      body: input.body,
      id,
      revisionNo,
      buildRevisionLabel,
    });
    await quotationRepository.insert(mappedRevision);

    return quotationRepository.findById(id);
  }

  async function updateQuotation(input: {
    quotationId: string;
    body: any;
    current: any;
    actorUserId: string | null;
    hasStatusField: boolean;
    nextStatus: unknown;
  }) {
    const db = getDb();
    const mappedUpdate = mapUpdateQuotationInput({
      body: input.body,
      current: input.current,
      nextStatus: input.nextStatus,
      buildRevisionLabel,
    });

    await quotationRepository.updateById(input.quotationId, mappedUpdate);

    if (input.hasStatusField && input.nextStatus && input.nextStatus !== input.current.status) {
      await logAct(
        'Cập nhật trạng thái báo giá',
        `${input.current.status} -> ${input.nextStatus}`,
        'Quotation',
        '🔁',
        '#e0f2fe',
        '#0284c7',
        input.quotationId,
        'Quotation'
      );
    }

    const updated = await quotationRepository.findById(input.quotationId);

    const normalizedNextStatus = normalizeQuotationInputStatus(String(input.nextStatus));
    if (input.hasStatusField && isWinningQuotationStatus(normalizedNextStatus) && input.nextStatus !== input.current.status) {
      try {
        await enqueueErpEvent(db, {
          eventType: 'sales_order.request',
          entityType: 'Quotation',
          entityId: input.quotationId,
          payload: { quotationId: input.quotationId, quoteNumber: updated?.quoteNumber || null },
        });
      } catch {
        // Ignore ERP sync errors on CRM write-path.
      }
    }
    if (input.hasStatusField && (isApprovalSubmissionStatus(normalizedNextStatus) || isWinningQuotationStatus(normalizedNextStatus)) && input.nextStatus !== input.current.status) {
      await triggerQuotationAutomation(
        db,
        updated,
        isWinningQuotationStatus(normalizedNextStatus) ? 'won' : 'submitted_for_approval',
        input.actorUserId,
        {
          projectId: updated.projectId || input.current.projectId || null,
        },
      );
    }
    await updateProjectStageFromQuotation(db, updated.projectId || input.current.projectId || null, input.nextStatus);
    if (isWinningQuotationStatus(String(input.nextStatus))) {
      await markWinningQuotation(db, input.quotationId, updated.projectId || input.current.projectId || null, true);
      if (updated.projectId || input.current.projectId) {
        await createProjectTasksFromTemplate(db, {
          projectId: updated.projectId || input.current.projectId,
          templateKey: 'quotation-accepted',
          quotation: updated,
          actorUserId: input.actorUserId,
        });
        await createProjectTimelineEvent(db, {
          projectId: updated.projectId || input.current.projectId,
          eventType: 'handoff_started',
          title: 'Handoff started',
          description: `Quotation ${updated?.quoteNumber || input.quotationId} entered won state and is ready for execution handoff.`,
          eventDate: new Date().toISOString(),
          entityType: 'Quotation',
          entityId: input.quotationId,
          payload: {
            quotationId: input.quotationId,
            quoteNumber: updated?.quoteNumber || null,
            source: 'quotation_update',
          },
          createdBy: input.actorUserId,
        });
      }
    } else if (input.hasStatusField && input.current.isWinningVersion && !isWinningQuotationStatus(String(input.nextStatus))) {
      await markWinningQuotation(db, input.quotationId, updated.projectId || input.current.projectId || null, false);
    }

    return updated;
  }

  return {
    createProjectQuotation,
    createStandaloneQuotation,
    reviseQuotation,
    updateQuotation,
  };
}
