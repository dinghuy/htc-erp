# HTC ERP Agent Instructions

These instructions apply to Codex agents working in this repository.

## Core Rules

- Work only from short written specs and bounded implementation tasks.
- Every code change must include verification evidence.
- Large cross-module rewrites are not allowed in one change.
- Generated runtime artifacts must stay out of Git.

## Source Of Truth

- Start from `docs/index.md` to find the active canonical docs for the task.
- Use Linear as the execution tracker for active workstreams.
- Use Notion as the plan and evidence tracker.

## OMX Execution Flow

- This repo uses OMX as the preferred execution system on top of Codex.
- Use the repository root as the working directory when invoking OMX commands.
- The canonical OMX flow in this repo is:
  1. `$deep-interview` for intent-first clarification when the request is broad, ambiguous, or missing acceptance criteria.
  2. `$ralplan` for consensus planning when the task needs an execution-ready plan with architecture and verification detail.
  3. `$ralph` for persistent single-owner execution with mandatory verification.
  4. `$team` for durable tmux-based parallel execution when the work needs coordinated workers, shared task state, or long-running lanes.
- Use `omx status`, `omx hooks status`, and `omx cancel` as the main operator surfaces during execution.
- Use `omx agents-init .` to refresh lightweight `AGENTS.md` files for direct child directories.
- Treat the root `AGENTS.md` as manually maintained orchestration guidance; do not overwrite it blindly with generated output.
- Treat `.omx/` as OMX runtime state for plans, logs, memory, and mode tracking; keep generated runtime artifacts out of Git.
- In this environment, `omx setup --scope project` may be blocked by sandbox restrictions on `.codex/*`; rerun it locally when full project-scope refresh is needed.

## ECC Coordination

- Treat Everything Claude Code (ECC) as the policy, quality, and specialist-agent layer.
- Use ECC guidance for research-first development, TDD, code review, security review, verification, and domain-specific implementation patterns when those capabilities apply.
- Use ECC planner or architect-style guidance only when the task needs deeper architecture review than the default OMX planning path.
- Use ECC review and verification surfaces after implementation, especially for code review, security-sensitive changes, build failures, and completion gates.
- When OMX and ECC overlap, use OMX to run the top-level execution flow and use ECC to deepen planning, review, security, testing, or debugging quality inside that flow.
- Keep repo-specific rules in this `AGENTS.md` above framework defaults from ECC or other imported systems.

## Workflow System Hierarchy

- Repo docs, repo tracking rules, and this root `AGENTS.md` remain the top project-specific source of truth.
- `using-superpowers` is the process-workflow router. It decides which process skill or process flow must run before execution begins.
- OMX is the default execution spine after the process gate is clear.
- ECC is the quality, research, and specialist-depth layer.
- gstack is the ideation-review, browser-evidence, UX-regression, and ship/deploy layer.

## using-superpowers Process Workflows

- Treat `using-superpowers` as more than a meta-rule. In practice it routes the session into the right process workflow before implementation.
- The main process skills to name explicitly in this repo are:
  - `brainstorming`
  - `writing-plans`
  - `executing-plans`
  - `subagent-driven-development`
  - `dispatching-parallel-agents`
  - `systematic-debugging`
  - `test-driven-development`
  - `verification-before-completion`
  - `requesting-code-review`
  - `receiving-code-review`
  - `using-git-worktrees`
  - `finishing-a-development-branch`
- In this repo, `using-superpowers` commonly routes into these process sequences:
  - Idea or behavior shaping: `brainstorming` -> OMX execution flow when the design is approved
  - Ambiguous implementation request: `$deep-interview` -> `$ralplan` -> `$ralph` or `$team`
  - Multi-step scoped implementation: `writing-plans` -> `executing-plans` or `subagent-driven-development`
  - Bug or unexpected behavior: `systematic-debugging` -> `test-driven-development` if behavior changes -> OMX execution flow
  - Pre-completion gate: `requesting-code-review` -> `verification-before-completion` -> `finishing-a-development-branch` when the next step is PR/merge/cleanup

## Default Coordination Model

- Start with repo docs and tracker truth first.
- Let `using-superpowers` determine whether a process skill or process flow must run before execution.
- Move into OMX when the task is clear enough to execute.
- Pull in ECC when deeper research, architecture, testing, security, or specialist review is needed.
- Pull in gstack when the task needs idea shaping, plan review, browser truth, UX evidence, or release/deploy orchestration.

### Recommended Layering

1. Clarify and shape the task
   - Use plain repo docs first: `docs/index.md`, active canonical docs, and the relevant tracker items.
   - Use `brainstorming` when the request is still vague, design-heavy, or likely to branch into multiple implementation options.
   - Use `writing-plans` when the task needs a written multi-step plan before touching code.
   - Use `$deep-interview` when implementation boundaries are still unclear.
   - Use gstack `office-hours` for net-new product ideas, scope discovery, or pre-spec problem framing.
   - Use ECC research-first and documentation lookup skills when the task depends on external docs, library choices, or implementation patterns that should be verified before coding.
