// ==================== DASHBOARD STATS HELPER (WITH R2 LOGGING) ====================
import { getAlbums, getArtists, getPlaylists, getMetadata } from './storage.js';
import { getAggregatedStats } from './db.js';
import { 
  getTodayViews,
  getViewsChartData,
  getViewTrends,
  getPopularPagesForPeriod
} from './pageViewsEnhanced.js';
import {
  getPlaysForPeriod,
  getDownloadsForPeriod,
  getPlaysChartData,
  getDownloadsChartData,
  getPlaysDownloadsSummary
} from './playsDownloadsEnhanced.js';
import { formatNumber } from './formatting.js';
import { logActivity } from './activity.js';  // R2-based logging

// ===== LOG ADMIN ACTIVITY (NOW ONLY R2) =====
export async function logAdminActivity(env, adminId, action, itemType, itemId, itemName, details = {}) {
  try {
    // Log to R2 only
    await logActivity(env, action, itemName || itemId, adminId, {
      ...details,
      type: itemType,
      id: itemId
    }, 'internal');
    
    return true;
  } catch (error) {
    console.error('Error logging admin activity to R2:', error);
    return false;
  }
}

// ===== UPDATE DAILY STATS (KEPT FOR CRON - D1 STAYS FOR STATS) =====
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
    
    // Log this activity to R2 (optional)
    await logActivity(env, 'cron', 'daily_stats', 'system', {
      action: 'update_daily_stats',
      date: today
    }, 'system');
    
    console.log(`✅ Daily stats updated for ${today}`);
    return true;
  } catch (error) {
    console.error('Error updating daily stats:', error);
    return false;
  }
}

// ===== GET DASHBOARD STATS =====
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
    
    // ===== REAL DATA FROM D1 TABLES =====
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
    
    // Get top content this week by VIEWS
    const topContent = await getTopContentByViews(env);
    
    // Get recent activity (FROM R2 LOGS)
    const recentActivity = await getRecentActivityFromR2(env);
    
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
      
      // Top content by VIEWS
      topContent,
      
      // Recent activity (from R2)
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

// ===== GET RECENT ACTIVITY FROM R2 LOGS =====
async function getRecentActivityFromR2(env) {
  try {
    const activity = [];
    
    // Get logs from R2
    const logFile = await env.media.get('_logs/activity.json');
    let logs = [];
    
    if (logFile) {
      logs = JSON.parse(await logFile.text());
    }
    
    // Take first 5 most recent logs
    const recentLogs = logs.slice(0, 5);
    
    for (const log of recentLogs) {
      activity.push({
        icon: getActivityIcon(log.action),
        iconBg: getActivityColor(log.action),
        text: `${log.admin || 'System'} ${log.action} ${log.file || ''}`,
        time: formatTimeAgo(new Date(log.time)),
        link: log.details?.link || null
      });
    }
    
    return activity;
    
  } catch (error) {
    console.error('Error getting recent activity from R2:', error);
    return [];
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

// Get top content this week by VIEWS
async function getTopContentByViews(env) {
  try {
    const topContent = [];
    const artists = await getArtists(env);
    const albums = await getAlbums(env);
    
    // Get top songs by VIEWS this week
    const topSongs = await getPopularPagesForPeriod(env, 'week', 5, 'song');
    
    for (const song of topSongs) {
      const metadata = await getMetadata(env, song.page_id);
      let artistName = 'Unknown';
      
      if (metadata?.primaryArtist) {
        const artist = artists[metadata.primaryArtist];
        artistName = artist?.name || metadata.primaryArtist;
      }
      
      topContent.push({
        title: metadata?.title || song.page_id,
        artist: artistName,
        type: 'song',
        views: song.views
      });
    }
    
    // Get top albums by VIEWS this week
    const topAlbums = await getPopularPagesForPeriod(env, 'week', 3, 'album');
    for (const album of topAlbums) {
      const albumData = albums[album.page_id];
      let artistName = 'Various';
      
      if (albumData?.artists && albumData.artists.length > 0) {
        const artist = artists[albumData.artists[0]];
        artistName = artist?.name || albumData.artists[0];
      }
      
      topContent.push({
        title: albumData?.title || album.page_id,
        artist: artistName,
        type: 'album',
        views: album.views
      });
    }
    
    // Get top artists by VIEWS this week
    const topArtists = await getPopularPagesForPeriod(env, 'week', 2, 'artist');
    for (const artist of topArtists) {
      const artistData = artists[artist.page_id];
      topContent.push({
        title: artistData?.name || artist.page_id,
        artist: 'Artist',
        type: 'artist',
        views: artist.views
      });
    }
    
    // Sort by views and take top 5
    return topContent
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
      
  } catch (error) {
    console.error('Error getting top content by views:', error);
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
    'merge': 'fa-compress',
    'restore': 'fa-undo',
    'cron': 'fa-clock',
    'play': 'fa-play',
    'download': 'fa-download',
    'login': 'fa-sign-in-alt',
    'logout': 'fa-sign-out-alt',
    'test': 'fa-vial'
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
    'merge': '#9b59b6',
    'restore': '#28a745',
    'cron': '#6c757d',
    'play': '#ff5500',
    'download': '#ff5500',
    'login': '#6c5ce7',
    'logout': '#6c5ce7',
    'test': '#666'
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
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
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