// ==================== OPTIMIZED ADMIN MAIN ROUTER ==================== 
import { handleAdminLogin, handleAdminLoginPost, handleAdminLogout } from './login.js';
import { requireAdmin } from '../../middleware/adminAuth.js';
import { adminLayout } from './layout.js';
import { handleAdminUpload, handleAdminUploadPost } from './upload.js';
import { formatDuration } from '../../helpers/formatting.js';

// ===== SONGS IMPORTS =====
import { 
  handleAdminSongs, 
  handleAdminSongDelete, 
  handleAdminSongEdit, 
  handleAdminSongEditPost 
} from './songs.js';

// ===== ALBUMS IMPORTS =====
import { 
  handleAdminAlbums,
  handleAdminAlbumCreate,
  handleAdminAlbumCreatePost,
  handleAdminAlbumEdit,
  handleAdminAlbumEditPost,
  handleAdminAlbumDelete,
  handleAdminAlbumSongs,
  handleAdminAlbumSongsPost
} from './albums.js';

// ===== ARTISTS IMPORTS =====
import { 
  handleAdminArtists,
  handleAdminArtistCreate,
  handleAdminArtistCreatePost,
  handleAdminArtistEdit,
  handleAdminArtistEditPost,
  handleAdminArtistDelete,
  handleAdminArtistMerge,
  handleAdminArtistMergePost
} from './artists.js';

// ===== PLAYLISTS IMPORTS =====
import { 
  handleAdminPlaylists,
  handleAdminPlaylistCreate,
  handleAdminPlaylistCreatePost,
  handleAdminPlaylistEdit,
  handleAdminPlaylistEditPost,
  handleAdminPlaylistDelete,
  handleAdminPlaylistSongs,
  handleAdminPlaylistSongsPost
} from './playlists.js';

// ===== STATISTICS IMPORTS =====
import { handleAdminStats } from './stats.js';
import { handleAdminSearch } from './search.js';

// ===== BULK OPERATIONS IMPORTS =====
import { handleAdminBulk, executeBulkAction } from './bulk.js';

// ===== DASHBOARD IMPORTS =====
import { getDashboardStats } from '../../helpers/dashboardStats.js';
import { formatNumber } from '../../helpers/formatting.js';

// ===== ACTIVITY LOG IMPORTS =====
import { handleAdminActivity, handleAdminActivityExport } from './activity.js';

// ===== PAGE VIEWS MIGRATIONS =====
import { handleAdminMigrations } from './migrate.js';

// ===== TRASH IMPORTS =====
import { 
  handleAdminTrash,
  handleTrashRestore,
  handleTrashDelete,
  handleTrashEmpty,
  handleTrashSettings
} from './trash.js';

// ===== DUPLICATE DETECTOR IMPORTS =====
import { 
  handleDuplicateDetector,
  handleDuplicateDetectorScan,
  handleDuplicateDetectorMerge 
} from './duplicateDetector.js';

// ===== MISSING METADATA DETECTOR IMPORTS =====
import { 
  handleMissingMetadata
} from './missingMetadata.js';

// ===== CONTENT QUALITY IMPORTS =====
import { handleContentQuality } from './contentQuality.js';

// ===== GENRE MANAGEMENT IMPORTS =====
import { handleGenres } from './genres.js';

// Cache for badge stats with TTL
const badgeStatsCache = {
  duplicates: { data: null, timestamp: 0 },
  missing: { data: null, timestamp: 0 },
  quality: { data: null, timestamp: 0 },
  genres: { data: null, timestamp: 0 },
  TTL: 300000 // 5 minutes in milliseconds
};