2. Approve the plan
   - Use `$ralplan` as the default implementation planning and approval step.
   - Bring in ECC planner or architect guidance when the task has architecture risk, system-boundary changes, or non-trivial tradeoffs that need deeper review.
   - Escalate to gstack review flows only when the task is high-risk or high-ambiguity:
     - `plan-eng-review` for architecture and execution rigor
     - `plan-design-review` for UX and UI quality
     - `plan-ceo-review` for scope and product ambition
3. Execute
   - Use `$ralph` for single-owner execution with persistence.
   - Use `$team` when the plan splits cleanly into parallel lanes such as frontend, backend, docs, or verification.
   - Use `executing-plans` or `subagent-driven-development` when a written plan already exists and should be carried out step by step.
   - Use `dispatching-parallel-agents` when the work splits into independent lanes.
   - Use `using-git-worktrees` when isolation is needed before substantial feature work.
   - Use `systematic-debugging` when the task is bug investigation or unexpected behavior analysis.
   - Use `test-driven-development` when implementing or fixing behavior that should be driven by tests first.
   - Use `verification-before-completion` before claiming the task is finished.
   - Use ECC domain and quality skills during execution when the task matches them, for example TDD, security review, backend patterns, frontend patterns, API design, or verification loop.
   - Use plain Codex for small, bounded edits that do not benefit from heavier orchestration.
4. Verify
    - Use project-local OMX verification skills first.
   - Use `requesting-code-review` before merge or handoff when a formal review pass is warranted.
   - Use `receiving-code-review` when implementing or evaluating review feedback.
    - Use ECC review agents or verification skills for code review, security review, build-error resolution, and completion evidence when those checks are materially relevant.
    - Use gstack `browse`, `qa`, `qa-only`, `review`, or `design-review` when browser behavior, screenshots, UX regressions, or pre-merge evidence matter.
5. Ship
    - Use gstack `ship` or `land-and-deploy` for PR, merge, and deploy workflows when those flows are needed.
    - Use `finishing-a-development-branch` when implementation is done and the next step is to decide merge, PR, or cleanup workflow.
    - Keep release and deployment flow separate from implementation flow unless the task explicitly includes handoff to production.

## Decision Matrix

- Small bounded code or docs change: plain Codex + repo rules.
- Net-new idea or "có nên build không": `using-superpowers` checks process routing, then gstack `office-hours`, then OMX only after scope is approved.
- Behavior change or feature design still mơ hồ: `brainstorming`, then OMX flow.
- Multi-step scoped implementation with explicit plan artifact: `writing-plans`, then `executing-plans` or `subagent-driven-development`.
- Ambiguous implementation request without a plan artifact: `$deep-interview` if needed, then `$ralplan`, then `$ralph` or `$team`.
- Existing written plan: `executing-plans` or `subagent-driven-development`; use `$ralph` or `$team` when the approved plan explicitly hands off into OMX execution.
- Bug, test failure, or unexpected behavior: `systematic-debugging` first, then OMX execution.
- Feature or bugfix with behavior change: `test-driven-development`, then OMX execution.
- Medium implementation task: OMX flow, plus any clearly applicable process skill such as `brainstorming`, `systematic-debugging`, `test-driven-development`, or `verification-before-completion`.
- Large cross-surface task: OMX planning + `$team`, with ECC specialist review where needed and gstack verification at the end.
- Browser, UX, or release-sensitive work: gstack is mandatory before calling the task complete.

## Anti-Patterns

- Do not describe process help vaguely as “Superpowers”. Name the actual skill or process flow to invoke.
- Do not treat `using-superpowers` as a lightweight reminder only. It is the process router for deciding which skill workflow runs first.
- Do not confuse ECC with OMX. ECC is the policy and specialist-quality layer; OMX is the default execution flow.
- Do not run both gstack `office-hours` and `$deep-interview` by default; pick one based on whether the problem is product ambiguity or implementation ambiguity.
- Do not run both gstack `plan-eng-review` and `$ralplan` for every small task; use the review layer only when extra scrutiny is justified.
- Do not stack ECC planner, OMX `$ralplan`, and gstack `plan-eng-review` on every task. Use the extra layers only when the risk justifies them.
- Do not use gstack as the default execution layer for backend-only or docs-only work.
- Do not treat historical `docs/superpowers/*` artifacts as active instructions unless an active canonical doc links to them intentionally.

## Global Skill Access Fallback

