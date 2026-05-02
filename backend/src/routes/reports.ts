import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';

const createReportSchema = z.object({
  matchId: z.string().uuid(),
  type: z.enum(['single_match', 'multi_match', 'opponent']),
});

const idParamSchema = z.object({ id: z.string().uuid() });

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/reports', async (_request, reply) => {
    // TODO: list reports for the authenticated user
    return reply.code(501).send({ error: 'Not implemented' });
  });

  app.post('/reports', async (request, reply) => {
    createReportSchema.parse(request.body);
    // TODO: insert reports row, enqueue generateReportQueue job
    return reply.code(501).send({ error: 'Not implemented' });
  });

  app.get('/reports/:id', async (request, reply) => {
    idParamSchema.parse(request.params);
    // TODO: return report row including pdf_path / insights
    return reply.code(501).send({ error: 'Not implemented' });
  });
}