async function getBadgeStats(env, forceRefresh = false) {
  const now = Date.now();
  const results = {};

  // Only fetch duplicates if cache expired or forced refresh
  if (forceRefresh || now - badgeStatsCache.duplicates.timestamp > badgeStatsCache.TTL) {
    try {
      const { DuplicateDetector } = await import('../../helpers/duplicateDetector.js');
      const detector = new DuplicateDetector(env);
      const duplicateStats = await detector.getDuplicateStats();
      results.totalDuplicates = duplicateStats.total.artists + duplicateStats.total.albums + 
                               duplicateStats.total.playlists + duplicateStats.total.songs;
      badgeStatsCache.duplicates = { data: results.totalDuplicates, timestamp: now };
    } catch (error) {
      console.error('Error fetching duplicate stats:', error);
      results.totalDuplicates = badgeStatsCache.duplicates.data || 0;
    }
  } else {
    results.totalDuplicates = badgeStatsCache.duplicates.data || 0;
  }

  // Only fetch missing metadata if cache expired or forced refresh
  if (forceRefresh || now - badgeStatsCache.missing.timestamp > badgeStatsCache.TTL) {
    try {
      const { MissingMetadataDetector } = await import('../../helpers/missingMetadataDetector.js');
      const missingDetector = new MissingMetadataDetector(env);
      const missingStats = await missingDetector.scanAll();
      results.totalMissingIssues = missingStats.totals.songsMissingInfo + 
                                  missingStats.totals.songsMissingThumbnails + 
                                  missingStats.totals.emptyAlbums + 
                                  missingStats.totals.emptyPlaylists + 
                                  missingStats.totals.playlistsMissingThumbnails +
                                  missingStats.totals.orphanedFiles;
      badgeStatsCache.missing = { data: results.totalMissingIssues, timestamp: now };
    } catch (error) {
      console.error('Error fetching missing stats:', error);
      results.totalMissingIssues = badgeStatsCache.missing.data || 0;
    }
  } else {
    results.totalMissingIssues = badgeStatsCache.missing.data || 0;
  }

  // Only fetch quality stats if cache expired or forced refresh
  if (forceRefresh || now - badgeStatsCache.quality.timestamp > badgeStatsCache.TTL) {
    try {
      const { ContentQualityAnalyzer } = await import('../../helpers/contentQualityAnalyzer.js');
      const qualityAnalyzer = new ContentQualityAnalyzer(env);
      const qualityStats = await qualityAnalyzer.scanAll();
      results.totalQualityIssues = qualityStats.totals.total;
      badgeStatsCache.quality = { data: results.totalQualityIssues, timestamp: now };
    } catch (error) {
      console.error('Error fetching quality stats:', error);
      results.totalQualityIssues = badgeStatsCache.quality.data || 0;
    }
  } else {
    results.totalQualityIssues = badgeStatsCache.quality.data || 0;
  }

  // Only fetch genre counts if cache expired or forced refresh
  if (forceRefresh || now - badgeStatsCache.genres.timestamp > badgeStatsCache.TTL) {
    try {
      const { GenreManager } = await import('../../helpers/genreManager.js');
      const genreManager = new GenreManager(env);
      const genresData = await genreManager.getGenres();
      results.totalGenres = genresData.genres.length;
      badgeStatsCache.genres = { data: results.totalGenres, timestamp: now };
    } catch (error) {
      console.error('Error fetching genre stats:', error);
      results.totalGenres = badgeStatsCache.genres.data || 0;
    }
  } else {
    results.totalGenres = badgeStatsCache.genres.data || 0;
  }

  return results;
}

// Route configuration to avoid repetitive code
const routeHandlers = {
  // Format: [pathPattern, methods, handler, title, menuItem]
  'album/create': { GET: handleAdminAlbumCreate, POST: handleAdminAlbumCreatePost, title: 'Create Album', menu: 'albums' },
  'artist/create': { GET: handleAdminArtistCreate, POST: handleAdminArtistCreatePost, title: 'Create Artist', menu: 'artists' },
  'playlist/create': { GET: handleAdminPlaylistCreate, POST: handleAdminPlaylistCreatePost, title: 'Create Playlist', menu: 'playlists' },
  'upload': { GET: handleAdminUpload, POST: handleAdminUploadPost, title: 'Upload Song', menu: 'upload' },
  'songs': { GET: handleAdminSongs, title: 'Manage Songs', menu: 'songs' },
  'artists': { GET: handleAdminArtists, title: 'Manage Artists', menu: 'artists' },
  'playlists': { GET: handleAdminPlaylists, title: 'Manage Playlists', menu: 'playlists' },
  'albums': { GET: handleAdminAlbums, title: 'Manage Albums', menu: 'albums' },
  'stats': { GET: handleAdminStats, title: 'Statistics', menu: 'stats' },
  'search': { GET: handleAdminSearch, title: 'Search', menu: 'search' },
  'bulk': { GET: handleAdminBulk, title: 'Bulk Operations', menu: 'bulk' },
  'activity': { GET: handleAdminActivity, title: 'Activity Log', menu: 'activity' },
  'trash': { GET: handleAdminTrash, title: 'Trash', menu: 'trash' }
};

