// ==================== ADMIN SEARCH ====================
import { getAlbums, getArtists, getPlaylists, getMetadata } from '../../helpers/storage.js';
import { getSongStats } from '../../helpers/db.js';
import { formatDuration, formatNumber } from '../../helpers/formatting.js';

export async function handleAdminSearch(req, env, ctx, auth) {
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';
  const type = url.searchParams.get('type') || 'all';
  const page = parseInt(url.searchParams.get('page')) || 1;
  const ITEMS_PER_PAGE = 20;

  // Get all data
  const albums = await getAlbums(env);
  const artists = await getArtists(env);
  const playlists = await getPlaylists(env);
  
  // Search results containers
  let songResults = [];
  let albumResults = [];
  let artistResults = [];
  let playlistResults = [];

  if (query.length > 0) {
    const lowercaseQuery = query.toLowerCase();

    // Search songs
    if (type === "all" || type === "songs") {
      const songList = await env.media.list({ prefix: "songs/" });
      const songFiles = songList.objects || [];
      
      songResults = await Promise.all(
        songFiles.map(async (file) => {
          const fileName = file.key.split("/")[1];
          const baseName = fileName.replace(".mp3", "");
          const meta = await getMetadata(env, baseName);
          const stats = await getSongStats(baseName, env);
          
          const title = meta?.title || baseName.split("_").slice(1).join(" ") || baseName;
          const artistId = meta?.primaryArtist || baseName.split("_")[0];
          const artistName = artists[artistId]?.name || artistId;
          
          // Check if matches query
          const matches = 
            title.toLowerCase().includes(lowercaseQuery) ||
            artistName.toLowerCase().includes(lowercaseQuery) ||
            (meta?.featuredArtists?.some(fid => 
              artists[fid]?.name?.toLowerCase().includes(lowercaseQuery)
            ));
          
          if (!matches) return null;

          // Get thumbnail
          let thumbUrl = "/images/placeholder.jpg";
          try {
            const jpgObj = await env.media.get(`images/${baseName}.jpg`);
            if (jpgObj) thumbUrl = `/images/${encodeURIComponent(baseName)}.jpg`;
            else {
              const pngObj = await env.media.get(`images/${baseName}.png`);
              if (pngObj) thumbUrl = `/images/${encodeURIComponent(baseName)}.png`;
            }
          } catch (e) {}

          return {
            type: 'song',
            id: baseName,
            title,
            artist: artistName,
            artistId,
            thumbnail: thumbUrl,
            duration: meta?.duration || 0,
            plays: stats.plays,
            downloads: stats.downloads,
            uploaded: file.uploaded,
            url: `/song/${encodeURIComponent(fileName)}`,
            score: calculateRelevance(title, artistName, lowercaseQuery)
          };
        })
      );
      songResults = songResults.filter(r => r !== null)
        .sort((a, b) => b.score - a.score);
    }

    // Search albums
    if (type === "all" || type === "albums") {
      albumResults = Object.values(albums)
        .map(album => {
          const albumArtist = album.artists?.length ? 
            (artists[album.artists[0]]?.name || "Various") : "Various";
          
          const matches = 
            album.title.toLowerCase().includes(lowercaseQuery) ||
            albumArtist.toLowerCase().includes(lowercaseQuery) ||
            album.description?.toLowerCase().includes(lowercaseQuery);

          if (!matches) return null;

          let thumbUrl = "/images/placeholder.jpg";
          if (album.thumbnail) {
            const ext = album.thumbnail.split(".").pop();
            thumbUrl = `/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}`;
          }

          return {
            type: 'album',
            id: album.id,
            title: album.title,
            artist: albumArtist,
            thumbnail: thumbUrl,
            songCount: album.songs?.length || 0,
            created: album.created,
            url: `/album/${album.id}`,
            score: calculateRelevance(album.title, albumArtist, lowercaseQuery)
          };
        })
        .filter(r => r !== null)
        .sort((a, b) => b.score - a.score);
    }

    // Search artists
    if (type === "all" || type === "artists") {
      artistResults = Object.values(artists)
        .map(artist => {
          const matches = 
            artist.name.toLowerCase().includes(lowercaseQuery) ||
            artist.genre?.toLowerCase().includes(lowercaseQuery) ||
            artist.description?.toLowerCase().includes(lowercaseQuery);

          if (!matches) return null;

          let thumbUrl = "/images/placeholder.jpg";
          if (artist.thumbnail) {
            const ext = artist.thumbnail.split(".").pop();
            thumbUrl = `/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}`;
          }

          return {
            type: 'artist',
            id: artist.id,
            name: artist.name,
            genre: artist.genre || 'Various',
            thumbnail: thumbUrl,
            songCount: artist.songs?.length || 0,
            albumCount: artist.albums?.length || 0,
            created: artist.created,
            url: `/artist/${artist.id}`,
            score: calculateRelevance(artist.name, artist.genre || '', lowercaseQuery)
          };
        })
        .filter(r => r !== null)
        .sort((a, b) => b.score - a.score);
    }

    // Search playlists
    if (type === "all" || type === "playlists") {
      playlistResults = Object.values(playlists)
        .map(playlist => {
          const matches = 
            playlist.title.toLowerCase().includes(lowercaseQuery) ||
            playlist.description?.toLowerCase().includes(lowercaseQuery) ||
            playlist.curator?.toLowerCase().includes(lowercaseQuery);

          if (!matches) return null;

          let thumbUrl = "/images/placeholder.jpg";
          if (playlist.thumbnail) {
            const ext = playlist.thumbnail.split(".").pop();
            thumbUrl = `/playlists/thumbnails/${encodeURIComponent(playlist.id)}.${ext}`;
          }

          return {
            type: 'playlist',
            id: playlist.id,
            title: playlist.title,
            curator: playlist.curator || 'ZEDALBUMS',
            thumbnail: thumbUrl,
            songCount: playlist.songs?.length || 0,
            created: playlist.created,
            url: `/playlist/${playlist.id}`,
            score: calculateRelevance(playlist.title, playlist.curator || '', lowercaseQuery)
          };
        })
        .filter(r => r !== null)
        .sort((a, b) => b.score - a.score);
    }
  }

  // Combine all results
  const allResults = [
    ...(type === "all" || type === "songs" ? songResults : []),
    ...(type === "all" || type === "albums" ? albumResults : []),
    ...(type === "all" || type === "artists" ? artistResults : []),
    ...(type === "all" || type === "playlists" ? playlistResults : [])
  ].sort((a, b) => b.score - a.score);

  // Pagination
  const totalResults = allResults.length;
  const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const pageResults = allResults.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Generate results HTML
  const resultsHtml = pageResults.map(item => {
    switch(item.type) {
      case 'song':
        return generateSongResult(item);
      case 'album':
        return generateAlbumResult(item);
      case 'artist':
        return generateArtistResult(item);
      case 'playlist':
        return generatePlaylistResult(item);
      default:
        return '';
    }
  }).join('');

  // Generate filter tabs
  const filterTabs = generateFilterTabs(type, query, {
    songs: songResults.length,
    albums: albumResults.length,
    artists: artistResults.length,
    playlists: playlistResults.length
  });

  // Generate pagination
  const paginationHtml = generatePagination(query, type, page, totalPages);

  const content = `
    <div style="margin-bottom: 20px;">
        <!-- Header -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
                <h2 style="margin:0; font-size:1.3rem;"><i class="fas fa-search" style="color: #ff5500;"></i> Search Admin</h2>
            </div>
            
            <!-- Search Bar -->
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                        <input type="text" id="searchInput" class="form-control" placeholder="Search songs, albums, artists, playlists..." 
                               value="${query}" style="padding-left: 40px;" autofocus>
                    </div>
                </div>
                <button onclick="performSearch()" class="btn btn-primary">
                    <i class="fas fa-search"></i> Search
                </button>
            </div>
            
            <!-- Filter Tabs -->
            <div class="filter-tabs" style="display: flex; gap: 5px; overflow-x: auto; padding: 5px 0;">
                ${filterTabs}
            </div>
            
            <!-- Results Summary -->
            ${query ? `
                <div style="background: #f8f9fa; padding: 10px 15px; border-radius: 8px;">
                    Found <strong>${totalResults}</strong> result${totalResults !== 1 ? 's' : ''} for "${query}"
                </div>
            ` : ''}
        </div>
        
        <!-- Search Results -->
        ${query ? `
            <div class="search-results">
                ${resultsHtml || getNoResultsHtml(query)}
            </div>
            
            <!-- Pagination -->
            ${paginationHtml}
        ` : `
            <div class="empty-state" style="text-align: center; padding: 60px 20px; background: white; border-radius: 12px;">
                <i class="fas fa-search" style="font-size: 4rem; color: #ccc; margin-bottom: 20px;"></i>
                <h3>Search Admin Content</h3>
                <p style="color: #666; margin-bottom: 20px;">Enter a search term to find songs, albums, artists, and playlists</p>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <span style="background: #f0f0f0; padding: 5px 10px; border-radius: 20px;">🎵 Songs</span>
                    <span style="background: #f0f0f0; padding: 5px 10px; border-radius: 20px;">💿 Albums</span>
                    <span style="background: #f0f0f0; padding: 5px 10px; border-radius: 20px;">🎤 Artists</span>
                    <span style="background: #f0f0f0; padding: 5px 10px; border-radius: 20px;">📋 Playlists</span>
                </div>
            </div>
        `}
    </div>
    
    <style>
        .filter-tabs {
            scrollbar-width: none;
        }
        .filter-tabs::-webkit-scrollbar {
            display: none;
        }
        .filter-tab {
            padding: 8px 16px;
            background: #f8f9fa;
            border: 1px solid #e8e8e8;
            border-radius: 20px;
            color: #666;
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 600;
            white-space: nowrap;
            transition: all 0.2s;
        }
        .filter-tab:hover {
            background: #ff5500;
            color: white;
            border-color: #ff5500;
        }
        .filter-tab.active {
            background: #ff5500;
            color: white;
            border-color: #ff5500;
        }
        .filter-tab .count {
            font-size: 0.7rem;
            opacity: 0.8;
            margin-left: 4px;
        }
        .search-result-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            background: white;
            border-radius: 8px;
            margin-bottom: 10px;
            border: 1px solid #e8e8e8;
            transition: all 0.2s;
            cursor: pointer;
        }
        .search-result-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            border-color: #ff5500;
        }
        .result-thumbnail {
            width: 60px;
            height: 60px;
            border-radius: 8px;
            overflow: hidden;
            background: #f0f0f0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            flex-shrink: 0;
        }
        .result-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .result-thumbnail.song { background: linear-gradient(135deg, #2ecc71, #27ae60); color: white; }
        .result-thumbnail.album { background: linear-gradient(135deg, #ff5500, #ff8c00); color: white; }
        .result-thumbnail.artist { background: linear-gradient(135deg, #9b59b6, #8e44ad); color: white; }
        .result-thumbnail.playlist { background: linear-gradient(135deg, #4a90e2, #9013fe); color: white; }
        .result-info {
            flex: 1;
            min-width: 0;
        }
        .result-title {
            font-weight: 600;
            font-size: 1rem;
            margin-bottom: 4px;
            color: #333;
        }
        .result-title mark {
            background: #ffeb3b;
            padding: 0 2px;
        }
        .result-meta {
            display: flex;
            gap: 10px;
            font-size: 0.8rem;
            color: #666;
            flex-wrap: wrap;
        }
        .result-meta span {
            display: flex;
            align-items: center;
            gap: 3px;
        }
        .result-type-badge {
            font-size: 0.7rem;
            padding: 2px 8px;
            border-radius: 12px;
            background: #f0f0f0;
            color: #666;
        }
        .no-results {
            text-align: center;
            padding: 60px 20px;
            background: white;
            border-radius: 12px;
        }
        .no-results i {
            font-size: 3rem;
            color: #ccc;
            margin-bottom: 15px;
        }
        @media (max-width: 480px) {
            .result-thumbnail {
                width: 50px;
                height: 50px;
            }
            .result-meta {
                flex-direction: column;
                gap: 5px;
            }
        }
    </style>
    
    <script>
        function performSearch() {
            const query = document.getElementById('searchInput').value.trim();
            if (query) {
                window.location.href = '/admin/search?q=' + encodeURIComponent(query);
            }
        }
        
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
        
        function filterByType(type) {
            const url = new URL(window.location.href);
            url.searchParams.set('type', type);
            window.location.href = url.toString();
        }
    </script>
  `;

  return content;
}

