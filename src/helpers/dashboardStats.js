// ==================== DASHBOARD STATS HELPER ====================
import { getAlbums, getArtists, getPlaylists, getMetadata } from './storage.js';
import { getAggregatedStats } from './db.js';
import { 
  getTodayViews,
  getViewsChartData,
  getViewTrends
} from './pageViewsEnhanced.js';
import {
  getPlaysForPeriod,
  getDownloadsForPeriod,
  getPlaysChartData,
  getDownloadsChartData,
  getPlaysDownloadsSummary
} from './playsDownloadsEnhanced.js';
import { formatNumber } from './formatting.js';

// ===== LOG ADMIN ACTIVITY (KEPT FOR OTHER FILES) =====
export async function logAdminActivity(env, adminId, action, itemType, itemId, details) {
  try {
    await env.DB.prepare(
      `INSERT INTO admin_activity (admin, action, item_type, item_id, details, ip)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      adminId,
      action,
      itemType,
      itemId,
      typeof details === 'string' ? details : JSON.stringify(details),
      'internal'
    ).run();
    return true;
  } catch (error) {
    console.error('Error logging admin activity:', error);
    return false;
  }
}

// ===== UPDATE DAILY STATS (KEPT FOR CRON) =====
export async function updateDailyStats(env) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's stats from various tables
    const [viewsResult, playsResult, downloadsResult] = await Promise.all([
      env.DB.prepare(
        `SELECT SUM(views) as total FROM daily_page_views WHERE view_date = ?`
      ).bind(today).first(),
      
      env.DB.prepare(
        `SELECT SUM(plays) as total FROM daily_plays WHERE play_date = ?`
      ).bind(today).first(),
      
      env.DB.prepare(
        `SELECT SUM(downloads) as total FROM daily_downloads WHERE download_date = ?`
      ).bind(today).first()
    ]);
    
    // Create daily_stats table if it doesn't exist
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS daily_stats (
        stat_date TEXT PRIMARY KEY,
        views INTEGER DEFAULT 0,
        plays INTEGER DEFAULT 0,
        downloads INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();
    
    // Insert or update daily_stats table
    await env.DB.prepare(
      `INSERT INTO daily_stats (stat_date, views, plays, downloads)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(stat_date) DO UPDATE SET
         views = excluded.views,
         plays = excluded.plays,
         downloads = excluded.downloads,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      today,
      viewsResult?.total || 0,
      playsResult?.total || 0,
      downloadsResult?.total || 0
    ).run();
    
    console.log(`✅ Daily stats updated for ${today}`);
    return true;
  } catch (error) {
    console.error('Error updating daily stats:', error);
    return false;
  }
}

export async function getDashboardStats(env) {
  try {
    // Get counts
    const albums = await getAlbums(env);
    const artists = await getArtists(env);
    const playlists = await getPlaylists(env);
    
    // Get songs list
    const songList = await env.media.list({ prefix: "songs/" });
    const songs = songList.objects || [];
    const totalSongs = songs.length;
    
    // Calculate new items this week
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const newSongs = songs.filter(s => s.uploaded > oneWeekAgo).length;
    const newAlbums = Object.values(albums).filter(a => a.created > oneWeekAgo).length;
    const newArtists = Object.values(artists).filter(a => a.created > oneWeekAgo).length;
    
    // ===== REAL DATA FROM NEW TABLES =====
    // Get today's stats
    const summary = await getPlaysDownloadsSummary(env);
    const todayViews = await getTodayViews(env);
    
    // Get trends
    const viewsTrends = await getViewTrends(env, null, null);
    
    // Get chart data for 7-day activity
    const viewsChart = await getViewsChartData(env, 'week');
    const playsChart = await getPlaysChartData(env, 'week');
    const downloadsChart = await getDownloadsChartData(env, 'week');
    
    // Combine chart data for the 7-day display
    const weeklyData = [];
    const labels = viewsChart.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    // Calculate max value for scaling
    const maxValue = Math.max(
      ...(viewsChart.data || [0]),
      ...(playsChart.data || [0]),
      ...(downloadsChart.data || [0]),
      1
    );
    
    for (let i = 0; i < labels.length; i++) {
      weeklyData.push({
        label: formatChartLabel(labels[i]),
        views: Math.round(((viewsChart.data[i] || 0) / maxValue) * 100) || 1,
        plays: Math.round(((playsChart.data[i] || 0) / maxValue) * 100) || 1,
        downloads: Math.round(((downloadsChart.data[i] || 0) / maxValue) * 100) || 1,
        viewsRaw: viewsChart.data[i] || 0,
        playsRaw: playsChart.data[i] || 0,
        downloadsRaw: downloadsChart.data[i] || 0
      });
    }
    
    // Get top content this week (REAL DATA)
    const topContent = await getTopContent(env);
    
    // Get recent activity (REAL DATA from admin_activity table)
    const recentActivity = await getRecentActivity(env);
    
    return {
      // Today's stats
      viewsToday: todayViews,
      playsToday: summary.today.plays,
      downloadsToday: summary.today.downloads,
      
      // Trends with actual values
      viewsTrend: getTrendEmoji(viewsTrends?.dailyChange || 0),
      playsTrend: getTrendEmoji(summary.today.plays - (await getYesterdayPlays(env))),
      downloadsTrend: getTrendEmoji(summary.today.downloads - (await getYesterdayDownloads(env))),
      
      viewsTrendValue: getTrendValue(viewsTrends?.dailyChange || 0),
      playsTrendValue: getTrendValue(summary.today.plays - (await getYesterdayPlays(env))),
      downloadsTrendValue: getTrendValue(summary.today.downloads - (await getYesterdayDownloads(env))),
      
      // New items this week
      newSongs,
      newAlbums,
      newArtists,
      
      // Chart data
      weeklyData,
      
      // Top content
      topContent,
      
      // Recent activity
      recentActivity
    };
    
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    
    // Return fallback data with zeros
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
      weeklyData: generateFallbackWeeklyData(),
      topContent: [],
      recentActivity: []
    };
  }
}

