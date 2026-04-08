---
name: n8n-workflow-automation
description: "Design and publish JSON workflows for n8n with triggers, error handling, and human-in-the-loop features."
---

# n8n Workflow Automation

Design and publish high-reliability JSON workflows for n8n.

## When to Use
- Automating critical processes that need transparency.
- Complex error handling and logging via Webhooks.
- Ensuring data idempotency (no duplicate processing).
- Need for "Kill-switch", rate limiting, or Slack/Discord notifications.

## Output Format
- Produces a JSON block ready for n8n import.
- Includes a Runbook (deployment plan).

## Usage Examples
- "Create an n8n workflow to sync Salesforce to Slack with retries."
- "Design a workflow to aggregate weekly compliance reports from Monday.com."
