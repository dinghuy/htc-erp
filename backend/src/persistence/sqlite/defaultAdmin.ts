import bcrypt from 'bcryptjs';

type DefaultAdminDeps = {
  createId: () => number;
  username?: string;
  password?: string;
};

export async function ensureDefaultAdmin(db: { get: (sql: string, params?: any[]) => Promise<any>; run: (sql: string, params?: any[]) => Promise<any> }, deps: DefaultAdminDeps) {
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
  console.log(`✅ Bootstrap admin user created for ${username}. Rotate the bootstrap password after first login.`);
  return true;
}
