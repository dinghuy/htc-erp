# App Shell Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the HTC ERP frontend shell with the approved design handoff by updating shared tokens, shared UI primitives, and `Layout.tsx` without changing route logic or feature internals.

**Architecture:** Use a token-first, shell-later rollout. First, make `frontend/src/index.css` the runtime source of truth for the handoff-aligned light/dark values and expose them semantically through `frontend/src/ui/tokens.ts` and `frontend/src/ui/styles.ts`. Then restyle `frontend/src/Layout.tsx` to consume those primitives so the shell changes visually while preserving navigation, permissions, search, notifications, and mobile drawer behavior.

**Tech Stack:** Preact, TypeScript, Vite, CSS custom properties, shared TS style objects, Vitest/Frontend core tests, browser UAT

---

## File Structure

- Modify: `frontend/src/index.css`
  - Runtime source of truth for light/dark CSS variables, typography defaults, focus ring, native control theme, reduced-motion behavior.
- Modify: `frontend/src/ui/tokens.ts`
  - Semantic token bridge from CSS variables to TSX style consumers.
- Modify: `frontend/src/ui/styles.ts`
  - Shared shell primitives for buttons, cards, inputs, badges, page shell, modal shell, and overlays.
- Modify: `frontend/src/Layout.tsx`
  - Shell application layer for desktop sidebar, mobile drawer, header, search, user area, and content frame.

## Implementation Notes

- Keep token names stable where possible; prefer remapping existing semantic names over broad renames.
- Do not change `Layout` behavior: search debounce/fetch, nav grouping logic, notification hooks, role preview controls, drawer open/close, and route callbacks stay intact.
- Do not redesign Products/Projects/Quotations internals in this slice.
- Because this is a UI-only slice, verification should follow the repo’s UI gate first: `frontend/npm run typecheck && npm run test:core && npm run build`, then browser/UAT on shell states.
- The repo guidance says reusable visual grammar changes should update `DESIGN.md` and `docs/runbooks/ui-theme-principles.md`. Include those doc updates in the execution task if the implementation introduces reusable shell/token conventions not already reflected there.

### Task 1: Align runtime CSS tokens in `index.css`

**Files:**
- Modify: `frontend/src/index.css:1-242`
- Reference: `tmp/htc-erp-design-system-extracted/htc-erp-design-system/project/colors_and_type.css`
- Reference: `docs/superpowers/specs/2026-04-19-app-shell-design-system-design.md`

- [ ] **Step 1: Write the failing verification target**

Document the required assertions before editing:

```text
Expect frontend/src/index.css to satisfy all of the following after the change:
- --font-family-sans resolves to Roboto-first with Inter fallback
- light tokens include #009B6E / #007A56 / #F8FAFC / #FFFFFF / #E2E8F0
- dark tokens include #0F172A / #1E293B / #334155
- body/button/input/select/textarea inherit the same font family
- focus-visible outline is 2px solid var(--ht-green) with 2px offset
- reduced-motion rule still disables transitions/animations
```

- [ ] **Step 2: Verify the current file is missing part of the target**

Run:

```bash
python - <<'PY'
from pathlib import Path
p = Path('D:/htc-erp/.worktrees/ui-ux/frontend/src/index.css')
text = p.read_text(encoding='utf-8')
checks = {
    'inter-fallback': "'Inter'" in text,
    'success-soft-surface': '--ht-surface-success-soft' in text,
    'overlay-vars': '--overlay-backdrop-gradient' in text,
    'base-label-style': 'label {' in text,
}
print(checks)
PY
```

Expected: at least one required design-system check is `False`, proving the file does not yet match the handoff source.

- [ ] **Step 3: Update the root and dark CSS variable sets**

Implement the minimal runtime token rewrite in `frontend/src/index.css` by replacing the top variable blocks with handoff-aligned values and aliases.

