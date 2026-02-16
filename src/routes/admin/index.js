// ==================== ADMIN ROUTER ====================
import { handleAdminLogin, handleAdminLoginPost, handleAdminLogout } from './login.js';

export async function handleAdmin(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/admin', '') || '/';
  
  // Public admin routes (no auth required)
  if (path === '/login') {
    if (req.method === 'GET') return await handleAdminLogin(req, env, ctx);
    if (req.method === 'POST') return await handleAdminLoginPost(req, env, ctx);
  }
  
  if (path === '/logout') {
    return await handleAdminLogout(req, env, ctx);
  }
  
  // Protected routes - check session
  const cookieHeader = req.headers.get('Cookie');
  const hasSession = cookieHeader?.includes('admin_session=');
  
  if (!hasSession) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/admin/login' }
    });
  }
  
  // Simple dashboard
  if (path === '/' || path === '/dashboard') {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Admin Dashboard</title>
          <style>
              body { font-family: Arial; padding: 20px; background: #f0f2f5; }
              .container { max-width: 1200px; margin: 0 auto; }
              h1 { color: #ff5500; }
              .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>Admin Dashboard</h1>
              <div class="card">
                  <p>Welcome to admin panel!</p>
                  <a href="/admin/logout">Logout</a>
              </div>
          </div>
      </body>
      </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }
  
  return new Response('Admin page not found', { status: 404 });
}