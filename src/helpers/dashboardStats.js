// ==================== DASHBOARD STATS HELPER ====================
import { getAlbums, getArtists, getPlaylists, getMetadata } from './storage.js';
import { getAggregatedStats } from './db.js';
import { 
  getTodayViews,
  getWeekViews,
  getMonthViews,
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
    
    // Get today's stats from new tables
    const todayViews = await getTodayViews(env);
    const todayPlays = (await getPlaysDownloadsSummary(env)).today.plays;
    const todayDownloads = (await getPlaysDownloadsSummary(env)).today.downloads;
    
    // Get trends
    const viewsTrends = await getViewTrends(env, null, null);
    const playsTrends = await getPlaysTrends ? await getPlaysTrends(env, null, null) : null;
    const downloadsTrends = await getDownloadsTrends ? await getDownloadsTrends(env, null, null) : null;
    
    // Get chart data for 7-day activity
    const viewsChart = await getViewsChartData(env, 'week');
    const playsChart = await getPlaysChartData(env, 'week');
    const downloadsChart = await getDownloadsChartData(env, 'week');
    
    // Combine chart data for the 7-day display
    const weeklyData = [];
    const labels = viewsChart.labels;
    
    for (let i = 0; i < labels.length; i++) {
      // Scale values for bar heights (max 100px)
      const maxValue = Math.max(
        ...viewsChart.data,
        ...playsChart.data,
        ...downloadsChart.data,
        1
      );
      
      weeklyData.push({
        label: formatChartLabel(labels[i]),
        views: Math.round((viewsChart.data[i] / maxValue) * 100) || 1,
        plays: Math.round((playsChart.data[i] / maxValue) * 100) || 1,
        downloads: Math.round((downloadsChart.data[i] / maxValue) * 100) || 1,
        viewsRaw: viewsChart.data[i],
        playsRaw: playsChart.data[i],
        downloadsRaw: downloadsChart.data[i]
      });
    }
    
    // Get top content this week
    const topContent = await getTopContent(env);
    
    // Get recent activity
    const recentActivity = await getRecentActivity(env);
    
    return {
      viewsToday: todayViews,
      playsToday: todayPlays,
      downloadsToday: todayDownloads,
      
      viewsTrend: getTrendEmoji(viewsTrends?.dailyChange || 0),
      playsTrend: getTrendEmoji(playsTrends?.dailyChange || 0),
      downloadsTrend: getTrendEmoji(downloadsTrends?.dailyChange || 0),
      
      viewsTrendValue: getTrendValue(viewsTrends?.dailyChange || 0),
      playsTrendValue: getTrendValue(playsTrends?.dailyChange || 0),
      downloadsTrendValue: getTrendValue(downloadsTrends?.dailyChange || 0),
      
      newSongs,
      newAlbums,
      newArtists,
      
      weeklyData,
      topContent,
      recentActivity
    };
    
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    
    // Return fallback data
    return {
      viewsToday: 0,
      playsToday: 0,
      downloadsToday: 0,
      viewsTrend: 'same',
      playsTrend: 'same',
      downloadsTrend: 'same',
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

// Helper to format chart label
function formatChartLabel(label) {
  if (!label) return '';
  // Convert YYYY-MM-DD to DD/MM
  const parts = label.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return label;
}

// Helper to get trend emoji
function getTrendEmoji(change) {
  if (change > 0) return '↑';
  if (change < 0) return '↓';
  return '→';
}

// Helper to get trend value with sign
function getTrendValue(change) {
  if (change > 0) return `+${change}`;
  if (change < 0) return `${change}`;
  return '0';
}

// Get top content this week
async function getTopContent(env) {
  try {
    const topContent = [];
    
    // Get top songs by plays this week
    const { getPopularByPlays } = await import('./playsDownloadsEnhanced.js');
    const topSongs = await getPopularByPlays(env, 'week', 3, 'song');
    
    for (const song of topSongs) {
      const metadata = await getMetadata(env, song.item_id);
      topContent.push({
        title: metadata?.title || song.item_id,
        artist: metadata?.primaryArtist || 'Unknown',
        type: 'song',
        views: song.plays // Using plays as views for demo
      });
    }
    
    // Get top albums by plays
    const topAlbums = await getPopularByPlays(env, 'week', 3, 'album');
    for (const album of topAlbums) {
      topContent.push({
        title: album.item_id,
        artist: 'Various',
        type: 'album',
        views: album.plays
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

// Get recent activity
async function getRecentActivity(env) {
  try {
    const activity = [];
    
    // Get recent admin activity
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
        activity.push({
          icon: 'fa-cloud-upload-alt',
          iconBg: '#ff5500',
          text: `New song uploaded: ${song.key.split('/')[1]}`,
          time: formatTimeAgo(new Date(song.uploaded)),
          link: `/song/${encodeURIComponent(song.key.split('/')[1])}`
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

// Helper to format time ago
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