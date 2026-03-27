# ADR-0001: Adopt Modular Monolith On Current Stack

## Status

Accepted

## Context

The current CRM codebase is functional but still shaped like an MVP. Core logic is concentrated in oversized files, which makes AI-generated changes risky and hard to verify.

## Decision

Keep the current frontend and backend stack, but restructure both sides into bounded modules under a modular monolith architecture.

## Consequences

- We avoid a costly rewrite.
- We gain clearer ownership boundaries for future AI tasks.
- We can move gradually toward stronger contracts, migrations, and ERP reliability.
- We must tolerate an intermediate period where new modules coexist with legacy files.
