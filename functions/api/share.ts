export interface Env {
  CANVAS_BUCKET: R2Bucket;
}

// Normalize domain by removing www. prefix for consistency
function normalizeDomain(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

export async function onRequestPost(ctx: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = ctx;

  try {
    // Get the canvas image data from the request body
    // In Cloudflare Pages Functions, ctx.request is a proper Request object
    const formData = await request.formData();
    
    if (!formData) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const canvasBlob = formData.get('canvas') as File | Blob | null;

    if (!canvasBlob) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (canvasBlob.size === 0) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Security: File size limit (2MB max)
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    if (canvasBlob.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: 'Invalid file' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Security: Validate image is PNG and exactly 761x761
    const arrayBuffer = await canvasBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer.slice(0, 12));
    
    // Check for PNG signature
    const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47;
    
    if (!isPNG) {
      return new Response(JSON.stringify({ error: 'Invalid file' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse PNG dimensions from IHDR chunk (bytes 16-23)
    const widthBytes = new DataView(arrayBuffer, 16, 4);
    const heightBytes = new DataView(arrayBuffer, 20, 4);
    const actualWidth = widthBytes.getUint32(0, false); // Big-endian
    const actualHeight = heightBytes.getUint32(0, false); // Big-endian
    
    // Validate dimensions are exactly 761x761
    if (actualWidth !== 761 || actualHeight !== 761) {
      return new Response(JSON.stringify({ error: 'Invalid file' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate a unique ID for this canvas
    const canvasId = crypto.randomUUID();

    // Extract and normalize domain from request URL
    const url = new URL(request.url);
    const domain = normalizeDomain(url.hostname);
    const r2Key = `${domain}/${canvasId}`;

    // Upload to R2 with domain-prefixed path
    await ctx.env.CANVAS_BUCKET.put(r2Key, canvasBlob, {
      httpMetadata: {
        contentType: 'image/png',
      },
    });

    // Return the shareable ID
    return new Response(JSON.stringify({ id: canvasId }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error uploading painting:', error);
    return new Response('Error uploading painting', { status: 500 });
  }
}

