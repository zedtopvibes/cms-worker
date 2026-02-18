// ==================== R2 TRASH HELPER ====================

// Move item to trash
export async function moveToTrash(env, adminId, itemType, itemId, itemName, metadata = {}) {
  try {
    const settings = await getTrashSettings(env);
    const retentionDays = settings?.retention_days || 30;
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);
    
    const trashId = `${itemType}_${itemId}_${Date.now()}`;
    let totalSize = 0;
    let trashPaths = [];

    // Handle different item types
    switch (itemType) {
      case 'song':
        // Move song file and associated files to trash
        const files = await moveSongToTrash(env, itemId);
        trashPaths = files.paths;
        totalSize = files.totalSize;
        break;
        
      case 'album':
        // Just track album metadata, don't move files (songs are handled separately)
        trashPaths = [`albums/thumbnails/${itemId}.jpg`];
        break;
        
      case 'artist':
        trashPaths = [`artists/thumbnails/${itemId}.jpg`];
        break;
        
      case 'playlist':
        trashPaths = [`playlists/thumbnails/${itemId}.jpg`];
        break;
    }

    // Store in database
    await env.DB.prepare(
      `INSERT INTO trash_items (
        id, item_type, item_id, item_name, original_path, trash_path, 
        metadata, deleted_by, expires_at, size_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      trashId,
      itemType,
      itemId,
      itemName || itemId,
      getOriginalPath(itemType, itemId),
      JSON.stringify(trashPaths),
      JSON.stringify(metadata),
      adminId,
      expiresAt.toISOString(),
      totalSize
    ).run();

    return { success: true, trashId };
  } catch (error) {
    console.error('Error moving to trash:', error);
    return { success: false, error: error.message };
  }
}

// Restore from trash
export async function restoreFromTrash(env, adminId, trashId) {
  try {
    const item = await env.DB.prepare(
      `SELECT * FROM trash_items WHERE id = ? AND restored_at IS NULL`
    ).bind(trashId).first();

    if (!item) {
      return { success: false, error: 'Item not found in trash' };
    }

    const trashPaths = JSON.parse(item.trash_path || '[]');

    // Restore files from trash folder
    for (const trashPath of trashPaths) {
      if (trashPath.startsWith('trash/')) {
        const originalPath = trashPath.replace('trash/', '');
        try {
          // Copy file back from trash
          const file = await env.media.get(trashPath);
          if (file) {
            await env.media.put(originalPath, file.body, {
              httpMetadata: file.httpMetadata,
              customMetadata: file.customMetadata
            });
            // Delete from trash
            await env.media.delete(trashPath);
          }
        } catch (e) {
          console.error('Error restoring file:', e);
        }
      }
    }

    // Mark as restored
    await env.DB.prepare(
      `UPDATE trash_items SET restored_at = CURRENT_TIMESTAMP, restored_by = ? WHERE id = ?`
    ).bind(adminId, trashId).run();

    return { success: true, item };
  } catch (error) {
    console.error('Error restoring from trash:', error);
    return { success: false, error: error.message };
  }
}

// Permanently delete
export async function deletePermanently(env, trashId) {
  try {
    const item = await env.DB.prepare(
      `SELECT * FROM trash_items WHERE id = ?`
    ).bind(trashId).first();

    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    const trashPaths = JSON.parse(item.trash_path || '[]');

    // Delete files from trash folder
    for (const path of trashPaths) {
      await env.media.delete(path).catch(() => {});
    }

    // Remove from database
    await env.DB.prepare(`DELETE FROM trash_items WHERE id = ?`).bind(trashId).run();

    return { success: true };
  } catch (error) {
    console.error('Error deleting permanently:', error);
    return { success: false, error: error.message };
  }
}

// Move song files to trash
async function moveSongToTrash(env, songId) {
  const extensions = ['.mp3', '.jpg', '.png'];
  const paths = [];
  let totalSize = 0;

  for (const ext of extensions) {
    const originalPath = ext === '.mp3' ? `songs/${songId}${ext}` : 
                        ext === '.txt' ? `descriptions/${songId}.txt` :
                        `images/${songId}${ext}`;
    
    const trashPath = `trash/${originalPath}`;
    
    try {
      const file = await env.media.get(originalPath);
      if (file) {
        // Move to trash
        await env.media.put(trashPath, file.body, {
          httpMetadata: file.httpMetadata,
          customMetadata: file.customMetadata
        });
        // Delete original
        await env.media.delete(originalPath);
        
        paths.push(trashPath);
        totalSize += file.size || 0;
      }
    } catch (e) {
      // File doesn't exist, ignore
    }
  }

  return { paths, totalSize };
}

// Helper functions
function getOriginalPath(type, id) {
  switch (type) {
    case 'song': return `songs/${id}.mp3`;
    case 'album': return `albums/thumbnails/${id}.jpg`;
    case 'artist': return `artists/thumbnails/${id}.jpg`;
    case 'playlist': return `playlists/thumbnails/${id}.jpg`;
    default: return '';
  }
}

// Get trash items (same as before)
export async function getTrashItems(env, type = 'all', page = 1, limit = 20, search = '') {
  // ... same as previous implementation
}

// Get trash stats
export async function getTrashStats(env) {
  // ... same as previous implementation
}

// Get settings
export async function getTrashSettings(env) {
  try {
    const settings = await env.DB.prepare(
      `SELECT * FROM trash_settings WHERE id = 1`
    ).first();
    return settings || { retention_days: 30, auto_cleanup: 1 };
  } catch (error) {
    return { retention_days: 30, auto_cleanup: 1 };
  }
}

// Update settings
export async function updateTrashSettings(env, adminId, settings) {
  await env.DB.prepare(
    `UPDATE trash_settings SET
      retention_days = ?, auto_cleanup = ?, updated_by = ?
     WHERE id = 1`
  ).bind(settings.retention_days, settings.auto_cleanup ? 1 : 0, adminId).run();
  return { success: true };
}

// Cleanup expired items
export async function cleanupExpiredTrash(env) {
  const expired = await env.DB.prepare(
    `SELECT * FROM trash_items 
     WHERE restored_at IS NULL AND expires_at < CURRENT_TIMESTAMP`
  ).all();

  for (const item of expired.results) {
    const paths = JSON.parse(item.trash_path || '[]');
    for (const path of paths) {
      await env.media.delete(path).catch(() => {});
    }
  }

  await env.DB.prepare(
    `DELETE FROM trash_items WHERE restored_at IS NULL AND expires_at < CURRENT_TIMESTAMP`
  ).run();

  return { deleted: expired.results.length };
}