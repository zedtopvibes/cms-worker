// Configuration - Edit these variables
const R2_BUCKET = 'media'; // Your R2 bucket name
const CORS_ORIGINS = ['https://cms.zedtopvibes.workers.dev']; // Allowed origins
const DOWNLOAD_EXPIRY = 31536000; // 1 year in seconds
const ALLOWED_EXTENSIONS = ['.jpg', '.png', '.pdf', '.zip', '.mp4', '.mp3']; // Allowed file extensions

// Auth token for generating links (optional but recommended)
const AUTH_TOKEN = 'your-secret-token'; // Set a strong secret token

// Enable debug mode
const DEBUG = true; // Set to false in production

// Helper function to log debug messages
function debugLog(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', new Date().toISOString(), ...args);
  }
} 

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
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Debug');
  
  return headers;
}

// DOWNLOAD COUNT: Helper function to increment download count in KV
async function incrementDownloadCount(env, filename) {
  try {
    debugLog('Starting download count increment for:', filename);
    
    // Preserve subfolders in key format: download:songs/Munch-ice.mp3
    const key = `download:${filename}`;
    debugLog('KV key to update:', key);
    
    // Get current count
    const currentCount = await env.ZED_DOWNLOADS.get(key);
    debugLog('Current count from KV:', currentCount);
    
    let newCount = 1;
    if (currentCount) {
      newCount = parseInt(currentCount) + 1;
      debugLog('Incremented count:', newCount);
    } else {
      debugLog('First download, count set to 1');
    }
    
    // Store updated count
    await env.ZED_DOWNLOADS.put(key, newCount.toString());
    debugLog('Successfully updated KV for:', key, 'New count:', newCount);
    
    return newCount;
  } catch (error) {
    debugLog('ERROR in incrementDownloadCount:', error.message, error.stack);
    // Silently ignore errors for production, but log them in debug
    if (DEBUG) {
      throw error; // Re-throw in debug mode to see stack trace
    }
  }
}

