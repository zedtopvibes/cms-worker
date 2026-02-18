// ==================== R2 TRASH HELPER - DEBUG VERSION ====================
import { getAlbums, saveAlbums } from './storage.js';
import { getArtists, saveArtists } from './storage.js';
import { getPlaylists, savePlaylists } from './storage.js';
import { getMetadata, saveMetadata } from './storage.js';

// Move item to trash
export async function moveToTrash(env, adminId, itemType, itemId, itemName, metadata = {}, sizeBytes = 0) {
  console.log('🗑️ moveToTrash called:', { itemType, itemId, itemName });
  
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
        console.log('Moving song to trash:', itemId);
        const files = await moveSongToTrash(env, itemId);
        trashPaths = files.paths || [];
        totalSize = files.totalSize || 0;
        console.log('Song files moved:', trashPaths);
        break;
      case 'album':
        trashPaths = [`albums/thumbnails/${itemId}.jpg`];
        break;
      case 'artist':
        trashPaths = [`artists/thumbnails/${itemId}.jpg`];
        break;
      case 'playlist':
        trashPaths = [`playlists/thumbnails/${itemId}.jpg`];
        break;
    }

    // SAFETY CHECKS - ensure NO undefined values
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

    console.log('Inserting into database:', {
      id: safeValues.id,
      type: safeValues.item_type,
      name: safeValues.item_name,
      trash_path: safeValues.trash_path.substring(0, 100) + '...'
    });

    // Store in database
    await env.DB.prepare(
      `INSERT INTO trash_items (
        id, item_type, item_id, item_name, original_path, trash_path, 
        metadata, deleted_by, expires_at, size_bytes
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

    console.log('✅ Item moved to trash successfully:', trashId);
    return { success: true, trashId };
  } catch (error) {
    console.error('❌ Error moving to trash:', error);
    return { success: false, error: error.message };
  }
}

// Restore from trash - DEBUG VERSION WITH DETAILED LOGGING
export async function restoreFromTrash(env, adminId, trashId) {
  console.log('🔄 ===== RESTORE FUNCTION CALLED =====');
  console.log('Parameters:', { adminId, trashId });
  
  try {
    // STEP 1: Get the item from database
    console.log('📥 STEP 1: Fetching item from database...');
    const item = await env.DB.prepare(
      `SELECT * FROM trash_items WHERE id = ? AND restored_at IS NULL`
    ).bind(trashId).first();

    if (!item) {
      console.error('❌ STEP 1 FAILED: Item not found in trash');
      console.log('Available trash items:');
      const allItems = await env.DB.prepare(`SELECT id, item_name FROM trash_items WHERE restored_at IS NULL LIMIT 5`).all();
      console.log(allItems.results);
      return { success: false, error: 'Item not found in trash' };
    }

    console.log('✅ STEP 1 SUCCESS: Item found', {
      id: item.id,
      type: item.item_type,
      name: item.item_name,
      deleted_at: item.deleted_at,
      expires_at: item.expires_at
    });

    // STEP 2: Parse trash paths
    console.log('📦 STEP 2: Parsing trash paths...');
    let trashPaths = [];
    try {
      trashPaths = JSON.parse(item.trash_path || '[]');
      console.log('Raw trash_path:', item.trash_path);
      console.log('Parsed trashPaths:', trashPaths);
    } catch (e) {
      console.error('❌ STEP 2 FAILED: Could not parse trash_path', e);
      trashPaths = [];
    }

    // STEP 3: Restore files from R2
    console.log('📁 STEP 3: Restoring files from R2 trash folder...');
    let filesRestored = 0;
    let filesFailed = 0;
    
    if (trashPaths.length === 0) {
      console.log('⚠️ No files to restore (trashPaths is empty)');
    } else {
      for (let i = 0; i < trashPaths.length; i++) {
        const trashPath = trashPaths[i];
        console.log(`  Processing file ${i + 1}/${trashPaths.length}: ${trashPath}`);
        
        try {
          // Check if file exists in trash
          console.log(`    Checking existence: ${trashPath}`);
          const file = await env.media.get(trashPath);
          
          if (file) {
            // Determine original path by removing 'trash/' prefix
            const originalPath = trashPath.replace('trash/', '');
            console.log(`    ✅ File found! Size: ${file.size} bytes`);
            console.log(`    Restoring to: ${originalPath}`);
            
            // Copy file back from trash
            await env.media.put(originalPath, file.body, {
              httpMetadata: file.httpMetadata,
              customMetadata: file.customMetadata
            });
            console.log(`    ✅ File copied to original location`);
            
            // Delete from trash
            await env.media.delete(trashPath);
            console.log(`    ✅ File deleted from trash folder`);
            
            filesRestored++;
            console.log(`    ✅ File ${i + 1} restored successfully`);
          } else {
            console.log(`    ❌ File not found in trash: ${trashPath}`);
            filesFailed++;
          }
        } catch (fileError) {
          console.error(`    ❌ Error restoring file ${trashPath}:`, fileError);
          filesFailed++;
        }
      }
    }
    
    console.log(`📊 STEP 3 complete: ${filesRestored} files restored, ${filesFailed} failed`);

    // STEP 4: Parse and restore metadata
    console.log('📝 STEP 4: Restoring metadata...');
    let metadata = {};
    try {
      metadata = JSON.parse(item.metadata || '{}');
      console.log('Metadata parsed:', metadata);
    } catch (e) {
      console.error('❌ Could not parse metadata:', e);
      metadata = {};
    }
    
    try {
      switch (item.item_type) {
        case 'song':
          console.log('Restoring song metadata...');
          if (Object.keys(metadata).length > 0) {
            await saveMetadata(env, item.item_id, metadata);
            console.log('✅ Song metadata restored');
          } else {
            console.log('⚠️ No metadata to restore for song');
          }
          break;
          
        case 'album':
          console.log('Restoring album metadata...');
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
          console.log('Restoring artist metadata...');
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
          console.log('Restoring playlist metadata...');
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
          console.log('Unknown item type:', item.item_type);
      }
    } catch (metaError) {
      console.error('❌ Error restoring metadata:', metaError);
    }

    // STEP 5: Mark as restored in database
    console.log('💾 STEP 5: Marking item as restored in database...');
    const updateResult = await env.DB.prepare(
      `UPDATE trash_items SET restored_at = CURRENT_TIMESTAMP, restored_by = ? WHERE id = ?`
    ).bind(adminId, trashId).run();
    
    console.log('Update result:', updateResult);
    console.log('✅ STEP 5 complete');

    console.log('🎉 ===== RESTORE COMPLETE =====');
    console.log(`Restored: ${item.item_type} - ${item.item_name}`);
    
    return { success: true, item };
    
  } catch (error) {
    console.error('💥 CATASTROPHIC ERROR in restoreFromTrash:', error);
    console.error('Error stack:', error.stack);
    return { success: false, error: error.message };
  }
}

// Permanently delete
export async function deletePermanently(env, trashId) {
  console.log('🗑️ deletePermanently called:', trashId);
  
  try {
    const item = await env.DB.prepare(
      `SELECT * FROM trash_items WHERE id = ?`
    ).bind(trashId).first();

    if (!item) {
      console.error('Item not found:', trashId);
      return { success: false, error: 'Item not found' };
    }

    const trashPaths = JSON.parse(item.trash_path || '[]');
    console.log('Deleting files:', trashPaths);

    // Delete files from trash folder
    for (const path of trashPaths) {
      try {
        await env.media.delete(path);
        console.log('Deleted:', path);
      } catch (e) {
        console.error('Error deleting:', path, e);
      }
    }

    // Remove from database
    await env.DB.prepare(`DELETE FROM trash_items WHERE id = ?`).bind(trashId).run();
    console.log('✅ Item permanently deleted');

    return { success: true };
  } catch (error) {
    console.error('Error deleting permanently:', error);
    return { success: false, error: error.message };
  }
}

// Empty trash
export async function emptyTrash(env, itemType = 'all') {
  console.log('🧹 emptyTrash called:', itemType);
  
  try {
    let query = `SELECT * FROM trash_items WHERE restored_at IS NULL`;
    let deleteQuery = `DELETE FROM trash_items WHERE restored_at IS NULL`;
    
    if (itemType !== 'all') {
      query += ` AND item_type = ?`;
      deleteQuery += ` AND item_type = ?`;
    }
    
    const items = await env.DB.prepare(query).bind(...(itemType !== 'all' ? [itemType] : [])).all();
    console.log(`Found ${items.results.length} items to delete`);
    
    // Delete files from R2
    for (const item of items.results) {
      const trashPaths = JSON.parse(item.trash_path || '[]');
      for (const path of trashPaths) {
        try {
          await env.media.delete(path);
        } catch (e) {
          console.error('Error deleting:', path, e);
        }
      }
    }
    
    // Delete from database
    await env.DB.prepare(deleteQuery).bind(...(itemType !== 'all' ? [itemType] : [])).run();
    
    console.log(`✅ Trash emptied: ${items.results.length} items deleted`);
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
    
    console.log(`Cleaning up ${expired.results.length} expired items`);
    
    // Delete files from R2
    for (const item of expired.results) {
      const trashPaths = JSON.parse(item.trash_path || '[]');
      for (const path of trashPaths) {
        try {
          await env.media.delete(path);
        } catch (e) {
          console.error('Error deleting:', path, e);
        }
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
        console.log(`Moving to trash: ${originalPath} (${file.size} bytes)`);
        
        // Move to trash
        await env.media.put(trashPath, file.body, {
          httpMetadata: file.httpMetadata,
          customMetadata: file.customMetadata
        });
        // Delete original
        await env.media.delete(originalPath);
        
        paths.push(trashPath);
        totalSize += file.size || 0;
        console.log(`✅ Moved: ${trashPath}`);
      }
    } catch (e) {
      // File doesn't exist, ignore
      console.log(`File not found: ${originalPath}`);
    }
  }

  return { 
    paths: paths || [], 
    totalSize: totalSize || 0 
  };
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

// Test function for browser console
export async function testRestore(env, trashId) {
  console.log('🧪 Running test restore for:', trashId);
  return await restoreFromTrash(env, 'test-admin', trashId);
}