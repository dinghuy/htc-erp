import { useEffect, useMemo, useState } from 'preact/hooks';
import { buildRoleProfile } from './auth';
import { API_BASE } from './config';
import { requestJsonWithAuth } from './shared/api/client';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { AlertCircleIcon, CheckIcon, FolderIcon, ReportIcon, TrendingIcon } from './ui/icons';

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
    <div style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '12px' }}>
      <div style={{ display: 'inline-flex', width: '42px', height: '42px', borderRadius: '14px', alignItems: 'center', justifyContent: 'center', background: `${accent}16`, color: accent }}>
        <Icon size={18} />
      </div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textSecondary }}>{label}</div>
      <div style={{ fontSize: '34px', fontWeight: 900, color: tokens.colors.textPrimary }}>{fmt(value)}</div>
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
      <section
        style={{
          ...ui.card.base,
          padding: '28px',
          background: 'linear-gradient(135deg, rgba(0, 77, 53, 0.10) 0%, rgba(0, 151, 110, 0.06) 48%, rgba(255,255,255,1) 100%)',
        }}
      >
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ ...ui.badge.info, display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: '8px' }}>
            <TrendingIcon size={16} />
            Director Cockpit
          </div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: tokens.colors.textPrimary }}>Profit + Risk Cockpit</h1>
          <p style={{ margin: 0, fontSize: '14px', color: tokens.colors.textSecondary, maxWidth: '70ch', lineHeight: 1.6 }}>
            Theo dõi các project at-risk, quyết định điều hành đang chờ duyệt và bottleneck đang phình theo từng phòng ban trên cùng một màn hình.
          </p>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <ExecutiveMetricCard label="Projects at risk" value={riskProjectsValue} icon={AlertCircleIcon} accent={tokens.colors.error} />
        <ExecutiveMetricCard label="Pending approvals" value={pendingApprovalsValue} icon={CheckIcon} accent={tokens.colors.warning} />
        <ExecutiveMetricCard label="Open tasks in focus" value={Number(summary.totalOpenTasks || 0)} icon={FolderIcon} accent={tokens.colors.primary} />
        <ExecutiveMetricCard label="Missing documents" value={Number(summary.totalMissingDocuments || 0)} icon={ReportIcon} accent={tokens.colors.info} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        <section style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary }}>Top At-Risk Projects</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: tokens.colors.textSecondary }}>
              Ưu tiên theo approval backlog, thiếu hồ sơ và open task đang đe dọa margin hoặc tiến độ.
            </p>
          </div>
          {topRiskProjects.length === 0 ? (
            <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Chưa có project nào nổi bật trong executive focus.</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {topRiskProjects.map((project) => (
                <div key={project.projectId} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '14px', display: 'grid', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>
                        {project.projectCode ? `${project.projectCode} · ` : ''}
                        {project.projectName || 'Unnamed project'}
                      </div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                        {project.accountName || 'No account'} · Stage {project.projectStage || 'new'} · Status {project.projectStatus || 'pending'}
                      </div>
                    </div>
                  <span style={ui.badge.error as any}>Risk {Number(project.riskScore || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={ui.badge.warning as any}>Approvals {Number(project.pendingApprovalCount || 0)}</span>
                    <span style={Number(project.missingDocumentCount || 0) > 0 ? ui.badge.error as any : ui.badge.success as any}>
                      Docs {Number(project.missingDocumentCount || 0)}
                    </span>
                    <span style={ui.badge.info as any}>Tasks {Number(project.openTaskCount || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gap: '24px' }}>
          <section style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '14px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary }}>Department Bottlenecks</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: tokens.colors.textSecondary }}>
                Số approval pending đang dồn theo từng phòng ban.
              </p>
            </div>
            {bottlenecksByDepartment.length === 0 ? (
              <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có bottleneck pending.</div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {bottlenecksByDepartment.map((item) => (
                  <div key={item.department} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{item.department}</div>
                    <span style={ui.badge.warning as any}>{item.count} pending</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ ...ui.card.base, padding: '22px', display: 'grid', gap: '14px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary }}>Executive Approval Queue</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: tokens.colors.textSecondary }}>
                Các yêu cầu đang rơi vào lane điều hành, ưu tiên quyết định nhanh để không nghẽn project.
              </p>
            </div>
            {executiveApprovals.length === 0 ? (
              <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>Không có executive approval pending.</div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {executiveApprovals.map((approval) => (
                  <div key={approval.id} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, padding: '12px 14px', display: 'grid', gap: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{approval.title}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                      {approval.projectCode ? `${approval.projectCode} · ` : ''}
                      {approval.projectName || 'No project'} · {approval.requestType}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {approval.department ? <span style={ui.badge.info as any}>{approval.department}</span> : null}
                      {approval.requestedByName ? <span style={ui.badge.neutral as any}>From {approval.requestedByName}</span> : null}
                      {approval.dueDate ? <span style={ui.badge.warning as any}>Due {String(approval.dueDate).slice(0, 10)}</span> : null}
                    </div>
                  </div>
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
        } else {
          const [s, r, f] = await Promise.all([
            fetch(`${API}/stats`).then((res) => res.json()),
            fetch(`${API}/reports/revenue`).then((res) => res.json()),
            fetch(`${API}/reports/funnel`).then((res) => res.json()),
          ]);
          setStats(s);
          setRevenueData(r);
          setFunnelData(f);
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
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px', color: tokens.colors.textMuted }}>Đang tổng hợp executive cockpit...</div>
        ) : (
          <ExecutiveCockpit
            summary={executivePayload?.summary || {}}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ ...S.title, display: 'inline-flex', alignItems: 'center', gap: '8px' }}><ReportIcon size={22} /> Báo cáo & Phân tích (Analytics)</h1>
      <p style={S.subtitle}>Theo dõi doanh thu, tỷ lệ chuyển đổi và hiệu suất bán hàng dựa trên dữ liệu HT Group.</p>

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
