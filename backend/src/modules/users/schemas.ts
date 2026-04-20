type UserSchemaParseResult<T> =
  | { ok: true; normalizedBody: T }
  | {
      ok: false;
      httpStatus: 400;
      payload: {
        code: 'INVALID_REQUEST_BODY';
        error: string;
        details?: Record<string, string>;
      };
    };

export type CreateUserInput = {
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  department?: string;
  status?: string;
  gender?: string;
  username?: string;
  password?: string;
  systemRole?: string;
  roleCodes?: unknown;
  employeeCode?: string;
  dateOfBirth?: string;
  address?: string;
  startDate?: string;
  accountStatus?: string;
  mustChangePassword?: boolean | number;
  language?: string;
};

export type UpdateUserInput = Partial<CreateUserInput>;

export type ImportUserRowInput = {
  fullName: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  status?: string;
  gender?: string;
  username?: string;
  password?: string;
  systemRole?: string;
  employeeCode?: string;
};

function parseBodyAsObject(body: unknown) {
  if (body == null) {
    return { ok: true as const, normalizedBody: {} as Record<string, unknown> };
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false as const,
      httpStatus: 400 as const,
      payload: {
        code: 'INVALID_REQUEST_BODY' as const,
        error: 'Request body must be an object',
      },
    };
  }
  return { ok: true as const, normalizedBody: body as Record<string, unknown> };
}

function trimOptionalString(value: unknown) {
  if (value == null) return undefined;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized === '' ? '' : normalized;
}

function validateEmail(value: string | undefined) {
  if (!value) return true;
  return /^\S+@\S+\.\S+$/.test(value);
}

function pushError(errors: Record<string, string>, field: string, message: string) {
  if (!errors[field]) errors[field] = message;
}

function buildValidationError(errors: Record<string, string>, fallback: string) {
  return {
    ok: false as const,
    httpStatus: 400 as const,
    payload: {
      code: 'INVALID_REQUEST_BODY' as const,
      error: fallback,
      details: errors,
    },
  };
}

export function parseCreateUserBody(body: unknown): UserSchemaParseResult<CreateUserInput> {
  const parsed = parseBodyAsObject(body);
  if (!parsed.ok) {
    return {
      ok: false,
      httpStatus: parsed.httpStatus,
      payload: parsed.payload,
    };
  }
  const source = parsed.normalizedBody;
  const errors: Record<string, string> = {};

  const fullName = trimOptionalString(source.fullName);
  if (fullName == null || fullName === '') pushError(errors, 'fullName', 'Họ và tên là bắt buộc');

  const role = trimOptionalString(source.role);
  if (role == null || role === '') pushError(errors, 'role', 'Chức vụ là bắt buộc');

  const email = trimOptionalString(source.email);
  if (email === null) pushError(errors, 'email', 'Email phải là chuỗi ký tự hợp lệ');
  if (typeof email === 'string' && email !== '' && !validateEmail(email)) {
    pushError(errors, 'email', 'Email không đúng định dạng');
  }

  const username = trimOptionalString(source.username);
  if (username === null) pushError(errors, 'username', 'Username phải là chuỗi ký tự hợp lệ');
  if (username === '') pushError(errors, 'username', 'Username không được để trống');

  const password = trimOptionalString(source.password);
  if (password === null) pushError(errors, 'password', 'Mật khẩu phải là chuỗi ký tự hợp lệ');
  if (typeof password === 'string' && password !== '' && password.length < 8) {
    pushError(errors, 'password', 'Mật khẩu phải có ít nhất 8 ký tự');
  }

  if (Object.keys(errors).length > 0) {
    return buildValidationError(errors, 'Thông tin người dùng không hợp lệ');
  }

  return {
    ok: true,
    normalizedBody: {
      fullName: fullName as string,
      role: role as string,
      ...(email ? { email } : {}),
      ...(trimOptionalString(source.phone) ? { phone: trimOptionalString(source.phone) as string } : {}),
      ...(trimOptionalString(source.department) ? { department: trimOptionalString(source.department) as string } : {}),
      ...(trimOptionalString(source.status) ? { status: trimOptionalString(source.status) as string } : {}),
      ...(trimOptionalString(source.gender) ? { gender: trimOptionalString(source.gender) as string } : {}),
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      ...(trimOptionalString(source.systemRole) ? { systemRole: trimOptionalString(source.systemRole) as string } : {}),
      ...(source.roleCodes !== undefined ? { roleCodes: source.roleCodes } : {}),
      ...(trimOptionalString(source.employeeCode) ? { employeeCode: trimOptionalString(source.employeeCode) as string } : {}),
      ...(trimOptionalString(source.dateOfBirth) ? { dateOfBirth: trimOptionalString(source.dateOfBirth) as string } : {}),
      ...(trimOptionalString(source.address) ? { address: trimOptionalString(source.address) as string } : {}),
      ...(trimOptionalString(source.startDate) ? { startDate: trimOptionalString(source.startDate) as string } : {}),
      ...(trimOptionalString(source.accountStatus) ? { accountStatus: trimOptionalString(source.accountStatus) as string } : {}),
      ...(source.mustChangePassword !== undefined ? { mustChangePassword: source.mustChangePassword as boolean | number } : {}),
      ...(trimOptionalString(source.language) ? { language: trimOptionalString(source.language) as string } : {}),
    },
  };
}

