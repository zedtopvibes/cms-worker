// ==================== PURE R2 TRASH HELPER (FULL FIXED CODE) ====================
import { getAlbums, saveAlbums, getArtists, saveArtists, getPlaylists, savePlaylists, getMetadata, saveMetadata } from './storage.js';

// Move item to trash - pure R2
export async function moveToTrash(env, adminId, itemType, itemId, itemName, metadata = {}, sizeBytes = 0) {
  console.log('🗑️ Moving to trash (R2 only):', { itemType, itemId, itemName });

  try {
    const timestamp = Date.now();
    const trashPrefix = `trash/${timestamp}_${itemType}_${itemId}`;
    const movedFiles = [];
    let totalSize = 0;

    // Handle different item types
    switch (itemType) {
      case 'song':
        const songResult = await moveSongToTrash(env, itemId, trashPrefix);
        movedFiles.push(...songResult.files);
        totalSize = songResult.totalSize;
        break;
        
      case 'album':
        const albumThumb = await moveFileToTrash(env, `albums/thumbnails/${itemId}.jpg`, trashPrefix);
        if (albumThumb) {
          movedFiles.push(albumThumb);
          totalSize += albumThumb.size || 0;
        }
        break;
        
      case 'artist':
        const artistImg = await moveFileToTrash(env, `artists/thumbnails/${itemId}.jpg`, trashPrefix);
        if (artistImg) {
          movedFiles.push(artistImg);
          totalSize += artistImg.size || 0;
        }
        break;
        
      case 'playlist':
        const playlistCover = await moveFileToTrash(env, `playlists/thumbnails/${itemId}.jpg`, trashPrefix);
        if (playlistCover) {
          movedFiles.push(playlistCover);
          totalSize += playlistCover.size || 0;
        }
        break;
    }

    // Store metadata as JSON file in trash
    const metadataKey = `${trashPrefix}/_metadata.json`;
    const trashMetadata = {
      id: `${timestamp}_${itemType}_${itemId}`,
      itemType,
      itemId,
      itemName,
      deletedBy: adminId,
      deletedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      originalMetadata: metadata,
      files: movedFiles,
      totalSize
    };

    await env.media.put(metadataKey, JSON.stringify(trashMetadata, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    });

    return { 
      success: true, 
      trashId: metadataKey,
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

// Move single file using streams
async function moveFileToTrash(env, originalPath, trashPrefix) {
  try {
    const file = await env.media.get(originalPath);
    if (!file) return null;

    const fileName = originalPath.split('/').pop();
    const trashPath = `${trashPrefix}/${fileName}`;

    // Use stream directly - no arrayBuffer!
    await env.media.put(trashPath, file.body, {
      httpMetadata: file.httpMetadata,
      customMetadata: {
        ...file.customMetadata,
        originalPath,
        movedToTrash: new Date().toISOString()
      }
    });

    // Delete original after successful copy
    await env.media.delete(originalPath);

    return {
      originalPath,
      trashPath,
      size: file.size,
      fileName
    };

  } catch (error) {
    console.error(`❌ Error moving file ${originalPath}:`, error);
    return null;
  }
}

// Move song files
async function moveSongToTrash(env, songId, trashPrefix) {
  const files = [];
  let totalSize = 0;

  // Move MP3
  const mp3File = await moveFileToTrash(env, `songs/${songId}.mp3`, trashPrefix);
  if (mp3File) {
    files.push(mp3File);
    totalSize += mp3File.size || 0;
  }

  // Move cover images
  const jpgFile = await moveFileToTrash(env, `images/${songId}.jpg`, trashPrefix);
  if (jpgFile) {
    files.push(jpgFile);
    totalSize += jpgFile.size || 0;
  } else {
    const pngFile = await moveFileToTrash(env, `images/${songId}.png`, trashPrefix);
    if (pngFile) {
      files.push(pngFile);
      totalSize += pngFile.size || 0;
    }
  }

  // Move description
  const descFile = await moveFileToTrash(env, `descriptions/${songId}.txt`, trashPrefix);
  if (descFile) {
    files.push(descFile);
    totalSize += descFile.size || 0;
  }

  return { files, totalSize };
}

// Restore from trash
export async function restoreFromTrash(env, adminId, trashKey) {
  console.log('🔄 Restoring from trash:', trashKey);

  try {
    // Get metadata file
    const metadataFile = await env.media.get(trashKey);
    if (!metadataFile) {
      return { success: false, message: '❌ Trash item not found' };
    }

    const metadata = JSON.parse(await metadataFile.text());
    const restoredFiles = [];

    // Restore each file
    for (const file of metadata.files) {
      try {
        const trashFile = await env.media.get(file.trashPath);
        if (trashFile) {
          // Restore to original location using stream
          await env.media.put(file.originalPath, trashFile.body, {
            httpMetadata: trashFile.httpMetadata,
            customMetadata: {
              ...trashFile.customMetadata,
              restoredAt: new Date().toISOString(),
              restoredBy: adminId
            }
          });

          // Delete from trash
          await env.media.delete(file.trashPath);
          restoredFiles.push(file.originalPath);
        }
      } catch (e) {
        console.error(`❌ Error restoring ${file.trashPath}:`, e);
      }
    }

    // Delete metadata file
    await env.media.delete(trashKey);

    // Restore metadata in storage (for albums/artists/playlists)
    await restoreMetadataInStorage(env, metadata);

    return {
      success: true,
      message: `✅ Restored ${metadata.itemName} (${restoredFiles.length} files)`,
      restoredFiles
    };

  } catch (error) {
    console.error('❌ Restore error:', error);
    return {
      success: false,
      message: `❌ Error: ${error.message}`
    };
  }
}

// Restore metadata in storage indexes
async function restoreMetadataInStorage(env, metadata) {
  const { itemType, itemId, originalMetadata } = metadata;

  switch (itemType) {
    case 'album':
      const albums = await getAlbums(env);
      albums[itemId] = { ...originalMetadata, id: itemId };
      await saveAlbums(env, albums);
      break;
      
    case 'artist':
      const artists = await getArtists(env);
      artists[itemId] = { ...originalMetadata, id: itemId };
      await saveArtists(env, artists);
      break;
      
    case 'playlist':
      const playlists = await getPlaylists(env);
      playlists[itemId] = { ...originalMetadata, id: itemId };
      await savePlaylists(env, playlists);
      break;
      
    case 'song':
      if (Object.keys(originalMetadata).length > 0) {
        await saveMetadata(env, itemId, originalMetadata);
      }
      break;
  }
}

// Permanently delete from trash
export async function deletePermanently(env, trashKey) {
  console.log('🗑️ Permanently deleting from trash:', trashKey);

  try {
    // Get metadata to find all files
    const metadataFile = await env.media.get(trashKey);
    if (!metadataFile) {
      return { success: false, message: '❌ Trash item not found' };
    }

    const metadata = JSON.parse(await metadataFile.text());

    // Delete all files
    for (const file of metadata.files) {
      try {
        await env.media.delete(file.trashPath);
        console.log('✅ Deleted:', file.trashPath);
      } catch (e) {
        console.error(`❌ Error deleting ${file.trashPath}:`, e);
      }
    }

    // Delete metadata file
    await env.media.delete(trashKey);

    return {
      success: true,
      message: `✅ Permanently deleted ${metadata.itemName}`
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      success: false,
      message: `❌ Error: ${error.message}`
    };
  }
}

// Empty trash (all or by type)
export async function emptyTrash(env, itemType = 'all') {
  try {
    const trashList = await env.media.list({ prefix: 'trash/' });
    let deleted = 0;
    
    for (const obj of trashList.objects) {
      if (itemType === 'all') {
        // Delete everything in trash
        await env.media.delete(obj.key);
        deleted++;
      } else if (obj.key.endsWith('_metadata.json')) {
        // Check if this metadata file matches the type
        const file = await env.media.get(obj.key);
        const metadata = JSON.parse(await file.text());
        if (metadata.itemType === itemType) {
          // Delete all files for this item
          for (const file of metadata.files) {
            await env.media.delete(file.trashPath).catch(() => {});
          }
          await env.media.delete(obj.key);
          deleted++;
        }
      }
    }
    
    return {
      success: true,
      count: deleted,
      message: `✅ Emptied ${deleted} items from trash`
    };
    
  } catch (error) {
    console.error('Error emptying trash:', error);
    return {
      success: false,
      message: `❌ Error: ${error.message}`
    };
  }
}

// Get all trash items with pagination - FIXED for UI
export async function getTrashItems(env, type = 'all', page = 1, limit = 20, search = '') {
  try {
    // List all trash metadata files
    const trashList = await env.media.list({ prefix: 'trash/' });
    const metadataFiles = trashList.objects.filter(obj => obj.key.endsWith('_metadata.json'));
    
    const items = [];
    
    for (const obj of metadataFiles) {
      const file = await env.media.get(obj.key);
      const metadata = JSON.parse(await file.text());
      
      // Apply filters
      if (type !== 'all' && metadata.itemType !== type) continue;
      if (search && !metadata.itemName.toLowerCase().includes(search.toLowerCase())) continue;
      
      // Calculate days left
      const daysLeft = Math.ceil((new Date(metadata.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
      
      // Format thumbnail URL based on item type
      let thumbnail = null;
      if (metadata.originalMetadata?.thumbnail) {
        thumbnail = metadata.originalMetadata.thumbnail;
      } else {
        // Generate default thumbnail path
        switch (metadata.itemType) {
          case 'song':
            thumbnail = `/images/${metadata.itemId}.jpg`;
            break;
          case 'album':
            thumbnail = `/albums/thumbnails/${metadata.itemId}.jpg`;
            break;
          case 'artist':
            thumbnail = `/artists/thumbnails/${metadata.itemId}.jpg`;
            break;
          case 'playlist':
            thumbnail = `/playlists/thumbnails/${metadata.itemId}.jpg`;
            break;
        }
      }
      
      // Format the item to match what your UI expects
      items.push({
        id: obj.key,                    // This is what your UI uses for restore/delete
        item_type: metadata.itemType,    // Your UI expects this field name
        item_name: metadata.itemName,    // Your UI expects this field name
        item_id: metadata.itemId,
        deleted_by: metadata.deletedBy,
        deleted_at: metadata.deletedAt,
        deletedDate: new Date(metadata.deletedAt).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
        daysLeft: Math.max(0, daysLeft),
        formattedSize: formatBytes(metadata.totalSize || 0),
        size_bytes: metadata.totalSize,
        thumbnail: thumbnail,
        expires_at: metadata.expiresAt,
        metadata: metadata.originalMetadata,
        files: metadata.files
      });
    }
    
    // Sort by deleted date (newest first)
    items.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
    
    // Paginate
    const start = (page - 1) * limit;
    const paginatedItems = items.slice(start, start + limit);
    
    return {
      items: paginatedItems,
      total: items.length,
      page,
      totalPages: Math.ceil(items.length / limit)
    };
    
  } catch (error) {
    console.error('Error getting trash items:', error);
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }
}

// Get trash statistics - FIXED for UI
export async function getTrashStats(env) {
  try {
    const trashList = await env.media.list({ prefix: 'trash/' });
    const metadataFiles = trashList.objects.filter(obj => obj.key.endsWith('_metadata.json'));
    
    const stats = {
      songs: 0,
      albums: 0,
      artists: 0,
      playlists: 0,
      total: metadataFiles.length,
      totalSize: 0
    };
    
    for (const obj of metadataFiles) {
      const file = await env.media.get(obj.key);
      const metadata = JSON.parse(await file.text());
      
      // Count by type
      if (metadata.itemType === 'song') stats.songs++;
      else if (metadata.itemType === 'album') stats.albums++;
      else if (metadata.itemType === 'artist') stats.artists++;
      else if (metadata.itemType === 'playlist') stats.playlists++;
      
      stats.totalSize += metadata.totalSize || 0;
    }
    
    return {
      songs: stats.songs,
      albums: stats.albums,
      artists: stats.artists,
      playlists: stats.playlists,
      total: stats.total,
      totalSize: stats.totalSize,
      formattedSize: formatBytes(stats.totalSize),
      retentionDays: 30
    };
    
  } catch (error) {
    console.error('Error getting trash stats:', error);
    return {
      songs: 0, albums: 0, artists: 0, playlists: 0,
      total: 0, totalSize: 0, formattedSize: '0 B', retentionDays: 30
    };
  }
}

// Get trash settings (from R2)
export async function getTrashSettings(env) {
  try {
    const settingsFile = await env.media.get('_settings/trash.json');
    if (!settingsFile) {
      return {
        retention_days: 30,
        auto_cleanup: true,
        max_trash_size_mb: 1024,
        notify_before_delete: true
      };
    }
    return JSON.parse(await settingsFile.text());
  } catch (error) {
    console.error('Error getting trash settings:', error);
    return {
      retention_days: 30,
      auto_cleanup: true,
      max_trash_size_mb: 1024,
      notify_before_delete: true
    };
  }
}

// Update trash settings
export async function updateTrashSettings(env, adminId, settings) {
  try {
    const settingsKey = '_settings/trash.json';
    const existing = await getTrashSettings(env);
    
    const updated = {
      ...existing,
      ...settings,
      updatedBy: adminId,
      updatedAt: new Date().toISOString()
    };
    
    await env.media.put(settingsKey, JSON.stringify(updated, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    });
    
    return { success: true, message: '✅ Settings saved' };
  } catch (error) {
    console.error('Error updating trash settings:', error);
    return { success: false, message: `❌ Error: ${error.message}` };
  }
}

// Clean up expired trash items (call from cron)
export async function cleanupExpiredTrash(env) {
  try {
    const settings = await getTrashSettings(env);
    if (!settings.auto_cleanup) {
      return { success: true, message: 'Auto cleanup disabled' };
    }

    const trashList = await env.media.list({ prefix: 'trash/' });
    const metadataFiles = trashList.objects.filter(obj => obj.key.endsWith('_metadata.json'));
    let deleted = 0;
    
    const now = new Date();
    
    for (const obj of metadataFiles) {
      const file = await env.media.get(obj.key);
      const metadata = JSON.parse(await file.text());
      
      if (new Date(metadata.expiresAt) < now) {
        // Delete all files for this item
        for (const file of metadata.files) {
          await env.media.delete(file.trashPath).catch(() => {});
        }
        await env.media.delete(obj.key);
        deleted++;
      }
    }
    
    return {
      success: true,
      count: deleted,
      message: `✅ Cleaned up ${deleted} expired items`
    };
    
  } catch (error) {
    console.error('Error cleaning up trash:', error);
    return { success: false, message: `❌ Error: ${error.message}` };
  }
}

// Format bytes helper
function formatBytes(bytes) {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Debug function to check R2 paths
export async function debugR2Paths(env, itemId) {
  console.log('🔍 Debugging R2 paths for item ID:', itemId);
  
  const pathsToCheck = [
    `songs/${itemId}.mp3`,
    `images/${itemId}.jpg`,
    `images/${itemId}.png`,
    `descriptions/${itemId}.txt`,
    `albums/thumbnails/${itemId}.jpg`,
    `artists/thumbnails/${itemId}.jpg`,
    `playlists/thumbnails/${itemId}.jpg`
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
    } catch (e) {
      results[path] = { exists: false, error: e.message };
    }
  }
  
  return results;
}

// Repair function to fix metadata if needed
export async function repairTrashMetadata(env) {
  console.log('🔧 Repairing trash metadata...');
  
  try {
    const trashList = await env.media.list({ prefix: 'trash/' });
    const metadataFiles = trashList.objects.filter(obj => obj.key.endsWith('_metadata.json'));
    let fixed = 0;
    
    for (const obj of metadataFiles) {
      try {
        const file = await env.media.get(obj.key);
        const metadata = JSON.parse(await file.text());
        
        // Check if metadata has required fields
        if (!metadata.itemType || !metadata.itemName || !metadata.deletedBy) {
          console.log('⚠️ Fixing metadata for:', obj.key);
          
          // Extract info from path if needed
          const pathParts = obj.key.split('/');
          const fileName = pathParts[pathParts.length - 2]; // timestamp_itemType_itemId
          const [timestamp, itemType, itemId] = fileName.split('_');
          
          const fixedMetadata = {
            ...metadata,
            itemType: metadata.itemType || itemType,
            itemId: metadata.itemId || itemId,
            itemName: metadata.itemName || 'Unknown',
            deletedBy: metadata.deletedBy || 'system',
            deletedAt: metadata.deletedAt || new Date(parseInt(timestamp)).toISOString(),
            expiresAt: metadata.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          };
          
          await env.media.put(obj.key, JSON.stringify(fixedMetadata, null, 2), {
            httpMetadata: { contentType: 'application/json' }
          });
          fixed++;
        }
      } catch (e) {
        console.error('❌ Error repairing:', obj.key, e);
      }
    }
    
    return { success: true, fixed };
    
  } catch (error) {
    console.error('Repair error:', error);
    return { success: false, error: error.message };
  }
}