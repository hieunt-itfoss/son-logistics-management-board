import { createMiddleware } from 'hono/factory';
import type { Env, User, Session, Role } from '../types';

const SESSION_COOKIE_NAME = 'session_token';
const SESSION_DURATION_HOURS = 24;

async function hashPassword(password: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const passwordData = encoder.encode(password);

  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, passwordData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifyPassword(password: string, hash: string, secret: string): Promise<boolean> {
  const computed = await hashPassword(password, secret);
  return computed === hash;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

async function createSession(db: D1Database, userId: string, secret: string): Promise<string> {
  const token = generateToken();
  const id = generateId('SES');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000).toISOString();

  await db.prepare(
    'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(id, userId, token, expiresAt).run();

  return token;
}

async function getSession(db: D1Database, token: string): Promise<{ session: Session; user: User } | null> {
  const result = await db.prepare(
    `SELECT s.id as ses_id, s.user_id, s.token, s.expires_at, s.created_at as ses_created,
            u.id, u.username, u.password_hash, u.display_name, u.role, u.active, u.created_at, u.updated_at
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`
  ).bind(token).first();

  if (!result) return null;

  return {
    session: {
      id: result.ses_id as string,
      user_id: result.user_id as string,
      token: result.token as string,
      expires_at: result.expires_at as string,
      created_at: result.ses_created as string,
    },
    user: {
      id: result.id as string,
      username: result.username as string,
      password_hash: result.password_hash as string,
      display_name: result.display_name as string,
      role: result.role as Role,
      active: result.active as number,
      created_at: result.created_at as string,
      updated_at: result.updated_at as string,
    },
  };
}

async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Quản trị',
  ke_toan: 'Kế toán',
  tai_xe: 'Tài xế',
  kho: 'Thủ kho',
};

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: ['dashboard', 'khach-hang', 'hang', 'tuyen', 'xe', 'tai-xe', 'chuyen-xe', 'users'],
  ke_toan: ['dashboard', 'khach-hang', 'hang', 'chuyen-xe'],
  tai_xe: ['dashboard', 'chuyen-xe'],
  kho: ['dashboard', 'kho'],
};

export function hasPermission(role: Role, resource: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(resource) ?? false;
}

export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
    ?? getCookie(c, SESSION_COOKIE_NAME);

  if (!token) {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return c.redirect('/login');
  }

  const result = await getSession(c.env.DB, token);
  if (!result) {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Session expired' }, 401);
    }
    deleteCookie(c, SESSION_COOKIE_NAME);
    return c.redirect('/login');
  }

  c.set('user', result.user);
  c.set('session', result.session);
  await next();
});

function getCookie(c: any, name: string): string | undefined {
  const header = c.req.header('Cookie') || '';
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}

function deleteCookie(c: any, name: string): void {
  c.header('Set-Cookie', `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export function setSessionCookie(c: any, token: string): void {
  c.header('Set-Cookie', `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DURATION_HOURS * 3600}`);
}

export function clearSessionCookie(c: any): void {
  deleteCookie(c, SESSION_COOKIE_NAME);
}

export {
  hashPassword,
  verifyPassword,
  generateToken,
  generateId,
  createSession,
  deleteSession,
  getSession,
};