```css
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;800;900&display=swap');

:root {
  color-scheme: light;
  --ht-green: #009B6E;
  --ht-green-dark: #007A56;
  --ht-green-deep: #004d35;
  --ht-amber: #F5A623;
  --ht-amber-dark: #d98f1a;
  --ht-orange: #FF6600;

  --bg-primary: #F8FAFC;
  --bg-surface: #FFFFFF;
  --border-color: #E2E8F0;

  --text-primary: #1E293B;
  --text-secondary: #64748B;
  --text-muted: #94A3B8;
  --text-on-primary: #FFFFFF;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-interactive-lg: 0 16px 32px rgba(15, 23, 42, 0.08);
  --shadow-interactive-md: 0 10px 20px rgba(15, 23, 42, 0.08);
  --shadow-drop-target: inset 0 0 0 2px rgba(11, 163, 96, 0.3), 0 16px 32px rgba(11, 163, 96, 0.08);
  --auth-card-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  --ht-success-bg: #F0FDF4;
  --ht-success-text: #166534;
  --ht-success-border: #DCFCE7;
  --ht-success-tint: rgba(16, 185, 129, 0.08);
  --ht-surface-success-soft: #EEFBF4;

  --ht-error-bg: #FEF2F2;
  --ht-error-text: #991B1B;
  --ht-error-border: #FEE2E2;
  --error-surface-bg-soft: #fff8f7;
  --error-surface-border: #f3c7c2;

  --ht-warning-bg: #FFFBEB;
  --ht-warning-text: #92400E;
  --ht-warning-border: #FDE68A;
  --ht-warning-tint: rgba(245, 158, 11, 0.08);
  --ht-warning-strong: #B45309;
  --warning-surface-bg: #fff7ed;
  --warning-surface-bg-soft: #fffaf0;
  --warning-surface-border: #f4d39a;
  --warning-surface-text: #b45309;
  --warning-strong-bg: #fff3e0;

  --ht-info-bg: rgba(0, 155, 110, 0.08);
  --ht-info-text: #007A56;
  --info-accent-bg: #e0f2fe;
  --info-accent-text: #0369a1;

  --violet-accent-bg: #f3e8ff;
  --violet-accent-text: #7c3aed;
  --violet-strong-bg: #ede9fe;
  --violet-strong-text: #6d28d9;

  --ht-task-tab-bg: #EEF2FF;
  --ht-task-tab-text: #4338CA;
  --ht-task-blocked-bg: #FDECEA;
  --ht-task-blocked-text: #B42318;

  --ht-progress-track: #E7EBEF;
  --ht-progress-complete: #2563EB;

  --ht-surface-subtle: #EEF2F6;
  --surface-header-subtle: #F8FBFE;
  --surface-row-alt: #FCFDFE;
  --surface-neutral-soft: #F8FAFC;
  --surface-chip-bg: rgba(255, 255, 255, 0.7);
  --surface-empty-bg: linear-gradient(180deg, rgba(248, 250, 252, 0.9) 0%, rgba(255, 255, 255, 1) 100%);
  --surface-skeleton-bg: linear-gradient(90deg, rgba(241, 245, 249, 0.9) 25%, rgba(255, 255, 255, 0.92) 37%, rgba(241, 245, 249, 0.9) 63%);
  --surface-sticky-bg: rgba(255, 255, 255, 0.9);
  --surface-badge-bg: rgba(255, 255, 255, 0.72);
  --surface-badge-bg-strong: rgba(255, 255, 255, 0.76);
  --surface-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 24%);

  --panel-gradient-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%);
  --hero-card-bg: linear-gradient(135deg, rgba(0, 77, 53, 0.12) 0%, rgba(0, 151, 110, 0.05) 52%, rgba(255, 255, 255, 0.92) 100%);
  --hero-card-bg-subtle: linear-gradient(135deg, rgba(1, 87, 155, 0.08) 0%, rgba(255, 255, 255, 1) 100%);
  --drawer-header-bg: linear-gradient(180deg, rgba(0, 77, 53, 0.08) 0%, rgba(255, 255, 255, 0) 100%);
  --auth-shell-bg: linear-gradient(135deg, #004d35 0%, #009b6e 60%, #00c47a 100%);

  --overlay-backdrop-gradient: linear-gradient(180deg, rgba(8, 15, 30, 0.72) 0%, rgba(4, 10, 24, 0.82) 100%);
  --overlay-backdrop-blur: 16px;
  --overlay-soft-backdrop: rgba(15, 23, 42, 0.42);
  --overlay-drawer-shadow: -18px 0 40px rgba(15, 23, 42, 0.16);
  --overlay-modal-shadow: 0 24px 80px rgba(2, 6, 23, 0.45);

  --focus-ring-color: rgba(11, 163, 96, 0.18);

  --font-family-sans: 'Roboto', 'Inter', sans-serif;
  --font-size-xxs: 10px;
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-md: 13px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  --font-size-title: 20px;
  --font-size-display-sm: 24px;
  --font-size-display-md: 26px;
  --font-size-display-lg: 28px;
  --font-size-display-xl: 30px;
}

.dark {
  color-scheme: dark;
  --bg-primary: #0F172A;
  --bg-surface: #1E293B;
  --border-color: #334155;
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --ht-error-bg: rgba(220, 38, 38, 0.1);
  --ht-error-text: #FCA5A5;
  --ht-error-border: rgba(220, 38, 38, 0.2);
  --ht-success-bg: rgba(5, 150, 105, 0.1);
  --ht-success-text: #6EE7B7;
  --ht-success-border: rgba(5, 150, 105, 0.2);
  --ht-warning-bg: rgba(245, 158, 11, 0.1);
  --ht-warning-text: #FCD34D;
  --ht-warning-border: rgba(245, 158, 11, 0.2);
  --ht-warning-strong: #FBBF24;
  --ht-info-bg: rgba(0, 155, 110, 0.1);
  --ht-info-text: #6EE7B7;
  --ht-surface-subtle: rgba(148, 163, 184, 0.14);
  --surface-row-alt: rgba(15, 23, 42, 0.72);
  --ht-task-tab-bg: rgba(99, 102, 241, 0.18);
  --ht-task-tab-text: #C7D2FE;
  --ht-task-blocked-bg: rgba(180, 35, 24, 0.2);
  --ht-task-blocked-text: #FECACA;
  --ht-progress-complete: #60A5FA;
  --focus-ring-color: rgba(110, 231, 183, 0.22);
  --auth-shell-bg: linear-gradient(135deg, rgba(2, 6, 23, 0.98) 0%, rgba(6, 95, 70, 0.92) 48%, rgba(15, 23, 42, 0.98) 100%);
  --hero-card-bg: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 95, 70, 0.12) 52%, rgba(30, 41, 59, 0.98) 100%);
  --panel-gradient-bg: linear-gradient(180deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.96) 100%);
  --violet-accent-bg: rgba(167, 139, 250, 0.18);
  --violet-accent-text: #DDD6FE;
  --violet-strong-bg: rgba(139, 92, 246, 0.18);
  --violet-strong-text: #C4B5FD;
  --info-accent-bg: rgba(14, 165, 233, 0.16);
  --info-accent-text: #7DD3FC;
}
```

