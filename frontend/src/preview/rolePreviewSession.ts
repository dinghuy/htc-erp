import { SYSTEM_ROLES, type SystemRole } from '../shared/domain/contracts';

export type RolePreviewSessionProgress = {
  completedItemIndexes: number[];
  updatedAt?: string;
};

const STORAGE_PREFIX = 'crm.role-preview-session';

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function normalizeRoleSessionCodes(roleCodes: SystemRole[]): SystemRole[] {
  const unique = Array.from(new Set(roleCodes.filter((roleCode) => roleCode && roleCode !== 'admin')));
  return unique.sort((left, right) => SYSTEM_ROLES.indexOf(left) - SYSTEM_ROLES.indexOf(right));
}

export function getRolePreviewSessionStorageKey(roleCodes: SystemRole[]): string {
  const normalized = normalizeRoleSessionCodes(roleCodes);
  const suffix = normalized.length > 0 ? normalized.join('__') : 'admin';
  return `${STORAGE_PREFIX}.${suffix}`;
}

export function loadRolePreviewSessionProgress(roleCodes: SystemRole[]): RolePreviewSessionProgress {
  const storage = getStorage();
  if (!storage) {
    return { completedItemIndexes: [] };
  }

  const raw = storage.getItem(getRolePreviewSessionStorageKey(roleCodes));
  if (!raw) {
    return { completedItemIndexes: [] };
  }

  try {
    const parsed = JSON.parse(raw) as RolePreviewSessionProgress;
    if (!Array.isArray(parsed?.completedItemIndexes)) {
      return { completedItemIndexes: [] };
    }
    return {
      completedItemIndexes: Array.from(
        new Set(
          parsed.completedItemIndexes
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0),
        ),
      ).sort((left, right) => left - right),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return { completedItemIndexes: [] };
  }
}

export function saveRolePreviewSessionProgress(roleCodes: SystemRole[], completedItemIndexes: number[]): RolePreviewSessionProgress {
  const storage = getStorage();
  const nextState: RolePreviewSessionProgress = {
    completedItemIndexes: Array.from(
      new Set(
        completedItemIndexes
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0),
      ),
    ).sort((left, right) => left - right),
    updatedAt: new Date().toISOString(),
  };

  if (!storage) {
    return nextState;
  }

  storage.setItem(getRolePreviewSessionStorageKey(roleCodes), JSON.stringify(nextState));
  return nextState;
}

export function toggleRolePreviewSessionChecklistItem(roleCodes: SystemRole[], itemIndex: number): RolePreviewSessionProgress {
  const current = loadRolePreviewSessionProgress(roleCodes);
  const nextIndexes = current.completedItemIndexes.includes(itemIndex)
    ? current.completedItemIndexes.filter((value) => value !== itemIndex)
    : [...current.completedItemIndexes, itemIndex];

  return saveRolePreviewSessionProgress(roleCodes, nextIndexes);
}

export function resetRolePreviewSessionProgress(roleCodes: SystemRole[]): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(getRolePreviewSessionStorageKey(roleCodes));
}
