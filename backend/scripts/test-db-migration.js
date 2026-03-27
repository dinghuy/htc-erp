const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

(async () => {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'crm.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  try {
    const table = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='ExchangeRate'");
    if (!table) throw new Error('Missing ExchangeRate table');

    const indexes = await db.all("PRAGMA index_list('ExchangeRate')");
    const idx = indexes.find(i => i.name === 'idx_exrate_pair_date');
    if (!idx) throw new Error('Missing ExchangeRate index: idx_exrate_pair_date');

    const idxCols = await db.all("PRAGMA index_info('idx_exrate_pair_date')");
    const idxNames = idxCols.map(c => c.name);
    const expectedIdxCols = ['baseCurrency', 'quoteCurrency', 'effectiveDate'];
    expectedIdxCols.forEach((n, i) => {
      if (idxNames[i] !== n) {
        throw new Error(`ExchangeRate index column mismatch at position ${i + 1}: expected ${n}, got ${idxNames[i] || 'undefined'}`);
      }
    });

    const productTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='Product'");
    if (!productTable) throw new Error('Missing Product table');

    const cols = await db.all("PRAGMA table_info('Product')");
    const names = cols.map(c => c.name);
    ['qbuRateSource','qbuRateDate','qbuRateValue'].forEach(n => {
      if (!names.includes(n)) throw new Error('Missing column: ' + n);
    });

    const settingsTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='SystemSetting'");
    if (!settingsTable) throw new Error('Missing SystemSetting table');

    const settings = await db.all('SELECT key FROM SystemSetting');
    const hasVcb = settings.some(s => s.key === 'vcb_rate_url');
    if (!hasVcb) throw new Error('Missing SystemSetting: vcb_rate_url');

    console.log('OK');
  } finally {
    await db.close();
  }
})();
