import { Env, getSession, requiresAuth } from '../../utils/auth';

export async function onRequestGet(ctx: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request } = ctx;
  const url = new URL(request.url);
  
  // If domain doesn't require auth, return not required
  if (!requiresAuth(url.hostname)) {
    return new Response(JSON.stringify({ 
      authenticated: false,
      requiresAuth: false,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = getSession(request);
  
  if (!session) {
    return new Response(JSON.stringify({ 
      authenticated: false,
      requiresAuth: true,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    authenticated: true,
    requiresAuth: true,
    email: session.email,
    name: session.name,
    picture: session.picture,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

