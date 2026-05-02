import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  issues?: unknown;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof ZodError) {
      const body: ErrorBody = {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        issues: err.flatten(),
      };
      request.log.warn({ err }, 'Validation error');
      return reply.code(400).send(body);
    }

    const statusCode = err.statusCode ?? 500;
    const body: ErrorBody = {
      statusCode,
      error: err.name || 'Internal Server Error',
      message: statusCode >= 500 ? 'Internal server error' : err.message,
    };

    if (statusCode >= 500) {
      request.log.error({ err }, 'Unhandled error');
    } else {
      request.log.warn({ err }, 'Client error');
    }

    return reply.code(statusCode).send(body);
  });
}
