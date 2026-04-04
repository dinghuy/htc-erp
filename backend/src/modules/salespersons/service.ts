import { v4 as uuidv4 } from 'uuid';
import { salespersonRepository } from './repository';

export function createSalespersonService() {
  return {
    listSalespersons() {
      return salespersonRepository.findAll();
    },

    createSalesperson(input: Record<string, unknown>) {
      return salespersonRepository.create({
        id: uuidv4(),
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
