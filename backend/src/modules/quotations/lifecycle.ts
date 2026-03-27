export function deriveProjectStageFromQuotationStatus(status: unknown): string | null {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (normalized === 'draft') return 'quoting';
  if (normalized === 'submitted_for_approval' || normalized === 'revision_required') return 'negotiating';
  if (normalized === 'approved') return 'commercial_approved';
  if (normalized === 'won') return 'won';
  if (normalized === 'lost' || normalized === 'rejected') return 'lost';
  if (normalized === 'sent') return 'negotiating';
  if (normalized === 'accepted') return 'won';
  return null;
}

export function buildRevisionLabel(revisionNo: number) {
  return `R${revisionNo}`;
}

export async function getNextQuotationRevisionNo(db: any, projectId: string | null, parentQuotationId?: string | null) {
  if (projectId) {
    const row = await db.get(`SELECT COALESCE(MAX(revisionNo), 0) AS maxRevisionNo FROM Quotation WHERE projectId = ?`, [projectId]);
    return Number(row?.maxRevisionNo || 0) + 1;
  }
  if (parentQuotationId) {
    const row = await db.get(`SELECT COALESCE(MAX(revisionNo), 0) AS maxRevisionNo FROM Quotation WHERE id = ? OR parentQuotationId = ?`, [parentQuotationId, parentQuotationId]);
    return Number(row?.maxRevisionNo || 0) + 1;
  }
  return 1;
}

export async function updateProjectStageFromQuotation(db: any, projectId: string | null, quotationStatus: unknown, force = false) {
  if (!projectId) return;
  const targetStage = deriveProjectStageFromQuotationStatus(quotationStatus);
  if (!targetStage) return;
  const project = await db.get(`SELECT id, projectStage FROM Project WHERE id = ?`, [projectId]);
  if (!project) return;
  const currentStage = typeof project.projectStage === 'string' ? project.projectStage.trim().toLowerCase() || 'new' : 'new';
  if (!force && ['order_released', 'procurement_active', 'delivery_active', 'delivery_completed', 'delivery', 'closed'].includes(currentStage)) {
    return;
  }
  if (currentStage === targetStage) return;
  await db.run(`UPDATE Project SET projectStage = ?, updatedAt = datetime('now') WHERE id = ?`, [targetStage, projectId]);
}

export async function markWinningQuotation(db: any, quotationId: string, projectId: string | null, isWinning: boolean) {
  if (!projectId) {
    await db.run(`UPDATE Quotation SET isWinningVersion = ? WHERE id = ?`, [isWinning ? 1 : 0, quotationId]);
    return;
  }
  if (isWinning) {
    await db.run(`UPDATE Quotation SET isWinningVersion = 0 WHERE projectId = ?`, [projectId]);
  }
  await db.run(`UPDATE Quotation SET isWinningVersion = ? WHERE id = ?`, [isWinning ? 1 : 0, quotationId]);
}
