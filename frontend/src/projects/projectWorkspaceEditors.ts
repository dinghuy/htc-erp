function safeNumber(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function buildDocumentChecklistEditorState(value: any, requiredAtStage?: string) {
  return {
    id: value?.id,
    quotationId: value?.quotationId || '',
    documentCode: value?.documentCode || '',
    documentName: value?.documentName || value?.title || '',
    category: value?.category || '',
    department: value?.department || '',
    status: value?.status || 'missing',
    requiredAtStage: value?.requiredAtStage || requiredAtStage || '',
    receivedAt: value?.receivedAt || '',
    note: value?.note || '',
    reviewStatus: value?.reviewStatus || 'draft',
    reviewerUserId: value?.reviewerUserId || '',
    reviewNote: value?.reviewNote || '',
    storageKey: value?.storageKey || '',
    threadId: value?.threadId || '',
  };
}

export function buildBlockerEditorState(value: any) {
  return {
    id: value?.id,
    source: value?.source || 'manual',
    category: value?.category || 'workflow',
    ownerRole: value?.ownerRole || '',
    status: value?.status || 'open',
    tone: value?.tone || 'warning',
    title: value?.title || '',
    detail: value?.detail || '',
    action: value?.action || '',
    linkedEntityType: value?.linkedEntityType || '',
    linkedEntityId: value?.linkedEntityId || '',
  };
}

export function buildInboundEditorState(line: any) {
  return {
    procurementLineId: line.id,
    receivedQty: Math.max(safeNumber(line.orderedQty) - safeNumber(line.receivedQty), 0),
    etaDate: line.etaDate || '',
    actualReceivedDate: '',
    status: safeNumber(line.shortageQty) > 0 ? 'partial' : 'completed',
    receiptRef: '',
    note: '',
  };
}

export function buildDeliveryEditorState(line: any) {
  return {
    procurementLineId: line.id,
    deliveredQty: Math.max(safeNumber(line.receivedQty) - safeNumber(line.deliveredQty), 0),
    committedDate: line.committedDeliveryDate || '',
    actualDeliveryDate: '',
    status: safeNumber(line.shortageQty) > 0 ? 'partial' : 'completed',
    deliveryRef: '',
    note: '',
  };
}
