// ==================== DASHBOARD STATS HELPER ====================
import { getAlbums, getArtists, getPlaylists, getMetadata } from './storage.js';
import { getAggregatedStats } from './db.js';
import { getPageViews, getTotalPageViews } from './pageViews.js';
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
    
    // Get total stats
    const allSongKeys = songs.map(song => {
      const fileName = song.key.split('/')[1];
      return fileName.replace('.mp3', '');
    });
    const totalStats = await getAggregatedStats(allSongKeys, env);
    
    // Get page views
    const totalViews = await getTotalPageViews(env);
    
    // Get today's stats (simulated for now)
    const today = new Date().toISOString().split('T')[0];
    const viewsToday = Math.floor(Math.random() * 500) + 100; // Placeholder
    const playsToday = Math.floor(Math.random() * 300) + 50;  // Placeholder
    const downloadsToday = Math.floor(Math.random() * 100) + 20; // Placeholder
    
    // Get trends (simulated)
    const viewsTrend = Math.random() > 0.5 ? '↑' : '↓';
    const playsTrend = Math.random() > 0.5 ? '↑' : '↓';
    const downloadsTrend = Math.random() > 0.5 ? '↑' : '↓';
    
    const viewsTrendValue = Math.floor(Math.random() * 20) + 1;
    const playsTrendValue = Math.floor(Math.random() * 15) + 1;
    const downloadsTrendValue = Math.floor(Math.random() * 10) + 1;
    
    // Generate weekly data for chart
    const weeklyData = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let i = 0; i < 7; i++) {
      weeklyData.push({
        label: days[i],
        views: Math.floor(Math.random() * 80) + 20,
        plays: Math.floor(Math.random() * 60) + 15,
        downloads: Math.floor(Math.random() * 40) + 10
      });
    }
    
    // Get top content (simulated)
    const topContent = [
      { title: 'Sample Song 1', artist: 'Artist 1', type: 'song', views: 1234 },
      { title: 'Sample Album 1', artist: 'Artist 2', type: 'album', views: 987 },
      { title: 'Sample Song 2', artist: 'Artist 3', type: 'song', views: 876 },
      { title: 'Sample Artist 1', artist: 'Artist 1', type: 'artist', views: 654 },
      { title: 'Sample Playlist 1', artist: 'Curator', type: 'playlist', views: 543 }
    ];
    
    // Get recent activity
    const recentActivity = [
      {
        icon: 'fa-cloud-upload-alt',
        iconBg: '#ff5500',
        text: 'New song uploaded: "Example Song"',
        time: '5 min ago',
        link: '/admin/songs'
      },
      {
        icon: 'fa-edit',
        iconBg: '#ffc107',
        text: 'Album "Greatest Hits" was updated',
        time: '2 hours ago',
        link: '/admin/albums'
      },
      {
        icon: 'fa-plus-circle',
        iconBg: '#28a745',
        text: 'New artist "John Doe" added',
        time: '1 day ago',
        link: '/admin/artists'
      }
    ];
    
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
      recentActivity
    };
    
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    
    // Return fallback data
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

// Helper to generate fallback weekly data
function generateFallbackWeeklyData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({
    label: day,
    views: 10,
    plays: 8,
    downloads: 5
  }));
}