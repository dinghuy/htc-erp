import { API_BASE } from './config';
import { useState, useEffect } from 'preact/hooks';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { FolderIcon } from './ui/icons';
import { renderActivityIcon } from './ui/activityIcon';

const API = API_BASE;

export function EventLog({ onNavigate, isMobile, currentUser: _currentUser }: { onNavigate?: (route: string) => void; isMobile?: boolean; currentUser?: any }) {
  const navigate = onNavigate ?? (() => {});
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Để lấy nhiều hơn 15 dòng nếu cần, có thể sửa API sau, tạm thời gọi không truyền entityId
    fetch(`${API}/activities`) 
      .then(res => res.json())
      .then(data => { setActivities(data); setLoading(false); });
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} • ${d.toLocaleDateString('vi-VN')}`;
  };

  return (
    <div style={{ padding: 0, maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <button onClick={() => navigate('Home')} style={{ background: 'none', border: 'none', color: tokens.colors.primary, cursor: 'pointer', fontSize: '13px', fontWeight: 700, padding: 0, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>← Quay lại Home</button>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: tokens.colors.textPrimary, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderIcon size={24} /> Nhật ký hoạt động
          </h1>
          <p style={{ color: tokens.colors.textSecondary, marginTop: '8px', fontSize: '14px', fontWeight: 500 }}>Tóm tắt các thay đổi và tương tác gần đây trên hệ thống.</p>
        </div>
      </div>

      <div style={{ ...ui.card.base, padding: '24px' }}>
         {loading ? <div style={{ textAlign: 'center', padding: '40px', color: tokens.colors.textMuted }}>Đang tải...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
               {!isMobile && (
                 <div style={{ position: 'absolute', top: 0, bottom: 0, left: '23px', width: '2px', background: tokens.colors.border, zIndex: 0 }} />
               )}
               {activities.map((act) => (
                 <div key={act.id} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1, alignItems: 'flex-start' }}>
                   {!isMobile && (
                     <div style={{ flexShrink: 0, width: '42px', height: '42px', borderRadius: '50%', background: act.color || tokens.colors.background, border: `2px solid ${tokens.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: `0 0 0 4px ${tokens.colors.surface}` }}>
                      <span style={{ color: act.iconColor || tokens.colors.textMuted, filter: act.iconColor ? `drop-shadow(0 0 1px ${act.iconColor})` : 'none' }}>
                        {renderActivityIcon(act.icon, act.category, 18)}
                      </span>
                    </div>
                   )}
                   <div style={{ flex: 1, background: tokens.colors.background, padding: '16px 18px', borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}` }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: tokens.colors.textPrimary, lineHeight: 1.4 }}>
                             {act.title}
                             {act.entityDisplay ? <span style={{ color: tokens.colors.textMuted, fontWeight: 600, fontSize: '13px' }}> · {act.entityDisplay}</span> : ''}
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                            <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 800, color: act.iconColor || tokens.colors.textMuted, padding: '2px 8px', borderRadius: tokens.radius.sm, background: act.color || tokens.colors.surface }}>{act.category}</span>
                            {act.entityType && <span style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted }}>{act.entityType}</span>}
                            {act.actorDisplay ? <span style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted }}>By {act.actorDisplay}</span> : null}
                            {act.actingCapability ? <span style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted }}>Capability {act.actingCapability}</span> : null}
                            {act.action ? <span style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted }}>Action {act.action}</span> : null}
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: tokens.colors.textMuted, whiteSpace: 'nowrap' }}>{formatTime(act.createdAt)}</span>
                     </div>
                     {act.description && <p style={{ margin: '10px 0 0', fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.55 }}>{act.description}</p>}

                     {(act.link || act.entityType) && (
                        <div style={{ marginTop: '12px' }}>
                           <button onClick={() => {
                              if (act.entityType === 'Account') navigate('Accounts');
                              else if (act.entityType === 'Contact') navigate('Contacts');
                              else if (act.link) navigate(act.link);
                           }} style={{ background: 'transparent', border: 'none', color: tokens.colors.primary, fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                              Xem chi tiết →
                           </button>
                        </div>
                     )}
                   </div>
                 </div>
               ))}
               
               {activities.length === 0 && (
                 <div style={{ textAlign: 'center', color: tokens.colors.textMuted }}>Chưa có sự kiện nào được ghi nhận.</div>
               )}
            </div>
         )}
      </div>
    </div>
  );
}
