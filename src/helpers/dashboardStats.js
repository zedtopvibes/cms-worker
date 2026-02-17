// ==================== DASHBOARD STATS HELPER ====================
import { getAlbums, getArtists, getPlaylists } from './storage.js';
import { getAggregatedStats, getSongStats } from './db.js';
import { getTotalPageViews, getViewsByType } from './pageViews.js';

export async function getDashboardStats(env) {
  // Get counts
  const albums = await getAlbums(env);
  const artists = await getArtists(env);
  const playlists = await getPlaylists(env);
  const songList = await env.media.list({ prefix: "songs/" });
  const songs = songList.objects || [];
  
  // Get today's date range
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  // Calculate today's stats
  let viewsToday = 0;
  let playsToday = 0;
  let downloadsToday = 0;
  let viewsYesterday = 0;
  let playsYesterday = 0;
  let downloadsYesterday = 0;
  
  // Get weekly data for chart
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    weeklyData.push({
      label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
      views: 0,
      plays: 0,
      downloads: 0
    });
  }
  
  // Process songs for plays/downloads
  for (const song of songs) {
    const fileName = song.key.split('/')[1];
    const baseName = fileName.replace('.mp3', '');
    const stats = await getSongStats(baseName, env);
    
    // For demo purposes - in real app, you'd need timestamp data
    // This is simplified - you'd need to store daily aggregates
    playsToday += Math.floor(stats.plays * 0.1); // 10% of plays today
    downloadsToday += Math.floor(stats.downloads * 0.1);
    playsYesterday += Math.floor(stats.plays * 0.08);
    downloadsYesterday += Math.floor(stats.downloads * 0.08);
    
    // Fill weekly data (simplified)
    weeklyData.forEach((day, index) => {
      day.plays += Math.floor(stats.plays * (0.05 + index * 0.01));
      day.downloads += Math.floor(stats.downloads * (0.05 + index * 0.01));
    });
  }
  
  // Get page views for today
  // This is simplified - in production, you'd have time-based queries
  viewsToday = Math.floor(await getTotalPageViews(env) * 0.15);
  viewsYesterday = Math.floor(viewsToday * 0.9);
  
  // Fill weekly views
  weeklyData.forEach((day, index) => {
    day.views = Math.floor(viewsToday * (0.7 + index * 0.1));
  });
  
  // Calculate trends
  const viewsTrend = viewsToday > viewsYesterday ? '↑' : viewsToday < viewsYesterday ? '↓' : '→';
  const playsTrend = playsToday > playsYesterday ? '↑' : playsToday < playsYesterday ? '↓' : '→';
  const downloadsTrend = downloadsToday > downloadsYesterday ? '↑' : downloadsToday < downloadsYesterday ? '↓' : '→';
  
  const viewsTrendValue = viewsToday > viewsYesterday 
    ? `+${Math.round((viewsToday - viewsYesterday) / viewsYesterday * 100)}%` 
    : viewsToday < viewsYesterday 
      ? `-${Math.round((viewsYesterday - viewsToday) / viewsYesterday * 100)}%` 
      : '0%';
  
  const playsTrendValue = playsToday > playsYesterday 
    ? `+${Math.round((playsToday - playsYesterday) / playsYesterday * 100)}%` 
    : playsToday < playsYesterday 
      ? `-${Math.round((playsYesterday - playsToday) / playsYesterday * 100)}%` 
      : '0%';
  
  const downloadsTrendValue = downloadsToday > downloadsYesterday 
    ? `+${Math.round((downloadsToday - downloadsYesterday) / downloadsYesterday * 100)}%` 
    : downloadsToday < downloadsYesterday 
      ? `-${Math.round((downloadsYesterday - downloadsToday) / downloadsYesterday * 100)}%` 
      : '0%';
  
  // Get new items this week
  const newSongs = songs.filter(s => new Date(s.uploaded) > weekAgo).length;
  const newAlbums = Object.values(albums).filter(a => a.created > weekAgo.getTime()).length;
  const newArtists = Object.values(artists).filter(a => a.created > weekAgo.getTime()).length;
  
  // Get top content this week (simplified - would need real data)
  const topContent = [
    { title: "Blessings", artist: "Yo Maps", type: "Song", views: 1234 },
    { title: "Yesterday Night", artist: "Towela Kaira", type: "Song", views: 987 },
    { title: "Best of Zam Rock", artist: "Various", type: "Album", views: 756 },
    { title: "Yo Maps", artist: "Artist", type: "Artist Page", views: 543 },
    { title: "Zam Hits 2025", artist: "ZEDALBUMS", type: "Playlist", views: 432 },
  ];
  
  // Get recent activity
  const recentActivity = [
    { icon: 'fa-cloud-upload-alt', iconBg: '#ff5500', text: 'New song uploaded "Hit Song" by Popular Artist', time: '2 minutes ago', link: '/admin/songs' },
    { icon: 'fa-edit', iconBg: '#4a90e2', text: 'Album "Best of 2025" was edited', time: '15 minutes ago', link: '/admin/albums' },
    { icon: 'fa-user', iconBg: '#9b59b6', text: 'Artist profile "New Star" was updated', time: '1 hour ago', link: '/admin/artists' },
    { icon: 'fa-list', iconBg: '#28a745', text: '5 songs added to playlist "Chill Vibes"', time: '3 hours ago', link: '/admin/playlists' },
    { icon: 'fa-trash', iconBg: '#dc3545', text: 'Song "Old Track" was deleted', time: '5 hours ago' },
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
}