// ==================== ADMIN STATISTICS - ENHANCED WITH DAILY/WEEKLY/MONTHLY VIEWS ====================
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
import { formatNumber, formatDuration } from '../../helpers/formatting.js';

export async function handleAdminStats(req, env, ctx, auth) {
  const url = new URL(req.url);
  const view = url.searchParams.get('view') || 'overview';
  const period = url.searchParams.get('period') || 'week';
  
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
  
  // ===== ENHANCED PAGE VIEWS STATS =====
  const viewsSummary = await getViewsSummary(env);
  const chartData = await getViewsChartData(env, period);
  const trends = await getViewTrends(env, null, null);
  
  // Get popular pages by different periods
  const popularToday = await getPopularPages(env, 5, null, 'today');
  const popularThisWeek = await getPopularPages(env, 5, null, 'week');
  const popularThisMonth = await getPopularPages(env, 5, null, 'month');
  const popularAllTime = await getPopularPages(env, 5, null, 'total');
  
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
        viewsSummary, chartData, trends, period,
        popularToday, popularThisWeek, popularThisMonth, popularAllTime
      );
      break;
  }
  
  // View tabs with period selector
  const tabs = `
    <div style="margin-bottom: 20px;">
        <div style="display: flex; gap: 8px; margin-bottom: 10px; overflow-x: auto; padding: 5px 0 10px; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
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
        
        <!-- Period Selector (for overview) -->
        ${view === 'overview' ? `
        <div style="display: flex; gap: 5px; overflow-x: auto; padding: 5px 0;">
            <a href="/admin/stats?view=overview&period=day" class="btn btn-sm ${period === 'day' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">Daily</a>
            <a href="/admin/stats?view=overview&period=week" class="btn btn-sm ${period === 'week' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">Weekly</a>
            <a href="/admin/stats?view=overview&period=month" class="btn btn-sm ${period === 'month' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">Monthly</a>
            <a href="/admin/stats?view=overview&period=year" class="btn btn-sm ${period === 'year' ? 'btn-primary' : 'btn-secondary'}" style="white-space: nowrap;">Yearly</a>
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
      
      return {
        name: meta?.title || baseName,
        artist: meta?.primaryArtist ? (artists[meta.primaryArtist]?.name || meta.primaryArtist) : baseName.split('_')[0],
        plays: stats.plays,
        downloads: stats.downloads,
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
      
      return {
        id,
        title: album.title,
        artist: primaryArtist,
        plays: stats.plays,
        downloads: stats.downloads,
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
      
      return {
        id,
        name: artist.name,
        plays: stats.plays,
        downloads: stats.downloads,
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
      
      return {
        id,
        title: playlist.title,
        curator: playlist.curator || 'ZEDALBUMS',
        plays: stats.plays,
        downloads: stats.downloads,
        views,
        songs: playlist.songs?.length || 0
      };
    })
  );
  
  return playlistData.sort((a, b) => b.plays - a.plays).slice(0, limit);
}

