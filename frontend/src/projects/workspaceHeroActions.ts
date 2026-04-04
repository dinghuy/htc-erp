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
  blockerRegister?: any[],
  phaseControl?: any,
): WorkspaceHeroPlan {
  const stage = String(projectStage || 'new');
  const canRequestCommercialApproval = Boolean(actionAvailability?.quotation?.canRequestCommercialApproval);
  const canCreateSalesOrder = Boolean(actionAvailability?.quotation?.canCreateSalesOrder);
  const canReleaseSalesOrder = Boolean(actionAvailability?.salesOrder?.canReleaseLatest);
  const canFinalizeDeliveryCompletion = Boolean(actionAvailability?.project?.canFinalizeDeliveryCompletion);
  const blockers = Array.isArray(blockerRegister) ? blockerRegister : [];
  const approvalBlockers = blockers.filter((item) => item?.category === 'approval').length;
  const documentBlockers = blockers.filter((item) => item?.category === 'documents').length;
  const executionBlockers = blockers.filter((item) => item?.category === 'execution').length;
  const readinessLabel = typeof phaseControl?.readinessScore === 'number' ? `${phaseControl.readinessScore}% readiness` : 'workspace readiness';

  const byMode: Record<RolePersonaMode, WorkspaceHeroPlan> = {
    sales: {
      eyebrow: 'Không gian thương mại',
      title: stage === 'quoting' || stage === 'negotiating' ? 'Chốt thương mại sạch trước bàn giao' : 'Giữ ngữ cảnh thương mại cho dự án này',
      description: stage === 'quoting' || stage === 'negotiating'
        ? `Ưu tiên báo giá, phê duyệt và hồ sơ để dự án sang bước tiếp theo mà không bị trả về. Hiện có ${approvalBlockers} blocker approval và ${documentBlockers} blocker hồ sơ.`
        : `Dự án đã qua bước báo giá chính, nhưng sales vẫn cần nhìn cam kết thương mại và bối cảnh phê duyệt. Trạng thái hiện tại: ${readinessLabel}.`,
      actions: [
        canRequestCommercialApproval
          ? baseAction('commercial-approval', 'Tạo phê duyệt thương mại', 'Đẩy báo giá sang vòng duyệt thương mại.', 'primary', 'requestCommercialApproval')
          : canCreateSalesOrder
            ? baseAction('create-sales-order', 'Tạo sales order', 'Khóa bước thương mại và chốt đầu vào cho triển khai.', 'primary', 'createSalesOrder')
            : baseAction('open-commercial', 'Mở tab thương mại', 'Rà lại báo giá, quản lý chi phí và hợp đồng.', 'primary', 'openCommercial'),
        baseAction('open-approvals', 'Xem phê duyệt', 'Kiểm tra các làn đang chặn luồng thương mại.', 'secondary', 'openApprovals'),
        baseAction('open-documents', 'Rà hồ sơ', 'Kiểm tra hồ sơ còn thiếu trước bàn giao.', 'ghost', 'openDocuments'),
      ],
    },
    project_manager: {
      eyebrow: 'Không gian hợp nhất',
      title: stage === 'quoting' || stage === 'negotiating' ? 'Chốt deal rồi kéo thẳng sang triển khai' : 'Giữ một điểm điều phối từ thương mại tới giao hàng',
      description: `PM nên luôn nhìn bước kế tiếp trên cùng một dự án, không chuyển chế độ thủ công giữa thương mại và triển khai. Workspace hiện có ${executionBlockers} blocker execution, ${documentBlockers} blocker hồ sơ.`,
      actions: [
        canRequestCommercialApproval
          ? baseAction('commercial-approval', 'Tạo phê duyệt thương mại', 'Đẩy báo giá sang bước duyệt tiếp theo.', 'primary', 'requestCommercialApproval')
          : canCreateSalesOrder
            ? baseAction('create-sales-order', 'Tạo sales order', 'Khóa baseline thương mại cho triển khai.', 'primary', 'createSalesOrder')
            : stage === 'delivery' || stage === 'delivery_active'
              ? baseAction('open-delivery', 'Mở tab giao hàng', 'Đi thẳng vào triển khai giao hàng.', 'primary', 'openDelivery')
              : baseAction('open-timeline', 'Mở timeline', 'Theo dõi milestone và điểm nghẽn ngay trong không gian này.', 'primary', 'openTimeline'),
        baseAction('open-commercial', 'Mở tab thương mại', 'Rà lại báo giá, quản lý chi phí và bối cảnh hợp đồng.', 'secondary', 'openCommercial'),
        baseAction('open-tasks', 'Mở công việc', 'Xử lý công việc theo phân công thật trong dự án này.', 'ghost', 'openTasks'),
      ],
    },
    procurement: {
      eyebrow: 'Không gian mua hàng',
      title: 'Ưu tiên rủi ro nguồn cung trước khi nó thành rủi ro giao hàng',
      description: `Procurement nên nhìn ngay line mua hàng, ETA, thiếu hàng và phê duyệt liên quan vendor/PO. Hiện có ${executionBlockers} blocker execution và ${documentBlockers} blocker hồ sơ liên quan.`,
      actions: [
        baseAction('open-procurement', 'Mở tab mua hàng', 'Đi thẳng vào line mua hàng và thiếu hàng.', 'primary', 'openProcurement'),
        baseAction('open-delivery', 'Mở tab giao hàng', 'Đối chiếu tác động sang inbound và giao hàng.', 'secondary', 'openDelivery'),
        baseAction('open-documents', 'Rà hồ sơ', 'Kiểm tra hồ sơ còn thiếu từ nhà cung cấp hoặc dự án.', 'ghost', 'openDocuments'),
      ],
    },
    accounting: {
      eyebrow: 'Không gian tài chính',
      title: 'Giữ payment state và phê duyệt tài chính sạch',
      description: `Accounting nên vào ngay tab tài chính và hàng đợi phê duyệt liên quan để tránh nghẽn luồng payment/invoice. Hiện có ${approvalBlockers} blocker gate và ${documentBlockers} blocker chứng từ.`,
      actions: [
        baseAction('open-finance', 'Mở quản lý chi phí', 'Xem milestone, rủi ro công nợ và toàn bộ chi phí dự án.', 'primary', 'openFinance'),
        baseAction('open-approvals', 'Xem phê duyệt tài chính', 'Rà các quyết định tài chính đang chờ.', 'secondary', 'openApprovals'),
        baseAction('open-documents', 'Rà hồ sơ', 'Xác nhận hồ sơ đủ điều kiện xử lý tài chính.', 'ghost', 'openDocuments'),
      ],
    },
    legal: {
      eyebrow: 'Không gian pháp lý',
      title: 'Đưa contract package về trạng thái reviewable',
      description: `Legal nên nhìn tab pháp lý trước, sau đó rà approvals và hồ sơ thiếu để tránh workflow quay vòng. Hiện có ${approvalBlockers} blocker approval và ${documentBlockers} blocker hồ sơ.`,
      actions: [
        baseAction('open-legal', 'Mở tab pháp lý', 'Đi thẳng vào review hợp đồng, phụ lục và rủi ro pháp lý.', 'primary', 'openLegal'),
        baseAction('open-approvals', 'Xem phê duyệt pháp lý', 'Rà các yêu cầu pháp lý đang chờ.', 'secondary', 'openApprovals'),
        baseAction('open-documents', 'Rà hồ sơ', 'Kiểm tra gói pháp lý còn thiếu gì.', 'ghost', 'openDocuments'),
      ],
    },
    director: {
      eyebrow: 'Không gian điều hành',
      title: 'Điều hành theo rủi ro và trạng thái cổng duyệt',
      description: `Director nên bắt đầu từ overview và approvals để quyết định nhanh các gate vượt ngưỡng. Workspace hiện có ${blockers.length} blocker đáng chú ý.`,
      actions: [
        baseAction('open-approvals', 'Xem phê duyệt điều hành', 'Đi thẳng vào hàng đợi quyết định đang chặn dự án.', 'primary', 'openApprovals'),
        baseAction('open-finance', 'Mở quản lý chi phí', 'Đọc nhanh áp lực biên lợi nhuận, thanh toán và chi phí của dự án.', 'secondary', 'openFinance'),
        baseAction('open-legal', 'Mở tab pháp lý', 'Kiểm tra rủi ro pháp lý hoặc deviation lớn.', 'ghost', 'openLegal'),
      ],
    },
    admin: {
      eyebrow: 'Giám sát hệ thống',
      title: 'Lớp hỗ trợ admin cho workspace này',
      description: `Admin có thể mở mọi bề mặt để hỗ trợ quy trình và dữ liệu, nhưng phê duyệt nghiệp vụ vẫn đi theo role tương ứng. Hiện có ${blockers.length} blocker trong register.`,
      actions: [
        baseAction('open-documents', 'Rà hồ sơ', 'Kiểm tra liệu quy trình đang nghẽn vì hồ sơ thiếu hay không.', 'primary', 'openDocuments'),
        baseAction('open-approvals', 'Theo dõi phê duyệt', 'Xác định cổng nào đang chặn dự án để hỗ trợ đúng chỗ.', 'secondary', 'openApprovals'),
        baseAction('open-tasks', 'Mở công việc', 'Đi vào hàng đợi vận hành nếu cần hỗ trợ xử lý sự cố.', 'ghost', 'openTasks'),
      ],
    },
    viewer: {
      eyebrow: 'Không gian chỉ xem',
      title: 'Theo dõi dự án từ góc nhìn chỉ xem',
      description: `Viewer nên bắt đầu từ overview, phê duyệt và hồ sơ để nắm tình hình hiện tại của dự án. Workspace hiện ghi nhận ${blockers.length} blocker cần theo dõi.`,
      actions: [
        baseAction('open-approvals', 'Xem phê duyệt', 'Theo dõi trạng thái phê duyệt của dự án.', 'primary', 'openApprovals'),
        baseAction('open-documents', 'Mở hồ sơ', 'Rà hồ sơ hiện có và còn thiếu.', 'secondary', 'openDocuments'),
        baseAction('open-timeline', 'Mở timeline', 'Xem nhịp milestone của project.', 'ghost', 'openTimeline'),
      ],
    },
  };

  const plan = byMode[mode];

  if (canReleaseSalesOrder && access.canEditCommercial) {
    plan.actions = [
      baseAction('release-sales-order', 'Phát hành sales order', 'Chốt cổng duyệt để triển khai dùng sales order đã được duyệt.', 'primary', 'releaseSalesOrder'),
      ...plan.actions.filter((item) => item.id !== 'commercial-approval' && item.id !== 'create-sales-order'),
    ];
  }

  if (canFinalizeDeliveryCompletion && access.canEditTimeline) {
    plan.actions = [
      baseAction('finalize-delivery', 'Chốt hoàn tất giao hàng', 'Hoàn tất giao hàng khi các điều kiện đã đủ.', 'primary', 'finalizeDeliveryCompletion'),
      ...plan.actions.filter((item) => item.id !== 'request-completion-approval'),
    ];
  }

  return {
    ...plan,
    actions: plan.actions.slice(0, 3),
  };
}
