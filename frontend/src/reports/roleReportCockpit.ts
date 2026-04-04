import type { RolePersonaMode } from '../shared/domain/contracts';
import { tokens } from '../ui/tokens';

type Tone = 'info' | 'warn' | 'bad' | 'good';

export type WorkspaceHomePriority = {
  metricKey?: string;
  label?: string;
  value?: number;
  tone?: Tone;
};

export type WorkspaceHighlight = {
  projectId: string;
  projectCode?: string | null;
  projectName?: string | null;
  projectStage?: string | null;
  projectStatus?: string | null;
  accountName?: string | null;
  openTaskCount?: number | null;
  pendingApprovalCount?: number | null;
  missingDocumentCount?: number | null;
};

export type InboxItem = {
  entityId?: string;
  entityType?: string;
  title?: string;
  description?: string;
  department?: string;
  source?: string;
  projectName?: string | null;
};

export type ApprovalItem = {
  id: string;
  title?: string;
  requestType?: string;
  status?: string;
  department?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  requestedByName?: string | null;
  actionAvailability?: {
    lane?: string;
    canDecide?: boolean;
  };
};

export type HomePayload = {
  priorities?: WorkspaceHomePriority[];
  highlights?: WorkspaceHighlight[];
};

export type InboxPayload = {
  summary?: {
    totalCount?: number;
    documentCount?: number;
    blockedTaskCount?: number;
    notificationCount?: number;
  };
  items?: InboxItem[];
};

export type ApprovalsPayload = {
  summary?: {
    totalCount?: number;
    pendingCount?: number;
    executiveCount?: number;
    financeCount?: number;
    legalCount?: number;
    procurementCount?: number;
  };
  approvals?: ApprovalItem[];
};

export type PersonaReportCard = {
  label: string;
  value: number;
  tone: Tone;
};

export type PersonaReportPanelItem = {
  title: string;
  meta: string;
  badges?: Array<{ label: string; tone: Tone }>;
};

export type PersonaReportCockpit = {
  eyebrow: string;
  title: string;
  description: string;
  cards: PersonaReportCard[];
  focusTitle: string;
  focusDescription: string;
  focusItems: PersonaReportPanelItem[];
  watchTitle: string;
  watchDescription: string;
  watchItems: PersonaReportPanelItem[];
  footerNote: string;
};

