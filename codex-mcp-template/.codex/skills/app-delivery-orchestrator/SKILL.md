---
name: app-delivery-orchestrator
description: Use when app work spans issue context, product/spec docs, Figma design context, and browser verification across Linear, Notion, Figma, and Playwright.
---

# App Delivery Orchestrator

Use this skill for app delivery work that spans planning, design, implementation context, and UI verification.

Read these only when needed:
- `references/server-map.md`
- `references/prompt-patterns.md`
- `references/security.md`

## Trigger Cues

Activate when the request mentions:
- issue, task, roadmap, PRD, spec, acceptance, UAT, release, handoff
- Linear, Notion, Figma, Playwright
- implement from spec, implement from design, verify UI
- URLs or IDs from those systems

## Required Behavior

- Use `Linear` for issue state and execution tracking.
- Use `Notion` for specs and acceptance criteria.
- Use `Figma` for design source when a link is provided.
- Use `Playwright` for browser reproduction and verification.
- Keep external writes human-directed unless the user explicitly asks for mutation.
