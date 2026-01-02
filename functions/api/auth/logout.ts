import { Env, clearSessionCookie } from '../../utils/auth';

export async function onRequestPost(ctx: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const url = new URL(ctx.request.url);
  
  const cookie = clearSessionCookie();
  
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
}

