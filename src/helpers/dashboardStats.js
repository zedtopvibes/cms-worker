// ==================== DASHBOARD STATS HELPER ====================
// Handles all dashboard statistics aggregation

import { getAlbums, getArtists, getPlaylists, getMetadata } from './storage.js';

/**
 * Log admin activity to database
 * @param {Object} env - Environment object with DB binding
 * @param {string} adminId - Admin user ID
 * @param {string} action - Action performed
 * @param {string} itemType - Type of item
 * @param {string} itemId - Item identifier
 * @param {string} itemName - Display name of item
 */
export async function logAdminActivity(env, adminId, action, itemType, itemId, itemName) {
  try {
    await env.DB.prepare(
      `INSERT INTO admin_activity (admin_id, action, item_type, item_id, item_name)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(adminId, action, itemType, itemId, itemName).run();
    
    console.log(`✅ Admin activity logged: ${action} ${itemType}`);
  } catch (error) {
    console.error('❌ Error logging activity:', error);
  }
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} - Today's date
 */
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get date string for X days ago
 * @param {number} daysAgo - Number of days ago
 * @returns {string} - Date in YYYY-MM-DD format
 */
function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Update daily stats in the database (runs at midnight)
 * @param {Object} env - Environment object with DB binding
 */
export async function updateDailyStats(env) {
  const today = getTodayString();
  
  try {
    console.log(`🔄 Updating daily stats for ${today}...`);
    
    // Get TODAY'S views
    const { results: viewsToday } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM page_views 
       WHERE date(last_viewed_date) = date(?)`
    ).bind(today).all();
    
    // Get TODAY'S plays
    const { results: playsToday } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM song_stats 
       WHERE date(last_played_date) = date(?)`
    ).bind(today).all();
    
    // Get TODAY'S downloads
    const { results: downloadsToday } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM song_stats 
       WHERE date(last_downloaded_date) = date(?)`
    ).bind(today).all();
    
    const todayViews = viewsToday?.[0]?.total || 0;
    const todayPlays = playsToday?.[0]?.total || 0;
    const todayDownloads = downloadsToday?.[0]?.total || 0;
    
    // Insert or update daily stats
    await env.DB.prepare(
      `INSERT INTO daily_stats (date, total_views, total_plays, total_downloads, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(date) DO UPDATE SET
         total_views = excluded.total_views,
         total_plays = excluded.total_plays,
         total_downloads = excluded.total_downloads,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(today, todayViews, todayPlays, todayDownloads).run();
    
    console.log(`✅ Daily stats updated: ${todayViews} views, ${todayPlays} plays, ${todayDownloads} downloads`);
    
    return {
      date: today,
      views: todayViews,
      plays: todayPlays,
      downloads: todayDownloads
    };
  } catch (error) {
    console.error('❌ Error updating daily stats:', error);
    return null;
  }
}

/**
 * Helper to get artist name
 * @param {Object} env - Environment object
 * @param {string} artistId - Artist identifier
 * @returns {Promise<string>} - Artist name
 */
async function getArtistName(env, artistId) {
  try {
    const artists = await getArtists(env);
    return artists[artistId]?.name || artistId;
  } catch (error) {
    console.error('Error getting artist name:', error);
    return artistId;
  }
}

/**
 * Format top content results for display
 * @param {Object} env - Environment object
 * @param {Array} results - Database results
 * @returns {Promise<Array>} - Formatted content
 */
async function formatTopContent(env, results) {
  const topContent = [];
  
  for (const item of results) {
    try {
      let title = item.page_id;
      let artist = '';
      let displayViews = item.views;
      
      // Get proper names based on type
      if (item.page_type === 'song') {
        const meta = await getMetadata(env, item.page_id);
        title = meta?.title || item.page_id.split('_').slice(1).join(' ') || item.page_id;
        const artistId = meta?.primaryArtist || item.page_id.split('_')[0];
        artist = await getArtistName(env, artistId);
      } 
      else if (item.page_type === 'album') {
        const albums = await getAlbums(env);
        const album = albums[item.page_id];
        title = album?.title || item.page_id;
        if (album?.artists?.[0]) {
          artist = await getArtistName(env, album.artists[0]);
        } else {
          artist = 'Various Artists';
        }
      } 
      else if (item.page_type === 'artist') {
        const artists = await getArtists(env);
        const artistObj = artists[item.page_id];
        title = artistObj?.name || item.page_id;
        artist = 'Artist Page';
      } 
      else if (item.page_type === 'playlist') {
        const playlists = await getPlaylists(env);
        const playlist = playlists[item.page_id];
        title = playlist?.title || item.page_id;
        artist = `by ${playlist?.curator || 'ZEDALBUMS'}`;
      } 
      else if (item.page_type === 'page') {
        title = item.page_id === 'homepage' ? 'Homepage' : item.page_id;
        artist = 'Page';
      } 
      else if (item.page_type === 'chart') {
        title = item.page_id.replace('charts-', 'Charts: ').replace(/-/g, ' ');
        artist = 'Charts';
      }
      else {
        title = item.page_id;
        artist = item.page_type;
      }
      
      topContent.push({
        title: title.charAt(0).toUpperCase() + title.slice(1),
        artist,
        type: item.page_type,
        views: displayViews,
        id: item.page_id
      });
    } catch (error) {
      console.error('Error formatting content item:', error);
    }
  }
  
  return topContent;
}

/**
 * Get top content from the last 7 days
 * @param {Object} env - Environment object
 * @returns {Promise<Array>} - Top content array
 */
async function getTopContent(env) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateStr = sevenDaysAgo.toISOString();
  
  try {
    // Try to get recent data first
    const { results } = await env.DB.prepare(
      `SELECT page_type, page_id, SUM(views) as views 
       FROM page_views 
       WHERE last_viewed > ? 
       GROUP BY page_type, page_id 
       ORDER BY views DESC 
       LIMIT 5`
    ).bind(dateStr).all();
    
    // If no recent data, get all-time data
    if (!results || results.length === 0) {
      const { results: allTimeResults } = await env.DB.prepare(
        `SELECT page_type, page_id, SUM(views) as views 
         FROM page_views 
         GROUP BY page_type, page_id 
         ORDER BY views DESC 
         LIMIT 5`
      ).all();
      
      if (allTimeResults && allTimeResults.length > 0) {
        return await formatTopContent(env, allTimeResults);
      }
      return [];
    }
    
    return await formatTopContent(env, results);
  } catch (error) {
    console.error('❌ Error getting top content:', error);
    return [];
  }
}

/**
 * Get recent admin activity
 * @param {Object} env - Environment object
 * @returns {Promise<Array>} - Recent activity array
 */
async function getRecentAdminActivity(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM admin_activity 
       ORDER BY timestamp DESC 
       LIMIT 10`
    ).all();
    
    if (!results || results.length === 0) {
      return [
        { 
          icon: 'fa-info-circle', 
          iconBg: '#4a90e2', 
          text: 'Welcome to your admin dashboard!', 
          time: 'just now', 
          link: '/admin/upload' 
        }
      ];
    }
    
    return results.map(log => {
      const timeAgo = getTimeAgo(new Date(log.timestamp));
      const icons = {
        'upload': { icon: 'fa-cloud-upload-alt', bg: '#ff5500' },
        'edit': { icon: 'fa-edit', bg: '#4a90e2' },
        'delete': { icon: 'fa-trash', bg: '#dc3545' },
        'create': { icon: 'fa-plus-circle', bg: '#28a745' },
        'merge': { icon: 'fa-compress', bg: '#9b59b6' },
        'update': { icon: 'fa-sync', bg: '#00b894' }
      };
      const iconInfo = icons[log.action] || { icon: 'fa-circle', bg: '#666' };
      
      // Format the action text
      let actionText = log.action;
      if (log.action === 'upload') actionText = 'uploaded';
      else if (log.action === 'edit') actionText = 'edited';
      else if (log.action === 'delete') actionText = 'deleted';
      else if (log.action === 'create') actionText = 'created';
      else if (log.action === 'merge') actionText = 'merged';
      else if (log.action === 'update') actionText = 'updated';
      
      // Format item type
      let itemType = log.item_type;
      if (itemType === 'album-songs') itemType = 'album songs';
      else if (itemType === 'playlist-songs') itemType = 'playlist songs';
      
      const displayName = log.item_name || log.item_id;
      
      return {
        icon: iconInfo.icon,
        iconBg: iconInfo.bg,
        text: `${actionText} ${itemType} "${displayName}"`,
        time: timeAgo,
        link: log.item_type ? `/admin/${log.item_type.split('-')[0]}s` : null
      };
    });
  } catch (error) {
    console.error('❌ Error getting recent activity:', error);
    return [];
  }
}

