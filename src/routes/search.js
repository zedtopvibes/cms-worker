// ==================== SEARCH ROUTE ====================
import { getAlbums, getArtists, getPlaylists, getMetadata } from '../helpers/storage.js';
import { getSongStats } from '../helpers/db.js';
import { sanitize, formatDuration } from '../helpers/formatting.js';

export async function handleSearch(req, env, ctx) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") || "";
  const type = url.searchParams.get("type") || "all";
  const page = parseInt(url.searchParams.get("page")) || 1;
  const ITEMS_PER_PAGE = 20;

  // Get template
  const templateObj = await env.media.get("search.html");
  if (!templateObj) {
    return new Response("search.html template not found in R2", { status: 500 });
  }
  let html = await templateObj.text();

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
          
          const title = meta?.title || baseName.split("_").slice(1).join(" ");
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

          // Get stats
          const stats = await getSongStats(baseName, env);

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
            curator: playlist.curator || 'ZEDALBUMS.TOP',
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

  // Pagination
  const allResults = [
    ...(type === "all" || type === "songs" ? songResults : []),
    ...(type === "all" || type === "albums" ? albumResults : []),
    ...(type === "all" || type === "artists" ? artistResults : []),
    ...(type === "all" || type === "playlists" ? playlistResults : [])
  ].sort((a, b) => b.score - a.score);

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

  // Replace placeholders
  html = html.replace(/<!-- SEARCH_QUERY -->/g, escapeHtml(query));
  html = html.replace(/<!-- RESULTS_COUNT -->/g, totalResults.toString());
  html = html.replace(/<!-- FILTER_TABS -->/g, filterTabs);
  html = html.replace(/<!-- SEARCH_RESULTS -->/g, resultsHtml || getNoResultsHtml(query));
  html = html.replace(/<!-- PAGINATION -->/g, paginationHtml);
  html = html.replace(/<!-- SEARCH_TIME -->/g, new Date().toLocaleTimeString());
  
  // Replace count placeholders in right sidebar
  html = html.replace(/<!-- SONGS_COUNT -->/g, songResults.length.toString());
  html = html.replace(/<!-- ALBUMS_COUNT -->/g, albumResults.length.toString());
  html = html.replace(/<!-- ARTISTS_COUNT -->/g, artistResults.length.toString());
  html = html.replace(/<!-- PLAYLISTS_COUNT -->/g, playlistResults.length.toString());

  return new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
}

// Helper function to calculate relevance score
function calculateRelevance(title, artist, query) {
  let score = 0;
  const titleLower = title.toLowerCase();
  const artistLower = artist.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact matches get highest score
  if (titleLower === queryLower) score += 100;
  else if (artistLower === queryLower) score += 90;
  
  // Starts with query
  if (titleLower.startsWith(queryLower)) score += 50;
  else if (artistLower.startsWith(queryLower)) score += 40;
  
  // Contains query
  if (titleLower.includes(queryLower)) score += 20;
  if (artistLower.includes(queryLower)) score += 15;
  
  // Word boundary matches
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
    <div class="search-result-item type-song" onclick="window.location='${item.url}'">
      <div class="result-thumbnail song-thumbnail">
        ${item.thumbnail !== '/images/placeholder.jpg' ? 
          `<img src="${item.thumbnail}" alt="${item.title}" loading="lazy">` : ''}
        <span class="result-type-badge">SONG</span>
      </div>
      <div class="result-info">
        <h3 class="result-title">${escapeHtml(item.title)}</h3>
        <div class="result-meta">
          <span class="result-artist">${escapeHtml(item.artist)}</span>
          <span class="result-duration"><i class="fas fa-clock"></i> ${duration}</span>
          <span class="result-stats"><i class="fas fa-play"></i> ${formatNumber(item.plays)}</span>
        </div>
        <span class="result-date">${date}</span>
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
    <div class="search-result-item type-album" onclick="window.location='${item.url}'">
      <div class="result-thumbnail album-thumbnail">
        ${item.thumbnail !== '/images/placeholder.jpg' ? 
          `<img src="${item.thumbnail}" alt="${item.title}" loading="lazy">` : ''}
        <span class="result-type-badge">ALBUM</span>
      </div>
      <div class="result-info">
        <h3 class="result-title">${escapeHtml(item.title)}</h3>
        <div class="result-meta">
          <span class="result-artist">${escapeHtml(item.artist)}</span>
          <span class="result-tracks"><i class="fas fa-music"></i> ${item.songCount} tracks</span>
        </div>
        <span class="result-date">${date}</span>
      </div>
    </div>
  `;
}

// Generate HTML for artist result
function generateArtistResult(item) {
  return `
    <div class="search-result-item type-artist" onclick="window.location='${item.url}'">
      <div class="result-thumbnail artist-thumbnail">
        ${item.thumbnail !== '/images/placeholder.jpg' ? 
          `<img src="${item.thumbnail}" alt="${item.name}" loading="lazy">` : ''}
        <span class="result-type-badge">ARTIST</span>
      </div>
      <div class="result-info">
        <h3 class="result-title">${escapeHtml(item.name)}</h3>
        <div class="result-meta">
          <span class="result-genre">${escapeHtml(item.genre)}</span>
          <span class="result-tracks"><i class="fas fa-music"></i> ${item.songCount} songs</span>
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
    <div class="search-result-item type-playlist" onclick="window.location='${item.url}'">
      <div class="result-thumbnail playlist-thumbnail">
        ${item.thumbnail !== '/images/placeholder.jpg' ? 
          `<img src="${item.thumbnail}" alt="${item.title}" loading="lazy">` : ''}
        <span class="result-type-badge">PLAYLIST</span>
      </div>
      <div class="result-info">
        <h3 class="result-title">${escapeHtml(item.title)}</h3>
        <div class="result-meta">
          <span class="result-artist">${escapeHtml(item.curator)}</span>
          <span class="result-tracks"><i class="fas fa-music"></i> ${item.songCount} songs</span>
        </div>
        <span class="result-date">${date}</span>
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
    const url = `/search?q=${encodeURIComponent(query)}&type=${tab.type}`;
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

  let html = '<div class="pagination">';
  
  // Previous button
  if (currentPage > 1) {
    html += `<a href="/search?q=${encodeURIComponent(query)}&type=${type}&page=${currentPage-1}" class="pagination-item pagination-prev"><i class="fas fa-chevron-left"></i> Prev</a>`;
  } else {
    html += `<span class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</span>`;
  }

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const active = i === currentPage ? 'active' : '';
      html += `<a href="/search?q=${encodeURIComponent(query)}&type=${type}&page=${i}" class="pagination-item ${active}">${i}</a>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  // Next button
  if (currentPage < totalPages) {
    html += `<a href="/search?q=${encodeURIComponent(query)}&type=${type}&page=${currentPage+1}" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>`;
  } else {
    html += `<span class="pagination-item pagination-next disabled">Next <i class="fas fa-chevron-right"></i></span>`;
  }

  html += '</div>';
  return html;
}

// Escape HTML for safety
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// No results HTML
function getNoResultsHtml(query) {
  return `
    <div class="no-results">
      <i class="fas fa-search"></i>
      <h3>No results found for "${escapeHtml(query)}"</h3>
      <p>Try different keywords or check your spelling</p>
      <div class="suggestions-list">
        <h4>Suggestions:</h4>
        <ul>
          <li>• Use more general keywords</li>
          <li>• Check for typos</li>
          <li>• Browse our <a href="/charts">charts</a> instead</li>
        </ul>
      </div>
    </div>
  `;
}

// Format number helper
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}