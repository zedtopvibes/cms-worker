// Configuration - Edit these variables
const R2_BUCKET = 'media'; // Your R2 bucket name
const CORS_ORIGINS = ['https://cms.zedtopvibes.workers.dev']; // Allowed origins
const DOWNLOAD_EXPIRY = 31536000; // 1 year in seconds
const ALLOWED_EXTENSIONS = ['.jpg', '.png', '.pdf', '.zip', '.mp4', '.mp3']; // Allowed file extensions

// Auth token for generating links (optional but recommended)
const AUTH_TOKEN = 'your-secret-token'; // Set a strong secret token

// Helper function to validate file extension
function isValidFile(filename) {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

// Helper function to set download headers
function setDownloadHeaders(filename, originalResponse) {
  const headers = new Headers(originalResponse.headers);
  
  // Force download with original filename
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  
  // Cache control for permanent links
  headers.set('Cache-Control', `public, max-age=${DOWNLOAD_EXPIRY}, immutable`);
  
  // CORS headers
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  
  return headers;
}

// Generate secure download URL
async function generateDownloadUrl(request, env, filename) {
  // Validate filename
  if (!filename || !isValidFile(filename)) {
    return new Response('Invalid file type', { status: 400 });
  }

  // Check authentication (optional)
  const authHeader = request.headers.get('Authorization');
  if (AUTH_TOKEN && (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Generate signed URL (R2 doesn't have built-in signed URLs, so we proxy)
  // Return a JSON with the direct download URL
  const downloadUrl = new URL(request.url);
  downloadUrl.pathname = `/download/${filename}`;
  
  return new Response(JSON.stringify({
    success: true,
    url: downloadUrl.toString(),
    filename: filename,
    expires: Date.now() + (DOWNLOAD_EXPIRY * 1000),
    direct: true
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// Handle file download
async function handleDownload(request, env, filename) {
  try {
    // Validate filename
    if (!filename || !isValidFile(filename)) {
      return new Response('Invalid file type', { status: 400 });
    }

    // Get object from R2
    const object = await env[R2_BUCKET].get(filename);
    
    if (!object) {
      return new Response('File not found', { status: 404 });
    }

    // Create response with proper headers
    const headers = setDownloadHeaders(filename, object);
    
    return new Response(object.body, {
      headers: headers,
      status: 200
    });
  } catch (error) {
    return new Response('Error retrieving file', { status: 500 });
  }
}

// Handle upload (optional - for API uploads)
async function handleUpload(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const filename = formData.get('filename') || file.name;

  if (!file || !filename) {
    return new Response('No file provided', { status: 400 });
  }

  if (!isValidFile(filename)) {
    return new Response('Invalid file extension', { status: 400 });
  }

  try {
    await env[R2_BUCKET].put(filename, file);
    
    return new Response(JSON.stringify({
      success: true,
      filename: filename,
      url: `${new URL(request.url).origin}/download/${filename}`,
      size: file.size
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response('Upload failed', { status: 500 });
  }
}

// List files (optional - for management)
async function listFiles(env) {
  const objects = await env[R2_BUCKET].list();
  return new Response(JSON.stringify({
    files: objects.objects.map(obj => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded
    }))
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// Main worker handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // Route handling
    if (path.startsWith('/generate/')) {
      const filename = path.split('/generate/')[1];
      return generateDownloadUrl(request, env, decodeURIComponent(filename));
    }
    
    else if (path.startsWith('/download/')) {
      const filename = path.split('/download/')[1];
      return handleDownload(request, env, decodeURIComponent(filename));
    }
    
    else if (path === '/upload' && method === 'POST') {
      return handleUpload(request, env);
    }
    
    else if (path === '/files' && method === 'GET') {
      return listFiles(env);
    }
    
    else if (path === '/') {
      return new Response(`
        <!DOCTYPE html>
        <html> 
        <head>
          <title>R2 Direct Download</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
            code { background: #eee; padding: 2px 5px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>R2 Direct Download Service</h1>
          <p>Available endpoints:</p>
          
          <div class="endpoint">
            <h3>Generate Download Link</h3>
            <p><code>GET /generate/example.pdf</code></p>
            <p>Header: <code>Authorization: Bearer your-secret-token</code></p>
          </div>
          
          <div class="endpoint">
            <h3>Direct Download</h3>
            <p><code>GET /download/example.pdf</code></p>
            <p>No authentication required</p>
          </div>
          
          <div class="endpoint">
            <h3>Upload File</h3>
            <p><code>POST /upload</code></p>
            <p>Form data: <code>file</code> and optional <code>filename</code></p>
          </div>
          
          <div class="endpoint">
            <h3>List Files</h3>
            <p><code>GET /files</code></p>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};