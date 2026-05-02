import 'server-only';

import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'jwt';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string;
  email: string;
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Server-side helper to mint a token. The backend is the canonical issuer
 * in this app — this exists only for cases where a Next.js server action
 * needs to forge a session (e.g. tests, dev seeding).
 */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}
