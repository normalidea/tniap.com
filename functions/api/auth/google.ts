import { Env, requiresAuth } from '../../utils/auth';
import { buildGoogleAuthUrl, generateOAuthState, buildRedirectUri } from '../../utils/google-oauth';

export async function onRequestGet(ctx: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = ctx;
  
  // Only allow auth for non-tniap.com domains
  const url = new URL(request.url);
  if (!requiresAuth(url.hostname)) {
    return new Response(JSON.stringify({ error: 'Authentication not required for this domain' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if Google OAuth is configured
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Generate state and store it (we'll use KV for this)
  const state = generateOAuthState();
  const redirectUri = buildRedirectUri(request);
  
  // Store state in KV with 10 minute expiration
  await env.TNIAP_CONFIG.put(
    `oauth_state_${state}`,
    JSON.stringify({ redirectUri, timestamp: Date.now() }),
    { expirationTtl: 600 }
  );

  // Build authorization URL
  const authUrl = buildGoogleAuthUrl(env.GOOGLE_CLIENT_ID, redirectUri, state);

  // Redirect to Google
  return Response.redirect(authUrl, 302);
}

