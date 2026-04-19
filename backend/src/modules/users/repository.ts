import { getDb } from '../../../sqlite-db';

const USER_ROUTE_SELECT = `
  SELECT id, fullName, gender, email, phone, role, department, status, username, systemRole, roleCodes,
         employeeCode, dateOfBirth, avatar, address, startDate, lastLoginAt, accountStatus,
         mustChangePassword, language
  FROM User
`;

export type UserRouteRecord = {
  id: string;
  fullName: string;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  department?: string | null;
  status?: string | null;
  username?: string | null;
  systemRole?: string | null;
  roleCodes?: string | null;
  employeeCode?: string | null;
  dateOfBirth?: string | null;
  avatar?: string | null;
  address?: string | null;
  startDate?: string | null;
  lastLoginAt?: string | null;
  accountStatus?: string | null;
  mustChangePassword?: number | boolean | null;
  language?: string | null;
};

type CreateUsersRepositoryDeps = {
  getDb?: () => any;
};

type CreateUserRecordInput = {
  id: string;
  fullName: unknown;
  gender: string | null;
  email: unknown;
  phone: unknown;
  role: unknown;
  department: unknown;
  status: unknown;
  username: string | null;
  passwordHash: string | null;
  systemRole: string;
  roleCodesJson: string;
  employeeCode: string | null;
  dateOfBirth: string | null;
  avatar: string | null;
  address: string | null;
  startDate: string | null;
  accountStatus: unknown;
  mustChangePassword: number;
  language: string;
};

type UpdateUserRecordInput = {
  fullName: unknown;
  gender: string | null;
  email: unknown;
  phone: unknown;
  role: unknown;
  department: unknown;
  status: unknown;
  username: string | null;
  passwordHash: string | null;
  systemRole: string;
  roleCodesJson: string;
  employeeCode: string | null;
  dateOfBirth: string | null;
  address: string | null;
  startDate: string | null;
  accountStatus: unknown;
  mustChangePassword: number | undefined;
  language: string | null;
};

type CreateImportedUserInput = {
  fullName: string;
  gender: string | null;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: string;
  username: string | null;
  passwordHash: string | null;
  systemRole: string;
  employeeCode: string | null;
  accountStatus: string;
  mustChangePassword: number;
};

type UserRoleNormalizationRecord = {
  id: string;
  systemRole: string;
  roleCodes: string | null;
};

export type UserDirectoryRecord = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  systemRole?: string | null;
  department?: string | null;
  employeeCode?: string | null;
  role?: string | null;
  status?: string | null;
  avatar?: string | null;
  lastLoginAt?: string | null;
};

const USER_DIRECTORY_SELECT = `
  SELECT id, fullName, email, phone, username, systemRole, department, employeeCode, role, status, avatar, lastLoginAt
  FROM User
`;

