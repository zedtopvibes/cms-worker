// ==================== ADMIN STATISTICS - MOBILE OPTIMIZED WITH PAGE VIEWS ====================
import { getAlbums, getArtists, getPlaylists, getMetadata } from '../../helpers/storage.js';
import { getAggregatedStats, getSongStats } from '../../helpers/db.js';
import { getPopularPages, getTotalPageViews, getViewsByType } from '../../helpers/pageViews.js';
import { formatNumber, formatDuration } from '../../helpers/formatting.js';

export async function handleAdminStats(req, env, ctx, auth) {
  const url = new URL(req.url);
  const view = url.searchParams.get('view') || 'overview';
  const period = url.searchParams.get('period') || 'all';
  
  // Get basic counts
  const albums = await getAlbums(env);
  const artists = await getArtists(env);
  const playlists = await getPlaylists(env);
  const songList = await env.media.list({ prefix: "songs/" });
  const songs = songList.objects || [];
  const totalSongs = songs.length;
  
  // Calculate total storage
  const totalBytes = songs.reduce((acc, song) => acc + (song.size || 0), 0);
  const totalStorage = formatBytes(totalBytes);
  
  // Get all song keys for stats
  const allSongKeys = songs.map(song => {
    const fileName = song.key.split('/')[1];
    return fileName.replace('.mp3', '');
  });
  
  // Get total stats
  const totalStats = await getAggregatedStats(allSongKeys, env);
  
  // Get page views stats
  const popularPages = await getPopularPages(env, 5);
  const totalPageViews = await getTotalPageViews(env);
  const viewsByType = await getViewsByType(env);
  
  // Get top items
  const topSongs = await getTopSongs(env, 10);
  const topAlbums = await getTopAlbums(env, 10);
  const topArtists = await getTopArtists(env, 10);
  const topPlaylists = await getTopPlaylists(env, 10);
  
  // Get recent activity
  const recentSongs = songs
    .sort((a, b) => b.uploaded - a.uploaded)
    .slice(0, 5)
    .map(song => {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      return {
        name: baseName,
        uploaded: new Date(song.uploaded).toLocaleDateString()
      };
    });
  
  // Generate content based on view
  let content = '';
  
  switch (view) {
    case 'songs':
      content = await renderSongStats(env, songs);
      break;
    case 'albums':
      content = await renderAlbumStats(env, albums);
      break;
    case 'artists':
      content = await renderArtistStats(env, artists);
      break;
    case 'playlists':
      content = await renderPlaylistStats(env, playlists);
      break;
    case 'overview':
    default:
      content = renderOverview(totalSongs, albums, artists, playlists, totalStats, totalStorage, 
                              topSongs, topAlbums, topArtists, topPlaylists, recentSongs,
                              popularPages, totalPageViews, viewsByType);
      break;
  }
  
  // View tabs - mobile friendly horizontal scroll
  const tabs = `
    <div style="display: flex; gap: 8px; margin-bottom: 20px; overflow-x: auto; padding: 5px 0 10px; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
        <a href="/admin/stats?view=overview&period=${period}" class="tab-btn ${view === 'overview' ? 'active' : ''}" style="white-space: nowrap;">
            <i class="fas fa-chart-pie"></i> Overview
        </a>
        <a href="/admin/stats?view=songs&period=${period}" class="tab-btn ${view === 'songs' ? 'active' : ''}" style="white-space: nowrap;">
            <i class="fas fa-music"></i> Songs
        </a>
        <a href="/admin/stats?view=albums&period=${period}" class="tab-btn ${view === 'albums' ? 'active' : ''}" style="white-space: nowrap;">
            <i class="fas fa-compact-disc"></i> Albums
        </a>
        <a href="/admin/stats?view=artists&period=${period}" class="tab-btn ${view === 'artists' ? 'active' : ''}" style="white-space: nowrap;">
            <i class="fas fa-microphone"></i> Artists
        </a>
        <a href="/admin/stats?view=playlists&period=${period}" class="tab-btn ${view === 'playlists' ? 'active' : ''}" style="white-space: nowrap;">
            <i class="fas fa-list"></i> Playlists
        </a>
    </div>
  `;
  
  const fullContent = tabs + content;
  
  return fullContent;
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get top songs
async function getTopSongs(env, limit = 10) {
  const songList = await env.media.list({ prefix: "songs/" });
  const songs = songList.objects || [];
  const artists = await getArtists(env);
  
  const songData = await Promise.all(
    songs.map(async (song) => {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const stats = await getSongStats(baseName, env);
      const meta = await getMetadata(env, baseName);
      
      return {
        name: meta?.title || baseName,
        artist: meta?.primaryArtist ? (artists[meta.primaryArtist]?.name || meta.primaryArtist) : baseName.split('_')[0],
        plays: stats.plays,
        downloads: stats.downloads,
        baseName
      };
    })
  );
  
  return songData.sort((a, b) => b.plays - a.plays).slice(0, limit);
}

// Get top albums
async function getTopAlbums(env, limit = 10) {
  const albums = await getAlbums(env);
  const artists = await getArtists(env);
  
  const albumData = await Promise.all(
    Object.entries(albums).map(async ([id, album]) => {
      const stats = await getAggregatedStats(album.songs || [], env);
      const primaryArtist = album.artists?.length ? (artists[album.artists[0]]?.name || album.artists[0]) : 'Various';
      
      return {
        id,
        title: album.title,
        artist: primaryArtist,
        plays: stats.plays,
        downloads: stats.downloads,
        songs: album.songs?.length || 0
      };
    })
  );
  
  return albumData.sort((a, b) => b.plays - a.plays).slice(0, limit);
}

// Get top artists
async function getTopArtists(env, limit = 10) {
  const artists = await getArtists(env);
  
  const artistData = await Promise.all(
    Object.entries(artists).map(async ([id, artist]) => {
      const stats = await getAggregatedStats(artist.songs || [], env);
      const monthlyListeners = Math.floor(stats.plays * 0.3);
      
      return {
        id,
        name: artist.name,
        plays: stats.plays,
        downloads: stats.downloads,
        monthlyListeners,
        songs: artist.songs?.length || 0,
        albums: artist.albums?.length || 0
      };
    })
  );
  
  return artistData.sort((a, b) => b.plays - a.plays).slice(0, limit);
}

// Get top playlists
async function getTopPlaylists(env, limit = 10) {
  const playlists = await getPlaylists(env);
  
  const playlistData = await Promise.all(
    Object.entries(playlists).map(async ([id, playlist]) => {
      const stats = await getAggregatedStats(playlist.songs || [], env);
      
      return {
        id,
        title: playlist.title,
        curator: playlist.curator || 'ZEDALBUMS',
        plays: stats.plays,
        downloads: stats.downloads,
        songs: playlist.songs?.length || 0
      };
    })
  );
  
  return playlistData.sort((a, b) => b.plays - a.plays).slice(0, limit);
}

// Render overview stats - WITH PAGE VIEWS
function renderOverview(totalSongs, albums, artists, playlists, totalStats, totalStorage, 
                       topSongs, topAlbums, topArtists, topPlaylists, recentSongs,
                       popularPages, totalPageViews, viewsByType) {
  return `
    <!-- Stats Grid -->
    <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px;">
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;"><i class="fas fa-music"></i> Songs</h3>
            <div class="number" style="font-size: 1.5rem;">${totalSongs}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;"><i class="fas fa-compact-disc"></i> Albums</h3>
            <div class="number" style="font-size: 1.5rem;">${Object.keys(albums).length}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;"><i class="fas fa-microphone"></i> Artists</h3>
            <div class="number" style="font-size: 1.5rem;">${Object.keys(artists).length}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;"><i class="fas fa-list"></i> Playlists</h3>
            <div class="number" style="font-size: 1.5rem;">${Object.keys(playlists).length}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;"><i class="fas fa-play"></i> Plays</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalStats.plays)}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;"><i class="fas fa-download"></i> Downloads</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalStats.downloads)}</div>
        </div>
    </div>
    
    <!-- Storage Card -->
    <div style="background: linear-gradient(135deg, #ff5500, #ff8c00); color: white; padding: 15px; border-radius: 12px; margin: 15px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span><i class="fas fa-database"></i> Storage Used</span>
            <span style="font-weight: 700;">${totalStorage}</span>
        </div>
    </div>
    
    <!-- PAGE VIEWS SECTION - NEW -->
    <div style="background: white; border-radius: 12px; padding: 15px; margin: 15px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="font-size: 1rem;"><i class="fas fa-eye" style="color: #ff5500;"></i> Page Views</h4>
            <span style="background: #ff5500; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                Total: ${formatNumber(totalPageViews)}
            </span>
        </div>
        
        <!-- Views by Type -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 15px;">
            ${viewsByType.map(type => `
                <div style="background: #f8f9fa; padding: 8px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.7rem; color: #666;">${getPageIcon(type.page_type)} ${type.page_type}s</div>
                    <div style="font-weight: 700; color: #ff5500;">${formatNumber(type.total)}</div>
                    <div style="font-size: 0.6rem; color: #999;">${type.count} items</div>
                </div>
            `).join('')}
            ${viewsByType.length === 0 ? `
                <div style="grid-column: span 2; text-align: center; padding: 20px; color: #666;">
                    <i class="fas fa-eye-slash"></i> No page views yet
                </div>
            ` : ''}
        </div>
        
        <!-- Most Viewed Pages -->
        <h5 style="margin: 10px 0 8px; font-size: 0.9rem;">Most Viewed Pages</h5>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${popularPages.map(page => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
                    <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
                        <span>${getPageIcon(page.page_type)}</span>
                        <span style="font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">
                            ${page.page_id}
                        </span>
                        <span style="font-size: 0.6rem; color: #666; background: #f0f0f0; padding: 2px 6px; border-radius: 20px; white-space: nowrap;">
                            ${page.page_type}
                        </span>
                    </div>
                    <span style="font-weight: 600; color: #ff5500; font-size: 0.8rem; white-space: nowrap; margin-left: 8px;">
                        ${formatNumber(page.views)}
                    </span>
                </div>
            `).join('')}
            ${popularPages.length === 0 ? `
                <div style="text-align: center; padding: 20px; color: #666;">
                    No page views recorded yet. Visit some pages to generate views.
                </div>
            ` : ''}
        </div>
    </div>
    
    <!-- Top Charts -->
    <h3 style="margin: 20px 0 10px; font-size: 1.1rem;"><i class="fas fa-fire" style="color: #ff5500;"></i> Top Charts</h3>
    
    <!-- Top Songs -->
    <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="font-size: 1rem;"><i class="fas fa-music" style="color: #ff5500;"></i> Top Songs</h4>
            <span style="font-size: 0.8rem; color: #666;">Plays</span>
        </div>
        ${generateTopListMobile(topSongs, 'song')}
    </div>
    
    <!-- Top Albums -->
    <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="font-size: 1rem;"><i class="fas fa-compact-disc" style="color: #ff5500;"></i> Top Albums</h4>
            <span style="font-size: 0.8rem; color: #666;">Plays</span>
        </div>
        ${generateTopListMobile(topAlbums, 'album')}
    </div>
    
    <!-- Top Artists -->
    <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="font-size: 1rem;"><i class="fas fa-microphone" style="color: #ff5500;"></i> Top Artists</h4>
            <span style="font-size: 0.8rem; color: #666;">Monthly</span>
        </div>
        ${generateTopListMobile(topArtists, 'artist')}
    </div>
    
    <!-- Top Playlists -->
    <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="font-size: 1rem;"><i class="fas fa-list" style="color: #ff5500;"></i> Top Playlists</h4>
            <span style="font-size: 0.8rem; color: #666;">Plays</span>
        </div>
        ${generateTopListMobile(topPlaylists, 'playlist')}
    </div>
    
    <!-- Recent Activity -->
    <div style="background: white; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <h4 style="margin-bottom: 15px; font-size: 1rem;"><i class="fas fa-clock" style="color: #ff5500;"></i> Recent Uploads</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            ${recentSongs.map(song => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0;">
                    <span style="font-size: 0.9rem;">${song.name}</span>
                    <span style="font-size: 0.75rem; color: #666; background: #f5f5f5; padding: 3px 8px; border-radius: 20px;">${song.uploaded}</span>
                </div>
            `).join('')}
        </div>
    </div>
    
    <!-- Quick Stats Cards -->
    <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 12px;">
            <div style="font-size: 0.8rem; opacity: 0.9;">Average Plays per Song</div>
            <div style="font-size: 1.8rem; font-weight: 700;">${totalSongs ? Math.round(totalStats.plays / totalSongs) : 0}</div>
        </div>
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px; border-radius: 12px;">
            <div style="font-size: 0.8rem; opacity: 0.9;">Average Downloads per Song</div>
            <div style="font-size: 1.8rem; font-weight: 700;">${totalSongs ? Math.round(totalStats.downloads / totalSongs) : 0}</div>
        </div>
    </div>
  `;
}

