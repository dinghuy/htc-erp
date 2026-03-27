# Release Gate

Do not mark a change ready for release when any of the following is missing:

- Short spec or task brief
- Test evidence
- UAT checklist coverage for user-facing flows
- Migration or rollback note when persistence changes
- ERP side-effect review when integration behavior changes
- CI hygiene gate pass (no tracked runtime/generated artifacts)
- Backend migration and DB initialization smoke pass when backend touched
