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
  const id = await slugManager.getIdFromSlug(indexType, slug);

  if (!id) {
    return new Response('Not found', { status: 404 });
  }

  // Redirect to the actual content page
  if (type === 'song') {
    return Response.redirect(`/song/${id}.mp3`, 302);
  }

  return Response.redirect(`/${type}?id=${id}`, 301);
}