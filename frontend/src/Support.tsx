import { useEffect, useState } from 'preact/hooks';
import { API_BASE } from './config';
import { fetchWithAuth } from './auth';
import { showNotify } from './Notification';
import { buildRoleProfile } from './shared/domain/contracts';
import { buildSupportTicketPrimaryAction, canManageSupportTicket } from './support/supportTicketActions';
import { OverlayModal } from './ui/OverlayModal';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import {
  BookIcon,
  CheckCircle2Icon,
  HistoryIcon,
  ImportIcon,
  MoneyIcon,
  QuoteIcon,
  RefreshIcon,
  SupportIcon,
  TargetIcon,
  UsersIcon,
  WarningIcon,
} from './ui/icons';

type SupportTicket = {
  id: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  responseNote?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  actionAvailability?: {
    supportTab?: string | null;
    canOpenTicket?: boolean;
    canManageTicket?: boolean;
    primaryActionLabel?: string | null;
    blockers?: string[];
  } | null;
};

type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  eyebrow: string;
  icon: any;
  sections: Array<{ title: string; body: string }>;
};

const ROLE_HELP_COPY: Record<string, { title: string; subtitle: string; recommended: string[] }> = {
  sales: {
    title: 'Sales Help Center',
    subtitle: 'Ưu tiên các hướng dẫn về quotation, pricing và funnel để chốt deal nhanh hơn mà không làm bẩn handoff.',
    recommended: ['quotation', 'pricing', 'funnel'],
  },
  project_manager: {
    title: 'PM Help Center',
    subtitle: 'Một lớp hướng dẫn xuyên từ quotation, handoff data tới execution cho PM đang giữ luôn commercial flow.',
    recommended: ['quotation', 'pricing', 'funnel'],
  },
  procurement: {
    title: 'Procurement Help Center',
    subtitle: 'Tập trung vào dữ liệu line item, import, và các nội dung hỗ trợ theo dõi ETA, vendor và delivery risk.',
    recommended: ['import', 'pricing', 'quotation'],
  },
  accounting: {
    title: 'Finance Help Center',
    subtitle: 'Dùng màn này để theo dõi ticket hỗ trợ, cấu hình dữ liệu và các hướng dẫn giúp giữ hồ sơ tài chính sạch.',
    recommended: ['import', 'branding', 'users'],
  },
  legal: {
    title: 'Legal Help Center',
    subtitle: 'Ưu tiên tài liệu liên quan hồ sơ hợp đồng, phân quyền và các ticket cần phối hợp với admin hoặc commercial.',
    recommended: ['quotation', 'users', 'branding'],
  },
  director: {
    title: 'Executive Help Center',
    subtitle: 'Một điểm vào gọn cho tài liệu hệ thống, support ticket và những thay đổi có thể ảnh hưởng tới toàn bộ workflow.',
    recommended: ['users', 'branding', 'funnel'],
  },
  admin: {
    title: 'Admin Help Center',
    subtitle: 'Admin dùng màn này để xử lý support ticket, hướng dẫn người dùng và giữ cho lớp vận hành hệ thống không trở thành approval lane nghiệp vụ.',
    recommended: ['users', 'import', 'branding'],
  },
  viewer: {
    title: 'Role Help Center',
    subtitle: 'Xem nhanh tài liệu phù hợp và gửi yêu cầu hỗ trợ khi cần, trong phạm vi read-only của bạn.',
    recommended: ['quotation', 'import', 'funnel'],
  },
};

const API = API_BASE;

const CATEGORY_OPTIONS = [
  { value: 'bug', label: 'Lỗi hệ thống' },
  { value: 'feature-request', label: 'Yêu cầu tính năng mới' },
  { value: 'access', label: 'Quên mật khẩu / phân quyền' },
  { value: 'other', label: 'Khác' },
];

const STATUS_META: Record<string, { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' }> = {
  open: { label: 'Mới tiếp nhận', tone: 'warning' },
  in_progress: { label: 'Đang xử lý', tone: 'info' },
  resolved: { label: 'Đã xử lý', tone: 'success' },
  closed: { label: 'Đã đóng', tone: 'neutral' },
};

