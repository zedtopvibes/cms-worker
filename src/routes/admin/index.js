// ==================== ADMIN MAIN ROUTER ====================
import { handleAdminLogin, handleAdminLoginPost, handleAdminLogout } from './login.js';
import { requireAdmin } from '../../middleware/adminAuth.js';
import { adminLayout } from './layout.js';
import { handleAdminUpload, handleAdminUploadPost } from './upload.js';
import { formatDuration } from '../../helpers/formatting.js';
import { 
  handleAdminSongs, 
  handleAdminSongDelete, 
  handleAdminSongEdit, 
  handleAdminSongEditPost 
} from './songs.js';
import { 
  handleAdminAlbums,
  handleAdminAlbumEdit,
  handleAdminAlbumEditPost,
  handleAdminAlbumDelete,
  handleAdminAlbumSongs,
  handleAdminAlbumSongsPost
} from './albums.js';
import { 
  handleAdminArtists,
  handleAdminArtistEdit,
  handleAdminArtistEditPost,
  handleAdminArtistDelete,
  handleAdminArtistMerge,
  handleAdminArtistMergePost
} from './artists.js';
import { 
  handleAdminPlaylists,
  handleAdminPlaylistEdit,
  handleAdminPlaylistEditPost,
  handleAdminPlaylistDelete,
  handleAdminPlaylistSongs,
  handleAdminPlaylistSongsPost
} from './playlists.js';
import { handleAdminStats } from './stats.js';

// ===== NEW IMPORTS FOR DASHBOARD WIDGETS =====
import { getDashboardStats } from '../../helpers/dashboardStats.js';
import { formatNumber } from '../../helpers/formatting.js';

