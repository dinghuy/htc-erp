# MCP Orchestrator Setup

This runbook covers the project-local MCP setup for `crm-app`, and the portable template for other apps.

## Scope

- Project-local Codex config lives in `crm-app/.codex/config.toml`.
- Generic skill lives in `crm-app/.codex/skills/app-delivery-orchestrator/`.
- CRM-specific skill remains in `crm-app/.codex/skills/crm-delivery-orchestrator/`.
- Multi-app template lives in `codex-mcp-template/.codex/`.
- Open Codex with the repository root set to `crm-app`, not the parent workspace.

## Configured MCP Servers

- `linear`
- `notion`
- `figma`
- `playwright`

## Important Defaults

- `GitHub` and `Supabase` are deferred for now and are not in the active MCP config.
- `Playwright` runs through `crm-app/.codex/scripts/playwright-mcp.ps1` so npm cache stays inside the repo-local `.codex/npm-cache/`.

## First-Time Setup

1. Open Codex at the `crm-app` repository root.
2. Confirm Codex sees `crm-app/.codex/config.toml`.
3. Authenticate each remote MCP server when prompted by the client:
   - `Linear`
   - `Notion`
   - `Figma`

## Smoke-Test Prompts

Run these in separate turns after auth succeeds.

### Notion

`Use Notion MCP to search this workspace for CRM specs or release notes relevant to crm-app.`

### Linear

`Use Linear MCP to list recent issues for the Huynh Thy CRM workstream and summarize open items.`

### Figma

`Use Figma MCP on this node or file link and summarize the design context for implementation.`

### Playwright

`Use Playwright MCP to open the local CRM frontend and return an accessibility snapshot of the landing page.`

## Orchestrator Skill Smoke Tests

### Delivery loop

`Use $crm-delivery-orchestrator to read a Linear issue and its Notion spec, then outline a bounded implementation task for crm-app.`

### Design to code

`Use $crm-delivery-orchestrator to compare this Figma screen with the current frontend and identify missing UI pieces.`

### Release update

`Use $crm-delivery-orchestrator to draft a release update from Notion and Linear context.`

### Generic app flow

`Use $app-delivery-orchestrator to read Linear + Notion + Figma context, then produce an implementation plan for this app.`

## Multi-App Reuse

Use `codex-mcp-template/.codex` for any non-CRM app in this workspace.

1. Copy `codex-mcp-template/.codex` into the target app root.
2. Open Codex at that target app root.
3. Authenticate `Linear`, `Notion`, `Figma`, `Playwright`.
4. Use `$app-delivery-orchestrator` in that project.

## Re-enabling GitHub and Supabase Later

When you want them back, restore `github` and `supabase` entries in `crm-app/.codex/config.toml`.

For `Supabase`, prefer:

`https://mcp.supabase.com/mcp?project_ref=<DEV_REF>&read_only=true&features=database,debugging,development,docs`

Do not point that config at production.

## Troubleshooting

- If a server is visible but unauthenticated, log in through the client and retry the prompt.
- If `Playwright` fails to start, rerun a simple help check through the wrapper script:
  - `pwsh -NoLogo -NoProfile -File crm-app/.codex/scripts/playwright-mcp.ps1 --help`
- If Codex does not load the project-local config, make sure the session root is `crm-app`.
