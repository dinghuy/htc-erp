require('ts-node/register');

const fs = require('node:fs');
const path = require('node:path');

const QA_BOOTSTRAP_SECRET = process.env.QA_BOOTSTRAP_SECRET || 'ux-seed-local-only';
const BACKEND_URL = process.env.QA_BACKEND_URL || `http://127.0.0.1:${process.env.PORT || '3001'}`;

async function request(pathname, options = {}) {
  const response = await fetch(`${BACKEND_URL}${pathname}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

function assertOk(result, message) {
  if (!result.response.ok) {
    throw new Error(`${message}: ${JSON.stringify(result.body)}`);
  }
}

async function main() {
  const outputDir = path.resolve(__dirname, '..', '..', 'tmp', 'uat-users');
  fs.mkdirSync(outputDir, { recursive: true });

  const bootstrap = await request('/api/qa/bootstrap-ux-seed', {
    method: 'POST',
    headers: {
      'x-qa-bootstrap': QA_BOOTSTRAP_SECRET,
    },
  });
  assertOk(bootstrap, 'QA bootstrap failed');

  const adminUsername = bootstrap.body.contract.admin.username;
  const adminPassword = bootstrap.body.contract.admin.password;

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  });
  assertOk(login, 'Admin login failed');
  const token = login.body.token;

  const usersList = await request('/api/users', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assertOk(usersList, 'Users list failed');

  const uniqueUsername = `uat.user.${Date.now()}`;
  const create = await request('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fullName: 'UAT Script User',
      role: 'Sales Executive',
      email: 'uat.script@example.com',
      username: uniqueUsername,
      password: 'Script@123',
      systemRole: 'sales',
    }),
  });
  assertOk(create, 'Create user failed');

  const duplicate = await request('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fullName: 'UAT Duplicate User',
      role: 'Sales Executive',
      email: 'uat.script.duplicate@example.com',
      username: uniqueUsername,
      password: 'Script@123',
      systemRole: 'sales',
    }),
  });

  const importCsv = [
    'fullName,role,username,email,password',
    `Import Script User,Sales Executive,${uniqueUsername},import.script@example.com,Script@123`,
  ].join('\n');
  const importForm = new FormData();
  importForm.append('file', new Blob([importCsv], { type: 'text/csv' }), 'users-import.csv');
  const importAttempt = await request('/api/users/import', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: importForm,
  });
  assertOk(importAttempt, 'Import attempt failed');

  const oversizedAvatarPath = path.join(outputDir, 'oversized-avatar.jpg');
  fs.writeFileSync(oversizedAvatarPath, Buffer.alloc(2 * 1024 * 1024 + 4096, 1));
  const avatarForm = new FormData();
  avatarForm.append('avatar', new Blob([fs.readFileSync(oversizedAvatarPath)], { type: 'image/jpeg' }), 'oversized-avatar.jpg');
  const avatarTooLarge = await request(`/api/users/${create.body.id}/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: avatarForm,
  });

  const forgot = await request('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: uniqueUsername }),
  });
  assertOk(forgot, 'Forgot-password request failed');

  let reset = null;
  if (forgot.body.debugResetToken) {
    reset = await request('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: forgot.body.debugResetToken,
        newPassword: 'Script@456',
      }),
    });
  }

  const summary = {
    backendUrl: BACKEND_URL,
    bootstrapAdmin: adminUsername,
    usersCount: Array.isArray(usersList.body) ? usersList.body.length : null,
    create: {
      status: create.response.status,
      userId: create.body.id,
      username: create.body.username,
    },
    duplicate: {
      status: duplicate.response.status,
      body: duplicate.body,
    },
    importAttempt: {
      status: importAttempt.response.status,
      errors: importAttempt.body.errors,
      firstRow: importAttempt.body.rows?.[0] || null,
    },
    avatarTooLarge: {
      status: avatarTooLarge.response.status,
      body: avatarTooLarge.body,
    },
    forgot: {
      status: forgot.response.status,
      hasDebugResetToken: !!forgot.body.debugResetToken,
    },
    reset: reset
      ? {
          status: reset.response.status,
          body: reset.body,
        }
      : null,
  };

  const outputPath = path.join(outputDir, 'users-admin-flow-summary.json');
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: true, outputPath, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
