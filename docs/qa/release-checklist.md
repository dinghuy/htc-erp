# Release Checklist

## Engineering

- [ ] Backend gate passes: `pnpm --dir backend typecheck && pnpm --dir backend build && pnpm --dir backend test:core`
- [ ] Frontend gate passes: `pnpm --dir frontend sync:contracts && pnpm --dir frontend typecheck && pnpm --dir frontend build && pnpm --dir frontend test:core`

## Data / Integration

- [ ] Migration impact reviewed
- [ ] Backup/rollback note attached
- [ ] ERP side effects reviewed
- [ ] Outbox behavior validated if touched

## Product / QA

- [ ] Relevant UAT checklist updated
- [ ] Scope limited to the approved task/spec
- [ ] No unrelated runtime artifacts appear in Git diff
- [ ] Active docs route through `docs/index.md`
- [ ] Active docs do not depend on stale repo paths or ambiguous historical plans
