import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Fastify preHandler that requires a valid JWT.
 *
 * Use on protected routes:
 *   app.get('/me', { preHandler: requireAuth }, handler)
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    request.log.warn({ err }, 'JWT verification failed');
    return reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
    });
  }
}
