import { getDb } from '../../../sqlite-db';

const USER_ROUTE_SELECT = `
  SELECT id, fullName, gender, email, phone, role, department, status, username, systemRole, roleCodes,
         employeeCode, dateOfBirth, avatar, address, startDate, lastLoginAt, accountStatus,
         mustChangePassword, language
  FROM User
`;

export type UserRouteRecord = {
  id: number;
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
  id?: number | string;
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
  id?: number | string;
  fullName: string;
  gender: string | null;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: string;
};

type UserRoleNormalizationRecord = {
  id: number;
  systemRole: string;
  roleCodes: string | null;
};

export function createUsersRepository(deps: CreateUsersRepositoryDeps = {}) {
  const getDbInstance = deps.getDb ?? getDb;

  function listUsers() {
    return getDbInstance().all(`${USER_ROUTE_SELECT} ORDER BY fullName`) as Promise<UserRouteRecord[]>;
  }

  function findUserById(id: number | string) {
    return getDbInstance().get(`${USER_ROUTE_SELECT} WHERE id = ?`, [id]) as Promise<UserRouteRecord | undefined>;
  }

  function findUserPasswordHashById(id: number | string) {
    return getDbInstance().get('SELECT passwordHash FROM User WHERE id = ?', [id]) as Promise<{ passwordHash?: string | null } | undefined>;
  }

  function findUserIdentityById(id: number | string) {
    return getDbInstance().get('SELECT id FROM User WHERE id = ?', [id]) as Promise<{ id: number } | undefined>;
  }

  function createUser(input: CreateUserRecordInput) {
    return getDbInstance().run(
      `INSERT INTO User (
        fullName, gender, email, phone, role, department, status, username, passwordHash,
        systemRole, roleCodes, employeeCode, dateOfBirth, avatar, address, startDate,
        accountStatus, mustChangePassword, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        input.avatar,
        input.address,
        input.startDate,
        input.accountStatus,
        input.mustChangePassword,
        input.language,
      ],
    );
  }

  function updateUser(id: number | string, input: UpdateUserRecordInput) {
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

  function deleteUser(id: number | string) {
    return getDbInstance().run('DELETE FROM User WHERE id = ?', [id]);
  }

  function updateUserAvatar(id: number | string, avatar: string) {
    return getDbInstance().run('UPDATE User SET avatar = ? WHERE id = ?', [avatar, id]);
  }

  function updateUserAccountStatus(id: number | string, accountStatus: string) {
    return getDbInstance().run('UPDATE User SET accountStatus = ? WHERE id = ?', [accountStatus, id]);
  }

  function createImportedUser(input: CreateImportedUserInput) {
    return getDbInstance().run(
      `INSERT INTO User (fullName, gender, email, phone, role, department, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.fullName,
        input.gender,
        input.email,
        input.phone,
        input.role,
        input.department,
        input.status,
      ],
    );
  }

  function listUsersForProjectManagerNormalization() {
    return getDbInstance().all(
      'SELECT id, systemRole, roleCodes FROM User ORDER BY fullName',
    ) as Promise<UserRoleNormalizationRecord[]>;
  }

  function updateUserRoleAssignments(id: number | string, roleCodesJson: string, systemRole: string) {
    return getDbInstance().run('UPDATE User SET roleCodes = ?, systemRole = ? WHERE id = ?', [
      roleCodesJson,
      systemRole,
      id,
    ]);
  }

  return {
    listUsers,
    findUserById,
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
