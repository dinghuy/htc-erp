require('ts-node/register');

process.env.DB_PATH = 'C:/Users/dinghuy/OneDrive - HUYNH THY GROUP/Antigravity Workspace/crm-app/backend/tmp/test-crm.db';

const { initDb, getDb } = require('../sqlite-db');

(async () => {
  await initDb();
  const db = getDb();
  const testCompanyName = `Test Co ${Date.now()}`;
  await db.run("INSERT INTO Account (companyName) VALUES (?)", [testCompanyName]);

  // Re-init: should NOT drop tables or lose data
  await initDb();
  const row = await getDb().get("SELECT COUNT(*) as c FROM Account WHERE companyName=?", [testCompanyName]);

  if (!row || row.c !== 1) {
    throw new Error('Persistence check failed: row missing after re-init');
  }

  console.log('OK');
})();
