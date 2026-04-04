import { getDb } from '../../../sqlite-db';

export type UserRecord = {
  id: string;
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

export function createAuthRepository() {
  return {
    findUserByUsername(username: string) {
      return getDb().get<UserRecord>('SELECT * FROM User WHERE username = ?', [username]);
    },

    findUserById(id: string) {
      return getDb().get<UserRecord>('SELECT * FROM User WHERE id = ?', [id]);
    },

    touchLastLoginAt(id: string) {
      return getDb().run("UPDATE User SET lastLoginAt = datetime('now') WHERE id = ?", [id]);
    },

    findAuthenticatedUserProfileById(id: string) {
      return getDb().get<UserRecord>(
        'SELECT id, username, fullName, systemRole, roleCodes, email, gender, role, department, language FROM User WHERE id = ?',
        [id],
      );
    },

    updateLanguagePreference(id: string, language: string) {
      return getDb().run('UPDATE User SET language = ? WHERE id = ?', [language, id]);
    },

    findSessionUserById(id: string) {
      return getDb().get<UserRecord>(
        'SELECT id, username, fullName, systemRole, roleCodes, email, gender, role, department, accountStatus, mustChangePassword, language FROM User WHERE id = ?',
        [id],
      );
    },

    updatePasswordAndClearMustChange(id: string, passwordHash: string) {
      return getDb().run('UPDATE User SET passwordHash = ?, mustChangePassword = 0 WHERE id = ?', [passwordHash, id]);
    },
  };
}

export const authRepository = createAuthRepository();
