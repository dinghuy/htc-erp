---
name: crm-delivery-orchestrator
description: Use for the Huynh Thy CRM App when requests involve issue delivery, specs, PRDs, release/UAT updates, design-to-code, or browser verification across Linear, Notion, Figma, and Playwright.
---

# CRM Delivery Orchestrator

Use this skill for project delivery work in `crm-app` that spans planning, design, implementation context, and UI verification.

Read these only when needed:
- `references/server-map.md` for source-of-truth and server precedence
- `references/prompt-patterns.md` for common workflows and trigger examples
- `references/security.md` for guardrails and production safety

## Trigger Cues

Activate when the request mentions any of:
- issue, task, PRD, spec, plan, release, UAT, handoff
- Linear, Notion, Figma, Playwright
- sync task, implement from spec, verify UI
- URLs or identifiers from those tools

Do not activate for pure internal code edits with no external context need.

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

- Default project is `crm-app`.
- Treat `Notion` and `Linear` as the primary PM/docs stack for this project.
- Keep human approval enabled for any write-capable MCP action.
