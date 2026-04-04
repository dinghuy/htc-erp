import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../../sqlite-db';

export const VALID_CHANNEL_TYPES = [
  'email', 'phone', 'telegram', 'linkedin', 'twitter',
  'github', 'facebook', 'whatsapp', 'other',
] as const;

export type ChannelType = typeof VALID_CHANNEL_TYPES[number];

export type ContactChannelRow = {
  id: string;
  contactId: string;
  channelType: ChannelType;
  value: string;
  isPrimary?: number;
  createdAt?: string;
};

export function createChannelRepository() {
  return {
    findByContactId(contactId: string) {
      return getDb().all<ContactChannelRow>(
        'SELECT * FROM ContactChannel WHERE contactId = ? ORDER BY isPrimary DESC, createdAt ASC',
        [contactId]
      );
    },

    findById(id: string) {
      return getDb().get<ContactChannelRow>('SELECT * FROM ContactChannel WHERE id = ?', [id]);
    },

    async create(input: { contactId: string; channelType: ChannelType; value: string; isPrimary?: boolean }) {
      const id = uuidv4();
      // If marking as primary, unset other primaries for this contact first
      if (input.isPrimary) {
        await getDb().run(
          `UPDATE ContactChannel SET isPrimary = 0 WHERE contactId = ?`,
          [input.contactId]
        );
      }
      await getDb().run(
        `INSERT INTO ContactChannel (id, contactId, channelType, value, isPrimary, createdAt)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [id, input.contactId, input.channelType, input.value, input.isPrimary ? 1 : 0]
      );
      return this.findById(id);
    },

    async updateById(id: string, input: { channelType?: ChannelType; value?: string; isPrimary?: boolean }) {
      const existing = await this.findById(id);
      if (!existing) return null;
      if (input.isPrimary) {
        await getDb().run(
          `UPDATE ContactChannel SET isPrimary = 0 WHERE contactId = ? AND id != ?`,
          [existing.contactId, id]
        );
      }
      await getDb().run(
        `UPDATE ContactChannel SET channelType = ?, value = ?, isPrimary = ? WHERE id = ?`,
        [
          input.channelType ?? existing.channelType,
          input.value ?? existing.value,
          input.isPrimary != null ? (input.isPrimary ? 1 : 0) : (existing.isPrimary ?? 0),
          id,
        ]
      );
      return this.findById(id);
    },

    deleteById(id: string) {
      return getDb().run('DELETE FROM ContactChannel WHERE id = ?', [id]);
    },

    deleteByContactId(contactId: string) {
      return getDb().run('DELETE FROM ContactChannel WHERE contactId = ?', [contactId]);
    },
  };
}

export const channelRepository = createChannelRepository();
