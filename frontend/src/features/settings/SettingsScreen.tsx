import { useEffect, useState } from 'preact/hooks';

import type { CurrentUser } from '../../auth';
import { showNotify } from '../../Notification';
import { translate, useI18n, type Locale } from '../../i18n';
import { QA_TEST_IDS } from '../../testing/testIds';
import { tokens } from '../../ui/tokens';
import { ui } from '../../ui/styles';
import { SettingsIcon, UserIcon } from '../../ui/icons';
import { SegmentedControl } from '../../ui/SegmentedControl';
import {
  MAINTENANCE_MODULE_KEYS_SETTING_KEY,
  type AdminSettingsKey,
} from '../../shared/domain/contracts';

import {
  type PasswordChangeFormState,
  persistAdminSettings,
  refreshExchangeRate,
  submitPasswordChange,
  updateLanguagePreference,
} from './settingsActions';
import {
  createDefaultAdminSettings,
  loadAdminSettings,
  type AdminSettingsState,
  type SettingsLoadStatus,
} from './settingsClient';
import {
  ADMIN_SETTINGS_COUNT,
  PERSONAL_SETTINGS_COUNT,
  RUNTIME_SETTINGS_COUNT,
  buildSettingsScreenState,
  getAvailableSettingsLanes,
  resolveDefaultSettingsLane,
  type SettingsLaneKey,
} from './settingsModel';
import { PersonalSecurityLane } from './components/PersonalSecurityLane';
import { SystemControlLane } from './components/SystemControlLane';

const SETTINGS_SCREEN_UI = {
  spacing: {
    xs: tokens.spacing.xs,
    sm: tokens.spacing.sm,
    md: tokens.spacing.md,
    mdPlus: tokens.spacing.mdPlus,
    lg: tokens.spacing.lg,
    lgPlus: tokens.spacing.lgPlus,
    xl: tokens.spacing.xl,
    xlPlus: tokens.spacing.xlPlus,
    xxl: tokens.spacing.xxl,
    xxxl: tokens.spacing.xxxl,
  },
  font: {
    xs: tokens.fontSize.xs,
    sm: tokens.fontSize.sm,
    md: tokens.fontSize.md,
    base: tokens.fontSize.base,
    displaySm: tokens.fontSize.displaySm,
    displayLg: tokens.fontSize.displayLg,
  },
} as const;

const LANE_ICON_MAP = {
  system: <SettingsIcon size={14} />,
  personal: <UserIcon size={14} />,
} as const;

type SettingsScreenProps = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isMobile?: boolean;
  currentUser: CurrentUser;
  onUserUpdated?: (partial: Partial<CurrentUser>) => void;
  onSystemSettingsUpdated?: (partial: Record<string, unknown>) => void;
};

