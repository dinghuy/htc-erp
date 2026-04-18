import { fetchWithAuth } from '../../auth';
import { ensureArray } from './taskDomain';

export type TaskWorkspaceCollections = {
  tasks: any[];
  projects: any[];
  users: any[];
  accounts: any[];
  leads: any[];
  quotations: any[];
  userLoadWarning: string;
};

function extractArrayPayload<T = any>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== 'object') return [];
  const asRecord = payload as Record<string, unknown>;
  if (Array.isArray(asRecord.data)) return asRecord.data as T[];
  if (Array.isArray(asRecord.items)) return asRecord.items as T[];
  if (Array.isArray(asRecord.results)) return asRecord.results as T[];
  return [];
}

function hasArrayCollectionShape(payload: unknown): boolean {
  if (Array.isArray(payload)) return true;
  if (!payload || typeof payload !== 'object') return false;
  const asRecord = payload as Record<string, unknown>;
  return Array.isArray(asRecord.data) || Array.isArray(asRecord.items) || Array.isArray(asRecord.results);
}

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function buildWorkspaceCollections(input: {
  taskRes: Response;
  projectRes: Response;
  userRes: Response;
  accountRes: Response;
  leadRes: Response;
  quotationRes: Response;
  tasksPayload: unknown;
  projectsPayload: unknown;
  usersPayload: unknown;
  accountsPayload: unknown;
  leadsPayload: unknown;
  quotationsPayload: unknown;
}): TaskWorkspaceCollections {
  const {
    taskRes,
    projectRes,
    userRes,
    accountRes,
    leadRes,
    quotationRes,
    tasksPayload,
    projectsPayload,
    usersPayload,
    accountsPayload,
    leadsPayload,
    quotationsPayload,
  } = input;

  if (!taskRes.ok || !projectRes.ok || !accountRes.ok || !leadRes.ok || !quotationRes.ok) {
    throw new Error('core_data_failed');
  }

  const tasks = ensureArray(extractArrayPayload(tasksPayload));
  const projects = ensureArray(extractArrayPayload(projectsPayload));
  const accounts = ensureArray(extractArrayPayload(accountsPayload));
  const leads = ensureArray(extractArrayPayload(leadsPayload));
  const quotations = ensureArray(extractArrayPayload(quotationsPayload));

  const users = userRes.ok ? ensureArray(extractArrayPayload(usersPayload)) : [];
  const userLoadWarning = userRes.ok && hasArrayCollectionShape(usersPayload)
    ? ''
    : 'Không tải được danh sách nhân sự. Bạn vẫn có thể tạo hoặc sửa công việc, nhưng ô Owner sẽ tạm thời để trống.';

  return {
    tasks,
    projects,
    users,
    accounts,
    leads,
    quotations,
    userLoadWarning,
  };
}

export async function loadTaskWorkspaceData(apiBase: string, token: string): Promise<TaskWorkspaceCollections> {
  const [taskRes, projectRes, userRes, accountRes, leadRes, quotationRes] = await Promise.all([
    fetch(`${apiBase}/tasks`),
    fetch(`${apiBase}/projects`),
    fetchWithAuth(token, `${apiBase}/users/directory`),
    fetch(`${apiBase}/accounts`),
    fetch(`${apiBase}/leads`),
    fetchWithAuth(token, `${apiBase}/quotations`),
  ]);

  const [tasksPayload, projectsPayload, usersPayload, accountsPayload, leadsPayload, quotationsPayload] = await Promise.all([
    parseJsonSafe(taskRes),
    parseJsonSafe(projectRes),
    parseJsonSafe(userRes),
    parseJsonSafe(accountRes),
    parseJsonSafe(leadRes),
    parseJsonSafe(quotationRes),
  ]);

  return buildWorkspaceCollections({
    taskRes,
    projectRes,
    userRes,
    accountRes,
    leadRes,
    quotationRes,
    tasksPayload,
    projectsPayload,
    usersPayload,
    accountsPayload,
    leadsPayload,
    quotationsPayload,
  });
}