// Helper function to calculate relevance score
function calculateRelevance(title, artist, query) {
  let score = 0;
  const titleLower = title.toLowerCase();
  const artistLower = artist.toLowerCase();
  const queryLower = query.toLowerCase();

  if (titleLower === queryLower) score += 100;
  else if (artistLower === queryLower) score += 90;
  
  if (titleLower.startsWith(queryLower)) score += 50;
  else if (artistLower.startsWith(queryLower)) score += 40;
  
  if (titleLower.includes(queryLower)) score += 20;
  if (artistLower.includes(queryLower)) score += 15;
  
  const titleWords = titleLower.split(' ');
  if (titleWords.some(word => word.startsWith(queryLower))) score += 10;
  
  return score;
}

// Generate HTML for song result
function generateSongResult(item) {
  const duration = formatDuration(item.duration);
  const date = new Date(item.uploaded).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  return `
    <div class="search-result-item" onclick="window.location='${item.url}'">
        <div class="result-thumbnail song">
            ${item.thumbnail !== '/images/placeholder.jpg' ? 
                `<img src="${item.thumbnail}" alt="${item.title}">` : 
                '<i class="fas fa-music"></i>'}
        </div>
        <div class="result-info">
            <div class="result-title">${highlightText(item.title)}</div>
            <div class="result-meta">
                <span><i class="fas fa-microphone"></i> ${highlightText(item.artist)}</span>
                <span><i class="fas fa-clock"></i> ${duration}</span>
                <span><i class="fas fa-play"></i> ${formatNumber(item.plays)}</span>
                <span class="result-type-badge">Song</span>
            </div>
            <div style="font-size:0.7rem; color:#999; margin-top:5px;">${date}</div>
        </div>
    </div>
  `;
}

