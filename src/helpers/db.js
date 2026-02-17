// ==================== D1 DATABASE FUNCTIONS ====================
// Handles all database operations for song stats

/**
 * Increment play count for a song
 * @param {string} songKey - Unique song identifier
 * @param {Object} env - Environment object with DB binding
 * @returns {Promise<boolean>} - Success status
 */
export async function incrementPlay(songKey, env) {
  try {
    if (!songKey || !env || !env.DB) {
      console.error('❌ Invalid parameters for incrementPlay');
      return false;
    }

    const result = await env.DB.prepare(
      `INSERT INTO song_stats (song_key, plays, downloads, last_played, last_played_date)
       VALUES (?, 1, 0, CURRENT_TIMESTAMP, date('now'))
       ON CONFLICT(song_key) DO UPDATE SET 
         plays = plays + 1,
         last_played = CURRENT_TIMESTAMP,
         last_played_date = date('now')`
    ).bind(songKey).run();
    
    console.log(`✅ Play recorded for song: ${songKey}`);
    return true;
  } catch (error) {
    console.error('❌ Error incrementing play:', error);
    console.error('   Song Key:', songKey);
    return false;
  }
}

/**
 * Increment download count for a song
 * @param {string} songKey - Unique song identifier
 * @param {Object} env - Environment object with DB binding
 * @returns {Promise<boolean>} - Success status
 */
export async function incrementDownload(songKey, env) {
  try {
    if (!songKey || !env || !env.DB) {
      console.error('❌ Invalid parameters for incrementDownload');
      return false;
    }

    const result = await env.DB.prepare(
      `INSERT INTO song_stats (song_key, plays, downloads, last_downloaded, last_downloaded_date)
       VALUES (?, 0, 1, CURRENT_TIMESTAMP, date('now'))
       ON CONFLICT(song_key) DO UPDATE SET 
         downloads = downloads + 1,
         last_downloaded = CURRENT_TIMESTAMP,
         last_downloaded_date = date('now')`
    ).bind(songKey).run();
    
    console.log(`✅ Download recorded for song: ${songKey}`);
    return true;
  } catch (error) {
    console.error('❌ Error incrementing download:', error);
    console.error('   Song Key:', songKey);
    return false;
  }
}

/**
 * Get stats for a specific song
 * @param {string} songKey - Unique song identifier
 * @param {Object} env - Environment object with DB binding
 * @returns {Promise<Object>} - Song stats object
 */
export async function getSongStats(songKey, env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT plays, downloads, last_played, last_downloaded 
       FROM song_stats WHERE song_key = ?`
    ).bind(songKey).all();
    
    return results[0] || { 
      plays: 0, 
      downloads: 0,
      last_played: null,
      last_downloaded: null
    };
  } catch (error) {
    console.error('❌ Error getting song stats:', error);
    return { plays: 0, downloads: 0 };
  }
}

/**
 * Get aggregated stats for multiple songs
 * @param {Array<string>} songKeys - Array of song identifiers
 * @param {Object} env - Environment object with DB binding
 * @returns {Promise<Object>} - Aggregated stats object
 */
export async function getAggregatedStats(songKeys, env) {
  try {
    if (!songKeys || songKeys.length === 0) {
      return { plays: 0, downloads: 0 };
    }
    
    const placeholders = songKeys.map(() => '?').join(',');
    const { results } = await env.DB.prepare(
      `SELECT SUM(plays) as total_plays, SUM(downloads) as total_downloads
       FROM song_stats
       WHERE song_key IN (${placeholders})`
    ).bind(...songKeys).all();
    
    return {
      plays: results[0]?.total_plays || 0,
      downloads: results[0]?.total_downloads || 0
    };
  } catch (error) {
    console.error('❌ Error getting aggregated stats:', error);
    return { plays: 0, downloads: 0 };
  }
}

/**
 * Get today's total plays
 * @param {Object} env - Environment object with DB binding
 * @returns {Promise<number>} - Today's play count
 */
export async function getTodayPlays(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM song_stats 
       WHERE date(last_played_date) = date('now')`
    ).all();
    
    return results[0]?.total || 0;
  } catch (error) {
    console.error('❌ Error getting today\'s plays:', error);
    return 0;
  }
}

/**
 * Get today's total downloads
 * @param {Object} env - Environment object with DB binding
 * @returns {Promise<number>} - Today's download count
 */
export async function getTodayDownloads(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM song_stats 
       WHERE date(last_downloaded_date) = date('now')`
    ).all();
    
    return results[0]?.total || 0;
  } catch (error) {
    console.error('❌ Error getting today\'s downloads:', error);
    return 0;
  }
}

/**
 * Get plays for a specific date
 * @param {Object} env - Environment object with DB binding
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<number>} - Play count for that date
 */
export async function getPlaysByDate(env, date) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM song_stats 
       WHERE date(last_played_date) = date(?)`
    ).bind(date).all();
    
    return results[0]?.total || 0;
  } catch (error) {
    console.error('❌ Error getting plays by date:', error);
    return 0;
  }
}

/**
 * Get downloads for a specific date
 * @param {Object} env - Environment object with DB binding
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<number>} - Download count for that date
 */
export async function getDownloadsByDate(env, date) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM song_stats 
       WHERE date(last_downloaded_date) = date(?)`
    ).bind(date).all();
    
    return results[0]?.total || 0;
  } catch (error) {
    console.error('❌ Error getting downloads by date:', error);
    return 0;
  }
}

/**
 * Get top played songs
 * @param {Object} env - Environment object with DB binding
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of top played songs
 */
export async function getTopPlayedSongs(env, limit = 10) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT song_key, plays, downloads, last_played
       FROM song_stats
       ORDER BY plays DESC
       LIMIT ?`
    ).bind(limit).all();
    
    return results || [];
  } catch (error) {
    console.error('❌ Error getting top played songs:', error);
    return [];
  }
}

/**
 * Get top downloaded songs
 * @param {Object} env - Environment object with DB binding
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of top downloaded songs
 */
export async function getTopDownloadedSongs(env, limit = 10) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT song_key, plays, downloads, last_downloaded
       FROM song_stats
       ORDER BY downloads DESC
       LIMIT ?`
    ).bind(limit).all();
    
    return results || [];
  } catch (error) {
    console.error('❌ Error getting top downloaded songs:', error);
    return [];
  }
}

/**
 * Get recent activity (plays and downloads)
 * @param {Object} env - Environment object with DB binding
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of recent activity
 */
export async function getRecentActivity(env, limit = 20) {
  try {
    // This is a complex query that combines plays and downloads
    const { results } = await env.DB.prepare(
      `SELECT 
         song_key,
         'play' as activity_type,
         last_played as activity_date
       FROM song_stats 
       WHERE last_played IS NOT NULL
       UNION ALL
       SELECT 
         song_key,
         'download' as activity_type,
         last_downloaded as activity_date
       FROM song_stats 
       WHERE last_downloaded IS NOT NULL
       ORDER BY activity_date DESC
       LIMIT ?`
    ).bind(limit).all();
    
    return results || [];
  } catch (error) {
    console.error('❌ Error getting recent activity:', error);
    return [];
  }
}

export default {
  incrementPlay,
  incrementDownload,
  getSongStats,
  getAggregatedStats,
  getTodayPlays,
  getTodayDownloads,
  getPlaysByDate,
  getDownloadsByDate,
  getTopPlayedSongs,
  getTopDownloadedSongs,
  getRecentActivity
};