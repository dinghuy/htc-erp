# Quotation PDF + Preview Pixel-Perfect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the in-app quotation preview and generated PDF match the provided reference images pixel-perfect using the supplied L&D logo and Times New Roman font.

**Architecture:** Keep a single source of layout truth by mirroring the PDF layout in the preview. The PDF generator remains the authoritative pixel layout; the preview uses identical measurements, column widths, and typography to match. Assets (logo + font) are loaded from absolute paths provided by the user.

**Tech Stack:** Preact (frontend preview), pdf-lib + fontkit (backend PDF), TypeScript.

---

## File Structure (Touch Points)
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\pdf-generator.ts`
  - Purpose: Implement pixel-perfect PDF layout (header, title, info grid, table, terms) with Times New Roman and logo.
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\server.ts`
  - Purpose: Ensure PDF data mapping and header text match the reference (if needed).
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx`
  - Purpose: Update preview to visually match the reference images pixel-perfect.
- Create (if needed): `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\quotation-preview.css`
  - Purpose: Isolate preview styling for precise typography, spacing, and table grid lines.

## Task 1: Capture Reference Measurements

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\pdf-generator.ts`

- [ ] **Step 1: Write the failing test**

We don’t have a test runner set up for layout. Add a minimal snapshot “layout spec check” function that throws if key column widths or margins drift from expected values. It won’t be a visual test but will guard critical constants.

```ts
// pseudo-test (will be integrated as a simple runtime assert in pdf-generator.ts)
const SPEC = { leftMargin: 40, rightMargin: 40, tableCols: [26, 60, 190, 36, 36, 90, 90, 70] };
if (SPEC.tableCols.reduce((a,b)=>a+b,0) !== 508) throw new Error('Table width mismatch');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node -e "require('./dist/pdf-generator')"` (or equivalent if compiled)
Expected: FAIL because the constants are not yet enforced.

- [ ] **Step 3: Write minimal implementation**

Add explicit constants in `pdf-generator.ts` for page margins, header line, title spacing, and table column widths that match the reference images. Use those constants for all draw operations.

- [ ] **Step 4: Run test to verify it passes**

Run: same command as Step 2
Expected: PASS (no error thrown).

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\pdf-generator.ts
# git commit -m "chore: lock pdf layout constants"
```

## Task 2: Embed Times New Roman + L&D Logo in PDF

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\pdf-generator.ts`

- [ ] **Step 1: Write the failing test**

Add a runtime assertion that the font file and logo file exist at the provided absolute paths.

```ts
if (!fs.existsSync('C:/Users/dinghuy/OneDrive - HUYNH THY GROUP/Antigravity Workspace/Times New Roman.ttf')) throw new Error('Font missing');
if (!fs.existsSync('C:/Users/dinghuy/OneDrive - HUYNH THY GROUP/Antigravity Workspace/LDA-logo.png')) throw new Error('Logo missing');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node -e "console.log('check')"` (manual run to trigger assertion)
Expected: FAIL if paths not wired in yet.

- [ ] **Step 3: Write minimal implementation**

Embed Times New Roman (regular + bold if available) using pdf-lib fontkit. If only one file exists, simulate bold with size/weight. Load and scale the LDA logo at the exact size/position from the reference.

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS with assets loaded.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\pdf-generator.ts
# git commit -m "feat: embed Times New Roman and LDA logo in PDF"
```

## Task 3: Rebuild PDF Layout (Header, Title, Info Grid)

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\pdf-generator.ts`

- [ ] **Step 1: Write the failing test**

Add a layout assertion for header line Y position and title Y position based on constants.

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL until layout values are used.

- [ ] **Step 3: Write minimal implementation**

Use Times New Roman for all header, title, and grid text. Match font sizes and spacing from the reference. Ensure the header block text exactly matches the provided image.

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\pdf-generator.ts
# git commit -m "feat: match header/title/info grid layout"
```

## Task 4: Rebuild PDF Table Layout (Column Widths + Borders)

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\pdf-generator.ts`

- [ ] **Step 1: Write the failing test**

Add a guard that header row background is blue and that table grid line thickness matches spec constants.

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL until style constants applied.

- [ ] **Step 3: Write minimal implementation**

Implement exact column widths, header fill color, grid line thickness. Ensure commodity column wraps multiline text and row height expands. Support sub-numbering (2.1, 2.2) by allowing item `no` to be string if needed.

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\pdf-generator.ts
# git commit -m "feat: match items table layout"
```

## Task 5: Remarks, Terms, Closing, Signatures

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\pdf-generator.ts`

- [ ] **Step 1: Write the failing test**

Add a guard that the terms section draws two columns and uses bold labels for headers.

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL until section implemented.

- [ ] **Step 3: Write minimal implementation**

Render Remark, Terms & Conditions / Điều khoản in two columns with numbered items. Add closing line and signature blocks aligned as per reference.

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\pdf-generator.ts
# git commit -m "feat: match remarks/terms/footer layout"
```

## Task 6: Update Preview Layout to Match PDF

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx`
- Create (optional): `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\quotation-preview.css`

- [ ] **Step 1: Write the failing test**

If no frontend test harness exists, add a manual “layout checklist” comment block and a runtime console warning when the preview container width deviates from A4 ratio. This serves as a guardrail.

- [ ] **Step 2: Run test to verify it fails**

Expected: console warning appears before changes.

- [ ] **Step 3: Write minimal implementation**

Rebuild the preview JSX/CSS to match the PDF layout (Times New Roman, table grid, header, columns). Use the same column widths, line heights, and spacing.

- [ ] **Step 4: Run test to verify it passes**

Expected: no warning; visual match to reference.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx
# git commit -m "feat: pixel-perfect preview layout"
```

## Task 7: End-to-End Verification

**Files:**
- No code changes.

- [ ] **Step 1: Generate a sample PDF**

Run backend locally and hit `/api/quotations/:id/pdf`. Save output.

- [ ] **Step 2: Visual compare**

Compare the output PDF to the provided images. Adjust spacing constants if needed.

- [ ] **Step 3: Verify preview parity**

Open preview and ensure all layout elements align with PDF.

- [ ] **Step 4: Commit final tweaks**

```bash
git add -A
# git commit -m "chore: final pixel adjustments"
```
