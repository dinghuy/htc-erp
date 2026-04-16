import { useEffect, useMemo, useState } from 'preact/hooks';
import { buildRoleProfile } from './auth';
import { API_BASE } from './config';
import { requestJsonWithAuth } from './shared/api/client';
import { type RolePersonaMode } from './shared/domain/contracts';
import {
  buildPersonaReportCockpit,
  toneColor,
  type ApprovalsPayload,
  type HomePayload,
  type InboxPayload,
} from './reports/roleReportCockpit';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { EntitySummaryCard, MetricCard, PageHero, PageSectionHeader } from './ui/patterns';
import { AlertCircleIcon, CheckIcon, FolderIcon, ReportIcon } from './ui/icons';

type ExecutiveRiskProject = {
  projectId: string;
  projectCode?: string | null;
  projectName?: string | null;
  projectStage?: string | null;
  projectStatus?: string | null;
  accountName?: string | null;
  openTaskCount?: number | null;
  pendingApprovalCount?: number | null;
  missingDocumentCount?: number | null;
  riskScore?: number | null;
};

type ApprovalRecord = {
  id: string;
  title: string;
  requestType: string;
  status: string;
  note?: string | null;
  dueDate?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  requestedByName?: string | null;
  department?: string | null;
  approverRole?: string | null;
  approverUserId?: string | null;
};

type ExecutiveBottleneck = {
  department: string;
  count: number;
};

type ExecutiveSummary = {
  executiveApprovals?: ApprovalRecord[];
  pendingExecutiveApprovals?: number;
  topRiskProjects?: ExecutiveRiskProject[];
  bottlenecksByDepartment?: ExecutiveBottleneck[];
  totalOpenTasks?: number;
  totalMissingDocuments?: number;
};

type ExecutiveCockpitPayload = {
  summary?: ExecutiveSummary;
};

function PersonaMetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'info' | 'warn' | 'bad' | 'good';
}) {
  const accent = toneColor(tone);
  return (
    <MetricCard label={label} value={fmt(value)} accent={accent} />
  );
}

