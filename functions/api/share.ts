export interface Env {
  CANVAS_BUCKET: R2Bucket;
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
      console.error('formData() returned null/undefined');
      return new Response(JSON.stringify({ error: 'Failed to parse form data' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Debug: log all form data keys
    console.log('FormData keys:', Array.from(formData.keys()));
    
    const canvasBlob = formData.get('canvas') as File | Blob | null;

    if (!canvasBlob) {
      console.error('No canvas blob found in form data. Available keys:', Array.from(formData.keys()));
      return new Response(JSON.stringify({ error: 'No painting data provided' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (canvasBlob.size === 0) {
      console.error('Canvas blob is empty');
      return new Response(JSON.stringify({ error: 'Painting data is empty' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Canvas blob size:', canvasBlob.size);

    // Generate a unique ID for this canvas
    const canvasId = crypto.randomUUID();

    // Upload to R2
    await ctx.env.CANVAS_BUCKET.put(canvasId, canvasBlob, {
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

