import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';

const createMatchSchema = z
  .object({
    title: z.string().min(1),
    sourceType: z.enum(['youtube', 'upload']),
    sourceUrl: z.string().url().optional(),
  })
  .refine((data) => data.sourceType !== 'youtube' || !!data.sourceUrl, {
    message: 'sourceUrl is required when sourceType is youtube',
    path: ['sourceUrl'],
  });

const idParamSchema = z.object({ id: z.string().uuid() });

export async function matchesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/matches', async (_request, reply) => {
    // TODO: list matches for the authenticated user
    return reply.code(501).send({ error: 'Not implemented' });
  });

  app.post('/matches', async (request, reply) => {
    createMatchSchema.parse(request.body);
    // TODO: insert match row, enqueue processMatchQueue job
    return reply.code(501).send({ error: 'Not implemented' });
  });

  app.get('/matches/:id', async (request, reply) => {
    idParamSchema.parse(request.params);
    // TODO: fetch match + events + players + latest job status
    return reply.code(501).send({ error: 'Not implemented' });
  });

  app.delete('/matches/:id', async (request, reply) => {
    idParamSchema.parse(request.params);
    // TODO: delete match (cascade handles events/players/reports)
    return reply.code(501).send({ error: 'Not implemented' });
  });
}
