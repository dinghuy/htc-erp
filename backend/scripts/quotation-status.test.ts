import assert from 'node:assert/strict';
import { computeIsRemind, validateUpdate, VALID_STATUSES, allowedTransitions } from '../quotation-status';

const now = Date.parse('2026-03-23T00:00:00.000Z');

// Remind logic
assert.equal(
  computeIsRemind('sent', '2026-03-09T00:00:00.000Z', now),
  true,
  'exactly 14 days should remind'
);
assert.equal(
  computeIsRemind('sent', '2026-03-10T00:00:01.000Z', now),
  false,
  'less than 14 days should not remind'
);
assert.equal(
  computeIsRemind('draft', '2026-03-01T00:00:00.000Z', now),
  false,
  'non-sent should not remind'
);
assert.equal(
  computeIsRemind('sent', 'invalid-date', now),
  false,
  'invalid createdAt should not remind'
);
assert.equal(
  computeIsRemind('sent', '2026-04-01T00:00:00.000Z', now),
  false,
  'future createdAt should not remind'
);

// Status validation
const ok1 = validateUpdate({ currentStatus: 'draft', nextStatus: 'sent' });
assert.equal(ok1.ok, true);

const bad1 = validateUpdate({ currentStatus: 'draft', nextStatus: 'accepted' });
assert.equal(bad1.ok, false);
assert.equal(bad1.code, 'INVALID_STATUS_TRANSITION');

const ok2 = validateUpdate({ currentStatus: 'sent', nextStatus: 'accepted' });
assert.equal(ok2.ok, true);

const ro1 = validateUpdate({ currentStatus: 'accepted', nextStatus: 'sent' });
assert.equal(ro1.ok, false);
assert.equal(ro1.code, 'READ_ONLY');

const legacy = validateUpdate({ currentStatus: 'archived', nextStatus: 'sent' });
assert.equal(legacy.ok, false);
assert.equal(legacy.code, 'READ_ONLY');

const conflict = validateUpdate({ currentStatus: 'sent', nextStatus: 'accepted', expectedStatus: 'draft' });
assert.equal(conflict.ok, false);
assert.equal(conflict.code, 'STATUS_CONFLICT');

const noStatus = validateUpdate({ currentStatus: 'sent', hasStatusField: false });
assert.equal(noStatus.ok, true);

// Allowed transitions list
assert.deepEqual(allowedTransitions('draft'), ['sent']);
assert.deepEqual(allowedTransitions('sent'), ['accepted', 'rejected']);

console.log('quotation-status tests passed');
