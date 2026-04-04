import bcrypt from 'bcryptjs';

type DefaultAdminDeps = {
  createId: () => string;
};

export async function ensureDefaultAdmin(db: { get: (sql: string) => Promise<any>; run: (sql: string, params?: any[]) => Promise<any> }, deps: DefaultAdminDeps) {
  const adminExists = await db.get("SELECT id FROM User WHERE username = 'admin'");
  if (adminExists) {
    return false;
  }

  const hash = await bcrypt.hash('admin123', 10);
  await db.run(
    `INSERT INTO User (id, fullName, gender, email, phone, role, department, status, username, passwordHash, systemRole)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [deps.createId(), 'Administrator', 'male', 'admin@huynhthy.com', '', 'Administrator', 'IT', 'Active', 'admin', hash, 'admin']
  );
  console.log('✅ Default admin user created (username: admin, password: admin123)');
  return true;
}
