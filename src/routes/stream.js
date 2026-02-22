// ==================== STREAM ENDPOINT ====================
// Handles /stream/[filename] - Serves audio files for streaming
import { incrementPlays } from '../helpers/playsDownloadsEnhanced.js';
// REMOVE: import { SlugManager } from '../helpers/slug.js';
import { getMetadata } from '../helpers/storage.js';

export async function handleStream(req, env, ctx) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: {
        'Allow': 'GET',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const filename = pathParts[pathParts.length - 1]; // Get filename from URL
    
    if (!filename) {
      return new Response('Missing song identifier', { status: 400 });
    }

    console.log(`🎵 Streaming request for: ${filename}`);

    // REMOVE SlugManager initialization and lookup
    // const slugManager = new SlugManager(env);
    // const baseName = await slugManager.getIdFromSlug('songs', decodeURIComponent(slug));
    
    // Get baseName directly from filename (remove .mp3 if present)
    let baseName = decodeURIComponent(filename);
    if (baseName.endsWith('.mp3')) {
      baseName = baseName.slice(0, -4);
    }
    
    if (!baseName) {
      return new Response('Song not found', { status: 404 });
    }

    // Get song metadata (optional - for logging/info)
    const metadata = await getMetadata(env, baseName);
    
    // Track the play asynchronously (don't await - let it run in background)
    ctx.waitUntil(incrementPlays(env, 'song', baseName));

    // Construct the file path
    const fileName = baseName + '.mp3';
    const filePath = `songs/${fileName}`;

    // Fetch the audio file from R2
    const audioObj = await env.media.get(filePath);
    
    if (!audioObj) {
      console.error(`File not found: ${filePath}`);
      return new Response('Audio file not found', { status: 404 });
    }

    // Get file size for Content-Length header
    const fileSize = audioObj.size;

    // Check if client requested a specific range (for seeking)
    const range = req.headers.get('Range');
    
    if (range) {
      // Parse range header (e.g., "bytes=0-1023")
      const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
        
        // Ensure range is valid
        if (start >= 0 && start < fileSize && end < fileSize && start <= end) {
          const chunkSize = (end - start) + 1;
          
          // Get the range from R2
          const rangedObj = await env.media.get(filePath, {
            range: { offset: start, length: chunkSize }
          });

          if (rangedObj) {
            return new Response(rangedObj.body, {
              status: 206, // Partial Content
              headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': chunkSize.toString(),
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=86400', // Cache for 1 day
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Range',
                'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges'
              }
            });
          }
        }
      }
    }

    // No range requested or invalid range - serve entire file
    const headers = {
      'Content-Type': 'audio/mpeg',
      'Content-Length': fileSize.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges'
    };

    // Add metadata headers if available (useful for players)
    if (metadata) {
      if (metadata.title) {
        headers['X-Song-Title'] = encodeURIComponent(metadata.title);
      }
      if (metadata.primaryArtist) {
        headers['X-Song-Artist'] = encodeURIComponent(metadata.primaryArtist);
      }
      if (metadata.duration) {
        headers['X-Song-Duration'] = metadata.duration.toString();
      }
    }

    return new Response(audioObj.body, { headers });

  } catch (error) {
    console.error('Error streaming audio:', error);
    return new Response('Error streaming audio', { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function handleStreamOptions(req, env, ctx) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// Also handle HEAD requests for checking file existence
export async function handleStreamHead(req, env, ctx) {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    if (!filename) {
      return new Response('Missing song identifier', { status: 400 });
    }

    // REMOVE SlugManager
    // const slugManager = new SlugManager(env);
    // const baseName = await slugManager.getIdFromSlug('songs', decodeURIComponent(slug));
    
    let baseName = decodeURIComponent(filename);
    if (baseName.endsWith('.mp3')) {
      baseName = baseName.slice(0, -4);
    }
    
    if (!baseName) {
      return new Response('Song not found', { status: 404 });
    }

    const fileName = baseName + '.mp3';
    const filePath = `songs/${fileName}`;
    
    // Check if file exists without fetching the body
    const audioObj = await env.media.head(filePath);
    
    if (!audioObj) {
      return new Response('Audio file not found', { status: 404 });
    }

    return new Response(null, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioObj.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error in HEAD request:', error);
    return new Response('Error', { status: 500 });
  }
}