function PersonaPanel({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ title: string; meta: string; badges?: Array<{ label: string; tone: 'info' | 'warn' | 'bad' | 'good' }> }>;
}) {
  return (
    <section style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '14px' }}>
      <PageSectionHeader title={title} description={description} />
      {items.length === 0 ? (
        <div style={{ fontSize: '13px', color: tokens.colors.textMuted }}>Chưa có item nổi bật trong phạm vi này.</div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {items.map((item) => (
            <EntitySummaryCard
              key={`${item.title}-${item.meta}`}
              title={item.title}
              subtitle={item.meta}
              statusItems={item.badges?.map((badge, index) => ({
                key: `${item.title}-${badge.label}-${index}`,
                label: badge.label,
                tone: badge.tone,
              }))}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PersonaReportsCockpit({
  mode,
  homePayload,
  inboxPayload,
  approvalsPayload,
}: {
  mode: RolePersonaMode;
  homePayload: HomePayload | null;
  inboxPayload: InboxPayload | null;
  approvalsPayload: ApprovalsPayload | null;
}) {
  const cockpit = buildPersonaReportCockpit(mode, homePayload || {}, inboxPayload || {}, approvalsPayload || {});

  return (
    <div style={{ display: 'grid', gap: '28px' }}>
      <PageHero eyebrow={cockpit.eyebrow} title={cockpit.title} description={cockpit.description} compact />

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {cockpit.cards.map((card) => (
          <PersonaMetricCard key={card.label} label={card.label} value={card.value} tone={card.tone} />
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <PersonaPanel title={cockpit.focusTitle} description={cockpit.focusDescription} items={cockpit.focusItems} />
        <PersonaPanel title={cockpit.watchTitle} description={cockpit.watchDescription} items={cockpit.watchItems} />
      </div>

      <section style={{ ...ui.card.base, padding: '18px 22px', borderColor: tokens.colors.border }}>
        <div style={{ fontSize: '13px', lineHeight: 1.7, color: tokens.colors.textSecondary }}>{cockpit.footerNote}</div>
      </section>
    </div>
  );
}

const API = API_BASE;

function fmt(value: any) {
  return typeof value === 'number' ? value.toLocaleString('vi-VN') : (value || '0');
}

function ExecutiveMetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: any;
  accent: string;
}) {
  const Icon = icon;
  return (
    <div style={{ ...ui.card.base, padding: '20px', display: 'grid', gap: '10px' }}>
      <div style={{ display: 'inline-flex', width: '42px', height: '42px', borderRadius: '14px', alignItems: 'center', justifyContent: 'center', background: `${accent}16`, color: accent }}>
        <Icon size={18} />
      </div>
      <MetricCard label={label} value={fmt(value)} accent={tokens.colors.textPrimary} />
    </div>
  );
}

function ExecutiveCockpit({
  summary,
}: {
  summary: ExecutiveSummary;
}) {
  const topRiskProjects = summary.topRiskProjects || [];
  const bottlenecksByDepartment = summary.bottlenecksByDepartment || [];
  const executiveApprovals = summary.executiveApprovals || [];
  const riskProjectsValue = topRiskProjects.length;
  const pendingApprovalsValue = Number(summary.pendingExecutiveApprovals || 0);

  return (
    <div style={{ display: 'grid', gap: '28px' }}>
      <PageHero
        eyebrow="Cockpit điều hành"
        title="Cockpit lợi nhuận và rủi ro"
        description="Theo dõi các dự án rủi ro cao, quyết định điều hành đang chờ duyệt và bottleneck đang phình theo từng phòng ban trên cùng một màn hình."
        compact
      />

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <ExecutiveMetricCard label="Dự án rủi ro cao" value={riskProjectsValue} icon={AlertCircleIcon} accent={tokens.colors.error} />
        <ExecutiveMetricCard label="Phê duyệt chờ" value={pendingApprovalsValue} icon={CheckIcon} accent={tokens.colors.warning} />
        <ExecutiveMetricCard label="Công việc đang theo dõi" value={Number(summary.totalOpenTasks || 0)} icon={FolderIcon} accent={tokens.colors.primary} />
        <ExecutiveMetricCard label="Hồ sơ thiếu" value={Number(summary.totalMissingDocuments || 0)} icon={ReportIcon} accent={tokens.colors.info} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <section style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '14px' }}>
          <PageSectionHeader
            title="Top dự án rủi ro cao"
            description="Ưu tiên theo backlog phê duyệt, thiếu hồ sơ và công việc mở đang đe dọa biên lợi nhuận hoặc tiến độ."
          />
          {topRiskProjects.length === 0 ? (
            <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có dự án nào nổi bật trong vùng điều hành.</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {topRiskProjects.map((project) => (
                <EntitySummaryCard
                  key={project.projectId}
                  title={`${project.projectCode ? `${project.projectCode} · ` : ''}${project.projectName || 'Dự án chưa đặt tên'}`}
                  subtitle={`${project.accountName || 'Chưa có account'} · Giai đoạn ${project.projectStage || 'new'} · Trạng thái ${project.projectStatus || 'pending'}`}
                  primaryLabel={`Rủi ro ${Number(project.riskScore || 0)}`}
                  primaryHint="Dự án đang nằm trong vùng điều hành do backlog phê duyệt, thiếu hồ sơ hoặc khối lượng công việc mở."
                  statusItems={[
                    { key: `${project.projectId}-approvals`, label: `${Number(project.pendingApprovalCount || 0)} phê duyệt`, tone: 'warn' },
                    { key: `${project.projectId}-docs`, label: `${Number(project.missingDocumentCount || 0)} hồ sơ thiếu`, tone: Number(project.missingDocumentCount || 0) > 0 ? 'bad' : 'good' },
                    { key: `${project.projectId}-tasks`, label: `${Number(project.openTaskCount || 0)} công việc`, tone: 'info' },
                  ]}
                />
              ))}
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gap: '24px' }}>
          <section style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '14px' }}>
            <PageSectionHeader title="Bottleneck theo phòng ban" description="Số phê duyệt đang chờ dồn theo từng phòng ban." />
            {bottlenecksByDepartment.length === 0 ? (
              <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có bottleneck pending.</div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {bottlenecksByDepartment.map((item) => (
                  <div key={item.department} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{item.department}</div>
                    <span style={ui.badge.warning as any}>{item.count} đang chờ</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '14px' }}>
            <PageSectionHeader
              title="Hàng đợi phê duyệt điều hành"
              description="Các yêu cầu đang rơi vào lane điều hành, ưu tiên quyết định nhanh để không nghẽn dự án."
            />
            {executiveApprovals.length === 0 ? (
              <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có phê duyệt điều hành đang chờ.</div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {executiveApprovals.map((approval) => (
                  <EntitySummaryCard
                    key={approval.id}
                    title={approval.title}
                    subtitle={`${approval.projectCode ? `${approval.projectCode} · ` : ''}${approval.projectName || 'Không có dự án'} · ${approval.requestType}`}
                    statusItems={[
                      ...(approval.department ? [{ key: `${approval.id}-department`, label: approval.department, tone: 'info' as const }] : []),
                      ...(approval.requestedByName ? [{ key: `${approval.id}-requester`, label: `Từ ${approval.requestedByName}`, tone: 'neutral' as const }] : []),
                      ...(approval.dueDate ? [{ key: `${approval.id}-due`, label: `Hạn ${String(approval.dueDate).slice(0, 10)}`, tone: 'warn' as const }] : []),
                    ]}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export function Reports({ isMobile, currentUser }: { isMobile?: boolean; currentUser?: any } = {}) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [executivePayload, setExecutivePayload] = useState<ExecutiveCockpitPayload | null>(null);
  const [homePayload, setHomePayload] = useState<HomePayload | null>(null);
  const [inboxPayload, setInboxPayload] = useState<InboxPayload | null>(null);
  const [approvalsPayload, setApprovalsPayload] = useState<ApprovalsPayload | null>(null);
  const profile = useMemo(
    () => buildRoleProfile(currentUser?.roleCodes, currentUser?.systemRole),
    [currentUser?.roleCodes, currentUser?.systemRole],
  );
  const isExecutiveCockpit = Boolean(profile.roleCodes.includes('director'));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (isExecutiveCockpit && currentUser?.token) {
          const executive = await requestJsonWithAuth<ExecutiveCockpitPayload>(
            currentUser.token,
            `${API}/workspace/executive-cockpit`,
            {},
            'Không thể tải executive cockpit',
          );
          setExecutivePayload(executive);
          setStats(null);
          setRevenueData([]);
          setFunnelData([]);
          setHomePayload(null);
          setInboxPayload(null);
          setApprovalsPayload(null);
        } else {
          if (currentUser?.token) {
            const [home, inbox, approvals] = await Promise.all([
              requestJsonWithAuth<HomePayload>(currentUser.token, `${API}/workspace/home`, {}, 'Không thể tải role home report'),
              requestJsonWithAuth<InboxPayload>(currentUser.token, `${API}/workspace/inbox`, {}, 'Không thể tải inbox report'),
              requestJsonWithAuth<ApprovalsPayload>(currentUser.token, `${API}/workspace/approvals`, {}, 'Không thể tải approvals report'),
            ]);
            setHomePayload(home);
            setInboxPayload(inbox);
            setApprovalsPayload(approvals);
          } else {
            setHomePayload(null);
            setInboxPayload(null);
            setApprovalsPayload(null);
          }
          if (currentUser?.token) {
            const [s, r, f] = await Promise.all([
              requestJsonWithAuth<any>(currentUser.token, `${API}/stats`, {}, 'Không thể tải thống kê tổng quan'),
              requestJsonWithAuth<any[]>(currentUser.token, `${API}/reports/revenue`, {}, 'Không thể tải báo cáo doanh thu'),
              requestJsonWithAuth<any[]>(currentUser.token, `${API}/reports/funnel`, {}, 'Không thể tải funnel report'),
            ]);
            setStats(s);
            setRevenueData(Array.isArray(r) ? r : []);
            setFunnelData(Array.isArray(f) ? f : []);
          } else {
            setStats({});
            setRevenueData([]);
            setFunnelData([]);
          }
          setExecutivePayload(null);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentUser?.token, isExecutiveCockpit]);

  const S = {
    card: { ...ui.card.base, padding: '24px' },
    title: {
      fontSize: '24px',
      fontWeight: 800,
      color: tokens.colors.textPrimary,
      marginBottom: '8px',
    },
    subtitle: {
      fontSize: '14px',
      color: tokens.colors.textSecondary,
      marginBottom: '32px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '24px',
    },
    kpiValue: {
      fontSize: '32px',
      fontWeight: 800,
      color: tokens.colors.primary,
    },
    kpiLabel: {
      ...ui.form.label,
      fontSize: '13px',
      fontWeight: 600,
    },
    th: ui.table.thStatic,
    td: ui.table.td,
  };

  if (isExecutiveCockpit) {
    return loading ? (
      <div style={{ textAlign: 'center', padding: '100px', color: tokens.colors.textMuted }}>Đang tổng hợp executive cockpit...</div>
    ) : (
      <ExecutiveCockpit
        summary={executivePayload?.summary || {}}
      />
    );
  }

  if (currentUser?.token) {
    return loading ? (
      <div style={{ textAlign: 'center', padding: '100px', color: tokens.colors.textMuted }}>Đang tổng hợp role cockpit...</div>
    ) : (
      <PersonaReportsCockpit
        mode={profile.personaMode}
        homePayload={homePayload}
        inboxPayload={inboxPayload}
        approvalsPayload={approvalsPayload}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: tokens.spacing.xxxl }}>
      <PageHero
        eyebrow="Analytics"
        title="Báo cáo & Phân tích"
        description="Theo dõi doanh thu, tỷ lệ chuyển đổi và hiệu suất bán hàng dựa trên dữ liệu HT Group."
        compact
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px', color: tokens.colors.textMuted }}>Đang tổng hợp dữ liệu...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={S.grid}>
            <div style={S.card}>
              <div style={S.kpiLabel}>Doanh thu dự kiến (Pipeline)</div>
              <div style={S.kpiValue}>{fmt(stats?.pipelineValue)} đ</div>
              <div style={{ fontSize: '12px', color: tokens.colors.primary, marginTop: '8px' }}>Dựa trên tất cả báo giá đang mở</div>
            </div>
            <div style={S.card}>
              <div style={S.kpiLabel}>Tỷ lệ thắng (Win Rate)</div>
              <div style={S.kpiValue}>{stats?.winRate}%</div>
              <div style={{ fontSize: '12px', color: tokens.colors.primary, marginTop: '8px' }}>Tỷ lệ chốt hợp đồng thành công</div>
            </div>
            <div style={S.card}>
              <div style={S.kpiLabel}>Quy mô khách hàng</div>
              <div style={S.kpiValue}>{stats?.accounts} Account</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textMuted, marginTop: '8px' }}>Chưa bao gồm Leads</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <div style={{ ...S.card, height: '400px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 700, marginBottom: '20px' }}>Xu hướng doanh thu theo tháng (Revenue Trend)</div>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: '30px' }}>
                {revenueData.length === 0 ? <div style={{ color: tokens.colors.textMuted }}>Chưa có dữ liệu doanh thu</div> :
                 revenueData.map((d, i) => {
                   const max = Math.max(...revenueData.map((x) => x.total)) || 1;
                   const h = (d.total / max) * 100;
                   return (
                     <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
                       <div style={{
                         width: '30px',
                         height: `${h}%`,
                         background: tokens.colors.primary,
                         borderRadius: '4px 4px 0 0',
                         minHeight: '5px',
                         transition: 'height 1s ease',
                       }} title={`${fmt(d.total)} đ`} />
                       <div style={{ fontSize: '10px', color: tokens.colors.textMuted, marginTop: '8px', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{d.month}</div>
                     </div>
                   );
                 })}
              </div>
            </div>

            <div style={{ ...S.card, height: '400px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 700, marginBottom: '20px' }}>Tỉ lệ chuyển đổi (Funnel)</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
                {funnelData.map((f, i) => {
                  const max = funnelData[0]?.value || 1;
                  const per = (f.value / max) * 100;
                  return (
                    <div key={i} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700 }}>{f.label}</span>
                        <span>{f.value}</span>
                      </div>
                      <div style={{ height: '12px', background: tokens.colors.background, borderRadius: tokens.radius.md, overflow: 'hidden' }}>
                        <div style={{ width: `${per}%`, height: '100%', background: f.color, transition: 'width 1s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 700, marginBottom: '20px' }}>Top Danh mục Sản phẩm Bán chạy</div>
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { cat: 'Xe nâng (Forklifts)', qty: 45, rev: '12.4 tỷ' },
                  { cat: 'Phụ tùng (Spare Parts)', qty: 850, rev: '3.2 tỷ' },
                  { cat: 'Dịch vụ bảo trì', qty: 120, rev: '1.5 tỷ' },
                ].map((row, i) => (
                  <div key={i} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{row.cat}</div>
                    <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Số lượng:</strong> {row.qty}</div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Doanh thu:</strong> {row.rev}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${tokens.colors.border}`, textAlign: 'left' }}>
                    <th style={S.th}>DANH MỤC</th>
                    <th style={S.th}>SỐ LƯỢNG</th>
                    <th style={S.th}>DOANH THU ƯỚC TÍNH</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cat: 'Xe nâng (Forklifts)', qty: 45, rev: '12.4 tỷ' },
                    { cat: 'Phụ tùng (Spare Parts)', qty: 850, rev: '3.2 tỷ' },
                    { cat: 'Dịch vụ bảo trì', qty: 120, rev: '1.5 tỷ' },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: i === 2 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                      <td style={{ ...S.td, fontWeight: 600 }}>{row.cat}</td>
                      <td style={S.td}>{row.qty}</td>
                      <td style={{ ...S.td, color: tokens.colors.primary, fontWeight: 700 }}>{row.rev}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
