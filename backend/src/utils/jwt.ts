import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

interface Payload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export const signToken = (payload: Omit<Payload, 'iat' | 'exp'>): string => {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: Payload = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 days
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');

  return `${header}.${body}.${sig}`;
};

export const verifyToken = (token: string): Payload => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [header, body, sig] = parts;
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid token signature');
  }

  const payload: Payload = JSON.parse(Buffer.from(body, 'base64url').toString());

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
};

import type { Response } from 'express';

export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie('fiado_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const clearAuthCookie = (res: Response): void => {
  res.clearCookie('fiado_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });
};
