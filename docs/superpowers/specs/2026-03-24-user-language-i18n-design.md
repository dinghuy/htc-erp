# User Language And Full-App I18n Design

## Goal

Add a per-user language setting with two options, `vi` and `en`, and make the entire app switch language immediately after the user changes the setting.

## Scope

This work covers:
- backend persistence for user language
- auth/session payload updates
- frontend i18n infrastructure
- settings UI for language selection
- UI copy cleanup for concise Vietnamese and English equivalents across the app

This work does not cover:
- date, number, or currency locale formatting changes beyond existing behavior
- third language support
- PDF template translation logic beyond UI text already rendered by the app

## Current State

- The frontend stores the logged-in user in local storage via `saveSession()` in `frontend/src/auth.ts`.
- The app root in `frontend/src/app.tsx` owns global session state and route state.
- UI text is hardcoded across many `.tsx` files.
- System settings already exist, but the requested language preference must be stored per user, not globally.
- The backend `User` table already stores identity and account fields and is the correct place to persist language.

## Requirements

### Functional

1. Add a user language preference with values `vi` and `en`.
2. Persist language per user in the backend database.
3. Include language in login/session payloads so the frontend can initialize immediately.
4. Add a language control in `Settings`.
5. Changing language must update the UI immediately without reload or re-login.
6. The app must support both Vietnamese and English across the full UI.
7. Vietnamese copy should be shortened and normalized where it is currently verbose or inconsistent.

### UX

1. Default language is `vi` for existing users and new users.
2. Settings should show a clear language choice: `Tiếng Việt` and `English`.
3. Success and error notifications related to language change should respect the current UI language after the switch.
4. Existing layout and interaction patterns should be preserved.

### Data

1. Existing users without a language value should resolve to `vi`.
2. New users should be created with `language = 'vi'` unless explicitly provided.
3. User CRUD endpoints should read and write the language field safely.

## Architecture

## Backend

- Extend the `User` table with `language TEXT DEFAULT 'vi'`.
- Ensure migration-style bootstrap code adds the column for existing databases.
- Include `language` in:
  - login response
  - password-change response user payload
  - user list/detail endpoints
  - create/update user endpoints
- Add a self-service endpoint for the current authenticated user, for example:
  - `PATCH /api/me/preferences`
- The endpoint accepts `{ language: 'vi' | 'en' }`.
- It validates the language value, updates only the current user, and returns the updated user payload.

## Frontend

- Add `language?: 'vi' | 'en'` to `CurrentUser`.
- Create a centralized i18n module with:
  - locale type
  - message dictionaries for `vi` and `en`
  - `t(key, params?)` helper
- The app root owns the active locale state.
- On login and session restore, locale initializes from `currentUser.language || 'vi'`.
- The locale API is passed through the app tree using props or a lightweight context.
- When language changes in `Settings`:
  - call backend preference endpoint
  - update `currentUser.language`
  - persist with `saveSession()`
  - update root locale state immediately
- All visible app text should read from the dictionary instead of hardcoded strings.

## Translation Strategy

- Use key-based translation instead of inline conditional text.
- Normalize Vietnamese first, then define English equivalents.
- Prefer concise business UI copy.
- Keep internal route ids and business data values unchanged unless they are display labels.

## Screens And Areas To Cover

- `Layout`
- `Login`
- `ForceChangePassword`
- `Dashboard`
- `Leads`
- `Customers`
- `Products`
- `Suppliers`
- `Quotations`
- `Reports`
- `Projects`
- `Tasks`
- `SalesOrders`
- `Users`
- `Settings`
- `Support`
- `EventLog`
- shared notifications and common labels where applicable

## Settings UI

- Add language selection under the display/settings area.
- Use a compact control that matches the existing inline style patterns.
- Show both labels clearly:
  - `Tiếng Việt`
  - `English`
- Saving should happen explicitly with the existing settings action or immediately for the user preference if that fits the existing screen better, but the UI language must switch as soon as the backend confirms success.

## Error Handling

- If the preference update fails, keep the previous language active.
- Show an error notification in the current language.
- Reject invalid language values on the backend with `400`.
- Fallback to `vi` if frontend receives an unknown language value.

## Implementation Notes

- Do not tie user language to `SystemSetting`.
- Keep the i18n layer small and local to this app.
- Avoid large refactors unrelated to text and user preference persistence.
- Where text is built dynamically, translate the fixed parts and keep variables interpolated.

## Acceptance Criteria

1. A user can choose `Tiếng Việt` or `English` in `Settings`.
2. The selected language is stored on that user record.
3. After saving, the app UI switches language immediately without reload.
4. Refreshing the page preserves the chosen language via session restore.
5. Existing users default safely to Vietnamese.
6. Core UI copy across all app screens is translated in both languages.
7. Vietnamese UI text is shorter and more consistent than before.
