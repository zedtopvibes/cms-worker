// ==================== ADMIN AUTH MIDDLEWARE ====================

// Simple in-memory session store
const sessions = new Map();

// Create a new session
export function createSession(username) {
  const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
  
  sessions.set(sessionId, {
    username,
    createdAt: Date.now(),
    expiresAt
  });
  
  return sessionId;
}

// Validate a session
export function validateSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

// Delete a session (logout)
export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

// Get session from cookie
export function getSessionFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});
  
  return cookies['admin_session'] || null;
}

// Require admin middleware
export async function requireAdmin(req, env) {
  const cookieHeader = req.headers.get('Cookie');
  const sessionId = getSessionFromCookie(cookieHeader);
  
  if (!sessionId) {
    return {
      authenticated: false,
      response: new Response(null, {
        status: 302,
        headers: { Location: '/admin/login' }
      })
    };
  }
  
  const session = validateSession(sessionId);
  if (!session) {
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
    session
  };
}