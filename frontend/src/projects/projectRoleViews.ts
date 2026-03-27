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
    { label: 'Dự án active', value: projects.filter((project) => project.status === 'active').length, tone: 'good' as Tone },
    { label: 'Task trễ', value: countOverdue(projects), tone: 'bad' as Tone },
    { label: 'Approval chờ', value: countPendingApprovals(projects), tone: 'warn' as Tone },
    { label: 'Hồ sơ thiếu', value: countMissingDocs(projects), tone: 'warn' as Tone },
  ];

  const byMode: Record<RolePersonaMode, ProjectRoleView> = {
    sales: {
      title: 'Dự án thương mại',
      subtitle: 'Theo dõi các project đang ở sát ngưỡng handoff để commercial flow không làm bẩn execution về sau.',
      createLabel: 'Tạo shell dự án thủ công',
      note: 'Sales xem project như lớp handoff control. Nếu chưa có quyền project shell thì chỉ vào workspace và theo dõi commercial state.',
      cards: [
        { label: 'Dự án active', value: projects.filter((project) => project.status === 'active').length, tone: 'good' },
        { label: 'Sắp handoff', value: countByStage(projects, ['won', 'order_released']), tone: 'info' },
        { label: 'Approval chờ', value: countPendingApprovals(projects), tone: 'warn' },
        { label: 'Hồ sơ thiếu', value: countMissingDocs(projects), tone: 'bad' },
      ],
      focusPresets: [
        { id: 'handoff', label: 'Handoff sắp tới', apply: () => ({ stageFilter: 'won' }) },
        { id: 'approvals', label: 'Có approvals pending', apply: () => ({ statusFilter: 'active' }) },
        { id: 'overdue', label: 'Có task trễ', apply: () => ({ overdueOnly: true }) },
      ],
    },
    project_manager: {
      title: 'Dự án từ deal tới delivery',
      subtitle: 'Một danh sách duy nhất để theo dõi project từ commercial tới execution mà không cần đổi module tư duy.',
      createLabel: 'Tạo project shell',
      note: 'PM giờ dùng list này như control tower xuyên suốt: chỗ nào vừa ảnh hưởng margin vừa ảnh hưởng tiến độ sẽ nổi lên đầu.',
      cards: [
        { label: 'Dự án active', value: projects.filter((project) => project.status === 'active').length, tone: 'good' },
        { label: 'Sắp handoff', value: countByStage(projects, ['won', 'order_released']), tone: 'info' },
        { label: 'Task trễ', value: countOverdue(projects), tone: 'bad' },
        { label: 'Ngoại lệ mở', value: countPendingApprovals(projects) + countMissingDocs(projects), tone: 'warn' },
      ],
      focusPresets: [
        { id: 'handoff', label: 'Commercial sang execution', apply: () => ({ stageFilter: 'won' }) },
        { id: 'delivery', label: 'Execution pressure', apply: () => ({ statusFilter: 'active', overdueOnly: true }) },
        { id: 'active', label: 'Đang thực hiện', apply: () => ({ statusFilter: 'active' }) },
      ],
    },
    procurement: {
      title: 'Dự án có áp lực nguồn cung',
      subtitle: 'Nhìn dự án theo góc độ shortage, ETA và delivery risk thay vì danh sách project chung.',
      createLabel: 'Tạo project shell',
      note: 'Procurement không cần commercial CRUD sâu ở đây; màn này ưu tiên project nào có rủi ro nguồn cung và timeline giao hàng.',
      cards: [
        { label: 'Procurement active', value: countByStage(projects, ['procurement_active', 'delivery_active', 'delivery']), tone: 'good' },
        { label: 'Task trễ', value: countOverdue(projects), tone: 'bad' },
        { label: 'Approval chờ', value: countPendingApprovals(projects), tone: 'warn' },
        { label: 'Thiếu hồ sơ', value: countMissingDocs(projects), tone: 'warn' },
      ],
      focusPresets: [
        { id: 'procurement', label: 'Procurement active', apply: () => ({ stageFilter: 'procurement_active' }) },
        { id: 'delivery', label: 'Delivery risk', apply: () => ({ stageFilter: 'delivery' }) },
        { id: 'overdue', label: 'Task trễ', apply: () => ({ overdueOnly: true }) },
      ],
    },
    accounting: {
      title: 'Dự án phía tài chính',
      subtitle: 'Project list dưới góc nhìn milestone thanh toán, approvals tài chính và các hồ sơ còn thiếu.',
      createLabel: 'Tạo project shell',
      note: 'Accounting chủ yếu review, follow-up và nhìn payment impact; không dùng màn này như editor vận hành chính.',
      cards: [
        { label: 'Dự án active', value: projects.filter((project) => project.status === 'active').length, tone: 'good' },
        { label: 'Approval chờ', value: countPendingApprovals(projects), tone: 'warn' },
        { label: 'Hồ sơ thiếu', value: countMissingDocs(projects), tone: 'bad' },
        { label: 'Task trễ', value: countOverdue(projects), tone: 'info' },
      ],
      focusPresets: [
        { id: 'active', label: 'Active', apply: () => ({ statusFilter: 'active' }) },
        { id: 'approvals', label: 'Approval pressure', apply: () => ({ statusFilter: 'active' }) },
        { id: 'docs', label: 'Hồ sơ thiếu', apply: () => ({}) },
      ],
    },
    legal: {
      title: 'Dự án phía pháp lý',
      subtitle: 'Theo dõi project dưới góc nhìn contract package, deviation và completeness của hồ sơ.',
      createLabel: 'Tạo project shell',
      note: 'Legal dùng list này để chọn đúng project cần vào tab pháp lý, không phải để xử lý execution hằng ngày.',
      cards: [
        { label: 'Dự án active', value: projects.filter((project) => project.status === 'active').length, tone: 'good' },
        { label: 'Approval chờ', value: countPendingApprovals(projects), tone: 'warn' },
        { label: 'Hồ sơ thiếu', value: countMissingDocs(projects), tone: 'bad' },
        { label: 'Sắp handoff', value: countByStage(projects, ['won', 'order_released']), tone: 'info' },
      ],
      focusPresets: [
        { id: 'won', label: 'Project mới thắng', apply: () => ({ stageFilter: 'won' }) },
        { id: 'docs', label: 'Hồ sơ cần legal review', apply: () => ({}) },
        { id: 'active', label: 'Đang active', apply: () => ({ statusFilter: 'active' }) },
      ],
    },
    director: {
      title: 'Toàn cảnh dự án điều hành',
      subtitle: 'Top layer để nhìn project nào đang phình risk theo task, approvals và document backlog.',
      createLabel: 'Tạo project shell',
      note: 'Director nhìn list này như control layer. Quyết định sâu nên đi qua workspace và approval lanes tương ứng.',
      cards: [
        { label: 'Dự án active', value: projects.filter((project) => project.status === 'active').length, tone: 'good' },
        { label: 'Task trễ', value: countOverdue(projects), tone: 'bad' },
        { label: 'Approval chờ', value: countPendingApprovals(projects), tone: 'warn' },
        { label: 'Hồ sơ thiếu', value: countMissingDocs(projects), tone: 'warn' },
      ],
      focusPresets: [
        { id: 'active', label: 'Active risk', apply: () => ({ statusFilter: 'active' }) },
        { id: 'delivery', label: 'Delivery pressure', apply: () => ({ stageFilter: 'delivery' }) },
        { id: 'overdue', label: 'Task trễ', apply: () => ({ overdueOnly: true }) },
      ],
    },
    admin: {
      title: 'Giám sát dự án',
      subtitle: 'Admin nhìn danh sách dự án như lớp support và kiểm soát vận hành toàn cục, không phải lane phê duyệt nghiệp vụ.',
      createLabel: 'Tạo project shell',
      note: 'Admin được quản trị project shell và workspace access, nhưng approval business vẫn cần role phù hợp.',
      cards: defaultCards,
      focusPresets: [
        { id: 'active', label: 'Active', apply: () => ({ statusFilter: 'active' }) },
        { id: 'overdue', label: 'Task trễ', apply: () => ({ overdueOnly: true }) },
        { id: 'paused', label: 'Tạm dừng', apply: () => ({ statusFilter: 'paused' }) },
      ],
    },
    viewer: {
      title: 'Ảnh chụp nhanh dự án',
      subtitle: 'Một danh sách đọc nhanh để theo dõi project và vào workspace ở chế độ read-only.',
      createLabel: 'Tạo project shell',
      note: 'Viewer chỉ theo dõi trạng thái và mở workspace để xem, không thao tác project shell.',
      cards: defaultCards,
      focusPresets: [
        { id: 'active', label: 'Đang active', apply: () => ({ statusFilter: 'active' }) },
        { id: 'delivery', label: 'Delivery', apply: () => ({ stageFilter: 'delivery' }) },
        { id: 'completed', label: 'Hoàn thành', apply: () => ({ statusFilter: 'completed' }) },
      ],
    },
  };

  return byMode[mode];
}