// Generate HTML for album result
function generateAlbumResult(item) {
  const date = new Date(item.created).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  return `
    <div class="search-result-item" onclick="window.location='${item.url}'">
        <div class="result-thumbnail album">
            ${item.thumbnail !== '/images/placeholder.jpg' ? 
                `<img src="${item.thumbnail}" alt="${item.title}">` : 
                '<i class="fas fa-compact-disc"></i>'}
        </div>
        <div class="result-info">
            <div class="result-title">${highlightText(item.title)}</div>
            <div class="result-meta">
                <span><i class="fas fa-user"></i> ${highlightText(item.artist)}</span>
                <span><i class="fas fa-music"></i> ${item.songCount} tracks</span>
                <span class="result-type-badge">Album</span>
            </div>
            <div style="font-size:0.7rem; color:#999; margin-top:5px;">${date}</div>
        </div>
    </div>
  `;
}

// Generate HTML for artist result
function generateArtistResult(item) {
  return `
    <div class="search-result-item" onclick="window.location='${item.url}'">
        <div class="result-thumbnail artist">
            ${item.thumbnail !== '/images/placeholder.jpg' ? 
                `<img src="${item.thumbnail}" alt="${item.name}">` : 
                '<i class="fas fa-microphone"></i>'}
        </div>
        <div class="result-info">
            <div class="result-title">${highlightText(item.name)}</div>
            <div class="result-meta">
                <span><i class="fas fa-tag"></i> ${item.genre}</span>
                <span><i class="fas fa-music"></i> ${item.songCount} songs</span>
                <span><i class="fas fa-compact-disc"></i> ${item.albumCount} albums</span>
                <span class="result-type-badge">Artist</span>
            </div>
        </div>
    </div>
  `;
}

