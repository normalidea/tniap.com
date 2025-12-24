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

    // If requesting raw image (for og:image or direct image access)
    const acceptHeader = ctx.request.headers.get('Accept') || '';
    if (url.searchParams.get('raw') === 'true' || acceptHeader.includes('image/')) {
      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Convert image to base64 for embedding
    const arrayBuffer = await object.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const imageDataUrl = `data:image/png;base64,${base64}`;
    const imageUrl = `${url.origin}${url.pathname}?raw=true`;

    // Return HTML page with the image and download button
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        body {
            font-family: 'MS Sans Serif', 'Segoe UI', sans-serif;
            background: #c0c0c0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            background: #c0c0c0;
            border: 2px solid #808080;
            padding: 40px;
            text-align: center;
            max-width: 800px;
            box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        img {
            max-width: 100%;
            height: auto;
            border: 1px solid #000;
            background: #fff;
            display: block;
            margin: 0 auto 20px;
        }
        .button {
            background: #c0c0c0;
            border: 2px solid #808080;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            color: #000;
            display: inline-block;
            margin: 10px;
            transition: all 0.1s;
        }
        .button:hover {
            background: #d4d0c8;
        }
        .button:active {
            border: 2px solid #808080;
            background: #a0a0a0;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="${imageDataUrl}" alt="Shared painting">
        <a href="${imageUrl}" download="painting-${id}.png" class="button">Download</a>
        <a href="/" class="button">Create Your Own</a>
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
    return new Response('Error retrieving painting', { status: 500 });
  }
}

