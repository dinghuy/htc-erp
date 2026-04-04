# Huly Work Hub Embed Roadmap

## Decision

`htc-erp` remains the system of record for the revenue workflow. Huly is treated as a reference architecture for native feature ports inside `htc-erp`, not as an embedded runtime or shared persistence layer.

The integration strategy is:

- embed selected Work Hub capabilities into the existing modular monolith
- reuse Huly ideas before Huly code
- preserve the current `quotation -> project handoff -> task -> ERP outbox` boundary

## Capability Matrix

| Capability | `htc-erp` current state | Huly reference | Decision | Notes |
| --- | --- | --- | --- | --- |
| Project workspace hub | Present through projects, gantt, project workspace tabs, orchestration routes | `tracker`, `card`, `task`, `process` | `upgrade from current CRM implementation` | Use Huly as a workflow/ownership benchmark, not a direct import source |
| Task model and execution lane | Present in `tasks`, gantt, todo/time-spend routes | `task`, `tracker` | `upgrade from current CRM implementation` | Add context refs, dependency graph, richer blocker semantics |
| Activity stream | Present but fragmented across activities, chat, notifications, support signals | `activity`, `notification`, `tracker` | `build new module inspired by Huly` | Normalize into one project/task/activity surface |
| Approval cockpit | Present in revenue flow and executive reporting | `process`, `card`, `notification` | `upgrade from current CRM implementation` | Keep approval logic tied to revenue workflow and workspace context |
| Contextual collaboration threads | Basic global chat and support ticket flows exist | `chat`, `card`, `document` | `build new module inspired by Huly` | Move from global ops chat toward entity threads |
| Project documents and review states | Document tabs and review permissions exist conceptually; no dedicated document module boundary yet | `document`, `controlled-documents`, `attachment` | `build new module inspired by Huly` | Start with project/task scoped docs, not wiki/general knowledge base |
| Notification center | Present with polling and read/unread semantics | `notification` | `keep as-is`, then upgrade | Preserve current UX path and enrich routing/context payloads |
| Global chat platform | Present as `ChatPanel` for ops | `chat`, `chunter` | `defer` | Keep lightweight until contextual threads are stable |
| Realtime platform core | Polling model today | `transactor`, collaborator, websocket core | `defer` | Add SSE/WebSocket only if work hub usage proves the need |
| Tracker-style saved task views | Task board exists but filters are ephemeral | `tracker` | `build new module inspired by Huly` | Native user-scoped saved views, defaults, and quick switching inside `htc-erp` |

## Do Not Import

These Huly surfaces are out of bounds for direct adoption into `htc-erp`:

- Huly plugin runtime and model registry
- CockroachDB, Redpanda, MinIO, and the Huly service topology
- Huly auth/session model and workspace bootstrap lifecycle
- Huly realtime core (`transactor`, collaborator, websocket routing)
- Huly package trees with deep plugin-to-plugin coupling, especially `tracker`, `document`, and `chat`, unless a later legal and architectural review approves isolated extraction

## Phase Roadmap

### Phase 0: Capability Audit And Contract Prep

- Lock this roadmap as the reference decision document for Huly Work Hub adoption.
- Extend canonical contracts with the future-facing shapes needed by Work Hub v1:
  - `ProjectWorkspaceSummary`
  - `ProjectActivityItem`
  - `TaskContextRef`
  - `TaskDependency`
  - `ApprovalQueueItem`
  - `WorklogEntry`
  - `EntityThread`
  - `ThreadMessage`
  - `ProjectDocument`
  - `DocumentReviewState`
- Keep all additions persistence-neutral so SQLite dev and PostgreSQL target can both support them.

Exit criteria:

- capability matrix is approved
- contract names are reserved in shared domain contracts
- API catalog records the future ownership direction

### Phase 1: Work Hub v1

- Upgrade `project-workspace` and `tasks-approvals` into a unified work hub around project execution.
- Add task context links to project, quotation, account, milestone, and approval entities.
- Add dependency and blocker visibility so Gantt, task detail, and workspace views derive from the same task graph.
- Introduce a project-scoped activity stream for approvals, task updates, milestone changes, and handoff events.
- Keep current REST and polling patterns; do not introduce broker or websocket infrastructure in this phase.

