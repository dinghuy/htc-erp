---
name: app-delivery-orchestrator
description: Use when app work spans issue context, product/spec docs, Figma design context, and browser verification across Linear, Notion, Figma, and Playwright.
---

# App Delivery Orchestrator

Use this skill for any app work in this repo when the task spans planning, design, implementation context, and UI verification.

Read these only when needed:
- `references/server-map.md`
- `references/prompt-patterns.md`
- `references/security.md`

## Trigger Cues

Activate when the request mentions any of:
- issue, task, roadmap, PRD, spec, acceptance, UAT, release, handoff
- Linear, Notion, Figma, Playwright
- implement from spec, implement from design, verify UI
- URLs or identifiers from those tools

Do not activate for pure internal code edits that do not need external context.

## Workflow

1. Identify whether the user needs issue context, requirements, design context, or browser verification.
2. Pull only the MCP context required for the current step.
3. Respect precedence from `references/server-map.md`.
4. Synthesize the work before editing code.
5. If auth is missing, stop and name the login needed.

## Server Order

- `Linear` for issue state and execution tracking
- `Notion` for product docs, specs, and acceptance criteria
- `Figma` for design source
- `Playwright` for browser reproduction and UI verification

## Guardrails

- Do not write back to external tools unless the user explicitly asks.
- If `Linear` and `Notion` both exist, use `Linear` for workflow state and `Notion` for requirements.
- If a `Figma` link exists, inspect it before proposing UI changes.
- If runtime behavior is in question, use `Playwright` instead of guessing.
