import type { Express, Request, Response } from 'express';
import { channelRepository, VALID_CHANNEL_TYPES, type ChannelType } from './channelRepository';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterChannelRoutesDeps = {
  ah: AsyncRouteFactory;
  requireAuth?: any;
};

export function registerContactChannelRoutes(app: Express, deps: RegisterChannelRoutesDeps) {
  const { ah } = deps;
  const repo = channelRepository;
  const getSingleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

  // List all channels for a contact
  app.get('/api/contacts/:contactId/channels', ah(async (req: Request, res: Response) => {
    const contactId = getSingleParam(req.params.contactId);
    if (!contactId) return res.status(400).json({ error: 'contactId is required' });
    res.json(await repo.findByContactId(contactId));
  }));

  // Get single channel
  app.get('/api/contact-channels/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const row = await repo.findById(id);
    if (!row) return res.status(404).json({ error: 'Contact channel not found' });
    res.json(row);
  }));

  // Create channel for contact
  app.post('/api/contacts/:contactId/channels', ah(async (req: Request, res: Response) => {
    const contactId = getSingleParam(req.params.contactId);
    if (!contactId) return res.status(400).json({ error: 'contactId is required' });
    const { channelType, value, isPrimary } = req.body;
    if (!channelType || !value) {
      return res.status(400).json({ error: 'channelType and value are required' });
    }
    if (!VALID_CHANNEL_TYPES.includes(channelType as ChannelType)) {
      return res.status(400).json({ error: `Invalid channelType. Must be one of: ${VALID_CHANNEL_TYPES.join(', ')}` });
    }
    const row = await repo.create({
      contactId,
      channelType: channelType as ChannelType,
      value: String(value),
      isPrimary: Boolean(isPrimary),
    });
    res.status(201).json(row);
  }));

  // Update channel
  app.put('/api/contact-channels/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { channelType, value, isPrimary } = req.body;
    if (channelType && !VALID_CHANNEL_TYPES.includes(channelType as ChannelType)) {
      return res.status(400).json({ error: `Invalid channelType. Must be one of: ${VALID_CHANNEL_TYPES.join(', ')}` });
    }
    const row = await repo.updateById(id, {
      channelType: channelType as ChannelType | undefined,
      value: value != null ? String(value) : undefined,
      isPrimary: isPrimary != null ? Boolean(isPrimary) : undefined,
    });
    if (!row) return res.status(404).json({ error: 'Contact channel not found' });
    res.json(row);
  }));

  // Delete channel
  app.delete('/api/contact-channels/:id', ah(async (req: Request, res: Response) => {
    const id = getSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });
    await repo.deleteById(id);
    res.json({ success: true });
  }));
}
