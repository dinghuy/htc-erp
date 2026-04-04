import { projectStageLabel } from '../ops/workflowOptions';
import { buildDocumentWorkspaceSummary } from './workspaceRoleViews';

type ReadinessInput = {
  workspace?: any;
  shortageCount?: number;
  overdueEtaCount?: number;
  overdueDeliveryCount?: number;
  unorderedCount?: number;
  pendingMilestoneCount?: number;
};

export type PhaseReadinessItem = {
  id: string;
  label: string;
  status: 'ready' | 'warning' | 'blocked';
  detail: string;
  action?: string;
};

export type PhaseBlocker = {
  id: string;
  tone: 'warning' | 'danger';
  title: string;
  detail: string;
  action?: string;
};

export type WorkspacePhaseReadiness = {
  stageLabel: string;
  nextStepLabel: string;
  readinessScore: number;
  readinessTone: 'good' | 'warn' | 'bad';
  summary: string;
  items: PhaseReadinessItem[];
  blockers: PhaseBlocker[];
};

function ensureArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function summarizeGateStatus(gate: any) {
  const normalized = String(gate?.status || 'not_requested').toLowerCase();
  if (normalized === 'approved') return 'ready' as const;
  if (normalized === 'pending' || normalized === 'changes_requested') return 'warning' as const;
  return 'blocked' as const;
}

