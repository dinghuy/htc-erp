import type { JSX } from 'preact';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';

export const PRODUCT_MODAL_FLOATING_TAB_BREAKPOINT = 720;

export type ProductModalTabRailItem = {
  key: string;
  label: string;
  tabId: string;
  panelId: string;
  count?: number;
  disabled?: boolean;
  describedBy?: string;
};

type ProductModalTabRailProps = {
  ariaLabel: string;
  tabs: ProductModalTabRailItem[];
  activeKey: string;
  isStickyEnabled: boolean;
  onSelect: (key: string) => void;
  onKeyDown: (event: JSX.TargetedKeyboardEvent<HTMLButtonElement>, key: string) => void;
};

export function ProductModalTabRail({
  ariaLabel,
  tabs,
  activeKey,
  isStickyEnabled,
  onSelect,
  onKeyDown,
}: ProductModalTabRailProps) {
  return (
    <section
      style={{
        position: isStickyEnabled ? 'sticky' : 'relative',
        top: isStickyEnabled ? '12px' : 0,
        zIndex: tokens.zIndex.sticky + 1,
        padding: 0,
        display: 'grid',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
      }}
    >
      <div
        style={{
          ...ui.modal.stickyRail,
          background: tokens.surface.shellChromeRaised,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: '22px',
          boxShadow: tokens.shadow.md,
          padding: '12px 14px',
        }}
      >
        <div role="tablist" aria-label={ariaLabel} style={ui.modal.tabScroller}>
          {tabs.map((tab) => {
            const isActive = activeKey === tab.key && !tab.disabled;
            return (
              <button
                key={tab.key}
                id={tab.tabId}
                role="tab"
                type="button"
                disabled={tab.disabled}
                aria-selected={isActive}
                aria-controls={tab.panelId}
                aria-describedby={tab.describedBy}
                tabIndex={tab.disabled ? -1 : isActive ? 0 : -1}
                onClick={() => {
                  if (!tab.disabled) onSelect(tab.key);
                }}
                onKeyDown={(event) => {
                  if (!tab.disabled) onKeyDown(event, tab.key);
                }}
                style={{
                  ...ui.btn.ghost,
                  minHeight: '40px',
                  borderRadius: '999px',
                  padding: '8px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: `1px solid ${isActive ? tokens.colors.primary : tokens.colors.border}`,
                  background: isActive ? tokens.colors.successTint : tokens.colors.surfaceSubtle,
                  color: isActive ? tokens.colors.primary : tokens.colors.textPrimary,
                  fontWeight: isActive ? 800 : 700,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  opacity: tab.disabled ? 0.6 : 1,
                  cursor: tab.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' ? (
                  <span
                    style={{
                      ...ui.badge.neutral,
                      background: isActive ? tokens.colors.surface : tokens.colors.surfaceSubtle,
                      color: isActive ? tokens.colors.primary : tokens.colors.textMuted,
                      border: `1px solid ${tokens.colors.border}`,
                    }}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
