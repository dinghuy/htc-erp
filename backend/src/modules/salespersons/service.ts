import { salespersonRepository } from './repository';

export function createSalespersonService() {
  return {
    listSalespersons() {
      return salespersonRepository.findAll();
    },

    createSalesperson(input: Record<string, unknown>) {
      return salespersonRepository.create({
        name: String(input.name ?? ''),
        email: String(input.email ?? ''),
        phone: String(input.phone ?? ''),
      });
    },

    deleteSalesperson(id: string) {
      return salespersonRepository.deleteById(id);
    },
  };
}