export function buildWorkspacePhaseReadiness(input: ReadinessInput): WorkspacePhaseReadiness {
  const workspace = input.workspace || {};
  const stage = String(workspace.projectStage || 'new');
  const documentsSummary = buildDocumentWorkspaceSummary({ workspace });
  const gateStates = ensureArray(workspace.approvalGateStates);
  const missingDocuments = documentsSummary.missingDocuments;
  const openTaskCount = Number(workspace.openTaskCount || 0);
  const overdueTaskCount = Number(workspace.overdueTaskCount || 0);
  const pendingMilestoneCount = Number(input.pendingMilestoneCount || 0);
  const shortageCount = Number(input.shortageCount || 0);
  const overdueEtaCount = Number(input.overdueEtaCount || 0);
  const overdueDeliveryCount = Number(input.overdueDeliveryCount || 0);
  const unorderedCount = Number(input.unorderedCount || 0);

  const quotationGate = gateStates.find((gate: any) => gate.gateType === 'quotation_commercial');
  const deliveryCompletionGate = gateStates.find((gate: any) => gate.gateType === 'delivery_completion');

  const items: PhaseReadinessItem[] = [
    {
      id: 'commercial-gate',
      label: 'Cổng thương mại',
      status: quotationGate ? summarizeGateStatus(quotationGate) : 'warning',
      detail: quotationGate
        ? `Phê duyệt thương mại của báo giá đang ở trạng thái ${String(quotationGate.status || 'not_requested')}.`
        : 'Chưa thấy cổng thương mại trong dự án này.',
      action: 'openApprovals',
    },
    {
      id: 'document-checklist',
      label: 'Checklist hồ sơ',
      status: missingDocuments.length === 0 ? 'ready' : missingDocuments.length > 2 ? 'blocked' : 'warning',
      detail: missingDocuments.length === 0
        ? 'Không còn hồ sơ thiếu hoặc đang được yêu cầu.'
        : `${missingDocuments.length} hồ sơ đang thiếu hoặc mới chỉ được yêu cầu.`,
      action: 'openDocuments',
    },
    {
      id: 'execution-load',
      label: 'Hàng đợi triển khai',
      status: overdueTaskCount > 0 ? 'blocked' : openTaskCount > 0 || pendingMilestoneCount > 0 ? 'warning' : 'ready',
      detail: overdueTaskCount > 0
        ? `${overdueTaskCount} công việc quá hạn đang chặn nhịp triển khai.`
        : `${openTaskCount} công việc mở · ${pendingMilestoneCount} milestone đang chờ.`,
      action: 'openTasks',
    },
    {
      id: 'supply-readiness',
      label: 'Mức sẵn sàng nguồn cung',
      status: shortageCount > 0 || overdueEtaCount > 0 ? 'blocked' : unorderedCount > 0 ? 'warning' : 'ready',
      detail: shortageCount > 0 || overdueEtaCount > 0
        ? `${shortageCount} line thiếu · ${overdueEtaCount} ETA trễ.`
        : unorderedCount > 0
          ? `${unorderedCount} line chưa đặt mua đủ.`
          : 'Không có thiếu hàng hoặc ETA trễ đáng chú ý.',
      action: 'openProcurement',
    },
    {
      id: 'delivery-close',
      label: 'Hoàn tất giao hàng',
      status: overdueDeliveryCount > 0 ? 'blocked' : deliveryCompletionGate ? summarizeGateStatus(deliveryCompletionGate) : 'warning',
      detail: overdueDeliveryCount > 0
        ? `${overdueDeliveryCount} line đã quá ngày cam kết giao hàng.`
        : deliveryCompletionGate
          ? `Cổng hoàn tất giao hàng đang ở trạng thái ${String(deliveryCompletionGate.status || 'not_requested')}.`
          : 'Chưa có cổng hoàn tất giao hàng.',
      action: overdueDeliveryCount > 0 ? 'openDelivery' : 'openApprovals',
    },
  ];

  const blockers: PhaseBlocker[] = [
    ...gateStates.flatMap((gate: any) => ensureArray(gate?.actionAvailability?.blockers).map((blocker: string, index: number) => ({
      id: `${gate.gateType}-blocker-${index}`,
      tone: 'danger' as const,
      title: gate.title || gate.gateType || 'Cổng quy trình',
      detail: blocker,
      action: 'openApprovals',
    }))),
    ...missingDocuments.slice(0, 3).map((document: any) => ({
      id: `document-${document.id}`,
      tone: 'warning' as const,
      title: document.documentName || document.title || 'Hồ sơ còn thiếu',
      detail: `${document.department || 'liên phòng ban'} · cần tại giai đoạn ${document.requiredAtStage || 'bất kỳ'}`,
      action: 'openDocuments',
    })),
  ];

  if (shortageCount > 0) {
    blockers.push({
      id: 'shortage-lines',
      tone: 'danger',
      title: 'Thiếu nguồn cung',
      detail: `${shortageCount} line đang thiếu so với số lượng hợp đồng/đặt mua.`,
      action: 'openProcurement',
    });
  }
  if (overdueTaskCount > 0) {
    blockers.push({
      id: 'overdue-tasks',
      tone: 'warning',
      title: 'Triển khai quá hạn',
      detail: `${overdueTaskCount} công việc quá hạn cần được kéo lại nhịp ngay.`,
      action: 'openTasks',
    });
  }
  if (overdueDeliveryCount > 0) {
    blockers.push({
      id: 'delivery-overdue',
      tone: 'danger',
      title: 'Áp lực giao hàng',
      detail: `${overdueDeliveryCount} line đã quá ngày cam kết giao hàng.`,
      action: 'openDelivery',
    });
  }

  const readyCount = items.filter((item) => item.status === 'ready').length;
  const readinessScore = Math.round((readyCount / Math.max(items.length, 1)) * 100);
  const readinessTone = readinessScore >= 80 ? 'good' : readinessScore >= 50 ? 'warn' : 'bad';

  const nextStepLabel =
    stage === 'quoting' || stage === 'negotiating' || stage === 'internal-review'
      ? 'Phê duyệt thương mại / sales order'
      : stage === 'commercial_approved' || stage === 'won' || stage === 'order_released' || stage === 'procurement_active'
        ? 'Mức sẵn sàng mua hàng'
        : stage === 'delivery_active' || stage === 'delivery'
          ? 'Hoàn tất giao hàng'
          : 'Đóng dự án / rà soát vận hành';

  const summary =
    readinessTone === 'good'
      ? `Dự án đang khá sạch để đi tiếp sang bước ${nextStepLabel.toLowerCase()}.`
      : readinessTone === 'warn'
        ? `Dự án có thể đi tiếp, nhưng nên dọn một số điểm cảnh báo trước khi sang ${nextStepLabel.toLowerCase()}.`
        : `Dự án chưa sẵn sàng cho bước ${nextStepLabel.toLowerCase()}; cần xử lý các điểm nghẽn trước.`;

  return {
    stageLabel: projectStageLabel(stage) || stage || 'Mới',
    nextStepLabel,
    readinessScore,
    readinessTone,
    summary,
    items,
    blockers: blockers.slice(0, 6),
  };
}
