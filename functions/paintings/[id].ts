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

    // Only serve raw image if explicitly requested with ?raw=true (for og:image)
    if (url.searchParams.get('raw') === 'true') {
      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Convert image to base64 for embedding
    // Use a chunked approach to avoid call stack limits with large arrays
    const arrayBuffer = await object.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192; // Process in 8KB chunks
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);
    const imageDataUrl = `data:image/png;base64,${base64}`;
    const imageUrl = `${url.origin}${url.pathname}?raw=true`;

    // Return HTML page with the image and download button
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${domain} 🖼️</title>
    <!-- Open Graph / Social Media -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${domain} 🖼️">
    <meta property="og:description" content="View this shared painting">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:url" content="${url.origin}${url.pathname}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${domain} 🖼️">
    <meta name="twitter:description" content="View this shared painting">
    <meta name="twitter:image" content="${imageUrl}">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html {
            height: 100%;
        }
        body {
            font-family: 'MS Sans Serif', 'Segoe UI', sans-serif;
            background: #c0c0c0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
        }
        .container {
            background: #c0c0c0;
            padding: 40px;
            text-align: center;
            max-width: 800px;
            width: 100%;
            position: relative;
        }
        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }
        }
        .painting-container {
            background: #c0c0c0;
            padding: 10px;
            display: inline-block;
            margin-bottom: 0;
        }
        img {
            display: block;
            background: #fff;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="painting-container">
            <img src="${imageDataUrl}" alt="Shared painting">
        </div>
    </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error retrieving painting:', error);
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return new Response(`Error retrieving painting: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}


