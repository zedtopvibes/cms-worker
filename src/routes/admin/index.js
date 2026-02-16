// ==================== ADMIN MAIN ROUTER ====================
import { handleAdminLogin, handleAdminLoginPost, handleAdminLogout } from './login.js';
import { requireAdmin } from '../../middleware/adminAuth.js';

export async function handleAdmin(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/admin', '') || '/';

  // ===== PUBLIC ROUTES (No login required) =====
  
  // Login page
  if (path === '/login') {
    if (req.method === 'GET') return await handleAdminLogin(req, env, ctx);
    if (req.method === 'POST') return await handleAdminLoginPost(req, env, ctx);
  }

  // Logout
  if (path === '/logout') {
    return await handleAdminLogout(req, env, ctx);
  }

  // ===== PROTECTED ROUTES (Login required) =====
  const auth = await requireAdmin(req, env);
  if (!auth.authenticated) return auth.response;

  // Dashboard
  if (path === '/' || path === '/dashboard') {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Admin Dashboard - ZEDALBUMS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: white; padding: 20px 30px; border-radius: 12px; margin-bottom: 30px;
      display: flex; justify-content: space-between; align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    .header h1 { color: #ff5500; font-size: 24px; }
    .logout-btn {
      background: #f0f0f0; padding: 10px 20px; border-radius: 6px; color: #666;
      text-decoration: none; transition: all 0.3s;
    }
    .logout-btn:hover { background: #ff5500; color: white; }
    .admin-message {
      background: #e8f4fd; padding: 20px; border-radius: 8px; color: #0369a1;
      margin-bottom: 20px; border-left: 4px solid #ff5500;
    }
    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px; margin-bottom: 30px;
    }
    .stat-card {
      background: white; padding: 25px; border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; }
    .stat-card .number { color: #ff5500; font-size: 32px; font-weight: 700; }
    .quick-actions {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;
    }
    .action-btn {
      background: white; padding: 20px; border-radius: 8px; text-decoration: none;
      color: #333; text-align: center; transition: all 0.3s;
      border: 1px solid #e0e0e0;
    }
    .action-btn:hover {
      border-color: #ff5500; transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(255,85,0,0.1);
    }
    .action-btn i { font-size: 24px; color: #ff5500; margin-bottom: 10px; }
  </style>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
  <div class="container">
    <div class="header">
      <h1><i class="fas fa-cog"></i> Admin Dashboard</h1>
      <a href="/admin/logout" class="logout-btn">
        <i class="fas fa-sign-out-alt"></i> Logout
      </a>
    </div>
    
    <div class="admin-message">
      <i class="fas fa-check-circle"></i>
      You are successfully logged in as <strong>${auth.session.username}</strong>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Session Status</h3>
        <div class="number">Active</div>
        <div style="margin-top: 10px; color: #666;">7 day expiry</div>
      </div>
      <div class="stat-card">
        <h3>Login Time</h3>
        <div class="number">${new Date().toLocaleTimeString()}</div>
      </div>
    </div>
    
    <h2 style="margin: 30px 0 20px;">Quick Actions</h2>
    <div class="quick-actions">
      <a href="/upload" class="action-btn">
        <i class="fas fa-cloud-upload-alt"></i>
        <div>Upload Song</div>
      </a>
      <a href="/admin/dashboard" class="action-btn">
        <i class="fas fa-chart-line"></i>
        <div>View Stats</div>
      </a>
      <a href="/admin/settings" class="action-btn">
        <i class="fas fa-cog"></i>
        <div>Settings</div>
      </a>
    </div>
  </div>
</body>
</html>`;
    
    return new Response(html, { 
      headers: { 'Content-Type': 'text/html' } 
    });
  }

  // Add more admin routes here as you build them
  // if (path === '/upload') return await handleAdminUpload(req, env, ctx);
  // if (path === '/songs') return await handleAdminSongs(req, env, ctx);
  // etc.

  return new Response('Admin page not found', { 
    status: 404, 
    headers: { 'Content-Type': 'text/html' } 
  });
}