# MCP Orchestrator Setup

This runbook covers the project-local MCP setup for `htc-erp`, and the portable template for other apps.

## Scope

- Project-local Codex config lives in `htc-erp/.codex/config.toml`.
- Default delivery skill lives in `htc-erp/.codex/skills/app-delivery-orchestrator/`.
- Frontend verification skill lives in `htc-erp/.codex/skills/frontend-change-flow/`.
- Backend verification skill lives in `htc-erp/.codex/skills/backend-api-change-flow/`.
- Release verification skill lives in `htc-erp/.codex/skills/release-regression-verification/`.
- Legacy CRM compatibility skill remains in `htc-erp/.codex/skills/crm-delivery-orchestrator/`.
- Multi-app template lives in `codex-mcp-template/.codex/`.
- Open Codex with the repository root set to `htc-erp`, not the parent workspace.

## Configured MCP Servers

- `linear`
- `notion`
- `figma`
- `playwright`

## Important Defaults

- `GitHub` and `Supabase` are deferred for now and are not in the active MCP config.
- `Playwright` runs through `htc-erp/.codex/scripts/playwright-mcp.ps1` so npm cache stays inside the repo-local `.codex/npm-cache/`.
- Global skills live outside the repo by default under `%USERPROFILE%\.codex\skills\`; if sandbox mode blocks direct reads, mirror only the required skill into `htc-erp/tmp/skills-global/`.

## First-Time Setup

1. Open Codex at the `htc-erp` repository root.
2. Confirm Codex sees `htc-erp/.codex/config.toml`.
3. Authenticate each remote MCP server when prompted by the client:
   - `Linear`
   - `Notion`
   - `Figma`

## Smoke-Test Prompts

Run these in separate turns after auth succeeds.

### Notion

`Use Notion MCP to search this workspace for HTC ERP specs or release notes relevant to htc-erp.`

### Linear

`Use Linear MCP to list recent issues for the HTC ERP workstream and summarize open items.`

### Figma

`Use Figma MCP on this node or file link and summarize the design context for implementation.`

### Playwright

`Use Playwright MCP to open the local HTC ERP frontend and return an accessibility snapshot of the landing page.`

## Orchestrator Skill Smoke Tests

### Delivery loop

`Use $app-delivery-orchestrator to read a Linear issue and its Notion spec, then outline a bounded implementation task for htc-erp.`

### Design to code

`Use $app-delivery-orchestrator to compare this Figma screen with the current frontend and identify missing UI pieces.`

### Release update

`Use $app-delivery-orchestrator to draft a release update from Notion and Linear context.`

### Frontend verification flow

`Use $frontend-change-flow after this UI change and tell me which frontend checks you will run and which can be skipped.`

### Backend verification flow

`Use $backend-api-change-flow after this route change and tell me which backend checks you will run and which can be skipped.`

### Release verification flow

`Use $release-regression-verification for this cross-frontend/backend task and summarize the regression checks required before handoff.`

### Legacy compatibility

`Use $crm-delivery-orchestrator only if this task is about historical crm-app references or migrating old prompts/docs.`

## Multi-App Reuse

Use `codex-mcp-template/.codex` for any non-CRM app in this workspace.

1. Copy `codex-mcp-template/.codex` into the target app root.
2. Open Codex at that target app root.
3. Authenticate `Linear`, `Notion`, `Figma`, `Playwright`.
4. Use `$app-delivery-orchestrator` in that project.

## Re-enabling GitHub and Supabase Later

When you want them back, restore `github` and `supabase` entries in `htc-erp/.codex/config.toml`.

For `Supabase`, prefer:

`https://mcp.supabase.com/mcp?project_ref=<DEV_REF>&read_only=true&features=database,debugging,development,docs`

Do not point that config at production.

## Troubleshooting

- If a server is visible but unauthenticated, log in through the client and retry the prompt.
- If `Playwright` fails to start, rerun a simple help check through the wrapper script:
  - `pwsh -NoLogo -NoProfile -File htc-erp/.codex/scripts/playwright-mcp.ps1 --help`
- If Codex does not load the project-local config, make sure the session root is `htc-erp`.
- If a required global skill cannot be opened without full access, mirror it locally first:
  - `pwsh -NoLogo -NoProfile -File htc-erp/scripts/mirror-global-skills.ps1 -Skill coding-standards`
  - inspect available global skills with `-List`