Exit criteria:

- project workspace shows task, milestone, approval, and activity summaries on one path
- task navigation no longer depends on global chat or manual cross-screen lookup
- executive and operator views can identify approval bottlenecks from shared workspace data

### Phase 2: Contextual Collaboration And Documents

- Replace the current “ops chat first” model with entity-scoped collaboration surfaces.
- Add project/task approval threads and project document review states.
- Restrict the first document surface to operational delivery and review artifacts tied to the revenue workflow.
- Keep global chat and support ticket features as supporting surfaces, not the center of work execution.

Exit criteria:

- project/task level discussion exists without introducing a general-purpose chat platform
- document review states are visible in workspace and approval flows
- notification payloads can deep-link into thread/document context

### Phase 3: Native Huly Feature Ports

- Continue porting high-value Huly capabilities natively into `htc-erp`.
- Start with tracker-like task views, saved filters, defaults, and faster task triage.
- Keep each Phase 3 slice modular and fully local to `htc-erp`.

Current implementation status:

- `tasks` is the owning module for the first Phase 3 slice
- `/api/v1/tasks/views` is the reserved namespace for saved task views
- user-scoped saved task view presets are implemented on the task board
- presets support save, update, delete, default selection, `groupBy`, and apply-on-open when no higher-priority nav context exists
- task board also exposes system quick views such as `Assigned to me`, `Blocked`, `Due today`, and `Overdue`
- `/api/v1/projects/:id/activities` is now implemented as a dedicated activity stream read model
- timeline tab now surfaces a project activity stream with source filtering instead of relying only on raw timeline events
- `/api/v1/tasks/:id/checklist` is implemented and rendered directly inside the task drawer
- task work hub summary now includes checklist completion counts next to dependencies, worklogs, and thread context
- `/api/v1/tasks/:id/subtasks` is implemented for parent-child task hierarchy
- task drawer now surfaces subtask list and quick-add flow so execution can be decomposed without leaving the current task
- `/api/v1/tasks/bulk-update` is implemented for bulk status, owner, and priority actions
- list view now supports multi-select and a bulk action bar for operational triage
- `/api/v1/tasks/:id/subtasks/reorder` is implemented for sibling ranking
- subtask blocks in the task drawer now support move up/down ordering inside the hierarchy
- `/api/v1/projects/:id/tasks/reorder` is implemented for top-level task ordering inside a project
- task list view now exposes manual order controls when the user is scoped to a single project and not using another grouping mode

Exit criteria:

- feature port is native to `htc-erp`
- no shared auth, database, runtime, or package dependency from Huly is introduced
- revenue workflow remains operable while task execution UX becomes closer to Huly tracker behavior

## Target Module Ownership In `htc-erp`

| Concern | Owning area |
| --- | --- |
| Workspace summary, milestones, handoff, readiness | `backend/src/modules/projects/*`, `frontend/src/features/projects/*` |
| Task context, dependency, worklog, task graph | `backend/src/modules/tasks/*`, `frontend/src/features/tasks/*` |
| Approval queue and lane-specific risk surfaces | `backend` approval routes plus reporting/workspace adapters, `frontend` approvals/projects/reports |
| Activity stream, threads, notifications | `backend/src/modules/collaboration/*`, `frontend/src/features/operations/*`, `frontend/src/features/support/*` |
| Project documents and review state | new project-scoped document boundary under `projects` or `collaboration`, depending persistence and review semantics |
| Tracker-style saved task views | `backend/src/modules/tasks/*`, `frontend/src/features/tasks/*`, `frontend/src/Tasks.tsx` |

## License And Reuse Guard

Selective reuse requires an explicit review before any code import from Huly because Huly packages in scope are licensed under EPL-2.0 and have non-trivial coupling across platform packages. Until that review exists, implementation defaults to:

- no Huly source import
- no Huly package dependency in `htc-erp`
- UX pattern and domain behavior study only
