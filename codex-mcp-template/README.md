# Codex MCP Template

Reusable `.codex` template for app projects that want:

- `Linear` for issue tracking
- `Notion` for specs and acceptance
- `Figma` for design context
- `Playwright` for browser verification

## How to use

1. Copy `.codex/` from this folder into the root of the app project you want Codex to open.
2. Restart Codex in that app root.
3. Login to `Linear`, `Notion`, `Figma`, and `Playwright` as prompted.

## Included

- `config.toml` with 4 MCP servers
- portable `Playwright` wrapper using repo-local npm cache
- generic `app-delivery-orchestrator` skill
