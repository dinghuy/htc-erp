# Test Database – Projects & Tasks

Seed script and operating instructions for the CRM Projects & Tasks test database.

---

## File locations

| File | Purpose |
|---|---|
| `scripts/seed-test-projects.ts` | Creates tables, inserts test users / projects / tasks |
| `tmp/test-crm.db` | SQLite test database (generated on first run, git-ignored) |

The production database `backend/crm.db` is **never touched** by any of these commands.

---

## 1. Run the seed script

From the `backend/` directory:

```bash
npx ts-node scripts/seed-test-projects.ts
```

The script is fully idempotent – all inserts use `INSERT OR IGNORE`, so running it multiple times is safe and will not create duplicate rows.

Expected output:

```
============================================================
HTG CRM – Test DB seed: Projects & Tasks
============================================================
Target DB : .../backend/tmp/test-crm.db

Tables verified / created.

------------------------------------------------------------
Seed summary
------------------------------------------------------------
Users    in DB : 5
Projects in DB : 5  (5 inserted this run)
Tasks    in DB : 15  (15 inserted this run)
------------------------------------------------------------
Done. Run the server with:
  DB_PATH=./tmp/test-crm.db npx ts-node server.ts
============================================================
```

---

## 2. Start the CRM backend pointing at the test database

```bash
DB_PATH=./tmp/test-crm.db npx ts-node server.ts
```

The `DB_PATH` environment variable is read in `sqlite-db.ts` (`initDb`).  When it is set, the server opens that file instead of the default `crm.db`.

You can also export it for the duration of a terminal session:

```bash
export DB_PATH=./tmp/test-crm.db
npx ts-node server.ts
```

On Windows (PowerShell):

```powershell
$env:DB_PATH = ".\tmp\test-crm.db"
npx ts-node server.ts
```

---

## 3. Reset / wipe the test database

Delete the file and re-run the seed script.  The script will create a fresh database.

```bash
# macOS / Linux / Git Bash
rm backend/tmp/test-crm.db
npx ts-node scripts/seed-test-projects.ts

# PowerShell
Remove-Item backend\tmp\test-crm.db
npx ts-node scripts/seed-test-projects.ts
```

---

## Seeded data overview

### Users (5)

| ID | Name | Role | systemRole |
|---|---|---|---|
| user-001 | Nguyen Van Hung | Sales Manager | manager |
| user-002 | Tran Thi Mai | Sales Executive | sales |
| user-003 | Le Minh Tuan | Ky su Ky thuat | sales |
| user-004 | Pham Thi Hoa | Ke toan | viewer |
| user-005 | Hoang Duc Nam | Truong phong Mua hang | manager |

### Projects (5)

| Code | Name | Status | Manager |
|---|---|---|---|
| PRJ-2026-001 | Cung cap xe dau keo Shacman cho Cang Da Nang | active | user-001 |
| PRJ-2025-012 | Bao tri thiet bi cang Tan Cang Sai Gon Q4/2025 | completed | user-003 |
| PRJ-2026-002 | Nhap khau phu tung Komatsu lo Q1/2026 | active | user-005 |
| PRJ-2026-003 | Trien khai he thong CRM noi bo HTG | active | user-001 |
| PRJ-2026-004 | Bao gia xe Volvo FH cho Cang Nam Hai | pending | user-002 |

### Tasks (15, 3 per project)

Each project has tasks spread across at least two different statuses
(`pending`, `active`, `completed`) and priority levels (`low`, `medium`,
`high`, `urgent`) to provide full UI coverage.

---

## Notes

- The test database is created under `backend/tmp/`.  Make sure `tmp/` is listed in `.gitignore` to avoid committing binary DB files.
- Passwords are **not** seeded for these test users.  If you need to log in, use the default `admin` account that `initDb()` creates automatically (`username: admin`, `password: admin123`).
- The seed script does **not** call `initDb()` from `sqlite-db.ts`.  It manages its own minimal schema so it remains independent of the main server boot sequence.
