import type { RolePersonaMode } from '../shared/domain/contracts';

export type WorkAction = {
  label: string;
  hint: string;
  route?: string;
  tone: 'primary' | 'secondary' | 'ghost';
  navContext?: any;
};

export function buildMyWorkActions(
  mode: RolePersonaMode,
  summary: {
    taskCount?: number;
    approvalCount?: number;
    projectCount?: number;
    blockedTaskCount?: number;
    overdueTaskCount?: number;
    pendingApprovalCount?: number;
  } | undefined,
  workFocus?: string,
) {
  const blocked = Number(summary?.blockedTaskCount || 0);
  const pendingApprovals = Number(summary?.pendingApprovalCount || 0);
  const tasks = Number(summary?.taskCount || 0);

  const byMode: Record<string, WorkAction[]> = {
    sales: [
      {
        label: pendingApprovals > 0 ? 'Dọn commercial approvals' : 'Đẩy sales queue',
        hint: pendingApprovals > 0 ? `${pendingApprovals} approval đang chờ ở commercial flow.` : `${tasks} item cần follow-up hoặc handoff.`,
        route: pendingApprovals > 0 ? 'Approvals' : 'Sales',
        navContext: pendingApprovals > 0 ? { route: 'Approvals', filters: { approvalLane: 'commercial' } } : undefined,
        tone: 'primary',
      },
      {
        label: 'Mở commercial queue',
        hint: 'Đi vào My Work với focus thương mại.',
        route: 'My Work',
        navContext: { route: 'My Work', filters: { workFocus: 'commercial' } },
        tone: 'secondary',
      },
      {
        label: 'Rà projects nóng',
        hint: 'Mở danh sách project để chốt handoff hoặc commercial blockers.',
        route: 'Projects',
        tone: 'ghost',
      },
    ],
    project_manager: [
      {
        label: blocked > 0 || pendingApprovals > 0 ? 'Giữ nhịp PM queue' : 'Đi qua My Work hợp nhất',
        hint: blocked > 0 ? `${blocked} blocker đang ảnh hưởng execution.` : `${pendingApprovals} approval đang chạm margin hoặc timeline.`,
        route: 'My Work',
        navContext: { route: 'My Work', filters: { workFocus: 'execution' } },
        tone: 'primary',
      },
      {
        label: 'Mở approvals',
        hint: 'Rà các lane đang kéo chậm commercial hoặc delivery.',
        route: 'Approvals',
        tone: 'secondary',
      },
      {
        label: 'Mở projects',
        hint: 'Chuyển sang workspace của project đang nóng nhất.',
        route: 'Projects',
        tone: 'ghost',
      },
    ],
    procurement: [
      {
        label: blocked > 0 ? 'Giải quyết supply blockers' : 'Mở procurement queue',
        hint: blocked > 0 ? `${blocked} task đang bị chặn bởi vendor hoặc delivery.` : `${tasks} item đang chờ follow-up supplier/ETA.`,
        route: 'Inbox',
        navContext: { route: 'Inbox', filters: { department: 'procurement' } },
        tone: 'primary',
      },
      {
        label: 'Xem procurement projects',
        hint: 'Đi vào danh sách project theo góc nhìn supply risk.',
        route: 'Projects',
        tone: 'secondary',
      },
      {
        label: 'Rà supplier approvals',
        hint: 'Mở approval queue mua hàng nếu đang có exception.',
        route: 'Approvals',
        navContext: { route: 'Approvals', filters: { approvalLane: 'procurement' } },
        tone: 'ghost',
      },
    ],
    accounting: [
      {
        label: pendingApprovals > 0 ? 'Giải quyết finance approvals' : 'Mở finance queue',
        hint: pendingApprovals > 0 ? `${pendingApprovals} approval đang chờ quyết định tài chính.` : `${tasks} item cần follow-up payment/docs.`,
        route: 'Approvals',
        navContext: { route: 'Approvals', filters: { approvalLane: 'finance' } },
        tone: 'primary',
      },
      {
        label: 'Mở role cockpit',
        hint: 'Xem dashboard tài chính theo persona.',
        route: 'Reports',
        tone: 'secondary',
      },
      {
        label: 'Rà finance-facing projects',
        hint: 'Đi vào danh sách project có payment pressure.',
        route: 'Projects',
        tone: 'ghost',
      },
    ],
    legal: [
      {
        label: pendingApprovals > 0 ? 'Giải quyết legal approvals' : 'Mở legal queue',
        hint: pendingApprovals > 0 ? `${pendingApprovals} approval pháp lý đang pending.` : `${tasks} item cần legal review hoặc follow-up hồ sơ.`,
        route: 'Approvals',
        navContext: { route: 'Approvals', filters: { approvalLane: 'legal' } },
        tone: 'primary',
      },
      {
        label: 'Mở legal-facing projects',
        hint: 'Đi vào danh sách project cần contract review.',
        route: 'Projects',
        tone: 'secondary',
      },
      {
        label: 'Rà inbox hồ sơ',
        hint: 'Kiểm tra các legal package còn thiếu.',
        route: 'Inbox',
        tone: 'ghost',
      },
    ],
    director: [
      {
        label: pendingApprovals > 0 ? 'Quyết định executive queue' : 'Mở executive cockpit',
        hint: pendingApprovals > 0 ? `${pendingApprovals} approval vượt ngưỡng đang chờ.` : 'Xem risk và bottleneck ở cấp điều hành.',
        route: pendingApprovals > 0 ? 'Approvals' : 'Reports',
        navContext: pendingApprovals > 0 ? { route: 'Approvals', filters: { approvalLane: 'executive' } } : undefined,
        tone: 'primary',
      },
      {
        label: 'Mở project at-risk',
        hint: 'Đi vào danh sách project có risk signals.',
        route: 'Projects',
        tone: 'secondary',
      },
      {
        label: 'Xem escalations',
        hint: 'Tiếp tục theo dõi queue điều hành trong My Work.',
        route: 'My Work',
        navContext: { route: 'My Work' },
        tone: 'ghost',
      },
    ],
    admin: [
      {
        label: 'Theo dõi support queue',
        hint: `${tasks} task và ${pendingApprovals} approvals trong watchlist toàn cục.`,
        route: 'Support',
        tone: 'primary',
      },
      {
        label: 'Mở Users admin',
        hint: 'Rà account status và capability roles.',
        route: 'Users',
        tone: 'secondary',
      },
      {
        label: 'Xem oversight cockpit',
        hint: 'Mở role-based reports để support workflow.',
        route: 'Reports',
        tone: 'ghost',
      },
    ],
    viewer: [
      {
        label: 'Xem projects',
        hint: 'Đi vào danh sách project trong chế độ read-only.',
        route: 'Projects',
        tone: 'primary',
      },
      {
        label: 'Mở inbox',
        hint: 'Theo dõi exceptions liên quan.',
        route: 'Inbox',
        tone: 'secondary',
      },
      {
        label: 'Mở role cockpit',
        hint: 'Xem dashboard read-only theo persona.',
        route: 'Reports',
        tone: 'ghost',
      },
    ],
  };

  const actions = byMode[mode] || byMode.viewer;
  if (workFocus === 'commercial') {
    return actions.map((item, index) => index === 0 ? { ...item, hint: `${item.hint} Hiện đang ở commercial focus.` } : item);
  }
  if (workFocus === 'execution') {
    return actions.map((item, index) => index === 0 ? { ...item, hint: `${item.hint} Hiện đang ở execution focus.` } : item);
  }
  return actions;
}

