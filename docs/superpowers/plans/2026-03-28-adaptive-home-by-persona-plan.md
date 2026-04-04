# Adaptive Home By Persona Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Home` render KPI-first for executive personas and action-first for operator personas without changing the backend payload.

**Architecture:** Extract a home view-model layer that maps persona mode to a template family and normalized sections, then split rendering into `HomeExecutiveView` and `HomeOperatorView`. Keep data fetch and navigation wiring in `Home.tsx`, but move presentation branching out of the monolithic file.

**Tech Stack:** Preact, TypeScript, Vitest

---

### Task 1: Add home template mapping tests

**Files:**
- Create: `frontend/src/home/homeViewModel.test.ts`
- Create: `frontend/src/home/homeViewModel.ts`
- Modify: `frontend/src/Home.tsx`

- [ ] **Step 1: Write the failing test**

Add tests for:
- `director` and `admin` map to `executive`
- `accounting` and `legal` map to `executive-lite`
- `sales`, `project_manager`, `procurement`, `viewer` map to `operator`
- executive templates prioritize metrics before actions
- operator templates prioritize actions before metrics

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./scripts/run-vitest-sandbox.mjs src/home/homeViewModel.test.ts`
Expected: FAIL because `homeViewModel.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create the minimal home view-model helpers to satisfy the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `node ./scripts/run-vitest-sandbox.mjs src/home/homeViewModel.test.ts`
Expected: PASS

### Task 2: Split Home rendering into template views

**Files:**
- Create: `frontend/src/home/HomeExecutiveView.tsx`
- Create: `frontend/src/home/HomeOperatorView.tsx`
- Modify: `frontend/src/Home.tsx`
- Modify: `frontend/src/home/homeViewModel.ts`

- [ ] **Step 1: Extend failing test if needed**

Add one more test for the normalized section order if the first file does not cover it tightly enough.

- [ ] **Step 2: Run tests to verify failure**

Run: `node ./scripts/run-vitest-sandbox.mjs src/home/homeViewModel.test.ts`
Expected: FAIL on the new expectation.

- [ ] **Step 3: Write minimal implementation**

Implement:
- normalized view data in `homeViewModel.ts`
- `HomeExecutiveView` for KPI-first layout
- `HomeOperatorView` for action-first layout
- thinner `Home.tsx` that selects a template and passes the shared data

- [ ] **Step 4: Run targeted tests**

Run: `node ./scripts/run-vitest-sandbox.mjs src/home/homeViewModel.test.ts src/home/homeNavigation.test.ts`
Expected: PASS

### Task 3: Verify integration and build

**Files:**
- Modify: `frontend/src/Home.tsx` and home view files if fixes are needed

- [ ] **Step 1: Run targeted regression suite**

Run: `node ./scripts/run-vitest-sandbox.mjs src/home/homeViewModel.test.ts src/home/homeNavigation.test.ts src/layoutNavigation.test.ts src/authRolePreview.test.ts src/navContext.test.ts`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -b`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS
