import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';

export function statusBadgeStyle(status?: string): any {
  const base = {
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-block'
  };
  switch (status) {
    case 'active': return { ...base, background: tokens.colors.infoAccentBg, color: tokens.colors.primary };
    case 'completed':
    case 'signed':
    case 'effective': return { ...base, ...ui.badge.success };
    case 'paused':
    case 'partial': return { ...base, ...ui.badge.warning };
    case 'cancelled':
    case 'rejected': return { ...base, ...ui.badge.error };
    default: return { ...base, ...ui.badge.neutral };
  }
}

export function projectStageBadgeStyle(stage?: string): any {
  const base = {
    padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
    borderRadius: tokens.radius.md,
    fontSize: '11px',
    fontWeight: 800,
    display: 'inline-block'
  };
  switch (stage) {
    case 'won': return { ...base, ...ui.badge.success };
    case 'lost': return { ...base, ...ui.badge.error };
    case 'delivery': return { ...base, background: tokens.colors.violetStrongBg, color: tokens.colors.violetStrongText };
    default: return { ...base, ...ui.badge.neutral };
  }
}

export function statusLabel(status?: string | null): string {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active') return 'Đang chạy';
  if (normalized === 'completed') return 'Hoàn tất';
  if (normalized === 'signed') return 'Đã ký';
  if (normalized === 'effective') return 'Hiệu lực';
  if (normalized === 'paused') return 'Tạm dừng';
  if (normalized === 'partial') return 'Một phần';
  if (normalized === 'cancelled') return 'Đã hủy';
  if (normalized === 'rejected') return 'Bị từ chối';
  if (normalized === 'pending') return 'Đang chờ';
  return status || 'Chưa cập nhật';
}
