import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';

const SALT_ROUNDS = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
}

/**
 * Sign a JWT for `userId`. Uses Fastify's @fastify/jwt under the hood so
 * the secret + algorithms are managed in one place.
 */
export function signToken(app: FastifyInstance, payload: JwtPayload): string {
  return app.jwt.sign(payload, { expiresIn: '7d' });
}

export function verifyToken(app: FastifyInstance, token: string): JwtPayload {
  return app.jwt.verify<JwtPayload>(token);
}
