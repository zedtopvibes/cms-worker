// ==================== R2 TRASH HELPER ====================

// Move item to trash
export async function moveToTrash(env, adminId, itemType, itemId, itemName, metadata = {}, sizeBytes = 0) {
  try {
    const settings = await getTrashSettings(env);
    const retentionDays = settings?.retention_days || 30;
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);
    
    const trashId = `${itemType}_${itemId}_${Date.now()}`;
    let totalSize = sizeBytes;
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

// EMPTY TRASH - ADD THIS FUNCTION
export async function emptyTrash(env, itemType = 'all') {
  try {
    let query = `SELECT * FROM trash_items WHERE restored_at IS NULL`;
    let deleteQuery = `DELETE FROM trash_items WHERE restored_at IS NULL`;
    
    if (itemType !== 'all') {
      query += ` AND item_type = ?`;
      deleteQuery += ` AND item_type = ?`;
    }
    
    const items = await env.DB.prepare(query).bind(...(itemType !== 'all' ? [itemType] : [])).all();
    
    // Delete files from R2
    for (const item of items.results) {
      const trashPaths = JSON.parse(item.trash_path || '[]');
      for (const path of trashPaths) {
        await env.media.delete(path).catch(() => {});
      }
    }
    
    // Delete from database
    await env.DB.prepare(deleteQuery).bind(...(itemType !== 'all' ? [itemType] : [])).run();
    
    return { success: true, count: items.results.length };
  } catch (error) {
    console.error('Error emptying trash:', error);
    return { success: false, error: error.message };
  }
}

// Get trash items
export async function getTrashItems(env, type = 'all', page = 1, limit = 20, search = '') {
  try {
    const offset = (page - 1) * limit;
    const params = [];
    
    let query = `SELECT * FROM trash_items WHERE restored_at IS NULL`;
    let countQuery = `SELECT COUNT(*) as total FROM trash_items WHERE restored_at IS NULL`;
    
    if (type !== 'all') {
      query += ` AND item_type = ?`;
      countQuery += ` AND item_type = ?`;
      params.push(type);
    }
    
    if (search) {
      query += ` AND item_name LIKE ?`;
      countQuery += ` AND item_name LIKE ?`;
      params.push(`%${search}%`);
    }
    
    // Get total count
    const countResult = await env.DB.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;
    
    // Get paginated items
    const queryParams = [...params, limit, offset];
    const { results } = await env.DB.prepare(
      `${query} ORDER BY deleted_at DESC LIMIT ? OFFSET ?`
    ).bind(...queryParams).all();
    
    // Calculate days left
    const now = new Date();
    const items = results.map(item => {
      const expiresAt = new Date(item.expires_at);
      const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)));
      const itemData = JSON.parse(item.metadata || '{}');
      
      return {
        ...item,
        daysLeft,
        itemData,
        thumbnail: itemData.thumbnail || null,
        formattedSize: formatBytes(item.size_bytes || 0),
        deletedDate: new Date(item.deleted_at).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      };
    });
    
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  } catch (error) {
    console.error('Error getting trash items:', error);
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }
}

// Get trash stats
export async function getTrashStats(env) {
  try {
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(CASE WHEN item_type = 'song' THEN 1 END) as songs,
        COUNT(CASE WHEN item_type = 'album' THEN 1 END) as albums,
        COUNT(CASE WHEN item_type = 'artist' THEN 1 END) as artists,
        COUNT(CASE WHEN item_type = 'playlist' THEN 1 END) as playlists,
        COUNT(*) as total,
        SUM(size_bytes) as total_size
      FROM trash_items
      WHERE restored_at IS NULL
    `).first();
    
    const settings = await getTrashSettings(env);
    
    return {
      songs: stats?.songs || 0,
      albums: stats?.albums || 0,
      artists: stats?.artists || 0,
      playlists: stats?.playlists || 0,
      total: stats?.total || 0,
      totalSize: stats?.total_size || 0,
      formattedSize: formatBytes(stats?.total_size || 0),
      retentionDays: settings?.retention_days || 30
    };
  } catch (error) {
    console.error('Error getting trash stats:', error);
    return {
      songs: 0, albums: 0, artists: 0, playlists: 0,
      total: 0, totalSize: 0, formattedSize: '0 B', retentionDays: 30
    };
  }
}

// Get trash settings
export async function getTrashSettings(env) {
  try {
    const settings = await env.DB.prepare(
      `SELECT * FROM trash_settings WHERE id = 1`
    ).first();
    
    return settings || {
      retention_days: 30,
      auto_cleanup: 1,
      max_trash_size_mb: 1024,
      notify_before_delete: 1
    };
  } catch (error) {
    return {
      retention_days: 30,
      auto_cleanup: 1,
      max_trash_size_mb: 1024,
      notify_before_delete: 1
    };
  }
}

// Update trash settings
export async function updateTrashSettings(env, adminId, settings) {
  try {
    await env.DB.prepare(
      `UPDATE trash_settings SET
        retention_days = ?,
        auto_cleanup = ?,
        max_trash_size_mb = ?,
        notify_before_delete = ?,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = ?
       WHERE id = 1`
    ).bind(
      settings.retention_days,
      settings.auto_cleanup ? 1 : 0,
      settings.max_trash_size_mb,
      settings.notify_before_delete ? 1 : 0,
      adminId
    ).run();
    
    return { success: true };
  } catch (error) {
    console.error('Error updating trash settings:', error);
    return { success: false, error: error.message };
  }
}

// Cleanup expired items (for cron job)
export async function cleanupExpiredTrash(env) {
  try {
    const settings = await getTrashSettings(env);
    
    if (!settings.auto_cleanup) {
      return { success: true, message: 'Auto cleanup disabled' };
    }
    
    // Get expired items
    const expired = await env.DB.prepare(
      `SELECT * FROM trash_items 
       WHERE restored_at IS NULL AND expires_at < CURRENT_TIMESTAMP`
    ).all();
    
    // Delete files from R2
    for (const item of expired.results) {
      const trashPaths = JSON.parse(item.trash_path || '[]');
      for (const path of trashPaths) {
        await env.media.delete(path).catch(() => {});
      }
    }
    
    // Delete from database
    await env.DB.prepare(
      `DELETE FROM trash_items WHERE restored_at IS NULL AND expires_at < CURRENT_TIMESTAMP`
    ).run();
    
    return { success: true, deleted: expired.results.length };
  } catch (error) {
    console.error('Error cleaning up trash:', error);
    return { success: false, error: error.message };
  }
}

// ===== HELPER FUNCTIONS =====

async function moveSongToTrash(env, songId) {
  const extensions = ['.mp3', '.jpg', '.png'];
  const paths = [];
  let totalSize = 0;

  for (const ext of extensions) {
    const originalPath = ext === '.mp3' ? `songs/${songId}${ext}` : `images/${songId}${ext}`;
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

function getOriginalPath(type, id) {
  switch (type) {
    case 'song': return `songs/${id}.mp3`;
    case 'album': return `albums/thumbnails/${id}.jpg`;
    case 'artist': return `artists/thumbnails/${id}.jpg`;
    case 'playlist': return `playlists/thumbnails/${id}.jpg`;
    default: return '';
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}