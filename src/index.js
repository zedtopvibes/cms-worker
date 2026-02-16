// ==================== MAIN ENTRY POINT ==================== 
import { CORS_HEADERS } from './middleware/cors.js';
import { handleHomepage } from './routes/home.js';
import { handleAlbums } from './routes/albums.js';
import { handleArtists } from './routes/artists.js';
import { handlePlaylists } from './routes/playlists.js';
import { handleSongs } from './routes/songs.js';
import { handleUpload } from './routes/upload.js';
import { handleCharts } from './routes/charts.js';
import { handleSearch } from './routes/search.js';
import { handleAdmin } from './routes/admin/index.js';  // <-- ADD THIS LINE

export default { 
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Handle OPTIONS requests for CORS
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // Route to appropriate handler
      
      // ADMIN ROUTES - Add this FIRST before other routes
      if (path.startsWith("/admin")) {
        return await handleAdmin(req, env, ctx);
      }
      
      if (path === "/") {
        return await handleHomepage(req, env, ctx);
      }
      
      if (path === "/search") {
        return await handleSearch(req, env, ctx);
      }
      
      if (path.startsWith("/album") || path.startsWith("/albums")) {
        return await handleAlbums(req, env, ctx);
      }
      
      if (path.startsWith("/artist") || path.startsWith("/artists")) {
        return await handleArtists(req, env, ctx);
      }
      
      if (path.startsWith("/playlist") || path.startsWith("/playlists")) {
        return await handlePlaylists(req, env, ctx);
      }
      
      if (path.startsWith("/song") || path.startsWith("/songs") || path.startsWith("/download")) {
        return await handleSongs(req, env, ctx);
      }
      
      if (path.startsWith("/charts")) {
        return await handleCharts(req, env, ctx);
      }
      
      if (path === "/upload") {
        return await handleUpload(req, env, ctx);
      }

      // Serve static files from R2
      if (path.startsWith("/images/") || 
          path.startsWith("/songs/") || 
          path.startsWith("/albums/thumbnails/") || 
          path.startsWith("/artists/thumbnails/") ||
          path.startsWith("/playlists/thumbnails/")) {
        
        const fileName = decodeURIComponent(path.slice(1));
        const obj = await env.media.get(fileName);
        
        if (!obj) {
          return new Response("File not found", { status: 404 });
        }

        let contentType = "application/octet-stream";
        if (fileName.endsWith(".mp3")) contentType = "audio/mpeg";
        else if (fileName.endsWith(".jpg")) contentType = "image/jpeg";
        else if (fileName.endsWith(".png")) contentType = "image/png";

        return new Response(obj.body, { 
          headers: { 
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=604800",
            "Accept-Ranges": "bytes"
          } 
        });
      }

      // Handle old route redirects
      if (path === "/album") {
        return Response.redirect("/albums", 301);
      }
      
      if (path === "/artist") {
        return Response.redirect("/artists", 301);
      }

      if (path === "/playlist") {
        return Response.redirect("/playlists", 301);
      }

      if (path === "/new-design") {
        return Response.redirect("/", 301);
      }

      // 404 for everything else
      return new Response("Not found", { 
        status: 404,
        headers: CORS_HEADERS 
      });
      
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(`Error: ${error.message}`, { 
        status: 500,
        headers: CORS_HEADERS
      });
    }
  }
};