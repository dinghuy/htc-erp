import type { RolePersonaMode } from '../shared/domain/contracts';
import type { WorkspaceActionAccess } from './workspacePermissions';

export type WorkspaceHeroAction = {
  id: string;
  label: string;
  hint: string;
  tone: 'primary' | 'secondary' | 'ghost';
  action:
    | 'requestCommercialApproval'
    | 'createSalesOrder'
    | 'releaseSalesOrder'
    | 'requestDeliveryCompletionApproval'
    | 'finalizeDeliveryCompletion'
    | 'openApprovals'
    | 'openTasks'
    | 'openCommercial'
    | 'openProcurement'
    | 'openDelivery'
    | 'openFinance'
    | 'openLegal'
    | 'openTimeline'
    | 'openDocuments';
};

export type WorkspaceHeroPlan = {
  eyebrow: string;
  title: string;
  description: string;
  actions: WorkspaceHeroAction[];
};

function baseAction(id: WorkspaceHeroAction['id'], label: string, hint: string, tone: WorkspaceHeroAction['tone'], action: WorkspaceHeroAction['action']): WorkspaceHeroAction {
  return { id, label, hint, tone, action };
}

export function buildWorkspaceHeroPlan(
  mode: RolePersonaMode,
  projectStage: string | undefined,
  actionAvailability: any,
  access: WorkspaceActionAccess,
): WorkspaceHeroPlan {
  const stage = String(projectStage || 'new');
  const canRequestCommercialApproval = Boolean(actionAvailability?.quotation?.canRequestCommercialApproval);
  const canCreateSalesOrder = Boolean(actionAvailability?.quotation?.canCreateSalesOrder);
  const canReleaseSalesOrder = Boolean(actionAvailability?.salesOrder?.canReleaseLatest);
  const canFinalizeDeliveryCompletion = Boolean(actionAvailability?.project?.canFinalizeDeliveryCompletion);

  const byMode: Record<RolePersonaMode, WorkspaceHeroPlan> = {
    sales: {
      eyebrow: 'Commercial workspace',
      title: stage === 'quoting' || stage === 'negotiating' ? 'Chốt commercial sạch trước handoff' : 'Giữ commercial context cho project này',
      description: stage === 'quoting' || stage === 'negotiating'
        ? 'Ưu tiên quotation, approvals và hồ sơ để project sang bước tiếp theo mà không bị trả về.'
        : 'Project đã qua bước quoting chính, nhưng sales vẫn cần nhìn commercial commitments và approval context.',
      actions: [
        canRequestCommercialApproval
          ? baseAction('commercial-approval', 'Tạo commercial approval', 'Đẩy quotation sang vòng duyệt thương mại.', 'primary', 'requestCommercialApproval')
          : canCreateSalesOrder
            ? baseAction('create-sales-order', 'Tạo sales order', 'Chốt commercial và khóa đầu vào cho execution.', 'primary', 'createSalesOrder')
            : baseAction('open-commercial', 'Mở commercial tab', 'Rà lại quotation, pricing và hợp đồng.', 'primary', 'openCommercial'),
        baseAction('open-approvals', 'Xem approvals', 'Kiểm tra các lane đang chặn commercial flow.', 'secondary', 'openApprovals'),
        baseAction('open-documents', 'Rà documents', 'Kiểm tra hồ sơ còn thiếu trước handoff.', 'ghost', 'openDocuments'),
      ],
    },
    project_manager: {
      eyebrow: 'Unified workspace',
      title: stage === 'quoting' || stage === 'negotiating' ? 'Chốt deal rồi kéo thẳng sang execution' : 'Giữ một điểm điều phối từ commercial tới delivery',
      description: 'PM nên luôn nhìn bước kế tiếp trên cùng một project, không chuyển mode thủ công giữa commercial và execution.',
      actions: [
        canRequestCommercialApproval
          ? baseAction('commercial-approval', 'Tạo commercial approval', 'Đẩy quotation sang bước duyệt tiếp theo.', 'primary', 'requestCommercialApproval')
          : canCreateSalesOrder
            ? baseAction('create-sales-order', 'Tạo sales order', 'Khóa commercial baseline cho execution.', 'primary', 'createSalesOrder')
            : stage === 'delivery' || stage === 'delivery_active'
              ? baseAction('open-delivery', 'Mở delivery tab', 'Đi thẳng vào delivery execution.', 'primary', 'openDelivery')
              : baseAction('open-timeline', 'Mở timeline', 'Theo dõi milestone và blockers ngay trong workspace này.', 'primary', 'openTimeline'),
        baseAction('open-commercial', 'Mở commercial', 'Rà lại quotation, pricing và contract context.', 'secondary', 'openCommercial'),
        baseAction('open-tasks', 'Mở tasks', 'Xử lý task theo assignment thật trong project này.', 'ghost', 'openTasks'),
      ],
    },
    procurement: {
      eyebrow: 'Procurement workspace',
      title: 'Ưu tiên supply risk trước khi nó thành delivery risk',
      description: 'Procurement nên nhìn ngay line mua hàng, ETA, shortage và approvals liên quan vendor/PO.',
      actions: [
        baseAction('open-procurement', 'Mở procurement tab', 'Đi thẳng vào line mua hàng và shortage.', 'primary', 'openProcurement'),
        baseAction('open-delivery', 'Mở delivery tab', 'Đối chiếu tác động sang inbound và giao hàng.', 'secondary', 'openDelivery'),
        baseAction('open-documents', 'Rà documents', 'Kiểm tra hồ sơ còn thiếu từ supplier hoặc project.', 'ghost', 'openDocuments'),
      ],
    },
    accounting: {
      eyebrow: 'Finance workspace',
      title: 'Giữ payment state và finance approvals sạch',
      description: 'Accounting nên vào ngay finance tab và approval queue có liên quan để tránh nghẽn payment/invoice flow.',
      actions: [
        baseAction('open-finance', 'Mở finance tab', 'Xem milestones, receivable risk và trạng thái tài chính của project.', 'primary', 'openFinance'),
        baseAction('open-approvals', 'Xem finance approvals', 'Rà các quyết định tài chính đang pending.', 'secondary', 'openApprovals'),
        baseAction('open-documents', 'Rà documents', 'Xác nhận hồ sơ đủ điều kiện xử lý tài chính.', 'ghost', 'openDocuments'),
      ],
    },
    legal: {
      eyebrow: 'Legal workspace',
      title: 'Đưa contract package về trạng thái reviewable',
      description: 'Legal nên nhìn tab pháp lý trước, sau đó rà approvals và hồ sơ thiếu để tránh workflow quay vòng.',
      actions: [
        baseAction('open-legal', 'Mở legal tab', 'Đi thẳng vào contract review, appendices và legal risk.', 'primary', 'openLegal'),
        baseAction('open-approvals', 'Xem legal approvals', 'Rà các request pháp lý đang pending.', 'secondary', 'openApprovals'),
        baseAction('open-documents', 'Rà documents', 'Kiểm tra legal package còn thiếu gì.', 'ghost', 'openDocuments'),
      ],
    },
    director: {
      eyebrow: 'Executive workspace',
      title: 'Điều hành theo risk và gating state',
      description: 'Director nên bắt đầu từ overview và approvals để quyết định nhanh các gate vượt ngưỡng.',
      actions: [
        baseAction('open-approvals', 'Xem executive approvals', 'Đi thẳng vào queue quyết định đang chặn project.', 'primary', 'openApprovals'),
        baseAction('open-finance', 'Mở finance tab', 'Đọc nhanh margin/payment pressure của project.', 'secondary', 'openFinance'),
        baseAction('open-legal', 'Mở legal tab', 'Kiểm tra legal risks hoặc deviations lớn.', 'ghost', 'openLegal'),
      ],
    },
    admin: {
      eyebrow: 'System oversight',
      title: 'Admin support layer cho workspace này',
      description: 'Admin có thể mở mọi bề mặt để support workflow và dữ liệu, nhưng approval business vẫn đi theo role tương ứng.',
      actions: [
        baseAction('open-documents', 'Rà documents', 'Kiểm tra liệu workflow đang nghẽn vì hồ sơ thiếu hay không.', 'primary', 'openDocuments'),
        baseAction('open-approvals', 'Theo dõi approvals', 'Xác định gate nào đang chặn project để support đúng chỗ.', 'secondary', 'openApprovals'),
        baseAction('open-tasks', 'Mở tasks', 'Đi vào operational queue nếu cần hỗ trợ xử lý sự cố.', 'ghost', 'openTasks'),
      ],
    },
    viewer: {
      eyebrow: 'Read-only workspace',
      title: 'Theo dõi project từ góc nhìn read-only',
      description: 'Viewer nên bắt đầu từ overview, approvals và documents để nắm tình hình hiện tại của project.',
      actions: [
        baseAction('open-approvals', 'Xem approvals', 'Theo dõi trạng thái phê duyệt của project.', 'primary', 'openApprovals'),
        baseAction('open-documents', 'Mở documents', 'Rà hồ sơ hiện có và thiếu.', 'secondary', 'openDocuments'),
        baseAction('open-timeline', 'Mở timeline', 'Xem nhịp milestone của project.', 'ghost', 'openTimeline'),
      ],
    },
  };

  const plan = byMode[mode];

  if (canReleaseSalesOrder && access.canEditCommercial) {
    plan.actions = [
      baseAction('release-sales-order', 'Release sales order', 'Chốt gate để execution dùng sales order đã được duyệt.', 'primary', 'releaseSalesOrder'),
      ...plan.actions.filter((item) => item.id !== 'commercial-approval' && item.id !== 'create-sales-order'),
    ];
  }

  if (canFinalizeDeliveryCompletion && access.canEditTimeline) {
    plan.actions = [
      baseAction('finalize-delivery', 'Finalize delivery', 'Hoàn tất delivery khi các điều kiện đã đủ.', 'primary', 'finalizeDeliveryCompletion'),
      ...plan.actions.filter((item) => item.id !== 'request-completion-approval'),
    ];
  }

  return {
    ...plan,
    actions: plan.actions.slice(0, 3),
  };
}
