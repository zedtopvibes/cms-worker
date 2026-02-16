// ==================== ALBUMS ROUTES ====================
// ALL IMPORTS AT THE TOP
import { getAlbums, getArtists, getMetadata, saveAlbums } from '../helpers/storage.js';
import { getAggregatedStats } from '../helpers/db.js';
import { formatDuration } from '../helpers/formatting.js';
import { incrementPageView } from '../helpers/pageViews.js';

export async function handleAlbums(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  
  // Albums list page
  if (path === "/albums") {
    const templateObj = await env.media.get("albums.html");
    if (!templateObj) {
      return new Response("albums.html template not found in R2", { status: 500 });
    }
    let html = await templateObj.text();

    const albums = await getAlbums(env);
    const artists = await getArtists(env);
    
    // ... rest of your albums list code ...
    
    return new Response(html, { 
      headers: { 
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300"
      } 
    });
  }
  
  // Album detail page
  if (path.startsWith("/album/") && !path.startsWith("/album/create")) {
    const albumId = decodeURIComponent(path.replace("/album/", ""));
    
    const albums = await getAlbums(env);
    const album = albums[albumId];
    const artists = await getArtists(env);
    
    if (!album) {
      return new Response("Album not found", { status: 404 });
    }

    // ✅ TRACK PAGE VIEW  - ADD THIS RIGHT HERE
    ctx.waitUntil(incrementPageView(env, 'album', albumId));

    const albumStats = await getAggregatedStats(album.songs || [], env);

    const templateObj = await env.media.get("album.html");
    if (!templateObj) {
      return new Response("album.html template not found in R2", { status: 500 });
    }
    let html = await templateObj.text();

    // ... rest of your album detail code ...
    
    return new Response(html, { 
      headers: { 
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300"
      } 
    });
  }
  
  // Album create page (GET)
  if (path === "/album/create" && req.method === "GET") {
    // ... your create form code ...
  }

  // Album create handler (POST)
  if (path === "/album/create" && req.method === "POST") {
    // ... your create POST code ...
  }

  return new Response("Not found", { status: 404 });
}