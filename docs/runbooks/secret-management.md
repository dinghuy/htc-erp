# Secret Management

## Scope

- JWT secret
- ERP credentials
- AI provider API keys
- Database connection strings

## Rules

- Keep secrets only in environment-specific secret stores or local `.env` files outside version control.
- Never embed secrets in code, tests, seed data, or docs.
- Rotate secrets when team membership changes or exposure is suspected.
- Use separate credentials per environment.
