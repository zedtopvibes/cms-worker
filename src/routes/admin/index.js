// ==================== ADMIN MAIN ROUTER ====================
import { handleAdminLogin, handleAdminLoginPost, handleAdminLogout } from './login.js';
import { requireAdmin } from '../../middleware/adminAuth.js';

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

  // Admin dashboard - /admin or /admin/dashboard
  if (path === '/' || path === '/dashboard') {
    // Your dashboard HTML here
    return new Response(html, { 
      headers: { 'Content-Type': 'text/html' } 
    });
  }

  // Add more admin routes here
  // if (path === '/upload') return await handleAdminUpload(req, env, ctx);
  // if (path === '/songs') return await handleAdminSongs(req, env, ctx);
  // if (path === '/albums') return await handleAdminAlbums(req, env, ctx);

  return new Response('Admin page not found', { 
    status: 404, 
    headers: { 'Content-Type': 'text/html' } 
  });
}