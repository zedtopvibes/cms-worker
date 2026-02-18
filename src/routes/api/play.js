// ==================== API: Track Plays ====================
import { incrementPlays } from '../../helpers/playsDownloadsEnhanced.js';

export async function handleTrackPlay(req, env, ctx) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const songKey = pathParts[pathParts.length - 1]; // Get song ID from URL
    
    if (!songKey) {
      return new Response('Missing song ID', { status: 400 });
    }

    console.log(`🎵 Tracking play for song: ${songKey}`);

    // Track the play using our new enhanced function
    await incrementPlays(env, 'song', decodeURIComponent(songKey));
    
    return new Response('OK', { 
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*', // Allow from any origin
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
  } catch (error) {
    console.error('Error tracking play:', error);
    return new Response('Error tracking play', { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function handleTrackPlayOptions(req, env, ctx) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}