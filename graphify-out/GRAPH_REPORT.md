# Graph Report - .  (2026-04-07)

## Corpus Check
- Large corpus: 457 files  ~322,381 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1743 nodes · 2801 edges · 102 communities detected
- Extraction: 73% EXTRACTED · 27% INFERRED · 0% AMBIGUOUS · INFERRED: 744 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `Canonical Domain Model` - 22 edges
2. `denyWorkspaceAction()` - 19 edges
3. `importTaskRow()` - 15 edges
4. `HTC ERP Docs/Plan Index` - 14 edges
5. `loadWorkspace()` - 13 edges
6. `classifyTaskRisk()` - 12 edges
7. `buildQuotationDetail()` - 11 edges
8. `slugify()` - 11 edges
9. `HTC ERP Database Doctrine` - 10 edges
10. `num()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `resolveReleasedSalesOrderStatus()` --calls--> `normalizeValue()`  [INFERRED]
  backend\src\shared\workflow\revenueFlow.ts → frontend\src\shared\domain\revenueFlow.ts
- `Thin route handlers and module-owned workflow logic` --conceptually_related_to--> `Thin controllers with business logic in services`  [INFERRED]
  docs/adr/ADR-0005-module-boundary-rules.md → backend/AGENTS.md
- `normalizeGender()` --calls--> `normalizeKey()`  [INFERRED]
  frontend\src\gender.ts → backend\gender.ts
- `canStartLogisticsExecution()` --calls--> `normalizeValue()`  [INFERRED]
  backend\src\shared\workflow\revenueFlow.ts → frontend\src\shared\domain\revenueFlow.ts
- `resolveHandoffActivation()` --calls--> `normalizeValue()`  [INFERRED]
  backend\src\shared\workflow\revenueFlow.ts → frontend\src\shared\domain\revenueFlow.ts

## Hyperedges (group relationships)
- **Active governance docs** — docs_index_entrypoint, adr_0001_modular_monolith, adr_0002_backend_contract_ownership, adr_0003_erp_outbox_state_model, adr_0004_sqlite_postgres_path, adr_0005_module_boundary_rules, api_catalog, erp_outbox_contract, ai_task_template [INFERRED 0.90]

## Communities

### Community 0 - "Quotations / Suppliers"
Cohesion: 0.02
Nodes (44): normalizeValue(), renderActivityIcon(), interpolate(), translate(), normalizeImportReport(), normalizeProductImportPreview(), normalizeProductImportReport(), toNumber() (+36 more)

### Community 1 - "readService / writeRoutes"
Cohesion: 0.02
Nodes (37): handleLogin(), handleLogout(), handleNavigate(), handleRolePreviewChange(), persistAndSetUser(), normalizeJsonForComparison(), parseAssetArray(), splitLegacyMediaAssets() (+29 more)

### Community 2 - "navContext / testIds"
Cohesion: 0.03
Nodes (41): buildApprovalQueueCards(), mapApprovalQueuePayload(), decide(), load(), openApprovalThread(), sendApprovalThreadMessage(), applyRolePreviewToUser(), isRolePreviewPresetActive() (+33 more)

### Community 3 - "Products / videoUpload"
Cohesion: 0.03
Nodes (45): integrateUploadedAsset(), integrateUploadedImageAsset(), markPrimaryImage(), normalizePrimaryImageAssets(), replaceAssetById(), compressImageForUpload(), detectTransparentPixels(), loadImageElement() (+37 more)

### Community 4 - "buildQuotationDetail() / num()"
Cohesion: 0.04
Nodes (40): buildPassthroughImageUpload(), hasTransparentPixels(), optimizeUploadedImage(), replaceFileExtension(), ah(), appendUploadedAssetToProduct(), buildQuotationDetail(), buildQuotationPayload() (+32 more)

### Community 5 - "revenueFlow / workspaceRoutes"
Cohesion: 0.04
Nodes (32): buildApiError(), HttpApiError, sendApiError(), ensureDeliveryCompletionReady(), finalizeDeliveryCompletion(), getJwtSecret(), requireAuth(), canUserApproveRequest() (+24 more)

### Community 6 - "Canonical Domain Model / HTC ERP Database Doctrine"
Cohesion: 0.04
Nodes (72): Account, App-Layer RBAC, End-to-End Approval Gate State Machine, Approval Queue Item, Approval Request, Architecture Overview, Audit Fields, Backup And Rollback (+64 more)

### Community 7 - "Projects / OperationsOverview"
Cohesion: 0.04
Nodes (23): apiGet(), isDueSoon(), isTaskOverdue(), load(), normalizePriority(), normalizeStatus(), priorityScore(), toDateOnly() (+15 more)

### Community 8 - "ProjectWorkspaceHub / denyWorkspaceAction()"
Cohesion: 0.06
Nodes (36): createApprovalRequest(), createCommercialApproval(), createSalesOrder(), denyWorkspaceAction(), ensureArray(), finalizeDeliveryCompletion(), goToRoute(), isPastDate() (+28 more)

### Community 9 - "Home / roleReportCockpit"
Cohesion: 0.05
Nodes (31): buildRoleProfile(), canAccessModule(), canAccessSettings(), canApproveRequest(), canDelete(), canEdit(), canManageUsers(), canPerformAction() (+23 more)

### Community 10 - "sqlite db / import workmanagement"
Cohesion: 0.06
Nodes (23): main(), runDelete(), buildSourceMarker(), detectModeFromHeaders(), findAccountId(), findLeadId(), findProjectId(), findQuotationId() (+15 more)

### Community 11 - "erp sync / outboxContract"
Cohesion: 0.05
Nodes (22): computeDedupeKey(), computeNextRunAt(), enqueueErpEvent(), handleErpEventInternal(), isRecord(), runErpOutboxOnce(), sendEventToErpHttp(), sha256Hex() (+14 more)

### Community 12 - "ganttDerived / GanttView"
Cohesion: 0.09
Nodes (37): buildBaseFallbackRows(), buildCommandMetrics(), buildGanttDerivedState(), buildLensGroups(), buildTaskRow(), calculateElapsedSchedulePercent(), classifyTaskRisk(), countsTowardAssigneeLoad() (+29 more)

### Community 13 - "typedState / quotation status"
Cohesion: 0.06
Nodes (19): allowedTransitions(), computeIsRemind(), isApprovalSubmissionStatus(), isLegacyStatus(), isWinningQuotationStatus(), normalizeQuotationInputStatus(), validateUpdate(), buildTypedQuotationStateFromBody() (+11 more)

### Community 14 - "ProjectWorkspaceTabs / SalesOrders"
Cohesion: 0.05
Nodes (18): formatDateValue(), isPastDate(), milestoneTypeLabel(), parseDateValue(), shortageBadgeStyle(), workflowStatusLabel(), load(), releaseSalesOrder() (+10 more)

### Community 15 - "auth / FeatureRouteShell"
Cohesion: 0.06
Nodes (5): buildWorkspaceCollections(), extractArrayPayload(), hasArrayCollectionShape(), loadTaskWorkspaceData(), parseJsonSafe()

### Community 16 - "Pricing / calc"
Cohesion: 0.07
Nodes (23): buildAmortizationTable(), computeAmortization(), createEmptyPricingDraft(), normalizePricingDraft(), num(), buildDraftFromProject(), buildExistingActualDrafts(), buildNewActualDrafts() (+15 more)

### Community 17 - "taskDomain / taskViewPresets"
Cohesion: 0.09
Nodes (25): backendStatusFromUi(), buildTaskForm(), buildTaskPayload(), formatDate(), isBlocked(), isClosed(), isDueToday(), isOverdue() (+17 more)

### Community 18 - "HTC ERP Docs/Plan Index / Thin route handlers and module own"
Cohesion: 0.08
Nodes (36): MVP-shaped codebase with oversized files, Keep current stack and restructure into bounded modules, ADR-0001 modular monolith decision record, ADR-0002 backend contract ownership decision record, Frontend drift from backend-owned enums and semantics, Backend is source of truth for shared revenue contracts, Legacy outbox statuses were ambiguous at the API boundary, Normalize ERP outbox to a versioned API state model (+28 more)

### Community 19 - "compute / gender"
Cohesion: 0.09
Nodes (15): buildAmortizationTable(), computeAmortization(), computeMonthlySchedule(), computeQuotationSummary(), computeVarianceSummary(), derivePricingInvestment(), normalizeOperationConfig(), normalizeQuotationInput() (+7 more)

### Community 20 - "ganttUtils / parseDate()"
Cohesion: 0.12
Nodes (15): addMonths(), buildMonthDays(), buildTimelineRange(), buildTimelineWindowRange(), createMonthDays(), createTimelineWindowDays(), formatCompactDate(), formatShortDate() (+7 more)

### Community 21 - "importService / buildPreviewCompare()"
Cohesion: 0.15
Nodes (14): buildPreviewCompare(), buildUrlAssets(), getAssetUrls(), normalizeCellValue(), normalizeImportRow(), parseCsvRows(), parseLegacyMediaAssets(), parseNumericField() (+6 more)

### Community 22 - "import employees from xlsx.py / build active records()"
Cohesion: 0.33
Nodes (15): build_active_records(), build_inactive_records(), choose(), choose_phone(), clean_text(), EmployeeRecord, find_existing_user(), looks_like_phone() (+7 more)

### Community 23 - "import supplier monitoring.py / clean text()"
Cohesion: 0.31
Nodes (15): build_description(), clean_text(), create_backup(), fetch_one(), load_contacts(), load_suppliers(), main(), map_status() (+7 more)

### Community 24 - "qaSeed / resetUxRegressionSeed()"
Cohesion: 0.21
Nodes (12): assertQaRouteAvailable(), canAccessQaRoute(), buildUxSeedContract(), clearQaTables(), insertQaAccounts(), insertQaAdminArtifacts(), insertQaExecutionData(), insertQaProjectsAndQuotes() (+4 more)

### Community 25 - "Browser Driven Regression Suite / Shared UI Patterns for Hom"
Cohesion: 0.2
Nodes (14): Admin Preview Escape Hatch, Browser-Driven Regression Suite, Deterministic QA Seed, Home, Projects, Reports UI Refactor Plan, UX Audit Plan, Frontend Scope Rules, Product Form QA Desktop, Product Form QA Mobile (+6 more)

### Community 26 - "products api.test / main()"
Cohesion: 0.3
Nodes (9): api(), createPngBuffer(), createVideoBuffer(), createWebpStandInBuffer(), login(), main(), run(), setup() (+1 more)

### Community 27 - "MockFFmpeg / videoUpload.test"
Cohesion: 0.17
Nodes (1): MockFFmpeg

### Community 28 - "auth api.test / main()"
Cohesion: 0.33
Nodes (8): api(), login(), loginV1(), main(), run(), seedUser(), setup(), teardown()

### Community 29 - "tabular import api.test / main()"
Cohesion: 0.31
Nodes (6): api(), login(), main(), run(), setup(), teardown()

### Community 30 - "rolePreviewSession / getRolePreviewSessionStorageKey()"
Cohesion: 0.4
Nodes (7): getRolePreviewSessionStorageKey(), getStorage(), loadRolePreviewSessionProgress(), normalizeRoleSessionCodes(), resetRolePreviewSessionProgress(), saveRolePreviewSessionProgress(), toggleRolePreviewSessionChecklistItem()

### Community 31 - "test warning logic / addCalendarMonths()"
Cohesion: 0.44
Nodes (8): addCalendarMonths(), daysInMonth(), fail(), getVnDate(), hasQbuStaleWarning(), hasRateIncreaseWarning(), runTests(), toDate()

### Community 32 - "activities api.test / main()"
Cohesion: 0.44
Nodes (8): api(), createUser(), login(), main(), run(), seedActivities(), setup(), teardown()

### Community 33 - "project task reorder api.test / main()"
Cohesion: 0.36
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 34 - "security hardening api.test / main()"
Cohesion: 0.36
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 35 - "task bulk actions api.test / main()"
Cohesion: 0.36
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 36 - "task checklist api.test / main()"
Cohesion: 0.36
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 37 - "task reorder api.test / main()"
Cohesion: 0.36
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 38 - "task subtasks api.test / main()"
Cohesion: 0.36
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 39 - "task view presets api.test / main()"
Cohesion: 0.36
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 40 - "work hub api.test / main()"
Cohesion: 0.36
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 41 - "work hub phase2 api.test / main()"
Cohesion: 0.36
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 42 - "workspace api.test / main()"
Cohesion: 0.36
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 43 - "gender api.test / main()"
Cohesion: 0.46
Nodes (7): api(), login(), main(), resetDatabaseWithLegacyGender(), run(), setup(), teardown()

### Community 44 - "pricing api.test / setup()"
Cohesion: 0.54
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 45 - "project activity stream api.test / main()"
Cohesion: 0.43
Nodes (7): api(), login(), main(), run(), seedUser(), setup(), teardown()

### Community 46 - "support api.test / main()"
Cohesion: 0.46
Nodes (7): api(), createUser(), login(), main(), run(), setup(), teardown()

### Community 47 - "seed test projects / main()"
Cohesion: 0.52
Nodes (6): ensureTables(), main(), openDb(), seedProjects(), seedTasks(), seedUsers()

### Community 48 - "api v1 alias.test / main()"
Cohesion: 0.48
Nodes (6): api(), loginV1(), main(), run(), setup(), teardown()

### Community 49 - "project centric.test / main()"
Cohesion: 0.53
Nodes (4): login(), main(), resolveApproverSystemRole(), seedUser()

### Community 50 - "verify product media runtime / main()"
Cohesion: 0.7
Nodes (4): api(), createPngBuffer(), main(), withAuth()

### Community 51 - "qa seed api.test / main()"
Cohesion: 0.8
Nodes (4): api(), login(), main(), seedUser()

### Community 52 - "Frontend Dev Server Error Log / Frontend Logs Error Snapshot"
Cohesion: 0.6
Nodes (5): Frontend Dev Server Error Log, Frontend Logs Error Snapshot, Frontend Repo Path Mismatch to crm-app, TailwindCSS Oxide Win32 Binary Load Failure, Vite Externalize Deps Spawn EPERM

### Community 53 - "project contract workspace.test / login()"
Cohesion: 0.67
Nodes (2): login(), main()

### Community 54 - "db init.test / createLegacyPricingSchema()"
Cohesion: 1.0
Nodes (3): createLegacyPricingSchema(), main(), run()

### Community 55 - "run ux audit.ps1 / Get BrowserCandidates()"
Cohesion: 0.5
Nodes (0): 

### Community 56 - "Theme Tokens Source of Truth / UI Theme Principles"
Cohesion: 0.5
Nodes (4): Developer Runbook, Theme Tokens Source of Truth, UI Theme Principles, UI Theme Token Rationale

### Community 57 - "test api exchange rate / fail()"
Cohesion: 1.0
Nodes (2): fail(), main()

### Community 58 - "quotation create flow.test / main()"
Cohesion: 1.0
Nodes (2): main(), run()

### Community 59 - "revenue flow contracts.test / main()"
Cohesion: 1.0
Nodes (2): main(), run()

### Community 60 - "route boundary guard.test / containsDirectGetDbUsage()"
Cohesion: 0.67
Nodes (0): 

### Community 61 - "test gemini / run()"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "reviseQuotationValidator / validateReviseQuotationRequest()"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "seed / seedDatabase()"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "pricing compute.test / run()"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "representativeProject / selectRepresentativeProject()"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "check ux audit stack.ps1 / Test Url()"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "mirror global skills.ps1 / Resolve SkillsRoot()"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "MCP Orchestrator Setup / Project Local MCP Setup"
Cohesion: 1.0
Nodes (2): MCP Orchestrator Setup, Project-Local MCP Setup

### Community 69 - "Scripts Scope Rules / Small Task Focused Scripts"
Cohesion: 1.0
Nodes (2): Scripts Scope Rules, Small Task-Focused Scripts

### Community 70 - "Active Workstream Lifecycle Policy / Workstreams Scope Rules"
Cohesion: 1.0
Nodes (2): Active Workstream Lifecycle Policy, Workstreams Scope Rules

### Community 71 - "Frontend Dev Server Startup / Frontend Dev Server Start Outp"
Cohesion: 1.0
Nodes (2): Frontend Dev Server Startup, Frontend Dev Server Start Output

### Community 72 - "test trans"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "db init smoke"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "db seed"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "test db migration"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "validators"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "bootstrap test env"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "tailwind.config"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "vite.config"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "npm local.ps1"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "playwright local.ps1"
Cohesion: 1.0
Nodes (0): 

### Community 82 - "app.shell composition.test"
Cohesion: 1.0
Nodes (0): 

### Community 83 - "approvals.preview contract.test"
Cohesion: 1.0
Nodes (0): 

### Community 84 - "main"
Cohesion: 1.0
Nodes (0): 

### Community 85 - "ganttLayout.test"
Cohesion: 1.0
Nodes (0): 

### Community 86 - "handoffWorkflowContract.test"
Cohesion: 1.0
Nodes (0): 

### Community 87 - "inboxWorkflowContract.test"
Cohesion: 1.0
Nodes (0): 

### Community 88 - "myWorkWorkflowContract.test"
Cohesion: 1.0
Nodes (0): 

### Community 89 - "opsOverviewSalesOrderWorkflowContract.test"
Cohesion: 1.0
Nodes (0): 

### Community 90 - "supportWorkflowContract.test"
Cohesion: 1.0
Nodes (0): 

### Community 91 - "tasksWorkflowContract.test"
Cohesion: 1.0
Nodes (0): 

### Community 92 - "uxAuditContracts.test"
Cohesion: 1.0
Nodes (0): 

### Community 93 - "uxAuditLauncherContracts.test"
Cohesion: 1.0
Nodes (0): 

### Community 94 - "uxRegressionExecution.test"
Cohesion: 1.0
Nodes (0): 

### Community 95 - "qa scripts.d"
Cohesion: 1.0
Nodes (0): 

### Community 96 - "accessibilityContracts.test"
Cohesion: 1.0
Nodes (0): 

### Community 97 - "check doc classification.ps1"
Cohesion: 1.0
Nodes (0): 

### Community 98 - "cleanup ux audit stack.ps1"
Cohesion: 1.0
Nodes (0): 

### Community 99 - "start ux audit stack.ps1"
Cohesion: 1.0
Nodes (0): 

### Community 100 - "Test Database for Projects & Tasks"
Cohesion: 1.0
Nodes (1): Test Database for Projects & Tasks

### Community 101 - "Frontend Logs Snapshot (Empty)"
Cohesion: 1.0
Nodes (1): Frontend Logs Snapshot (Empty)

## Knowledge Gaps
- **51 isolated node(s):** `Test Database for Projects & Tasks`, `Validate external input at the boundary`, `All new endpoints move toward /api/v1`, `Active Canonical Docs section`, `Lean Docs Rule` (+46 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `test gemini / run()`** (2 nodes): `test-gemini.js`, `run()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `reviseQuotationValidator / validateReviseQuotationRequest()`** (2 nodes): `reviseQuotationValidator.ts`, `validateReviseQuotationRequest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `seed / seedDatabase()`** (2 nodes): `seed.ts`, `seedDatabase()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `pricing compute.test / run()`** (2 nodes): `pricing-compute.test.js`, `run()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `representativeProject / selectRepresentativeProject()`** (2 nodes): `representativeProject.ts`, `selectRepresentativeProject()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `check ux audit stack.ps1 / Test Url()`** (2 nodes): `check-ux-audit-stack.ps1`, `Test-Url()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `mirror global skills.ps1 / Resolve SkillsRoot()`** (2 nodes): `mirror-global-skills.ps1`, `Resolve-SkillsRoot()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `MCP Orchestrator Setup / Project Local MCP Setup`** (2 nodes): `MCP Orchestrator Setup`, `Project-Local MCP Setup`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scripts Scope Rules / Small Task Focused Scripts`** (2 nodes): `Scripts Scope Rules`, `Small Task-Focused Scripts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Active Workstream Lifecycle Policy / Workstreams Scope Rules`** (2 nodes): `Active Workstream Lifecycle Policy`, `Workstreams Scope Rules`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Frontend Dev Server Startup / Frontend Dev Server Start Outp`** (2 nodes): `Frontend Dev Server Startup`, `Frontend Dev Server Start Output`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `test trans`** (1 nodes): `test-trans.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `db init smoke`** (1 nodes): `db-init-smoke.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `db seed`** (1 nodes): `db-seed.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `test db migration`** (1 nodes): `test-db-migration.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `validators`** (1 nodes): `validators.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `bootstrap test env`** (1 nodes): `bootstrap-test-env.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `tailwind.config`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `vite.config`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `npm local.ps1`** (1 nodes): `npm-local.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `playwright local.ps1`** (1 nodes): `playwright-local.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `app.shell composition.test`** (1 nodes): `app.shell-composition.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `approvals.preview contract.test`** (1 nodes): `approvals.preview-contract.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `main`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ganttLayout.test`** (1 nodes): `ganttLayout.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `handoffWorkflowContract.test`** (1 nodes): `handoffWorkflowContract.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `inboxWorkflowContract.test`** (1 nodes): `inboxWorkflowContract.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `myWorkWorkflowContract.test`** (1 nodes): `myWorkWorkflowContract.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `opsOverviewSalesOrderWorkflowContract.test`** (1 nodes): `opsOverviewSalesOrderWorkflowContract.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `supportWorkflowContract.test`** (1 nodes): `supportWorkflowContract.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `tasksWorkflowContract.test`** (1 nodes): `tasksWorkflowContract.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `uxAuditContracts.test`** (1 nodes): `uxAuditContracts.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `uxAuditLauncherContracts.test`** (1 nodes): `uxAuditLauncherContracts.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `uxRegressionExecution.test`** (1 nodes): `uxRegressionExecution.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `qa scripts.d`** (1 nodes): `qa-scripts.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `accessibilityContracts.test`** (1 nodes): `accessibilityContracts.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `check doc classification.ps1`** (1 nodes): `check-doc-classification.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `cleanup ux audit stack.ps1`** (1 nodes): `cleanup-ux-audit-stack.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `start ux audit stack.ps1`** (1 nodes): `start-ux-audit-stack.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Database for Projects & Tasks`** (1 nodes): `Test Database for Projects & Tasks`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Frontend Logs Snapshot (Empty)`** (1 nodes): `Frontend Logs Snapshot (Empty)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 18 inferred relationships involving `denyWorkspaceAction()` (e.g. with `openContractEditor()` and `openAppendixEditor()`) actually correct?**
  _`denyWorkspaceAction()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `importTaskRow()` (e.g. with `normalizeRecord()` and `getField()`) actually correct?**
  _`importTaskRow()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `loadWorkspace()` (e.g. with `createApprovalRequest()` and `createSalesOrder()`) actually correct?**
  _`loadWorkspace()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Test Database for Projects & Tasks`, `Validate external input at the boundary`, `All new endpoints move toward /api/v1` to the rest of the system?**
  _51 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Quotations / Suppliers` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `readService / writeRoutes` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `navContext / testIds` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._