- [ ] **Step 4: Normalize base element styles in `index.css`**

Add the missing semantic aliases and base element styles.

```css
:root {
  --t-heading: var(--text-primary);
  --t-body: var(--text-primary);
  --t-secondary: var(--text-secondary);
  --t-muted: var(--text-muted);
  --t-label: var(--text-muted);
  --t-on-brand: var(--text-on-primary);
  --t-link: var(--ht-green);
  --t-danger: var(--ht-error-text);
  --t-success: var(--ht-success-text);
  --t-warning: var(--ht-warning-text);

  --s-page: var(--bg-primary);
  --s-card: var(--bg-surface);
  --s-input: var(--bg-primary);
  --s-brand: var(--ht-green);
  --s-brand-hover: var(--ht-green-dark);
}

*, *::before, *::after { box-sizing: border-box; }
html { background: var(--bg-primary); }

body {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  color: var(--text-primary);
  background: var(--bg-primary);
  margin: 0;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.3s ease, color 0.3s ease;
}

body,
button,
input,
select,
textarea {
  font-family: var(--font-family-sans);
}

input,
select,
textarea,
option {
  background-color: var(--bg-surface);
  color: var(--text-primary);
}

h1 {
  font-size: var(--font-size-display-lg);
  font-weight: 800;
  color: var(--t-heading);
  margin: 0;
  line-height: 1.2;
}

h2 {
  font-size: var(--font-size-title);
  font-weight: 800;
  color: var(--t-heading);
  margin: 0;
}

h3 {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--t-heading);
  margin: 0;
}

p {
  font-size: var(--font-size-base);
  color: var(--t-secondary);
  line-height: 1.6;
  margin: 0;
}

small {
  font-size: var(--font-size-sm);
  color: var(--t-muted);
}

label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--t-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

code {
  font-family: 'Roboto Mono', 'Courier New', monospace;
  font-size: var(--font-size-sm);
  background: var(--ht-surface-subtle);
  border-radius: var(--radius-sm);
  padding: 1px 5px;
  color: var(--ht-green);
}
```

- [ ] **Step 5: Run a narrow verification for `index.css`**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('D:/htc-erp/.worktrees/ui-ux/frontend/src/index.css').read_text(encoding='utf-8')
required = [
    "'Roboto', 'Inter', sans-serif",
    '--overlay-backdrop-gradient',
    '--t-heading: var(--text-primary);',
    'label {',
    'outline: 2px solid var(--ht-green);',
]
missing = [item for item in required if item not in text]
print({'missing': missing})
PY
```

Expected: `{'missing': []}`

- [ ] **Step 6: Commit the CSS token update**

```bash
git -C D:/htc-erp/.worktrees/ui-ux add frontend/src/index.css
git -C D:/htc-erp/.worktrees/ui-ux commit -m "feat: align app shell css tokens"
```

Expected: a new commit containing only `frontend/src/index.css`.

### Task 2: Expose handoff-aligned semantic tokens in `tokens.ts`

**Files:**
- Modify: `frontend/src/ui/tokens.ts:1-137`
- Reference: `frontend/src/index.css`

- [ ] **Step 1: Write the failing token contract**

Create the token checklist before editing:

```text
Expect tokens.ts to expose semantic access for:
- overlay CSS vars via var(--overlay-...)
- brand text/info aliases needed by shell primitives
- existing callers such as tokens.colors.surface, background, border, primary, textPrimary, textSecondary
- no direct replacement of shell behavior constants with raw hex values
```

- [ ] **Step 2: Verify the current token bridge is incomplete**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('D:/htc-erp/.worktrees/ui-ux/frontend/src/ui/tokens.ts').read_text(encoding='utf-8')
checks = {
    'overlay-css-vars': "var(--overlay-backdrop-gradient)" in text,
    'brand-hover-surface': 'brandHover' in text,
    'input-surface-token': 'inputSurface' in text,
}
print(checks)
PY
```

Expected: at least one check is `False`.

- [ ] **Step 3: Refine `tokens.ts` to map directly to the CSS variable system**

Update `frontend/src/ui/tokens.ts` so overlay tokens consume the CSS variables introduced in Task 1 and the shell gets semantic names for surface behavior.

```ts
export const tokens = {
  colors: {
    primary: 'var(--ht-green)',
    primaryDark: 'var(--ht-green-dark)',
    primaryDeep: 'var(--ht-green-deep)',
    warning: 'var(--ht-amber)',
    warningDark: 'var(--ht-amber-dark)',
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
    textOnPrimary: 'var(--text-on-primary)',
    surface: 'var(--bg-surface)',
    background: 'var(--bg-primary)',
    border: 'var(--border-color)',
    inputSurface: 'var(--s-input)',
    success: 'var(--ht-success-text)',
    error: 'var(--ht-error-text)',
    info: 'var(--ht-info-text)',
    infoText: 'var(--ht-info-text)',
    infoBg: 'var(--ht-info-bg)',
    badgeBgSuccess: 'var(--ht-success-bg)',
    badgeBgError: 'var(--ht-error-bg)',
    badgeBgInfo: 'var(--ht-info-bg)',
    warningText: 'var(--ht-warning-text)',
    warningBg: 'var(--ht-warning-bg)',
    warningBorder: 'var(--ht-warning-border)',
    warningTint: 'var(--ht-warning-tint)',
    warningStrong: 'var(--ht-warning-strong)',
    warningSurfaceBg: 'var(--warning-surface-bg)',
    warningSurfaceBgSoft: 'var(--warning-surface-bg-soft)',
    warningSurfaceBorder: 'var(--warning-surface-border)',
    warningSurfaceText: 'var(--warning-surface-text)',
    warningStrongBg: 'var(--warning-strong-bg)',
    infoAccentBg: 'var(--info-accent-bg)',
    infoAccentText: 'var(--info-accent-text)',
    successTint: 'var(--ht-success-tint)',
    errorBorder: 'var(--ht-error-border)',
    successBorder: 'var(--ht-success-border)',
    surfaceSubtle: 'var(--ht-surface-subtle)',
    surfaceSuccessSoft: 'var(--ht-surface-success-soft)',
    surfaceHeaderSubtle: 'var(--surface-header-subtle)',
    surfaceRowAlt: 'var(--surface-row-alt)',
    surfaceNeutralSoft: 'var(--surface-neutral-soft)',
    errorSurfaceSoft: 'var(--error-surface-bg-soft)',
    errorSurfaceBorder: 'var(--error-surface-border)',
    violetAccentBg: 'var(--violet-accent-bg)',
    violetAccentText: 'var(--violet-accent-text)',
    violetStrongBg: 'var(--violet-strong-bg)',
    violetStrongText: 'var(--violet-strong-text)',
    taskTabBg: 'var(--ht-task-tab-bg)',
    taskTabText: 'var(--ht-task-tab-text)',
    taskBlockedBg: 'var(--ht-task-blocked-bg)',
    taskBlockedText: 'var(--ht-task-blocked-text)',
    progressTrack: 'var(--ht-progress-track)',
    progressComplete: 'var(--ht-progress-complete)',
    white: '#FFFFFF',
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
  },
  shadow: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    auth: 'var(--auth-card-shadow)',
  },
  overlay: {
    backdropGradient: 'var(--overlay-backdrop-gradient)',
    backdropBlur: 'var(--overlay-backdrop-blur)',
    softBackdrop: 'var(--overlay-soft-backdrop)',
    drawerShadow: 'var(--overlay-drawer-shadow)',
    modalShadow: 'var(--overlay-modal-shadow)',
    toastBlur: '8px',
  },
  interaction: {
    focusRing: 'var(--focus-ring-color)',
    shadowLg: 'var(--shadow-interactive-lg)',
    shadowMd: 'var(--shadow-interactive-md)',
    dropShadow: 'var(--shadow-drop-target)',
  },
  surface: {
    panelGradient: 'var(--panel-gradient-bg)',
    heroGradient: 'var(--hero-card-bg)',
    heroGradientSubtle: 'var(--hero-card-bg-subtle)',
    authCanvas: 'var(--auth-shell-bg)',
    drawerHeader: 'var(--drawer-header-bg)',
    detail: 'var(--ht-surface-subtle)',
    sheen: 'var(--surface-sheen)',
    chip: 'var(--surface-chip-bg)',
    empty: 'var(--surface-empty-bg)',
    skeleton: 'var(--surface-skeleton-bg)',
    sticky: 'var(--surface-sticky-bg)',
    badge: 'var(--surface-badge-bg)',
    badgeStrong: 'var(--surface-badge-bg-strong)',
  },
```

- [ ] **Step 4: Run a narrow token verification**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('D:/htc-erp/.worktrees/ui-ux/frontend/src/ui/tokens.ts').read_text(encoding='utf-8')
required = [
    "primaryDeep: 'var(--ht-green-deep)'",
    "inputSurface: 'var(--s-input)'",
    "backdropGradient: 'var(--overlay-backdrop-gradient)'",
    "drawerShadow: 'var(--overlay-drawer-shadow)'",
    "modalShadow: 'var(--overlay-modal-shadow)'",
]
missing = [item for item in required if item not in text]
print({'missing': missing})
PY
```

Expected: `{'missing': []}`

- [ ] **Step 5: Commit the token bridge update**

```bash
git -C D:/htc-erp/.worktrees/ui-ux add frontend/src/ui/tokens.ts
git -C D:/htc-erp/.worktrees/ui-ux commit -m "feat: expose shell design semantic tokens"
```

Expected: a new commit containing only `frontend/src/ui/tokens.ts`.

### Task 3: Realign shared shell primitives in `styles.ts`

**Files:**
- Modify: `frontend/src/ui/styles.ts:1-260`
- Reference: `frontend/src/ui/tokens.ts`
- Reference: `frontend/src/index.css`

- [ ] **Step 1: Write the failing primitive target**

Define the shared primitive expectations:

```text
Expect styles.ts shared primitives to reflect the handoff:
- primary/outline/ghost buttons use restrained motion and tokenized colors
- cards use flat or nearly flat surfaces with 1px borders and light shadow
- inputs use shell-consistent surface/background/border tokens
- badges use semantic tinted backgrounds instead of white placeholders
- page shell primitives preserve 1400px max width and operational spacing
- modal/overlay shells use tokenized surface and overlay values
```

- [ ] **Step 2: Verify current primitives still diverge from the target**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('D:/htc-erp/.worktrees/ui-ux/frontend/src/ui/styles.ts').read_text(encoding='utf-8')
checks = {
    'outline-bg-uses-surface': "background: tokens.colors.surface" in text,
    'info-badge-uses-info-bg': "background: tokens.colors.infoBg" in text,
    'input-uses-input-surface': 'tokens.colors.inputSurface' in text,
    'modal-uses-modal-shadow': 'tokens.overlay.modalShadow' in text,
}
print(checks)
PY
```

Expected: at least one check is `False`.

- [ ] **Step 3: Update button, card, input, badge, modal, and overlay primitives**

Edit `frontend/src/ui/styles.ts` with the minimal style adjustments below.

```ts
export const ui = {
  btn: {
    primary: {
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      fontSize: tokens.fontSize.base,
      fontWeight: 700,
      cursor: 'pointer',
      border: '1px solid transparent',
      color: tokens.colors.textOnPrimary,
      background: tokens.colors.primary,
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
    },
    outline: {
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      fontSize: tokens.fontSize.base,
      fontWeight: 600,
      cursor: 'pointer',
      border: `1px solid ${tokens.colors.border}`,
      color: tokens.colors.textSecondary,
      background: tokens.colors.surface,
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
    },
    ghost: {
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      fontSize: tokens.fontSize.base,
      fontWeight: 600,
      cursor: 'pointer',
      border: '1px solid transparent',
      color: tokens.colors.primary,
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing.sm,
      transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
    },
  },
  card: {
    base: {
      backgroundColor: tokens.colors.surface,
      borderRadius: tokens.radius.lg,
      boxShadow: tokens.shadow.sm,
      border: `1px solid ${tokens.colors.border}`,
      color: tokens.colors.textPrimary,
    },
    kpi: {
      background: tokens.colors.surface,
      padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      border: `1px solid ${tokens.colors.border}`,
      boxShadow: tokens.shadow.sm,
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacing.xs,
      flex: 1,
    },
  },
  input: {
    base: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      border: `1px solid ${tokens.colors.border}`,
      fontSize: tokens.fontSize.base,
      background: tokens.colors.inputSurface,
      color: tokens.colors.textPrimary,
    },
  },
  badge: {
    success: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgSuccess,
      color: tokens.colors.success,
      fontSize: tokens.fontSize.xs,
      fontWeight: 800,
    },
    warning: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.warningBg,
      color: tokens.colors.warningText,
      fontSize: tokens.fontSize.xs,
      fontWeight: 800,
    },
    info: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.infoBg,
      color: tokens.colors.infoText,
      fontSize: tokens.fontSize.xs,
      fontWeight: 800,
    },
    error: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgError,
      color: tokens.colors.error,
      fontSize: tokens.fontSize.xs,
      fontWeight: 800,
    },
    neutral: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.surfaceSubtle,
      color: tokens.colors.textMuted,
      fontSize: tokens.fontSize.xs,
      fontWeight: 800,
    },
  },
  modal: {
    shell: {
      background: tokens.colors.surface,
      borderRadius: tokens.radius.xl,
      boxShadow: tokens.overlay.modalShadow,
      border: `1px solid ${tokens.colors.border}`,
      overflow: 'hidden',
    },
  },
  overlay: {
    backdrop: {
      background: tokens.overlay.backdropGradient,
      backdropFilter: `blur(${tokens.overlay.backdropBlur})`,
      WebkitBackdropFilter: `blur(${tokens.overlay.backdropBlur})`,
    },
    drawer: {
      background: tokens.colors.surface,
      borderLeft: `1px solid ${tokens.colors.border}`,
      boxShadow: tokens.overlay.drawerShadow,
    },
```