export function buildApprovalsActions(
  mode: RolePersonaMode,
  laneFilter: string,
  summary: {
    totalCount?: number;
    pendingCount?: number;
    executiveCount?: number;
    financeCount?: number;
    legalCount?: number;
    procurementCount?: number;
  } | undefined,
) {
  const pendingCount = Number(summary?.pendingCount || 0);
  const byLane = laneFilter || '';

  const baseByMode: Record<string, WorkAction[]> = {
    sales: [
      {
        label: byLane === 'commercial' ? 'Xử lý commercial lane' : 'Mở commercial approvals',
        hint: `${pendingCount} approval đang ở commercial watchlist hoặc liên quan handoff.`,
        route: 'Approvals',
        navContext: { route: 'Approvals', filters: { approvalLane: 'commercial' } },
        tone: 'primary',
      },
      {
        label: 'Mở sales queue',
        hint: 'Quay lại My Work để xử lý follow-up và quotation impact.',
        route: 'My Work',
        navContext: { route: 'My Work', filters: { workFocus: 'commercial' } },
        tone: 'secondary',
      },
      {
        label: 'Rà projects',
        hint: 'Chuyển sang project list để vào workspace nóng.',
        route: 'Projects',
        tone: 'ghost',
      },
    ],
    project_manager: [
      {
        label: 'Giữ unified approval flow',
        hint: `${pendingCount} approval đang ảnh hưởng commercial hoặc execution cùng lúc.`,
        route: 'Approvals',
        tone: 'primary',
      },
      {
        label: 'Quay lại PM queue',
        hint: 'Mở My Work để tiếp tục xử lý handoff, blocker và execution follow-up.',
        route: 'My Work',
        navContext: { route: 'My Work', filters: { workFocus: 'execution' } },
        tone: 'secondary',
      },
      {
        label: 'Mở projects',
        hint: 'Đi sang project list để drill down theo workspace.',
        route: 'Projects',
        tone: 'ghost',
      },
    ],
    procurement: [
      {
        label: 'Mở procurement lane',
        hint: `${Number(summary?.procurementCount || 0)} approval thuộc supply/vendor flow.`,
        route: 'Approvals',
        navContext: { route: 'Approvals', filters: { approvalLane: 'procurement' } },
        tone: 'primary',
      },
      {
        label: 'Quay lại supply inbox',
        hint: 'Rà shortage, ETA và vendor exceptions.',
        route: 'Inbox',
        navContext: { route: 'Inbox', filters: { department: 'procurement' } },
        tone: 'secondary',
      },
      {
        label: 'Mở procurement projects',
        hint: 'Đi sang project list theo supply risk.',
        route: 'Projects',
        tone: 'ghost',
      },
    ],
    accounting: [
      {
        label: 'Mở finance lane',
        hint: `${Number(summary?.financeCount || 0)} approval tài chính đang cần quyết định.`,
        route: 'Approvals',
        navContext: { route: 'Approvals', filters: { approvalLane: 'finance' } },
        tone: 'primary',
      },
      {
        label: 'Quay lại finance queue',
        hint: 'Xử lý tiếp các task payment/docs trong My Work.',
        route: 'My Work',
        tone: 'secondary',
      },
      {
        label: 'Mở finance cockpit',
        hint: 'Xem role-based report để ưu tiên đúng project.',
        route: 'Reports',
        tone: 'ghost',
      },
    ],
    legal: [
      {
        label: 'Mở legal lane',
        hint: `${Number(summary?.legalCount || 0)} approval pháp lý đang pending.`,
        route: 'Approvals',
        navContext: { route: 'Approvals', filters: { approvalLane: 'legal' } },
        tone: 'primary',
      },
      {
        label: 'Quay lại legal queue',
        hint: 'Xử lý tiếp contract/doc follow-up trong My Work.',
        route: 'My Work',
        tone: 'secondary',
      },
      {
        label: 'Mở legal-facing projects',
        hint: 'Drill-down sang project list có legal pressure.',
        route: 'Projects',
        tone: 'ghost',
      },
    ],
    director: [
      {
        label: 'Mở executive lane',
        hint: `${Number(summary?.executiveCount || 0)} approval vượt ngưỡng đang chờ.`,
        route: 'Approvals',
        navContext: { route: 'Approvals', filters: { approvalLane: 'executive' } },
        tone: 'primary',
      },
      {
        label: 'Mở executive cockpit',
        hint: 'Xem risk và bottleneck ở cấp điều hành.',
        route: 'Reports',
        tone: 'secondary',
      },
      {
        label: 'Mở project at-risk',
        hint: 'Chuyển sang project list để vào workspace cần quyết định.',
        route: 'Projects',
        tone: 'ghost',
      },
    ],
    admin: [
      {
        label: 'Theo dõi approval watchlist',
        hint: `${pendingCount} approval đang mở. Admin chỉ support workflow, không mặc định là approver business.`,
        route: 'Reports',
        tone: 'primary',
      },
      {
        label: 'Mở support center',
        hint: 'Đi vào support/admin layer nếu workflow đang nghẽn do vận hành hệ thống.',
        route: 'Support',
        tone: 'secondary',
      },
      {
        label: 'Quản lý users',
        hint: 'Rà capability roles nếu approval visibility đang sai.',
        route: 'Users',
        tone: 'ghost',
      },
    ],
    viewer: [
      {
        label: 'Theo dõi watchlist',
        hint: 'Giữ chế độ read-only trên approval queue.',
        route: 'Approvals',
        tone: 'primary',
      },
      {
        label: 'Mở projects',
        hint: 'Chuyển sang project list để đọc thêm context.',
        route: 'Projects',
        tone: 'secondary',
      },
      {
        label: 'Mở inbox',
        hint: 'Xem thêm exceptions liên quan.',
        route: 'Inbox',
        tone: 'ghost',
      },
    ],
  };

  return baseByMode[mode] || baseByMode.viewer;
}