// Mobile-friendly top list generator
function generateTopListMobile(items, type) {
  if (items.length === 0) {
    return '<p style="color: #666; text-align: center; padding: 10px;">No data available</p>';
  }
  
  return items.map((item, index) => {
    let title = '';
    let subtitle = '';
    let value = '';
    let icon = '';
    
    switch (type) {
      case 'song':
        title = item.name;
        subtitle = item.artist;
        value = formatNumber(item.plays);
        icon = '🎵';
        break;
      case 'album':
        title = item.title;
        subtitle = item.artist;
        value = formatNumber(item.plays);
        icon = '💿';
        break;
      case 'artist':
        title = item.name;
        subtitle = `${item.songs} songs`;
        value = formatNumber(item.monthlyListeners);
        icon = '🎤';
        break;
      case 'playlist':
        title = item.title;
        subtitle = `by ${item.curator}`;
        value = formatNumber(item.plays);
        icon = '📋';
        break;
    }
    
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    
    return `
      <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
          <span style="width: 30px; font-weight: 700; color: ${index < 3 ? '#ff5500' : '#999'};">${medal}</span>
          <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
              <div style="font-size: 0.75rem; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${subtitle}</div>
          </div>
          <span style="font-size: 0.8rem; color: #ff5500; font-weight: 600; background: #fff0e6; padding: 3px 8px; border-radius: 20px; white-space: nowrap;">${value}</span>
      </div>
    `;
  }).join('');
}

