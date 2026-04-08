# HTC ERP Agent Instructions

These instructions apply to Codex agents working in this repository.

## Non-Negotiables

- Work from short written specs and bounded tasks only.
- Keep changes additive and scoped; do not bundle large cross-module rewrites.
- Every material change must include verification evidence.
- Keep generated runtime artifacts, logs, caches, and temp outputs out of Git.

## Source Of Truth

- Start from `docs/index.md` to find the active canonical docs for the task.
- Never scan `docs/` recursively. Open `docs/index.md` first and read only the active files it links to.
- `docs/index.md` entries must carry one-line purpose metadata so the first routing decision can be made from the index alone.
- Use Linear as the execution tracker for active workstreams.
- Use Notion as the plan and evidence tracker.
- Update an existing tracked item when it already exists; create one for material work before context is lost.

## Execution Routing

- Use repo docs first, then choose the lightest workflow that fits the task.
- Default OMX path:
  1. Use `$deep-interview` when the request is broad, ambiguous, or missing acceptance criteria.
  2. Use `$ralplan` for execution-ready planning on multi-step or risky work.
  3. Use `$ralph` for single-owner execution with verification.
  4. Use `$team` when work cleanly splits into parallel lanes.
- Use ECC for deeper research, TDD, security review, debugging, or code review when needed.
- Use browser or release-oriented workflows only when browser truth, UX evidence, or ship/deploy evidence is required.
- Use subtree `AGENTS.md` files for directory-specific guidance; keep root guidance as the orchestration layer.
- Ignore `archive/` and other non-active storage locations unless the user explicitly asks for historical material.
- One-depth follow rule: when an active doc links directly to another internal doc needed to complete the same reasoning step, you may follow that single hop without returning to `docs/index.md`. Do not continue chaining beyond one hop unless you re-anchor on `docs/index.md` or the user explicitly asks for deeper historical/context traversal.

## File Classification

- Files intended for repeated operational use must live in the active docs structure and be linked from `docs/index.md`.
- Canonical docs belong under stable domain folders such as `docs/product/`, `docs/architecture/`, `docs/domain/`, `docs/api/`, `docs/process/`, `docs/qa/`, or `docs/runbooks/`.
- Active workstream plans belong in `docs/workstreams/` and must be listed in `docs/index.md`.
- Historical plans, branch-specific execution notes, generated reports, exported documents, scratch notes, and one-off helper scripts must not stay in the active docs reading set.
- Put historical or reference-only material under `archive/`; put temporary working files under `tmp/`.
- If a new file is not meant to be read on future routine tasks, exclude it from `docs/index.md` and keep it out of active directories.
- `tmp/` is excluded from normal context loading to protect prompt-cache stability; only open files there when the user explicitly asks for a scratch artifact or a specific temporary file.
- Workstream archive trigger: when a plan is completed, superseded, merged into canonical docs, or no longer directs current execution, the person closing that workstream must move it from `docs/workstreams/` to `archive/` and update `docs/index.md` in the same change.

## Engineering Guardrails

- Keep presentation, orchestration, domain logic, and persistence concerns separated.
- Design backend and frontend modules as bounded contexts with high cohesion. Do not let one module reach into another module's tables, hidden state, or persistence internals except through explicit repository/service interfaces.
- Keep UI thin and domain/core thick. Large screens may orchestrate state, but business rules, calculations, workflow guards, and data-shaping logic should live in shared kernels, domain services, or focused helpers rather than inline in view components.
- Keep authorization decoupled from leaf UI. Prefer central permission builders, route-level gating, or wrapper/hook-based access decisions over repeated ad hoc `if (!canAccess)` branches inside action handlers.
- Validate and normalize external input at system boundaries.
- Treat API requests and responses as explicit contracts; keep them consistent and backward-compatible unless a planned break is approved.
- Avoid hardcoded business rules, secrets, endpoints, labels, colors, spacing, and status mappings inside features.
- Prefer shared config, tokens, enums, constants, and existing module patterns over ad hoc duplication.
- Put cross-surface business rules into a shared kernel when they are needed by both backend and frontend. Types, constants, and pure functions must be imported from one canonical source rather than copied between layers.
- Prefer vertical slices over horizontal delivery. When building or refactoring a capability, complete the minimum coherent slice across schema, backend logic, frontend surface, and verification rather than leaving partially integrated layers behind.
- Separate write-side normalization from read-side optimization. Keep write models explicit and normalized; for dashboards, workspaces, and Gantt/read-heavy surfaces, allow dedicated rollups or denormalized read models instead of pushing complex joins into UI code.

## Verification And Delivery

- Run the narrowest relevant verification first, then expand if risk justifies broader checks.
- Do not claim completion until required tests, lint, typecheck, UAT, or browser verification have actually run, or the blocker is recorded explicitly.
- Bug fixes should add a regression test when feasible.
- User-facing changes should include UAT notes and UX evidence when relevant.
- Before handoff or PR, update tracking records with scope, status, resolution, and verification evidence.

## Git Workflow

- Work on a dedicated branch for one bounded task.
- Use focused conventional commits such as `feat:`, `fix:`, `refactor:`, `docs:`, or `test:`.
- Open a PR instead of merging local work directly.
- Every PR must include summary, scope, risks, and verification evidence.
