import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('UI accessibility source contracts', () => {
  it('keeps the shell search field labelled and the theme toggle named', () => {
    const layoutSource = readFileSync(path.resolve(__dirname, '../Layout.tsx'), 'utf8');

    expect(layoutSource).toContain("aria-label={t('nav.search.placeholder')}");
    expect(layoutSource).toContain("aria-label={isDarkMode ? t('nav.theme.light') : t('nav.theme.dark')}");
  });

  it('does not suppress focus outlines in shared input primitives', () => {
    const stylesSource = readFileSync(path.resolve(__dirname, './styles.ts'), 'utf8');

    expect(stylesSource).not.toContain("outline: 'none'");
  });

  it('announces toast notifications via aria-live', () => {
    const notificationSource = readFileSync(path.resolve(__dirname, '../Notification.tsx'), 'utf8');

    expect(notificationSource).toContain('aria-live="polite"');
    expect(notificationSource).toContain('role="status"');
  });

  it('renders notification rows as keyboard-operable buttons when clickable', () => {
    const bellSource = readFileSync(path.resolve(__dirname, '../ops/NotificationBell.tsx'), 'utf8');

    expect(bellSource).toContain('if (isClickable) {');
    expect(bellSource).toContain('type="button"');
    expect(bellSource).toContain('aria-label={`${item.content} ${formatNotificationTime(item.createdAt)}`.trim()}');
  });

  it('returns focus to the bell trigger and focuses the first actionable item when the popover opens', () => {
    const bellSource = readFileSync(path.resolve(__dirname, '../ops/NotificationBell.tsx'), 'utf8');

    expect(bellSource).toContain('triggerRef.current?.focus();');
    expect(bellSource).toContain("notificationItemRefs.current.find(Boolean) ?? refreshButtonRef.current ?? panelRef.current");
    expect(bellSource).toContain('aria-haspopup="dialog"');
  });

  it('uses a localized close label for overlay modals', () => {
    const overlaySource = readFileSync(path.resolve(__dirname, './OverlayModal.tsx'), 'utf8');

    expect(overlaySource).toContain("closeButtonAriaLabel = 'Đóng'");
    expect(overlaySource).toContain('title={closeButtonAriaLabel}');
  });
});
