// ==================== ADMIN AUTH MIDDLEWARE ====================

// Get session ID from cookie
export function getSessionFromCookie(cookieHeader) {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});

  return cookies['admin_session'] || null;
}

// Create a new session in KV
export async function createSession(env, username) {
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  await env.ADMIN_SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify({ username, expiresAt }),
    { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
  );

  return sessionId;
}

// Validate session from KV
export async function validateSession(env, sessionId) {
  const data = await env.ADMIN_SESSIONS.get(`session:${sessionId}`);
  if (!data) return null;

  const session = JSON.parse(data);

  if (Date.now() > session.expiresAt) {
    await env.ADMIN_SESSIONS.delete(`session:${sessionId}`);
    return null;
  }

  return session;
}

// Delete session (logout)
export async function deleteSession(env, sessionId) {
  await env.ADMIN_SESSIONS.delete(`session:${sessionId}`);
}

// Require admin middleware
export async function requireAdmin(req, env) {
  const cookieHeader = req.headers.get('Cookie');
  const sessionId = getSessionFromCookie(cookieHeader);

  if (!sessionId) {
    return {
      authenticated: false,
      response: Response.redirect('/admin/login', 302)
    };
  }

  const session = await validateSession(env, sessionId);
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

  return { authenticated: true, session };
}