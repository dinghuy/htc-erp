# Environment Strategy

## Environments

- `local`: developer machine, SQLite allowed, mock or manual integration checks
- `dev`: shared engineering environment for feature integration
- `uat`: business validation environment, production-like settings, PostgreSQL target
- `prod`: controlled production environment

## Rules

- Local development may use SQLite for speed.
- UAT and production should converge on PostgreSQL.
- Environment-specific values must come from environment variables, never hardcoded in code.
- Secrets must not be committed to the repository.

## Promotion Path

1. Local verification
2. Dev integration
3. UAT sign-off
4. Production release