- [ ] **Step 4: Run a narrow primitive verification**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('D:/htc-erp/.worktrees/ui-ux/frontend/src/ui/styles.ts').read_text(encoding='utf-8')
required = [
    "border: '1px solid transparent'",
    'background: tokens.colors.inputSurface',
    'background: tokens.colors.infoBg',
    'background: tokens.colors.warningBg',
    'boxShadow: tokens.overlay.modalShadow',
]
missing = [item for item in required if item not in text]
print({'missing': missing})
PY
```

Expected: `{'missing': []}`

- [ ] **Step 5: Commit the shared primitive update**

```bash
git -C D:/htc-erp/.worktrees/ui-ux add frontend/src/ui/styles.ts
git -C D:/htc-erp/.worktrees/ui-ux commit -m "feat: refresh shared shell ui primitives"
```

Expected: a new commit containing only `frontend/src/ui/styles.ts`.

### Task 4: Restyle `Layout.tsx` without changing shell behavior

**Files:**
- Modify: `frontend/src/Layout.tsx:1-904`
- Reference: `frontend/src/ui/tokens.ts`
- Reference: `frontend/src/ui/styles.ts`
- Verify in browser: desktop/mobile light/dark shell states

- [ ] **Step 1: Write the failing shell target**

Define what the shell must look like after the change:

```text
Expect Layout.tsx to keep all current shell behavior while visually matching the approved shell direction:
- desktop sidebar remains 240px with grouped sections and stronger uppercase hierarchy
- active nav item remains green-accented with right-edge indicator
- hover state is subtle and success-tinted
- desktop header remains ~64px high with flat surface and compact controls
- mobile drawer preserves open/close logic, focus lock, and simple slide motion
- content area keeps stable padding and 1400px-centered shell composition where applicable
```

- [ ] **Step 2: Verify current shell still needs the visual update**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('D:/htc-erp/.worktrees/ui-ux/frontend/src/Layout.tsx').read_text(encoding='utf-8')
checks = {
    'uses-drawer-header-gradient': 'tokens.surface.drawerHeader' in text,
    'uses-page-shell-primitive': 'ui.page.shell' in text,
    'nav-hover-handler': 'onMouseEnter' in text,
    'header-compact-shadowless-controls': 'boxShadow: tokens.shadow.md' in text,
}
print(checks)
PY
```

Expected: at least one of the desired shell checks is missing or still reflects the old visual shape.

- [ ] **Step 3: Introduce small shell style constants near the top of `Layout.tsx`**

Add focused constants after the helper functions and before `export const Layout = (`.

```ts
const SHELL_SIDEBAR_WIDTH = '240px';
const SHELL_HEADER_HEIGHT = '64px';
const SHELL_SEARCH_WIDTH = '320px';
const NAV_SECTION_LABEL_STYLE = {
  fontSize: tokens.fontSize.xxs,
  fontWeight: 800,
  color: tokens.colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
} as const;
const NAV_CATEGORY_LABEL_STYLE = {
  fontSize: tokens.fontSize.xs,
  fontWeight: 800,
  color: tokens.colors.textPrimary,
  letterSpacing: '0.01em',
} as const;
```

- [ ] **Step 4: Restyle the nav group labels and items only, preserving handlers**

Update the nav render block to use the new shell constants and add subtle hover feedback without changing click behavior.

```ts
<div
  style={{
    padding: '8px 16px 4px',
    ...NAV_SECTION_LABEL_STYLE,
  }}
>
  {sectionLabel}
</div>
```