// Render overview stats - ENHANCED WITH CHARTS
function renderOverview(
  totalSongs, albums, artists, playlists, totalStats, totalStorage, 
  topSongs, topAlbums, topArtists, topPlaylists, recentSongs,
  viewsSummary, chartData, trends, period,
  popularToday, popularThisWeek, popularThisMonth, popularAllTime
) {
  // Determine chart labels based on period
  const chartLabels = chartData.labels || [];
  const chartValues = chartData.data || [];
  
  // Calculate max value for chart scaling
  const maxValue = Math.max(...chartValues, 1);
  
  // Format period label
  const periodLabel = period === 'day' ? 'Hourly' : period === 'week' ? 'Daily' : period === 'month' ? 'Weekly' : 'Monthly';
  
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
    
    <!-- ===== ENHANCED PAGE VIEWS SECTION WITH CHART ===== -->
    <div style="background: white; border-radius: 12px; padding: 15px; margin: 15px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <h4 style="font-size: 1rem;"><i class="fas fa-eye" style="color: #ff5500;"></i> Page Views</h4>
            <div style="display: flex; gap: 10px;">
                <span style="background: #ff5500; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                    Total: ${formatNumber(viewsSummary.totalViews)}
                </span>
            </div>
        </div>
        
        <!-- Mini Stats Cards -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 20px;">
            <div style="background: #e7f5ff; padding: 10px; border-radius: 8px;">
                <div style="font-size: 0.7rem; color: #004085;">Today</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: #004085;">${formatNumber(viewsSummary.todayViews)}</div>
                ${trends ? `
                    <div style="font-size: 0.65rem; color: ${trends.dailyChange >= 0 ? '#28a745' : '#dc3545'};">
                        ${trends.dailyChange >= 0 ? '↑' : '↓'} ${Math.abs(trends.dailyChangePercent)}% from yesterday
                    </div>
                ` : ''}
            </div>
            <div style="background: #fff3cd; padding: 10px; border-radius: 8px;">
                <div style="font-size: 0.7rem; color: #856404;">This Week</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: #856404;">${formatNumber(viewsSummary.weekViews)}</div>
                ${trends ? `
                    <div style="font-size: 0.65rem; color: ${trends.weeklyChange >= 0 ? '#28a745' : '#dc3545'};">
                        ${trends.weeklyChange >= 0 ? '↑' : '↓'} ${Math.abs(trends.weeklyChangePercent)}% from last week
                    </div>
                ` : ''}
            </div>
            <div style="background: #d4edda; padding: 10px; border-radius: 8px;">
                <div style="font-size: 0.7rem; color: #155724;">This Month</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: #155724;">${formatNumber(viewsSummary.monthViews)}</div>
                ${trends ? `
                    <div style="font-size: 0.65rem; color: ${trends.monthlyChange >= 0 ? '#28a745' : '#dc3545'};">
                        ${trends.monthlyChange >= 0 ? '↑' : '↓'} ${Math.abs(trends.monthlyChangePercent)}% from last month
                    </div>
                ` : ''}
            </div>
            <div style="background: #f8d7da; padding: 10px; border-radius: 8px;">
                <div style="font-size: 0.7rem; color: #721c24;">Avg/Item</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: #721c24;">
                    ${viewsSummary.byType.length ? formatNumber(Math.round(viewsSummary.totalViews / viewsSummary.byType.reduce((acc, t) => acc + t.count, 0))) : 0}
                </div>
                <div style="font-size: 0.65rem; color: #721c24;">per item</div>
            </div>
        </div>
        
        <!-- Simple Chart (Bar Graph) -->
        ${chartLabels.length > 0 ? `
        <div style="margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 0.8rem; font-weight: 600;">${periodLabel} Views</span>
                <span style="font-size: 0.7rem; color: #666;">Last ${chartLabels.length} ${period === 'day' ? 'hours' : period === 'week' ? 'days' : period === 'month' ? 'weeks' : 'months'}</span>
            </div>
            <div style="display: flex; align-items: flex-end; gap: 3px; height: 120px; margin: 10px 0;">
                ${chartValues.map((value, i) => {
                    const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                    let label = chartLabels[i];
                    // Format label for display
                    if (period === 'week') {
                        label = label.split('-').pop(); // Show just day for weekly
                    } else if (period === 'month') {
                        label = 'W' + label.split('-').pop(); // Show week number
                    } else if (period === 'year') {
                        label = label.split('-')[1]; // Show month
                    }
                    return `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px;">
                            <div style="width: 100%; background: #ff5500; height: ${height}%; min-height: 2px; border-radius: 4px 4px 0 0;"></div>
                            <span style="font-size: 0.6rem; color: #666; transform: rotate(-45deg); white-space: nowrap;">${label}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        ` : ''}
        
        <!-- Views by Type -->
        <div style="margin: 15px 0;">
            <h5 style="margin: 0 0 8px; font-size: 0.9rem;">Views by Type</h5>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                ${viewsSummary.byType.map(type => `
                    <div style="background: #f8f9fa; padding: 8px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.7rem; color: #666;">${getPageIcon(type.page_type)} ${type.page_type}s</div>
                        <div style="font-weight: 700; color: #ff5500;">${formatNumber(type.total)}</div>
                        <div style="font-size: 0.6rem; color: #999;">${type.count} items</div>
                    </div>
                `).join('')}
                ${viewsSummary.byType.length === 0 ? `
                    <div style="grid-column: span 2; text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-eye-slash"></i> No page views yet
                    </div>
                ` : ''}
            </div>
        </div>
        
        <!-- Popular Pages Tabs -->
        <div style="margin: 15px 0;">
            <div style="display: flex; gap: 5px; overflow-x: auto; padding: 5px 0; margin-bottom: 10px;">
                <button class="tab-btn active" onclick="showPopularTab('today')" id="tab-today" style="padding: 6px 12px; white-space: nowrap;">Today</button>
                <button class="tab-btn" onclick="showPopularTab('week')" id="tab-week" style="padding: 6px 12px; white-space: nowrap;">This Week</button>
                <button class="tab-btn" onclick="showPopularTab('month')" id="tab-month" style="padding: 6px 12px; white-space: nowrap;">This Month</button>
                <button class="tab-btn" onclick="showPopularTab('all')" id="tab-all" style="padding: 6px 12px; white-space: nowrap;">All Time</button>
            </div>
            
            <!-- Today's Popular -->
            <div id="popular-today" style="display: block;">
                ${renderPopularList(popularToday, 'today')}
            </div>
            
            <!-- This Week's Popular (hidden by default) -->
            <div id="popular-week" style="display: none;">
                ${renderPopularList(popularThisWeek, 'week')}
            </div>
            
            <!-- This Month's Popular (hidden by default) -->
            <div id="popular-month" style="display: none;">
                ${renderPopularList(popularThisMonth, 'month')}
            </div>
            
            <!-- All Time Popular (hidden by default) -->
            <div id="popular-all" style="display: none;">
                ${renderPopularList(popularAllTime, 'all')}
            </div>
        </div>
        
        <script>
            function showPopularTab(period) {
                // Hide all
                document.getElementById('popular-today').style.display = 'none';
                document.getElementById('popular-week').style.display = 'none';
                document.getElementById('popular-month').style.display = 'none';
                document.getElementById('popular-all').style.display = 'none';
                
                // Show selected
                document.getElementById('popular-' + period).style.display = 'block';
                
                // Update active tab
                document.querySelectorAll('[id^="tab-"]').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.getElementById('tab-' + period).classList.add('active');
            }
        </script>
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
            <span style="font-size: 0.8rem; color: #666;">Monthly Listeners</span>
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
            <div style="font-size: 0.8rem; opacity: 0.9;">Average Views per Item</div>
            <div style="font-size: 1.8rem; font-weight: 700;">
                ${(totalSongs + Object.keys(albums).length + Object.keys(artists).length + Object.keys(playlists).length) > 0 
                    ? formatNumber(Math.round(viewsSummary.totalViews / (totalSongs + Object.keys(albums).length + Object.keys(artists).length + Object.keys(playlists).length))) 
                    : 0}
            </div>
        </div>
    </div>
  `;
}

// Helper to render popular list
function renderPopularList(popularPages, period) {
  if (popularPages.length === 0) {
    return `<p style="text-align: center; color: #666; padding: 15px;">No views for this period</p>`;
  }
  
  return popularPages.map(page => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
            <span>${getPageIcon(page.page_type)}</span>
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${page.page_id}
                </div>
                <div style="font-size: 0.6rem; color: #666;">${page.page_type}</div>
            </div>
        </div>
        <span style="font-weight: 600; color: #ff5500; font-size: 0.8rem; white-space: nowrap; margin-left: 8px;">
            ${formatNumber(page.views)}
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
    let value = '';
    let secondaryValue = '';
    
    switch (type) {
      case 'song':
        title = item.name;
        subtitle = item.artist;
        value = formatNumber(item.plays);
        secondaryValue = formatNumber(item.views);
        break;
      case 'album':
        title = item.title;
        subtitle = item.artist;
        value = formatNumber(item.plays);
        secondaryValue = formatNumber(item.views);
        break;
      case 'artist':
        title = item.name;
        subtitle = `${item.songs} songs • ${item.albums} albums`;
        value = formatNumber(item.monthlyListeners);
        secondaryValue = formatNumber(item.views);
        break;
      case 'playlist':
        title = item.title;
        subtitle = `by ${item.curator}`;
        value = formatNumber(item.plays);
        secondaryValue = formatNumber(item.views);
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
              <span style="font-size: 0.8rem; color: #ff5500; font-weight: 600; background: #fff0e6; padding: 3px 8px; border-radius: 20px; white-space: nowrap;">${value}</span>
              <span style="font-size: 0.7rem; color: #4a90e2; display: block; margin-top: 2px;">👁️ ${secondaryValue}</span>
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
      const weekViews = await getPageViews(env, 'song', baseName, 'week');
      
      return {
        name: meta?.title || baseName,
        artist: meta?.primaryArtist ? (artists[meta.primaryArtist]?.name || meta.primaryArtist) : baseName.split('_')[0],
        plays: stats.plays,
        downloads: stats.downloads,
        views: totalViews,
        todayViews,
        weekViews,
        uploaded: new Date(song.uploaded).toLocaleDateString()
      };
    })
  );
  
  songData.sort((a, b) => b.plays - a.plays);
  
  const totalPlays = songData.reduce((acc, s) => acc + s.plays, 0);
  const totalDownloads = songData.reduce((acc, s) => acc + s.downloads, 0);
  const totalViews = songData.reduce((acc, s) => acc + s.views, 0);
  const totalTodayViews = songData.reduce((acc, s) => acc + s.todayViews, 0);
  
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
    
    <!-- Today's Activity -->
    <div style="background: linear-gradient(135deg, #ff5500, #ff8c00); color: white; padding: 12px; border-radius: 12px; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span><i class="fas fa-sun"></i> Today's Views</span>
            <span style="font-weight: 700;">${formatNumber(totalTodayViews)}</span>
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
                    ${song.todayViews > 0 ? `<span style="font-size: 0.7rem; background: #ff5500; color: white; padding: 2px 8px; border-radius: 20px;">🔥 ${song.todayViews} today</span>` : ''}
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
      const weekViews = await getPageViews(env, 'album', id, 'week');
      
      return {
        title: album.title,
        artist: primaryArtist,
        songs: album.songs?.length || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        views: totalViews,
        todayViews,
        weekViews,
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
                    ${album.todayViews > 0 ? `<span style="font-size: 0.7rem; background: #ff5500; color: white; padding: 2px 8px; border-radius: 20px;">🔥 ${album.todayViews} today</span>` : ''}
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
      
      return {
        name: artist.name,
        songs: artist.songs?.length || 0,
        albums: artist.albums?.length || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        views: totalViews,
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
                    <span style="font-size: 0.8rem;"><i class="fas fa-play" style="color: #ff5500;"></i> ${formatNumber(artist.plays)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-download" style="color: #ff5500;"></i> ${formatNumber(artist.downloads)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-eye" style="color: #4a90e2;"></i> ${formatNumber(artist.views)}</span>
                    <span style="font-size: 0.8rem; background: #9b59b6; color: white; padding: 2px 8px; border-radius: 20px;">${formatNumber(artist.monthlyListeners)} monthly</span>
                    ${artist.todayViews > 0 ? `<span style="font-size: 0.7rem; background: #ff5500; color: white; padding: 2px 8px; border-radius: 20px;">🔥 ${artist.todayViews} today</span>` : ''}
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
      
      return {
        title: playlist.title,
        curator: playlist.curator || 'ZEDALBUMS',
        songs: playlist.songs?.length || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        views: totalViews,
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
                    <span style="font-size: 0.8rem;"><i class="fas fa-play" style="color: #ff5500;"></i> ${formatNumber(playlist.plays)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-download" style="color: #ff5500;"></i> ${formatNumber(playlist.downloads)}</span>
                    <span style="font-size: 0.8rem;"><i class="fas fa-eye" style="color: #4a90e2;"></i> ${formatNumber(playlist.views)}</span>
                    ${playlist.todayViews > 0 ? `<span style="font-size: 0.7rem; background: #ff5500; color: white; padding: 2px 8px; border-radius: 20px;">🔥 ${playlist.todayViews} today</span>` : ''}
                </div>
            </div>
        `).join('')}
        ${playlistData.length === 0 ? '<p style="text-align: center; color: #666;">No playlists found</p>' : ''}
    </div>
  `;
}