- Prefer project-local skills in `.codex/skills/` for repeatable repo workflows.
- If a required global skill under `%USERPROFILE%\.codex\skills\` is not readable in the current sandbox mode, mirror only the needed skill into `tmp/skills-global/`.
- Use `scripts/mirror-global-skills.ps1 -Skill <skill-name>` to create the local mirror.
- Treat `tmp/skills-global/` as a local cache only; do not commit mirrored global skills to Git.
- When a mirrored skill becomes project-critical, promote it intentionally into a maintained project-local skill instead of relying on an ad hoc cache.

## GitHub Workflow Rules

- Create a dedicated working branch before making code changes.
- Use one branch for one bounded task only.
- Use clear branch names such as `codex/<task-name>`, `feat/<task-name>`, or `fix/<task-name>`.
- Branch from the current integration base branch after syncing it locally.
- Do not commit directly to `main`, `master`, or the active release branch.
- Keep commits focused and aligned to a single intent.
- Use conventional commit messages such as `feat: ...`, `fix: ...`, `refactor: ...`, `docs: ...`, or `test: ...`.
- Open a pull request for review instead of merging local work directly.
- Every pull request must include a short summary, scope, risks, and verification evidence.
- Link the relevant Linear issue and supporting Notion context in the pull request when applicable.
- Do not force-push shared branches unless the owner has explicitly agreed.
- Delete stale working branches after merge when they are no longer needed.

## Coding Principles

- Do not hardcode business rules, endpoints, secrets, labels, colors, spacing, or status mappings inside features.
- Move reusable constants, config, theme tokens, enums, and mappings into shared modules.
- Keep presentation, state, side effects, and business logic separated.
- Validate and normalize data at the boundary before it reaches domain or UI layers.
- Use shared design tokens instead of inline styles and repeated magic numbers.
- Keep functions and modules small, focused, and named by domain intent.
- Prefer composition and existing module patterns over large monoliths or speculative abstractions.

## Frontend Architecture Rules

- Organize frontend code by feature or domain, not by generic file type alone.
- Separate screen composition, data orchestration, and presentational components.
- Pages and screens should assemble flows, not hold complex business logic.
- Containers, hooks, or stores should own state, side effects, and server interaction.
- Presentational components should receive explicit props and stay reusable and easy to test.
- Shared UI primitives must be reused instead of reimplemented per feature.
- Design tokens must drive color, spacing, typography, radius, elevation, and motion values.
- Avoid calling APIs directly inside deeply nested UI components.
- Keep form state, validation, submission, and error display predictable and isolated.
- Handle loading, empty, error, and success states explicitly for all user-facing async flows.
- Prefer extending existing state and styling patterns unless there is a documented reason to add a new one.

## Backend Architecture Rules

- Organize backend code by domain and capability boundaries.
- Keep routing and controllers thin; they should parse requests, invoke application logic, and shape responses.
- Place business rules in dedicated service or use-case layers, not in controllers or repositories.
- Repositories and data-access modules should own persistence concerns only.
- Validate and sanitize all external input at the boundary before it reaches domain logic.
- Keep queues, caches, files, and third-party integrations behind explicit interfaces or service modules.
- Avoid hidden side effects; make writes, external calls, and background triggers explicit.
- Use configuration and environment bindings through centralized config modules, not scattered process environment reads.
- Map errors into consistent application or transport responses with enough server-side context for debugging.
- Keep database writes and state transitions intentional, traceable, and guarded against partial failure where possible.
- Prefer additive, bounded changes to existing flows over broad backend rewrites in one task.

## API Contract Rules

- Treat API requests and responses as explicit contracts.
- Define request and response schemas clearly and validate them at runtime where applicable.
- Keep field names, status codes, pagination, and error shapes consistent across endpoints.
- Do not return raw internal models, stack traces, or storage-specific fields unless they are part of the contract.
- Use stable identifiers and explicit enums or status values instead of implicit string conventions.
- Make optional and nullable fields intentional and documented.
- Backward compatibility must be preserved for existing consumers unless the breaking change is explicitly planned and approved.
- Contract changes must be reflected in the relevant docs, consumers, tests, and tracking records.
- Error responses should be predictable, machine-readable, and safe to expose.
- When an endpoint has side effects, document and test the expected state transitions and failure behavior.

## Testing And Verification Rules

- Every material code change must include verification evidence.
- Prefer test-first development for new behavior and bug fixes whenever practical.
- Cover the affected behavior at the appropriate level: unit, integration, and end-to-end when the user flow is critical.
- New behavior must include tests or a documented reason why automated coverage was not added.
- Bug fixes should include a test that would fail before the fix when feasible.
- Verification commands must target the changed scope first, then expand when risk justifies broader checks.
- Do not claim completion until relevant tests, type checks, linting, or other verification steps have actually been run.
- If a verification step cannot run, record the blocker and the remaining risk explicitly.
- User-facing changes should include updated UAT notes and, when appropriate, screenshots or interaction evidence.
- Keep generated test artifacts, temporary logs, and runtime outputs out of Git unless they are intentional fixtures.

## Tracking Rule

- Any material problem, bug, blocker, decision, or cleanup item must be tracked.
- The tracking record must capture:
  - what the problem is
  - where it appears
  - impact or risk
  - chosen resolution or workaround
  - current status
  - verification or evidence links when available
- If both Linear and Notion are in use:
  - record execution state in Linear
  - record context, resolution notes, and evidence in Notion
- If a tracked item already exists, update it instead of creating a duplicate.
- If no tracked item exists and the issue is material, create one before or during execution, not after the context is lost.

## Delivery Workflow

1. Identify the active canonical docs in `docs/index.md`.
2. Create or update a short spec when needed.
3. Make sure any material issue or workstream is tracked in Linear and Notion.
4. Implement one bounded task only.
5. Run verification commands.
6. Update the tracker with the result, resolution summary, and evidence.
7. Update UAT notes if user-facing behavior changed.
