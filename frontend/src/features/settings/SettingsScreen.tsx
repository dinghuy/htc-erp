import { useEffect, useMemo, useState } from 'preact/hooks';

import { fetchWithAuth, type CurrentUser } from '../../auth';
import { showNotify } from '../../Notification';
import { API_BASE } from '../../config';
import { useI18n } from '../../i18n';
import { ROLE_LABELS } from '../../shared/domain/contracts';
import { QA_TEST_IDS } from '../../testing/testIds';
import { SettingsIcon, UserIcon } from '../../ui/icons';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ui } from '../../ui/styles';
import { tokens } from '../../ui/tokens';
import {
  buildAdminSettingsPanelModel,
  buildRuntimeSettingsPatch,
  buildSettingsScreenState,
  countAdminExposureByKind,
  getAdminExposureSections,
  getAdminSectionDescription,
  getRuntimeToggleCopy,
  type SettingsLaneKey,
} from './settingsSections';

const sectionCardStyle = {
  ...ui.card.base,
  display: 'grid',
  gap: tokens.spacing.lg,
  padding: tokens.spacing.xl,
} as const;

const fieldStackStyle = {
  display: 'grid',
  gap: tokens.spacing.sm,
} as const;

const helperTextStyle = {
  ...ui.form.help,
  margin: 0,
} as const;

const laneLabelKeys: Record<SettingsLaneKey, string> = {
  admin: 'settings.tab.admin',
  user: 'settings.title',
};

const laneIcons = {
  admin: SettingsIcon,
  user: UserIcon,
} as const;

function isValidEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function resolvePrimaryRoleLabel(currentUser: CurrentUser) {
  const roleCode = currentUser.roleCodes?.[0] ?? currentUser.systemRole;
  return ROLE_LABELS[roleCode] ?? roleCode;
}

