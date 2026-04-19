import type { JSX } from 'preact';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import type { ProductWorkspaceViewMode } from './productsWorkspaceData';

export type ProductWorkspaceStyles = {
  card: JSX.CSSProperties;
  btnPrimary: JSX.CSSProperties;
  btnOutline: JSX.CSSProperties;
  thSortable: JSX.CSSProperties;
  thStatic: JSX.CSSProperties;
  td: JSX.CSSProperties;
  input: JSX.CSSProperties;
  kpiCard: JSX.CSSProperties;
};

export const workspaceStyles: ProductWorkspaceStyles = {
  card: ui.card.base,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' },
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' },
  thSortable: ui.table.thSortable,
  thStatic: ui.table.thStatic,
  td: ui.table.td,
  input: { ...ui.input.base, transition: 'all 0.2s ease' },
  kpiCard: ui.card.kpi,
};

export type ProductWorkspaceSurfaceStyles = {
  productCardButtonStyle: JSX.CSSProperties;
  desktopActionIconButtonStyle: JSX.CSSProperties;
  tableInfoButtonStyle: JSX.CSSProperties;
  tableEditButtonStyle: JSX.CSSProperties;
  tableDeleteButtonStyle: JSX.CSSProperties;
  tableSurfaceStyle: JSX.CSSProperties;
  cardsSurfaceStyle: JSX.CSSProperties;
  sidePanelStyle: JSX.CSSProperties;
  contentGridStyle: JSX.CSSProperties;
  desktopViewToggleStyle: JSX.CSSProperties;
  desktopViewActiveStyle: JSX.CSSProperties;
  quickFilterPillStyle: JSX.CSSProperties;
  quickFilterPillActiveStyle: JSX.CSSProperties;
  summaryChipStyle: JSX.CSSProperties;
  tableHeaderButtonStyle: JSX.CSSProperties;
};

export function createWorkspaceSurfaceStyles(args: {
  isMobile: boolean;
  showDesktopTable: boolean;
  desktopViewMode: ProductWorkspaceViewMode;
}): ProductWorkspaceSurfaceStyles {
  const productCardButtonStyle = {
    ...ui.btn.outline,
    padding: '6px 10px',
    fontSize: '12px',
  };

  const desktopActionIconButtonStyle = {
    ...ui.btn.outline,
    padding: '6px 10px',
    minHeight: '30px',
  };

  const tableInfoButtonStyle = {
    ...desktopActionIconButtonStyle,
    color: tokens.colors.info,
  };

  const tableEditButtonStyle = {
    ...desktopActionIconButtonStyle,
    color: tokens.colors.primary,
  };

  const tableDeleteButtonStyle = {
    ...ui.btn.danger,
    padding: '6px 10px',
    minHeight: '30px',
    fontSize: '12px',
  };

  const tableSurfaceStyle = {
    ...workspaceStyles.card,
    overflow: 'hidden',
    border: `1px solid ${tokens.colors.border}`,
  };

  const cardsSurfaceStyle = {
    ...workspaceStyles.card,
    border: `1px solid ${tokens.colors.border}`,
    display: 'grid',
    gap: '14px',
    padding: '16px',
  };

  const sidePanelStyle = {
    ...workspaceStyles.card,
    border: `1px solid ${tokens.colors.border}`,
    background: tokens.surface.heroGradientSubtle,
    display: 'grid',
    gap: '12px',
    padding: '14px',
    alignSelf: 'start',
    position: 'sticky' as const,
    top: '12px',
  };

  const contentGridStyle = {
    display: 'grid',
    gap: '14px',
    gridTemplateColumns: args.showDesktopTable || args.isMobile ? '1fr' : 'minmax(0, 1fr) minmax(230px, 280px)',
    alignItems: 'start',
  };

  const desktopViewToggleStyle = {
    ...workspaceStyles.btnOutline,
    padding: '8px 12px',
    minHeight: '34px',
    fontSize: '12px',
  };

  const desktopViewActiveStyle = {
    ...desktopViewToggleStyle,
    border: `1px solid ${tokens.colors.primary}`,
    color: tokens.colors.primary,
    background: tokens.colors.surfaceSubtle,
  };

  const quickFilterPillStyle = {
    ...ui.badge.neutral,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    border: `1px solid ${tokens.colors.border}`,
    cursor: 'pointer',
    padding: '5px 10px',
    fontSize: '11px',
  };

  const quickFilterPillActiveStyle = {
    ...quickFilterPillStyle,
    color: tokens.colors.primary,
    border: `1px solid ${tokens.colors.primary}`,
    background: tokens.colors.surfaceSubtle,
  };

  const summaryChipStyle = {
    ...ui.badge.neutral,
    display: 'inline-flex',
    alignItems: 'center',
    border: `1px solid ${tokens.colors.border}`,
    background: tokens.surface.badge,
    padding: '4px 10px',
    fontSize: '11px',
  };

  const tableHeaderButtonStyle = {
    ...ui.btn.ghost,
    width: '100%',
    justifyContent: 'space-between',
    padding: '0',
    minHeight: 'auto',
    fontSize: '12px',
    fontWeight: 700,
    color: tokens.colors.textMuted,
  };

  return {
    productCardButtonStyle,
    desktopActionIconButtonStyle,
    tableInfoButtonStyle,
    tableEditButtonStyle,
    tableDeleteButtonStyle,
    tableSurfaceStyle,
    cardsSurfaceStyle,
    sidePanelStyle,
    contentGridStyle,
    desktopViewToggleStyle,
    desktopViewActiveStyle,
    quickFilterPillStyle,
    quickFilterPillActiveStyle,
    summaryChipStyle,
    tableHeaderButtonStyle,
  };
}
