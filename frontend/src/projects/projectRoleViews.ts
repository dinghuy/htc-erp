import type { RolePersonaMode } from '../shared/domain/contracts';

type Tone = 'good' | 'warn' | 'bad' | 'info';
type ProjectStatus = 'pending' | 'active' | 'completed' | 'paused' | 'cancelled';

export type ProjectRoleSummaryCard = {
  label: string;
  value: number;
  tone?: Tone;
};

export type ProjectRoleFocusPreset = {
  id: string;
  label: string;
  apply: () => {
    statusFilter?: 'all' | ProjectStatus;
    stageFilter?: string;
    overdueOnly?: boolean;
  };
};

export type ProjectRoleView = {
  title: string;
  subtitle: string;
  createLabel: string;
  note: string;
  cards: ProjectRoleSummaryCard[];
  focusPresets: ProjectRoleFocusPreset[];
};

function countByStage(projects: any[], stages: string[]) {
  return projects.filter((project) => stages.includes(String(project.projectStage || ''))).length;
}

function countOverdue(projects: any[]) {
  return projects.filter((project) => Number(project.overdueTaskCount || 0) > 0).length;
}

function countMissingDocs(projects: any[]) {
  return projects.filter((project) => Number(project.missingDocumentCount || 0) > 0).length;
}

function countPendingApprovals(projects: any[]) {
  return projects.filter((project) => Number(project.pendingApprovalCount || 0) > 0).length;
}

