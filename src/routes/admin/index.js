import { handleAdminLogin, handleAdminLoginPost, handleAdminLogout } from './login.js';
import { requireAdmin } from '../../middleware/adminAuth.js';

export async function handleAdmin(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/admin', '') || '/';

  // Public routes
  if (path === '/login') {
    if (req.method === 'GET') return await handleAdminLogin(req, env, ctx);
    if (req.method === 'POST') return await handleAdminLoginPost(req, env, ctx);
  }

  if (path === '/logout') return await handleAdminLogout(req, env, ctx);

  // Protected routes
  const auth = await requireAdmin(req, env);
  if (!auth.authenticated) return auth.response;

  if (path === '/' || path === '/dashboard') {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Admin Dashboard - ZEDALBUMS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>/* your existing styles */</style>
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
    <!-- stats and quick actions -->
  </div>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }

  return new Response('Admin page not found', { status: 404, headers: { 'Content-Type': 'text/html' } });
}