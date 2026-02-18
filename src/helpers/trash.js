// ==================== R2 TRASH HELPER ====================
import { getAlbums, saveAlbums } from './storage.js';
import { getArtists, saveArtists } from './storage.js';
import { getPlaylists, savePlaylists } from './storage.js';
import { getMetadata, saveMetadata } from './storage.js';

// Move item to trash
export async function moveToTrash(env, adminId, itemType, itemId, itemName, metadata = {}, sizeBytes = 0) {
  console.log('🗑️ Moving to trash:', { itemType, itemId, itemName });

  try {
    const settings = await getTrashSettings(env);
    const retentionDays = settings?.retention_days || 30;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);
    
    const trashId = `${itemType}_${itemId}_${Date.now()}`;
    let totalSize = sizeBytes || 0;
    let trashPaths = [];

    // Handle different item types
    switch (itemType) {
      case 'song':
        const files = await moveSongToTrash(env, itemId);
        trashPaths = files.paths || [];
        totalSize = files.totalSize || 0;
        break;
      case 'album':
        trashPaths = [`trash/albums/thumbnails/${itemId}.jpg`];
        break;
      case 'artist':
        trashPaths = [`trash/artists/thumbnails/${itemId}.jpg`];
        break;
      case 'playlist':
        trashPaths = [`trash/playlists/thumbnails/${itemId}.jpg`];
        break;
    }

    console.log('📁 Generated trash paths:', trashPaths);

    // Safety checks
    const safeValues = {
      id: trashId || '',
      item_type: itemType || '',
      item_id: itemId || '',
      item_name: itemName || itemId || 'Unknown',
      original_path: getOriginalPath(itemType, itemId) || '',
      trash_path: JSON.stringify(trashPaths || []),
      metadata: JSON.stringify(metadata || {}),
      deleted_by: adminId || 'system',
      expires_at: expiresAt.toISOString() || new Date().toISOString(),
      size_bytes: typeof totalSize === 'number' ? totalSize : 0
    };

    // Store in database
    await env.DB.prepare(
      `INSERT INTO trash_items (
        id, item_type, item_id, item_name, original_path, 
        trash_path, metadata, deleted_by, expires_at, size_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      safeValues.id,
      safeValues.item_type,
      safeValues.item_id,
      safeValues.item_name,
      safeValues.original_path,
      safeValues.trash_path,
      safeValues.metadata,
      safeValues.deleted_by,
      safeValues.expires_at,
      safeValues.size_bytes
    ).run();

    return { 
      success: true, 
      trashId, 
      message: '✅ Item moved to trash' 
    };

  } catch (error) {
    console.error('❌ Error moving to trash:', error);
    return { 
      success: false, 
      error: error.message, 
      message: `❌ Error: ${error.message}` 
    };
  }
}

// DEBUG VERSION - Restore from trash with detailed logging
export async function restoreFromTrash(env, adminId, trashId) {
  console.log('🔄 Restoring from R2:', trashId);

  try {
    // STEP 1: Get item from database
    console.log('Step 1: Fetching from database...');
    const item = await env.DB.prepare(
      `SELECT * FROM trash_items WHERE id = ? AND restored_at IS NULL`
    ).bind(trashId).first();

    if (!item) { 
      return { 
        success: false, 
        error: 'Item not found in trash', 
        message: '❌ Item not found in trash. It may have been already restored or permanently deleted.' 
      }; 
    }
    
    console.log('✅ Item found:', { 
      type: item.item_type, 
      name: item.item_name,
      id: item.item_id,
      trash_path: item.trash_path 
    });
    
    // STEP 2: Parse trash paths
    console.log('Step 2: Parsing R2 paths...');
    let trashPaths = [];
    try {
      trashPaths = JSON.parse(item.trash_path || '[]');
      console.log('📁 R2 trash paths:', trashPaths);
    } catch (e) {
      console.error('❌ Failed to parse trash_path:', e);
      return { 
        success: false, 
        error: 'Invalid trash paths', 
        message: '❌ Could not parse trash paths. The trash item may be corrupted.' 
      };
    }

    if (trashPaths.length === 0) {
      console.log('⚠️ No trash paths found in database');
      return {
        success: false,
        error: 'No files to restore',
        message: '❌ No files associated with this item in trash.'
      };
    }

    // STEP 3: Restore files from R2
    console.log('Step 3: Restoring files from R2...');
    let filesRestored = 0;
    let filesFailed = 0;
    const debugInfo = [];

    for (const trashPath of trashPaths) {
      try {
        console.log(`🔍 Checking R2 for: ${trashPath}`);
        const file = await env.media.get(trashPath);
        
        if (file) {
          console.log(`📦 Found file in R2:`, {
            size: file.size,
            key: trashPath,
            httpMetadata: file.httpMetadata ? 'present' : 'none',
            customMetadata: file.customMetadata ? 'present' : 'none'
          });
          
          // Construct the original R2 path (remove 'trash/' prefix)
          const originalPath = trashPath.replace('trash/', '');
          console.log(`📋 Original path will be: ${originalPath}`);
          
          // Copy back to original location in R2 with metadata
          console.log(`📤 Copying to R2: ${originalPath}`);
          await env.media.put(originalPath, file.body, {
            httpMetadata: file.httpMetadata,
            customMetadata: file.customMetadata
          });
          
          // Delete from trash in R2
          console.log(`🗑️ Deleting from trash: ${trashPath}`);
          await env.media.delete(trashPath);
          
          filesRestored++;
          debugInfo.push({ 
            success: true, 
            trashPath, 
            originalPath, 
            size: file.size 
          });
          console.log(`✅ Successfully restored: ${trashPath} -> ${originalPath}`);
        } else {
          console.log(`❌ File NOT found in R2: ${trashPath}`);
          filesFailed++;
          debugInfo.push({ 
            success: false, 
            trashPath, 
            error: 'File not found in R2' 
          });
        }
      } catch (e) {
        console.error(`❌ Error restoring from R2 ${trashPath}:`, e);
        filesFailed++;
        debugInfo.push({ 
          success: false, 
          trashPath, 
          error: e.message 
        });
      }
    }

    if (filesRestored === 0 && trashPaths.length > 0) {
      console.log('❌ No files restored. Debug info:', JSON.stringify(debugInfo, null, 2));
      return { 
        success: false, 
        error: 'No files restored from R2', 
        message: '❌ Could not restore any files. The files may be missing from trash.',
        debug: debugInfo
      };
    }

    // STEP 4: Restore metadata
    console.log('Step 4: Restoring metadata...');
    const metadata = JSON.parse(item.metadata || '{}');
    
    try {
      switch (item.item_type) {
        case 'song':
          if (Object.keys(metadata).length > 0) {
            await saveMetadata(env, item.item_id, metadata);
            console.log('✅ Song metadata restored');
          }
          break;
          
        case 'album':
          const albums = await getAlbums(env);
          albums[item.item_id] = { 
            ...metadata, 
            id: item.item_id, 
            songs: metadata.songs || [] 
          };
          await saveAlbums(env, albums);
          console.log('✅ Album metadata restored');
          break;
          
        case 'artist':
          const artists = await getArtists(env);
          artists[item.item_id] = { 
            ...metadata, 
            id: item.item_id, 
            songs: metadata.songs || [], 
            albums: metadata.albums || [] 
          };
          await saveArtists(env, artists);
          console.log('✅ Artist metadata restored');
          break;
          
        case 'playlist':
          const playlists = await getPlaylists(env);
          playlists[item.item_id] = { 
            ...metadata, 
            id: item.item_id, 
            songs: metadata.songs || [], 
            updated: Date.now() 
          };
          await savePlaylists(env, playlists);
          console.log('✅ Playlist metadata restored');
          break;
          
        default:
          console.log('⚠️ Unknown item type for metadata restore:', item.item_type);
      }
    } catch (metaError) {
      console.error('❌ Metadata restore error:', metaError);
      return { 
        success: false, 
        error: metaError.message, 
        message: '❌ Failed to restore metadata: ' + metaError.message,
        debug: debugInfo
      };
    }

    // STEP 5: Mark as restored in database
    console.log('Step 5: Marking as restored in database...');
    await env.DB.prepare(
      `UPDATE trash_items SET restored_at = CURRENT_TIMESTAMP, restored_by = ? WHERE id = ?`
    ).bind(adminId, trashId).run();

    console.log('✅ Restore complete!');
    
    return { 
      success: true, 
      item, 
      message: `✅ Successfully restored ${item.item_name} from R2 (${filesRestored} files restored)`,
      debug: debugInfo
    };

  } catch (error) {
    console.error('❌ Restore error:', error);
    return {
      success: false,
      error: error.message,
      message: `❌ Error: ${error.message}`,
      stack: error.stack
    };
  }
}

// Permanently delete from R2
export async function deletePermanently(env, trashId) {
  console.log('🗑️ Deleting permanently from R2:', trashId);

  try {
    const item = await env.DB.prepare(
      `SELECT * FROM trash_items WHERE id = ?`
    ).bind(trashId).first();

    if (!item) { 
      return { 
        success: false, 
        error: 'Item not found', 
        message: '❌ Item not found' 
      }; 
    }
    
    const trashPaths = JSON.parse(item.trash_path || '[]');
    console.log('📁 Files to delete from R2:', trashPaths);

    // Delete files from R2
    for (const path of trashPaths) {
      try {
        await env.media.delete(path);
        console.log('✅ Deleted from R2:', path);
      } catch (e) {
        console.error('❌ Error deleting from R2:', path, e);
      }
    }

    // Remove from database
    await env.DB.prepare(`DELETE FROM trash_items WHERE id = ?`).bind(trashId).run();

    return { 
      success: true, 
      message: '✅ Item permanently deleted from R2' 
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return { 
      success: false, 
      error: error.message, 
      message: `❌ Error: ${error.message}` 
    };
  }
}

// Empty trash (delete all from R2)
export async function emptyTrash(env, itemType = 'all') {
  console.log('🧹 Emptying trash from R2:', itemType);

  try {
    let query = `SELECT * FROM trash_items WHERE restored_at IS NULL`;
    let deleteQuery = `DELETE FROM trash_items WHERE restored_at IS NULL`;

    if (itemType !== 'all') { 
      query += ` AND item_type = ?`; 
      deleteQuery += ` AND item_type = ?`; 
    }
    
    const items = await env.DB.prepare(query)
      .bind(...(itemType !== 'all' ? [itemType] : []))
      .all();

    console.log(`📁 Found ${items.results.length} items to delete from R2`);

    // Delete files from R2
    for (const item of items.results) {
      const trashPaths = JSON.parse(item.trash_path || '[]');
      for (const path of trashPaths) {
        try {
          await env.media.delete(path);
          console.log('✅ Deleted from R2:', path);
        } catch (e) {
          console.error('❌ Error deleting from R2:', path, e);
        }
      }
    }

    // Delete from database
    await env.DB.prepare(deleteQuery)
      .bind(...(itemType !== 'all' ? [itemType] : []))
      .run();

    return { 
      success: true, 
      count: items.results.length, 
      message: `✅ Emptied ${items.results.length} items from R2` 
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return { 
      success: false, 
      error: error.message, 
      message: `❌ Error: ${error.message}` 
    };
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

    const countResult = await env.DB.prepare(countQuery)
      .bind(...params)
      .first();
    const total = countResult?.total || 0;

    const queryParams = [...params, limit, offset];
    const { results } = await env.DB.prepare(
      `${query} ORDER BY deleted_at DESC LIMIT ? OFFSET ?`
    ).bind(...queryParams).all();

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
          day: '2-digit', 
          month: 'short', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };
    });

    return { 
      items, 
      total, 
      page, 
      totalPages: Math.ceil(total / limit) 
    };

  } catch (error) {
    console.error('Error getting trash items:', error);
    return { 
      items: [], 
      total: 0, 
      page: 1, 
      totalPages: 1 
    };
  }
}

// Get trash stats
export async function getTrashStats(env) {
  try {
    const stats = await env.DB.prepare(
      `SELECT 
        COUNT(CASE WHEN item_type = 'song' THEN 1 END) as songs,
        COUNT(CASE WHEN item_type = 'album' THEN 1 END) as albums,
        COUNT(CASE WHEN item_type = 'artist' THEN 1 END) as artists,
        COUNT(CASE WHEN item_type = 'playlist' THEN 1 END) as playlists,
        COUNT(*) as total,
        SUM(size_bytes) as total_size
      FROM trash_items 
      WHERE restored_at IS NULL`
    ).first();

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
    console.error('Error getting trash settings:', error);
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
      `UPDATE trash_settings 
       SET retention_days = ?, auto_cleanup = ?, max_trash_size_mb = ?, 
           notify_before_delete = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? 
       WHERE id = 1`
    ).bind(
      settings.retention_days,
      settings.auto_cleanup ? 1 : 0,
      settings.max_trash_size_mb,
      settings.notify_before_delete ? 1 : 0,
      adminId
    ).run();

    return { success: true, message: '✅ Settings updated' };

  } catch (error) {
    console.error('Error updating trash settings:', error);
    return { 
      success: false, 
      error: error.message, 
      message: `❌ Error: ${error.message}` 
    };
  }
}

// Cleanup expired items from R2
export async function cleanupExpiredTrash(env) {
  try {
    const settings = await getTrashSettings(env);

    if (!settings.auto_cleanup) { 
      return { success: true, message: 'Auto cleanup disabled' }; 
    }

    const expired = await env.DB.prepare(
      `SELECT * FROM trash_items WHERE restored_at IS NULL AND expires_at < CURRENT_TIMESTAMP`
    ).all();

    console.log(`🧹 Found ${expired.results.length} expired items to clean up`);

    // Delete files from R2
    for (const item of expired.results) {
      const trashPaths = JSON.parse(item.trash_path || '[]');
      for (const path of trashPaths) {
        try {
          await env.media.delete(path);
          console.log('✅ Deleted expired from R2:', path);
        } catch (e) {
          console.error('❌ Error deleting expired from R2:', path, e);
        }
      }
    }

    // Delete from database
    await env.DB.prepare(
      `DELETE FROM trash_items WHERE restored_at IS NULL AND expires_at < CURRENT_TIMESTAMP`
    ).run();

    return { 
      success: true, 
      deleted: expired.results.length, 
      message: `✅ Cleaned up ${expired.results.length} items from R2` 
    };

  } catch (error) {
    console.error('Error cleaning up trash:', error);
    return { success: false, error: error.message };
  }
}

// DEBUG FUNCTION - Check R2 paths
export async function debugR2Paths(env, itemId) {
  console.log('🔍 Debugging R2 paths for item ID:', itemId);
  
  const pathsToCheck = [
    `songs/${itemId}.mp3`,
    `images/${itemId}.jpg`,
    `images/${itemId}.png`,
    `trash/songs/${itemId}.mp3`,
    `trash/images/${itemId}.jpg`,
    `trash/images/${itemId}.png`,
    `albums/thumbnails/${itemId}.jpg`,
    `artists/thumbnails/${itemId}.jpg`,
    `playlists/thumbnails/${itemId}.jpg`,
    `trash/albums/thumbnails/${itemId}.jpg`,
    `trash/artists/thumbnails/${itemId}.jpg`,
    `trash/playlists/thumbnails/${itemId}.jpg`
  ];
  
  const results = {};
  
  for (const path of pathsToCheck) {
    try {
      const file = await env.media.get(path);
      results[path] = file ? { 
        exists: true, 
        size: file.size,
        metadata: file.customMetadata 
      } : { exists: false };
      
      if (file) {
        console.log(`✅ Found: ${path} (${file.size} bytes)`);
      } else {
        console.log(`❌ Not found: ${path}`);
      }
    } catch (e) {
      results[path] = { exists: false, error: e.message };
      console.log(`❌ Error checking ${path}:`, e.message);
    }
  }
  
  return results;
}

// ===== HELPER FUNCTIONS =====

async function moveSongToTrash(env, songId) {
  const extensions = ['.mp3', '.jpg', '.png'];
  const paths = [];
  let totalSize = 0;

  for (const ext of extensions) {
    // Define R2 paths
    let originalPath;
    let trashPath;
    
    if (ext === '.mp3') {
      originalPath = `songs/${songId}${ext}`;
      trashPath = `trash/songs/${songId}${ext}`;
    } else {
      originalPath = `images/${songId}${ext}`;
      trashPath = `trash/images/${songId}${ext}`;
    }

    try { 
      // Get from R2
      console.log(`🔍 Checking R2 for: ${originalPath}`);
      const file = await env.media.get(originalPath); 
      
      if (file) { 
        console.log(`📦 Found in R2: ${originalPath} (${file.size} bytes)`);
        
        // Move to trash in R2 with metadata
        await env.media.put(trashPath, file.body, {
          httpMetadata: file.httpMetadata,
          customMetadata: file.customMetadata
        }); 
        
        // Delete from original R2 location
        await env.media.delete(originalPath); 
        
        paths.push(trashPath); 
        totalSize += file.size || 0; 
        console.log(`✅ Moved in R2: ${originalPath} -> ${trashPath}`); 
      } else {
        console.log(`📭 File not found in R2: ${originalPath}`);
      }
    } catch (e) { 
      console.log(`❌ Error accessing R2 file: ${originalPath}`, e.message);
    } 
  }

  console.log(`📊 Move summary: ${paths.length} files moved, total size: ${totalSize} bytes`);
  return { paths, totalSize };
}

function getOriginalPath(type, id) {
  if (!type || !id) return '';

  switch (type) {
    case 'song': return `songs/${id}.mp3`;
    case 'album': return `albums/thumbnails/${id}.jpg`;
    case 'artist': return `artists/thumbnails/${id}.jpg`;
    case 'playlist': return `playlists/thumbnails/${id}.jpg`;
    default: return '';
  }
}

function formatBytes(bytes) {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}