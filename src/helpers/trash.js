// ==================== R2 TRASH HELPER (FULLY FIXED) ====================

import { getAlbums, saveAlbums } from './storage.js';
import { getArtists, saveArtists } from './storage.js';
import { getPlaylists, savePlaylists } from './storage.js';
import { getMetadata, saveMetadata } from './storage.js';

// ================= MOVE TO TRASH =================

export async function moveToTrash(env, adminId, itemType, itemId, itemName, metadata = {}) {
  try {
    const trashId = `${itemType}_${itemId}_${Date.now()}`;
    const trashPaths = [];
    let totalSize = 0;

    const moveSingleFile = async (originalPath) => {
      const trashPath = `trash/${originalPath}`;

      const file = await env.media.get(originalPath);
      if (!file) return;

      const data = await file.arrayBuffer();

      await env.media.put(trashPath, data, {
        httpMetadata: file.httpMetadata,
        customMetadata: {
          ...file.customMetadata,
          originalPath,
          movedToTrash: new Date().toISOString()
        }
      });

      await env.media.delete(originalPath);

      trashPaths.push(trashPath);
      totalSize += file.size || 0;
    };

    switch (itemType) {
      case 'song':
        await moveSingleFile(`songs/${itemId}.mp3`);
        await moveSingleFile(`images/${itemId}.jpg`);
        await moveSingleFile(`images/${itemId}.png`);
        break;

      case 'album':
        await moveSingleFile(`albums/thumbnails/${itemId}.jpg`);
        break;

      case 'artist':
        await moveSingleFile(`artists/thumbnails/${itemId}.jpg`);
        break;

      case 'playlist':
        await moveSingleFile(`playlists/thumbnails/${itemId}.jpg`);
        break;
    }

    await env.DB.prepare(
      `INSERT INTO trash_items (
        id, item_type, item_id, item_name,
        original_path, trash_path, metadata,
        deleted_by, expires_at, size_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      trashId,
      itemType,
      itemId,
      itemName,
      '', // not needed anymore
      JSON.stringify(trashPaths),
      JSON.stringify(metadata || {}),
      adminId,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      totalSize
    ).run();

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ================= RESTORE FROM TRASH =================

export async function restoreFromTrash(env, adminId, trashId) {
  try {
    const item = await env.DB.prepare(
      `SELECT * FROM trash_items WHERE id = ? AND restored_at IS NULL`
    ).bind(trashId).first();

    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    const trashPaths = JSON.parse(item.trash_path || '[]');
    let restoredCount = 0;

    for (const trashPath of trashPaths) {
      const file = await env.media.get(trashPath);
      if (!file) continue;

      const data = await file.arrayBuffer();
      const originalPath =
        file.customMetadata?.originalPath ||
        trashPath.replace('trash/', '');

      await env.media.put(originalPath, data, {
        httpMetadata: file.httpMetadata,
        customMetadata: {
          ...file.customMetadata,
          restoredAt: new Date().toISOString(),
          restoredBy: adminId
        }
      });

      await env.media.delete(trashPath);
      restoredCount++;
    }

    if (restoredCount === 0) {
      return { success: false, error: 'No files restored' };
    }

    // Restore metadata
    const metadata = JSON.parse(item.metadata || '{}');

    switch (item.item_type) {
      case 'song':
        await saveMetadata(env, item.item_id, metadata);
        break;

      case 'album':
        const albums = await getAlbums(env);
        albums[item.item_id] = { ...metadata, id: item.item_id };
        await saveAlbums(env, albums);
        break;

      case 'artist':
        const artists = await getArtists(env);
        artists[item.item_id] = { ...metadata, id: item.item_id };
        await saveArtists(env, artists);
        break;

      case 'playlist':
        const playlists = await getPlaylists(env);
        playlists[item.item_id] = { ...metadata, id: item.item_id };
        await savePlaylists(env, playlists);
        break;
    }

    await env.DB.prepare(
      `UPDATE trash_items SET restored_at = CURRENT_TIMESTAMP, restored_by = ? WHERE id = ?`
    ).bind(adminId, trashId).run();

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ================= DELETE PERMANENTLY =================

export async function deletePermanently(env, trashId) {
  try {
    const item = await env.DB.prepare(
      `SELECT * FROM trash_items WHERE id = ?`
    ).bind(trashId).first();

    if (!item) return { success: false };

    const trashPaths = JSON.parse(item.trash_path || '[]');

    for (const path of trashPaths) {
      await env.media.delete(path);
    }

    await env.DB.prepare(
      `DELETE FROM trash_items WHERE id = ?`
    ).bind(trashId).run();

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}