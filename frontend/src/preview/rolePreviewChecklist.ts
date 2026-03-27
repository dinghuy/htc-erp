import { buildRoleProfile, type SystemRole } from '../shared/domain/contracts';

export type RolePreviewChecklist = {
  title: string;
  description: string;
  items: string[];
};

export function buildRolePreviewChecklist(roleCodes: SystemRole[]): RolePreviewChecklist {
  const profile = buildRoleProfile(roleCodes, roleCodes[0]);

  switch (profile.personaMode) {
    case 'sales':
      return {
        title: 'Sales QA checklist',
        description: 'Rà luồng commercial và handoff, đồng thời xác nhận không bị lộ lane finance/legal.',
        items: [
          'Home/My Work hiển thị pipeline, commercial queue và handoff-related cards.',
          'Approvals focus lane commercial; không có quyền approve finance/legal/executive.',
          'Project Workspace mở tab commercial được, nhưng finance/legal chỉ hiện nếu role thật cho phép.',
          'Pricing/contract CTA hiển thị đúng theo capability sales.',
        ],
      };
    case 'project_manager':
      return {
        title: 'Project Manager QA checklist',
        description: 'Rà PM flow hợp nhất từ commercial, handoff tới execution trên cùng workspace.',
        items: [
          'My Work hiển thị queue hợp nhất cho commercial handoff, blockers và readiness items.',
          'Workspace mẫu mở được commercial tab nhưng vẫn nhìn rõ timeline/tasks/delivery theo cùng một flow.',
          'Commercial CTA và execution CTA cùng tồn tại, nhưng vẫn bị chặn đúng bởi capability thật.',
          'Không xuất hiện action approve finance/legal nếu không có role bổ sung.',
        ],
      };
    case 'procurement':
      return {
        title: 'Procurement QA checklist',
        description: 'Rà shortage, ETA, PO và delivery risk mà không lộ commercial authoring.',
        items: [
          'Inbox focus department procurement.',
          'Workspace mẫu mở tab procurement và delivery-related sections.',
          'Có thể thấy line shortage/ETA, nhưng không sửa pricing hay contract commercial.',
          'Approvals lane procurement đúng, lane khác không bật nhầm quyền.',
        ],
      };
    case 'accounting':
      return {
        title: 'Accounting QA checklist',
        description: 'Rà lane finance và bề mặt review tài chính.',
        items: [
          'Approvals focus lane finance, CTA approve chỉ hoạt động theo role accounting.',
          'Workspace mẫu mở tab finance với cockpit, payment milestones và receivable risk.',
          'Commercial/procurement editor không hiện như quyền mặc định.',
          'Preview banner luôn nhắc đây là QA focus, không phải nâng quyền.',
        ],
      };
    case 'legal':
      return {
        title: 'Legal QA checklist',
        description: 'Rà legal review queue, deviation và contract package.',
        items: [
          'Approvals focus lane legal.',
          'Workspace mẫu mở tab legal và documents/legal review đúng ngữ cảnh.',
          'Không có quyền finance approval hay commercial editing sâu.',
          'Document/legal badges phản ánh thiếu hồ sơ và deviation queue rõ ràng.',
        ],
      };
    case 'director':
      return {
        title: 'Director QA checklist',
        description: 'Rà executive visibility, at-risk projects và lane điều hành.',
        items: [
          'Approvals focus lane executive.',
          'Reports/Workspace overview hiển thị risk-oriented cockpit thay vì editor vận hành.',
          'Không xuất hiện editor commercial/procurement như quyền thao tác hằng ngày.',
          'Drill-down từ approvals hoặc workspace mẫu vẫn giữ explanatory preview badges.',
        ],
      };
    case 'viewer':
      return {
        title: 'Viewer QA checklist',
        description: 'Xác nhận toàn bộ bề mặt là read-only.',
        items: [
          'Home/Inbox/Projects chỉ hiển thị thông tin, không có CTA chỉnh sửa.',
          'Workspace sample mở ở overview với preview read-only rõ ràng.',
          'Tasks, approvals và queue đều không có action mutate.',
          'Không có module admin/system settings ngoài phạm vi read-only.',
        ],
      };
    case 'admin':
    default:
      return {
        title: 'Admin QA checklist',
        description: 'Rà bề mặt quản trị hệ thống và xác nhận admin không tự động thành business approver.',
        items: [
          'Users/Settings/Event Log/Support hiển thị đầy đủ.',
          'Approvals không bật approve finance/legal/executive nếu chỉ có admin.',
          'Role preview bật/tắt được và quay lại base admin identity an toàn.',
          'Preview focus/filter/workspace sample chỉ đổi góc nhìn QA, không đổi authorization.',
        ],
      };
  }
}