const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'import',
    title: 'Hướng dẫn Import Dữ liệu',
    summary: 'Cách xử lý file CSV/Excel cho Khách hàng, Liên hệ và Sản phẩm.',
    eyebrow: 'Data onboarding',
    icon: <ImportIcon size={24} />,
    sections: [
      { title: '1. Chuẩn bị file', body: 'Dùng đúng mẫu CSV của từng module. Giữ nguyên tiêu đề cột, không đổi tên sheet, và kiểm tra các trường bắt buộc như tên công ty, SKU hoặc email trước khi tải lên.' },
      { title: '2. Làm sạch dữ liệu', body: 'Xóa dòng trống, tránh ký tự thừa ở đầu cuối ô dữ liệu, chuẩn hóa định dạng số điện thoại và email, đồng thời đảm bảo mỗi mã sản phẩm hoặc mã nhân viên là duy nhất.' },
      { title: '3. Kiểm tra sau import', body: 'Sau khi import, dùng ô tìm kiếm của module để kiểm tra ngẫu nhiên vài dòng. Nếu có lỗi, sửa file nguồn rồi import lại thay vì chỉnh tay hàng loạt trong hệ thống.' },
    ],
  },
  {
    id: 'quotation',
    title: 'Tạo Báo giá Chuyên nghiệp',
    summary: 'Quy trình tạo Quotation, áp dụng thuế và chiết khấu.',
    eyebrow: 'Sales execution',
    icon: <QuoteIcon size={24} />,
    sections: [
      { title: '1. Tạo báo giá từ account đúng', body: 'Luôn chọn đúng khách hàng, liên hệ và dự án trước khi thêm line item. Điều này giúp báo giá đồng bộ xuyên suốt sang phê duyệt, sales order và project workspace.' },
      { title: '2. Kiểm tra financial params', body: 'Xác nhận VAT, discount, currency và validity date trước khi gửi. Sai ở phần này thường gây lệch tổng tiền, phải revise lại báo giá hoặc ảnh hưởng quyết định chốt.' },
      { title: '3. Chuyển trạng thái đúng thời điểm', body: 'Chỉ chuyển sang sent hoặc accepted khi nội dung đã đủ chuẩn. Khi báo giá được accepted, hệ thống có thể sinh công việc follow-up và tín hiệu vận hành tương ứng.' },
    ],
  },
  {
    id: 'pricing',
    title: 'Quản lý QBU (Giá vốn)',
    summary: 'Cách cấu hình chi phí đầu vào và tính toán biên lợi nhuận.',
    eyebrow: 'Margin control',
    icon: <MoneyIcon size={24} />,
    sections: [
      { title: '1. Tạo QBU gốc trước', body: 'Mỗi dự án nên có một QBU gốc để làm baseline. Khi phát sinh thay đổi, dùng batch bổ sung thay vì ghi đè toàn bộ để giữ lịch sử và so sánh chênh lệch.' },
      { title: '2. Cập nhật line item theo routing', body: 'Phân tách rõ chi phí mua, chi phí vận hành, bảo trì và actual cost. Điều này giúp phần pricing và phần execution dùng cùng một nguồn dữ liệu đáng tin cậy.' },
      { title: '3. Trình QBU đúng stage', body: 'Chỉ submit khi draft đã đầy đủ line item và cấu hình. Nếu khóa draft quá sớm hoặc submit thiếu dữ liệu, đội sales và ops sẽ phải quay lại sửa nhiều vòng.' },
    ],
  },
  {
    id: 'funnel',
    title: 'Theo dõi Phễu Bán hàng',
    summary: 'Sử dụng Leads, Quotations và Dashboard để quản lý cơ hội kinh doanh.',
    eyebrow: 'Pipeline visibility',
    icon: <TargetIcon size={24} />,
    sections: [
      { title: '1. Giữ trạng thái lead sạch', body: 'Lead cần được cập nhật đều để dashboard và funnel phản ánh đúng tình trạng bán hàng. Trạng thái không cập nhật sẽ làm số liệu pipeline sai và khó ưu tiên cơ hội.' },
      { title: '2. Chuyển từ lead sang quotation có kiểm soát', body: 'Chỉ tạo quotation khi đã đủ thông tin tối thiểu: nhu cầu, khách hàng, đầu mối, và định hướng giải pháp. Tránh tạo báo giá quá sớm khiến pipeline bị phình ảo.' },
      { title: '3. Xem activity để bắt nhịp follow-up', body: 'Recent activities và event log giúp nhìn được điểm chạm gần nhất với khách hàng. Dùng chúng để quyết định nên follow-up ai trước và bằng kênh nào.' },
    ],
  },
  {
    id: 'users',
    title: 'Phân quyền Nhân viên',
    summary: 'Thiết lập role, trạng thái tài khoản và phạm vi xử lý trong hệ thống.',
    eyebrow: 'Access control',
    icon: <UsersIcon size={24} />,
    sections: [
      { title: '1. Chọn đúng system role', body: 'Admin và manager có nhiều quyền hơn sales/viewer. Khi cấp role, hãy bám theo phạm vi công việc thật thay vì cấp rộng tay để tránh rủi ro thao tác nhầm hoặc lộ dữ liệu.' },
      { title: '2. Theo dõi trạng thái tài khoản', body: 'Khóa tài khoản cũ hoặc tạm ngưng ngay khi có thay đổi nhân sự. Trạng thái accountStatus và cờ mustChangePassword là hai điểm cần kiểm tra đầu tiên khi có sự cố đăng nhập.' },
      { title: '3. Chuẩn hóa hồ sơ nhân viên', body: 'Email, employee code và username nên nhất quán để sau này dễ tìm kiếm, import dữ liệu và đối chiếu các activity/ticket theo người phụ trách.' },
    ],
  },
  {
    id: 'branding',
    title: 'Cấu hình PDF Logo',
    summary: 'Cách thay đổi thương hiệu hiển thị trên báo giá và tài liệu in.',
    eyebrow: 'Brand output',
    icon: <BookIcon size={24} />,
    sections: [
      { title: '1. Kiểm tra asset nguồn', body: 'Dùng logo nền trong suốt, độ phân giải đủ lớn, và tên file rõ ràng. Asset chất lượng thấp sẽ làm PDF bị mờ hoặc vỡ nét khi in.' },
      { title: '2. Test trên một báo giá mẫu', body: 'Sau khi thay logo, hãy export thử một báo giá có nhiều dòng hàng và chú ý vùng header, footer, căn lề và độ tương phản giữa logo với nền.' },
      { title: '3. Chốt trước khi dùng đại trà', body: 'Nếu đang trong giai đoạn chạy nhiều báo giá cho khách, nên test và chốt logo ngoài giờ làm việc hoặc trên bản nháp để tránh ảnh hưởng tài liệu đang gửi thật.' },
    ],
  },
];

function formatDateTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function categoryLabel(value: string) {
  const match = CATEGORY_OPTIONS.find((item) => item.value === value);
  return match?.label || value || 'Khác';
}

function statusBadge(status: string) {
  const meta = STATUS_META[status] || STATUS_META.open;
  return ui.badge[meta.tone];
}

export function Support({ isMobile, currentUser, onNavigate }: { isMobile?: boolean; currentUser?: any; onNavigate?: (route: string) => void } = {}) {
  const profile = buildRoleProfile(currentUser?.roleCodes, currentUser?.systemRole);
  const helpCopy = ROLE_HELP_COPY[profile.personaMode] || ROLE_HELP_COPY.viewer;
  const recommendedArticleOrder = [
    ...helpCopy.recommended,
    ...HELP_ARTICLES.map((item) => item.id).filter((id) => !helpCopy.recommended.includes(id)),
  ];
  const orderedArticles = recommendedArticleOrder
    .map((id) => HELP_ARTICLES.find((item) => item.id === id))
    .filter(Boolean) as HelpArticle[];
  const [activeSupportTab, setActiveSupportTab] = useState('Help');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [submitSaving, setSubmitSaving] = useState(false);
  const [adminScope, setAdminScope] = useState<'all' | 'mine'>('all');
  const [adminDrafts, setAdminDrafts] = useState<Record<string, { status: string; responseNote: string; saving?: boolean }>>({});
  const [form, setForm] = useState({
    category: 'bug',
    subject: '',
    description: '',
  });

  const token = currentUser?.token || '';
  const isPrivileged = ['admin', 'manager'].includes(String(currentUser?.systemRole || '').toLowerCase());
  const openTickets = tickets.filter((ticket) => ticket.status === 'open').length;
  const inProgressTickets = tickets.filter((ticket) => ticket.status === 'in_progress').length;
  const resolvedTickets = tickets.filter((ticket) => ticket.status === 'resolved').length;

  const S = {
    card: {
      background: tokens.colors.surface,
      borderRadius: tokens.radius.xl,
      padding: '32px',
      border: `1px solid ${tokens.colors.border}`,
      boxShadow: tokens.shadow.sm,
    },
    header: {
      fontSize: '28px',
      fontWeight: 800,
      color: tokens.colors.textPrimary,
      marginBottom: '10px',
    },
    subtitle: {
      fontSize: '15px',
      color: tokens.colors.textSecondary,
      marginBottom: '40px',
    },
    guideCard: {
      padding: '24px',
      background: tokens.colors.background,
      borderRadius: tokens.radius.lg,
      border: `1px solid ${tokens.colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      minHeight: '220px',
    },
    eyebrow: {
      fontSize: '11px',
      fontWeight: 800,
      color: tokens.colors.primary,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    },
    input: {
      ...ui.input.base,
      width: '100%',
    },
    label: {
      ...ui.form.label,
      fontSize: '13px',
      marginBottom: '8px',
      display: 'block',
    },
  } as const;

  const loadTickets = async (scope = adminScope) => {
    if (!token) {
      setTickets([]);
      setTicketsError(null);
      return;
    }

    setTicketsLoading(true);
    try {
      const url = isPrivileged ? `${API}/support/tickets?scope=${scope}&limit=50` : `${API}/support/tickets?limit=50`;
      const res = await fetchWithAuth(token, url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Không thể tải ticket (${res.status})`);
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      setTickets(items);
      setAdminDrafts((prev) => {
        const next = { ...prev };
        for (const ticket of items) {
          next[ticket.id] = {
            status: next[ticket.id]?.status || ticket.status || 'open',
            responseNote: next[ticket.id]?.responseNote ?? ticket.responseNote ?? '',
            saving: false,
          };
        }
        return next;
      });
      setTicketsError(null);
    } catch (error: any) {
      setTicketsError(error?.message || 'Không thể tải danh sách hỗ trợ');
    } finally {
      setTicketsLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets(adminScope);
  }, [token, adminScope]);

  const submitTicket = async () => {
    if (!token) {
      showNotify('Bạn cần đăng nhập lại để gửi yêu cầu hỗ trợ.', 'error');
      return;
    }

    if (!form.subject.trim() || !form.description.trim()) {
      showNotify('Vui lòng nhập tiêu đề và mô tả chi tiết.', 'error');
      return;
    }

    setSubmitSaving(true);
    try {
      const res = await fetchWithAuth(token, `${API}/support/tickets`, {
        method: 'POST',
        body: JSON.stringify({
          category: form.category,
          subject: form.subject.trim(),
          description: form.description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const fieldMessage = data?.fields ? Object.values(data.fields).join(' | ') : null;
        throw new Error(fieldMessage || data?.error || `Gửi yêu cầu thất bại (${res.status})`);
      }
      setForm({ category: 'bug', subject: '', description: '' });
      showNotify('Yêu cầu hỗ trợ đã được gửi thành công.', 'success');
      await loadTickets(adminScope);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể gửi yêu cầu hỗ trợ.', 'error');
    } finally {
      setSubmitSaving(false);
    }
  };

  const saveAdminUpdate = async (ticketId: string) => {
    const draft = adminDrafts[ticketId];
    if (!draft || !token) return;

    setAdminDrafts((prev) => ({
      ...prev,
      [ticketId]: { ...prev[ticketId], saving: true },
    }));

    try {
      const res = await fetchWithAuth(token, `${API}/support/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: draft.status,
          responseNote: draft.responseNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Cập nhật ticket thất bại (${res.status})`);
      }
      showNotify('Đã cập nhật ticket hỗ trợ.', 'success');
      await loadTickets(adminScope);
    } catch (error: any) {
      showNotify(error?.message || 'Không thể cập nhật ticket.', 'error');
      setAdminDrafts((prev) => ({
        ...prev,
        [ticketId]: { ...prev[ticketId], saving: false },
      }));
    }
  };

  const HelpCenter = () => (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px' }}>
      {orderedArticles.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setSelectedArticle(item)}
          style={{ ...S.guideCard, textAlign: 'left' as const }}
        >
          <div style={S.eyebrow}>{index < helpCopy.recommended.length ? `Recommended · ${item.eyebrow}` : item.eyebrow}</div>
          <div style={{ width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: tokens.colors.primary }}>{item.icon}</div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: tokens.colors.textPrimary }}>{item.title}</div>
          <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>{item.summary}</div>
          <div style={{ marginTop: 'auto', fontWeight: 800, fontSize: '11px', color: tokens.colors.primary }}>BẮT ĐẦU ĐỌC →</div>
        </button>
      ))}
    </div>
  );

  const TicketPanel = () => (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: '24px' }}>
      <div style={{ ...S.card, padding: isMobile ? '24px' : '32px' }}>
        <h3 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <SupportIcon size={18} /> Gửi yêu cầu hỗ trợ kỹ thuật
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={S.label}>VẤN ĐỀ CẦN GIẢI QUYẾT</label>
            <select
              style={S.input}
              value={form.category}
              onChange={(event: any) => setForm((prev) => ({ ...prev, category: event.currentTarget.value }))}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>TIÊU ĐỀ NGẮN</label>
            <input
              style={S.input}
              value={form.subject}
              onInput={(event: any) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Ví dụ: Không export được báo giá PDF"
            />
          </div>
          <div>
            <label style={S.label}>MÔ TẢ CHI TIẾT</label>
            <textarea
              style={{ ...S.input, minHeight: '150px', resize: 'vertical' as const }}
              value={form.description}
              onInput={(event: any) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Mô tả rõ thao tác, màn hình và lỗi đang gặp để đội kỹ thuật xử lý nhanh hơn..."
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={submitTicket}
              disabled={submitSaving}
              style={{ ...ui.btn.primary, padding: '16px', borderRadius: tokens.radius.lg, fontWeight: 800, justifyContent: 'center', opacity: submitSaving ? 0.72 : 1 }}
            >
              {submitSaving ? 'Đang gửi...' : 'Gửi yêu cầu ngay'}
            </button>
            <button
              type="button"
              onClick={() => setForm({ category: 'bug', subject: '', description: '' })}
              disabled={submitSaving}
              style={{ ...ui.btn.outline, padding: '16px', borderRadius: tokens.radius.lg, justifyContent: 'center', opacity: submitSaving ? 0.72 : 1 }}
            >
              Xóa nội dung
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...S.card, padding: isMobile ? '24px' : '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2Icon size={18} /> {isPrivileged ? 'Hàng đợi hỗ trợ' : 'Yêu cầu của tôi'}
            </h3>
            <div style={{ marginTop: '6px', fontSize: '13px', color: tokens.colors.textSecondary }}>
              {isPrivileged ? 'Xem và xử lý ticket từ người dùng trong hệ thống.' : 'Theo dõi tình trạng các yêu cầu bạn đã gửi.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isPrivileged && (
              <select
                value={adminScope}
                onChange={(event: any) => setAdminScope(event.currentTarget.value)}
                style={{ ...S.input, width: '170px' }}
              >
                <option value="all">Toàn bộ ticket</option>
                <option value="mine">Ticket của tôi</option>
              </select>
            )}
            <button type="button" onClick={() => void loadTickets(adminScope)} style={ui.btn.outline}>
              <RefreshIcon size={14} /> Làm mới
            </button>
          </div>
        </div>

        {ticketsError && (
          <div style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: tokens.radius.lg, background: tokens.colors.badgeBgError, color: tokens.colors.error, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <WarningIcon size={16} />
            <span style={{ fontSize: '13px', fontWeight: 700 }}>{ticketsError}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {ticketsLoading && <div style={{ fontSize: '13px', color: tokens.colors.textMuted }}>Đang tải ticket hỗ trợ...</div>}
          {!ticketsLoading && tickets.length === 0 && (
            <div style={{ padding: '18px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px dashed ${tokens.colors.border}`, color: tokens.colors.textSecondary, fontSize: '13px', lineHeight: 1.6 }}>
              Chưa có ticket nào. Khi bạn gửi yêu cầu mới, hệ thống sẽ lưu lại và hiển thị tiến độ xử lý ngay tại đây.
            </div>
          )}

          {tickets.map((ticket) => {
            const draft = adminDrafts[ticket.id] || {
              status: ticket.status || 'open',
              responseNote: ticket.responseNote || '',
              saving: false,
            };
            const primaryAction = buildSupportTicketPrimaryAction(ticket);
            const canManageTicket = canManageSupportTicket(ticket);

            return (
              <div key={ticket.id} style={{ padding: '18px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px solid ${tokens.colors.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ ...S.eyebrow, marginBottom: '6px' }}>{categoryLabel(ticket.category)}</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: tokens.colors.textPrimary }}>{ticket.subject}</div>
                    <div style={{ marginTop: '6px', fontSize: '12px', color: tokens.colors.textMuted }}>
                      {ticket.createdByName || 'Không rõ người gửi'} · {formatDateTime(ticket.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {ticket.actionAvailability?.supportTab ? (
                      <span style={{ ...ui.badge.info }}>Tab {ticket.actionAvailability.supportTab}</span>
                    ) : null}
                    <span style={statusBadge(ticket.status)}>{STATUS_META[ticket.status]?.label || ticket.status}</span>
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.65, whiteSpace: 'pre-wrap' as const }}>
                  {ticket.description}
                </div>

                {ticket.actionAvailability?.blockers?.length ? (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {ticket.actionAvailability.blockers.map((blocker) => (
                      <span
                        key={blocker}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: tokens.colors.warningSurfaceBg,
                          color: tokens.colors.warningSurfaceText,
                          fontSize: '11px',
                          fontWeight: 800,
                        }}
                      >
                        {blocker}
                      </span>
                    ))}
                  </div>
                ) : null}

                {ticket.responseNote && !isPrivileged && (
                  <div style={{ padding: '14px 16px', borderRadius: tokens.radius.lg, background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}` }}>
                    <div style={{ ...S.eyebrow, marginBottom: '8px' }}>Phản hồi kỹ thuật</div>
                    <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>{ticket.responseNote}</div>
                    {ticket.updatedByName && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: tokens.colors.textMuted }}>
                        Cập nhật bởi {ticket.updatedByName} lúc {formatDateTime(ticket.updatedAt)}
                      </div>
                    )}
                  </div>
                )}

                {canManageTicket && (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '160px minmax(0, 1fr)', gap: '12px', alignItems: 'start' }}>
                    <select
                      value={draft.status}
                      onChange={(event: any) => setAdminDrafts((prev) => ({
                        ...prev,
                        [ticket.id]: { ...draft, status: event.currentTarget.value },
                      }))}
                      style={S.input}
                    >
                      {Object.entries(STATUS_META).map(([value, meta]) => (
                        <option key={value} value={value}>{meta.label}</option>
                      ))}
                    </select>
                    <textarea
                      value={draft.responseNote}
                      onInput={(event: any) => setAdminDrafts((prev) => ({
                        ...prev,
                        [ticket.id]: { ...draft, responseNote: event.target.value },
                      }))}
                      style={{ ...S.input, minHeight: '92px', resize: 'vertical' as const }}
                      placeholder="Thêm phản hồi kỹ thuật hoặc ghi chú xử lý..."
                    />
                    <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>
                        {ticket.updatedByName ? `Lần cập nhật gần nhất: ${ticket.updatedByName} · ${formatDateTime(ticket.updatedAt)}` : 'Chưa có phản hồi nội bộ.'}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {primaryAction ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSupportTab(primaryAction.tab);
                              onNavigate?.(primaryAction.route);
                            }}
                            style={ui.btn.outline}
                          >
                            {primaryAction.label}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void saveAdminUpdate(ticket.id)}
                          disabled={!!draft.saving}
                          style={{ ...ui.btn.primary, opacity: draft.saving ? 0.72 : 1 }}
                        >
                          {draft.saving ? 'Đang lưu...' : 'Cập nhật ticket'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!canManageTicket && primaryAction ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSupportTab(primaryAction.tab);
                        onNavigate?.(primaryAction.route);
                      }}
                      style={ui.btn.outline}
                    >
                      {primaryAction.label}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const Changelog = () => (
    <div style={S.card}>
      <h3 style={{ marginBottom: '32px', fontSize: '20px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <HistoryIcon size={18} /> Lịch sử cập nhật hệ thống
      </h3>
      {[
        { v: 'v1.4.3', d: '25/03/2026', c: 'Kích hoạt Help Center thật, ticket hỗ trợ end-to-end và hàng đợi xử lý cho admin/manager.' },
        { v: 'v1.4.2', d: '22/03/2026', c: 'Hỗ trợ đồng bộ dữ liệu Supabase, giao diện Quick Launch.' },
        { v: 'v1.4.0', d: '20/03/2026', c: 'Bổ sung module PDF Generator chuyên sâu cho Báo giá thiết bị nặng.' },
        { v: 'v1.3.5', d: '15/03/2026', c: 'Tích hợp Dark Mode toàn diện và nâng cao bảo mật User.' },
      ].map((log, index) => (
        <div key={log.v} style={{ padding: '20px', borderBottom: index === 3 ? 'none' : `1px solid ${tokens.colors.border}`, display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          <div style={{ background: tokens.colors.background, padding: '6px 12px', borderRadius: tokens.radius.md, fontWeight: 800, color: tokens.colors.primary, fontSize: '13px' }}>{log.v}</div>
          <div>
            <div style={{ fontSize: '13px', color: tokens.colors.textMuted, fontWeight: 600, marginBottom: '4px' }}>{log.d}</div>
            <div style={{ fontSize: '15px', color: tokens.colors.textPrimary, fontWeight: 500 }}>{log.c}</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={ui.page.shell as any}>
      {selectedArticle && (
        <OverlayModal title={selectedArticle.title} onClose={() => setSelectedArticle(null)} maxWidth="760px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={S.eyebrow}>{selectedArticle.eyebrow}</div>
              <p style={{ margin: '10px 0 0', fontSize: '14px', color: tokens.colors.textSecondary, lineHeight: 1.7 }}>{selectedArticle.summary}</p>
            </div>
            {selectedArticle.sections.map((section) => (
              <div key={section.title} style={{ padding: '18px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px solid ${tokens.colors.border}` }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary, marginBottom: '8px' }}>{section.title}</div>
                <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.7 }}>{section.body}</div>
              </div>
            ))}
          </div>
        </OverlayModal>
      )}

      <h1 style={{ ...S.header, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <SupportIcon size={24} /> {helpCopy.title}
      </h1>
      <p style={S.subtitle}>{helpCopy.subtitle}</p>

      {profile.personaMode === 'admin' ? (
        <div style={{ ...S.card, marginBottom: '24px', padding: isMobile ? '20px' : '24px', display: 'grid', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Admin support cockpit</div>
            <div style={{ marginTop: '8px', fontSize: '14px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
              Admin dùng màn này để xử lý support tickets, reset access issues và nhìn các điểm nghẽn hệ thống. Đây là lớp hỗ trợ vận hành, không thay cho approval lane nghiệp vụ.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            <div style={{ padding: '16px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.background }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Open tickets</div>
              <div style={{ marginTop: '8px', fontSize: '26px', fontWeight: 900, color: tokens.colors.error }}>{openTickets}</div>
            </div>
            <div style={{ padding: '16px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.background }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>In progress</div>
              <div style={{ marginTop: '8px', fontSize: '26px', fontWeight: 900, color: tokens.colors.primary }}>{inProgressTickets}</div>
            </div>
            <div style={{ padding: '16px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.background }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Resolved</div>
              <div style={{ marginTop: '8px', fontSize: '26px', fontWeight: 900, color: tokens.colors.success }}>{resolvedTickets}</div>
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: '32px',
          marginBottom: '32px',
          borderBottom: `1px solid ${tokens.colors.border}`,
          paddingBottom: '16px',
          ...(isMobile
            ? {
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                WebkitOverflowScrolling: 'touch',
              }
            : {}),
        }}
      >
        {['Help', 'Ticket', 'Changelog'].map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveSupportTab(tab)}
            style={{
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 700,
              color: activeSupportTab === tab ? tokens.colors.primary : tokens.colors.textSecondary,
              position: 'relative',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {tab === 'Help' ? 'Hướng dẫn sử dụng' : tab === 'Ticket' ? 'Yêu cầu kỹ thuật' : 'Lịch sử phiên bản'}
            {activeSupportTab === tab && <div style={{ position: 'absolute', bottom: '-17px', left: 0, right: 0, height: '3px', background: tokens.colors.primary, borderRadius: '3px 3px 0 0' }} />}
          </div>
        ))}
      </div>

      {activeSupportTab === 'Help' && <HelpCenter />}
      {activeSupportTab === 'Ticket' && <TicketPanel />}
      {activeSupportTab === 'Changelog' && <Changelog />}

      <div style={{ marginTop: '60px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '13px' }}>
        CRM Huynh Thy Enterprise - Version 1.4.3 (Support Enabled)
      </div>
    </div>
  );
}
