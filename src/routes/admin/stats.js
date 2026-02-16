// ==================== ADMIN STATISTICS ====================
import { getAlbums, getArtists, getPlaylists, getMetadata } from '../../helpers/storage.js';
import { getAggregatedStats, getSongStats } from '../../helpers/db.js';
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
      content = await renderSongStats(env, songs, period);
      break;
    case 'albums':
      content = await renderAlbumStats(env, albums, period);
      break;
    case 'artists':
      content = await renderArtistStats(env, artists, period);
      break;
    case 'playlists':
      content = await renderPlaylistStats(env, playlists, period);
      break;
    case 'overview':
    default:
      content = renderOverview(totalSongs, albums, artists, playlists, totalStats, totalStorage, topSongs, topAlbums, topArtists, topPlaylists, recentSongs);
      break;
  }
  
  // View tabs
  const tabs = `
    <div style="display: flex; gap: 5px; margin-bottom: 20px; overflow-x: auto; padding: 5px 0; -webkit-overflow-scrolling: touch;">
        <a href="/admin/stats?view=overview&period=${period}" class="tab-btn ${view === 'overview' ? 'active' : ''}">
            <i class="fas fa-chart-pie"></i> Overview
        </a>
        <a href="/admin/stats?view=songs&period=${period}" class="tab-btn ${view === 'songs' ? 'active' : ''}">
            <i class="fas fa-music"></i> Songs
        </a>
        <a href="/admin/stats?view=albums&period=${period}" class="tab-btn ${view === 'albums' ? 'active' : ''}">
            <i class="fas fa-compact-disc"></i> Albums
        </a>
        <a href="/admin/stats?view=artists&period=${period}" class="tab-btn ${view === 'artists' ? 'active' : ''}">
            <i class="fas fa-microphone"></i> Artists
        </a>
        <a href="/admin/stats?view=playlists&period=${period}" class="tab-btn ${view === 'playlists' ? 'active' : ''}">
            <i class="fas fa-list"></i> Playlists
        </a>
    </div>
    
    <div style="margin-bottom: 20px;">
        <select id="periodSelect" class="form-control" style="width: auto; min-width: 150px;" onchange="changePeriod()">
            <option value="all" ${period === 'all' ? 'selected' : ''}>All Time</option>
            <option value="year" ${period === 'year' ? 'selected' : ''}>Last 12 Months</option>
            <option value="month" ${period === 'month' ? 'selected' : ''}>Last 30 Days</option>
            <option value="week" ${period === 'week' ? 'selected' : ''}>Last 7 Days</option>
            <option value="today" ${period === 'today' ? 'selected' : ''}>Today</option>
        </select>
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

// Render overview stats
function renderOverview(totalSongs, albums, artists, playlists, totalStats, totalStorage, topSongs, topAlbums, topArtists, topPlaylists, recentSongs) {
  return `
    <!-- Stats Grid -->
    <div class="stats-grid">
        <div class="stat-card">
            <h3><i class="fas fa-music"></i> Total Songs</h3>
            <div class="number">${totalSongs}</div>
            <div class="label">${totalStorage}</div>
        </div>
        <div class="stat-card">
            <h3><i class="fas fa-compact-disc"></i> Albums</h3>
            <div class="number">${Object.keys(albums).length}</div>
            <div class="label">${Object.values(albums).reduce((acc, a) => acc + (a.songs?.length || 0), 0)} tracks</div>
        </div>
        <div class="stat-card">
            <h3><i class="fas fa-microphone"></i> Artists</h3>
            <div class="number">${Object.keys(artists).length}</div>
            <div class="label">${Object.values(artists).reduce((acc, a) => acc + (a.songs?.length || 0), 0)} songs</div>
        </div>
        <div class="stat-card">
            <h3><i class="fas fa-list"></i> Playlists</h3>
            <div class="number">${Object.keys(playlists).length}</div>
            <div class="label">${Object.values(playlists).reduce((acc, p) => acc + (p.songs?.length || 0), 0)} total songs</div>
        </div>
        <div class="stat-card">
            <h3><i class="fas fa-play"></i> Total Plays</h3>
            <div class="number">${formatNumber(totalStats.plays)}</div>
            <div class="label">All time</div>
        </div>
        <div class="stat-card">
            <h3><i class="fas fa-download"></i> Downloads</h3>
            <div class="number">${formatNumber(totalStats.downloads)}</div>
            <div class="label">All time</div>
        </div>
    </div>
    
    <!-- Charts Row -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <h3 style="margin-bottom: 15px;"><i class="fas fa-fire" style="color: #ff5500;"></i> Top Songs</h3>
            ${generateTopList(topSongs, 'song')}
        </div>
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <h3 style="margin-bottom: 15px;"><i class="fas fa-fire" style="color: #ff5500;"></i> Top Albums</h3>
            ${generateTopList(topAlbums, 'album')}
        </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <h3 style="margin-bottom: 15px;"><i class="fas fa-fire" style="color: #ff5500;"></i> Top Artists</h3>
            ${generateTopList(topArtists, 'artist')}
        </div>
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <h3 style="margin-bottom: 15px;"><i class="fas fa-fire" style="color: #ff5500;"></i> Top Playlists</h3>
            ${generateTopList(topPlaylists, 'playlist')}
        </div>
    </div>
    
    <!-- Recent Activity -->
    <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-top: 20px;">
        <h3 style="margin-bottom: 15px;"><i class="fas fa-clock" style="color: #ff5500;"></i> Recent Uploads</h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            ${recentSongs.map(song => `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                    <span>${song.name}</span>
                    <span style="color: #666;">${song.uploaded}</span>
                </div>
            `).join('')}
        </div>
    </div>
    
    <!-- Quick Stats -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 30px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px;">
            <div style="font-size: 0.9rem; opacity: 0.9;">Avg Plays/Song</div>
            <div style="font-size: 2rem; font-weight: 700;">${totalSongs ? Math.round(totalStats.plays / totalSongs) : 0}</div>
        </div>
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 12px;">
            <div style="font-size: 0.9rem; opacity: 0.9;">Avg Downloads/Song</div>
            <div style="font-size: 2rem; font-weight: 700;">${totalSongs ? Math.round(totalStats.downloads / totalSongs) : 0}</div>
        </div>
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 12px;">
            <div style="font-size: 0.9rem; opacity: 0.9;">Songs per Album</div>
            <div style="font-size: 2rem; font-weight: 700;">${Object.keys(albums).length ? Math.round(totalSongs / Object.keys(albums).length) : 0}</div>
        </div>
    </div>
  `;
}

// Generate top list HTML
function generateTopList(items, type) {
  if (items.length === 0) {
    return '<p style="color: #666; text-align: center; padding: 20px;">No data available</p>';
  }
  
  return items.map((item, index) => {
    let title = '';
    let subtitle = '';
    let stats = '';
    
    switch (type) {
      case 'song':
        title = item.name;
        subtitle = item.artist;
        stats = `${formatNumber(item.plays)} plays`;
        break;
      case 'album':
        title = item.title;
        subtitle = item.artist;
        stats = `${formatNumber(item.plays)} plays • ${item.songs} tracks`;
        break;
      case 'artist':
        title = item.name;
        subtitle = `${item.songs} songs • ${item.albums} albums`;
        stats = `${formatNumber(item.monthlyListeners)} monthly listeners`;
        break;
      case 'playlist':
        title = item.title;
        subtitle = `by ${item.curator}`;
        stats = `${formatNumber(item.plays)} plays • ${item.songs} songs`;
        break;
    }
    
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    
    return `
      <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
          <span style="width: 30px; font-weight: 700; color: ${index < 3 ? '#ff5500' : '#999'};">${medal}</span>
          <div style="flex: 1;">
              <div style="font-weight: 600;">${title}</div>
              <div style="font-size: 0.8rem; color: #666;">${subtitle}</div>
          </div>
          <span style="font-size: 0.8rem; color: #ff5500; font-weight: 600;">${stats}</span>
      </div>
    `;
  }).join('');
}

// Render song stats
async function renderSongStats(env, songs, period) {
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
        uploaded: new Date(song.uploaded).toLocaleDateString()
      };
    })
  );
  
  songData.sort((a, b) => b.plays - a.plays);
  
  const totalPlays = songData.reduce((acc, s) => acc + s.plays, 0);
  const totalDownloads = songData.reduce((acc, s) => acc + s.downloads, 0);
  
  const rows = songData.map(song => `
    <tr>
        <td>${song.name}</td>
        <td>${song.artist}</td>
        <td>${formatNumber(song.plays)}</td>
        <td>${formatNumber(song.downloads)}</td>
        <td>${song.uploaded}</td>
    </tr>
  `).join('');
  
  return `
    <div class="stats-grid" style="margin-bottom: 20px;">
        <div class="stat-card">
            <h3>Total Songs</h3>
            <div class="number">${songs.length}</div>
        </div>
        <div class="stat-card">
            <h3>Total Plays</h3>
            <div class="number">${formatNumber(totalPlays)}</div>
        </div>
        <div class="stat-card">
            <h3>Total Downloads</h3>
            <div class="number">${formatNumber(totalDownloads)}</div>
        </div>
        <div class="stat-card">
            <h3>Avg Plays/Song</h3>
            <div class="number">${songs.length ? Math.round(totalPlays / songs.length) : 0}</div>
        </div>
    </div>
    
    <div class="table-responsive">
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Song</th>
                    <th>Artist</th>
                    <th>Plays</th>
                    <th>Downloads</th>
                    <th>Uploaded</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
                ${rows.length === 0 ? '<tr><td colspan="5" style="text-align: center;">No songs found</td></tr>' : ''}
            </tbody>
        </table>
    </div>
  `;
}

// Render album stats
async function renderAlbumStats(env, albums, period) {
  const artists = await getArtists(env);
  
  const albumData = await Promise.all(
    Object.entries(albums).map(async ([id, album]) => {
      const stats = await getAggregatedStats(album.songs || [], env);
      const primaryArtist = album.artists?.length ? (artists[album.artists[0]]?.name || album.artists[0]) : 'Various';
      
      return {
        title: album.title,
        artist: primaryArtist,
        songs: album.songs?.length || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        created: new Date(album.created).toLocaleDateString()
      };
    })
  );
  
  albumData.sort((a, b) => b.plays - a.plays);
  
  const totalPlays = albumData.reduce((acc, a) => acc + a.plays, 0);
  const totalDownloads = albumData.reduce((acc, a) => acc + a.downloads, 0);
  
  const rows = albumData.map(album => `
    <tr>
        <td>${album.title}</td>
        <td>${album.artist}</td>
        <td>${album.songs}</td>
        <td>${formatNumber(album.plays)}</td>
        <td>${formatNumber(album.downloads)}</td>
        <td>${album.created}</td>
    </tr>
  `).join('');
  
  return `
    <div class="stats-grid" style="margin-bottom: 20px;">
        <div class="stat-card">
            <h3>Total Albums</h3>
            <div class="number">${Object.keys(albums).length}</div>
        </div>
        <div class="stat-card">
            <h3>Total Plays</h3>
            <div class="number">${formatNumber(totalPlays)}</div>
        </div>
        <div class="stat-card">
            <h3>Total Downloads</h3>
            <div class="number">${formatNumber(totalDownloads)}</div>
        </div>
        <div class="stat-card">
            <h3>Avg Plays/Album</h3>
            <div class="number">${Object.keys(albums).length ? Math.round(totalPlays / Object.keys(albums).length) : 0}</div>
        </div>
    </div>
    
    <div class="table-responsive">
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Album</th>
                    <th>Artist</th>
                    <th>Songs</th>
                    <th>Plays</th>
                    <th>Downloads</th>
                    <th>Released</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
                ${rows.length === 0 ? '<tr><td colspan="6" style="text-align: center;">No albums found</td></tr>' : ''}
            </tbody>
        </table>
    </div>
  `;
}

// Render artist stats
async function renderArtistStats(env, artists, period) {
  const artistData = await Promise.all(
    Object.entries(artists).map(async ([id, artist]) => {
      const stats = await getAggregatedStats(artist.songs || [], env);
      const monthlyListeners = Math.floor(stats.plays * 0.3);
      
      return {
        name: artist.name,
        songs: artist.songs?.length || 0,
        albums: artist.albums?.length || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        monthlyListeners
      };
    })
  );
  
  artistData.sort((a, b) => b.plays - a.plays);
  
  const totalPlays = artistData.reduce((acc, a) => acc + a.plays, 0);
  const totalDownloads = artistData.reduce((acc, a) => acc + a.downloads, 0);
  
  const rows = artistData.map(artist => `
    <tr>
        <td>${artist.name}</td>
        <td>${artist.songs}</td>
        <td>${artist.albums}</td>
        <td>${formatNumber(artist.plays)}</td>
        <td>${formatNumber(artist.downloads)}</td>
        <td><span class="badge" style="background:#9b59b6; color:white;">${formatNumber(artist.monthlyListeners)}</span></td>
    </tr>
  `).join('');
  
  return `
    <div class="stats-grid" style="margin-bottom: 20px;">
        <div class="stat-card">
            <h3>Total Artists</h3>
            <div class="number">${Object.keys(artists).length}</div>
        </div>
        <div class="stat-card">
            <h3>Total Plays</h3>
            <div class="number">${formatNumber(totalPlays)}</div>
        </div>
        <div class="stat-card">
            <h3>Total Downloads</h3>
            <div class="number">${formatNumber(totalDownloads)}</div>
        </div>
        <div class="stat-card">
            <h3>Monthly Listeners</h3>
            <div class="number">${formatNumber(artistData.reduce((acc, a) => acc + a.monthlyListeners, 0))}</div>
        </div>
    </div>
    
    <div class="table-responsive">
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Artist</th>
                    <th>Songs</th>
                    <th>Albums</th>
                    <th>Plays</th>
                    <th>Downloads</th>
                    <th>Monthly</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
                ${rows.length === 0 ? '<tr><td colspan="6" style="text-align: center;">No artists found</td></tr>' : ''}
            </tbody>
        </table>
    </div>
  `;
}

// Render playlist stats
async function renderPlaylistStats(env, playlists, period) {
  const playlistData = await Promise.all(
    Object.entries(playlists).map(async ([id, playlist]) => {
      const stats = await getAggregatedStats(playlist.songs || [], env);
      
      return {
        title: playlist.title,
        curator: playlist.curator || 'ZEDALBUMS',
        songs: playlist.songs?.length || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        updated: new Date(playlist.updated || playlist.created).toLocaleDateString()
      };
    })
  );
  
  playlistData.sort((a, b) => b.plays - a.plays);
  
  const totalPlays = playlistData.reduce((acc, p) => acc + p.plays, 0);
  const totalDownloads = playlistData.reduce((acc, p) => acc + p.downloads, 0);
  
  const rows = playlistData.map(playlist => `
    <tr>
        <td>${playlist.title}</td>
        <td>${playlist.curator}</td>
        <td>${playlist.songs}</td>
        <td>${formatNumber(playlist.plays)}</td>
        <td>${formatNumber(playlist.downloads)}</td>
        <td>${playlist.updated}</td>
    </tr>
  `).join('');
  
  return `
    <div class="stats-grid" style="margin-bottom: 20px;">
        <div class="stat-card">
            <h3>Total Playlists</h3>
            <div class="number">${Object.keys(playlists).length}</div>
        </div>
        <div class="stat-card">
            <h3>Total Plays</h3>
            <div class="number">${formatNumber(totalPlays)}</div>
        </div>
        <div class="stat-card">
            <h3>Total Downloads</h3>
            <div class="number">${formatNumber(totalDownloads)}</div>
        </div>
        <div class="stat-card">
            <h3>Avg Plays/Playlist</h3>
            <div class="number">${Object.keys(playlists).length ? Math.round(totalPlays / Object.keys(playlists).length) : 0}</div>
        </div>
    </div>
    
    <div class="table-responsive">
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Playlist</th>
                    <th>Curator</th>
                    <th>Songs</th>
                    <th>Plays</th>
                    <th>Downloads</th>
                    <th>Updated</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
                ${rows.length === 0 ? '<tr><td colspan="6" style="text-align: center;">No playlists found</td></tr>' : ''}
            </tbody>
        </table>
    </div>
  `;
}