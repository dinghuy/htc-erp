import { getDb } from '../../../sqlite-db';

export type UserRecord = {
  id: number;
  username: string;
  fullName: string;
  systemRole: string;
  roleCodes?: string | null;
  email: string;
  gender?: string | null;
  role?: string | null;
  department?: string | null;
  accountStatus?: string | null;
  mustChangePassword?: number | boolean | null;
  passwordHash?: string | null;
  language?: string | null;
};

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string | null;
};

export function createAuthRepository() {
  return {
    findUserByUsername(username: string) {
      return getDb().get<UserRecord>('SELECT * FROM User WHERE username = ?', [username]);
    },

    findUserByIdentifier(identifier: string) {
      return getDb().get<UserRecord>(
        `SELECT *
         FROM User
         WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))
            OR LOWER(TRIM(email)) = LOWER(TRIM(?))
         LIMIT 1`,
        [identifier, identifier],
      );
    },

    findUserById(id: number | string) {
      return getDb().get<UserRecord>('SELECT * FROM User WHERE id = ?', [id]);
    },

    touchLastLoginAt(id: number | string) {
      return getDb().run("UPDATE User SET lastLoginAt = datetime('now') WHERE id = ?", [id]);
    },

    findAuthenticatedUserProfileById(id: number | string) {
      return getDb().get<UserRecord>(
        'SELECT id, username, fullName, systemRole, roleCodes, email, gender, role, department, language FROM User WHERE id = ?',
        [id],
      );
    },

    updateLanguagePreference(id: number | string, language: string) {
      return getDb().run('UPDATE User SET language = ? WHERE id = ?', [language, id]);
    },

    findSessionUserById(id: number | string) {
      return getDb().get<UserRecord>(
        'SELECT id, username, fullName, systemRole, roleCodes, email, gender, role, department, accountStatus, mustChangePassword, language FROM User WHERE id = ?',
        [id],
      );
    },

    updatePasswordAndClearMustChange(id: number | string, passwordHash: string) {
      return getDb().run('UPDATE User SET passwordHash = ?, mustChangePassword = 0 WHERE id = ?', [passwordHash, id]);
    },

    createPasswordResetToken(input: { id: string; userId: string; tokenHash: string; expiresAt: string; requestedByIp?: string | null }) {
      return getDb().run(
        `INSERT INTO PasswordResetToken (id, userId, tokenHash, expiresAt, requestedByIp)
         VALUES (?, ?, ?, ?, ?)`,
        [input.id, input.userId, input.tokenHash, input.expiresAt, input.requestedByIp ?? null],
      );
    },

    findLatestPasswordResetTokenByHash(tokenHash: string) {
      return getDb().get<PasswordResetTokenRecord>(
        `SELECT id, userId, tokenHash, expiresAt, usedAt
         FROM PasswordResetToken
         WHERE tokenHash = ?
         ORDER BY createdAt DESC
         LIMIT 1`,
        [tokenHash],
      );
    },

    markPasswordResetTokenUsed(id: string) {
      return getDb().run(`UPDATE PasswordResetToken SET usedAt = datetime('now') WHERE id = ?`, [id]);
    },
  };
}

export const authRepository = createAuthRepository();