// Helper function for page icons
function getPageIcon(type) {
  const icons = {
    'album': '💿',
    'artist': '🎤',
    'playlist': '📋',
    'song': '🎵'
  };
  return icons[type] || '📄';
}

// Render song stats
async function renderSongStats(env, songs) {
  const artists = await getArtists(env);
  
  const songData = await Promise.all(
    songs.map(async (song) => {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const stats = await getSongStats(baseName, env);
      const meta = await getMetadata(env, baseName);
      const pageViews = await getPageViews(env, 'song', baseName);
      
      return {
        name: meta?.title || baseName,
        artist: meta?.primaryArtist ? (artists[meta.primaryArtist]?.name || meta.primaryArtist) : baseName.split('_')[0],
        plays: stats.plays,
        downloads: stats.downloads,
        views: pageViews,
        uploaded: new Date(song.uploaded).toLocaleDateString()
      };
    })
  );
  
  songData.sort((a, b) => b.plays - a.plays);
  
  const totalPlays = songData.reduce((acc, s) => acc + s.plays, 0);
  const totalDownloads = songData.reduce((acc, s) => acc + s.downloads, 0);
  const totalViews = songData.reduce((acc, s) => acc + s.views, 0);
  
  return `
    <!-- Stats Cards -->
    <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Total Songs</h3>
            <div class="number" style="font-size: 1.5rem;">${songs.length}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Total Plays</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalPlays)}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Downloads</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalDownloads)}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Page Views</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalViews)}</div>
        </div>
    </div>
    
    <!-- Song Cards -->
    <h3 style="margin: 15px 0 10px; font-size: 1rem;">All Songs</h3>
    <div style="display: flex; flex-direction: column; gap: 10px;">
        ${songData.map(song => `
            <div style="background: white; border-radius: 10px; padding: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="font-weight: 600;">${song.name}</div>
                    <span style="font-size: 0.7rem; color: #666; background: #f5f5f5; padding: 2px 6px; border-radius: 20px;">${song.uploaded}</span>
                </div>
                <div style="color: #ff5500; font-size: 0.85rem; margin-bottom: 8px;">${song.artist}</div>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <span style="font-size: 0.8rem;"><i class="fas fa-play" style="color: #ff5500;"></i> ${formatNumber(song.plays)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-download" style="color: #ff5500;"></i> ${formatNumber(song.downloads)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-eye" style="color: #4a90e2;"></i> ${formatNumber(song.views)}</span>
                </div>
            </div>
        `).join('')}
        ${songData.length === 0 ? '<p style="text-align: center; color: #666;">No songs found</p>' : ''}
    </div>
  `;
}

// Render album stats
async function renderAlbumStats(env, albums) {
  const artists = await getArtists(env);
  
  const albumData = await Promise.all(
    Object.entries(albums).map(async ([id, album]) => {
      const stats = await getAggregatedStats(album.songs || [], env);
      const primaryArtist = album.artists?.length ? (artists[album.artists[0]]?.name || album.artists[0]) : 'Various';
      const pageViews = await getPageViews(env, 'album', id);
      
      return {
        title: album.title,
        artist: primaryArtist,
        songs: album.songs?.length || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        views: pageViews,
        created: new Date(album.created).toLocaleDateString()
      };
    })
  );
  
  albumData.sort((a, b) => b.plays - a.plays);
  
  const totalPlays = albumData.reduce((acc, a) => acc + a.plays, 0);
  const totalDownloads = albumData.reduce((acc, a) => acc + a.downloads, 0);
  const totalViews = albumData.reduce((acc, a) => acc + a.views, 0);
  
  return `
    <!-- Stats Cards -->
    <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Total Albums</h3>
            <div class="number" style="font-size: 1.5rem;">${Object.keys(albums).length}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Total Plays</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalPlays)}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Downloads</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalDownloads)}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Page Views</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalViews)}</div>
        </div>
    </div>
    
    <!-- Album Cards -->
    <h3 style="margin: 15px 0 10px; font-size: 1rem;">All Albums</h3>
    <div style="display: flex; flex-direction: column; gap: 10px;">
        ${albumData.map(album => `
            <div style="background: white; border-radius: 10px; padding: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="font-weight: 600;">${album.title}</div>
                    <span style="font-size: 0.7rem; color: #666; background: #f5f5f5; padding: 2px 6px; border-radius: 20px;">${album.created}</span>
                </div>
                <div style="color: #ff5500; font-size: 0.85rem; margin-bottom: 8px;">${album.artist}</div>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <span style="font-size: 0.8rem;"><i class="fas fa-music"></i> ${album.songs} songs</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-play" style="color: #ff5500;"></i> ${formatNumber(album.plays)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-download" style="color: #ff5500;"></i> ${formatNumber(album.downloads)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-eye" style="color: #4a90e2;"></i> ${formatNumber(album.views)}</span>
                </div>
            </div>
        `).join('')}
        ${albumData.length === 0 ? '<p style="text-align: center; color: #666;">No albums found</p>' : ''}
    </div>
  `;
}

// Render artist stats
async function renderArtistStats(env, artists) {
  const artistData = await Promise.all(
    Object.entries(artists).map(async ([id, artist]) => {
      const stats = await getAggregatedStats(artist.songs || [], env);
      const monthlyListeners = Math.floor(stats.plays * 0.3);
      const pageViews = await getPageViews(env, 'artist', id);
      
      return {
        name: artist.name,
        songs: artist.songs?.length || 0,
        albums: artist.albums?.length || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        views: pageViews,
        monthlyListeners
      };
    })
  );
  
  artistData.sort((a, b) => b.plays - a.plays);
  
  const totalPlays = artistData.reduce((acc, a) => acc + a.plays, 0);
  const totalDownloads = artistData.reduce((acc, a) => acc + a.downloads, 0);
  const totalViews = artistData.reduce((acc, a) => acc + a.views, 0);
  
  return `
    <!-- Stats Cards -->
    <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Total Artists</h3>
            <div class="number" style="font-size: 1.5rem;">${Object.keys(artists).length}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Total Plays</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalPlays)}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Downloads</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalDownloads)}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Page Views</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalViews)}</div>
        </div>
    </div>
    
    <!-- Artist Cards -->
    <h3 style="margin: 15px 0 10px; font-size: 1rem;">All Artists</h3>
    <div style="display: flex; flex-direction: column; gap: 10px;">
        ${artistData.map(artist => `
            <div style="background: white; border-radius: 10px; padding: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-weight: 600; margin-bottom: 8px;">${artist.name}</div>
                <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 8px;">
                    <span style="font-size: 0.8rem;"><i class="fas fa-music"></i> ${artist.songs} songs</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-compact-disc"></i> ${artist.albums} albums</span>
                </div>
                <div style="display: flex; gap: 15px; flex-wrap: wrap; background: #f8f9fa; padding: 8px; border-radius: 8px;">
                    <span style="font-size: 0.8rem;"><i class="fas fa-play" style="color: #ff5500;"></i> ${formatNumber(artist.plays)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-download" style="color: #ff5500;"></i> ${formatNumber(artist.downloads)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-eye" style="color: #4a90e2;"></i> ${formatNumber(artist.views)}</span>
                    <span style="font-size: 0.8rem; background: #9b59b6; color: white; padding: 2px 8px; border-radius: 20px;">${formatNumber(artist.monthlyListeners)} monthly</span>
                </div>
            </div>
        `).join('')}
        ${artistData.length === 0 ? '<p style="text-align: center; color: #666;">No artists found</p>' : ''}
    </div>
  `;
}

// Render playlist stats
async function renderPlaylistStats(env, playlists) {
  const playlistData = await Promise.all(
    Object.entries(playlists).map(async ([id, playlist]) => {
      const stats = await getAggregatedStats(playlist.songs || [], env);
      const pageViews = await getPageViews(env, 'playlist', id);
      
      return {
        title: playlist.title,
        curator: playlist.curator || 'ZEDALBUMS',
        songs: playlist.songs?.length || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        views: pageViews,
        updated: new Date(playlist.updated || playlist.created).toLocaleDateString()
      };
    })
  );
  
  playlistData.sort((a, b) => b.plays - a.plays);
  
  const totalPlays = playlistData.reduce((acc, p) => acc + p.plays, 0);
  const totalDownloads = playlistData.reduce((acc, p) => acc + p.downloads, 0);
  const totalViews = playlistData.reduce((acc, p) => acc + p.views, 0);
  
  return `
    <!-- Stats Cards -->
    <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Total Playlists</h3>
            <div class="number" style="font-size: 1.5rem;">${Object.keys(playlists).length}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Total Plays</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalPlays)}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Downloads</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalDownloads)}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Page Views</h3>
            <div class="number" style="font-size: 1.5rem;">${formatNumber(totalViews)}</div>
        </div>
    </div>
    
    <!-- Playlist Cards -->
    <h3 style="margin: 15px 0 10px; font-size: 1rem;">All Playlists</h3>
    <div style="display: flex; flex-direction: column; gap: 10px;">
        ${playlistData.map(playlist => `
            <div style="background: white; border-radius: 10px; padding: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="font-weight: 600;">${playlist.title}</div>
                    <span style="font-size: 0.7rem; color: #666; background: #f5f5f5; padding: 2px 6px; border-radius: 20px;">${playlist.updated}</span>
                </div>
                <div style="color: #4a90e2; font-size: 0.85rem; margin-bottom: 8px;">by ${playlist.curator}</div>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <span style="font-size: 0.8rem;"><i class="fas fa-music"></i> ${playlist.songs} songs</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-play" style="color: #ff5500;"></i> ${formatNumber(playlist.plays)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-download" style="color: #ff5500;"></i> ${formatNumber(playlist.downloads)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-eye" style="color: #4a90e2;"></i> ${formatNumber(playlist.views)}</span>
                </div>
            </div>
        `).join('')}
        ${playlistData.length === 0 ? '<p style="text-align: center; color: #666;">No playlists found</p>' : ''}
    </div>
  `;
}

// Import getPageViews for use in other render functions
import { getPageViews } from '../../helpers/pageViews.js';