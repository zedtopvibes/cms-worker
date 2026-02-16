// ==================== ADMIN ARTISTS MANAGEMENT ==================== 
import { getArtists, saveArtists, getAlbums } from '../../helpers/storage.js';
import { getAggregatedStats } from '../../helpers/db.js';
import { getPageViews } from '../../helpers/pageViews.js';
import { sanitize, formatNumber } from '../../helpers/formatting.js';

export async function handleAdminArtists(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') || '';
  const sort = url.searchParams.get('sort') || 'name';
  const ITEMS_PER_PAGE = 20;

  // Get all artists
  const artists = await getArtists(env);
  const albums = await getAlbums(env);
  
  // Get detailed artist data with views
  let artistsData = await Promise.all(
    Object.entries(artists).map(async ([id, artist]) => {
      const stats = await getAggregatedStats(artist.songs || [], env);
      const pageViews = await getPageViews(env, 'artist', id);
      
      // Get album count
      const albumCount = artist.albums?.length || 0;
      
      // Get monthly listeners (estimate based on plays)
      const monthlyListeners = Math.floor(stats.plays * 0.3);
      
      return {
        id,
        name: artist.name,
        description: artist.description || '',
        genre: artist.genre || 'Various',
        thumbnail: artist.thumbnail,
        songCount: artist.songs?.length || 0,
        albumCount,
        plays: stats.plays,
        downloads: stats.downloads,
        views: pageViews,
        monthlyListeners,
        created: artist.created,
        hasImage: !!artist.thumbnail
      };
    })
  );

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    artistsData = artistsData.filter(artist => 
      artist.name.toLowerCase().includes(searchLower) ||
      artist.genre.toLowerCase().includes(searchLower) ||
      artist.description.toLowerCase().includes(searchLower)
    );
  }

  // Apply sorting with views
  artistsData.sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'songs':
        return b.songCount - a.songCount;
      case 'albums':
        return b.albumCount - a.albumCount;
      case 'plays':
        return b.plays - a.plays;
      case 'listeners':
        return b.monthlyListeners - a.monthlyListeners;
      case 'views':
        return (b.views || 0) - (a.views || 0);
      case 'date':
        return b.created - a.created;
      default:
        return a.name.localeCompare(b.name);
    }
  });

  // Pagination
  const totalArtists = artistsData.length;
  const totalPages = Math.ceil(totalArtists / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const pageArtists = artistsData.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Sort options with views
  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'songs', label: 'Most Songs' },
    { value: 'albums', label: 'Most Albums' },
    { value: 'plays', label: 'Most Plays' },
    { value: 'listeners', label: 'Monthly Listeners' },
    { value: 'views', label: 'Most Viewed' },
    { value: 'date', label: 'Date Added' }
  ];

  // Calculate totals
  const totalSongs = artistsData.reduce((acc, a) => acc + a.songCount, 0);
  const totalAlbums = artistsData.reduce((acc, a) => acc + a.albumCount, 0);
  const totalPlays = artistsData.reduce((acc, a) => acc + a.plays, 0);
  const totalDownloads = artistsData.reduce((acc, a) => acc + a.downloads, 0);
  const totalViews = artistsData.reduce((acc, a) => acc + (a.views || 0), 0);
  const totalListeners = artistsData.reduce((acc, a) => acc + a.monthlyListeners, 0);

  const content = `
    <div style="margin-bottom: 20px;">
        <!-- Header -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
                <h2 style="margin:0; font-size:1.3rem;"><i class="fas fa-microphone"></i> Artists Management</h2>
                <a href="/admin/artist/create" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Create New Artist
                </a>
            </div>
            
            <!-- Search and Filter -->
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                        <input type="text" id="searchInput" class="form-control" placeholder="Search artists, genres..." 
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
                <div><i class="fas fa-microphone" style="color: #ff5500;"></i> Artists: <strong>${totalArtists}</strong></div>
                <div><i class="fas fa-music" style="color: #ff5500;"></i> Songs: <strong>${totalSongs}</strong></div>
                <div><i class="fas fa-compact-disc" style="color: #ff5500;"></i> Albums: <strong>${totalAlbums}</strong></div>
                <div><i class="fas fa-headphones" style="color: #9b59b6;"></i> Listeners: <strong>${formatNumber(totalListeners)}</strong></div>
                <div><i class="fas fa-eye" style="color: #4a90e2;"></i> Views: <strong>${formatNumber(totalViews)}</strong></div>
            </div>
        </div>
        
        <!-- Mobile Cards -->
        <div class="mobile-cards">
            ${pageArtists.map(artist => generateMobileCard(artist)).join('')}
            ${pageArtists.length === 0 ? `
                <div class="empty-state">
                    <i class="fas fa-microphone"></i>
                    <h3>No artists found</h3>
                    <p>Try adjusting your search or create a new artist</p>
                    <a href="/admin/artist/create" class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Create New Artist
                    </a>
                </div>
            ` : ''}
        </div>
        
        <!-- Desktop Grid -->
        <div class="artists-grid" style="display: none;">
            ${pageArtists.map(artist => generateGridCard(artist)).join('')}
        </div>
        
        <!-- Pagination -->
        ${generatePagination(page, totalPages, search, sort)}
    </div>
    
    <style>
        .artists-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .artist-grid-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            transition: transform 0.2s;
            border: 1px solid #e8e8e8;
        }
        
        .artist-grid-card:hover {
            transform: translateY(-4px);
            border-color: #9b59b6;
        }
        
        .artist-thumbnail {
            width: 100%;
            aspect-ratio: 1;
            background: linear-gradient(135deg, #9b59b6, #8e44ad);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 3rem;
        }
        
        .artist-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .artist-info {
            padding: 15px;
        }
        
        .artist-name {
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 5px;
        }
        
        .artist-genre {
            color: #9b59b6;
            font-size: 0.85rem;
            margin-bottom: 8px;
        }
        
        .artist-stats {
            display: flex;
            gap: 12px;
            font-size: 0.8rem;
            color: #666;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        
        @media (min-width: 768px) {
            .mobile-cards { display: none; }
            .artists-grid { display: grid !important; }
        }
    </style>
    
    <script>
        function applyFilters() {
            const search = document.getElementById('searchInput').value;
            const sort = document.getElementById('sortSelect').value;
            let url = '/admin/artists?';
            if (search) url += 'search=' + encodeURIComponent(search) + '&';
            url += 'sort=' + sort;
            window.location.href = url;
        }
        
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') applyFilters();
        });
        
        window.viewArtist = function(id) { window.open('/artist/' + id, '_blank'); };
        window.editArtist = function(id) { window.location.href = '/admin/artists/edit?id=' + id; };
        window.mergeArtist = function(id) { window.location.href = '/admin/artists/merge?id=' + id; };
        window.deleteArtist = function(id) {
            if (confirm('Delete this artist?')) window.location.href = '/admin/artists/delete?id=' + id;
        };
    </script>
  `;

  return content;
}

// Mobile card with views
function generateMobileCard(artist) {
  const date = new Date(artist.created).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  return `
    <div class="mobile-card">
        <div style="font-weight:700; margin-bottom:5px;">${artist.name}</div>
        <div style="color:#9b59b6; margin-bottom:8px;">${artist.genre}</div>
        <div style="display:flex; gap:15px; flex-wrap:wrap; margin-bottom:8px;">
            <span><i class="fas fa-music"></i> ${artist.songCount} songs</span>
            <span><i class="fas fa-compact-disc"></i> ${artist.albumCount} albums</span>
            <span><i class="fas fa-headphones" style="color:#9b59b6;"></i> ${formatNumber(artist.monthlyListeners)}</span>
            <span><i class="fas fa-eye" style="color:#4a90e2;"></i> ${formatNumber(artist.views || 0)}</span>
        </div>
        <div style="font-size:0.75rem; color:#999; margin-bottom:10px;">Since ${date}</div>
        <div style="display:flex; gap:8px;">
            <button onclick="editArtist('${artist.id}')" class="btn btn-primary btn-sm" style="flex:1;">Edit</button>
            <button onclick="mergeArtist('${artist.id}')" class="btn btn-secondary btn-sm" style="flex:1;">Merge</button>
            <button onclick="deleteArtist('${artist.id}')" class="btn btn-danger btn-sm" style="flex:1;">Delete</button>
        </div>
    </div>
  `;
}

// Grid card with views
function generateGridCard(artist) {
  return `
    <div class="artist-grid-card">
        <div class="artist-thumbnail" onclick="viewArtist('${artist.id}')">
            ${artist.thumbnail ? `<img src="/artists/thumbnails/${artist.id}.jpg">` : '🎤'}
        </div>
        <div class="artist-info">
            <div class="artist-name" onclick="viewArtist('${artist.id}')">${artist.name}</div>
            <div class="artist-genre" onclick="viewArtist('${artist.id}')">${artist.genre}</div>
            <div class="artist-stats">
                <span><i class="fas fa-music"></i> ${artist.songCount}</span>
                <span><i class="fas fa-compact-disc"></i> ${artist.albumCount}</span>
                <span><i class="fas fa-headphones"></i> ${formatNumber(artist.monthlyListeners)}</span>
                <span><i class="fas fa-eye" style="color:#4a90e2;"></i> ${formatNumber(artist.views || 0)}</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:12px;">
                <button onclick="editArtist('${artist.id}')" class="btn btn-primary btn-sm" style="flex:1;">Edit</button>
                <button onclick="mergeArtist('${artist.id}')" class="btn btn-secondary btn-sm" style="flex:1;">Merge</button>
                <button onclick="deleteArtist('${artist.id}')" class="btn btn-danger btn-sm" style="flex:1;">Delete</button>
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