export async function handleAdmin(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/admin', '') || '/';

  // ===== PUBLIC ADMIN ROUTES (No login required) =====
  if (path === '/login') {
    if (req.method === 'GET') return await handleAdminLogin(req, env, ctx);
    if (req.method === 'POST') return await handleAdminLoginPost(req, env, ctx);
  }

  if (path === '/logout') {
    return await handleAdminLogout(req, env, ctx);
  }

  // ===== PROTECTED ADMIN ROUTES (Login required) =====
  const auth = await requireAdmin(req, env);
  if (!auth.authenticated) return auth.response;

  // Check if this is an AJAX request that doesn't need badge stats
  const isAjax = req.headers.get('X-Requested-With') === 'XMLHttpRequest';
  
  // Only fetch badge stats if not an AJAX request and not a POST that doesn't need them
  let badgeStats = { totalDuplicates: 0, totalMissingIssues: 0, totalQualityIssues: 0, totalGenres: 0 };
  if (!isAjax && req.method !== 'POST') {
    badgeStats = await getBadgeStats(env);
  }

  // ===== DASHBOARD =====
  if (path === '/' || path === '/dashboard') {
    const stats = await getDashboardStats(env);
    
    const content = generateDashboardContent(stats, auth);
    
    return new Response(adminLayout('Dashboard', content, auth, 'dashboard', 0, 
      { total: badgeStats.totalDuplicates }, 
      { total: badgeStats.totalMissingIssues }, 
      { total: badgeStats.totalQualityIssues },
      { total: badgeStats.totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== HANDLE DELETE OPERATIONS =====
  if (path === '/albums/delete') {
    const result = await handleAdminAlbumDelete(req, env, ctx, auth);
    return handleRedirect(result, '/admin/albums?deleted=1', auth, env);
  }

  if (path === '/songs/delete') {
    const result = await handleAdminSongDelete(req, env, ctx, auth);
    return handleRedirect(result, '/admin/songs?deleted=1', auth, env);
  }

  if (path === '/artists/delete') {
    const result = await handleAdminArtistDelete(req, env, ctx, auth);
    return handleRedirect(result, '/admin/artists?deleted=1', auth, env);
  }

  if (path === '/playlists/delete') {
    const result = await handleAdminPlaylistDelete(req, env, ctx, auth);
    return handleRedirect(result, '/admin/playlists?deleted=1', auth, env);
  }

  // ===== HANDLE EDIT OPERATIONS =====
  if (path === '/songs/edit') {
    return handleEditOperation(req, env, ctx, auth, 'songs', handleAdminSongEdit, handleAdminSongEditPost);
  }

  if (path === '/artists/edit') {
    return handleEditOperation(req, env, ctx, auth, 'artists', handleAdminArtistEdit, handleAdminArtistEditPost);
  }

  if (path === '/albums/edit') {
    return handleEditOperation(req, env, ctx, auth, 'albums', handleAdminAlbumEdit, handleAdminAlbumEditPost);
  }

  if (path === '/playlists/edit') {
    return handleEditOperation(req, env, ctx, auth, 'playlists', handleAdminPlaylistEdit, handleAdminPlaylistEditPost);
  }

  // ===== HANDLE SPECIAL OPERATIONS =====
  if (path === '/albums/songs') {
    return handleAlbumSongsOperation(req, env, ctx, auth);
  }

  if (path === '/playlists/songs') {
    return handlePlaylistSongsOperation(req, env, ctx, auth);
  }

  if (path === '/artists/merge') {
    return handleArtistMergeOperation(req, env, ctx, auth);
  }

  // ===== HANDLE BULK POST =====
  if (path === '/bulk' && req.method === 'POST') {
    return await executeBulkAction(req, env, ctx, auth);
  }

  // ===== HANDLE ACTIVITY EXPORT =====
  if (path === '/activity/export') {
    return await handleAdminActivityExport(req, env, ctx, auth);
  }

  // ===== HANDLE MIGRATIONS =====
  if (path === '/migrate' || path.startsWith('/migrate/')) {
    return await handleAdminMigrations(req, env, ctx, auth);
  }

  // ===== HANDLE TRASH OPERATIONS =====
  if (path === '/trash/restore' && req.method === 'POST') {
    return await handleTrashRestore(req, env, ctx, auth);
  }

  if (path === '/trash/delete' && req.method === 'POST') {
    return await handleTrashDelete(req, env, ctx, auth);
  }

  if (path === '/trash/empty' && req.method === 'POST') {
    return await handleTrashEmpty(req, env, ctx, auth);
  }

  if (path === '/trash/settings' && req.method === 'POST') {
    return await handleTrashSettings(req, env, ctx, auth);
  }

  // ===== HANDLE DETECTOR ROUTES =====
  if (path === '/duplicate-detector') {
    return await handleDuplicateDetector(req, env, ctx, auth);
  }

  if (path === '/duplicate-detector/scan') {
    return await handleDuplicateDetectorScan(req, env, ctx, auth);
  }

  if (path === '/duplicate-detector/merge' && req.method === 'GET') {
    return await handleDuplicateDetectorMerge(req, env, ctx, auth);
  }

  if (path === '/missing-metadata' || path.startsWith('/missing-metadata/')) {
    return await handleMissingMetadata(req, env, ctx, auth);
  }

  if (path === '/content-quality' || path.startsWith('/content-quality/')) {
    return await handleContentQuality(req, env, ctx, auth);
  }

  if (path === '/genres' || path.startsWith('/genres/')) {
    return await handleGenres(req, env, ctx, auth);
  }

  // ===== HANDLE REGULAR ROUTES FROM CONFIG =====
  for (const [routePath, handlers] of Object.entries(routeHandlers)) {
    if (path === `/${routePath}` || (routePath === 'songs' && path === '/songs')) {
      const handler = handlers[req.method];
      if (handler) {
        // For POST requests, handle directly without layout
        if (req.method === 'POST') {
          const result = await handler(req, env, ctx, auth);
          if (result && result.redirect) {
            return new Response(null, {
              status: 302,
              headers: { Location: result.redirect }
            });
          }
          if (result && result.success === false) {
            const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
            return new Response(adminLayout(handlers.title, content, auth, handlers.menu, 0,
              { total: badgeStats.totalDuplicates },
              { total: badgeStats.totalMissingIssues },
              { total: badgeStats.totalQualityIssues },
              { total: badgeStats.totalGenres }
            ), {
              headers: { 'Content-Type': 'text/html' }
            });
          }
          return result;
        }

        // For GET requests, use layout
        const content = await handler(req, env, ctx, auth);
        if (content && content.redirect) {
          return new Response(null, {
            status: 302,
            headers: { Location: content.redirect }
          });
        }
        
        return new Response(adminLayout(handlers.title, content, auth, handlers.menu, 0,
          { total: badgeStats.totalDuplicates },
          { total: badgeStats.totalMissingIssues },
          { total: badgeStats.totalQualityIssues },
          { total: badgeStats.totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      break;
    }
  }

  // ===== PLACEHOLDER ROUTES (Lazy loaded when accessed) =====
  const placeholderRoutes = {
    '/announcements': { title: 'Announcement System', icon: 'bullhorn', menu: 'announcements' },
    '/moderation': { title: 'Content Moderation', icon: 'shield-alt', menu: 'moderation' },
    '/user-management': { title: 'User Management', icon: 'users-cog', menu: 'user-management' },
    '/scheduled-tasks': { title: 'Scheduled Tasks', icon: 'clock', menu: 'scheduled-tasks' },
    '/ai-tagging': { title: 'AI-Powered Tagging', icon: 'robot', menu: 'ai-tagging' },
    '/ad-management': { title: 'Ad Management', icon: 'ad', menu: 'ad-management' },
    '/system-settings': { title: 'System Settings', icon: 'cogs', menu: 'system-settings' },
    '/theme-customizer': { title: 'Theme Customizer', icon: 'palette', menu: 'theme-customizer' }
  };

  for (const [routePath, config] of Object.entries(placeholderRoutes)) {
    if (path === routePath) {
      const content = generatePlaceholderContent(config);
      return new Response(adminLayout(config.title, content, auth, config.menu, 0,
        { total: badgeStats.totalDuplicates },
        { total: badgeStats.totalMissingIssues },
        { total: badgeStats.totalQualityIssues },
        { total: badgeStats.totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // ===== 404 - Page Not Found =====
  return generate404Response();
}

// Helper function to handle redirects with error handling
function handleRedirect(result, defaultRedirect, auth, env) {
  if (result.success) {
    return new Response(null, {
      status: 302,
      headers: { Location: result.redirect || defaultRedirect }
    });
  } else {
    const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
    return new Response(adminLayout('Error', content, auth, '', 0,
      { total: 0 }, { total: 0 }, { total: 0 }, { total: 0 }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Helper function for edit operations
async function handleEditOperation(req, env, ctx, auth, type, getHandler, postHandler) {
  if (req.method === 'GET') {
    const result = await getHandler(req, env, ctx, auth);
    if (result.redirect) {
      return new Response(null, { status: 302, headers: { Location: result.redirect } });
    }
    const badgeStats = await getBadgeStats(env);
    return new Response(adminLayout(`Edit ${type.slice(0,-1)}`, result.content, auth, type, 0,
      { total: badgeStats.totalDuplicates },
      { total: badgeStats.totalMissingIssues },
      { total: badgeStats.totalQualityIssues },
      { total: badgeStats.totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  if (req.method === 'POST') {
    const result = await postHandler(req, env, ctx, auth);
    if (result.success) {
      return new Response(null, {
        status: 302,
        headers: { Location: result.redirect || `/admin/${type}?updated=1` }
      });
    } else {
      const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
      const badgeStats = await getBadgeStats(env);
      return new Response(adminLayout('Error', content, auth, type, 0,
        { total: badgeStats.totalDuplicates },
        { total: badgeStats.totalMissingIssues },
        { total: badgeStats.totalQualityIssues },
        { total: badgeStats.totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
}

// Helper function for album songs operation
async function handleAlbumSongsOperation(req, env, ctx, auth) {
  if (req.method === 'GET') {
    const result = await handleAdminAlbumSongs(req, env, ctx, auth);
    if (result.redirect) {
      return new Response(null, { status: 302, headers: { Location: result.redirect } });
    }
    const badgeStats = await getBadgeStats(env);
    return new Response(adminLayout('Album Songs', result.content, auth, 'albums', 0,
      { total: badgeStats.totalDuplicates },
      { total: badgeStats.totalMissingIssues },
      { total: badgeStats.totalQualityIssues },
      { total: badgeStats.totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  if (req.method === 'POST') {
    const result = await handleAdminAlbumSongsPost(req, env, ctx, auth);
    if (result.success) {
      return new Response(null, {
        status: 302,
        headers: { Location: result.redirect || '/admin/albums?updated=1' }
      });
    } else {
      const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
      const badgeStats = await getBadgeStats(env);
      return new Response(adminLayout('Error', content, auth, 'albums', 0,
        { total: badgeStats.totalDuplicates },
        { total: badgeStats.totalMissingIssues },
        { total: badgeStats.totalQualityIssues },
        { total: badgeStats.totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
}

// Similar helper for playlist songs operation
async function handlePlaylistSongsOperation(req, env, ctx, auth) {
  if (req.method === 'GET') {
    const result = await handleAdminPlaylistSongs(req, env, ctx, auth);
    if (result.redirect) {
      return new Response(null, { status: 302, headers: { Location: result.redirect } });
    }
    const badgeStats = await getBadgeStats(env);
    return new Response(adminLayout('Playlist Songs', result.content, auth, 'playlists', 0,
      { total: badgeStats.totalDuplicates },
      { total: badgeStats.totalMissingIssues },
      { total: badgeStats.totalQualityIssues },
      { total: badgeStats.totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  if (req.method === 'POST') {
    const result = await handleAdminPlaylistSongsPost(req, env, ctx, auth);
    if (result.success) {
      return new Response(null, {
        status: 302,
        headers: { Location: result.redirect || '/admin/playlists?updated=1' }
      });
    } else {
      const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
      const badgeStats = await getBadgeStats(env);
      return new Response(adminLayout('Error', content, auth, 'playlists', 0,
        { total: badgeStats.totalDuplicates },
        { total: badgeStats.totalMissingIssues },
        { total: badgeStats.totalQualityIssues },
        { total: badgeStats.totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
}

// Helper for artist merge operation
async function handleArtistMergeOperation(req, env, ctx, auth) {
  if (req.method === 'GET') {
    const result = await handleAdminArtistMerge(req, env, ctx, auth);
    if (result.redirect) {
      return new Response(null, { status: 302, headers: { Location: result.redirect } });
    }
    const badgeStats = await getBadgeStats(env);
    return new Response(adminLayout('Merge Artists', result.content, auth, 'artists', 0,
      { total: badgeStats.totalDuplicates },
      { total: badgeStats.totalMissingIssues },
      { total: badgeStats.totalQualityIssues },
      { total: badgeStats.totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  if (req.method === 'POST') {
    const result = await handleAdminArtistMergePost(req, env, ctx, auth);
    if (result.success) {
      return new Response(null, {
        status: 302,
        headers: { Location: result.redirect || '/admin/artists?merged=1' }
      });
    } else {
      const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
      const badgeStats = await getBadgeStats(env);
      return new Response(adminLayout('Error', content, auth, 'artists', 0,
        { total: badgeStats.totalDuplicates },
        { total: badgeStats.totalMissingIssues },
        { total: badgeStats.totalQualityIssues },
        { total: badgeStats.totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
}

// Generate dashboard content (extracted for better organization)
function generateDashboardContent(stats, auth) {
  return `
    <div style="margin-bottom: 20px;">
        <!-- Welcome Header -->
        <div style="margin-bottom: 25px;">
            <h2 style="font-size: 1.5rem; margin-bottom: 5px;">Welcome back, ${auth.session.username}!</h2>
            <p style="color: #666;">${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <!-- Stats Grid -->
        <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
            <div class="stat-card" style="padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="color: rgba(255,255,255,0.9); font-size: 0.8rem; margin:0;">👁️ Views Today</h3>
                    <span style="background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 20px; font-size: 0.7rem;">${stats.viewsTrend}</span>
                </div>
                <div style="font-size: 2rem; font-weight: 700; margin-bottom: 5px;">${formatNumber(stats.viewsToday)}</div>
                <div style="font-size: 0.75rem; opacity: 0.9;">${stats.viewsTrendValue} from yesterday</div>
            </div>
            
            <div class="stat-card" style="padding: 15px; background: linear-gradient(135deg, #ff5500, #ff8c00); color: white; border: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="color: rgba(255,255,255,0.9); font-size: 0.8rem; margin:0;">▶️ Plays Today</h3>
                    <span style="background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 20px; font-size: 0.7rem;">${stats.playsTrend}</span>
                </div>
                <div style="font-size: 2rem; font-weight: 700; margin-bottom: 5px;">${formatNumber(stats.playsToday)}</div>
                <div style="font-size: 0.75rem; opacity: 0.9;">${stats.playsTrendValue} from yesterday</div>
            </div>
            
            <div class="stat-card" style="padding: 15px; background: linear-gradient(135deg, #28a745, #20c997); color: white; border: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="color: rgba(255,255,255,0.9); font-size: 0.8rem; margin:0;">⬇️ Downloads Today</h3>
                    <span style="background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 20px; font-size: 0.7rem;">${stats.downloadsTrend}</span>
                </div>
                <div style="font-size: 2rem; font-weight: 700; margin-bottom: 5px;">${formatNumber(stats.downloadsToday)}</div>
                <div style="font-size: 0.75rem; opacity: 0.9;">${stats.downloadsTrendValue} from yesterday</div>
            </div>
        </div>
        
        <!-- Rest of your dashboard content remains the same -->
        ${generateDashboardRest(stats)}
    </div>
  `;
}

function generateDashboardRest(stats) {
  // Extract the rest of your dashboard HTML here
  // (Keeping it short for brevity - copy your existing dashboard HTML)
  return ``; // Add your existing dashboard HTML here
}

function generatePlaceholderContent(config) {
  return `
    <div class="empty-state">
        <i class="fas fa-${config.icon}"></i>
        <h3>${config.title}</h3>
        <p>This feature is coming soon. You'll be able to manage all aspects of ${config.title.toLowerCase()} from here.</p>
        <div style="margin-top: 30px;">
            <a href="/admin/dashboard" class="btn btn-primary">
                <i class="fas fa-tachometer-alt"></i> Back to Dashboard
            </a>
        </div>
    </div>
  `;
}

function generate404Response() {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Page Not Found - Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                   background: #f0f2f5; display: flex; align-items: center; justify-content: center; 
                   min-height: 100vh; margin: 0; padding: 20px; }
            .error-box { background: white; padding: 40px; border-radius: 12px; text-align: center; 
                         max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            h1 { color: #ff5500; font-size: 3rem; margin-bottom: 10px; }
            h2 { color: #333; margin-bottom: 15px; }
            p { color: #666; margin-bottom: 25px; }
            .btn { display: inline-block; padding: 12px 24px; background: #ff5500; color: white; 
                   text-decoration: none; border-radius: 6px; font-weight: 600; }
            .btn:hover { background: #ff6a1a; }
        </style>
    </head>
    <body>
        <div class="error-box">
            <h1>404</h1>
            <h2>Page Not Found</h2>
            <p>The admin page you're looking for doesn't exist.</p>
            <a href="/admin" class="btn">
                <i class="fas fa-arrow-left"></i> Back to Dashboard
            </a>
        </div>
    </body>
    </html>
  `, { 
    status: 404, 
    headers: { 'Content-Type': 'text/html' } 
  });
}