// JWT HS256 del servidor simulado (header.payload.firma).
import { env } from '../../config/env';
import { base64UrlDecode, base64UrlEncode, hmacSha256, safeEqual, utf8 } from './crypto';
import type { RoleId } from '../../auth/permissions';

export interface JwtPayload {
  sub: string; // id de usuario
  role: RoleId;
  email: string;
  sid: string; // id de la sesión (refresh token)
  iat: number;
  exp: number;
  iss: string;
}

const ISSUER = 'cjn-mock-api';

const sign = (data: string) => base64UrlEncode(hmacSha256(utf8(env.mock.jwtSecret), utf8(data)));

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss'>, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds, iss: ISSUER }));
  return `${header}.${body}.${sign(`${header}.${body}`)}`;
}

export type JwtCheck = { ok: true; payload: JwtPayload } | { ok: false; reason: 'malformed' | 'signature' | 'expired' };

export function verifyJwt(token: string): JwtCheck {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [header, body, signature] = parts;
  if (!safeEqual(sign(`${header}.${body}`), signature)) return { ok: false, reason: 'signature' };
  try {
    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;
    if (payload.iss !== ISSUER) return { ok: false, reason: 'signature' };
    if (payload.exp * 1000 < Date.now()) return { ok: false, reason: 'expired' };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

