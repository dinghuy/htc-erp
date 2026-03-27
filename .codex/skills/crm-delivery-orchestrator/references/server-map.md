# Server Map

## Source Of Truth

| Need | Primary server | Why |
| --- | --- | --- |
| Issue status, assignee, workflow state | Linear | Ticket authority |
| PRD, spec, plan, release note draft, report | Notion | Documentation authority |
| UI design and tokens | Figma | Design authority |
| Browser behavior, repro, UI verification | Playwright | Runtime UI authority |

## Precedence Rules

1. If Linear and Notion disagree, treat Linear as task state and Notion as content/spec state.
2. If Figma and implementation differ, Figma wins for visual intent unless the user says the code is the new source.

## Minimal Server Selection

- Spec-only request: `Notion`
- Task sync request: `Linear`, optionally `Notion`
- Design-to-code: `Figma`, `Playwright`
- Release/update note: `Notion`, `Linear`

## Servers Deferred For Now

- `Atlassian`: not the chosen PM/docs stack
- `GitHub`: temporarily disabled from the active MCP set
- `Supabase`: temporarily disabled from the active MCP set
- `Box`: Notion already covers the knowledge layer for now
- `Sentry`: no current repo signal that it is active
