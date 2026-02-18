// ==================== ADMIN STATISTICS - ENHANCED WITH PLAYS & DOWNLOADS CHARTS ====================
import { getAlbums, getArtists, getPlaylists, getMetadata } from '../../helpers/storage.js';
import { getAggregatedStats, getSongStats } from '../../helpers/db.js';
import { 
  getPopularPages, 
  getTotalPageViews, 
  getViewsByType, 
  getPageViews
} from '../../helpers/pageViews.js';
import { 
  getTodayViews,
  getWeekViews,
  getMonthViews,
  getViewsChartData,
  getViewTrends,
  getViewsSummary
} from '../../helpers/pageViewsEnhanced.js';
import {
  getPlaysForPeriod,
  getDownloadsForPeriod,
  getPopularByPlays,
  getPopularByDownloads,
  getPlaysTrends,
  getDownloadsTrends,
  getPlaysDownloadsSummary,
  getPlaysChartData,
  getDownloadsChartData
} from '../../helpers/playsDownloadsEnhanced.js';
import { formatNumber, formatDuration } from '../../helpers/formatting.js';

export async function handleAdminStats(req, env, ctx, auth) {
  const url = new URL(req.url);
  const view = url.searchParams.get('view') || 'overview';
  const period = url.searchParams.get('period') || 'week';
  const metric = url.searchParams.get('metric') || 'all'; // 'views', 'plays', 'downloads', 'all'
  
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
  
  // ===== ENHANCED STATS =====
  const viewsSummary = await getViewsSummary(env);
  const playsDownloadsSummary = await getPlaysDownloadsSummary(env);
  
  // Get chart data
  const viewsChartData = await getViewsChartData(env, period);
  const playsChartData = await getPlaysChartData(env, period);
  const downloadsChartData = await getDownloadsChartData(env, period);
  
  // Get trends
  const viewsTrends = await getViewTrends(env, null, null);
  
  // Get popular items by different metrics
  const popularSongsByPlays = await getPopularByPlays(env, 'total', 5, 'song');
  const popularSongsByDownloads = await getPopularByDownloads(env, 'total', 5, 'song');
  const popularAlbumsByPlays = await getPopularByPlays(env, 'total', 5, 'album');
  const popularArtistsByPlays = await getPopularByPlays(env, 'total', 5, 'artist');
  
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
      content = renderOverview(
        totalSongs, albums, artists, playlists, totalStats, totalStorage, 
        topSongs, topAlbums, topArtists, topPlaylists, recentSongs,
        viewsSummary, playsDownloadsSummary, 
        viewsChartData, playsChartData, downloadsChartData,
        viewsTrends, period, metric,
        popularSongsByPlays, popularSongsByDownloads,
        popularAlbumsByPlays, popularArtistsByPlays
      );
      break;
  }
  
  // View tabs with period and metric selectors
  const tabs = `
    <div style="margin-bottom: 20px;">
        <div style="display: flex; gap: 8px; margin-bottom: 10px; overflow-x: auto; padding: 5px 0 10px; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
            <a href="/admin/stats?view=overview&period=${period}&metric=${metric}" class="tab-btn ${view === 'overview' ? 'active' : ''}" style="white-space: nowrap;">
                <i class="fas fa-chart-pie"></i> Overview
            </a>
            <a href="/admin/stats?view=songs&period=${period}&metric=${metric}" class="tab-btn ${view === 'songs' ? 'active' : ''}" style="white-space: nowrap;">
                <i class="fas fa-music"></i> Songs
            </a>
            <a href="/admin/stats?view=albums&period=${period}&metric=${metric}" class="tab-btn ${view === 'albums' ? 'active' : ''}" style="white-space: nowrap;">
                <i class="fas fa-compact-disc"></i> Albums
            </a>
            <a href="/admin/stats?view=artists&period=${period}&metric=${metric}" class="tab-btn ${view === 'artists' ? 'active' : ''}" style="white-space: nowrap;">
                <i class="fas fa-microphone"></i> Artists
            </a>
            <a href="/admin/stats?view=playlists&period=${period}&metric=${metric}" class="tab-btn ${view === 'playlists' ? 'active' : ''}" style="white-space: nowrap;">
                <i class="fas fa-list"></i> Playlists
            </a>
        </div>
        
        <!-- Period and Metric Selectors (for overview) -->
        ${view === 'overview' ? `
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
            <div style="display: flex; gap: 5px; overflow-x: auto; padding: 5px 0;">
                <a href="/admin/stats?view=overview&period=day&metric=${metric}" class="btn btn-sm ${period === 'day' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">Daily</a>
                <a href="/admin/stats?view=overview&period=week&metric=${metric}" class="btn btn-sm ${period === 'week' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">Weekly</a>
                <a href="/admin/stats?view=overview&period=month&metric=${metric}" class="btn btn-sm ${period === 'month' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">Monthly</a>
                <a href="/admin/stats?view=overview&period=year&metric=${metric}" class="btn btn-sm ${period === 'year' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">Yearly</a>
            </div>
            
            <div style="display: flex; gap: 5px; overflow-x: auto; padding: 5px 0;">
                <a href="/admin/stats?view=overview&period=${period}&metric=all" class="btn btn-sm ${metric === 'all' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">All</a>
                <a href="/admin/stats?view=overview&period=${period}&metric=views" class="btn btn-sm ${metric === 'views' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">👁️ Views</a>
                <a href="/admin/stats?view=overview&period=${period}&metric=plays" class="btn btn-sm ${metric === 'plays' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">▶️ Plays</a>
                <a href="/admin/stats?view=overview&period=${period}&metric=downloads" class="btn btn-sm ${metric === 'downloads' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">⬇️ Downloads</a>
            </div>
        </div>
        ` : ''}
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
      const views = await getPageViews(env, 'song', baseName, 'total');
      const plays = await getPlaysForPeriod(env, 'song', baseName, 'total');
      const downloads = await getDownloadsForPeriod(env, 'song', baseName, 'total');
      
      return {
        name: meta?.title || baseName,
        artist: meta?.primaryArtist ? (artists[meta.primaryArtist]?.name || meta.primaryArtist) : baseName.split('_')[0],
        plays: plays || stats.plays,
        downloads: downloads || stats.downloads,
        views,
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
      const views = await getPageViews(env, 'album', id, 'total');
      const plays = await getPlaysForPeriod(env, 'album', id, 'total');
      const downloads = await getDownloadsForPeriod(env, 'album', id, 'total');
      
      return {
        id,
        title: album.title,
        artist: primaryArtist,
        plays: plays || stats.plays,
        downloads: downloads || stats.downloads,
        views,
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
      const views = await getPageViews(env, 'artist', id, 'total');
      const plays = await getPlaysForPeriod(env, 'artist', id, 'total');
      const downloads = await getDownloadsForPeriod(env, 'artist', id, 'total');
      
      return {
        id,
        name: artist.name,
        plays: plays || stats.plays,
        downloads: downloads || stats.downloads,
        views,
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
      const views = await getPageViews(env, 'playlist', id, 'total');
      const plays = await getPlaysForPeriod(env, 'playlist', id, 'total');
      const downloads = await getDownloadsForPeriod(env, 'playlist', id, 'total');
      
      return {
        id,
        title: playlist.title,
        curator: playlist.curator || 'ZEDALBUMS',
        plays: plays || stats.plays,
        downloads: downloads || stats.downloads,
        views,
        songs: playlist.songs?.length || 0
      };
    })
  );
  
  return playlistData.sort((a, b) => b.plays - a.plays).slice(0, limit);
}

// Render overview stats - ENHANCED WITH PLAYS & DOWNLOADS CHARTS
function renderOverview(
  totalSongs, albums, artists, playlists, totalStats, totalStorage, 
  topSongs, topAlbums, topArtists, topPlaylists, recentSongs,
  viewsSummary, playsDownloadsSummary,
  viewsChartData, playsChartData, downloadsChartData,
  viewsTrends, period, metric,
  popularSongsByPlays, popularSongsByDownloads,
  popularAlbumsByPlays, popularArtistsByPlays
) {
  
  // Calculate max values for charts
  const maxViews = Math.max(...viewsChartData.data, 1);
  const maxPlays = Math.max(...playsChartData.data, 1);
  const maxDownloads = Math.max(...downloadsChartData.data, 1);
  
  // Format period label
  const periodLabel = period === 'day' ? 'Hourly' : period === 'week' ? 'Daily' : period === 'month' ? 'Weekly' : 'Monthly';
  
  // Determine which charts to show based on metric
  const showViews = metric === 'all' || metric === 'views';
  const showPlays = metric === 'all' || metric === 'plays';
  const showDownloads = metric === 'all' || metric === 'downloads';
  
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
    </div>
    
    <!-- Storage Card -->
    <div style="background: linear-gradient(135deg, #ff5500, #ff8c00); color: white; padding: 15px; border-radius: 12px; margin: 15px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span><i class="fas fa-database"></i> Storage Used</span>
            <span style="font-weight: 700;">${totalStorage}</span>
        </div>
    </div>
    
    <!-- Today's Stats Cards -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0;">
        <div style="background: linear-gradient(135deg, #ff5500, #ff8c00); color: white; padding: 12px; border-radius: 12px; text-align: center;">
            <div style="font-size: 0.7rem; opacity: 0.9;">Today's Views</div>
            <div style="font-size: 1.5rem; font-weight: 700;">${formatNumber(viewsSummary.todayViews)}</div>
        </div>
        <div style="background: linear-gradient(135deg, #4a90e2, #357abd); color: white; padding: 12px; border-radius: 12px; text-align: center;">
            <div style="font-size: 0.7rem; opacity: 0.9;">Today's Plays</div>
            <div style="font-size: 1.5rem; font-weight: 700;">${formatNumber(playsDownloadsSummary.today.plays)}</div>
        </div>
        <div style="background: linear-gradient(135deg, #28a745, #218838); color: white; padding: 12px; border-radius: 12px; text-align: center;">
            <div style="font-size: 0.7rem; opacity: 0.9;">Today's Downloads</div>
            <div style="font-size: 1.5rem; font-weight: 700;">${formatNumber(playsDownloadsSummary.today.downloads)}</div>
        </div>
    </div>
    
    <!-- Quick Stats Row -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0;">
        <div style="background: #f8f9fa; padding: 10px; border-radius: 8px;">
            <div style="font-size: 0.7rem; color: #666;">Total Views</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: #ff5500;">${formatNumber(viewsSummary.totalViews)}</div>
        </div>
        <div style="background: #f8f9fa; padding: 10px; border-radius: 8px;">
            <div style="font-size: 0.7rem; color: #666;">Total Plays</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: #4a90e2;">${formatNumber(playsDownloadsSummary.total.plays)}</div>
        </div>
        <div style="background: #f8f9fa; padding: 10px; border-radius: 8px;">
            <div style="font-size: 0.7rem; color: #666;">Total Downloads</div>
            <div style="font-size: 1.2rem; font-weight: 700; color: #28a745;">${formatNumber(playsDownloadsSummary.total.downloads)}</div>
        </div>
    </div>
    
    <!-- CHARTS SECTION -->
    <div style="background: white; border-radius: 12px; padding: 15px; margin: 15px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <h4 style="margin-bottom: 15px;"><i class="fas fa-chart-line" style="color: #ff5500;"></i> ${periodLabel} Trends</h4>
        
        <!-- Views Chart -->
        ${showViews ? `
        <div style="margin-bottom: 25px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 0.9rem; font-weight: 600; color: #ff5500;">👁️ Views</span>
                <span style="font-size: 0.7rem; color: #666;">Last ${viewsChartData.labels.length} ${period === 'day' ? 'hours' : period === 'week' ? 'days' : period === 'month' ? 'weeks' : 'months'}</span>
            </div>
            <div style="display: flex; align-items: flex-end; gap: 3px; height: 100px; margin: 10px 0;">
                ${viewsChartData.data.map((value, i) => {
                    const height = maxViews > 0 ? (value / maxViews) * 100 : 0;
                    let label = viewsChartData.labels[i];
                    if (period === 'week') label = label.split('-').pop();
                    else if (period === 'month') label = 'W' + label.split('-').pop();
                    else if (period === 'year') label = label.split('-')[1];
                    return `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px;">
                            <div style="width: 100%; background: #ff5500; height: ${height}%; min-height: 2px; border-radius: 4px 4px 0 0;"></div>
                            <span style="font-size: 0.6rem; color: #666;">${label}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        ` : ''}
        
        <!-- Plays Chart -->
        ${showPlays ? `
        <div style="margin-bottom: 25px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 0.9rem; font-weight: 600; color: #4a90e2;">▶️ Plays</span>
                <span style="font-size: 0.7rem; color: #666;">Last ${playsChartData.labels.length} ${period === 'day' ? 'hours' : period === 'week' ? 'days' : period === 'month' ? 'weeks' : 'months'}</span>
            </div>
            <div style="display: flex; align-items: flex-end; gap: 3px; height: 100px; margin: 10px 0;">
                ${playsChartData.data.map((value, i) => {
                    const height = maxPlays > 0 ? (value / maxPlays) * 100 : 0;
                    let label = playsChartData.labels[i];
                    if (period === 'week') label = label.split('-').pop();
                    else if (period === 'month') label = 'W' + label.split('-').pop();
                    else if (period === 'year') label = label.split('-')[1];
                    return `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px;">
                            <div style="width: 100%; background: #4a90e2; height: ${height}%; min-height: 2px; border-radius: 4px 4px 0 0;"></div>
                            <span style="font-size: 0.6rem; color: #666;">${label}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        ` : ''}
        
        <!-- Downloads Chart -->
        ${showDownloads ? `
        <div style="margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 0.9rem; font-weight: 600; color: #28a745;">⬇️ Downloads</span>
                <span style="font-size: 0.7rem; color: #666;">Last ${downloadsChartData.labels.length} ${period === 'day' ? 'hours' : period === 'week' ? 'days' : period === 'month' ? 'weeks' : 'months'}</span>
            </div>
            <div style="display: flex; align-items: flex-end; gap: 3px; height: 100px; margin: 10px 0;">
                ${downloadsChartData.data.map((value, i) => {
                    const height = maxDownloads > 0 ? (value / maxDownloads) * 100 : 0;
                    let label = downloadsChartData.labels[i];
                    if (period === 'week') label = label.split('-').pop();
                    else if (period === 'month') label = 'W' + label.split('-').pop();
                    else if (period === 'year') label = label.split('-')[1];
                    return `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px;">
                            <div style="width: 100%; background: #28a745; height: ${height}%; min-height: 2px; border-radius: 4px 4px 0 0;"></div>
                            <span style="font-size: 0.6rem; color: #666;">${label}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        ` : ''}
    </div>
    
    <!-- Popular Content Section -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
        <!-- Popular Songs by Plays -->
        <div style="background: white; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <h5 style="margin: 0 0 10px 0; color: #4a90e2;"><i class="fas fa-fire"></i> Top Songs by Plays</h5>
            ${renderCompactList(popularSongsByPlays, 'plays')}
        </div>
        
        <!-- Popular Songs by Downloads -->
        <div style="background: white; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <h5 style="margin: 0 0 10px 0; color: #28a745;"><i class="fas fa-download"></i> Top Songs by Downloads</h5>
            ${renderCompactList(popularSongsByDownloads, 'downloads')}
        </div>
        
        <!-- Popular Albums by Plays -->
        <div style="background: white; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <h5 style="margin: 0 0 10px 0; color: #4a90e2;"><i class="fas fa-compact-disc"></i> Top Albums by Plays</h5>
            ${renderCompactList(popularAlbumsByPlays, 'plays')}
        </div>
        
        <!-- Popular Artists by Plays -->
        <div style="background: white; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <h5 style="margin: 0 0 10px 0; color: #4a90e2;"><i class="fas fa-microphone"></i> Top Artists by Plays</h5>
            ${renderCompactList(popularArtistsByPlays, 'plays')}
        </div>
    </div>
    
    <!-- Top Charts -->
    <h3 style="margin: 20px 0 10px; font-size: 1.1rem;"><i class="fas fa-trophy" style="color: #ff5500;"></i> Top Charts</h3>
    
    <!-- Top Songs -->
    <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="font-size: 1rem;"><i class="fas fa-music" style="color: #ff5500;"></i> Top Songs</h4>
            <span style="font-size: 0.8rem; color: #666;">Plays / Views / Downloads</span>
        </div>
        ${generateTopListMobile(topSongs, 'song')}
    </div>
    
    <!-- Top Albums -->
    <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="font-size: 1rem;"><i class="fas fa-compact-disc" style="color: #ff5500;"></i> Top Albums</h4>
            <span style="font-size: 0.8rem; color: #666;">Plays / Views</span>
        </div>
        ${generateTopListMobile(topAlbums, 'album')}
    </div>
    
    <!-- Top Artists -->
    <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="font-size: 1rem;"><i class="fas fa-microphone" style="color: #ff5500;"></i> Top Artists</h4>
            <span style="font-size: 0.8rem; color: #666;">Monthly Listeners</span>
        </div>
        ${generateTopListMobile(topArtists, 'artist')}
    </div>
    
    <!-- Top Playlists -->
    <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="font-size: 1rem;"><i class="fas fa-list" style="color: #ff5500;"></i> Top Playlists</h4>
            <span style="font-size: 0.8rem; color: #666;">Plays / Views</span>
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
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 12px;">
            <div style="font-size: 0.8rem; opacity: 0.9;">Avg Plays per Song</div>
            <div style="font-size: 1.8rem; font-weight: 700;">${totalSongs ? Math.round(playsDownloadsSummary.total.plays / totalSongs) : 0}</div>
        </div>
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px; border-radius: 12px;">
            <div style="font-size: 0.8rem; opacity: 0.9;">Avg Downloads per Song</div>
            <div style="font-size: 1.8rem; font-weight: 700;">${totalSongs ? Math.round(playsDownloadsSummary.total.downloads / totalSongs) : 0}</div>
        </div>
    </div>
  `;
}

// Helper to render compact list for popular items
function renderCompactList(items, type) {
  if (!items || items.length === 0) {
    return '<p style="color: #666; text-align: center; padding: 10px;">No data</p>';
  }
  
  return items.map((item, index) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="width: 20px; height: 20px; background: ${index < 3 ? '#ff5500' : '#f0f0f0'}; color: ${index < 3 ? 'white' : '#666'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600;">${index + 1}</span>
            <span style="font-size: 0.8rem;">${item.item_id}</span>
        </div>
        <span style="font-weight: 600; color: ${type === 'plays' ? '#4a90e2' : '#28a745'};">
            ${type === 'plays' ? '▶️' : '⬇️'} ${formatNumber(item[type])}
        </span>
    </div>
  `).join('');
}

// Mobile-friendly top list generator
function generateTopListMobile(items, type) {
  if (items.length === 0) {
    return '<p style="color: #666; text-align: center; padding: 10px;">No data available</p>';
  }
  
  return items.map((item, index) => {
    let title = '';
    let subtitle = '';
    let plays = '';
    let views = '';
    let downloads = '';
    
    switch (type) {
      case 'song':
        title = item.name;
        subtitle = item.artist;
        plays = formatNumber(item.plays);
        views = formatNumber(item.views);
        downloads = formatNumber(item.downloads);
        break;
      case 'album':
        title = item.title;
        subtitle = item.artist;
        plays = formatNumber(item.plays);
        views = formatNumber(item.views);
        downloads = formatNumber(item.downloads);
        break;
      case 'artist':
        title = item.name;
        subtitle = `${item.songs} songs • ${item.albums} albums`;
        plays = formatNumber(item.monthlyListeners);
        views = formatNumber(item.views);
        downloads = formatNumber(item.downloads);
        break;
      case 'playlist':
        title = item.title;
        subtitle = `by ${item.curator}`;
        plays = formatNumber(item.plays);
        views = formatNumber(item.views);
        downloads = formatNumber(item.downloads);
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
          <div style="text-align: right;">
              <span style="font-size: 0.8rem; color: #4a90e2; font-weight: 600; background: #e6f0ff; padding: 3px 8px; border-radius: 20px; white-space: nowrap;">▶️ ${plays}</span>
              <span style="font-size: 0.7rem; color: #28a745; display: block; margin-top: 2px;">⬇️ ${downloads}</span>
              <span style="font-size: 0.7rem; color: #ff5500; display: block;">👁️ ${views}</span>
          </div>
      </div>
    `;
  }).join('');
}

// Helper function for page icons
function getPageIcon(type) {
  const icons = {
    'song': '🎵',
    'album': '💿',
    'artist': '🎤',
    'playlist': '📋'
  };
  return icons[type] || '📄';
}

// Render song stats with today views
async function renderSongStats(env, songs) {
  const artists = await getArtists(env);
  
  const songData = await Promise.all(
    songs.map(async (song) => {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const stats = await getSongStats(baseName, env);
      const meta = await getMetadata(env, baseName);
      const totalViews = await getPageViews(env, 'song', baseName, 'total');
      const todayViews = await getPageViews(env, 'song', baseName, 'today');
      const totalPlays = await getPlaysForPeriod(env, 'song', baseName, 'total');
      const todayPlays = await getPlaysForPeriod(env, 'song', baseName, 'today');
      const totalDownloads = await getDownloadsForPeriod(env, 'song', baseName, 'total');
      const todayDownloads = await getDownloadsForPeriod(env, 'song', baseName, 'today');
      
      return {
        name: meta?.title || baseName,
        artist: meta?.primaryArtist ? (artists[meta.primaryArtist]?.name || meta.primaryArtist) : baseName.split('_')[0],
        plays: totalPlays || stats.plays,
        downloads: totalDownloads || stats.downloads,
        views: totalViews,
        todayPlays,
        todayDownloads,
        todayViews,
        uploaded: new Date(song.uploaded).toLocaleDateString()
      };
    })
  );
  
  songData.sort((a, b) => b.plays - a.plays);
  
  const totalPlays = songData.reduce((acc, s) => acc + s.plays, 0);
  const totalDownloads = songData.reduce((acc, s) => acc + s.downloads, 0);
  const totalViews = songData.reduce((acc, s) => acc + s.views, 0);
  const totalTodayPlays = songData.reduce((acc, s) => acc + s.todayPlays, 0);
  const totalTodayDownloads = songData.reduce((acc, s) => acc + s.todayDownloads, 0);
  const totalTodayViews = songData.reduce((acc, s) => acc + s.todayViews, 0);
  
  return `
    <!-- Stats Cards -->
    <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
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
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Today's Plays</h3>
            <div class="number" style="font-size: 1.5rem; color: #4a90e2;">${formatNumber(totalTodayPlays)}</div>
        </div>
        <div class="stat-card" style="padding: 12px;">
            <h3 style="font-size: 0.7rem;">Today's Downloads</h3>
            <div class="number" style="font-size: 1.5rem; color: #28a745;">${formatNumber(totalTodayDownloads)}</div>
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
                    <span style="font-size: 0.8rem;"><i class="fas fa-play" style="color: #4a90e2;"></i> ${formatNumber(song.plays)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-download" style="color: #28a745;"></i> ${formatNumber(song.downloads)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-eye" style="color: #ff5500;"></i> ${formatNumber(song.views)}</span>
                    ${song.todayPlays > 0 ? `<span style="font-size: 0.7rem; background: #4a90e2; color: white; padding: 2px 8px; border-radius: 20px;">▶️ ${song.todayPlays} today</span>` : ''}
                    ${song.todayDownloads > 0 ? `<span style="font-size: 0.7rem; background: #28a745; color: white; padding: 2px 8px; border-radius: 20px;">⬇️ ${song.todayDownloads} today</span>` : ''}
                </div>
            </div>
        `).join('')}
        ${songData.length === 0 ? '<p style="text-align: center; color: #666;">No songs found</p>' : ''}
    </div>
  `;
}

// Render album stats with today views
async function renderAlbumStats(env, albums) {
  const artists = await getArtists(env);
  
  const albumData = await Promise.all(
    Object.entries(albums).map(async ([id, album]) => {
      const stats = await getAggregatedStats(album.songs || [], env);
      const primaryArtist = album.artists?.length ? (artists[album.artists[0]]?.name || album.artists[0]) : 'Various';
      const totalViews = await getPageViews(env, 'album', id, 'total');
      const todayViews = await getPageViews(env, 'album', id, 'today');
      const totalPlays = await getPlaysForPeriod(env, 'album', id, 'total');
      const todayPlays = await getPlaysForPeriod(env, 'album', id, 'today');
      const totalDownloads = await getDownloadsForPeriod(env, 'album', id, 'total');
      const todayDownloads = await getDownloadsForPeriod(env, 'album', id, 'today');
      
      return {
        title: album.title,
        artist: primaryArtist,
        songs: album.songs?.length || 0,
        plays: totalPlays || stats.plays,
        downloads: totalDownloads || stats.downloads,
        views: totalViews,
        todayPlays,
        todayDownloads,
        todayViews,
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
                    <span style="font-size: 0.8rem;"><i class="fas fa-play" style="color: #4a90e2;"></i> ${formatNumber(album.plays)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-download" style="color: #28a745;"></i> ${formatNumber(album.downloads)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-eye" style="color: #ff5500;"></i> ${formatNumber(album.views)}</span>
                    ${album.todayPlays > 0 ? `<span style="font-size: 0.7rem; background: #4a90e2; color: white; padding: 2px 8px; border-radius: 20px;">▶️ ${album.todayPlays} today</span>` : ''}
                </div>
            </div>
        `).join('')}
        ${albumData.length === 0 ? '<p style="text-align: center; color: #666;">No albums found</p>' : ''}
    </div>
  `;
}

// Render artist stats with today views
async function renderArtistStats(env, artists) {
  const artistData = await Promise.all(
    Object.entries(artists).map(async ([id, artist]) => {
      const stats = await getAggregatedStats(artist.songs || [], env);
      const monthlyListeners = Math.floor(stats.plays * 0.3);
      const totalViews = await getPageViews(env, 'artist', id, 'total');
      const todayViews = await getPageViews(env, 'artist', id, 'today');
      const totalPlays = await getPlaysForPeriod(env, 'artist', id, 'total');
      const todayPlays = await getPlaysForPeriod(env, 'artist', id, 'today');
      const totalDownloads = await getDownloadsForPeriod(env, 'artist', id, 'total');
      const todayDownloads = await getDownloadsForPeriod(env, 'artist', id, 'today');
      
      return {
        name: artist.name,
        songs: artist.songs?.length || 0,
        albums: artist.albums?.length || 0,
        plays: totalPlays || stats.plays,
        downloads: totalDownloads || stats.downloads,
        views: totalViews,
        todayPlays,
        todayDownloads,
        todayViews,
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
                    <span style="font-size: 0.8rem;"><i class="fas fa-play" style="color: #4a90e2;"></i> ${formatNumber(artist.plays)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-download" style="color: #28a745;"></i> ${formatNumber(artist.downloads)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-eye" style="color: #ff5500;"></i> ${formatNumber(artist.views)}</span>
                    <span style="font-size: 0.8rem; background: #9b59b6; color: white; padding: 2px 8px; border-radius: 20px;">${formatNumber(artist.monthlyListeners)} monthly</span>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 5px;">
                    ${artist.todayPlays > 0 ? `<span style="font-size: 0.7rem; background: #4a90e2; color: white; padding: 2px 8px; border-radius: 20px;">▶️ ${artist.todayPlays} today</span>` : ''}
                    ${artist.todayDownloads > 0 ? `<span style="font-size: 0.7rem; background: #28a745; color: white; padding: 2px 8px; border-radius: 20px;">⬇️ ${artist.todayDownloads} today</span>` : ''}
                </div>
            </div>
        `).join('')}
        ${artistData.length === 0 ? '<p style="text-align: center; color: #666;">No artists found</p>' : ''}
    </div>
  `;
}

// Render playlist stats with today views
async function renderPlaylistStats(env, playlists) {
  const playlistData = await Promise.all(
    Object.entries(playlists).map(async ([id, playlist]) => {
      const stats = await getAggregatedStats(playlist.songs || [], env);
      const totalViews = await getPageViews(env, 'playlist', id, 'total');
      const todayViews = await getPageViews(env, 'playlist', id, 'today');
      const totalPlays = await getPlaysForPeriod(env, 'playlist', id, 'total');
      const todayPlays = await getPlaysForPeriod(env, 'playlist', id, 'today');
      const totalDownloads = await getDownloadsForPeriod(env, 'playlist', id, 'total');
      const todayDownloads = await getDownloadsForPeriod(env, 'playlist', id, 'today');
      
      return {
        title: playlist.title,
        curator: playlist.curator || 'ZEDALBUMS',
        songs: playlist.songs?.length || 0,
        plays: totalPlays || stats.plays,
        downloads: totalDownloads || stats.downloads,
        views: totalViews,
        todayPlays,
        todayDownloads,
        todayViews,
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
                    <span style="font-size: 0.8rem;"><i class="fas fa-play" style="color: #4a90e2;"></i> ${formatNumber(playlist.plays)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-download" style="color: #28a745;"></i> ${formatNumber(playlist.downloads)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-eye" style="color: #ff5500;"></i> ${formatNumber(playlist.views)}</span>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 5px;">
                    ${playlist.todayPlays > 0 ? `<span style="font-size: 0.7rem; background: #4a90e2; color: white; padding: 2px 8px; border-radius: 20px;">▶️ ${playlist.todayPlays} today</span>` : ''}
                    ${playlist.todayDownloads > 0 ? `<span style="font-size: 0.7rem; background: #28a745; color: white; padding: 2px 8px; border-radius: 20px;">⬇️ ${playlist.todayDownloads} today</span>` : ''}
                </div>
            </div>
        `).join('')}
        ${playlistData.length === 0 ? '<p style="text-align: center; color: #666;">No playlists found</p>' : ''}
    </div>
  `;
}