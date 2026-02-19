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

// FIXED: Restore from trash with proper arrayBuffer handling
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
      console.log('📁 R2 trash paths from DB:', trashPaths);
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

    // STEP 3: Restore files from R2 with proper arrayBuffer handling
    console.log('Step 3: Restoring files from R2...');
    let filesRestored = 0;
    let filesFailed = 0;
    const restoredFiles = [];

    for (const trashPath of trashPaths) {
      try {
        console.log(`🔍 Getting file from R2 trash: ${trashPath}`);
        
        // Get the file from R2 trash location
        const file = await env.media.get(trashPath);
        
        if (file) {
          console.log(`📦 Found file in R2:`, {
            size: file.size,
            path: trashPath,
            hasMetadata: !!file.customMetadata
          });
          
          // FIX 1: Convert stream to arrayBuffer BEFORE using it
          console.log(`📥 Reading file data as arrayBuffer...`);
          const fileData = await file.arrayBuffer();
          console.log(`✅ Read ${fileData.byteLength} bytes`);
          
          // Get original path from metadata if available, otherwise construct it
          let originalPath = file.customMetadata?.originalPath;
          
          if (!originalPath) {
            // Fallback: construct from trash path
            originalPath = trashPath.replace('trash/', '');
            console.log(`⚠️ No originalPath in metadata, using constructed path: ${originalPath}`);
          } else {
            console.log(`📋 Found originalPath in metadata: ${originalPath}`);
          }
          
          // FIX 2: Copy back to original location using arrayBuffer
          console.log(`📤 Copying to R2: ${originalPath}`);
          await env.media.put(originalPath, fileData, {
            httpMetadata: file.httpMetadata,
            customMetadata: {
              ...file.customMetadata,
              restoredAt: new Date().toISOString(),
              restoredBy: adminId
            }
          });
          
          // FIX 3: Only delete from trash after successful restore
          console.log(`🗑️ Deleting from trash: ${trashPath}`);
          await env.media.delete(trashPath);
          
          filesRestored++;
          restoredFiles.push({ 
            from: trashPath, 
            to: originalPath, 
            size: file.size,
            bytesRead: fileData.byteLength
          });
          console.log(`✅ Successfully restored: ${trashPath} -> ${originalPath}`);
        } else {
          console.log(`❌ File NOT found in R2: ${trashPath}`);
          filesFailed++;
        }
      } catch (e) {
        console.error(`❌ Error restoring from R2 ${trashPath}:`, e);
        filesFailed++;
      }
    }

    if (filesRestored === 0 && trashPaths.length > 0) {
      return { 
        success: false, 
        error: 'No files restored from R2', 
        message: '❌ Could not restore any files. The files may be missing from trash or corrupted.',
        debug: {
          trashPaths,
          filesFailed,
          item
        }
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
      }
    } catch (metaError) {
      console.error('❌ Metadata restore error:', metaError);
      return { 
        success: false, 
        error: metaError.message, 
        message: '❌ Failed to restore metadata: ' + metaError.message 
      };
    }

    // STEP 5: Mark as restored in database
    console.log('Step 5: Marking as restored in database...');
    await env.DB.prepare(
      `UPDATE trash_items SET restored_at = CURRENT_TIMESTAMP, restored_by = ? WHERE id = ?`
    ).bind(adminId, trashId).run();

    console.log('✅ Restore complete! Restored files:', restoredFiles);
    
    return { 
      success: true, 
      item, 
      message: `✅ Successfully restored ${item.item_name} from R2 (${filesRestored} files restored)`,
      restoredFiles
    };

  } catch (error) {
    console.error('❌ Restore error:', error);
    return {
      success: false,
      error: error.message,
      message: `❌ Error: ${error.message}`
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

// ===== HELPER FUNCTIONS =====

// FIXED: Move song to trash with proper arrayBuffer handling
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
        
        // FIX 1: Convert stream to arrayBuffer BEFORE using it
        console.log(`📥 Reading file data as arrayBuffer...`);
        const fileData = await file.arrayBuffer();
        console.log(`✅ Read ${fileData.byteLength} bytes`);
        
        // FIX 2: Store original path in metadata for later restoration
        const metadata = {
          ...file.customMetadata,
          originalPath: originalPath,  // Save this!
          originalSize: file.size,
          movedToTrash: new Date().toISOString(),
          songId: songId
        };
        
        // FIX 3: Copy to trash using arrayBuffer, not stream
        console.log(`📤 Copying to trash: ${trashPath}`);
        await env.media.put(trashPath, fileData, {
          httpMetadata: file.httpMetadata,
          customMetadata: metadata
        }); 
        
        // FIX 4: Only delete original AFTER confirming trash copy succeeded
        console.log(`🗑️ Deleting original: ${originalPath}`);
        await env.media.delete(originalPath); 
        
        paths.push(trashPath); 
        totalSize += file.size || 0; 
        console.log(`✅ Moved in R2: ${originalPath} -> ${trashPath}`); 
      } else {
        console.log(`📭 File not found in R2: ${originalPath}`);
      }
    } catch (e) { 
      console.error(`❌ Error moving file ${originalPath}:`, e.message);
      // DON'T delete original if copy failed!
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

// ===== REPAIR FUNCTION =====
// Run this once to fix incorrect trash paths in database
export async function repairTrashPaths(env) {
  console.log('🔧 Repairing incorrect trash paths...');
  
  try {
    // Get all items with incorrect paths (missing 'trash/' prefix)
    const items = await env.DB.prepare(
      `SELECT id, item_type, trash_path FROM trash_items 
       WHERE restored_at IS NULL 
       AND trash_path NOT LIKE '%trash/%'`
    ).all();
    
    console.log(`Found ${items.results.length} items with incorrect paths`);
    
    const fixed = [];
    
    for (const item of items.results) {
      try {
        const oldPaths = JSON.parse(item.trash_path || '[]');
        const newPaths = oldPaths.map(path => {
          // Add trash/ prefix if missing
          if (!path.startsWith('trash/')) {
            return `trash/${path}`;
          }
          return path;
        });
        
        // Update database with corrected paths
        await env.DB.prepare(
          `UPDATE trash_items SET trash_path = ? WHERE id = ?`
        ).bind(JSON.stringify(newPaths), item.id).run();
        
        fixed.push({
          id: item.id,
          type: item.item_type,
          old: oldPaths,
          new: newPaths
        });
        
        console.log(`✅ Fixed: ${item.id}`, { old: oldPaths, new: newPaths });
        
      } catch (e) {
        console.error(`❌ Failed to fix ${item.id}:`, e);
      }
    }
    
    return {
      success: true,
      fixed: fixed.length,
      items: fixed
    };
    
  } catch (error) {
    console.error('Repair error:', error);
    return { success: false, error: error.message };
  }
}