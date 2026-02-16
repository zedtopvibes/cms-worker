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
    const content = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3><i class="fas fa-check-circle" style="color: #ff5500;"></i> Session Status</h3>
                <div class="number">Active</div>
                <div class="label">7 day expiry</div>
            </div>
            <div class="stat-card">
                <h3><i class="fas fa-clock" style="color: #ff5500;"></i> Login Time</h3>
                <div class="number">${new Date().toLocaleTimeString()}</div>
                <div class="label">${new Date().toLocaleDateString()}</div>
            </div>
            <div class="stat-card">
                <h3><i class="fas fa-user" style="color: #ff5500;"></i> Admin</h3>
                <div class="number">${auth.session.username}</div>
                <div class="label">Administrator</div>
            </div>
        </div>
        
        <div class="alert alert-info" style="margin-bottom: 25px;">
            <i class="fas fa-info-circle"></i>
            Welcome to the admin panel. Use the tabs above or quick actions below to manage content.
        </div>
        
        <h2 style="margin: 0 0 15px; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-bolt" style="color: #ff5500;"></i> Quick Actions
        </h2>
        
        <!-- Mobile Cards -->
        <div class="mobile-cards">
            <div class="mobile-card" onclick="window.location='/admin/upload'" style="cursor: pointer;">
                <div class="mobile-card-row">
                    <span class="mobile-card-label">
                        <i class="fas fa-cloud-upload-alt" style="color: #ff5500; width: 24px;"></i> 
                        Upload Song
                    </span>
                    <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                </div>
            </div>
            <div class="mobile-card" onclick="window.location='/admin/songs'" style="cursor: pointer;">
                <div class="mobile-card-row">
                    <span class="mobile-card-label">
                        <i class="fas fa-music" style="color: #ff5500; width: 24px;"></i> 
                        Manage Songs
                    </span>
                    <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                </div>
            </div>
            <div class="mobile-card" onclick="window.location='/admin/albums'" style="cursor: pointer;">
                <div class="mobile-card-row">
                    <span class="mobile-card-label">
                        <i class="fas fa-compact-disc" style="color: #ff5500; width: 24px;"></i> 
                        Manage Albums
                    </span>
                    <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                </div>
            </div>
            <div class="mobile-card" onclick="window.location='/admin/artists'" style="cursor: pointer;">
                <div class="mobile-card-row">
                    <span class="mobile-card-label">
                        <i class="fas fa-microphone" style="color: #ff5500; width: 24px;"></i> 
                        Manage Artists
                    </span>
                    <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                </div>
            </div>
            <div class="mobile-card" onclick="window.location='/admin/playlists'" style="cursor: pointer;">
                <div class="mobile-card-row">
                    <span class="mobile-card-label">
                        <i class="fas fa-list" style="color: #ff5500; width: 24px;"></i> 
                        Manage Playlists
                    </span>
                    <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                </div>
            </div>
            <div class="mobile-card" onclick="window.location='/admin/stats'" style="cursor: pointer;">
                <div class="mobile-card-row">
                    <span class="mobile-card-label">
                        <i class="fas fa-chart-line" style="color: #ff5500; width: 24px;"></i> 
                        View Statistics
                    </span>
                    <span class="mobile-card-value"><i class="fas fa-chevron-right"></i></span>
                </div>
            </div>
        </div>
        
        <!-- Desktop Grid -->
        <div class="desktop-actions" style="display: none;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                <a href="/admin/upload" class="btn btn-primary" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-cloud-upload-alt"></i> Upload Song
                </a>
                <a href="/admin/songs" class="btn btn-secondary" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-music"></i> Songs
                </a>
                <a href="/admin/albums" class="btn btn-secondary" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-compact-disc"></i> Albums
                </a>
                <a href="/admin/artists" class="btn btn-secondary" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-microphone"></i> Artists
                </a>
                <a href="/admin/playlists" class="btn btn-secondary" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-list"></i> Playlists
                </a>
                <a href="/admin/stats" class="btn btn-secondary" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-chart-line"></i> Stats
                </a>
            </div>
        </div>
        
        <style>
            @media (min-width: 768px) {
                .mobile-cards { display: none; }
                .desktop-actions { display: block !important; }
            }
        </style>
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