// Generate HTML for playlist result
function generatePlaylistResult(item) {
  const date = new Date(item.created).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  return `
    <div class="search-result-item" onclick="window.location='${item.url}'">
        <div class="result-thumbnail playlist">
            ${item.thumbnail !== '/images/placeholder.jpg' ? 
                `<img src="${item.thumbnail}" alt="${item.title}">` : 
                '<i class="fas fa-list"></i>'}
        </div>
        <div class="result-info">
            <div class="result-title">${highlightText(item.title)}</div>
            <div class="result-meta">
                <span><i class="fas fa-user"></i> ${item.curator}</span>
                <span><i class="fas fa-music"></i> ${item.songCount} songs</span>
                <span class="result-type-badge">Playlist</span>
            </div>
            <div style="font-size:0.7rem; color:#999; margin-top:5px;">${date}</div>
        </div>
    </div>
  `;
}

// Generate filter tabs
function generateFilterTabs(currentType, query, counts) {
  const tabs = [
    { type: 'all', label: 'All', count: counts.songs + counts.albums + counts.artists + counts.playlists },
    { type: 'songs', label: 'Songs', count: counts.songs },
    { type: 'albums', label: 'Albums', count: counts.albums },
    { type: 'artists', label: 'Artists', count: counts.artists },
    { type: 'playlists', label: 'Playlists', count: counts.playlists }
  ];

  return tabs.map(tab => {
    const active = tab.type === currentType ? 'active' : '';
    const url = `/admin/search?q=${encodeURIComponent(query)}&type=${tab.type}`;
    return `
      <a href="${url}" class="filter-tab ${active}">
        ${tab.label} <span class="count">(${tab.count})</span>
      </a>
    `;
  }).join('');
}