// Generate secure download URL
async function generateDownloadUrl(request, env, filename) {
  debugLog('Generating download URL for:', filename);
  
  // Validate filename
  if (!filename || !isValidFile(filename)) {
    debugLog('Invalid file type:', filename);
    return new Response('Invalid file type', { status: 400 });
  }

  // Check authentication (optional)
  const authHeader = request.headers.get('Authorization');
  if (AUTH_TOKEN && (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`)) {
    debugLog('Unauthorized attempt to generate URL');
    return new Response('Unauthorized', { status: 401 });
  }

  // Generate signed URL (R2 doesn't have built-in signed URLs, so we proxy)
  // Return a JSON with the direct download URL
  const downloadUrl = new URL(request.url);
  downloadUrl.pathname = `/download/${filename}`;
  
  const responseData = {
    success: true,
    url: downloadUrl.toString(),
    filename: filename,
    expires: Date.now() + (DOWNLOAD_EXPIRY * 1000),
    direct: true
  };
  
  debugLog('Generated URL response:', responseData);
  
  return new Response(JSON.stringify(responseData), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
  });
}

// Handle file download
async function handleDownload(request, env, filename) {
  debugLog('Download request for:', filename, 'Method:', request.method, 'URL:', request.url);
  
  try {
    // Validate filename
    if (!filename || !isValidFile(filename)) {
      debugLog('Invalid file type requested:', filename);
      return new Response('Invalid file type', { status: 400 });
    }

    debugLog('Fetching object from R2:', filename);
    
    // Get object from R2
    const object = await env[R2_BUCKET].get(filename);
    
    if (!object) {
      debugLog('File not found in R2:', filename);
      return new Response('File not found', { status: 404 });
    }

    debugLog('R2 object found, size:', object.size, 'headers:', Object.fromEntries(object.headers));
    
    // DOWNLOAD COUNT: Increment counter for valid download
    // Fire and forget, but track for debugging
    const countPromise = incrementDownloadCount(env, decodeURIComponent(filename));
    
    // Add a small delay to let count update, but don't block
    countPromise.then(count => {
      debugLog('Download count updated successfully for:', filename, 'Count:', count);
    }).catch(error => {
      debugLog('Download count FAILED for:', filename, 'Error:', error.message);
    });

    // Create response with proper headers
    const headers = setDownloadHeaders(filename, object);
    
    // Add debug headers if requested
    if (request.headers.get('X-Debug') === 'true') {
      headers.set('X-Debug-Filename', filename);
      headers.set('X-Debug-Count-Key', `download:${decodeURIComponent(filename)}`);
    }
    
    debugLog('Returning download response for:', filename);
    
    return new Response(object.body, {
      headers: headers,
      status: 200
    });
  } catch (error) {
    debugLog('Error retrieving file:', error.message, error.stack);
    return new Response('Error retrieving file', { status: 500 });
  }
}

// Handle upload (optional - for API uploads)
async function handleUpload(request, env) {
  debugLog('Upload request received');
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    debugLog('Unauthorized upload attempt');
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const filename = formData.get('filename') || file.name;

  if (!file || !filename) {
    debugLog('No file provided in upload');
    return new Response('No file provided', { status: 400 });
  }

  if (!isValidFile(filename)) {
    debugLog('Invalid file extension in upload:', filename);
    return new Response('Invalid file extension', { status: 400 });
  }

  debugLog('Uploading file:', filename, 'Size:', file.size);

  try {
    await env[R2_BUCKET].put(filename, file);
    
    debugLog('File uploaded successfully:', filename);
    
    return new Response(JSON.stringify({
      success: true,
      filename: filename,
      url: `${new URL(request.url).origin}/download/${filename}`,
      size: file.size,
      stats_url: `${new URL(request.url).origin}/stats/${filename}`
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    debugLog('Upload failed:', error.message);
    return new Response('Upload failed', { status: 500 });
  }
}

// List files (optional - for management)
async function listFiles(env) {
  debugLog('Listing files from R2');
  
  try {
    const objects = await env[R2_BUCKET].list();
    
    // Get download counts for all files
    const filesWithCounts = await Promise.all(
      objects.objects.map(async (obj) => {
        const countKey = `download:${obj.key}`;
        const count = await env.ZED_DOWNLOADS.get(countKey);
        return {
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded,
          downloads: count ? parseInt(count) : 0,
          stats_url: `/stats/${encodeURIComponent(obj.key)}`,
          download_url: `/download/${encodeURIComponent(obj.key)}`
        };
      })
    );
    
    debugLog('Files listed:', filesWithCounts.length);
    
    return new Response(JSON.stringify({
      success: true,
      files: filesWithCounts,
      total_files: filesWithCounts.length,
      total_downloads: filesWithCounts.reduce((sum, file) => sum + file.downloads, 0)
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    debugLog('Error listing files:', error.message);
    return new Response('Error listing files', { status: 500 });
  }
}

// Get download stats for all files
async function getAllStats(env) {
  debugLog('Getting all download stats');
  
  try {
    // List all keys from KV that start with 'download:'
    const kvList = await env.ZED_DOWNLOADS.list();
    
    debugLog('Total KV entries found:', kvList.keys.length);
    
    // Get counts for each key
    const stats = {};
    let totalDownloads = 0;
    
    for (const key of kvList.keys) {
      if (key.name.startsWith('download:')) {
        const count = await env.ZED_DOWNLOADS.get(key.name);
        const filename = key.name.replace('download:', '');
        const downloadCount = parseInt(count || '0');
        stats[filename] = downloadCount;
        totalDownloads += downloadCount;
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      stats: stats,
      total_files: Object.keys(stats).length,
      total_downloads: totalDownloads,
      debug_info: {
        kv_entries: kvList.keys.length,
        counted_entries: Object.keys(stats).length
      }
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    debugLog('Error getting all stats:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Could not retrieve stats'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Test KV functionality
async function testKV(env) {
  debugLog('Testing KV functionality');
  
  try {
    const testKey = 'test_kv_functionality';
    const testValue = 'kv_is_working_' + Date.now();
    
    // Test write
    await env.ZED_DOWNLOADS.put(testKey, testValue);
    
    // Test read
    const retrievedValue = await env.ZED_DOWNLOADS.get(testKey);
    
    // Test delete
    await env.ZED_DOWNLOADS.delete(testKey);
    
    const success = retrievedValue === testValue;
    
    return new Response(JSON.stringify({
      success: success,
      kv_test: success ? 'PASSED' : 'FAILED',
      written: testValue,
      read: retrievedValue,
      message: success ? 'KV is working correctly' : 'KV read/write mismatch'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    debugLog('KV test failed:', error.message);
    return new Response(JSON.stringify({
      success: false,
      kv_test: 'FAILED',
      error: error.message,
      message: 'KV is NOT working'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Reset download count for a file (admin only)
async function resetDownloadCount(env, filename, authHeader) {
  debugLog('Reset download count request for:', filename);
  
  // Check authentication
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const key = `download:${decodeURIComponent(filename)}`;
    await env.ZED_DOWNLOADS.delete(key);
    
    debugLog('Download count reset for:', filename);
    
    return new Response(JSON.stringify({
      success: true,
      message: `Download count reset for ${filename}`,
      filename: filename
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    debugLog('Error resetting download count:', error.message);
    return new Response('Error resetting count', { status: 500 });
  }
}

// Main worker handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    debugLog('Request received:', {
      method: method,
      path: path,
      origin: request.headers.get('origin'),
      userAgent: request.headers.get('user-agent')
    });

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      debugLog('Handling CORS preflight for path:', path);
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Debug',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // Route handling
    if (path.startsWith('/generate/')) {
      const filename = path.split('/generate/')[1];
      debugLog('Generate URL route for:', filename);
      return generateDownloadUrl(request, env, decodeURIComponent(filename));
    }
    
    else if (path.startsWith('/download/')) {
      const filename = path.split('/download/')[1];
      debugLog('Download route for:', filename);
      return handleDownload(request, env, decodeURIComponent(filename));
    }
    
    // STATS: Route to retrieve download counts
    else if (path.startsWith('/stats/')) {
      const filename = path.split('/stats/')[1];
      debugLog('Stats route for:', filename);
      
      if (!filename) {
        return new Response('Filename required', { status: 400 });
      }
      
      try {
        const key = `download:${decodeURIComponent(filename)}`;
        debugLog('Fetching stats for KV key:', key);
        
        const count = await env.ZED_DOWNLOADS.get(key);
        debugLog('Retrieved count:', count);
        
        const responseData = {
          success: true,
          filename: decodeURIComponent(filename),
          downloads: count ? parseInt(count) : 0,
          key: key,
          timestamp: new Date().toISOString()
        };
        
        debugLog('Stats response:', responseData);
        
        return new Response(JSON.stringify(responseData), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          }
        });
      } catch (error) {
        debugLog('Error getting stats:', error.message, error.stack);
        return new Response(JSON.stringify({
          success: false,
          filename: decodeURIComponent(filename),
          downloads: 0,
          error: error.message,
          message: 'Could not retrieve stats'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          status: 200  // Still return 200 with 0 downloads on error
        });
      }
    }
    
    // Get all download stats
    else if (path === '/all-stats' && method === 'GET') {
      debugLog('All stats route');
      return getAllStats(env);
    }
    
    // Test KV functionality
    else if (path === '/debug/kv' && method === 'GET') {
      debugLog('KV debug route');
      return testKV(env);
    }
    
    // Reset download count
    else if (path.startsWith('/reset-stats/') && method === 'POST') {
      const filename = path.split('/reset-stats/')[1];
      const authHeader = request.headers.get('Authorization');
      return resetDownloadCount(env, filename, authHeader);
    }
    
    else if (path === '/upload' && method === 'POST') {
      debugLog('Upload route');
      return handleUpload(request, env);
    }
    
    else if (path === '/files' && method === 'GET') {
      debugLog('Files list route');
      return listFiles(env);
    }
    
    else if (path === '/' && method === 'GET') {
      debugLog('Root route - serving documentation');
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>R2 Direct Download Service</title>
          <style>
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              max-width: 1200px; 
              margin: 0 auto; 
              padding: 20px; 
              background: #f8f9fa;
              color: #333;
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px;
              margin-bottom: 30px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .endpoint { 
              background: white; 
              padding: 20px; 
              margin: 15px 0; 
              border-radius: 8px;
              border-left: 4px solid #667eea;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            code { 
              background: #f1f3f5; 
              padding: 4px 8px; 
              border-radius: 4px;
              font-family: 'Monaco', 'Consolas', monospace;
              font-size: 0.9em;
              color: #d63384;
            }
            .method { 
              display: inline-block;
              padding: 4px 12px;
              border-radius: 4px;
              font-weight: bold;
              margin-right: 10px;
            }
            .get { background: #61affe; color: white; }
            .post { background: #49cc90; color: white; }
            .debug { background: #f93e3e; color: white; }
            h1 { margin: 0; }
            h3 { margin-top: 0; color: #495057; }
            pre { 
              background: #f8f9fa; 
              padding: 15px; 
              border-radius: 5px;
              overflow: auto;
              border: 1px solid #e9ecef;
            }
            .note {
              background: #fff3cd;
              border: 1px solid #ffeaa7;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📦 R2 Direct Download Service</h1>
            <p>Secure file downloads with automatic download tracking</p>
            <p><strong>Debug Mode:</strong> ${DEBUG ? '✅ ON' : '❌ OFF'}</p>
          </div>
          
          <div class="note">
            <strong>⚠️ Troubleshooting Download Counts:</strong>
            <p>If download counts aren't working:</p>
            <ol>
              <li>Check Cloudflare Dashboard → Workers → your worker → Logs</li>
              <li>Test KV with <code><a href="/debug/kv" target="_blank">/debug/kv</a></code></li>
              <li>Check all stats with <code><a href="/all-stats" target="_blank">/all-stats</a></code></li>
              <li>Verify KV namespace binding in wrangler.toml</li>
            </ol>
          </div>
          
          <h2>📊 Download Tracking Endpoints</h2>
          
          <div class="endpoint">
            <h3><span class="method get">GET</span> Download File & Count</h3>
            <p><code>/download/{filename}</code></p>
            <p>Downloads file and automatically increments download count.</p>
            <p><strong>Example:</strong> <code><a href="/download/example.pdf" target="_blank">/download/example.pdf</a></code></p>
          </div>
          
          <div class="endpoint">
            <h3><span class="method get">GET</span> Get Download Stats</h3>
            <p><code>/stats/{filename}</code></p>
            <p>Returns download count for a specific file.</p>
            <p><strong>Example:</strong> <code><a href="/stats/example.pdf" target="_blank">/stats/example.pdf</a></code></p>
     