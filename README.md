# tniap 🪞 paint

- A very simple in-browser drawing app

## Running locally

- Just open index.html from the tniap.com directory
- For local development with Cloudflare Pages Functions:
  1. Install Wrangler CLI: `npm install -g wrangler` (or `npm install wrangler` for local install)
  2. Run `wrangler pages dev` (or `npx wrangler pages dev` if installed locally)

## Deploying 

### Cloudflare Pages

Cloudflare Pages can serve both the frontend and handle the Share feature:

1. Install Wrangler CLI if you haven't: `npm install -g wrangler`
2. Authenticate with Cloudflare: `wrangler login`
3. Create an R2 bucket named `tniap-canvas-storage` (and `tniap-canvas-storage-preview` for preview deployments) in the Cloudflare dashboard
4. In your Cloudflare Pages project dashboard, go to Settings → Functions → R2 Bucket Bindings and add a binding:
   - Variable name: `CANVAS_BUCKET`
   - R2 bucket: `tniap-canvas-storage` (or `tniap-canvas-storage-preview` for preview)
5. Deploy using:
   - `wrangler pages deploy` (or connect via GitHub for automatic deployments)

The static files (HTML, CSS, JS) will be served automatically, and the Functions in `/functions` will handle the Share API routes.