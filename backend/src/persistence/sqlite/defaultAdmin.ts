import bcrypt from 'bcryptjs';

type DefaultAdminDeps = {
  createId: () => number | string;
  username?: string;
  password?: string;
};

type DefaultAdminDb = {
  get: (sql: string, params?: any[]) => Promise<any>;
  run: (sql: string, params?: any[]) => Promise<any>;
  all?: (sql: string, params?: any[]) => Promise<any[]>;
};

export async function ensureDefaultAdmin(db: DefaultAdminDb, deps: DefaultAdminDeps) {
  const username = deps.username?.trim() || 'admin';
  const password = deps.password?.trim();

  if (!password) {
    return false;
  }

  const adminExists = await db.get('SELECT id FROM User WHERE username = ?', [username]);
  if (adminExists) {
    return false;
  }

  const hash = await bcrypt.hash(password, 10);
  const columns = typeof db.all === 'function'
    ? await db.all(`PRAGMA table_info('User')`)
    : [];
  const idColumn = columns.find((column: any) => column.name === 'id');
  const usesIntegerPrimaryKey = String(idColumn?.type || '').toUpperCase().includes('INT');

  if (usesIntegerPrimaryKey) {
    await db.run(
      `INSERT INTO User (
        fullName, gender, email, phone, role, department, status, username, passwordHash,
        systemRole, roleCodes, accountStatus, mustChangePassword, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Administrator',
        'male',
        'admin@huynhthy.com',
        '',
        'Administrator',
        'IT',
        'Active',
        username,
        hash,
        'admin',
        JSON.stringify(['admin']),
        'active',
        1,
        'vi',
      ]
    );
  } else {
    const id = String(deps.createId?.() ?? username).trim() || username;
    await db.run(
      `INSERT INTO User (
        id, fullName, gender, email, phone, role, department, status, username, passwordHash,
        systemRole, roleCodes, accountStatus, mustChangePassword, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        'Administrator',
        'male',
        'admin@huynhthy.com',
        '',
        'Administrator',
        'IT',
        'Active',
        username,
        hash,
        'admin',
        JSON.stringify(['admin']),
        'active',
        1,
        'vi',
      ]
    );
  }
  console.log(`✅ Bootstrap admin user created for ${username}. Rotate the bootstrap password after first login.`);
  return true;
}
