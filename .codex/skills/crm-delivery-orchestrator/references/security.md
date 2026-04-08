# Security Guardrails

## Core Rules

- Do not connect MCP tools to production data by default.
- Review every write-capable tool call before execution.

## Auth Failures

- If a server is configured but not authenticated, stop and name the exact login needed.
- Do not fake data from unavailable servers.

## Write Safety

- `Linear` and `Notion` writes are opt-in. Reading is the default.
- Do not update task status or page content unless the user asked for that mutation.
- Prefer drafting proposed content in chat before writing to PM/docs systems when the intent is ambiguous.

## Browser Safety

- Use `Playwright` to reproduce or verify behavior, not to perform hidden destructive actions.
- If a flow would mutate customer data, confirm scope and environment first.
