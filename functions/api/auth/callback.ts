import { Env, requiresAuth, isEmailAllowlisted, setSessionCookie, createSessionToken } from '../../utils/auth';
import { exchangeCodeForTokens, getGoogleUserInfo, buildRedirectUri } from '../../utils/google-oauth';

export async function onRequestGet(ctx: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = ctx;
  
  const url = new URL(request.url);
  
  // Only allow auth for non-tniap.com domains
  if (!requiresAuth(url.hostname)) {
    return Response.redirect(`${url.origin}/`, 302);
  }

  // Check if Google OAuth is configured
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return new Response('Google OAuth not configured', { status: 500 });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return Response.redirect(`${url.origin}/signin.html?error=auth_failed`, 302);
  }

  if (!code || !state) {
    return Response.redirect(`${url.origin}/signin.html?error=invalid_request`, 302);
  }

  try {
    // Verify state
    const stateData = await env.TNIAP_CONFIG.get(`oauth_state_${state}`);
    if (!stateData) {
      return Response.redirect(`${url.origin}/signin.html?error=invalid_state`, 302);
    }

    // Delete state to prevent reuse
    await env.TNIAP_CONFIG.delete(`oauth_state_${state}`);

    const { redirectUri } = JSON.parse(stateData);
    const actualRedirectUri = buildRedirectUri(request);

    // Verify redirect URI matches
    if (redirectUri !== actualRedirectUri) {
      return Response.redirect(`${url.origin}/signin.html?error=redirect_mismatch`, 302);
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(
      code,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      actualRedirectUri
    );

    // Get user info
    if (!tokens.access_token) {
      throw new Error('No access token received');
    }
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    // Check if email is allowlisted
    const isAllowlisted = await isEmailAllowlisted(userInfo.email, env);
    
    if (!isAllowlisted) {
      return Response.redirect(`${url.origin}/thanks.html`, 302);
    }

    // Create session
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    const session = {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      expiresAt,
    };

    const sessionCookie = setSessionCookie(session);

    // Redirect to home with success
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${url.origin}/?auth=success`,
        'Set-Cookie': sessionCookie,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return Response.redirect(`${url.origin}/signin.html?error=auth_failed`, 302);
  }
}