export function buildProjectRoleView(mode: RolePersonaMode, projects: any[]): ProjectRoleView {
  const defaultCards = [
    { label: 'Dự án đang chạy', value: projects.filter((project) => project.status === 'active').length, tone: 'good' as Tone },
    { label: 'Công việc trễ', value: countOverdue(projects), tone: 'bad' as Tone },
    { label: 'Phê duyệt chờ', value: countPendingApprovals(projects), tone: 'warn' as Tone },
    { label: 'Hồ sơ thiếu', value: countMissingDocs(projects), tone: 'warn' as Tone },
  ];

  const byMode: Record<RolePersonaMode, ProjectRoleView> = {
    sales: {
      title: 'Dự án thương mại',
      subtitle: 'Theo dõi các dự án đang ở sát ngưỡng bàn giao để luồng thương mại không làm bẩn triển khai về sau.',
      createLabel: 'Tạo shell dự án thủ công',
      note: 'Sales xem dự án như lớp kiểm soát bàn giao. Nếu chưa có quyền project shell thì chỉ vào workspace và theo dõi trạng thái thương mại.',
      cards: [
        { label: 'Dự án đang chạy', value: projects.filter((project) => project.status === 'active').length, tone: 'good' },
        { label: 'Sắp bàn giao', value: countByStage(projects, ['won', 'order_released']), tone: 'info' },
        { label: 'Phê duyệt chờ', value: countPendingApprovals(projects), tone: 'warn' },
        { label: 'Hồ sơ thiếu', value: countMissingDocs(projects), tone: 'bad' },
      ],
      focusPresets: [
        { id: 'handoff', label: 'Bàn giao sắp tới', apply: () => ({ stageFilter: 'won' }) },
        { id: 'approvals', label: 'Có phê duyệt chờ', apply: () => ({ statusFilter: 'active' }) },
        { id: 'overdue', label: 'Có công việc trễ', apply: () => ({ overdueOnly: true }) },
      ],
    },
    project_manager: {
      title: 'Dự án từ deal tới delivery',
      subtitle: 'Một danh sách duy nhất để theo dõi dự án từ thương mại tới triển khai mà không cần đổi ngữ cảnh.',
      createLabel: 'Tạo project shell',
      note: 'PM dùng danh sách này như tháp điều phối xuyên suốt: chỗ nào vừa ảnh hưởng biên lợi nhuận vừa ảnh hưởng tiến độ sẽ nổi lên đầu.',
      cards: [
        { label: 'Dự án đang chạy', value: projects.filter((project) => project.status === 'active').length, tone: 'good' },
        { label: 'Sắp bàn giao', value: countByStage(projects, ['won', 'order_released']), tone: 'info' },
        { label: 'Công việc trễ', value: countOverdue(projects), tone: 'bad' },
        { label: 'Ngoại lệ mở', value: countPendingApprovals(projects) + countMissingDocs(projects), tone: 'warn' },
      ],
      focusPresets: [
        { id: 'handoff', label: 'Thương mại sang triển khai', apply: () => ({ stageFilter: 'won' }) },
        { id: 'delivery', label: 'Áp lực triển khai', apply: () => ({ statusFilter: 'active', overdueOnly: true }) },
        { id: 'active', label: 'Đang thực hiện', apply: () => ({ statusFilter: 'active' }) },
      ],
    },
    procurement: {
      title: 'Dự án có áp lực nguồn cung',
      subtitle: 'Nhìn dự án theo góc độ thiếu hàng, ETA và rủi ro giao hàng thay vì danh sách chung.',
      createLabel: 'Tạo project shell',
      note: 'Procurement không cần thao tác CRUD thương mại sâu ở đây; màn này ưu tiên dự án có rủi ro nguồn cung và timeline giao hàng.',
      cards: [
        { label: 'Procurement active', value: countByStage(projects, ['procurement_active', 'delivery_active', 'delivery']), tone: 'good' },
        { label: 'Công việc trễ', value: countOverdue(projects), tone: 'bad' },
        { label: 'Phê duyệt chờ', value: countPendingApprovals(projects), tone: 'warn' },
        { label: 'Thiếu hồ sơ', value: countMissingDocs(projects), tone: 'warn' },
      ],
      focusPresets: [
        { id: 'procurement', label: 'Procurement active', apply: () => ({ stageFilter: 'procurement_active' }) },
        { id: 'delivery', label: 'Rủi ro giao hàng', apply: () => ({ stageFilter: 'delivery' }) },
        { id: 'overdue', label: 'Công việc trễ', apply: () => ({ overdueOnly: true }) },
      ],
    },
    accounting: {
      title: 'Dự án phía tài chính',
      subtitle: 'Project list dưới góc nhìn milestone thanh toán, approvals tài chính và các hồ sơ còn thiếu.',
      createLabel: 'Tạo project shell',
      note: 'Accounting chủ yếu review, follow-up và nhìn payment impact; không dùng màn này như editor vận hành chính.',
      cards: [
        { label: 'Dự án đang chạy', value: projects.filter((project) => project.status === 'active').length, tone: 'good' },
        { label: 'Phê duyệt chờ', value: countPendingApprovals(projects), tone: 'warn' },
        { label: 'Hồ sơ thiếu', value: countMissingDocs(projects), tone: 'bad' },
        { label: 'Công việc trễ', value: countOverdue(projects), tone: 'info' },
      ],
      focusPresets: [
        { id: 'active', label: 'Đang chạy', apply: () => ({ statusFilter: 'active' }) },
        { id: 'approvals', label: 'Áp lực phê duyệt', apply: () => ({ statusFilter: 'active' }) },
        { id: 'docs', label: 'Hồ sơ thiếu', apply: () => ({}) },
      ],
    },
    legal: {
      title: 'Dự án phía pháp lý',
      subtitle: 'Theo dõi project dưới góc nhìn contract package, deviation và completeness của hồ sơ.',
      createLabel: 'Tạo project shell',
      note: 'Legal dùng list này để chọn đúng project cần vào tab pháp lý, không phải để xử lý execution hằng ngày.',
      cards: [
        { label: 'Dự án đang chạy', value: projects.filter((project) => project.status === 'active').length, tone: 'good' },
        { label: 'Phê duyệt chờ', value: countPendingApprovals(projects), tone: 'warn' },
        { label: 'Hồ sơ thiếu', value: countMissingDocs(projects), tone: 'bad' },
        { label: 'Sắp bàn giao', value: countByStage(projects, ['won', 'order_released']), tone: 'info' },
      ],
      focusPresets: [
        { id: 'won', label: 'Dự án mới thắng', apply: () => ({ stageFilter: 'won' }) },
        { id: 'docs', label: 'Hồ sơ cần review pháp lý', apply: () => ({}) },
        { id: 'active', label: 'Đang chạy', apply: () => ({ statusFilter: 'active' }) },
      ],
    },
    director: {
      title: 'Toàn cảnh dự án điều hành',
      subtitle: 'Lớp nhìn trên cùng để thấy dự án nào đang phình rủi ro theo công việc, phê duyệt và tồn hồ sơ.',
      createLabel: 'Tạo project shell',
      note: 'Director nhìn danh sách này như lớp điều phối. Quyết định sâu nên đi qua workspace và các làn phê duyệt tương ứng.',
      cards: [
        { label: 'Dự án đang chạy', value: projects.filter((project) => project.status === 'active').length, tone: 'good' },
        { label: 'Công việc trễ', value: countOverdue(projects), tone: 'bad' },
        { label: 'Phê duyệt chờ', value: countPendingApprovals(projects), tone: 'warn' },
        { label: 'Hồ sơ thiếu', value: countMissingDocs(projects), tone: 'warn' },
      ],
      focusPresets: [
        { id: 'active', label: 'Rủi ro đang chạy', apply: () => ({ statusFilter: 'active' }) },
        { id: 'delivery', label: 'Áp lực giao hàng', apply: () => ({ stageFilter: 'delivery' }) },
        { id: 'overdue', label: 'Công việc trễ', apply: () => ({ overdueOnly: true }) },
      ],
    },
    admin: {
      title: 'Giám sát dự án',
      subtitle: 'Admin nhìn danh sách dự án như lớp support và kiểm soát vận hành toàn cục, không phải lane phê duyệt nghiệp vụ.',
      createLabel: 'Tạo project shell',
      note: 'Admin được quản trị project shell và workspace access, nhưng approval business vẫn cần role phù hợp.',
      cards: defaultCards,
      focusPresets: [
        { id: 'active', label: 'Đang chạy', apply: () => ({ statusFilter: 'active' }) },
        { id: 'overdue', label: 'Công việc trễ', apply: () => ({ overdueOnly: true }) },
        { id: 'paused', label: 'Tạm dừng', apply: () => ({ statusFilter: 'paused' }) },
      ],
    },
    viewer: {
      title: 'Ảnh chụp nhanh dự án',
      subtitle: 'Một danh sách đọc nhanh để theo dõi dự án và vào workspace ở chế độ chỉ xem.',
      createLabel: 'Tạo project shell',
      note: 'Viewer chỉ theo dõi trạng thái và mở workspace để xem, không thao tác project shell.',
      cards: defaultCards,
      focusPresets: [
        { id: 'active', label: 'Đang chạy', apply: () => ({ statusFilter: 'active' }) },
        { id: 'delivery', label: 'Giao hàng', apply: () => ({ stageFilter: 'delivery' }) },
        { id: 'completed', label: 'Hoàn thành', apply: () => ({ statusFilter: 'completed' }) },
      ],
    },
  };

  return byMode[mode];
}
