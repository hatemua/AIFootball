import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/signup', async (request, reply) => {
    signupSchema.parse(request.body);
    // TODO: hashPassword, insert user, return signed token
    return reply.code(501).send({ error: 'Not implemented' });
  });

  app.post('/login', async (request, reply) => {
    loginSchema.parse(request.body);
    // TODO: lookup user, verifyPassword, return signed token
    return reply.code(501).send({ error: 'Not implemented' });
  });

  app.post('/logout', async (_request, reply) => {
    // TODO: server-side token revocation if we add a denylist; otherwise
    // logout is purely client-side (drop the cookie).
    return reply.code(501).send({ error: 'Not implemented' });
  });

  app.get('/me', async (_request, reply) => {
    // TODO: protect with requireAuth middleware, return current user
    return reply.code(501).send({ error: 'Not implemented' });
  });
}