/**
 * Helper to format time ago
 * @param {Date} date - Date to format
 * @returns {string} - Formatted time string
 */
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return `${Math.floor(seconds / 604800)} weeks ago`;
}

/**
 * Get all dashboard statistics
 * @param {Object} env - Environment object
 * @returns {Promise<Object>} - Dashboard stats object
 */
export async function getDashboardStats(env) {
  const today = getTodayString();
  const yesterday = getDateString(1);
  
  console.log(`🔍 Fetching dashboard stats for date: ${today}`);
  
  try {
    // ===== LIVE DATA FOR TODAY (real-time) =====
    const { results: liveViews } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM page_views 
       WHERE date(last_viewed_date) = date(?)`
    ).bind(today).all();
    
    const { results: livePlays } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM song_stats 
       WHERE date(last_played_date) = date(?)`
    ).bind(today).all();
    
    const { results: liveDownloads } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM song_stats 
       WHERE date(last_downloaded_date) = date(?)`
    ).bind(today).all();
    
    const viewsToday = liveViews?.[0]?.total || 0;
    const playsToday = livePlays?.[0]?.total || 0;
    const downloadsToday = liveDownloads?.[0]?.total || 0;
    
    console.log(`📊 Live counts - Views: ${viewsToday}, Plays: ${playsToday}, Downloads: ${downloadsToday}`);
    
    // ===== HISTORICAL DATA FOR COMPARISON =====
    const yesterdayStats = await env.DB.prepare(
      `SELECT * FROM daily_stats WHERE date = ?`
    ).bind(yesterday).first();
    
    const viewsYesterday = yesterdayStats?.total_views || 0;
    const playsYesterday = yesterdayStats?.total_plays || 0;
    const downloadsYesterday = yesterdayStats?.total_downloads || 0;
    
    // Calculate trends
    const viewsTrend = viewsToday > viewsYesterday ? '↑' : viewsToday < viewsYesterday ? '↓' : '→';
    const playsTrend = playsToday > playsYesterday ? '↑' : playsToday < playsYesterday ? '↓' : '→';
    const downloadsTrend = downloadsToday > downloadsYesterday ? '↑' : downloadsToday < downloadsYesterday ? '↓' : '→';
    
    const viewsTrendValue = viewsYesterday > 0 
      ? `${viewsToday > viewsYesterday ? '+' : ''}${Math.round((viewsToday - viewsYesterday) / viewsYesterday * 100)}%`
      : viewsToday > 0 ? 'new' : '0';
    
    const playsTrendValue = playsYesterday > 0
      ? `${playsToday > playsYesterday ? '+' : ''}${Math.round((playsToday - playsYesterday) / playsYesterday * 100)}%`
      : playsToday > 0 ? 'new' : '0';
    
    const downloadsTrendValue = downloadsYesterday > 0
      ? `${downloadsToday > downloadsYesterday ? '+' : ''}${Math.round((downloadsToday - downloadsYesterday) / downloadsYesterday * 100)}%`
      : downloadsToday > 0 ? 'new' : '0';
    
    // Get weekly data for chart (last 7 days from daily_stats)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = getDateString(i);
      const stats = await env.DB.prepare(
        `SELECT * FROM daily_stats WHERE date = ?`
      ).bind(date).first();
      
      const dayDate = new Date(date);
      const dayName = dayDate.toLocaleDateString('en-GB', { weekday: 'short' });
      
      weeklyData.push({
        label: dayName,
        views: stats?.total_views || 0,
        plays: stats?.total_plays || 0,
        downloads: stats?.total_downloads || 0
      });
    }
    
    // Get counts from storage
    const albums = await getAlbums(env);
    const artists = await getArtists(env);
    const playlists = await getPlaylists(env);
    
    // Get songs from media storage
    let songs = [];
    try {
      const songList = await env.media.list({ prefix: "songs/" });
      songs = songList.objects || [];
    } catch (error) {
      console.error('Error getting songs:', error);
    }
    
    const totalSongs = songs.length;
    
    // Get new items this week
    const weekAgoTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const newSongs = songs.filter(s => new Date(s.uploaded).getTime() > weekAgoTime).length;
    const newAlbums = Object.values(albums).filter(a => a.created > weekAgoTime).length;
    const newArtists = Object.values(artists).filter(a => a.created > weekAgoTime).length;
    
    // Get REAL top content
    let topContent = await getTopContent(env);
    
    // If no data yet, show placeholder
    if (topContent.length === 0) {
      const { results } = await env.DB.prepare(
        `SELECT page_type, page_id, SUM(views) as views 
         FROM page_views 
         GROUP BY page_type, page_id 
         ORDER BY views DESC 
         LIMIT 5`
      ).all();
      
      if (results && results.length > 0) {
        topContent = await formatTopContent(env, results);
      } else {
        topContent = [
          { title: "No data yet", artist: "Visit some pages to generate views", type: "info", views: 0 }
        ];
      }
    }
    
    // Get REAL recent activity
    const recentActivity = await getRecentAdminActivity(env);
    
    return {
      viewsToday,
      playsToday,
      downloadsToday,
      viewsTrend,
      playsTrend,
      downloadsTrend,
      viewsTrendValue,
      playsTrendValue,
      downloadsTrendValue,
      newSongs,
      newAlbums,
      newArtists,
      weeklyData,
      topContent,
      recentActivity,
      totalSongs,
      totalAlbums: Object.keys(albums).length,
      totalArtists: Object.keys(artists).length,
      totalPlaylists: Object.keys(playlists).length
    };
  } catch (error) {
    console.error('❌ Error getting dashboard stats:', error);
    // Return default values on error
    return {
      viewsToday: 0,
      playsToday: 0,
      downloadsToday: 0,
      viewsTrend: '→',
      playsTrend: '→',
      downloadsTrend: '→',
      viewsTrendValue: '0',
      playsTrendValue: '0',
      downloadsTrendValue: '0',
      newSongs: 0,
      newAlbums: 0,
      newArtists: 0,
      weeklyData: [],
      topContent: [{ title: "Error loading data", artist: "Please try again", type: "error", views: 0 }],
      recentActivity: [],
      totalSongs: 0,
      totalAlbums: 0,
      totalArtists: 0,
      totalPlaylists: 0
    };
  }
}

export default {
  logAdminActivity,
  updateDailyStats,
  getDashboardStats
};