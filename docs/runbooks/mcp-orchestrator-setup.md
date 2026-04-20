# MCP Orchestrator Setup

This runbook covers the project-local MCP setup for `htc-erp`, and the portable template for other apps.

## Scope

- This checkout does not currently include a project-local `htc-erp/.codex/config.toml`.
- This checkout does not currently include repo-local OMX skills under `htc-erp/.codex/skills/`.
- Use the installed global Codex config and global skill registry unless a repo-local overlay is intentionally added later.
- Multi-app template lives in `codex-mcp-template/.codex/`.
- Open Codex with the repository root set to `htc-erp`, not the parent workspace.

## Configured MCP Servers

Intended active MCP surface for `htc-erp` work:

- `linear`
- `notion`
- `figma`
- `playwright`

## Important Defaults

- `GitHub` and `Supabase` are deferred for now and are not in the active MCP config.
- This checkout does not currently include the old repo-local Playwright wrapper script. Use the active installed Playwright MCP instead of assuming a repo-local wrapper exists.
- Global skills live outside the repo by default under `%USERPROFILE%\.codex\skills\`; if sandbox mode blocks direct reads, mirror only the required skill into `htc-erp/tmp/skills-global/`.

## First-Time Setup

1. Open Codex at the `htc-erp` repository root.
2. Confirm Codex is using the active installed config for this session.
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

## Multi-App Reuse

Use `codex-mcp-template/.codex` for any non-CRM app in this workspace.

1. Copy `codex-mcp-template/.codex` into the target app root.
2. Open Codex at that target app root.
3. Authenticate `Linear`, `Notion`, `Figma`, `Playwright`.
4. Add any project-local skill overlay only if the target app actually ships one.

## Troubleshooting

- If a server is visible but unauthenticated, log in through the client and retry the prompt.
- If `Playwright` fails to start, verify the installed Playwright MCP command instead of assuming a repo-local wrapper:
  - `npx @playwright/mcp@latest --help`
- If Codex does not load the project-local config, make sure the session root is `htc-erp`.
- If a required global skill cannot be opened without full access, mirror it locally first:
  - `pwsh -NoLogo -NoProfile -File htc-erp/scripts/mirror-global-skills.ps1 -Skill coding-standards`
  - inspect available global skills with `-List`