export async function handleAdmin(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/admin', '') || '/';

  // ===== PUBLIC ADMIN ROUTES (No login required) =====
  
  // Admin login page - /admin/login
  if (path === '/login') {
    if (req.method === 'GET') return await handleAdminLogin(req, env, ctx);
    if (req.method === 'POST') return await handleAdminLoginPost(req, env, ctx);
  }

  // Admin logout - /admin/logout
  if (path === '/logout') {
    return await handleAdminLogout(req, env, ctx);
  }

  // ===== PROTECTED ADMIN ROUTES (Login required) =====
  const auth = await requireAdmin(req, env);
  if (!auth.authenticated) return auth.response;

// ===== DASHBOARD =====
if (path === '/' || path === '/dashboard') {
  // Get real-time stats
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
</style>
        <!-- 7-Day Trend Chart (ASCII-style for now) -->
        <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="font-size: 1rem;"><i class="fas fa-chart-line" style="color: #ff5500;"></i> 7-Day Activity</h4>
                <div style="display: flex; gap: 15px; font-size: 0.7rem;">
                    <span><span style="color: #ff5500;">■</span> Views</span>
                    <span><span style="color: #4a90e2;">■</span> Plays</span>
                    <span><span style="color: #28a745;">■</span> Downloads</span>
                </div>
            </div>
            
            <!-- Simple Bar Chart -->
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
        
        <!-- Quick Actions -->
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
            @media (min-width: 768px) {
                .mobile-cards { display: none; }
                .desktop-actions { display: block !important; }
            }
        </style>
    </div>
  `;
    
    return new Response(adminLayout('Dashboard', content, auth, 'dashboard'), {
      headers: { 'Content-Type': 'text/html' }
    });
}

  // ===== UPLOAD SONG =====
  if (path === '/upload') {
    if (req.method === 'GET') {
      const content = await handleAdminUpload(req, env, ctx, auth);
      return new Response(adminLayout('Upload Song', content, auth, 'upload'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    if (req.method === 'POST') {
      const result = await handleAdminUploadPost(req, env, ctx);
      
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
        return new Response(adminLayout('Upload Failed', content, auth, 'upload'), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
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
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px; margin: 0 auto;">
                <a href="/song/${encodeURIComponent(result.baseName + '.mp3')}" class="btn btn-primary" target="_blank" style="padding: 16px;">
                    <i class="fas fa-play"></i> View Song
                </a>
                <a href="/admin/upload" class="btn btn-secondary" style="padding: 16px;">
                    <i class="fas fa-cloud-upload-alt"></i> Upload Another Song
                </a>
                ${result.albumId ? `
                    <a href="/album/${result.albumId}" class="btn btn-secondary" target="_blank" style="padding: 16px;">
                        <i class="fas fa-compact-disc"></i> View Album
                    </a>
                ` : ''}
                ${result.playlistId ? `
                    <a href="/playlist/${result.playlistId}" class="btn btn-secondary" target="_blank" style="padding: 16px;">
                        <i class="fas fa-list"></i> View Playlist
                    </a>
                ` : ''}
                <a href="/admin/dashboard" class="btn btn-secondary" style="padding: 16px; background: #f0f0f0;">
                    <i class="fas fa-tachometer-alt"></i> Back to Dashboard
                </a>
            </div>
        </div>
      `;
      
      return new Response(adminLayout('Upload Successful', content, auth, 'upload'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
  // ===== ALBUMS MANAGEMENT =====
if (path === '/albums') {
  const content = await handleAdminAlbums(req, env, ctx, auth);
  return new Response(adminLayout('Manage Albums', content, auth, 'albums'), {
    headers: { 'Content-Type': 'text/html' }
  });
}

if (path === '/albums/edit') {
  if (req.method === 'GET') {
    const result = await handleAdminAlbumEdit(req, env, ctx, auth);
    if (result.redirect) {
      return new Response(null, { status: 302, headers: { Location: result.redirect } });
    }
    return new Response(adminLayout('Edit Album', result.content, auth, 'albums'), {
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
      return new Response(adminLayout('Error', content, auth, 'albums'), {
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
    return new Response(adminLayout('Error', content, auth, 'albums'), {
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
    return new Response(adminLayout('Album Songs', result.content, auth, 'albums'), {
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
      return new Response(adminLayout('Error', content, auth, 'albums'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
}
  // ===== ARTISTS MANAGEMENT =====
if (path === '/artists') {
  const content = await handleAdminArtists(req, env, ctx, auth);
  return new Response(adminLayout('Manage Artists', content, auth, 'artists'), {
    headers: { 'Content-Type': 'text/html' }
  });
}

if (path === '/artists/edit') {
  if (req.method === 'GET') {
    const result = await handleAdminArtistEdit(req, env, ctx, auth);
    if (result.redirect) {
      return new Response(null, { status: 302, headers: { Location: result.redirect } });
    }
    return new Response(adminLayout('Edit Artist', result.content, auth, 'artists'), {
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
      return new Response(adminLayout('Error', content, auth, 'artists'), {
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
    return new Response(adminLayout('Error', content, auth, 'artists'), {
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
    return new Response(adminLayout('Merge Artists', result.content, auth, 'artists'), {
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
      return new Response(adminLayout('Error', content, auth, 'artists'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
}

  // ===== PLAYLISTS MANAGEMENT =====
if (path === '/playlists') {
  const content = await handleAdminPlaylists(req, env, ctx, auth);
  return new Response(adminLayout('Manage Playlists', content, auth, 'playlists'), {
    headers: { 'Content-Type': 'text/html' }
  });
}

if (path === '/playlists/edit') {
  if (req.method === 'GET') {
    const result = await handleAdminPlaylistEdit(req, env, ctx, auth);
    if (result.redirect) {
      return new Response(null, { status: 302, headers: { Location: result.redirect } });
    }
    return new Response(adminLayout('Edit Playlist', result.content, auth, 'playlists'), {
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
      return new Response(adminLayout('Error', content, auth, 'playlists'), {
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
    return new Response(adminLayout('Error', content, auth, 'playlists'), {
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
    return new Response(adminLayout('Playlist Songs', result.content, auth, 'playlists'), {
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
      return new Response(adminLayout('Error', content, auth, 'playlists'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
}

  // ===== STATISTICS =====
if (path === '/stats') {
  const content = await handleAdminStats(req, env, ctx, auth);
  return new Response(adminLayout('Statistics', content, auth, 'stats'), {
    headers: { 'Content-Type': 'text/html' }
  });
}

// ===== SONGS MANAGEMENT =====
if (path === '/songs') {
  const content = await handleAdminSongs(req, env, ctx, auth);
  return new Response(adminLayout('Manage Songs', content, auth, 'songs'), {
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
    return new Response(adminLayout('Error', content, auth, 'songs'), {
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
    return new Response(adminLayout('Edit Song', result.content, auth, 'songs'), {
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
      return new Response(adminLayout('Error', content, auth, 'songs'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
}
  // ===== 404 - Page Not Found =====
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