```ts
<button
  type="button"
  key={item.label}
  data-testid={navItemTestId(item.label)}
  onClick={() => {
    onItemClick?.();
    onNavigate?.(item.label);
  }}
  onMouseEnter={(e: any) => {
    if (isActive) return;
    e.currentTarget.style.backgroundColor = tokens.colors.badgeBgSuccess;
    e.currentTarget.style.color = tokens.colors.primary;
    const icon = e.currentTarget.querySelector('[data-shell-nav-icon="true"]');
    if (icon) icon.style.color = tokens.colors.primary;
  }}
  onMouseLeave={(e: any) => {
    if (isActive) return;
    e.currentTarget.style.backgroundColor = 'transparent';
    e.currentTarget.style.color = tokens.colors.textSecondary;
    const icon = e.currentTarget.querySelector('[data-shell-nav-icon="true"]');
    if (icon) icon.style.color = tokens.colors.textMuted;
  }}
  style={{
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 16px',
    borderRadius: tokens.radius.lg,
    marginBottom: '4px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: isActive ? 600 : 500,
    color: isActive ? tokens.colors.primary : tokens.colors.textSecondary,
    backgroundColor: isActive ? tokens.colors.badgeBgSuccess : 'transparent',
    transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
    borderRight: isActive ? `3px solid ${tokens.colors.primary}` : '3px solid transparent',
    borderTop: 'none',
    borderLeft: 'none',
    borderBottom: 'none',
    textAlign: 'left',
  }}
>
  <span style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
    <span
      data-shell-nav-icon="true"
      style={{
        width: '18px',
        height: '18px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isActive ? tokens.colors.primary : tokens.colors.textMuted,
        flexShrink: 0,
        transition: 'color 0.2s ease',
      }}
    >
      <Icon size={18} strokeWidth={1.85} />
    </span>
```

- [ ] **Step 5: Restyle sidebar, mobile drawer, header, and content frame containers**

Use the shared primitives and shell constants to update the main container blocks.

```ts
<aside
  style={{
    width: SHELL_SIDEBAR_WIDTH,
    background: tokens.colors.surface,
    display: isMobile ? 'none' : 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    borderRight: `1px solid ${tokens.colors.border}`,
    zIndex: tokens.zIndex.sticky,
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
  }}
>
```

```ts
<div
  style={{
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: `1px solid ${tokens.colors.border}`,
    background: tokens.surface.drawerHeader,
  }}
>
```

```ts
<header
  style={{
    height: isMobile ? 'auto' : SHELL_HEADER_HEIGHT,
    background: tokens.colors.surface,
    display: 'flex',
    alignItems: isMobile ? 'stretch' : 'center',
    justifyContent: 'space-between',
    padding: isMobile ? `${tokens.spacing.md} ${tokens.spacing.lg}` : `0 ${tokens.spacing.xxl}`,
    flexShrink: 0,
    borderBottom: `1px solid ${tokens.colors.border}`,
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
    flexDirection: isMobile ? 'column' : 'row',
    gap: isMobile ? tokens.spacing.md : '0',
  }}
>
```

```ts
<div
  ref={contentScrollRef}
  data-testid={contentTestId || QA_TEST_IDS.appContent}
  style={{
    flex: 1,
    minWidth: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: isMobile ? tokens.spacing.md : tokens.spacing.lg,
    background: tokens.colors.background,
  }}
>
  <div style={ui.page.shell}>
    {children}
  </div>
</div>
```

- [ ] **Step 6: Keep compact shell controls aligned to the new primitives**

Update the header buttons and search input width to use the shell constants and shared styles.

```ts
<input
  id="global-search"
  name="globalSearch"
  type="text"
  value={searchQuery}
  onInput={(e: any) => setSearchQuery(e.target.value)}
  placeholder={t('nav.search.placeholder')}
  aria-label={t('nav.search.placeholder')}
  data-testid={QA_TEST_IDS.layout.searchInput}
  style={{
    ...ui.input.base,
    width: isMobile ? '100%' : SHELL_SEARCH_WIDTH,
    padding: '10px 16px 10px 40px',
    fontSize: '14px',
  }}
/>
```

```ts
<button
  type="button"
  onClick={toggleDarkMode}
  aria-label={isDarkMode ? t('nav.theme.light') : t('nav.theme.dark')}
  style={{
    background: tokens.colors.background,
    border: `1px solid ${tokens.colors.border}`,
    borderRadius: tokens.radius.md,
    width: '36px',
    height: '36px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}
>
```

- [ ] **Step 7: Run the frontend verification gate for the shell slice**

Run:

```bash
cd D:/htc-erp/.worktrees/ui-ux/frontend && npm run typecheck && npm run test:core && npm run build
```

Expected: all three commands pass.

- [ ] **Step 8: Run browser/UAT verification for the required shell states**

Run the QA dev server:

```bash
cd D:/htc-erp/.worktrees/ui-ux/frontend && npm run dev:qa
```

Then verify in a browser:

```text
1. Desktop light mode: check sidebar width, grouped labels, active/hover state, header height, search usability.
2. Desktop dark mode: toggle theme and confirm surfaces/borders/text hierarchy stay aligned.
3. Mobile light mode: open drawer, close drawer, confirm body scroll lock and drawer slide.
4. Mobile dark mode: repeat drawer and header checks after dark-mode toggle.
5. Open one representative feature screen inside the shell (for example Equipment and Projects) and confirm no obvious shell-spacing regression.
```

