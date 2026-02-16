// ==================== SIMPLE SESSION MIDDLEWARE ====================

// In-memory session store (resets on worker restart)
// For production, you'd want D1, but this is fine for basic admin needs
const sessions = new Map();

export function createAdminSession(admin) {
  const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  sessions.set(sessionId, {
    admin,
    createdAt: Date.now(),
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  });
  return sessionId;
}

export function validateAdminSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session.admin;
}

export function deleteAdminSession(sessionId) {
  sessions.delete(sessionId);
}

// Middleware to check if request is authenticated
export async function requireAdmin(req, env) {
  const cookieHeader = req.headers.get('Cookie');
  if (!cookieHeader) {
    return {
      authenticated: false,
      response: new Response(null, {
        status: 302,
        headers: { Location: '/admin/login' }
      })
    };
  }
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});
  
  const sessionId = cookies['admin_session'];
  if (!sessionId) {
    return {
      authenticated: false,
      response: new Response(null, {
        status: 302,
        headers: { Location: '/admin/login' }
      })
    };
  }
  
  const admin = validateAdminSession(sessionId);
  if (!admin) {
    return {
      authenticated: false,
      response: new Response(null, {
        status: 302,
        headers: { 
          Location: '/admin/login',
          'Set-Cookie': 'admin_session=; HttpOnly; Path=/admin; Max-Age=0; SameSite=Strict'
        }
      })
    };
  }
  
  return {
    authenticated: true,
    admin,
    sessionId
  };
}