function formatSectionKey(sectionKey: string) {
  return sectionKey
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getAdminMapDescription(sectionKey: string) {
  switch (sectionKey) {
    case 'operational-summary':
    case 'module-exposure':
    case 'runtime-controls':
    case 'pricing-finance-policy':
      return getAdminSectionDescription(sectionKey);
    default:
      return '';
  }
}

export type SettingsScreenProps = {
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
  const { t } = useI18n();
  const isBaseAdmin = Boolean(
    currentUser.systemRole === 'admin' || currentUser.roleCodes?.includes('admin'),
  );
  const [activeLane, setActiveLane] = useState(isBaseAdmin ? ('admin' as SettingsLaneKey) : ('user' as SettingsLaneKey));
  const [fullName, setFullName] = useState(currentUser.fullName ?? '');
  const [email, setEmail] = useState(currentUser.email ?? '');
  const [language, setLanguage] = useState<'vi' | 'en'>(currentUser.language === 'en' ? 'en' : 'vi');
  const [profileError, setProfileError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const screenState = buildSettingsScreenState({
    isBaseAdmin,
    activeLane,
  });

  const activeLaneLabel = t(laneLabelKeys[screenState.activeLane]);
  const primaryRoleLabel = useMemo(() => resolvePrimaryRoleLabel(currentUser), [currentUser]);
  const adminPanelModel = useMemo(() => buildAdminSettingsPanelModel(currentUser), [currentUser]);
  const exposureCounts = useMemo(
    () => countAdminExposureByKind(adminPanelModel.moduleExposure),
    [adminPanelModel.moduleExposure],
  );
  const exposureSections = useMemo(
    () => getAdminExposureSections(adminPanelModel.moduleExposure),
    [adminPanelModel.moduleExposure],
  );
  const runtimeToggleCopy = useMemo(
    () => getRuntimeToggleCopy(adminPanelModel.hideMaintenanceModules),
    [adminPanelModel.hideMaintenanceModules],
  );

  useEffect(() => {
    setFullName(currentUser.fullName ?? '');
    setEmail(currentUser.email ?? '');
    setLanguage(currentUser.language === 'en' ? 'en' : 'vi');
  }, [currentUser.email, currentUser.fullName, currentUser.language]);

  const handleProfileSave = () => {
    const nextFullName = fullName.trim();
    const nextEmail = email.trim();

    if (!nextFullName) {
      setProfileError(t('settings.profile.error.required_name'));
      return;
    }

    if (!nextEmail) {
      setProfileError(t('settings.profile.error.required_email'));
      return;
    }

    if (!isValidEmail(nextEmail)) {
      setProfileError(t('settings.profile.error.invalid_email'));
      return;
    }

    setProfileError('');
    onUserUpdated?.({
      fullName: nextFullName,
      email: nextEmail,
      language,
    });
    showNotify(t('settings.profile.saved'), 'success');
  };

  const handlePasswordSubmit = async (event: Event) => {
    event.preventDefault();
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('settings.security.error.required'));
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(t('settings.security.error.min_length'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.security.error.mismatch'));
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const response = await fetchWithAuth(currentUser.token, `${API_BASE}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(t('settings.security.error.failed'));
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showNotify(t('settings.security.success'), 'success');
    } catch {
      setPasswordError(t('settings.security.error.failed'));
    } finally {
      setIsSubmittingPassword(false);
    }
  };

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
            <SettingsIcon size={24} />
            {t('settings.title')}
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
          options={screenState.availableLanes.map((lane) => {
            const LaneIcon = laneIcons[lane.key];
            return {
              value: lane.key,
              label: t(laneLabelKeys[lane.key]),
              icon: <LaneIcon size={14} />,
            };
          })}
          value={screenState.activeLane}
          onChange={(next) => {
            if (next === 'admin' || next === 'user') {
              setActiveLane(next);
            }
          }}
        />
      </div>

      {screenState.activeLane === 'admin' ? (
        <div style={{ display: 'grid', gap: tokens.spacing.lg }}>
          <section style={sectionCardStyle} data-testid={QA_TEST_IDS.settings.adminSummaryCard}>
            <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textMuted }}>
              Operational summary
            </div>
            <p style={helperTextStyle}>{getAdminSectionDescription('operational-summary')}</p>
            <div style={{ ...ui.page.kpiRow, gap: tokens.spacing.md }}>
              {adminPanelModel.summaryMetrics.map((metric) => (
                <div key={metric.label} style={{ ...ui.card.kpi, minWidth: '180px' }}>
                  <div style={{ fontSize: tokens.fontSize.xs, fontWeight: 800, color: tokens.colors.textMuted }}>
                    {metric.label}
                  </div>
                  <div style={{ fontSize: tokens.fontSize.xl, fontWeight: 900, color: tokens.colors.textPrimary }}>
                    {metric.value}
                  </div>
                  <p style={helperTextStyle}>{metric.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={sectionCardStyle} data-testid={QA_TEST_IDS.settings.adminExposureCard}>
            <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textMuted }}>
              Module exposure and shell routing
            </div>
            <p style={helperTextStyle}>{getAdminSectionDescription('module-exposure')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
              <span style={{ ...ui.badge.success, display: 'inline-flex' }}>{`Core ${exposureCounts.core}`}</span>
              <span style={{ ...ui.badge.warning, display: 'inline-flex' }}>{`Maintenance ${exposureCounts.maintenance}`}</span>
              <span style={{ ...ui.badge.info, display: 'inline-flex' }}>{`Admin ${exposureCounts.admin}`}</span>
            </div>
            <div style={{ display: 'grid', gap: tokens.spacing.md }}>
              {exposureSections.map((section) => (
                <div key={section.key} style={{ display: 'grid', gap: tokens.spacing.sm }}>
                  <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textPrimary }}>
                    {section.title}
                  </div>
                  {section.items.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
                      {section.items.map((item) => (
                        <span
                          key={item.module}
                          style={{
                            padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
                            borderRadius: tokens.radius.md,
                            border: `1px solid ${tokens.colors.border}`,
                            background: tokens.colors.background,
                            color: tokens.colors.textSecondary,
                            fontSize: tokens.fontSize.sm,
                            fontWeight: 700,
                          }}
                        >
                          {item.module} · {item.exposure === 'core' ? 'Core' : item.exposure === 'admin' ? 'Admin' : 'Maintenance'}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={helperTextStyle}>{`No ${section.title.toLowerCase()} available for this account.`}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section style={sectionCardStyle} data-testid={QA_TEST_IDS.settings.adminRuntimeCard}>
            <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textMuted }}>
              Runtime controls
            </div>
            <p style={helperTextStyle}>{getAdminSectionDescription('runtime-controls')}</p>
            <div
              style={{
                ...ui.card.base,
                padding: tokens.spacing.lg,
                display: 'grid',
                gap: tokens.spacing.md,
                background: tokens.colors.background,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
                <span style={ui.badge.warning}>{runtimeToggleCopy.title}</span>
              </div>
              <p style={helperTextStyle}>{runtimeToggleCopy.description}</p>
              <button
                type="button"
                data-testid={QA_TEST_IDS.settings.adminRuntimeToggle}
                style={{ ...ui.btn.outline, justifyContent: 'center' }}
                onClick={() =>
                  onSystemSettingsUpdated?.(
                    buildRuntimeSettingsPatch(!adminPanelModel.hideMaintenanceModules),
                  )
                }
              >
                {runtimeToggleCopy.actionLabel}
              </button>
            </div>
          </section>

          <section style={sectionCardStyle} data-testid={QA_TEST_IDS.settings.adminPolicyCard}>
            <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textMuted }}>
              Policy and admin information
            </div>
            <p style={helperTextStyle}>{getAdminSectionDescription('pricing-finance-policy')}</p>
            <div style={{ display: 'grid', gap: tokens.spacing.md }}>
              {adminPanelModel.policyItems.map((item) => (
                <div
                  key={item.label}
                  style={{
                    ...ui.card.base,
                    padding: tokens.spacing.lg,
                    display: 'grid',
                    gap: tokens.spacing.sm,
                    background: tokens.colors.background,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
                    <span style={ui.badge.neutral}>{item.label.toUpperCase()}</span>
                    <span style={{ fontSize: tokens.fontSize.sm, fontWeight: 700, color: tokens.colors.textPrimary }}>
                      {item.value.length > 88 ? `${item.value.slice(0, 85)}...` : item.value}
                    </span>
                  </div>
                  <p style={helperTextStyle}>{item.description}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gap: tokens.spacing.xs }}>
              <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textMuted }}>
                Admin section map
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', color: tokens.colors.textSecondary, display: 'grid', gap: tokens.spacing.xs }}>
                {screenState.sections.map((section) => {
                  const description = getAdminMapDescription(section.key);
                  return (
                    <li key={section.key}>
                      {formatSectionKey(section.key)}
                      {description ? ` — ${description}` : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>
      ) : null}

      {screenState.activeLane === 'user' ? (
        <div
          style={{
            display: 'grid',
            gap: tokens.spacing.lg,
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            alignItems: 'start',
          }}
        >
          <section style={sectionCardStyle} data-testid={QA_TEST_IDS.settings.displayCard}>
            <div style={fieldStackStyle}>
              <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textMuted }}>
                {t('settings.tab.display')}
              </div>
              <h2 style={{ margin: 0, fontSize: tokens.fontSize.xl, color: tokens.colors.textPrimary }}>
                {t('settings.display.dark_mode.title')}
              </h2>
              <p style={helperTextStyle}>{t('settings.display.dark_mode.desc')}</p>
            </div>

            <div style={fieldStackStyle}>
              <label style={ui.form.label} htmlFor={QA_TEST_IDS.settings.languageSelect}>
                {t('settings.display.language.title')}
              </label>
              <select
                id={QA_TEST_IDS.settings.languageSelect}
                data-testid={QA_TEST_IDS.settings.languageSelect}
                value={language}
                onChange={(event) =>
                  setLanguage((event.currentTarget as HTMLSelectElement).value as 'vi' | 'en')
                }
                style={ui.input.base}
              >
                <option value="vi">{t('settings.display.language.option.vi')}</option>
                <option value="en">{t('settings.display.language.option.en')}</option>
              </select>
              <p style={helperTextStyle}>{t('settings.display.language.desc')}</p>
            </div>

            <button
              type="button"
              data-testid={QA_TEST_IDS.settings.themeToggle}
              style={{ ...ui.btn.outline, justifyContent: 'center' }}
              onClick={toggleDarkMode}
            >
              {isDarkMode
                ? t('settings.display.dark_mode.enable_light')
                : t('settings.display.dark_mode.enable_dark')}
            </button>
          </section>

          <section style={sectionCardStyle} data-testid={QA_TEST_IDS.settings.profileCard}>
            <div style={fieldStackStyle}>
              <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textMuted }}>
                {t('settings.profile.title')}
              </div>
              <p style={helperTextStyle}>{t('settings.profile.desc')}</p>
            </div>

            <div style={fieldStackStyle}>
              <label style={ui.form.label} htmlFor={QA_TEST_IDS.settings.fullNameInput}>
                {t('settings.profile.full_name')}
              </label>
              <input
                id={QA_TEST_IDS.settings.fullNameInput}
                data-testid={QA_TEST_IDS.settings.fullNameInput}
                type="text"
                value={fullName}
                onInput={(event) => setFullName((event.currentTarget as HTMLInputElement).value)}
                placeholder={t('settings.profile.full_name.placeholder')}
                style={ui.input.base}
              />
            </div>

            <div style={fieldStackStyle}>
              <label style={ui.form.label} htmlFor={QA_TEST_IDS.settings.emailInput}>
                {t('settings.profile.email')}
              </label>
              <input
                id={QA_TEST_IDS.settings.emailInput}
                data-testid={QA_TEST_IDS.settings.emailInput}
                type="email"
                value={email}
                onInput={(event) => setEmail((event.currentTarget as HTMLInputElement).value)}
                placeholder={t('settings.profile.email.placeholder')}
                style={ui.input.base}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                gap: tokens.spacing.md,
              }}
            >
              <div style={fieldStackStyle}>
                <span style={ui.form.label}>{t('settings.profile.username')}</span>
                <div style={{ ...ui.input.base, display: 'flex', alignItems: 'center' }}>{currentUser.username}</div>
              </div>
              <div style={fieldStackStyle}>
                <span style={ui.form.label}>{t('settings.profile.role')}</span>
                <div style={{ ...ui.input.base, display: 'flex', alignItems: 'center' }}>{primaryRoleLabel}</div>
              </div>
            </div>

            {profileError ? <div style={ui.form.error}>{profileError}</div> : null}

            <button
              type="button"
              data-testid={QA_TEST_IDS.settings.profileSave}
              style={{ ...ui.btn.primary, justifyContent: 'center' }}
              onClick={handleProfileSave}
            >
              {t('settings.profile.save')}
            </button>
          </section>

          <section
            style={{ ...sectionCardStyle, gridColumn: isMobile ? 'auto' : '1 / -1' }}
            data-testid={QA_TEST_IDS.settings.securityCard}
          >
            <div style={fieldStackStyle}>
              <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 800, color: tokens.colors.textMuted }}>
                {t('settings.tab.security')}
              </div>
              <h2 style={{ margin: 0, fontSize: tokens.fontSize.xl, color: tokens.colors.textPrimary }}>
                {t('settings.security.title')}
              </h2>
            </div>

            <form
              onSubmit={handlePasswordSubmit}
              style={{
                display: 'grid',
                gap: tokens.spacing.lg,
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              }}
            >
              <div style={fieldStackStyle}>
                <label style={ui.form.label} htmlFor={QA_TEST_IDS.settings.passwordCurrentInput}>
                  {t('settings.security.current_password')}
                </label>
                <input
                  id={QA_TEST_IDS.settings.passwordCurrentInput}
                  data-testid={QA_TEST_IDS.settings.passwordCurrentInput}
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onInput={(event) => setCurrentPassword((event.currentTarget as HTMLInputElement).value)}
                  placeholder={t('settings.security.current_password.placeholder')}
                  style={ui.input.base}
                />
              </div>

              <div style={fieldStackStyle}>
                <label style={ui.form.label} htmlFor={QA_TEST_IDS.settings.passwordNewInput}>
                  {t('settings.security.new_password')}
                </label>
                <input
                  id={QA_TEST_IDS.settings.passwordNewInput}
                  data-testid={QA_TEST_IDS.settings.passwordNewInput}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onInput={(event) => setNewPassword((event.currentTarget as HTMLInputElement).value)}
                  placeholder={t('settings.security.new_password.placeholder')}
                  style={ui.input.base}
                />
              </div>

              <div style={fieldStackStyle}>
                <label style={ui.form.label} htmlFor={QA_TEST_IDS.settings.passwordConfirmInput}>
                  {t('settings.security.confirm_password')}
                </label>
                <input
                  id={QA_TEST_IDS.settings.passwordConfirmInput}
                  data-testid={QA_TEST_IDS.settings.passwordConfirmInput}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onInput={(event) => setConfirmPassword((event.currentTarget as HTMLInputElement).value)}
                  placeholder={t('settings.security.confirm_password.placeholder')}
                  style={ui.input.base}
                />
              </div>

              <div style={{ display: 'grid', gap: tokens.spacing.md, gridColumn: isMobile ? 'auto' : '1 / -1' }}>
                {passwordError ? <div style={ui.form.error}>{passwordError}</div> : null}
                <button
                  type="submit"
                  data-testid={QA_TEST_IDS.settings.passwordSubmit}
                  style={{ ...ui.btn.primary, justifyContent: 'center' }}
                  disabled={isSubmittingPassword}
                >
                  {isSubmittingPassword ? t('settings.saving') : t('settings.security.submit')}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
