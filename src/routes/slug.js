// src/routes/slug.js
import { SlugManager } from '../helpers/slug.js';

export async function handleSlug(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.substring(1); // Remove leading slash
  const [type, ...slugParts] = path.split('/');
  const slug = slugParts.join('/');

  // Valid types (plural for index, singular for URL)
  const typeMap = {
    'song': 'songs',
    'artist': 'artists',
    'album': 'albums',
    'playlist': 'playlists',
    'genre': 'genres'
  };
  
  const indexType = typeMap[type];
  
  if (!indexType || !slug) {
    return new Response('Not found', { status: 404 });
  }

  const slugManager = new SlugManager(env);
  
  // Check if this is already a slug (contains hyphens, lowercase, etc.)
  // If it looks like a slug, let the main handler process it
  if (slug.includes('-') || /^[a-z0-9-]+$/.test(slug)) {
    // This looks like a slug - pass through to the main handler
    // by returning a 404 here so the main router can try other routes
    return new Response('Not found', { status: 404 });
  }
  
  // If it doesn't look like a slug, assume it's an old ID and try to redirect
  const id = await slugManager.getIdFromSlug(indexType, slug);
  
  if (id) {
    // Get the slug for this ID to redirect to the proper URL
    const properSlug = await slugManager.getSlugFromId(indexType, id);
    if (properSlug) {
      return Response.redirect(`/${type}/${properSlug}`, 301);
    }
  }

  return new Response('Not found', { status: 404 });
}