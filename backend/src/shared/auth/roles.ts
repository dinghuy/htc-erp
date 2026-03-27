export const BUSINESS_ROLE_CODES = [
  'admin',
  'sales',
  'project_manager',
  'procurement',
  'accounting',
  'legal',
  'director',
  'viewer',
] as const;

export type NormalizedRoleCode = (typeof BUSINESS_ROLE_CODES)[number];

const LEGACY_ROLE_MAP: Record<string, NormalizedRoleCode> = {
  admin: 'admin',
  sales: 'sales',
  manager: 'project_manager',
  project_manager: 'project_manager',
  procurement: 'procurement',
  accounting: 'accounting',
  legal: 'legal',
  director: 'director',
  viewer: 'viewer',
};

const PRIMARY_ROLE_PRIORITY: NormalizedRoleCode[] = [
  'admin',
  'sales',
  'project_manager',
  'procurement',
  'accounting',
  'legal',
  'director',
  'viewer',
];

function parseRoleCodesInput(roleCodes: unknown): string[] {
  if (Array.isArray(roleCodes)) {
    return roleCodes.map((value) => String(value || '').trim()).filter(Boolean);
  }

  if (typeof roleCodes === 'string' && roleCodes.trim()) {
    try {
      const parsed = JSON.parse(roleCodes);
      if (Array.isArray(parsed)) {
        return parsed.map((value) => String(value || '').trim()).filter(Boolean);
      }
    } catch {
      return roleCodes
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }

  return [];
}

export function normalizeRoleCode(roleCode: unknown): NormalizedRoleCode | null {
  const normalized = String(roleCode || '').trim().toLowerCase();
  return LEGACY_ROLE_MAP[normalized] ?? null;
}

export function normalizeRoleCodes(roleCodes: unknown, systemRole?: unknown): NormalizedRoleCode[] {
  const seed = parseRoleCodesInput(roleCodes);
  const normalized = seed
    .map((value) => normalizeRoleCode(value))
    .filter((value): value is NormalizedRoleCode => !!value);

  if (normalized.length === 0) {
    const fallback = normalizeRoleCode(systemRole);
    if (fallback) {
      normalized.push(fallback);
    }
  }

  if (normalized.length === 0) {
    normalized.push('viewer');
  }

  return Array.from(new Set(normalized));
}

export function resolvePrimaryRole(roleCodes: NormalizedRoleCode[], systemRole?: unknown): NormalizedRoleCode {
  const normalizedSystemRole = normalizeRoleCode(systemRole);
  if (normalizedSystemRole && roleCodes.includes(normalizedSystemRole)) {
    return normalizedSystemRole;
  }

  for (const roleCode of PRIMARY_ROLE_PRIORITY) {
    if (roleCodes.includes(roleCode)) {
      return roleCode;
    }
  }

  return 'viewer';
}

export function roleCodesToJson(roleCodes: unknown, systemRole?: unknown): string {
  return JSON.stringify(normalizeRoleCodes(roleCodes, systemRole));
}

function normalizeRequiredRole(roleCode: string): NormalizedRoleCode | null {
  return normalizeRoleCode(roleCode);
}

export function userHasAnyRole(
  user: {
    systemRole?: unknown;
    roleCodes?: unknown;
  } | null | undefined,
  requiredRoles: string[],
): boolean {
  const normalizedUserRoles = normalizeRoleCodes(user?.roleCodes, user?.systemRole);
  if (normalizedUserRoles.includes('admin')) {
    return true;
  }

  const normalizedRequiredRoles = requiredRoles
    .map((roleCode) => normalizeRequiredRole(roleCode))
    .filter((value): value is NormalizedRoleCode => !!value);

  if (normalizedRequiredRoles.length === 0) {
    return true;
  }

  return normalizedRequiredRoles.some((requiredRole) => normalizedUserRoles.includes(requiredRole));
}