export function parseUpdateUserBody(body: unknown): UserSchemaParseResult<UpdateUserInput> {
  const parsed = parseBodyAsObject(body);
  if (!parsed.ok) {
    return {
      ok: false,
      httpStatus: parsed.httpStatus,
      payload: parsed.payload,
    };
  }
  const source = parsed.normalizedBody;
  const errors: Record<string, string> = {};
  const normalizedBody: UpdateUserInput = {};

  const stringFields: Array<keyof UpdateUserInput> = [
    'fullName',
    'email',
    'phone',
    'role',
    'department',
    'status',
    'gender',
    'username',
    'password',
    'systemRole',
    'employeeCode',
    'dateOfBirth',
    'address',
    'startDate',
    'accountStatus',
    'language',
  ];

  for (const field of stringFields) {
    if (!(field in source)) continue;
    const normalized = trimOptionalString(source[field]);
    if (normalized === null) {
      pushError(errors, String(field), `${String(field)} phải là chuỗi ký tự hợp lệ`);
      continue;
    }
    if (field === 'email' && normalized && !validateEmail(normalized)) {
      pushError(errors, 'email', 'Email không đúng định dạng');
      continue;
    }
    if (field === 'username' && normalized === '') {
      pushError(errors, 'username', 'Username không được để trống');
      continue;
    }
    if (field === 'password' && normalized && normalized.length < 8) {
      pushError(errors, 'password', 'Mật khẩu phải có ít nhất 8 ký tự');
      continue;
    }
    if (normalized === '') continue;
    normalizedBody[field] = normalized as never;
  }

  if ('roleCodes' in source) normalizedBody.roleCodes = source.roleCodes;
  if ('mustChangePassword' in source) normalizedBody.mustChangePassword = source.mustChangePassword as boolean | number;

  if (Object.keys(errors).length > 0) {
    return buildValidationError(errors, 'Thông tin cập nhật người dùng không hợp lệ');
  }

  return { ok: true, normalizedBody };
}

export function parseImportUserRow(values: Record<string, string>) {
  const errors: string[] = [];
  const fullName = (values.fullName || values['Họ tên'] || '').trim();
  const email = (values.email || values['Email'] || '').trim();
  const username = (values.username || values['Username'] || '').trim();
  const password = (values.password || values['Mật khẩu'] || '').trim();
  const role = (values.role || values['Chức vụ'] || '').trim();

  if (!fullName) errors.push('Thiếu họ tên');
  if (email && !validateEmail(email)) errors.push('Email không đúng định dạng');
  if (username === '') {
    // username is optional at import input because it can be generated later
  }
  if (password && password.length < 8) errors.push('Mật khẩu phải có ít nhất 8 ký tự');
  if (!role) errors.push('Thiếu chức vụ');

  return {
    ok: errors.length === 0,
    errors,
    normalizedRow: {
      fullName,
      ...(email ? { email } : {}),
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      ...(role ? { role } : {}),
    } as ImportUserRowInput,
  };
}
