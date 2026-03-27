type PreviewScreen = 'my_work' | 'inbox' | 'approvals';

export type RolePreviewNotice = {
  title: string;
  message: string;
  tone: 'info' | 'warning';
};

export function buildRolePreviewNotice(input: {
  screen: PreviewScreen;
  previewLabel: string;
  workFocus?: string;
  departmentFilter?: string;
  approvalLane?: string;
}): RolePreviewNotice {
  const previewName = input.previewLabel || 'role đang preview';

  if (input.screen === 'approvals') {
    if (input.approvalLane) {
      return {
        tone: 'warning',
        title: `Preview approvals lane: ${input.approvalLane}`,
        message: `Bạn đang xem queue approvals như ${previewName} với lane ${input.approvalLane}. Bộ lọc này chỉ đổi góc nhìn QA, không cấp thêm quyền approve cho admin.`,
      };
    }

    return {
      tone: 'info',
      title: `Preview approvals as ${previewName}`,
      message: `Queue approvals đang hiển thị theo capability của ${previewName}. Các nút approve/reject vẫn bị chặn nếu role preview không có quyền business thực sự.`,
    };
  }

  if (input.screen === 'inbox') {
    if (input.departmentFilter) {
      return {
        tone: 'warning',
        title: `Preview inbox department: ${input.departmentFilter}`,
        message: `Inbox đang được focus theo department ${input.departmentFilter} để QA nhanh hơn dưới vai ${previewName}. Đây chỉ là filter hiển thị, không phải quyền truy cập bổ sung.`,
      };
    }

    return {
      tone: 'info',
      title: `Preview inbox as ${previewName}`,
      message: `Inbox đang phản ánh góc nhìn của ${previewName}. Admin chỉ mô phỏng queue của role này, không được mở rộng quyền nghiệp vụ thật.`,
    };
  }

  if (input.workFocus) {
    return {
      tone: 'warning',
      title: `Preview my work focus: ${input.workFocus}`,
      message: `My Work đang được focus vào ${input.workFocus} dưới vai ${previewName}. Đây là context QA để nhìn đúng queue ưu tiên, không thay đổi quyền xử lý thật.`,
    };
  }

  return {
    tone: 'info',
    title: `Preview my work as ${previewName}`,
    message: `My Work đang hiển thị theo capability của ${previewName}. Các queue này chỉ để kiểm thử trải nghiệm role, không nới quyền cho admin.`,
  };
}
