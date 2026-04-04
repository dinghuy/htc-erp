import { v4 as uuidv4 } from 'uuid';
import { funnelRepository } from './repository';

export function createFunnelService() {
  return {
    listFunnels() {
      return funnelRepository.findAll();
    },

    getFunnelById(id: string) {
      return funnelRepository.findById(id);
    },

    createFunnel(input: Record<string, unknown>) {
      return funnelRepository.create({
        id: uuidv4(),
        name: String(input.name ?? ''),
        description: input.description != null ? String(input.description) : null,
        isDefault: input.isDefault ? 1 : 0,
        sortOrder: Number(input.sortOrder ?? 0),
      });
    },

    async updateFunnel(id: string, input: Record<string, unknown>) {
      const existing = await funnelRepository.findById(id);
      if (!existing) return null;
      return funnelRepository.updateById(id, {
        name: input.name != null ? String(input.name) : existing.name,
        description: input.description != null ? String(input.description) : (existing.description ?? null),
        isDefault: input.isDefault != null ? (input.isDefault ? 1 : 0) : (existing.isDefault ?? 0),
        sortOrder: input.sortOrder != null ? Number(input.sortOrder) : (existing.sortOrder ?? 0),
      });
    },

    deleteFunnel(id: string) {
      return funnelRepository.deleteById(id);
    },
  };
}
