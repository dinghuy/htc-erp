import { useState } from 'preact/hooks';

import type { CurrentUser } from '../../auth';
import { useI18n } from '../../i18n';
import { QA_TEST_IDS } from '../../testing/testIds';
import { tokens } from '../../ui/tokens';
import { ui } from '../../ui/styles';
import { SettingsIcon, UserIcon } from '../../ui/icons';
import { SegmentedControl } from '../../ui/SegmentedControl';
import {
  ADMIN_SETTINGS_SECTION_KEYS,
  USER_SETTINGS_SECTION_KEYS,
  buildSettingsScreenState,
  type SettingsLaneKey,
} from './settingsSections';

type SettingsScreenProps = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isMobile?: boolean;
  currentUser: CurrentUser;
  onUserUpdated?: (partial: Partial<CurrentUser>) => void;
  onSystemSettingsUpdated?: (partial: Record<string, unknown>) => void;
};

const laneLabelKeys: Record<SettingsLaneKey, string> = {
  admin: 'settings.tab.admin',
  user: 'settings.title',
};

const laneIcons = {
  admin: <SettingsIcon size={14} />,
  user: <UserIcon size={14} />,
} as const;

export function SettingsScreen({
  isDarkMode,
  toggleDarkMode,
  isMobile,
  currentUser,
}: SettingsScreenProps) {
  const { t } = useI18n();
  const isBaseAdmin = Boolean(
    currentUser.systemRole === 'admin' || currentUser.roleCodes?.includes('admin'),
  );
  const [activeLane, setActiveLane] = useState<SettingsLaneKey>(
    isBaseAdmin ? 'admin' : 'user',
  );

  const screenState = buildSettingsScreenState({
    isBaseAdmin,
    activeLane,
  });

  const activeLaneLabel = t(laneLabelKeys[screenState.activeLane]);

  return (
    <div
      style={{
        ...ui.page.shell,
        maxWidth: '100%',
        gap: tokens.spacing.xxl,
      }}
    >
      <div
        style={{
          ...ui.card.base,
          background: tokens.surface.panelGradient,
          padding: isMobile ? tokens.spacing.xxl : tokens.spacing.xxxl,
          display: 'grid',
          gap: tokens.spacing.xl,
        }}
      >
        <div style={{ display: 'grid', gap: tokens.spacing.md }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
            <span style={ui.badge.info}>{isBaseAdmin ? 'SYSTEM ADMIN ONLY' : 'SETTINGS'}</span>
            <span style={ui.badge.neutral}>{activeLaneLabel.toUpperCase()}</span>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: tokens.fontSize.displayLg,
              fontWeight: 900,
              color: tokens.colors.textPrimary,
              display: 'inline-flex',
              alignItems: 'center',
              gap: tokens.spacing.sm,
            }}
          >
            <SettingsIcon size={24} /> {t('settings.title')}
          </h1>
          <p
            style={{
              margin: 0,
              color: tokens.colors.textSecondary,
              lineHeight: 1.8,
              maxWidth: '820px',
            }}
          >
            {t('settings.desc')}
          </p>
        </div>
      </div>

      <div data-testid={QA_TEST_IDS.settings.laneNav}>
        <SegmentedControl
          ariaLabel={t('settings.title')}
          wrap={Boolean(isMobile)}
          options={screenState.availableLanes.map((lane) => ({
            value: lane.key,
            label: t(laneLabelKeys[lane.key]),
            icon: laneIcons[lane.key],
          }))}
          value={screenState.activeLane}
          onChange={(next) => setActiveLane(next as SettingsLaneKey)}
        />
      </div>

      {screenState.activeLane === 'admin' ? (
        <div style={{ ...ui.card.base, display: 'grid', gap: tokens.spacing.md }}>
          <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textMuted }}>
            {t('settings.tab.admin')}
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', color: tokens.colors.textSecondary }}>
            {ADMIN_SETTINGS_SECTION_KEYS.map((sectionKey) => (
              <li key={sectionKey}>{sectionKey}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {screenState.activeLane === 'user' ? (
        <div style={{ ...ui.card.base, display: 'grid', gap: tokens.spacing.lg }}>
          <div style={{ display: 'grid', gap: tokens.spacing.sm }}>
            <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textMuted }}>
              {t('settings.display.dark_mode.title')}
            </div>
            <div style={{ color: tokens.colors.textSecondary }}>
              {t('settings.display.dark_mode.desc')}
            </div>
            <button type="button" style={ui.btn.outline} onClick={toggleDarkMode}>
              {isDarkMode
                ? t('settings.display.dark_mode.enable_light')
                : t('settings.display.dark_mode.enable_dark')}
            </button>
          </div>

          <div style={{ display: 'grid', gap: tokens.spacing.sm }}>
            <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textMuted }}>
              {t('settings.tab.security')}
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: tokens.colors.textSecondary }}>
              {USER_SETTINGS_SECTION_KEYS.map((sectionKey) => (
                <li key={sectionKey}>{sectionKey}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
