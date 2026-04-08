import { buildWorkspacePhaseReadiness } from './workspacePhaseReadiness';
import { buildWorkspaceSummaryKpis } from './workspaceSummaryData';

function ensureArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function formatDateValue(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('vi-VN');
}

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPastDate(value?: string | null) {
  const parsed = parseDateValue(value);
  if (!parsed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime() < today.getTime();
}

function numberValue(value: any) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function statusLabel(status?: string | null) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active') return 'Đang chạy';
  if (normalized === 'completed') return 'Hoàn tất';
  if (normalized === 'signed') return 'Đã ký';
  if (normalized === 'effective') return 'Hiệu lực';
  if (normalized === 'paused') return 'Tạm dừng';
  if (normalized === 'partial') return 'Một phần';
  if (normalized === 'cancelled') return 'Đã hủy';
  if (normalized === 'rejected') return 'Bị từ chối';
  if (normalized === 'pending') return 'Đang chờ';
  return status || 'Chưa cập nhật';
}

type BuildProjectWorkspaceViewModelArgs = {
  workspace: any;
  accounts: any[];
  inboundEditorProcurementLineId?: string;
  deliveryEditorProcurementLineId?: string;
};

export function buildProjectWorkspaceViewModel({
  workspace,
  accounts,
  inboundEditorProcurementLineId,
  deliveryEditorProcurementLineId,
}: BuildProjectWorkspaceViewModelArgs) {
  const quotationVersions = ensureArray(workspace?.quotations);
  const qbuRounds = ensureArray(workspace?.qbuRounds);
  const contractAppendices = ensureArray(workspace?.contractAppendices);
  const executionBaselines = ensureArray(workspace?.executionBaselines);
  const procurementLines = ensureArray(workspace?.procurementLines);
  const inboundLines = ensureArray(workspace?.inboundLines);
  const deliveryLines = ensureArray(workspace?.deliveryLines);
  const milestones = ensureArray(workspace?.milestones);
  const timeline = ensureArray(workspace?.timeline);
  const currentBaseline = workspace?.currentBaseline || executionBaselines.find((item: any) => item.isCurrent);
  const supplierAccounts = ensureArray(accounts).filter((item: any) => String(item.accountType || '').toLowerCase() === 'supplier');

  const activeProcurementLines = procurementLines.filter((line: any) => {
    const activeFlag = line?.isActive !== false && Number(line?.isActive ?? 1) !== 0;
    const notSuperseded = String(line?.status || '').toLowerCase() !== 'superseded';
    const matchesCurrentBaseline = currentBaseline?.id ? line?.baselineId === currentBaseline.id : true;
    return activeFlag && notSuperseded && matchesCurrentBaseline;
  });

  const historyProcurementLines = procurementLines.filter((line: any) => !activeProcurementLines.some((activeLine: any) => activeLine.id === line.id));

  const inboundEditorProcurementLines = inboundEditorProcurementLineId
    ? procurementLines.filter((line: any) => line.id === inboundEditorProcurementLineId || activeProcurementLines.some((activeLine: any) => activeLine.id === line.id))
    : activeProcurementLines;

  const deliveryEditorProcurementLines = deliveryEditorProcurementLineId
    ? procurementLines.filter((line: any) => line.id === deliveryEditorProcurementLineId || activeProcurementLines.some((activeLine: any) => activeLine.id === line.id))
    : activeProcurementLines;

  const shortageLines = activeProcurementLines.filter((line: any) => numberValue(line.shortageQty) > 0);
  const overdueEtaLines = activeProcurementLines.filter((line: any) => isPastDate(line.etaDate) && numberValue(line.receivedQty) < Math.max(numberValue(line.orderedQty), numberValue(line.contractQty)));
  const overdueDeliveryLines = activeProcurementLines.filter((line: any) => isPastDate(line.committedDeliveryDate) && numberValue(line.deliveredQty) < numberValue(line.contractQty));
  const unorderedLines = activeProcurementLines.filter((line: any) => numberValue(line.orderedQty) < numberValue(line.contractQty));
  const pendingMilestones = milestones.filter((milestone: any) => String(milestone.status || 'pending').toLowerCase() !== 'completed');

  const overviewAlerts = [
    ...shortageLines.map((line: any) => ({
      key: `shortage-${line.id}`,
      tone: 'danger' as const,
      title: `${line.itemCode || line.itemName || 'Line'} đang thiếu ${numberValue(line.shortageQty)}`,
      description: `Hợp đồng ${numberValue(line.contractQty)} · Đặt mua ${numberValue(line.orderedQty)} · Đã nhận ${numberValue(line.receivedQty)} · Đã giao ${numberValue(line.deliveredQty)}`,
    })),
    ...overdueEtaLines.map((line: any) => ({
      key: `eta-${line.id}`,
      tone: 'warning' as const,
      title: `${line.itemCode || line.itemName || 'Line'} đã quá ETA`,
      description: `ETA ${formatDateValue(line.etaDate)} · Thực nhận ${numberValue(line.receivedQty)}/${Math.max(numberValue(line.orderedQty), numberValue(line.contractQty))}`,
    })),
    ...overdueDeliveryLines.map((line: any) => ({
      key: `delivery-${line.id}`,
      tone: 'warning' as const,
      title: `${line.itemCode || line.itemName || 'Line'} đã quá cam kết giao`,
      description: `Cam kết ${formatDateValue(line.committedDeliveryDate)} · Thực giao ${numberValue(line.deliveredQty)}/${numberValue(line.contractQty)}`,
    })),
    ...pendingMilestones.slice(0, 3).map((milestone: any) => ({
      key: `milestone-${milestone.id}`,
      tone: 'info' as const,
      title: `Milestone chờ xử lý: ${milestone.title}`,
      description: `Kế hoạch ${formatDateValue(milestone.plannedDate)} · Trạng thái ${statusLabel(milestone.status || 'pending')}`,
    })),
  ].slice(0, 6);

  const phaseReadiness = workspace?.phaseControl || buildWorkspacePhaseReadiness({
    workspace,
    shortageCount: shortageLines.length,
    overdueEtaCount: overdueEtaLines.length,
    overdueDeliveryCount: overdueDeliveryLines.length,
    unorderedCount: unorderedLines.length,
    pendingMilestoneCount: pendingMilestones.length,
  });

  const workHubSummaryKpis = buildWorkspaceSummaryKpis(workspace?.workHubSummary);

  return {
    quotationVersions,
    qbuRounds,
    contractAppendices,
    executionBaselines,
    procurementLines,
    inboundLines,
    deliveryLines,
    milestones,
    timeline,
    currentBaseline,
    supplierAccounts,
    activeProcurementLines,
    historyProcurementLines,
    inboundEditorProcurementLines,
    deliveryEditorProcurementLines,
    shortageLines,
    overdueEtaLines,
    overdueDeliveryLines,
    unorderedLines,
    pendingMilestones,
    overviewAlerts,
    phaseReadiness,
    workHubSummaryKpis,
  };
}
