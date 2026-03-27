# Backup And Rollback

## Backup Policy

- Database backup before any schema-affecting deployment
- Daily scheduled backups for persistent environments
- Retention policy must be defined per environment owner
- Restore drills should be run on a non-production environment

## Rollback Rules

- Every schema change must include a rollback note
- Every ERP integration change must document failure containment behavior
- Do not deploy multiple unrelated database changes in one release unit

## Minimum Rollback Checklist

1. Identify release version and affected modules
2. Confirm backup exists and is restorable
3. Disable or pause affected sync jobs if required
4. Revert application version
5. Restore database only if forward compatibility is not possible
6. Re-run smoke checks
