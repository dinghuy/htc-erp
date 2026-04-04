# Shell Navigation Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the workspace shell so the sidebar/drawer is the only primary navigation surface while preserving permissions, route behavior, and utility actions.

**Architecture:** Keep route and permission logic inside `Layout.tsx`, but remove duplicated top-tab navigation and render one grouped navigation taxonomy shared by desktop sidebar and mobile drawer. Add a narrow test seam for shell grouping expectations so shell IA can be verified without browser-only checks.

**Tech Stack:** Preact, TypeScript, Vitest

---

### Task 1: Add shell navigation contract tests

**Files:**
- Create: `frontend/src/layoutNavigation.test.ts`
- Modify: `frontend/src/Layout.tsx`
- Test: `frontend/src/layoutNavigation.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests that assert:

- desktop shell no longer depends on header tab navigation metadata
- grouped shell taxonomy contains `Workspace`, `Master data`, `Admin`
- mobile and desktop can reuse the same grouped source

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./scripts/run-vitest-sandbox.mjs src/layoutNavigation.test.ts`
Expected: FAIL because the grouped taxonomy helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Extract or add small helper exports in `Layout.tsx` for the grouped shell structure and labels needed by the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `node ./scripts/run-vitest-sandbox.mjs src/layoutNavigation.test.ts`
Expected: PASS

### Task 2: Refactor shell navigation rendering

**Files:**
- Modify: `frontend/src/Layout.tsx`
- Test: `frontend/src/layoutNavigation.test.ts`

- [ ] **Step 1: Extend the failing test surface if needed**

If the first test file does not yet capture the absence of top tabs or the mobile tab-pill duplication, add one more assertion before implementation.

- [ ] **Step 2: Run tests to verify failure**

Run: `node ./scripts/run-vitest-sandbox.mjs src/layoutNavigation.test.ts`
Expected: FAIL on the new shell expectation.

- [ ] **Step 3: Write minimal implementation**

Implement:

- grouped sidebar navigation with top-level labels
- desktop header without top nav tabs
- mobile drawer without tab pills
- unchanged search, preview banner, notifications, chat, profile, CTA, logout

- [ ] **Step 4: Run tests to verify pass**

Run: `node ./scripts/run-vitest-sandbox.mjs src/layoutNavigation.test.ts`
Expected: PASS

### Task 3: Verify shell behavior still compiles cleanly

**Files:**
- Modify: `frontend/src/Layout.tsx` if fixes are needed
- Test: existing frontend checks

- [ ] **Step 1: Run targeted type-aware verification**

Run: `node ./scripts/run-vitest-sandbox.mjs src/layoutNavigation.test.ts src/authRolePreview.test.ts src/navContext.test.ts`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS
