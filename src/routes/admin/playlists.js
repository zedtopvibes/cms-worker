// ==================== ADMIN PLAYLISTS MANAGEMENT ==================== 
import { getPlaylists, savePlaylists, getArtists, getAlbums, getMetadata } from '../../helpers/storage.js';
import { getAggregatedStats } from '../../helpers/db.js';
import { getPageViews } from '../../helpers/pageViews.js';
import { sanitize, formatNumber } from '../../helpers/formatting.js';

export async function handleAdminPlaylists(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') || '';
  const sort = url.searchParams.get('sort') || 'date';
  const ITEMS_PER_PAGE = 20;

  // Get all playlists
  const playlists = await getPlaylists(env);
  const artists = await getArtists(env);
  
  // Get detailed playlist data with views
  let playlistsData = await Promise.all(
    Object.entries(playlists).map(async ([id, playlist]) => {
      const stats = await getAggregatedStats(playlist.songs || [], env);
      const pageViews = await getPageViews(env, 'playlist', id);
      
      // Get featured artists count
      const uniqueArtists = new Set();
      if (playlist.songs) {
        for (const songKey of playlist.songs) {
          const [artistId] = songKey.split('_');
          uniqueArtists.add(artistId);
        }
      }
      
      return {
        id,
        title: playlist.title,
        description: playlist.description || '',
        curator: playlist.curator || 'ZEDALBUMS',
        thumbnail: playlist.thumbnail,
        songs: playlist.songs || [],
        songCount: playlist.songs?.length || 0,
        artistCount: uniqueArtists.size,
        plays: stats.plays,
        downloads: stats.downloads,
        views: pageViews,
        created: playlist.created,
        updated: playlist.updated || playlist.created,
        hasImage: !!playlist.thumbnail
      };
    })
  );

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    playlistsData = playlistsData.filter(playlist => 
      playlist.title.toLowerCase().includes(searchLower) ||
      playlist.curator.toLowerCase().includes(searchLower) ||
      playlist.description.toLowerCase().includes(searchLower)
    );
  }

  // Apply sorting with views
  playlistsData.sort((a, b) => {
    switch (sort) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'curator':
        return a.curator.localeCompare(b.curator);
      case 'songs':
        return b.songCount - a.songCount;
      case 'artists':
        return b.artistCount - a.artistCount;
      case 'plays':
        return b.plays - a.plays;
      case 'views':
        return (b.views || 0) - (a.views || 0);
      case 'updated':
        return b.updated - a.updated;
      case 'date':
      default:
        return b.created - a.created;
    }
  });

  // Pagination
  const totalPlaylists = playlistsData.length;
  const totalPages = Math.ceil(totalPlaylists / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const pagePlaylists = playlistsData.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Sort options with views
  const sortOptions = [
    { value: 'date', label: 'Date Created' },
    { value: 'updated', label: 'Last Updated' },
    { value: 'title', label: 'Title' },
    { value: 'curator', label: 'Curator' },
    { value: 'songs', label: 'Most Songs' },
    { value: 'artists', label: 'Most Artists' },
    { value: 'plays', label: 'Most Plays' },
    { value: 'views', label: 'Most Viewed' }
  ];

  // Calculate totals
  const totalSongs = playlistsData.reduce((acc, p) => acc + p.songCount, 0);
  const totalArtists = playlistsData.reduce((acc, p) => acc + p.artistCount, 0);
  const totalPlays = playlistsData.reduce((acc, p) => acc + p.plays, 0);
  const totalDownloads = playlistsData.reduce((acc, p) => acc + p.downloads, 0);
  const totalViews = playlistsData.reduce((acc, p) => acc + (p.views || 0), 0);

  const content = `
    <div style="margin-bottom: 20px;">
        <!-- Header -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
                <h2 style="margin:0; font-size:1.3rem;"><i class="fas fa-list"></i> Playlists Management</h2>
                <a href="/admin/playlist/create" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Create New Playlist
                </a>
            </div>
            
            <!-- Search and Filter -->
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                        <input type="text" id="searchInput" class="form-control" placeholder="Search playlists, curators..." 
                               value="${search}" style="padding-left: 40px;">
                    </div>
                </div>
                <select id="sortSelect" class="form-control" style="width: auto; min-width: 150px;">
                    ${sortOptions.map(opt => `
                        <option value="${opt.value}" ${sort === opt.value ? 'selected' : ''}>Sort by: ${opt.label}</option>
                    `).join('')}
                </select>
                <button onclick="applyFilters()" class="btn btn-primary">
                    <i class="fas fa-filter"></i> Apply
                </button>
            </div>
            
            <!-- Stats Summary with Views -->
            <div style="display: flex; gap: 15px; flex-wrap: wrap; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                <div><i class="fas fa-list" style="color: #4a90e2;"></i> Playlists: <strong>${totalPlaylists}</strong></div>
                <div><i class="fas fa-music" style="color: #4a90e2;"></i> Songs: <strong>${totalSongs}</strong></div>
                <div><i class="fas fa-users" style="color: #4a90e2;"></i> Artists: <strong>${totalArtists}</strong></div>
                <div><i class="fas fa-play" style="color: #4a90e2;"></i> Plays: <strong>${formatNumber(totalPlays)}</strong></div>
                <div><i class="fas fa-eye" style="color: #4a90e2;"></i> Views: <strong>${formatNumber(totalViews)}</strong></div>
            </div>
        </div>
        
        <!-- Mobile Cards -->
        <div class="mobile-cards">
            ${pagePlaylists.map(playlist => generateMobileCard(playlist)).join('')}
            ${pagePlaylists.length === 0 ? `
                <div class="empty-state">
                    <i class="fas fa-list"></i>
                    <h3>No playlists found</h3>
                    <p>Try adjusting your search or create a new playlist</p>
                    <a href="/admin/playlist/create" class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Create New Playlist
                    </a>
                </div>
            ` : ''}
        </div>
        
        <!-- Desktop Grid -->
        <div class="playlists-grid" style="display: none;">
            ${pagePlaylists.map(playlist => generateGridCard(playlist)).join('')}
        </div>
        
        <!-- Pagination -->
        ${generatePagination(page, totalPages, search, sort)}
    </div>
    
    <style>
        .playlists-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .playlist-grid-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            transition: transform 0.2s;
            border: 1px solid #e8e8e8;
        }
        
        .playlist-grid-card:hover {
            transform: translateY(-4px);
            border-color: #4a90e2;
        }
        
        .playlist-thumbnail {
            width: 100%;
            aspect-ratio: 1;
            background: linear-gradient(135deg, #4a90e2, #9013fe);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 3rem;
        }
        
        .playlist-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .playlist-info {
            padding: 15px;
        }
        
        .playlist-title {
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 5px;
        }
        
        .playlist-curator {
            color: #4a90e2;
            font-size: 0.85rem;
            margin-bottom: 8px;
        }
        
        .playlist-stats {
            display: flex;
            gap: 12px;
            font-size: 0.8rem;
            color: #666;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        
        @media (min-width: 768px) {
            .mobile-cards { display: none; }
            .playlists-grid { display: grid !important; }
        }
    </style>
    
    <script>
        function applyFilters() {
            const search = document.getElementById('searchInput').value;
            const sort = document.getElementById('sortSelect').value;
            let url = '/admin/playlists?';
            if (search) url += 'search=' + encodeURIComponent(search) + '&';
            url += 'sort=' + sort;
            window.location.href = url;
        }
        
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') applyFilters();
        });
        
        window.viewPlaylist = function(id) { window.open('/playlist/' + id, '_blank'); };
        window.editPlaylist = function(id) { window.location.href = '/admin/playlists/edit?id=' + id; };
        window.manageSongs = function(id) { window.location.href = '/admin/playlists/songs?id=' + id; };
        window.deletePlaylist = function(id) {
            if (confirm('Delete this playlist?')) window.location.href = '/admin/playlists/delete?id=' + id;
        };
    </script>
  `;

  return content;
}

// Mobile card with views
function generateMobileCard(playlist) {
  const updated = new Date(playlist.updated).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short'
  });
  
  return `
    <div class="mobile-card">
        <div style="font-weight:700; margin-bottom:5px;">${playlist.title}</div>
        <div style="color:#4a90e2; margin-bottom:8px;">by ${playlist.curator}</div>
        <div style="display:flex; gap:15px; flex-wrap:wrap; margin-bottom:8px;">
            <span><i class="fas fa-music"></i> ${playlist.songCount} songs</span>
            <span><i class="fas fa-users"></i> ${playlist.artistCount} artists</span>
            <span><i class="fas fa-play" style="color:#ff5500;"></i> ${formatNumber(playlist.plays)}</span>
            <span><i class="fas fa-eye" style="color:#4a90e2;"></i> ${formatNumber(playlist.views || 0)}</span>
        </div>
        <div style="font-size:0.75rem; color:#999; margin-bottom:10px;">Updated ${updated}</div>
        <div style="display:flex; gap:8px;">
            <button onclick="editPlaylist('${playlist.id}')" class="btn btn-primary btn-sm" style="flex:1;">Edit</button>
            <button onclick="manageSongs('${playlist.id}')" class="btn btn-secondary btn-sm" style="flex:1;">Songs</button>
            <button onclick="deletePlaylist('${playlist.id}')" class="btn btn-danger btn-sm" style="flex:1;">Delete</button>
        </div>
    </div>
  `;
}

// Grid card with views
function generateGridCard(playlist) {
  const updated = new Date(playlist.updated).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short'
  });
  
  return `
    <div class="playlist-grid-card">
        <div class="playlist-thumbnail" onclick="viewPlaylist('${playlist.id}')">
            ${playlist.thumbnail ? `<img src="/playlists/thumbnails/${playlist.id}.jpg">` : '📋'}
        </div>
        <div class="playlist-info">
            <div class="playlist-title" onclick="viewPlaylist('${playlist.id}')">${playlist.title}</div>
            <div class="playlist-curator" onclick="viewPlaylist('${playlist.id}')">by ${playlist.curator}</div>
            <div class="playlist-stats">
                <span><i class="fas fa-music"></i> ${playlist.songCount}</span>
                <span><i class="fas fa-users"></i> ${playlist.artistCount}</span>
                <span><i class="fas fa-play"></i> ${formatNumber(playlist.plays)}</span>
                <span><i class="fas fa-eye" style="color:#4a90e2;"></i> ${formatNumber(playlist.views || 0)}</span>
            </div>
            <div style="font-size:0.75rem; color:#999; margin-top:5px;">Updated ${updated}</div>
            <div style="display:flex; gap:8px; margin-top:12px;">
                <button onclick="editPlaylist('${playlist.id}')" class="btn btn-primary btn-sm" style="flex:1;">Edit</button>
                <button onclick="manageSongs('${playlist.id}')" class="btn btn-secondary btn-sm" style="flex:1;">Songs</button>
                <button onclick="deletePlaylist('${playlist.id}')" class="btn btn-danger btn-sm" style="flex:1;">Delete</button>
            </div>
        </div>
    </div>
  `;
}

// Pagination helper (same as songs.js)
function generatePagination(currentPage, totalPages, search, sort) {
  if (totalPages <= 1) return '';
  let html = '<div class="pagination" style="margin-top: 30px; justify-content: center;">';
  if (currentPage > 1) {
    html += `<a href="?page=${currentPage-1}&search=${encodeURIComponent(search)}&sort=${sort}" class="pagination-item pagination-prev"><i class="fas fa-chevron-left"></i> Prev</a>`;
  } else {
    html += `<span class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</span>`;
  }
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<a href="?page=${i}&search=${encodeURIComponent(search)}&sort=${sort}" class="pagination-item ${i === currentPage ? 'active' : ''}">${i}</a>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }
  if (currentPage < totalPages) {
    html += `<a href="?page=${currentPage+1}&search=${encodeURIComponent(search)}&sort=${sort}" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>`;
  } else {
    html += `<span class="pagination-item pagination-next disabled">Next <i class="fas fa-chevron-right"></i></span>`;
  }
  html += '</div>';
  return html;
}