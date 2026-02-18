// ==================== BULK OPERATIONS ====================
import { getAlbums, getArtists, getPlaylists, saveAlbums, saveArtists, savePlaylists, getMetadata, saveMetadata } from '../../helpers/storage.js';
import { getSongStats } from '../../helpers/db.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';
import { formatDuration, formatNumber } from '../../helpers/formatting.js';

export async function handleAdminBulk(req, env, ctx, auth) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'menu';
  const type = url.searchParams.get('type') || 'songs';

  if (action === 'menu') {
    return await renderBulkMenu(env, auth, type);
  } else if (action === 'select') {
    return await renderSelectionPage(env, auth, type, req);
  } else if (action === 'confirm') {
    return await renderConfirmPage(env, auth, req);
  } else if (action === 'execute') {
    return await executeBulkAction(req, env, ctx, auth);
  }

  return new Response('Invalid bulk action', { status: 400 });
}

// Render bulk operations menu
async function renderBulkMenu(env, auth, type) {
  // ... (your existing code - unchanged)
}

// Render selection page
async function renderSelectionPage(env, auth, type, req) {
  // ... (your existing code - unchanged)
}

// Generate song item
function generateSongItem(song, index, startIdx) {
  // ... (your existing code - unchanged)
}

// Generate album item
function generateAlbumItem(album, index, startIdx) {
  // ... (your existing code - unchanged)
}

// Generate artist item
function generateArtistItem(artist, index, startIdx) {
  // ... (your existing code - unchanged)
}

// Generate playlist item
function generatePlaylistItem(playlist, index, startIdx) {
  // ... (your existing code - unchanged)
}

// Generate pagination
function generatePagination(currentPage, totalPages, search, type) {
  // ... (your existing code - unchanged)
}

// Render confirmation page
async function renderConfirmPage(env, auth, req) {
  // ... (your existing code - unchanged)
}

// Execute bulk action
export async function executeBulkAction(req, env, ctx, auth) {
  const formData = await req.formData();
  const itemsJson = formData.get('items');
  const bulkAction = formData.get('bulkAction');
  const type = formData.get('type');
  const targetId = formData.get('targetId');

  const items = JSON.parse(itemsJson);
  let success = true;
  let message = '';
  let results = [];

  try {
    if (bulkAction === 'delete') {
      if (type === 'songs') {
        for (const baseName of items) {
          try {
            await env.media.delete(`songs/${baseName}.mp3`).catch(() => {});
            await env.media.delete(`images/${baseName}.jpg`).catch(() => {});
            await env.media.delete(`images/${baseName}.png`).catch(() => {});
            await env.media.delete(`descriptions/${baseName}.txt`).catch(() => {});
            await env.media.delete(`metadata/${baseName}.json`).catch(() => {});
            results.push({ id: baseName, status: 'deleted' });
          } catch (e) {
            results.push({ id: baseName, status: 'failed', error: e.message });
          }
        }
        message = `Deleted ${results.filter(r => r.status === 'deleted').length} songs`;
      } else if (type === 'albums') {
        const albums = await getAlbums(env);
        for (const albumId of items) {
          if (albums[albumId]?.thumbnail) {
            await env.media.delete(albums[albumId].thumbnail).catch(() => {});
          }
          delete albums[albumId];
        }
        await saveAlbums(env, albums);
        message = `Deleted ${items.length} albums`;
      } else if (type === 'artists') {
        const artists = await getArtists(env);
        for (const artistId of items) {
          if (artists[artistId]?.thumbnail) {
            await env.media.delete(artists[artistId].thumbnail).catch(() => {});
          }
          delete artists[artistId];
        }
        await saveArtists(env, artists);
        message = `Deleted ${items.length} artists`;
      } else if (type === 'playlists') {
        const playlists = await getPlaylists(env);
        for (const playlistId of items) {
          if (playlists[playlistId]?.thumbnail) {
            await env.media.delete(playlists[playlistId].thumbnail).catch(() => {});
          }
          delete playlists[playlistId];
        }
        await savePlaylists(env, playlists);
        message = `Deleted ${items.length} playlists`;
      }
      
      // ✅ LOG BULK DELETE (ALREADY HERE)
      await logAdminActivity(env, auth.session.id, 'bulk-delete', type, 'multiple', `Deleted ${items.length} ${type}`);

    } else if (bulkAction === 'export') {
      // Generate CSV
      let csv = '';
      if (type === 'songs') {
        csv = 'ID,Title,Artist,Album,Duration,Plays,Downloads\n';
        for (const baseName of items) {
          const meta = await getMetadata(env, baseName);
          const stats = await getSongStats(baseName, env);
          const title = meta?.title || baseName;
          const artist = meta?.primaryArtist || baseName.split('_')[0];
          csv += `"${baseName}","${title}","${artist}",,${meta?.duration || 0},${stats.plays},${stats.downloads}\n`;
        }
      }
      
      // ✅ ADD LOGGING FOR EXPORT
      await logAdminActivity(env, auth.session.id, 'bulk-export', type, 'multiple', `Exported ${items.length} ${type}`);
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type}-export-${Date.now()}.csv"`
        }
      });

    } else if (bulkAction === 'addToAlbum' && targetId) {
      const albums = await getAlbums(env);
      const albumTitle = albums[targetId]?.title || targetId;
      
      if (albums[targetId]) {
        for (const baseName of items) {
          if (!albums[targetId].songs.includes(baseName)) {
            albums[targetId].songs.push(baseName);
          }
        }
        await saveAlbums(env, albums);
        message = `Added ${items.length} songs to album`;
        
        // ✅ ADD LOGGING FOR ADD TO ALBUM
        await logAdminActivity(env, auth.session.id, 'bulk-add-to-album', type, targetId, 
          `Added ${items.length} songs to album "${albumTitle}"`);
      }
      
    } else if (bulkAction === 'addToPlaylist' && targetId) {
      const playlists = await getPlaylists(env);
      const playlistTitle = playlists[targetId]?.title || targetId;
      
      if (playlists[targetId]) {
        for (const baseName of items) {
          if (!playlists[targetId].songs.includes(baseName)) {
            playlists[targetId].songs.push(baseName);
          }
        }
        playlists[targetId].updated = Date.now();
        await savePlaylists(env, playlists);
        message = `Added ${items.length} songs to playlist`;
        
        // ✅ ADD LOGGING FOR ADD TO PLAYLIST
        await logAdminActivity(env, auth.session.id, 'bulk-add-to-playlist', type, targetId, 
          `Added ${items.length} songs to playlist "${playlistTitle}"`);
      }
    }

    // Redirect back to bulk menu with success message
    return new Response(null, {
      status: 302,
      headers: { 
        'Location': `/admin/bulk?success=${encodeURIComponent(message)}` 
      }
    });

  } catch (error) {
    return new Response(null, {
      status: 302,
      headers: { 
        'Location': `/admin/bulk?error=${encodeURIComponent(error.message)}` 
      }
    });
  }
}