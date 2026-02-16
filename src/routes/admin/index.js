// ==================== ADMIN MAIN ROUTER ====================
import { handleAdminLogin, handleAdminLoginPost, handleAdminLogout } from './login.js';
import { requireAdmin } from '../../middleware/adminAuth.js';
import { adminLayout } from './layout.js';

export async function handleAdmin(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/admin', '') || '/';

  // ===== PUBLIC ADMIN ROUTES =====
  if (path === '/login') {
    if (req.method === 'GET') return await handleAdminLogin(req, env, ctx);
    if (req.method === 'POST') return await handleAdminLoginPost(req, env, ctx);
  }

  if (path === '/logout') {
    return await handleAdminLogout(req, env, ctx);
  }

  // ===== PROTECTED ADMIN ROUTES =====
  const auth = await requireAdmin(req, env);
  if (!auth.authenticated) return auth.response;

  // Dashboard
  if (path === '/' || path === '/dashboard') {
    const content = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Session Status</h3>
                <div class="number">Active</div>
                <div class="label">7 day expiry</div>
            </div>
            <div class="stat-card">
                <h3>Login Time</h3>
                <div class="number">${new Date().toLocaleTimeString()}</div>
                <div class="label">${new Date().toLocaleDateString()}</div>
            </div>
            <div class="stat-card">
                <h3>Admin</h3>
                <div class="number">${auth.session.username}</div>
                <div class="label">Administrator</div>
            </div>
        </div>
        
        <div class="alert alert-info">
            <i class="fas fa-info-circle"></i>
            Welcome to the admin panel. Use the tabs above to manage content.
        </div>
        
        <h2 style="margin: 20px 0 15px; font-size: 1.1rem;">Quick Actions</h2>
        
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
        <div style="display: none;" class="desktop-actions">
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <a href="/admin/upload" class="btn btn-primary">
                    <i class="fas fa-cloud-upload-alt"></i> Upload Song
                </a>
                <a href="/admin/songs" class="btn btn-secondary">
                    <i class="fas fa-music"></i> Songs
                </a>
                <a href="/admin/albums" class="btn btn-secondary">
                    <i class="fas fa-compact-disc"></i> Albums
                </a>
                <a href="/admin/artists" class="btn btn-secondary">
                    <i class="fas fa-microphone"></i> Artists
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

  // Placeholder for other routes (will implement next)
  if (path === '/upload') {
    const content = `<div class="empty-state"><i class="fas fa-cloud-upload-alt"></i><h3>Upload Page</h3><p>Coming soon...</p></div>`;
    return new Response(adminLayout('Upload Song', content, auth, 'upload'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (path === '/songs') {
    const content = `<div class="empty-state"><i class="fas fa-music"></i><h3>Songs Management</h3><p>Coming soon...</p></div>`;
    return new Response(adminLayout('Manage Songs', content, auth, 'songs'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (path === '/albums') {
    const content = `<div class="empty-state"><i class="fas fa-compact-disc"></i><h3>Albums Management</h3><p>Coming soon...</p></div>`;
    return new Response(adminLayout('Manage Albums', content, auth, 'albums'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (path === '/artists') {
    const content = `<div class="empty-state"><i class="fas fa-microphone"></i><h3>Artists Management</h3><p>Coming soon...</p></div>`;
    return new Response(adminLayout('Manage Artists', content, auth, 'artists'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (path === '/playlists') {
    const content = `<div class="empty-state"><i class="fas fa-list"></i><h3>Playlists Management</h3><p>Coming soon...</p></div>`;
    return new Response(adminLayout('Manage Playlists', content, auth, 'playlists'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (path === '/stats') {
    const content = `<div class="empty-state"><i class="fas fa-chart-line"></i><h3>Statistics</h3><p>Coming soon...</p></div>`;
    return new Response(adminLayout('Statistics', content, auth, 'stats'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  return new Response('Admin page not found', { 
    status: 404, 
    headers: { 'Content-Type': 'text/html' } 
  });
}