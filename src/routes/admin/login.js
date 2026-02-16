// ==================== ADMIN LOGIN ====================

export async function handleAdminLogin(req, env, ctx) {
  const url = new URL(req.url);
  const error = url.searchParams.get('error');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Admin Login - ZEDALBUMS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
        }
        .login-box {
            background: white;
            padding: 40px;
            border-radius: 12px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        h1 {
            color: #ff5500;
            text-align: center;
            margin-bottom: 10px;
        }
        p {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
        }
        input {
            width: 100%;
            padding: 12px;
            margin-bottom: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            font-size: 16px;
        }
        input:focus {
            outline: none;
            border-color: #ff5500;
        }
        button {
            width: 100%;
            padding: 14px;
            background: #ff5500;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
        }
        button:hover {
            background: #ff6a1a;
        }
        .error {
            background: #fee;
            color: #e74c3c;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            display: ${error ? 'block' : 'none'};
        }
    </style>
</head>
<body>
    <div class="login-box">
        <h1>ZEDALBUMS</h1>
        <p>Admin Login</p>
        
        <div class="error">
            ${error === 'invalid' ? 'Invalid username or password' : ''}
        </div>
        
        <form action="/admin/auth/login" method="POST">
            <input type="text" name="username" placeholder="Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
    </div>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

export async function handleAdminLoginPost(req, env, ctx) {
  const formData = await req.formData();
  const username = formData.get('username');
  const password = formData.get('password');
  
  // Check against secrets
  if (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
    // Create simple session
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/admin',
        'Set-Cookie': `admin_session=${sessionId}; HttpOnly; Path=/admin; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`
      }
    });
  }
  
  return new Response(null, {
    status: 302,
    headers: { 'Location': '/admin/login?error=invalid' }
  });
}

export async function handleAdminLogout(req, env, ctx) {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/admin/login',
      'Set-Cookie': 'admin_session=; HttpOnly; Path=/admin; Max-Age=0; SameSite=Strict'
    }
  });
}