export function SettingsScreen({
  isDarkMode,
  toggleDarkMode,
  isMobile,
  currentUser,
  onUserUpdated,
  onSystemSettingsUpdated,
}: SettingsScreenProps) {
  const token = currentUser?.token || '';
  const isBaseAdmin = Boolean(
    currentUser?.systemRole === 'admin' ||
      currentUser?.roleCodes?.includes?.('admin'),
  );
  const { locale, setLocale, t } = useI18n();
  const [activeLane, setActiveLane] = useState<SettingsLaneKey>(() =>
    resolveDefaultSettingsLane({ isBaseAdmin }),
  );
  const [settings, setSettings] = useState<AdminSettingsState>(() =>
    createDefaultAdminSettings(),
  );
  const [loading, setLoading] = useState(true);
  const [loadStatus, setLoadStatus] = useState<SettingsLoadStatus>('success');
  const [saving, setSaving] = useState(false);
  const [refreshingFx, setRefreshingFx] = useState(false);
  const [languageSaving, setLanguageSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwForm, setPwForm] = useState<PasswordChangeFormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    loadAdminSettings(token).then((result) => {
      if (cancelled) return;

      setSettings(result.settings);
      setLoadStatus(result.status);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const screenState = buildSettingsScreenState({
    isBaseAdmin,
    loadStatus,
    activeLane,
  });
  const activeLaneMeta =
    screenState.availableLanes.find((lane) => lane.key === screenState.activeLane) ??
    getAvailableSettingsLanes({ isBaseAdmin })[0];

  const updateSystemSettings = (nextSettings: AdminSettingsState) => {
    setSettings(nextSettings);
    onSystemSettingsUpdated?.({
      hide_phase_one_maintenance_modules:
        nextSettings.hide_phase_one_maintenance_modules,
      [MAINTENANCE_MODULE_KEYS_SETTING_KEY]:
        nextSettings[MAINTENANCE_MODULE_KEYS_SETTING_KEY],
    });
  };

  const handleAdminFieldChange = (key: AdminSettingsKey, value: string) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handlePasswordFieldChange = (
    field: keyof PasswordChangeFormState,
    value: string,
  ) => {
    setPwForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSaveSystemControl = async () => {
    setSaving(true);
    const result = await persistAdminSettings({ token, settings });

    if (result.ok) {
      updateSystemSettings(result.settings);
      showNotify(t('settings.saved_success'), 'success');
    } else {
      showNotify(result.error || t('settings.saved_error'), 'error');
    }

    setSaving(false);
  };

  const handleRefreshExchangeRate = async () => {
    setRefreshingFx(true);
    const result = await refreshExchangeRate({ token, settings });

    if (result.settings) {
      updateSystemSettings(result.settings);
    }

    if (!result.ok) {
      if (result.stage === 'save') {
        showNotify(result.error || t('settings.quotation.vcb_url.save_failed'), 'error');
      } else {
        showNotify(
          t('settings.quotation.refresh_failed', {
            error: result.error || 'Unknown error',
          }),
          'error',
        );
      }
      setRefreshingFx(false);
      return;
    }

    if (result.warnings.includes('RATE_TYPE_MISSING')) {
      showNotify(t('settings.quotation.refresh_invalid'), 'error');
      setRefreshingFx(false);
      return;
    }

    if (typeof result.rate === 'number' && result.effectiveDate) {
      showNotify(
        t('settings.quotation.refresh_success', {
          rate: result.rate,
          date: result.effectiveDate,
        }),
        'success',
      );
    } else {
      showNotify(t('settings.quotation.refresh_empty'), 'error');
    }

    setRefreshingFx(false);
  };

  const handlePasswordSubmit = async () => {
    setPwSaving(true);
    const result = await submitPasswordChange({ token, form: pwForm });

    if (!result.ok) {
      const messageKey =
        result.reason === 'required'
          ? 'settings.security.error.required'
          : result.reason === 'mismatch'
            ? 'settings.security.error.mismatch'
            : result.reason === 'min_length'
              ? 'settings.security.error.min_length'
              : null;

      showNotify(
        messageKey ? t(messageKey) : result.error || t('settings.security.error.failed'),
        'error',
      );
      setPwSaving(false);
      return;
    }

    if (result.user || result.token) {
      onUserUpdated?.({
        ...(result.user || {}),
        token: result.token || token,
      });
    }

    showNotify(t('settings.security.success'), 'success');
    setPwForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPwSaving(false);
  };

  const handleLanguageChange = async (nextLocale: Locale) => {
    setLanguageSaving(true);
    const result = await updateLanguagePreference({
      token,
      currentLocale: locale,
      nextLocale,
    });

    if (!result.ok) {
      showNotify(result.error || t('settings.error.update_language'), 'error');
      setLanguageSaving(false);
      return;
    }

    if (result.skipped) {
      setLanguageSaving(false);
      return;
    }

    setLocale(nextLocale);
    onUserUpdated?.({
      ...(result.user || {}),
      language: nextLocale,
    });
    showNotify(
      translate(nextLocale, 'settings.language.updated') || 'Đã cập nhật ngôn ngữ',
      'success',
    );
    setLanguageSaving(false);
  };

  return (
    <div
      style={{
        ...ui.page.shell,
        maxWidth: '100%',
        gap: SETTINGS_SCREEN_UI.spacing.xxl,
      }}
    >
      <div
        style={{
          ...ui.card.base,
          background: tokens.surface.panelGradient,
          padding: isMobile ? SETTINGS_SCREEN_UI.spacing.xxl : SETTINGS_SCREEN_UI.spacing.xxxl,
          display: 'grid',
          gap: SETTINGS_SCREEN_UI.spacing.xlPlus,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? '1fr'
              : 'minmax(0, 1.7fr) minmax(280px, 0.9fr)',
            gap: SETTINGS_SCREEN_UI.spacing.xlPlus,
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: SETTINGS_SCREEN_UI.spacing.mdPlus }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SETTINGS_SCREEN_UI.spacing.sm,
                flexWrap: 'wrap',
              }}
            >
              <span style={ui.badge.info}>
                {isBaseAdmin ? 'SYSTEM ADMIN ONLY' : 'SETTINGS'}
              </span>
              <span style={ui.badge.neutral}>{t(activeLaneMeta.labelKey).toUpperCase()}</span>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: SETTINGS_SCREEN_UI.font.displayLg,
                fontWeight: 900,
                color: tokens.colors.textPrimary,
                display: 'inline-flex',
                alignItems: 'center',
                gap: SETTINGS_SCREEN_UI.spacing.sm,
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
            <div style={{ ...ui.page.kpiRow, gap: SETTINGS_SCREEN_UI.spacing.md }}>
              <div
                style={{
                  ...ui.card.kpi,
                  minWidth: '0',
                  background: tokens.surface.badge,
                }}
              >
                <div
                  style={{
                    fontSize: SETTINGS_SCREEN_UI.font.xs,
                    fontWeight: 800,
                    color: tokens.colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {t('settings.metrics.system.title')}
                </div>
                <div
                  style={{
                    fontSize: tokens.fontSize.displaySm,
                    fontWeight: 900,
                    color: tokens.colors.textPrimary,
                  }}
                >
                  {ADMIN_SETTINGS_COUNT} keys / {RUNTIME_SETTINGS_COUNT} flag
                </div>
                <div
                  style={{
                    fontSize: tokens.fontSize.sm,
                    color: tokens.colors.textSecondary,
                    lineHeight: 1.6,
                  }}
                >
                  {t('settings.metrics.system.desc')}
                </div>
              </div>
              <div
                style={{
                  ...ui.card.kpi,
                  minWidth: '0',
                  background: tokens.surface.badge,
                }}
              >
                <div
                  style={{
                    fontSize: SETTINGS_SCREEN_UI.font.xs,
                    fontWeight: 800,
                    color: tokens.colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {t('settings.metrics.personal.title')}
                </div>
                <div
                  style={{
                    fontSize: tokens.fontSize.displaySm,
                    fontWeight: 900,
                    color: tokens.colors.textPrimary,
                  }}
                >
                  {PERSONAL_SETTINGS_COUNT} actions
                </div>
                <div
                  style={{
                    fontSize: tokens.fontSize.sm,
                    color: tokens.colors.textSecondary,
                    lineHeight: 1.6,
                  }}
                >
                  {t('settings.metrics.personal.desc')}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: SETTINGS_SCREEN_UI.spacing.md }}>
            <div
              style={{
                ...ui.card.base,
                background: tokens.colors.surface,
                padding: `${SETTINGS_SCREEN_UI.spacing.lgPlus} ${SETTINGS_SCREEN_UI.spacing.xlPlus}`,
                display: 'grid',
                gap: SETTINGS_SCREEN_UI.spacing.sm,
              }}
            >
              <div
                style={{
                  fontSize: SETTINGS_SCREEN_UI.font.base,
                  fontWeight: 800,
                  color: tokens.colors.primary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {t('settings.control_boundaries.title')}
              </div>
              <div
                style={{
                  fontSize: SETTINGS_SCREEN_UI.font.md,
                  color: tokens.colors.textSecondary,
                  lineHeight: 1.7,
                }}
              >
                {t('settings.control_boundaries.desc')}
              </div>
              <div
                style={{
                  fontSize: SETTINGS_SCREEN_UI.font.sm,
                  color: tokens.colors.textMuted,
                  lineHeight: 1.7,
                }}
              >
                {t('settings.control_boundaries.note')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        data-testid={QA_TEST_IDS.settings.laneNav}
        style={{ marginBottom: SETTINGS_SCREEN_UI.spacing.sm }}
      >
        <SegmentedControl
          ariaLabel={t('settings.lane.nav')}
          wrap={Boolean(isMobile)}
          options={screenState.availableLanes.map((lane) => ({
            value: lane.key,
            label: t(lane.labelKey),
            icon: LANE_ICON_MAP[lane.key],
          }))}
          value={screenState.activeLane}
          onChange={(next) => setActiveLane(next as SettingsLaneKey)}
        />
      </div>

      {screenState.activeLane === 'system' ? (
        <SystemControlLane
          isMobile={isMobile}
          settings={settings}
          loading={loading}
          loadStatus={loadStatus}
          saving={saving}
          refreshingFx={refreshingFx}
          onFieldChange={handleAdminFieldChange}
          onSave={handleSaveSystemControl}
          onRefreshExchangeRate={handleRefreshExchangeRate}
        />
      ) : null}

      {screenState.activeLane === 'personal' ? (
        <PersonalSecurityLane
          isDarkMode={isDarkMode}
          locale={locale}
          languageSaving={languageSaving}
          pwSaving={pwSaving}
          pwForm={pwForm}
          toggleDarkMode={toggleDarkMode}
          onChangeLanguage={handleLanguageChange}
          onPasswordFieldChange={handlePasswordFieldChange}
          onPasswordSubmit={handlePasswordSubmit}
        />
      ) : null}
    </div>
  );
}
