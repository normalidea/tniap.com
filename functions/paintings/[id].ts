export interface Env {
  CANVAS_BUCKET: R2Bucket;
}

// Normalize domain by removing www. prefix for consistency
function normalizeDomain(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

export async function onRequestGet(ctx: {
  request: Request;
  env: Env;
  params: { id: string };
}): Promise<Response> {
  const { id } = ctx.params;

  try {
    // Extract and normalize domain from request URL
    const url = new URL(ctx.request.url);
    const domain = normalizeDomain(url.hostname);
    const r2Key = `${domain}/${id}`;

    // Get the canvas from R2 using domain-prefixed path
    const object = await ctx.env.CANVAS_BUCKET.get(r2Key);

    if (!object) {
      return new Response('Painting not found', { status: 404 });
    }

    // Return the image with appropriate headers
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error retrieving painting:', error);
    return new Response('Error retrieving painting', { status: 500 });
  }
}

