// ==================== ADMIN LOGIN USING SECRETS ====================
import { createAdminSession } from '../../middleware/adminAuth.js';

export async function handleAdminLogin(req, env, ctx) {
  const url = new URL(req.url);
  const error = url.searchParams.get('error');
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Admin Login - ZEDALBUMS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Montserrat', sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .login-box {
            background: white;
            border-radius: 12px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo h1 {
            color: #ff5500;
            font-size: 28px;
            font-weight: 800;
            text-transform: uppercase;
        }
        .logo p {
            color: #666;
            margin-top: 5px;
            font-size: 14px;
        }
        .security-badge {
            background: #f0f9ff;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            color: #0369a1;
            text-align: center;
            margin-bottom: 20px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 600;
        }
        input {
            width: 100%;
            padding: 14px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 15px;
            font-family: 'Montserrat', sans-serif;
        }
        input:focus {
            outline: none;
            border-color: #ff5500;
        }
        button {
            width: 100%;
            padding: 16px;
            background: #ff5500;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.3s;
        }
        button:hover {
            background: #ff6a1a;
        }
        .error {
            background: #fee;
            color: #e74c3c;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            display: ${error ? 'block' : 'none'};
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        .footer i {
            color: #ff5500;
        }
    </style>
</head>
<body>
    <div class="login-box">
        <div class="logo">
            <h1>ZEDALBUMS</h1>
            <p>Admin Panel</p>
        </div>
        
        <div class="security-badge">
            <i class="fas fa-lock"></i> Secured with Cloudflare Secrets
        </div>
        
        <div class="error">
            <i class="fas fa-exclamation-circle"></i>
            ${error === 'invalid' ? 'Invalid username or password' : ''}
        </div>
        
        <form action="/admin/auth/login" method="POST">
            <div class="form-group">
                <label>Username</label>
                <input type="text" name="username" required autofocus>
            </div>
            
            <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" required>
            </div>
            
            <button type="submit">
                <i class="fas fa-sign-in-alt"></i> Login
            </button>
        </form>
        
        <div class="footer">
            <p><i class="fas fa-shield-alt"></i> Credentials encrypted with Cloudflare Secrets</p>
        </div>
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
  
  // Check against encrypted secrets
  // env.ADMIN_USERNAME and env.ADMIN_PASSWORD are automatically decrypted by Cloudflare
  if (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
    // Create simple session
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Store session in memory (or use D1 for persistence)
    // For now, we'll just use a cookie with the session ID
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/admin',
        'Set-Cookie': `admin_session=${sessionId}; HttpOnly; Path=/admin; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`
      }
    });
  }
  
  // Invalid credentials
  return new Response(null, {
    status: 302,
    headers: { 'Location': '/admin/login?error=invalid' }
  });
}

// Logout handler
export async function handleAdminLogout(req, env, ctx) {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/admin/login',
      'Set-Cookie': 'admin_session=; HttpOnly; Path=/admin; Max-Age=0; SameSite=Strict'
    }
  });
}