Expected: all four shell states are visually correct and core header/drawer/search behavior still works.

- [ ] **Step 9: Record UAT evidence in the implementation notes**

Capture a short verification record like this in your task notes, PR notes, or handoff summary:

```text
UAT evidence:
- Desktop light: PASS
- Desktop dark: PASS
- Mobile light drawer open/close + scroll lock: PASS
- Mobile dark drawer open/close + scroll lock: PASS
- Representative screen regression spot-check (Equipment, Projects): PASS
```

- [ ] **Step 10: Commit the shell restyle**

```bash
git -C D:/htc-erp/.worktrees/ui-ux add frontend/src/Layout.tsx
git -C D:/htc-erp/.worktrees/ui-ux commit -m "feat: restyle app shell layout"
```

Expected: a new commit containing only `frontend/src/Layout.tsx`.

### Task 5: Update shell design references if reusable UI grammar changed

**Files:**
- Modify: `DESIGN.md`
- Modify: `docs/runbooks/ui-theme-principles.md`
- Reference: implemented token/shell changes from Tasks 1-4

- [ ] **Step 1: Check whether the implementation introduced reusable shell/token guidance not already documented**

Review the final diffs in:

```text
frontend/src/index.css
frontend/src/ui/tokens.ts
frontend/src/ui/styles.ts
frontend/src/Layout.tsx
```

Expected: decide whether any reusable shell/token rule is new enough to require doc updates.

- [ ] **Step 2: If docs need updating, add only the new reusable guidance**

Add concise guidance such as:

```md
- App-shell layout uses token-first styling: `index.css` defines shell variables, `ui/tokens.ts` exposes semantic aliases, `ui/styles.ts` defines reusable shell primitives, and `Layout.tsx` consumes them without feature-local color overrides.
- Sidebar and header shell changes must preserve route/search/notification behavior and update presentation only.
```

- [ ] **Step 3: Verify the docs stay aligned with the implementation**

Run:

```bash
python - <<'PY'
from pathlib import Path
files = [
    Path('D:/htc-erp/.worktrees/ui-ux/DESIGN.md'),
    Path('D:/htc-erp/.worktrees/ui-ux/docs/runbooks/ui-theme-principles.md'),
]
for file in files:
    print(file.name, file.exists(), file.stat().st_size if file.exists() else 0)
PY
```

Expected: both files exist and remain readable after the edit.

- [ ] **Step 4: Commit the doc alignment if changed**

```bash
git -C D:/htc-erp/.worktrees/ui-ux add DESIGN.md docs/runbooks/ui-theme-principles.md
git -C D:/htc-erp/.worktrees/ui-ux commit -m "docs: align shell design guidance"
```

Expected: a docs-only commit, and skip this step entirely if no doc changes were necessary.

## Final Verification

- [ ] **Step 1: Review the full bounded diff**

Run:

```bash
git -C D:/htc-erp/.worktrees/ui-ux diff -- frontend/src/index.css frontend/src/ui/tokens.ts frontend/src/ui/styles.ts frontend/src/Layout.tsx DESIGN.md docs/runbooks/ui-theme-principles.md
```

Expected: the diff stays within the approved shell/design-system slice.

- [ ] **Step 2: Run the final frontend delivery gate**

Run:

```bash
cd D:/htc-erp/.worktrees/ui-ux/frontend && npm run typecheck && npm run test:core && npm run build
```

Expected: all commands pass after the full slice is in place.

- [ ] **Step 3: Run mandatory code reviews**

Dispatch at minimum:

```text
1. tdd-guide or test-engineer review of whether regression coverage is adequate for this UI-only slice
2. code-reviewer review of the final implementation
3. typescript-reviewer review of the final TS/CSS integration layer
```

Expected: no open CRITICAL or HIGH issues remain.

- [ ] **Step 4: Summarize verification evidence for handoff/PR**

Use this exact structure:

```md
## Verification
- `npm run typecheck`
- `npm run test:core`
- `npm run build`
- Browser UAT: desktop light/dark, mobile light/dark, representative feature regression spot-check

## Risks checked
- No route logic changes
- No permission/search/notification behavior changes
- No feature-internal redesign beyond shell inheritance
```

Expected: handoff evidence clearly matches the approved spec.

## Spec Coverage Check

- Foundation layer covered by Task 1 (`index.css`), Task 2 (`tokens.ts`), and Task 3 (`styles.ts`).
- Shell layer covered by Task 4 (`Layout.tsx`).
- Required verification and UAT states covered by Task 4 and Final Verification.
- Reusable visual grammar documentation check covered by Task 5 to satisfy repo-specific doc rules.
- No spec gaps remain for the bounded slice.