// ===== HELPER FUNCTIONS =====

// Get yesterday's plays
async function getYesterdayPlays(env) {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${year}-${month}-${day}`;
    
    const result = await env.DB.prepare(
      `SELECT SUM(plays) as total FROM daily_plays WHERE play_date = ?`
    ).bind(yesterdayStr).first();
    
    return result?.total || 0;
  } catch (error) {
    return 0;
  }
}

// Get yesterday's downloads
async function getYesterdayDownloads(env) {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${year}-${month}-${day}`;
    
    const result = await env.DB.prepare(
      `SELECT SUM(downloads) as total FROM daily_downloads WHERE download_date = ?`
    ).bind(yesterdayStr).first();
    
    return result?.total || 0;
  } catch (error) {
    return 0;
  }
}

// Format chart label
function formatChartLabel(label) {
  if (!label) return '';
  // Convert YYYY-MM-DD to DD/MM
  const parts = label.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return label;
}

// Get trend emoji
function getTrendEmoji(change) {
  if (change > 0) return '↑';
  if (change < 0) return '↓';
  return '→';
}

// Get trend value with sign
function getTrendValue(change) {
  if (change > 0) return `+${change}`;
  if (change < 0) return `${change}`;
  return '0';
}

// Get top content this week (REAL DATA)
async function getTopContent(env) {
  try {
    const topContent = [];
    const artists = await getArtists(env);
    
    // Get top songs by plays this week
    const { getPopularByPlays } = await import('./playsDownloadsEnhanced.js');
    const topSongs = await getPopularByPlays(env, 'week', 3, 'song');
    
    for (const song of topSongs) {
      const metadata = await getMetadata(env, song.item_id);
      let artistName = 'Unknown';
      
      if (metadata?.primaryArtist) {
        const artist = artists[metadata.primaryArtist];
        artistName = artist?.name || metadata.primaryArtist;
      }
      
      topContent.push({
        title: metadata?.title || song.item_id,
        artist: artistName,
        type: 'song',
        views: song.plays
      });
    }
    
    // Get top albums by plays this week
    const topAlbums = await getPopularByPlays(env, 'week', 2, 'album');
    for (const album of topAlbums) {
      topContent.push({
        title: album.item_id,
        artist: 'Various',
        type: 'album',
        views: album.plays
      });
    }
    
    // Get top artists by plays this week
    const topArtists = await getPopularByPlays(env, 'week', 2, 'artist');
    for (const artist of topArtists) {
      const artistData = artists[artist.item_id];
      topContent.push({
        title: artistData?.name || artist.item_id,
        artist: 'Artist',
        type: 'artist',
        views: artist.plays
      });
    }
    
    // Sort by views and take top 5
    return topContent
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
      
  } catch (error) {
    console.error('Error getting top content:', error);
    return [];
  }
}

// Get recent activity (REAL DATA from admin_activity)
async function getRecentActivity(env) {
  try {
    const activity = [];
    
    // Get recent admin activity from database
    const adminActivity = await env.DB.prepare(
      `SELECT * FROM admin_activity ORDER BY timestamp DESC LIMIT 5`
    ).all();
    
    for (const log of adminActivity.results || []) {
      activity.push({
        icon: getActivityIcon(log.action),
        iconBg: getActivityColor(log.action),
        text: `${log.admin} ${log.action}d ${log.details || 'an item'}`,
        time: formatTimeAgo(new Date(log.timestamp)),
        link: log.link || null
      });
    }
    
    // If no admin activity, show recent uploads
    if (activity.length === 0) {
      const songList = await env.media.list({ prefix: "songs/", limit: 5 });
      const songs = songList.objects || [];
      
      for (const song of songs) {
        const fileName = song.key.split('/')[1];
        activity.push({
          icon: 'fa-cloud-upload-alt',
          iconBg: '#ff5500',
          text: `New song uploaded: ${fileName}`,
          time: formatTimeAgo(new Date(song.uploaded)),
          link: `/song/${encodeURIComponent(fileName)}`
        });
      }
    }
    
    return activity;
    
  } catch (error) {
    console.error('Error getting recent activity:', error);
    return [];
  }
}

// Helper to get activity icon
function getActivityIcon(action) {
  const icons = {
    'create': 'fa-plus-circle',
    'edit': 'fa-edit',
    'delete': 'fa-trash',
    'upload': 'fa-cloud-upload-alt',
    'merge': 'fa-compress'
  };
  return icons[action] || 'fa-circle';
}

// Helper to get activity color
function getActivityColor(action) {
  const colors = {
    'create': '#28a745',
    'edit': '#ffc107',
    'delete': '#dc3545',
    'upload': '#ff5500',
    'merge': '#9b59b6'
  };
  return colors[action] || '#6c757d';
}

// Format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

// Generate fallback weekly data
function generateFallbackWeeklyData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({
    label: day,
    views: 10,
    plays: 8,
    downloads: 5,
    viewsRaw: 0,
    playsRaw: 0,
    downloadsRaw: 0
  }));
}