export function createUsersRepository(deps: CreateUsersRepositoryDeps = {}) {
  const getDbInstance = deps.getDb ?? getDb;

  function listUsers() {
    return getDbInstance().all(`${USER_ROUTE_SELECT} ORDER BY fullName`) as Promise<UserRouteRecord[]>;
  }

  function findUserById(id: string) {
    return getDbInstance().get(`${USER_ROUTE_SELECT} WHERE id = ?`, [id]) as Promise<UserRouteRecord | undefined>;
  }

  function listUserDirectory() {
    return getDbInstance().all(`${USER_DIRECTORY_SELECT} ORDER BY fullName`) as Promise<UserDirectoryRecord[]>;
  }

  function findUserDirectoryById(id: string) {
    return getDbInstance().get(`${USER_DIRECTORY_SELECT} WHERE id = ?`, [id]) as Promise<UserDirectoryRecord | undefined>;
  }

  function findUsersDirectoryByIds(ids: string[]) {
    if (ids.length === 0) {
      return Promise.resolve([] as UserDirectoryRecord[]);
    }
    const placeholders = ids.map(() => '?').join(', ');
    return getDbInstance().all(`${USER_DIRECTORY_SELECT} WHERE id IN (${placeholders}) ORDER BY fullName`, ids) as Promise<UserDirectoryRecord[]>;
  }

  function findUserPasswordHashById(id: string) {
    return getDbInstance().get('SELECT passwordHash FROM User WHERE id = ?', [id]) as Promise<{ passwordHash?: string | null } | undefined>;
  }

  function findUserIdentityById(id: string) {
    return getDbInstance().get('SELECT id FROM User WHERE id = ?', [id]) as Promise<{ id: string } | undefined>;
  }

  function createUser(input: CreateUserRecordInput) {
    return getDbInstance().run(
      `INSERT INTO User (
        id, fullName, gender, email, phone, role, department, status, username, passwordHash,
        systemRole, roleCodes, employeeCode, dateOfBirth, avatar, address, startDate,
        accountStatus, mustChangePassword, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.fullName,
        input.gender,
        input.email,
        input.phone,
        input.role,
        input.department,
        input.status,
        input.username,
        input.passwordHash,
        input.systemRole,
        input.roleCodesJson,
        input.employeeCode,
        input.dateOfBirth,
        input.avatar,
        input.address,
        input.startDate,
        input.accountStatus,
        input.mustChangePassword,
        input.language,
      ],
    );
  }

  function updateUser(id: string, input: UpdateUserRecordInput) {
    return getDbInstance().run(
      `UPDATE User SET fullName=?, gender=?, email=?, phone=?, role=?, department=?, status=?, username=?, passwordHash=?, systemRole=?, roleCodes=?,
        employeeCode=?, dateOfBirth=?, address=?, startDate=?, accountStatus=?, mustChangePassword=?, language=COALESCE(?, language) WHERE id=?`,
      [
        input.fullName,
        input.gender,
        input.email,
        input.phone,
        input.role,
        input.department,
        input.status,
        input.username,
        input.passwordHash,
        input.systemRole,
        input.roleCodesJson,
        input.employeeCode,
        input.dateOfBirth,
        input.address,
        input.startDate,
        input.accountStatus,
        input.mustChangePassword,
        input.language,
        id,
      ],
    );
  }

  function deleteUser(id: string) {
    return getDbInstance().run('DELETE FROM User WHERE id = ?', [id]);
  }

  function updateUserAvatar(id: string, avatar: string) {
    return getDbInstance().run('UPDATE User SET avatar = ? WHERE id = ?', [avatar, id]);
  }

  function updateUserAccountStatus(id: string, accountStatus: string) {
    return getDbInstance().run('UPDATE User SET accountStatus = ? WHERE id = ?', [accountStatus, id]);
  }

  function createImportedUser(input: CreateImportedUserInput) {
    return getDbInstance().run(
      `INSERT INTO User (
        fullName, gender, email, phone, role, department, status,
        username, passwordHash, systemRole, employeeCode, accountStatus, mustChangePassword
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.fullName,
        input.gender,
        input.email,
        input.phone,
        input.role,
        input.department,
        input.status,
        input.username,
        input.passwordHash,
        input.systemRole,
        input.employeeCode,
        input.accountStatus,
        input.mustChangePassword,
      ],
    );
  }

  function listUsersForProjectManagerNormalization() {
    return getDbInstance().all(
      'SELECT id, systemRole, roleCodes FROM User ORDER BY fullName',
    ) as Promise<UserRoleNormalizationRecord[]>;
  }

  function updateUserRoleAssignments(id: string, roleCodesJson: string, systemRole: string) {
    return getDbInstance().run('UPDATE User SET roleCodes = ?, systemRole = ? WHERE id = ?', [
      roleCodesJson,
      systemRole,
      id,
    ]);
  }

  return {
    listUsers,
    findUserById,
    listUserDirectory,
    findUserDirectoryById,
    findUsersDirectoryByIds,
    findUserPasswordHashById,
    findUserIdentityById,
    createUser,
    updateUser,
    deleteUser,
    updateUserAvatar,
    updateUserAccountStatus,
    createImportedUser,
    listUsersForProjectManagerNormalization,
    updateUserRoleAssignments,
  };
}

export const usersRepository = createUsersRepository();
