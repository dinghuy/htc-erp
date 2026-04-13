import { tokens } from '../../ui/tokens';
import { ui } from '../../ui/styles';
import { ROLE_LABELS, type SystemRole } from '../../auth';
import { resetRolePreviewSessionProgress, toggleRolePreviewSessionChecklistItem } from '../../preview/rolePreviewSession';
import { getRolePreviewPresetNavigation, getRolePreviewWorkspaceNavigation, isRolePreviewPresetActive, normalizePreviewRoleCodes, ROLE_PREVIEW_PRESETS, type RolePreviewNavigation } from '../../authRolePreview';
import { QA_TEST_IDS, settingsPreviewPresetTestId } from '../../testing/testIds';
import { showNotify } from '../../Notification';
import { CheckIcon } from '../../ui/icons';

const PREVIEWABLE_ROLE_CODES: SystemRole[] = [
  'sales', 'project_manager', 'procurement', 'accounting', 'legal', 'director', 'viewer',
];

interface AdminRolePreviewPanelProps {
  previewRoles: SystemRole[];
  setPreviewRoles: (fn: ((prev: SystemRole[]) => SystemRole[]) | SystemRole[]) => void;
  previewChecklistDone: number[];
  setPreviewChecklistDone: (v: number[]) => void;
  checklistRoleCodes: SystemRole[];
  previewChecklist: { title: string; description: string; items: string[] };
  previewChecklistDoneCount: number;
  currentUser?: any;
  isMobile?: boolean;
  onRolePreviewChange?: (previewRoleCodes?: SystemRole[], navigation?: RolePreviewNavigation) => void;
  t: (key: string, params?: Record<string, string>) => string;
  sectionLabel: any;
}