export function toneColor(tone: Tone) {
  if (tone === 'bad') return tokens.colors.error;
  if (tone === 'warn') return tokens.colors.warning;
  if (tone === 'good') return tokens.colors.success;
  return tokens.colors.primary;
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function topPriorities(priorities: WorkspaceHomePriority[] = []) {
  return priorities
    .filter((item) => item.label)
    .slice(0, 4)
    .map((item) => ({
      label: String(item.label),
      value: numberValue(item.value),
      tone: (item.tone || 'info') as Tone,
    }));
}

function buildProjectItems(highlights: WorkspaceHighlight[] = []): PersonaReportPanelItem[] {
  return highlights.slice(0, 4).map((project) => ({
    title: `${project.projectCode ? `${project.projectCode} · ` : ''}${project.projectName || 'Dự án chưa đặt tên'}`,
    meta: `${project.accountName || 'Chưa có account'} · Giai đoạn ${project.projectStage || 'new'} · Trạng thái ${project.projectStatus || 'pending'}`,
    badges: [
      { label: `${numberValue(project.openTaskCount)} công việc`, tone: 'info' as Tone },
      {
        label: `${numberValue(project.missingDocumentCount)} hồ sơ thiếu`,
        tone: numberValue(project.missingDocumentCount) > 0 ? 'bad' as Tone : 'good' as Tone,
      },
      {
        label: `${numberValue(project.pendingApprovalCount)} phê duyệt`,
        tone: numberValue(project.pendingApprovalCount) > 0 ? 'warn' as Tone : 'good' as Tone,
      },
    ],
  }));
}

function buildInboxItems(items: InboxItem[] = []): PersonaReportPanelItem[] {
  return items.slice(0, 4).map((item) => ({
    title: item.title || 'Mục inbox chưa đặt tên',
    meta: [item.projectName, item.department, item.source].filter(Boolean).join(' · ') || 'Mục inbox',
    badges: [
      {
        label: item.source === 'documents' ? 'Hồ sơ' : item.source === 'blocked_tasks' ? 'Đang chặn' : 'Thông báo',
        tone: item.source === 'documents' ? 'bad' as Tone : item.source === 'blocked_tasks' ? 'warn' as Tone : 'info' as Tone,
      },
    ],
  }));
}

function buildApprovalItems(approvals: ApprovalItem[] = []): PersonaReportPanelItem[] {
  return approvals.slice(0, 4).map((approval) => ({
    title: approval.title || approval.requestType || 'Yêu cầu phê duyệt',
    meta: [approval.projectCode, approval.projectName, approval.department].filter(Boolean).join(' · ') || 'Hàng đợi phê duyệt',
    badges: [
      {
        label: approval.actionAvailability?.lane === 'executive'
          ? 'Điều hành'
          : approval.actionAvailability?.lane === 'finance'
            ? 'Tài chính'
            : approval.actionAvailability?.lane === 'legal'
              ? 'Pháp lý'
              : approval.actionAvailability?.lane === 'procurement'
                ? 'Mua hàng'
                : 'Thương mại',
        tone:
          approval.actionAvailability?.lane === 'executive'
            ? 'bad' as Tone
            : approval.actionAvailability?.lane === 'finance' || approval.actionAvailability?.lane === 'legal'
              ? 'warn' as Tone
              : 'info' as Tone,
      },
      {
        label: approval.actionAvailability?.canDecide ? 'Có thể quyết định' : 'Chỉ theo dõi',
        tone: approval.actionAvailability?.canDecide ? 'good' as Tone : 'warn' as Tone,
      },
    ],
  }));
}

export function buildPersonaReportCockpit(
  mode: RolePersonaMode,
  home: HomePayload,
  inbox: InboxPayload,
  approvals: ApprovalsPayload,
): PersonaReportCockpit {
  const priorityCards = topPriorities(home.priorities);
  const projectItems = buildProjectItems(home.highlights);
  const inboxItems = buildInboxItems(inbox.items);
  const approvalItems = buildApprovalItems(approvals.approvals);

  const defaultCards = [
    { label: 'Phê duyệt chờ', value: numberValue(approvals.summary?.pendingCount), tone: 'warn' as Tone },
    { label: 'Ngoại lệ inbox', value: numberValue(inbox.summary?.totalCount), tone: 'bad' as Tone },
    { label: 'Dự án trong tầm nhìn', value: home.highlights?.length || 0, tone: 'good' as Tone },
  ];

  const byMode: Record<RolePersonaMode, PersonaReportCockpit> = {
    sales: {
      eyebrow: 'Cockpit sales',
      title: 'Hiệu suất thương mại và handoff',
      description: 'Theo dõi pipeline, approval blockers và những project đang bắt đầu chạm ngưỡng handoff để chốt thương mại sạch hơn.',
      cards: priorityCards.length ? priorityCards : defaultCards,
      focusTitle: 'Deal và dự án cần ưu tiên',
      focusDescription: 'Những account hoặc dự án cần ưu tiên để chốt hoặc giữ nhịp handoff.',
      focusItems: projectItems,
      watchTitle: 'Tín hiệu approval và inbox',
      watchDescription: 'Hàng đợi thương mại, hồ sơ thiếu và các ngoại lệ đang cản tốc độ chốt deal.',
      watchItems: [...approvalItems.slice(0, 2), ...inboxItems.slice(0, 2)],
      footerNote: 'Sales xem bức tranh thương mại và bàn giao. Các làn finance/legal vẫn chỉ ở mức theo dõi nếu chưa có quyền tương ứng.',
    },
    project_manager: {
      eyebrow: 'Cockpit PM',
      title: 'Tháp điều phối từ thương mại tới giao hàng',
      description: 'Một cockpit xuyên suốt từ báo giá, bàn giao đến triển khai để PM không phải đổi ngữ cảnh.',
      cards: priorityCards.length ? priorityCards : defaultCards,
      focusTitle: 'Dự án xuyên pha',
      focusDescription: 'Những project vừa có sức ép chốt deal vừa có sức ép triển khai.',
      focusItems: projectItems,
      watchTitle: 'Ngoại lệ hợp nhất',
      watchDescription: 'Tổ hợp phê duyệt và ngoại lệ inbox đang đe dọa biên lợi nhuận hoặc tiến độ.',
      watchItems: [...approvalItems.slice(0, 2), ...inboxItems.slice(0, 2)],
      footerNote: 'PM nên thấy cả tín hiệu sales lẫn triển khai, nhưng quyền thao tác thực vẫn phụ thuộc capability đang có.',
    },
    procurement: {
      eyebrow: 'Cockpit mua hàng',
      title: 'Áp lực nguồn cung và rủi ro giao hàng',
      description: 'Nhìn nhanh thiếu hàng, ETA trễ, PO backlog và các ngoại lệ từ nhà cung cấp đang lan sang giao hàng.',
      cards: priorityCards.length ? priorityCards : defaultCards,
      focusTitle: 'Dự án có rủi ro nguồn cung',
      focusDescription: 'Project nào đang có rủi ro thiếu hàng, trễ ETA hoặc backlog mua hàng.',
      focusItems: projectItems,
      watchTitle: 'Ngoại lệ procurement',
      watchDescription: 'Các item từ inbox và approval lane mua hàng cần xử lý trước.',
      watchItems: [...inboxItems.slice(0, 2), ...approvalItems.slice(0, 2)],
      footerNote: 'Procurement cockpit tập trung vào nhà cung cấp, ETA và rủi ro giao hàng; không mở sâu chỉnh sửa pricing/commercial.',
    },
    accounting: {
      eyebrow: 'Cockpit tài chính',
      title: 'Mốc thanh toán và approval tài chính',
      description: 'Tập trung phê duyệt tài chính, công nợ rủi ro và các hồ sơ còn thiếu ảnh hưởng invoice hoặc luồng ERP.',
      cards: priorityCards.length ? priorityCards : defaultCards,
      focusTitle: 'Dự án liên quan tài chính',
      focusDescription: 'Những project đang cần can thiệp ở payment state, milestone hoặc chứng từ.',
      focusItems: projectItems,
      watchTitle: 'Hàng đợi tài chính',
      watchDescription: 'Approval tài chính và mục inbox cần follow-up ngay.',
      watchItems: [...approvalItems.slice(0, 2), ...inboxItems.slice(0, 2)],
      footerNote: 'Finance cockpit là lớp review và theo dõi tiếp. Quyền duyệt chỉ xuất hiện đúng làn tài chính.',
    },
    legal: {
      eyebrow: 'Cockpit pháp lý',
      title: 'Review hợp đồng và rủi ro pháp lý',
      description: 'Theo dõi hợp đồng chờ review, deviation và các hồ sơ thiếu đang làm chậm commercial hoặc delivery.',
      cards: priorityCards.length ? priorityCards : defaultCards,
      focusTitle: 'Hợp đồng cần chú ý',
      focusDescription: 'Những project có sức ép review hợp đồng hoặc legal backlog cao.',
      focusItems: projectItems,
      watchTitle: 'Hàng đợi pháp lý',
      watchDescription: 'Phê duyệt pháp lý và ngoại lệ hồ sơ đang cần quyết định hoặc phản hồi.',
      watchItems: [...approvalItems.slice(0, 2), ...inboxItems.slice(0, 2)],
      footerNote: 'Legal cockpit thiên về review, deviation và độ đầy đủ hồ sơ, không cấp quyền chỉnh sửa finance/commercial.',
    },
    director: {
      eyebrow: 'Cockpit điều hành',
      title: 'Tháp điều phối điều hành',
      description: 'Theo dõi rủi ro, điểm nghẽn và phê duyệt vượt ngưỡng ở cấp điều hành.',
      cards: priorityCards.length ? priorityCards : defaultCards,
      focusTitle: 'Dự án có rủi ro cao',
      focusDescription: 'Những project có rủi ro cao nhất theo approvals, missing docs và open tasks.',
      focusItems: projectItems,
      watchTitle: 'Hàng đợi điều hành',
      watchDescription: 'Các quyết định lane điều hành cần phản ứng nhanh.',
      watchItems: approvalItems,
      footerNote: 'Director cockpit ưu tiên rủi ro và escalations, không đi sâu thao tác vận hành hằng ngày.',
    },
    admin: {
      eyebrow: 'Giám sát admin',
      title: 'Giám sát hệ thống và tín hiệu hỗ trợ',
      description: 'Lớp quan sát toàn cục cho admin để hỗ trợ quy trình, phân quyền và vận hành hệ thống mà không biến admin thành approver business mặc định.',
      cards: priorityCards.length ? priorityCards : defaultCards,
      focusTitle: 'Dự án cần hỗ trợ',
      focusDescription: 'Những workspace đang có nhiều blockers, pending approvals hoặc hồ sơ thiếu cần admin can thiệp vận hành.',
      focusItems: projectItems,
      watchTitle: 'Danh sách theo dõi hệ thống',
      watchDescription: 'Danh sách phê duyệt và ngoại lệ inbox để admin hỗ trợ đúng chỗ, không vượt ranh giới quyền nghiệp vụ.',
      watchItems: [...approvalItems.slice(0, 2), ...inboxItems.slice(0, 2)],
      footerNote: 'Admin chỉ quan sát và hỗ trợ quy trình. Các làn finance, legal, executive vẫn cần role business tương ứng.',
    },
    viewer: {
      eyebrow: 'Cockpit viewer',
      title: 'Ảnh chụp nhanh dự án chỉ xem',
      description: 'Một màn đọc nhanh để theo dõi dự án, ngoại lệ và phê duyệt liên quan mà không can thiệp quy trình.',
      cards: priorityCards.length ? priorityCards : defaultCards,
      focusTitle: 'Dự án đang theo dõi',
      focusDescription: 'Các dự án đang được theo dõi trong chế độ chỉ xem.',
      focusItems: projectItems,
      watchTitle: 'Danh sách theo dõi chỉ xem',
      watchDescription: 'Các phê duyệt và tín hiệu inbox liên quan để nắm tình hình.',
      watchItems: [...approvalItems.slice(0, 2), ...inboxItems.slice(0, 2)],
      footerNote: 'Viewer chỉ theo dõi. Không có action phê duyệt hoặc chỉnh sửa từ cockpit này.',
    },
  };

  return byMode[mode];
}
