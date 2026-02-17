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
import { handleAdmin } from './routes/admin/index.js';
import { handleCron } from './helpers/cron.js';
import { handleDebug } from './routes/debug.js';  // Add debug routes
import { updateDailyStats, getDashboardStats } from './helpers/dashboardStats.js';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Add request ID for tracking
    const requestId = crypto.randomUUID().slice(0, 8);
    console.log(`[${requestId}] ${method} ${path}`);

    // Handle OPTIONS requests for CORS
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // ===== DEBUG ROUTES (Highest priority for testing) =====
      if (path.startsWith("/debug")) {
        return await handleDebug(req, env, ctx);
      }

      // ===== CRON TRIGGER (Can be called manually for testing) =====
      if (path === "/cron/update-daily-stats" && method === "POST") {
        console.log(`[${requestId}] Manually triggering daily stats update`);
        const result = await updateDailyStats(env);
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Daily stats updated",
          data: result 
        }), { 
          headers: { 
            "Content-Type": "application/json",
            ...CORS_HEADERS 
          } 
        });
      }

      // ===== HEALTH CHECK =====
      if (path === "/health") {
        return new Response(JSON.stringify({
          status: "OK",
          timestamp: new Date().toISOString(),
          requestId,
          environment: env.ENVIRONMENT || "production"
        }), {
          headers: { 
            "Content-Type": "application/json",
            ...CORS_HEADERS 
          }
        });
      }

      // ===== ADMIN ROUTES (High priority) =====
      if (path.startsWith("/admin")) {
        return await handleAdmin(req, env, ctx);
      }
      
      // ===== USER ROUTES (Reserved for future user system) =====
      if (path === "/login") {
        return new Response("User login coming soon", { 
          status: 501,
          headers: CORS_HEADERS
        });
      }
      
      if (path === "/logout") {
        return new Response("User logout coming soon", { 
          status: 501,
          headers: CORS_HEADERS
        });
      }
      
      if (path === "/signup") {
        return new Response("User registration coming soon", { 
          status: 501,
          headers: CORS_HEADERS
        });
      }
      
      if (path === "/profile") {
        return new Response("User profile coming soon", { 
          status: 501,
          headers: CORS_HEADERS
        });
      }
      
      // ===== PUBLIC ROUTES =====
      if (path === "/") {
        // Record homepage view
        ctx.waitUntil(incrementPageView(env, 'page', 'homepage').catch(e => 
          console.error(`[${requestId}] Failed to record homepage view:`, e)
        ));
        return await handleHomepage(req, env, ctx);
      }
      
      if (path === "/search") {
        return await handleSearch(req, env, ctx);
      }
      
      if (path.startsWith("/album") || path.startsWith("/albums")) {
        // Extract album ID from path
        const albumId = path.split('/')[2];
        if (albumId) {
          ctx.waitUntil(incrementPageView(env, 'album', albumId).catch(e => 
            console.error(`[${requestId}] Failed to record album view:`, e)
          ));
        }
        return await handleAlbums(req, env, ctx);
      }
      
      if (path.startsWith("/artist") || path.startsWith("/artists")) {
        // Extract artist ID from path
        const artistId = path.split('/')[2];
        if (artistId) {
          ctx.waitUntil(incrementPageView(env, 'artist', artistId).catch(e => 
            console.error(`[${requestId}] Failed to record artist view:`, e)
          ));
        }
        return await handleArtists(req, env, ctx);
      }
      
      if (path.startsWith("/playlist") || path.startsWith("/playlists")) {
        // Extract playlist ID from path
        const playlistId = path.split('/')[2];
        if (playlistId) {
          ctx.waitUntil(incrementPageView(env, 'playlist', playlistId).catch(e => 
            console.error(`[${requestId}] Failed to record playlist view:`, e)
          ));
        }
        return await handlePlaylists(req, env, ctx);
      }
      
      if (path.startsWith("/song") || path.startsWith("/songs") || path.startsWith("/download")) {
        // For song pages, record view
        if (path.startsWith("/song/")) {
          const songId = path.split('/')[2];
          if (songId) {
            ctx.waitUntil(incrementPageView(env, 'song', songId).catch(e => 
              console.error(`[${requestId}] Failed to record song view:`, e)
            ));
          }
        }
        return await handleSongs(req, env, ctx);
      }
      
      if (path.startsWith("/charts")) {
        // Record chart view
        const chartType = path.split('/')[2] || 'overview';
        ctx.waitUntil(incrementPageView(env, 'chart', `charts-${chartType}`).catch(e => 
          console.error(`[${requestId}] Failed to record chart view:`, e)
        ));
        return await handleCharts(req, env, ctx);
      }
      
      if (path === "/upload") {
        return await handleUpload(req, env, ctx);
      }

      // ===== STATIC FILES =====
      if (path.startsWith("/images/") || 
          path.startsWith("/songs/") || 
          path.startsWith("/albums/thumbnails/") || 
          path.startsWith("/artists/thumbnails/") ||
          path.startsWith("/playlists/thumbnails/")) {
        
        const fileName = decodeURIComponent(path.slice(1));
        const obj = await env.media.get(fileName);
        
        if (!obj) {
          console.log(`[${requestId}] File not found: ${fileName}`);
          return new Response("File not found", { 
            status: 404,
            headers: CORS_HEADERS
          });
        }

        let contentType = "application/octet-stream";
        if (fileName.endsWith(".mp3")) contentType = "audio/mpeg";
        else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) contentType = "image/jpeg";
        else if (fileName.endsWith(".png")) contentType = "image/png";
        else if (fileName.endsWith(".gif")) contentType = "image/gif";
        else if (fileName.endsWith(".webp")) contentType = "image/webp";
        else if (fileName.endsWith(".css")) contentType = "text/css";
        else if (fileName.endsWith(".js")) contentType = "application/javascript";

        return new Response(obj.body, { 
          headers: { 
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=604800, immutable",
            "Accept-Ranges": "bytes",
            "X-Request-ID": requestId,
            ...CORS_HEADERS
          } 
        });
      }

      // ===== REDIRECTS =====
      if (path === "/album") return Response.redirect(new URL("/albums", url), 301);
      if (path === "/artist") return Response.redirect(new URL("/artists", url), 301);
      if (path === "/playlist") return Response.redirect(new URL("/playlists", url), 301);
      if (path === "/new-design") return Response.redirect(new URL("/", url), 301);
      if (path === "/stats") return Response.redirect(new URL("/admin/dashboard", url), 301);
      if (path === "/dashboard") return Response.redirect(new URL("/admin/dashboard", url), 301);

      // ===== 404 =====
      console.log(`[${requestId}] 404 - Path not found: ${path}`);
      return new Response("Not found", { 
        status: 404,
        headers: CORS_HEADERS 
      });
      
    } catch (error) {
      console.error(`[${requestId}] Worker error:`, error);
      
      // Return appropriate error response
      const isJson = req.headers.get("Accept")?.includes("application/json");
      
      if (isJson) {
        return new Response(JSON.stringify({ 
          error: "Internal server error",
          message: env.ENVIRONMENT === "development" ? error.message : undefined,
          requestId
        }), { 
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            ...CORS_HEADERS
          }
        });
      }
      
      return new Response(`Error: ${error.message}`, { 
        status: 500,
        headers: CORS_HEADERS
      });
    }
  },

  // ===== CRON JOB HANDLER =====
  async scheduled(event, env, ctx) {
    const startTime = Date.now();
    console.log(`🕛 Cron triggered: ${event.cron}`);
    
    try {
      // Run the daily stats update
      await updateDailyStats(env);
      
      // Run any other cleanup tasks
      await handleCron(event, env, ctx);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Cron completed in ${duration}ms`);
      
    } catch (error) {
      console.error('❌ Cron job failed:', error);
    }
  }
};

// Helper function to increment page views (import dynamically to avoid circular deps)
async function incrementPageView(env, pageType, pageId) {
  try {
    const { incrementPageView } = await import('./helpers/pageViews.js');
    return await incrementPageView(env, pageType, pageId);
  } catch (error) {
    console.error('Error in incrementPageView helper:', error);
    return false;
  }
}