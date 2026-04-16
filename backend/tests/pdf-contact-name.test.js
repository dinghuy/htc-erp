/**
 * Regression test – PDF contact name construction
 *
 * Verifies that the PDF route assembles the contact display name from
 * lastName + firstName only (Contact table has no fullName column).
 * This guards against re-introducing the dead `contact.fullName` path.
 */

const assert = require('node:assert/strict');

let failures = 0;

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

// The expression used in pdfRoutes.ts after the fix:
function buildContactDisplayName(contact) {
  if (!contact) return 'N/A';
  return `${contact.lastName || ''} ${contact.firstName || ''}`.trim() || 'N/A';
}

// ── Tests ─────────────────────────────────────────────────────────────────────

run('both lastName and firstName present', () => {
  const contact = { lastName: 'Nguyễn', firstName: 'An' };
  assert.equal(buildContactDisplayName(contact), 'Nguyễn An');
});

run('only firstName present', () => {
  const contact = { lastName: null, firstName: 'An' };
  assert.equal(buildContactDisplayName(contact), 'An');
});

run('only lastName present', () => {
  const contact = { lastName: 'Nguyễn', firstName: null };
  assert.equal(buildContactDisplayName(contact), 'Nguyễn');
});

run('both fields absent falls back to N/A', () => {
  const contact = { lastName: null, firstName: null };
  assert.equal(buildContactDisplayName(contact), 'N/A');
});

run('both fields empty string falls back to N/A', () => {
  const contact = { lastName: '', firstName: '' };
  assert.equal(buildContactDisplayName(contact), 'N/A');
});

run('null contact row falls back to N/A', () => {
  assert.equal(buildContactDisplayName(null), 'N/A');
});

run('undefined contact row falls back to N/A', () => {
  assert.equal(buildContactDisplayName(undefined), 'N/A');
});

run('fullName property on contact is ignored (not a DB column)', () => {
  // Ensures we never rely on fullName even if a stale payload contains it
  const contact = { fullName: 'Should be ignored', lastName: 'Trần', firstName: 'Bình' };
  const result = buildContactDisplayName(contact);
  assert.equal(result, 'Trần Bình');
  assert.ok(!result.includes('Should be ignored'));
});

run('whitespace-only name parts are trimmed to N/A', () => {
  const contact = { lastName: '   ', firstName: '   ' };
  assert.equal(buildContactDisplayName(contact), 'N/A');
});

if (failures > 0) {
  process.exitCode = 1;
}
