import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const gpuJobCompleteSchema = z.object({
  job_id: z.string(),
  match_id: z.string().uuid(),
  status: z.enum(['completed', 'failed']),
  error: z.string().nullable().optional(),
  result: z
    .object({
      duration_seconds: z.number(),
      events: z.array(z.record(z.unknown())),
      players: z.array(z.record(z.unknown())),
    })
    .nullable()
    .optional(),
});

export async function webhooksRoutes(app: FastifyInstance): Promise<void> {
  // NOTE: webhooks are intentionally NOT behind requireAuth — the GPU
  // server doesn't have a user JWT. TODO: add a shared-secret header
  // (e.g. x-gpu-token) and verify here.

  app.post('/webhooks/gpu/job-complete', async (request, reply) => {
    const body = gpuJobCompleteSchema.parse(request.body);
    // TODO: update jobs row, persist match_events + match_players, set match.status
    request.log.info({ matchId: body.match_id, status: body.status }, 'GPU job-complete webhook');
    return reply.code(501).send({ error: 'Not implemented' });
  });
}
