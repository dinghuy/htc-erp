---
name: self-improving-agent
description: "Records lessons, errors, and user feedback to continuously improve AI performance."
---

# Self-Improving Agent

Record and promote learnings to improve AI agent performance over time.

## Directory Structure
- `.learnings/ERRORS.md`: Failed commands or API errors.
- `.learnings/LEARNINGS.md`: User-provided corrections and tips.
- `.learnings/FEATURE_REQUESTS.md`: Missing features or tools.

## Workflow
1. **Detect**: Recognize errors or user feedback.
2. **Log**: Automatically add entries to `.learnings/` files with metadata.
3. **Promote**: Suggest move recurring learnings to `CLAUDE.md`, `AGENTS.md`, or project instructions.
4. **Review**: Periodically analyze logs for patterns and systemic fixes.

## Compatibility
Works with Claude Code, OpenClaw, and GitHub Copilot.
