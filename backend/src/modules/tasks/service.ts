import { createTaskRepository } from './repository';

type CreateTaskServicesDeps = {};

export function createTaskServices(_deps: CreateTaskServicesDeps = {}) {
  const taskRepository = createTaskRepository();

  async function resolveAssigneeId(
    _db: any,
    preferredAssigneeId: unknown,
    salesperson: unknown,
    fallbackUserId: string | null
  ) {
    if (typeof preferredAssigneeId === 'string' && preferredAssigneeId.trim()) {
      const direct = await taskRepository.findUserByIdentifier(preferredAssigneeId);
      if (direct?.id) return direct.id;
    }

    const salespersonUser = await taskRepository.findUserByIdentifier(salesperson);
    if (salespersonUser?.id) return salespersonUser.id;

    if (fallbackUserId) {
      const fallbackUser = await taskRepository.findUserByIdentifier(fallbackUserId);
      if (fallbackUser?.id) return fallbackUser.id;
      return fallbackUserId;
    }

    return null;
  }

  async function getTaskWithLinksById(_db: any, id: string) {
    return taskRepository.getTaskWithLinksById(id);
  }

  return {
    resolveAssigneeId,
    getTaskWithLinksById,
  };
}