// Generate pagination
function generatePagination(query, type, currentPage, totalPages) {
  if (totalPages <= 1) return '';

  let html = '<div class="pagination" style="margin-top: 30px; justify-content: center;">';
  
  if (currentPage > 1) {
    html += `<a href="/admin/search?q=${encodeURIComponent(query)}&type=${type}&page=${currentPage-1}" class="pagination-item pagination-prev"><i class="fas fa-chevron-left"></i> Prev</a>`;
  } else {
    html += `<span class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</span>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const active = i === currentPage ? 'active' : '';
      html += `<a href="/admin/search?q=${encodeURIComponent(query)}&type=${type}&page=${i}" class="pagination-item ${active}">${i}</a>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  if (currentPage < totalPages) {
    html += `<a href="/admin/search?q=${encodeURIComponent(query)}&type=${type}&page=${currentPage+1}" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>`;
  } else {
    html += `<span class="pagination-item pagination-next disabled">Next <i class="fas fa-chevron-right"></i></span>`;
  }

  html += '</div>';
  return html;
}

// Highlight matching text
function highlightText(text) {
  return text; // Client-side highlighting is handled by JavaScript
}

// No results HTML
function getNoResultsHtml(query) {
  return `
    <div class="no-results">
        <i class="fas fa-search"></i>
        <h3>No results found for "${escapeHtml(query)}"</h3>
        <p style="color: #666; margin-top: 10px;">Try different keywords or check your spelling</p>
        <div style="margin-top: 20px;">
            <a href="/admin/search" class="btn btn-secondary">Clear Search</a>
        </div>
    </div>
  `;
}

// Escape HTML for safety
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}