export function AdminRolePreviewPanel({
  previewRoles,
  setPreviewRoles,
  previewChecklistDone,
  setPreviewChecklistDone,
  checklistRoleCodes,
  previewChecklist,
  previewChecklistDoneCount,
  currentUser,
  isMobile,
  onRolePreviewChange,
  t,
  sectionLabel,
}: AdminRolePreviewPanelProps) {
  return (
    <div
      data-testid={QA_TEST_IDS.settings.previewPanel}
      style={{ padding: '24px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px solid ${tokens.colors.border}`, display: 'grid', gap: '16px' }}
    >
      <div>
        <div style={sectionLabel}>{t('settings.admin.preview.label')}</div>
        <div style={{ marginTop: '8px', fontSize: '14px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
          {t('settings.admin.preview.text')}
        </div>
      </div>

      {/* Preset buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
        {ROLE_PREVIEW_PRESETS.map((preset) => {
          const active = isRolePreviewPresetActive(previewRoles, preset.roleCodes);
          return (
            <button
              key={preset.key}
              type="button"
              data-testid={settingsPreviewPresetTestId(preset.key)}
              onClick={() => {
                const nextRoles = normalizePreviewRoleCodes(preset.roleCodes);
                const navigation = getRolePreviewPresetNavigation(preset.key);
                setPreviewRoles(nextRoles);
                onRolePreviewChange?.(nextRoles.length > 0 ? nextRoles : undefined, navigation);
                showNotify(t('settings.admin.preview.notify.apply', { role: preset.label.replace('View as ', '') }), 'success');
              }}
              style={{
                ...ui.btn.outline,
                justifyContent: 'center',
                background: active ? tokens.colors.primary : tokens.colors.surface,
                color: active ? tokens.colors.textOnPrimary : tokens.colors.textPrimary,
                borderColor: active ? tokens.colors.primary : tokens.colors.border,
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Individual role toggles */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
        {PREVIEWABLE_ROLE_CODES.map((roleCode) => {
          const active = previewRoles.includes(roleCode);
          return (
            <button
              key={roleCode}
              type="button"
              onClick={() =>
                setPreviewRoles((prev: SystemRole[]) =>
                  active ? prev.filter((item) => item !== roleCode) : [...prev, roleCode]
                )
              }
              style={{
                ...ui.btn.outline,
                justifyContent: 'center',
                background: active ? tokens.colors.badgeBgSuccess : tokens.colors.surface,
                color: active ? tokens.colors.primary : tokens.colors.textSecondary,
                borderColor: active ? tokens.colors.primary : tokens.colors.border,
              }}
            >
              {ROLE_LABELS[roleCode]}
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          data-testid={QA_TEST_IDS.settings.previewApply}
          onClick={() => {
            const normalized = normalizePreviewRoleCodes(previewRoles);
            onRolePreviewChange?.(normalized.length > 0 ? normalized : undefined);
            showNotify(
              normalized.length > 0
                ? t('settings.admin.preview.notify.applied')
                : t('settings.admin.preview.notify.reset'),
              'success'
            );
          }}
          style={ui.btn.primary as any}
        >
          {t('settings.admin.preset.apply')}
        </button>
        <button
          type="button"
          data-testid={QA_TEST_IDS.settings.previewReset}
          onClick={() => {
            setPreviewRoles([]);
            onRolePreviewChange?.(undefined);
            showNotify(t('settings.admin.preview.notify.reset'), 'success');
          }}
          style={ui.btn.outline as any}
        >
          {t('settings.admin.preset.reset')}
        </button>
        <button
          type="button"
          data-testid={QA_TEST_IDS.settings.previewOpenWorkspace}
          onClick={() => {
            const activeRoles = normalizePreviewRoleCodes(
              previewRoles.length ? previewRoles : currentUser?.previewRoleCodes
            );
            const workspaceNavigation = getRolePreviewWorkspaceNavigation(
              activeRoles.length ? activeRoles : currentUser?.roleCodes,
              currentUser?.systemRole
            );
            onRolePreviewChange?.(activeRoles.length > 0 ? activeRoles : undefined, workspaceNavigation);
            showNotify(t('settings.admin.preview.notify.workspace'), 'success');
          }}
          style={ui.btn.outline as any}
        >
          {t('settings.admin.preset.workspace')}
        </button>
      </div>

      {/* QA Checklist */}
      <div
        data-testid={QA_TEST_IDS.settings.checklist}
        style={{ padding: '20px', borderRadius: tokens.radius.lg, background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, display: 'grid', gap: '12px' }}
      >
        <div>
          <div style={sectionLabel}>{t('settings.admin.qa.label')}</div>
          <div style={{ marginTop: '8px', fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{previewChecklist.title}</div>
          <div style={{ marginTop: '4px', fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{previewChecklist.description}</div>
        </div>

        <div
          data-testid={QA_TEST_IDS.settings.qaSessionLog}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '12px 14px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px solid ${tokens.colors.border}` }}
        >
          <div style={{ display: 'grid', gap: '4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>
              {t('settings.admin.session.title', { done: String(previewChecklistDoneCount), total: String(previewChecklist.items.length) })}
            </div>
            <div style={{ fontSize: '12px', color: tokens.colors.textMuted, lineHeight: 1.6 }}>
              {t('settings.admin.session.desc')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              resetRolePreviewSessionProgress(checklistRoleCodes);
              setPreviewChecklistDone([]);
              showNotify(t('settings.admin.session.reset'), 'success');
            }}
            style={ui.btn.outline as any}
          >
            {t('settings.admin.session.reset')}
          </button>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          {previewChecklist.items.map((item, index) => (
            <div key={`${previewChecklist.title}-${index}`} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: '10px', alignItems: 'start' }}>
              <button
                type="button"
                aria-pressed={previewChecklistDone.includes(index)}
                onClick={() => {
                  const next = toggleRolePreviewSessionChecklistItem(checklistRoleCodes, index);
                  setPreviewChecklistDone(
                    next.completedItemIndexes.filter((v) => v < previewChecklist.items.length)
                  );
                }}
                style={{
                  width: '28px',
                  minWidth: '28px',
                  height: '28px',
                  borderRadius: '999px',
                  border: `1px solid ${previewChecklistDone.includes(index) ? tokens.colors.primary : tokens.colors.border}`,
                  background: previewChecklistDone.includes(index) ? tokens.colors.badgeBgSuccess : tokens.colors.surface,
                  color: previewChecklistDone.includes(index) ? tokens.colors.primary : tokens.colors.textMuted,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 800,
                }}
              >
                {previewChecklistDone.includes(index) ? <CheckIcon size={14} /> : index + 1}
              </button>
              <span style={{ fontSize: '13px', color: previewChecklistDone.includes(index) ? tokens.colors.textPrimary : tokens.colors.textSecondary, lineHeight: 1.6, textDecoration: previewChecklistDone.includes(index) ? 'line-through' : 'none' }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
