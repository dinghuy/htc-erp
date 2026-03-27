const assert = require('node:assert/strict');

const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const vnDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function fail(message) {
  throw new Error(message);
}

function toDate(value) {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}

function getVnDate(date) {
  const parts = vnDateFormatter.formatToParts(toDate(date));
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  if (!map.year || !map.month || !map.day) {
    fail(`Unable to format VN date for value: ${date}`);
  }

  return `${map.year}-${map.month}-${map.day}`;
}

function hasRateIncreaseWarning(latestRate, qbuRateValue) {
  return latestRate >= qbuRateValue * 1.025;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addCalendarMonths(vnDate, months) {
  const [yearText, monthText, dayText] = vnDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    fail(`Invalid VN date: ${vnDate}`);
  }

  const totalMonths = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));

  return [
    String(nextYear).padStart(4, '0'),
    String(nextMonth).padStart(2, '0'),
    String(nextDay).padStart(2, '0'),
  ].join('-');
}

function hasQbuStaleWarning(qbuUpdatedAtIso, nowIso) {
  const qbuVnDate = getVnDate(qbuUpdatedAtIso);
  const nowVnDate = getVnDate(nowIso);
  const staleThreshold = addCalendarMonths(qbuVnDate, 6);
  return nowVnDate >= staleThreshold;
}

function runTests() {
  assert.equal(hasRateIncreaseWarning(102.5, 100), true, '102.5/100 should warn');
  assert.equal(hasRateIncreaseWarning(102.4, 100), false, '102.4/100 should not warn');

  assert.equal(
    hasQbuStaleWarning('2025-01-01T00:00:00+07:00', '2025-07-01T00:00:00+07:00'),
    true,
    '6-month boundary should warn on 2025-07-01 VN time'
  );
  assert.equal(
    hasQbuStaleWarning('2025-01-01T00:00:00+07:00', '2025-06-30T23:59:59+07:00'),
    false,
    '6-month boundary should not warn on 2025-06-30 VN time'
  );
}

try {
  runTests();
  console.log('OK');
} catch (err) {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
}

