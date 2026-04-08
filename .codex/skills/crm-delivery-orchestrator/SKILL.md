---
name: crm-delivery-orchestrator
description: Use only when handling legacy crm-app references or migrating old delivery workflows that still mention crm-app, Linear, Notion, Figma, or Playwright.
---

# Legacy CRM Delivery Orchestrator

This is a compatibility skill for historical `crm-app` references.

Do not use this as the default delivery entrypoint for `htc-erp`. Use `app-delivery-orchestrator` instead for active project work.

Read these only when needed:
- `references/server-map.md` for source-of-truth and server precedence
- `references/prompt-patterns.md` for common workflows and trigger examples
- `references/security.md` for guardrails and production safety

## Trigger Cues

Activate when the request mentions any of:
- migrating or auditing historical `crm-app` skill usage
- issue, task, PRD, spec, plan, release, UAT, handoff
- Linear, Notion, Figma, Playwright
- sync task, implement from spec, verify UI
- URLs or identifiers from those tools

Do not activate for normal `htc-erp` delivery work or for pure internal code edits with no external context need.

## Workflow

1. Identify the delivery artifact the user actually wants:
   - task context
   - spec or acceptance criteria
   - design context
   - browser verification
2. Pull context from the minimum required MCP servers only.
3. Respect source-of-truth precedence from `references/server-map.md`.
4. Synthesize a bounded implementation or review task before writing code.
5. If auth is missing, stop and tell the user which MCP login is needed.

## Migration Rule

- If the request is for active `htc-erp` work, redirect to `app-delivery-orchestrator`.
- Use this skill only to interpret or clean up historical `crm-app` references, prompts, or legacy docs.

## Server Order

- `Linear` for issue status and work tracking
- `Notion` for specs, plans, reports, and meeting records
- `Figma` for design source
- `Playwright` for browser reproduction and UI verification

## Required Behavior

- If both `Linear` and `Notion` are present, use `Linear` for task state and `Notion` for acceptance criteria.
- If a `Figma` link exists, fetch design context before proposing UI changes.
- If browser behavior is in question, use `Playwright` instead of guessing.

## Fallbacks

- Missing auth: name the server and the login action needed, then stop.
- Missing Figma link: ask for the specific file or node link; do not infer design.
- Read-only request: do not write back to Linear or Notion unless the user explicitly asks.

## Project Guardrails

- Historical project context is `crm-app`.
- Active project context is not `crm-app`; redirect active work to `app-delivery-orchestrator`.
- Keep human approval enabled for any write-capable MCP action.
