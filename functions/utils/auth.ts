export interface Env {
  CANVAS_BUCKET: R2Bucket;
  TNIAP_CONFIG: KVNamespace;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

// Normalize domain by removing www. prefix for consistency
export function normalizeDomain(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

// Check if domain requires authentication (all domains except tniap.com)
export function requiresAuth(hostname: string): boolean {
  const domain = normalizeDomain(hostname);
  return domain !== 'tniap.com';
}

// Get allowlisted emails from KV
export async function getAllowlistedEmails(env: Env): Promise<string[]> {
  const allowlistJson = await env.TNIAP_CONFIG.get('allowlisted_emails');
  if (!allowlistJson) {
    return [];
  }
  try {
    return JSON.parse(allowlistJson);
  } catch {
    return [];
  }
}

// Check if email is allowlisted
export async function isEmailAllowlisted(email: string, env: Env): Promise<boolean> {
  const allowlist = await getAllowlistedEmails(env);
  return allowlist.includes(email.toLowerCase());
}

// Add email to allowlist
export async function addEmailToAllowlist(email: string, env: Env): Promise<void> {
  const allowlist = await getAllowlistedEmails(env);
  const normalizedEmail = email.toLowerCase();
  if (!allowlist.includes(normalizedEmail)) {
    allowlist.push(normalizedEmail);
    await env.TNIAP_CONFIG.put('allowlisted_emails', JSON.stringify(allowlist));
  }
}

// Remove email from allowlist
export async function removeEmailFromAllowlist(email: string, env: Env): Promise<void> {
  const allowlist = await getAllowlistedEmails(env);
  const normalizedEmail = email.toLowerCase();
  const filtered = allowlist.filter(e => e !== normalizedEmail);
  await env.TNIAP_CONFIG.put('allowlisted_emails', JSON.stringify(filtered));
}

// Session management
const SESSION_COOKIE_NAME = 'tniap_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface Session {
  email: string;
  name?: string;
  picture?: string;
  expiresAt: number;
}

// Create session token
export function createSessionToken(session: Session): string {
  const payload = {
    email: session.email,
    name: session.name,
    picture: session.picture,
    expiresAt: session.expiresAt,
  };
  // In production, you'd want to sign this with a secret
  // For now, we'll use base64 encoding (not secure, but works for MVP)
  // TODO: Use proper JWT signing with a secret
  return btoa(JSON.stringify(payload));
}

// Parse session token
export function parseSessionToken(token: string): Session | null {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.expiresAt && payload.expiresAt > Date.now()) {
      return payload as Session;
    }
    return null;
  } catch {
    return null;
  }
}

// Get session from request
export function getSession(request: Request): Session | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!sessionCookie) return null;
  
  const token = sessionCookie.split('=')[1];
  return parseSessionToken(token);
}

// Set session cookie
export function setSessionCookie(session: Session): string {
  const token = createSessionToken(session);
  const expires = new Date(session.expiresAt).toUTCString();
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`;
}

// Clear session cookie
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

