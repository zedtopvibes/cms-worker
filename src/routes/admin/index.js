// ==================== ADMIN MAIN ROUTER ====================
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
import { DuplicateDetector } from '../../helpers/duplicateDetector.js';

// ===== MISSING METADATA DETECTOR IMPORTS =====
import { 
  handleMissingMetadata
} from './missingMetadata.js';
import { MissingMetadataDetector } from '../../helpers/missingMetadataDetector.js';

// ===== CONTENT QUALITY IMPORTS =====
import { handleContentQuality } from './contentQuality.js';
import { ContentQualityAnalyzer } from '../../helpers/contentQualityAnalyzer.js';

// ===== GENRE MANAGEMENT IMPORTS =====
import { handleGenres } from './genres.js';
import { GenreManager } from '../../helpers/genreManager.js';

import { handleSlugs } from './slugs.js';

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

  // Get duplicate counts for all protected routes (for the badge)
  const detector = new DuplicateDetector(env);
  const duplicateStats = await detector.getDuplicateStats();
  const totalDuplicates = duplicateStats.total.artists + duplicateStats.total.albums + 
                         duplicateStats.total.playlists + duplicateStats.total.songs;

  // Get missing metadata counts for the badge
  const missingDetector = new MissingMetadataDetector(env);
  const missingStats = await missingDetector.scanAll();
  const totalMissingIssues = missingStats.totals.songsMissingInfo + 
                            missingStats.totals.songsMissingThumbnails + 
                            missingStats.totals.emptyAlbums + 
                            missingStats.totals.emptyPlaylists + 
                            missingStats.totals.playlistsMissingThumbnails +
                            missingStats.totals.orphanedFiles;

  // Get content quality counts for the badge
  const qualityAnalyzer = new ContentQualityAnalyzer(env);
  const qualityStats = await qualityAnalyzer.scanAll();
  const totalQualityIssues = qualityStats.totals.total;

  // Get genre counts for the badge
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  const totalGenres = genresData.genres.length;

  // ===== DASHBOARD =====
  if (path === '/' || path === '/dashboard') {
    const stats = await getDashboardStats(env);
    
    const content = `
      <div style="margin-bottom: 20px;">
          <!-- Welcome Header -->
          <div style="margin-bottom: 25px;">
              <h2 style="font-size: 1.5rem; margin-bottom: 5px;">Welcome back, ${auth.session.username}!</h2>
              <p style="color: #666;">${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <!-- Real-time Stats Grid -->
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
          
          <!-- Second Row Stats -->
          <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 25px;">
              <div class="stat-card" style="padding: 12px;">
                  <h3 style="font-size: 0.7rem; color: #666;">🎵 New Songs</h3>
                  <div style="font-size: 1.8rem; font-weight: 700; color: #ff5500;">${stats.newSongs}</div>
                  <div style="font-size: 0.7rem; color: #999;">this week</div>
              </div>
              
              <div class="stat-card" style="padding: 12px;">
                  <h3 style="font-size: 0.7rem; color: #666;">💿 New Albums</h3>
                  <div style="font-size: 1.8rem; font-weight: 700; color: #ff5500;">${stats.newAlbums}</div>
                  <div style="font-size: 0.7rem; color: #999;">this week</div>
              </div>
              
              <div class="stat-card" style="padding: 12px;">
                  <h3 style="font-size: 0.7rem; color: #666;">🎤 New Artists</h3>
                  <div style="font-size: 1.8rem; font-weight: 700; color: #ff5500;">${stats.newArtists}</div>
                  <div style="font-size: 0.7rem; color: #999;">this week</div>
              </div>
          </div>
          
          <!-- Quick Actions Panel -->
          <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <h3 style="margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                  <i class="fas fa-bolt" style="color: #ff5500;"></i> 
                  Quick Actions
              </h3>
              
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                  <a href="/admin/upload" class="quick-action-btn">
                      <i class="fas fa-cloud-upload-alt" style="font-size: 1.5rem; color: #ff5500;"></i>
                      <span>Upload Song</span>
                  </a>
                  <a href="/admin/album/create" class="quick-action-btn">
                      <i class="fas fa-compact-disc" style="font-size: 1.5rem; color: #28a745;"></i>
                      <span>New Album</span>
                  </a>
                  <a href="/admin/artist/create" class="quick-action-btn">
                      <i class="fas fa-microphone" style="font-size: 1.5rem; color: #9b59b6;"></i>
                      <span>New Artist</span>
                  </a>
                  <a href="/admin/playlist/create" class="quick-action-btn">
                      <i class="fas fa-list" style="font-size: 1.5rem; color: #4a90e2;"></i>
                      <span>New Playlist</span>
                  </a>
                  <a href="/admin/stats" class="quick-action-btn">
                      <i class="fas fa-chart-line" style="font-size: 1.5rem; color: #e67e22;"></i>
                      <span>View Stats</span>
                  </a>
                  <a href="/admin/search" class="quick-action-btn">
                      <i class="fas fa-search" style="font-size: 1.5rem; color: #e74c3c;"></i>
                      <span>Search</span>
                  </a>
              </div>
          </div>
          
          <!-- 7-Day Trend Chart -->
          <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                  <h4 style="font-size: 1rem;"><i class="fas fa-chart-line" style="color: #ff5500;"></i> 7-Day Activity</h4>
                  <div style="display: flex; gap: 15px; font-size: 0.7rem;">
                      <span><span style="color: #ff5500;">■</span> Views</span>
                      <span><span style="color: #4a90e2;">■</span> Plays</span>
                      <span><span style="color: #28a745;">■</span> Downloads</span>
                  </div>
              </div>
              
              <div style="display: flex; justify-content: space-between; align-items: flex-end; height: 150px; margin-bottom: 10px;">
                  ${stats.weeklyData.map(day => `
                      <div style="display: flex; flex-direction: column; align-items: center; width: 12%;">
                          <div style="display: flex; gap: 2px; width: 100%; justify-content: center;">
                              <div style="width: 8px; height: ${day.views}px; background: #ff5500; border-radius: 4px 4px 0 0;"></div>
                              <div style="width: 8px; height: ${day.plays}px; background: #4a90e2; border-radius: 4px 4px 0 0;"></div>
                              <div style="width: 8px; height: ${day.downloads}px; background: #28a745; border-radius: 4px 4px 0 0;"></div>
                          </div>
                          <div style="font-size: 0.6rem; margin-top: 5px; color: #666;">${day.label}</div>
                      </div>
                  `).join('')}
              </div>
          </div>
          
          <!-- Top Content This Week -->
          <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <h4 style="margin-bottom: 15px; font-size: 1rem;"><i class="fas fa-fire" style="color: #ff5500;"></i> Top Content This Week</h4>
              
              <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${stats.topContent.map((item, index) => `
                      <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                          <span style="width: 24px; height: 24px; background: ${index === 0 ? '#ff5500' : index === 1 ? '#4a90e2' : index === 2 ? '#28a745' : '#f0f0f0'}; color: ${index < 3 ? 'white' : '#666'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700;">${index + 1}</span>
                          <div style="flex: 1;">
                              <div style="font-weight: 600; font-size: 0.9rem;">${item.title}</div>
                              <div style="font-size: 0.7rem; color: #666;">${item.type} • ${item.artist}</div>
                          </div>
                          <span style="font-weight: 600; color: #ff5500;">${formatNumber(item.views)} 👁️</span>
                      </div>
                  `).join('')}
              </div>
              
              <div style="margin-top: 15px; text-align: center;">
                  <a href="/admin/stats" class="btn btn-secondary btn-sm">View All Stats →</a>
              </div>
          </div>
          
          <!-- Recent Activity Feed -->
          <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <h4 style="margin-bottom: 15px; font-size: 1rem;"><i class="fas fa-clock" style="color: #ff5500;"></i> Recent Activity</h4>
              
              <div style="display: flex; flex-direction: column; gap: 12px;">
                  ${stats.recentActivity.map(activity => `
                      <div style="display: flex; align-items: center; gap: 10px;">
                          <span style="width: 28px; height: 28px; background: ${activity.iconBg}; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">
                              <i class="fas ${activity.icon}"></i>
                          </span>
                          <div style="flex: 1;">
                              <div style="font-size: 0.85rem;">${activity.text}</div>
                              <div style="font-size: 0.65rem; color: #999;">${activity.time}</div>
                          </div>
                          ${activity.link ? `<a href="${activity.link}" style="color: #ff5500; font-size: 0.8rem;">View →</a>` : ''}
                      </div>
                  `).join('')}
              </div>
          </div>
          
          <!-- Quick Actions (Mobile) -->
          <h2 style="margin: 20px 0 15px; font-size: 1.1rem;"><i class="fas fa-bolt" style="color: #ff5500;"></i> Quick Actions</h2>
          
          <!-- Mobile Cards -->
          <div class="mobile-cards">
              <div class="mobile-card" onclick="window.location='/admin/upload'" style="cursor: pointer;">
                  <div class="mobile-card-row">
                      <span class="mobile-card-label"><i class="fas fa-cloud-upload-alt" style="color: #ff5500;"></i> Upload Song</span>
                      <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                  </div>
              </div>
              <div class="mobile-card" onclick="window.location='/admin/songs'" style="cursor: pointer;">
                  <div class="mobile-card-row">
                      <span class="mobile-card-label"><i class="fas fa-music" style="color: #ff5500;"></i> Manage Songs</span>
                      <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                  </div>
              </div>
              <div class="mobile-card" onclick="window.location='/admin/albums'" style="cursor: pointer;">
                  <div class="mobile-card-row">
                      <span class="mobile-card-label"><i class="fas fa-compact-disc" style="color: #ff5500;"></i> Manage Albums</span>
                      <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                  </div>
              </div>
              <div class="mobile-card" onclick="window.location='/admin/artists'" style="cursor: pointer;">
                  <div class="mobile-card-row">
                      <span class="mobile-card-label"><i class="fas fa-microphone" style="color: #ff5500;"></i> Manage Artists</span>
                      <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                  </div>
              </div>
              <div class="mobile-card" onclick="window.location='/admin/playlists'" style="cursor: pointer;">
                  <div class="mobile-card-row">
                      <span class="mobile-card-label"><i class="fas fa-list" style="color: #ff5500;"></i> Manage Playlists</span>
                      <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                  </div>
              </div>
              <div class="mobile-card" onclick="window.location='/admin/stats'" style="cursor: pointer;">
                  <div class="mobile-card-row">
                      <span class="mobile-card-label"><i class="fas fa-chart-line" style="color: #ff5500;"></i> View Statistics</span>
                      <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                  </div>
              </div>
          </div>
          
          <!-- Desktop Grid -->
          <div class="desktop-actions" style="display: none;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                  <a href="/admin/upload" class="btn btn-primary">Upload Song</a>
                  <a href="/admin/songs" class="btn btn-secondary">Songs</a>
                  <a href="/admin/albums" class="btn btn-secondary">Albums</a>
                  <a href="/admin/artists" class="btn btn-secondary">Artists</a>
                  <a href="/admin/playlists" class="btn btn-secondary">Playlists</a>
                  <a href="/admin/stats" class="btn btn-secondary">Stats</a>
              </div>
          </div>
          
          <style>
              .quick-action-btn {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  padding: 15px 10px;
                  background: #f8f9fa;
                  border-radius: 8px;
                  text-decoration: none;
                  color: #333;
                  transition: all 0.3s;
                  border: 1px solid #e8e8e8;
                  min-height: 80px;
              }
              
              .quick-action-btn:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                  border-color: #ff5500;
              }
              
              .quick-action-btn span {
                  margin-top: 5px;
                  font-size: 0.8rem;
                  font-weight: 600;
              }
              
              @media (min-width: 768px) {
                  .mobile-cards { display: none; }
                  .desktop-actions { display: block !important; }
              }
          </style>
      </div>
    `;
      
    return new Response(adminLayout('Dashboard', content, auth, 'dashboard', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== CREATE ALBUM PAGE =====
  if (path === '/album/create') {
    if (req.method === 'GET') {
      const content = await handleAdminAlbumCreate(req, env, ctx, auth);
      return new Response(adminLayout('Create Album', content, auth, 'albums', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    if (req.method === 'POST') {
      const result = await handleAdminAlbumCreatePost(req, env, ctx, auth);
      if (result.success) {
        return new Response(null, {
          status: 302,
          headers: { Location: result.redirect || '/admin/albums?created=1' }
        });
      } else {
        const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
        return new Response(adminLayout('Error', content, auth, 'albums', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  }

  // ===== CREATE ARTIST PAGE =====
  if (path === '/artist/create') {
    if (req.method === 'GET') {
      const content = await handleAdminArtistCreate(req, env, ctx, auth);
      return new Response(adminLayout('Create Artist', content, auth, 'artists', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    if (req.method === 'POST') {
      const result = await handleAdminArtistCreatePost(req, env, ctx, auth);
      if (result.success) {
        return new Response(null, {
          status: 302,
          headers: { Location: result.redirect || '/admin/artists?created=1' }
        });
      } else {
        const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
        return new Response(adminLayout('Error', content, auth, 'artists', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  }

  // ===== CREATE PLAYLIST PAGE =====
  if (path === '/playlist/create') {
    if (req.method === 'GET') {
      const content = await handleAdminPlaylistCreate(req, env, ctx, auth);
      return new Response(adminLayout('Create Playlist', content, auth, 'playlists', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    if (req.method === 'POST') {
      const result = await handleAdminPlaylistCreatePost(req, env, ctx, auth);
      if (result.success) {
        return new Response(null, {
          status: 302,
          headers: { Location: result.redirect || '/admin/playlists?created=1' }
        });
      } else {
        const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
        return new Response(adminLayout('Error', content, auth, 'playlists', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  }

  // ===== UPLOAD SONG =====
  if (path === '/upload') {
    if (req.method === 'GET') {
      const content = await handleAdminUpload(req, env, ctx, auth);
      return new Response(adminLayout('Upload Song', content, auth, 'upload', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    if (req.method === 'POST') {
      const result = await handleAdminUploadPost(req, env, ctx, auth);
      if (!result.success) {
        const content = `
          <div class="alert alert-danger" style="margin-bottom: 20px;">
              <i class="fas fa-exclamation-circle"></i>
              Error: ${result.error}
          </div>
          <a href="/admin/upload" class="btn btn-primary">
              <i class="fas fa-arrow-left"></i> Try Again
          </a>
        `;
        return new Response(adminLayout('Upload Failed', content, auth, 'upload', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
      // SUCCESS PAGE - UPDATED WITH SLUGS
      const content = `
        <div style="text-align: center; padding: 20px 10px;">
            <div style="background: #d4edda; color: #155724; padding: 25px 20px; border-radius: 12px; margin-bottom: 30px;">
                <i class="fas fa-check-circle" style="font-size: 4rem; margin-bottom: 15px; color: #28a745;"></i>
                <h2 style="margin-bottom: 10px; font-size: 1.5rem;">Upload Successful!</h2>
                <p style="font-size: 1.2rem; margin-bottom: 5px; font-weight: 600;">${result.title}</p>
                <p style="color: #666; margin-bottom: 15px;">by ${result.artistName}</p>
                <div style="background: white; padding: 12px; border-radius: 8px; display: inline-block;">
                    <i class="fas fa-clock" style="color: #ff5500;"></i>
                    <strong>Duration:</strong> ${formatDuration(result.duration)}
                </div>
                <div style="margin-top: 15px; background: #f8f9fa; padding: 10px; border-radius: 8px;">
                    <i class="fas fa-link" style="color: #ff5500;"></i>
                    <span style="font-family: monospace; background: white; padding: 4px 8px; border-radius: 4px;">/song/${result.slug}</span>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px; margin: 0 auto;">
                <!-- View Song - Now using slug -->
                <a href="/song/${result.slug}" class="btn btn-primary" target="_blank" style="padding: 16px;">
                    <i class="fas fa-play"></i> View Song
                </a>
                
                <!-- Upload Another -->
                <a href="/admin/upload" class="btn btn-secondary" style="padding: 16px;">
                    <i class="fas fa-cloud-upload-alt"></i> Upload Another Song
                </a>
                
                <!-- Album Link - If album exists -->
                ${result.albumId ? `
                    <a href="/album/${result.albumId}" class="btn btn-secondary" target="_blank" style="padding: 16px;">
                        <i class="fas fa-compact-disc"></i> View Album
                    </a>
                ` : ''}
                
                <!-- Playlist Link - If playlist exists -->
                ${result.playlistId ? `
                    <a href="/playlist/${result.playlistId}" class="btn btn-secondary" target="_blank" style="padding: 16px;">
                        <i class="fas fa-list"></i> View Playlist
                    </a>
                ` : ''}
                
                <!-- Back to Dashboard -->
                <a href="/admin/dashboard" class="btn btn-secondary" style="padding: 16px; background: #f0f0f0;">
                    <i class="fas fa-tachometer-alt"></i> Back to Dashboard
                </a>
            </div>
        </div>
      `;
      
      return new Response(adminLayout('Upload Successful', content, auth, 'upload', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // ===== ALBUMS MANAGEMENT =====
  if (path === '/albums') {
    const content = await handleAdminAlbums(req, env, ctx, auth);
    return new Response(adminLayout('Manage Albums', content, auth, 'albums', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (path === '/albums/edit') {
    if (req.method === 'GET') {
      const result = await handleAdminAlbumEdit(req, env, ctx, auth);
      if (result.redirect) {
        return new Response(null, { status: 302, headers: { Location: result.redirect } });
      }
      return new Response(adminLayout('Edit Album', result.content, auth, 'albums', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    if (req.method === 'POST') {
      const result = await handleAdminAlbumEditPost(req, env, ctx, auth);
      if (result.success) {
        return new Response(null, {
          status: 302,
          headers: { Location: result.redirect || '/admin/albums?updated=1' }
        });
      } else {
        const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
        return new Response(adminLayout('Error', content, auth, 'albums', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  }

  if (path === '/albums/delete') {
    const result = await handleAdminAlbumDelete(req, env, ctx, auth);
    if (result.success) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/albums?deleted=1' }
      });
    } else {
      const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
      return new Response(adminLayout('Error', content, auth, 'albums', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  if (path === '/albums/songs') {
    if (req.method === 'GET') {
      const result = await handleAdminAlbumSongs(req, env, ctx, auth);
      if (result.redirect) {
        return new Response(null, { status: 302, headers: { Location: result.redirect } });
      }
      return new Response(adminLayout('Album Songs', result.content, auth, 'albums', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
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
        return new Response(adminLayout('Error', content, auth, 'albums', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  }

  // ===== ARTISTS MANAGEMENT =====
  if (path === '/artists') {
    const content = await handleAdminArtists(req, env, ctx, auth);
    return new Response(adminLayout('Manage Artists', content, auth, 'artists', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (path === '/artists/edit') {
    if (req.method === 'GET') {
      const result = await handleAdminArtistEdit(req, env, ctx, auth);
      if (result.redirect) {
        return new Response(null, { status: 302, headers: { Location: result.redirect } });
      }
      return new Response(adminLayout('Edit Artist', result.content, auth, 'artists', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    if (req.method === 'POST') {
      const result = await handleAdminArtistEditPost(req, env, ctx, auth);
      if (result.success) {
        return new Response(null, {
          status: 302,
          headers: { Location: result.redirect || '/admin/artists?updated=1' }
        });
      } else {
        const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
        return new Response(adminLayout('Error', content, auth, 'artists', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  }

  if (path === '/artists/delete') {
    const result = await handleAdminArtistDelete(req, env, ctx, auth);
    if (result.success) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/artists?deleted=1' }
      });
    } else {
      const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
      return new Response(adminLayout('Error', content, auth, 'artists', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  if (path === '/artists/merge') {
    if (req.method === 'GET') {
      const result = await handleAdminArtistMerge(req, env, ctx, auth);
      if (result.redirect) {
        return new Response(null, { status: 302, headers: { Location: result.redirect } });
      }
      return new Response(adminLayout('Merge Artists', result.content, auth, 'artists', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
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
        return new Response(adminLayout('Error', content, auth, 'artists', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  }

  // ===== PLAYLISTS MANAGEMENT =====
  if (path === '/playlists') {
    const content = await handleAdminPlaylists(req, env, ctx, auth);
    return new Response(adminLayout('Manage Playlists', content, auth, 'playlists', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (path === '/playlists/edit') {
    if (req.method === 'GET') {
      const result = await handleAdminPlaylistEdit(req, env, ctx, auth);
      if (result.redirect) {
        return new Response(null, { status: 302, headers: { Location: result.redirect } });
      }
      return new Response(adminLayout('Edit Playlist', result.content, auth, 'playlists', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    if (req.method === 'POST') {
      const result = await handleAdminPlaylistEditPost(req, env, ctx, auth);
      if (result.success) {
        return new Response(null, {
          status: 302,
          headers: { Location: result.redirect || '/admin/playlists?updated=1' }
        });
      } else {
        const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
        return new Response(adminLayout('Error', content, auth, 'playlists', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  }

  if (path === '/playlists/delete') {
    const result = await handleAdminPlaylistDelete(req, env, ctx, auth);
    if (result.success) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/playlists?deleted=1' }
      });
    } else {
      const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
      return new Response(adminLayout('Error', content, auth, 'playlists', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  if (path === '/playlists/songs') {
    if (req.method === 'GET') {
      const result = await handleAdminPlaylistSongs(req, env, ctx, auth);
      if (result.redirect) {
        return new Response(null, { status: 302, headers: { Location: result.redirect } });
      }
      return new Response(adminLayout('Playlist Songs', result.content, auth, 'playlists', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
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
        return new Response(adminLayout('Error', content, auth, 'playlists', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  }

  // ===== STATISTICS =====
  if (path === '/stats') {
    const content = await handleAdminStats(req, env, ctx, auth);
    return new Response(adminLayout('Statistics', content, auth, 'stats', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== SONGS MANAGEMENT =====
  if (path === '/songs') {
    const content = await handleAdminSongs(req, env, ctx, auth);
    return new Response(adminLayout('Manage Songs', content, auth, 'songs', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (path === '/songs/delete') {
    const result = await handleAdminSongDelete(req, env, ctx, auth);
    if (result.success) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/songs?deleted=1' }
      });
    } else {
      const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
      return new Response(adminLayout('Error', content, auth, 'songs', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  if (path === '/songs/edit') {
    if (req.method === 'GET') {
      const result = await handleAdminSongEdit(req, env, ctx, auth);
      if (result.redirect) {
        return new Response(null, { status: 302, headers: { Location: result.redirect } });
      }
      return new Response(adminLayout('Edit Song', result.content, auth, 'songs', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    if (req.method === 'POST') {
      const result = await handleAdminSongEditPost(req, env, ctx, auth);
      if (result.success) {
        return new Response(null, {
          status: 302,
          headers: { Location: result.redirect || '/admin/songs?updated=1' }
        });
      } else {
        const content = `<div class="alert alert-danger">Error: ${result.error}</div>`;
        return new Response(adminLayout('Error', content, auth, 'songs', 0, 
          { total: totalDuplicates }, 
          { total: totalMissingIssues }, 
          { total: totalQualityIssues },
          { total: totalGenres }
        ), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
  }

  // ===== SEARCH =====
  if (path === '/search') {
    const content = await handleAdminSearch(req, env, ctx, auth);
    return new Response(adminLayout('Search', content, auth, 'search', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== BULK OPERATIONS =====
  if (path === '/bulk') {
    if (req.method === 'GET') {
      const result = await handleAdminBulk(req, env, ctx, auth);
      return new Response(adminLayout(result.title, result.content, auth, 'bulk', 0, 
        { total: totalDuplicates }, 
        { total: totalMissingIssues }, 
        { total: totalQualityIssues },
        { total: totalGenres }
      ), {
        headers: { 'Content-Type': 'text/html' }
      });
    } else if (req.method === 'POST') {
      return await executeBulkAction(req, env, ctx, auth);
    }
  }

  // ===== ACTIVITY LOG =====
  if (path === '/activity') {
    const result = await handleAdminActivity(req, env, ctx, auth);
    return new Response(adminLayout(result.title, result.content, auth, 'activity', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (path === '/activity/export') {
    return await handleAdminActivityExport(req, env, ctx, auth);
  }

  // ===== MIGRATIONS =====
  if (path === '/migrate' || path.startsWith('/migrate/')) {
    return await handleAdminMigrations(req, env, ctx, auth);
  }

  // ===== TRASH / RECYCLE BIN =====
  if (path === '/trash') {
    const result = await handleAdminTrash(req, env, ctx, auth);
    return new Response(adminLayout(result.title, result.content, auth, 'trash', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

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

  // ===== DUPLICATE DETECTOR ROUTES =====
  if (path === '/duplicate-detector') {
    return await handleDuplicateDetector(req, env, ctx, auth);
  }

  if (path === '/duplicate-detector/scan') {
    return await handleDuplicateDetectorScan(req, env, ctx, auth);
  }

  if (path === '/duplicate-detector/merge' && req.method === 'GET') {
    return await handleDuplicateDetectorMerge(req, env, ctx, auth);
  }

  // ===== MISSING METADATA DETECTOR ROUTES =====
  if (path === '/missing-metadata' || path.startsWith('/missing-metadata/')) {
    return await handleMissingMetadata(req, env, ctx, auth);
  }

  // ===== CONTENT QUALITY ROUTES =====
  if (path === '/content-quality' || path.startsWith('/content-quality/')) {
    return await handleContentQuality(req, env, ctx, auth);
  }

  // ===== GENRE MANAGEMENT ROUTES =====
  if (path === '/genres' || path.startsWith('/genres/')) {
    return await handleGenres(req, env, ctx, auth);
  }

// ===== SLUG MANAGER =====
if (path === '/slugs') {
  return await handleSlugs(req, env, ctx, auth);
}

  // ===== ANNOUNCEMENT SYSTEM (Placeholder) =====
  if (path === '/announcements') {
    const content = `
        <div class="empty-state">
            <i class="fas fa-bullhorn"></i>
            <h3>Announcement System</h3>
            <p>This feature is coming soon. You'll be able to:</p>
            <ul style="list-style: none; margin-top: 15px; color: #666;">
                <li style="margin-bottom: 8px;">✓ Create site-wide announcements</li>
                <li style="margin-bottom: 8px;">✓ Schedule announcements for later</li>
                <li style="margin-bottom: 8px;">✓ Target specific pages</li>
                <li style="margin-bottom: 8px;">✓ Make announcements dismissible by users</li>
            </ul>
            <div style="margin-top: 30px;">
                <a href="/admin/settings" class="btn btn-primary">
                    <i class="fas fa-cog"></i> System Settings
                </a>
            </div>
        </div>
    `;
    return new Response(adminLayout('Announcement System', content, auth, 'announcements', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== CONTENT MODERATION (Placeholder) =====
  if (path === '/moderation') {
    const content = `
        <div class="empty-state">
            <i class="fas fa-shield-alt"></i>
            <h3>Content Moderation</h3>
            <p>This feature is coming soon. You'll be able to:</p>
            <ul style="list-style: none; margin-top: 15px; color: #666;">
                <li style="margin-bottom: 8px;">✓ Review reported inappropriate content</li>
                <li style="margin-bottom: 8px;">✓ Flag and manage duplicate uploads</li>
                <li style="margin-bottom: 8px;">✓ Approve or reject pending content</li>
                <li style="margin-bottom: 8px;">✓ View user reports dashboard</li>
            </ul>
            <div style="margin-top: 30px;">
                <a href="/admin/reports" class="btn btn-primary">
                    <i class="fas fa-flag"></i> View Reports
                </a>
            </div>
        </div>
    `;
    return new Response(adminLayout('Content Moderation', content, auth, 'moderation', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
 
  // ===== USER MANAGEMENT (Placeholder) =====
  if (path === '/user-management') {
    const content = `
        <div class="empty-state">
            <i class="fas fa-users-cog"></i>
            <h3>User Management</h3>
            <p>This feature is coming soon. You'll be able to:</p>
            <ul style="list-style: none; margin-top: 15px; color: #666;">
                <li style="margin-bottom: 8px;">✓ View all registered users</li>
                <li style="margin-bottom: 8px;">✓ Ban or unban users</li>
                <li style="margin-bottom: 8px;">✓ View detailed user activity logs</li>
                <li style="margin-bottom: 8px;">✓ Check download history per user</li>
            </ul>
            <div style="margin-top: 30px;">
                <a href="/admin/users" class="btn btn-primary">
                    <i class="fas fa-users"></i> View Users
                </a>
            </div>
        </div>
    `;
    return new Response(adminLayout('User Management', content, auth, 'user-management', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== SCHEDULED TASKS (Placeholder) =====
  if (path === '/scheduled-tasks') {
    const content = `
        <div class="empty-state">
            <i class="fas fa-clock"></i>
            <h3>Scheduled Tasks</h3>
            <p>This feature is coming soon. You'll be able to:</p>
            <ul style="list-style: none; margin-top: 15px; color: #666;">
                <li style="margin-bottom: 8px;">✓ Schedule album releases for later</li>
                <li style="margin-bottom: 8px;">✓ Schedule playlist updates</li>
                <li style="margin-bottom: 8px;">✓ Schedule content removal</li>
                <li style="margin-bottom: 8px;">✓ View and manage all scheduled tasks</li>
            </ul>
            <div style="margin-top: 30px;">
                <a href="/admin/calendar" class="btn btn-primary">
                    <i class="fas fa-calendar-alt"></i> View Calendar
                </a>
            </div>
        </div>
    `;
    return new Response(adminLayout('Scheduled Tasks', content, auth, 'scheduled-tasks', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== AI-POWERED TAGGING (Placeholder) =====
  if (path === '/ai-tagging') {
    const content = `
        <div class="empty-state">
            <i class="fas fa-robot"></i>
            <h3>AI-Powered Tagging</h3>
            <p>This feature is coming soon. You'll be able to:</p>
            <ul style="list-style: none; margin-top: 15px; color: #666;">
                <li style="margin-bottom: 8px;">✓ Auto-tag songs with genres based on metadata</li>
                <li style="margin-bottom: 8px;">✓ Analyze song titles and artist names</li>
                <li style="margin-bottom: 8px;">✓ Suggest genres automatically</li>
                <li style="margin-bottom: 8px;">✓ Auto-categorize content</li>
            </ul>
            <div style="margin-top: 30px;">
                <a href="/admin/songs" class="btn btn-primary">
                    <i class="fas fa-music"></i> Browse Songs
                </a>
            </div>
        </div>
    `;
    return new Response(adminLayout('AI-Powered Tagging', content, auth, 'ai-tagging', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== AD MANAGEMENT (Placeholder) =====
  if (path === '/ad-management') {
    const content = `
        <div class="empty-state">
            <i class="fas fa-ad"></i>
            <h3>Ad Management</h3>
            <p>This feature is coming soon. You'll be able to:</p>
            <ul style="list-style: none; margin-top: 15px; color: #666;">
                <li style="margin-bottom: 8px;">✓ Create and manage ad campaigns</li>
                <li style="margin-bottom: 8px;">✓ Set ad placement positions</li>
                <li style="margin-bottom: 8px;">✓ Track ad performance</li>
                <li style="margin-bottom: 8px;">✓ Schedule ad rotations</li>
            </ul>
            <div style="margin-top: 30px;">
                <a href="/admin/analytics" class="btn btn-primary">
                    <i class="fas fa-chart-line"></i> View Analytics
                </a>
            </div>
        </div>
    `;
    return new Response(adminLayout('Ad Management', content, auth, 'ad-management', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== SYSTEM SETTINGS (Placeholder) =====
  if (path === '/system-settings') {
    const content = `
        <div class="empty-state">
            <i class="fas fa-cogs"></i>
            <h3>System Settings</h3>
            <p>This feature is coming soon. You'll be able to:</p>
            <ul style="list-style: none; margin-top: 15px; color: #666;">
                <li style="margin-bottom: 8px;">✓ Configure site-wide preferences</li>
                <li style="margin-bottom: 8px;">✓ Manage API keys and integrations</li>
                <li style="margin-bottom: 8px;">✓ Set default system behaviors</li>
                <li style="margin-bottom: 8px;">✓ Configure caching and performance</li>
            </ul>
            <div style="margin-top: 30px;">
                <a href="/admin/dashboard" class="btn btn-primary">
                    <i class="fas fa-tachometer-alt"></i> Back to Dashboard
                </a>
            </div>
        </div>
    `;
    return new Response(adminLayout('System Settings', content, auth, 'system-settings', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== THEME CUSTOMIZER (Placeholder) =====
  if (path === '/theme-customizer') {
    const content = `
        <div class="empty-state">
            <i class="fas fa-palette"></i>
            <h3>Theme Customizer</h3>
            <p>This feature is coming soon. You'll be able to:</p>
            <ul style="list-style: none; margin-top: 15px; color: #666;">
                <li style="margin-bottom: 8px;">✓ Customize site colors and branding</li>
                <li style="margin-bottom: 8px;">✓ Upload custom logo and favicon</li>
                <li style="margin-bottom: 8px;">✓ Choose font styles and sizes</li>
                <li style="margin-bottom: 8px;">✓ Preview changes in real-time</li>
            </ul>
            <div style="margin-top: 30px;">
                <a href="/admin/settings" class="btn btn-primary">
                    <i class="fas fa-cog"></i> System Settings
                </a>
            </div>
        </div>
    `;
    return new Response(adminLayout('Theme Customizer', content, auth, 'theme-customizer', 0, 
      { total: totalDuplicates }, 
      { total: totalMissingIssues }, 
      { total: totalQualityIssues },
      { total: totalGenres }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== 404 - Page Not Found (MUST BE LAST) =====
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