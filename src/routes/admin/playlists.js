// ==================== ADMINPLAYLISTS MANAGEMENT ====================
import { getPlaylists, savePlaylists, getArtists, getAlbums, getMetadata } from '../../helpers/storage.js';
import { getAggregatedStats } from '../../helpers/db.js';
import { getPageViews } from '../../helpers/pageViews.js';
import { sanitize, formatNumber } from '../../helpers/formatting.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';
import { moveToTrash } from '../../helpers/trash.js';
import { GenreManager } from '../../helpers/genreManager.js';
// REMOVE: import { SlugManager } from '../../helpers/slug.js';

// ===== LIST ALL PLAYLISTS =====
export async function handleAdminPlaylists(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') || '';
  const sort = url.searchParams.get('sort') || 'date';
  const ITEMS_PER_PAGE = 20;
  // REMOVE: const slugManager = new SlugManager(env);

  // Get all playlists
  const playlists = await getPlaylists(env);
  const artists = await getArtists(env);
  
  // Get detailed playlist data with views
  let playlistsData = await Promise.all(
    Object.entries(playlists).map(async ([id, playlist]) => {
      const stats = await getAggregatedStats(playlist.songs || [], env);
      const pageViews = await getPageViews(env, 'playlist', id);
      
      // REMOVE slug lookup - use id directly
      // const playlistSlug = await slugManager.getSlugFromId('playlists', id) || id;
      
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
        // slug: playlistSlug,  // REMOVE THIS
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
        hasImage: !!playlist.thumbnail,
        genres: playlist.genres || []
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
            cursor: pointer;
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
            cursor: pointer;
        }
        
        .playlist-title:hover {
            color: #4a90e2;
        }
        
        .playlist-curator {
            color: #4a90e2;
            font-size: 0.85rem;
            margin-bottom: 8px;
            cursor: pointer;
        }
        
        .playlist-stats {
            display: flex;
            gap: 12px;
            font-size: 0.8rem;
            color: #666;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        
        .playlist-id-info {
            font-size: 0.75rem;
            color: #4a90e2;
            margin-top: 5px;
            padding: 4px 8px;
            background: #f0f7ff;
            border-radius: 4px;
            display: inline-block;
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
        
        window.viewPlaylist = function(id) { 
            window.open('/playlist/' + id, '_blank'); 
        };
        
        // REMOVE slug function
        // window.viewPlaylistBySlug = function(slug) { 
        //     window.open('/playlist/' + slug, '_blank'); 
        // };
        
        window.editPlaylist = function(id) { 
            window.location.href = '/admin/playlists/edit?id=' + id; 
        };
        
        window.manageSongs = function(id) { 
            window.location.href = '/admin/playlists/songs?id=' + id; 
        };
        
        window.deletePlaylist = function(id) {
            if (confirm('Delete this playlist? It will be moved to trash.')) {
                window.location.href = '/admin/playlists/delete?id=' + id;
            }
        };
    </script>
  `;

  return content;
}

// ===== CREATE NEW PLAYLIST PAGE =====
export async function handleAdminPlaylistCreate(req, env, ctx, auth) {
  // Load genres for selection
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  const genres = genresData.genres;

  const content = `
    <div style="max-width: 600px; margin: 0 auto; width: 100%; padding: 0 0 20px;">
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <a href="/admin/playlists" class="btn btn-secondary btn-sm" style="align-self: flex-start;">
                <i class="fas fa-arrow-left"></i> Back
            </a>
            <h2 style="font-size: 1.3rem; margin:0;">
                <i class="fas fa-plus-circle" style="color: #4a90e2;"></i> Create New Playlist
            </h2>
        </div>
        
        <form action="/admin/playlist/create" method="POST" enctype="multipart/form-data" style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8;">
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Playlist Title <span style="color: #ff5500;">*</span></label>
                <input type="text" name="title" class="form-control" placeholder="e.g. Zambian Hits 2025" required style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Description</label>
                <textarea name="description" class="form-control" rows="4" placeholder="Playlist description..." style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;"></textarea>
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Curator Name</label>
                <input type="text" name="curator" class="form-control" placeholder="e.g. ZEDALBUMS" value="ZEDALBUMS" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
            </div>
            
            <!-- GENRE SELECTION -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">
                    <i class="fas fa-tags" style="color: #4a90e2;"></i> Genres
                </label>
                
                <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 15px; background: #f8f9fa;">
                    <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #666;">
                        <i class="fas fa-hand-pointer"></i> Tap genres to select (multiple allowed):
                    </p>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;" id="genreChips">
                        ${genres.map(g => `
                            <div class="genre-chip" 
                                 data-id="${g.id}"
                                 data-color="${g.color}"
                                 onclick="toggleGenre('${g.id}')"
                                 style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 15px; background: #f0f0f0; color: #333; border-radius: 30px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; border: 1px solid #e0e0e0;">
                                <i class="fas ${g.icon}" style="color: ${g.color};"></i>
                                <span>${g.name}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- Hidden inputs to store selected genres -->
                    <div id="selectedGenresContainer"></div>
                </div>
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Cover Image</label>
                <input type="file" name="thumbnail" accept="image/*" class="form-control" style="width: 100%; padding: 10px; border: 2px dashed #e0e0e0; border-radius: 8px;">
                <p style="font-size: 0.8rem; color: #666; margin-top: 5px;">Square image recommended (JPG or PNG)</p>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 25px;">
                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 16px; background: #4a90e2;">
                    <i class="fas fa-save"></i> Create Playlist
                </button>
                <a href="/admin/playlists" class="btn btn-secondary" style="width: 100%; padding: 14px; font-size: 16px; text-align: center; text-decoration: none;">
                    <i class="fas fa-times"></i> Cancel
                </a>
            </div>
        </form>
        
        <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #4a90e2;">
            <p style="margin:0; font-size:0.9rem; color:#666;">
                <i class="fas fa-info-circle" style="color:#4a90e2;"></i>
                After creating your playlist, you can add songs to it from the Songs Management page.
            </p>
        </div>
    </div>

    <script>
        const selectedGenres = new Set();
        
        function toggleGenre(genreId) {
            const chip = document.querySelector(\`.genre-chip[data-id="\${genreId}"]\`);
            const color = chip.dataset.color;
            
            if (selectedGenres.has(genreId)) {
                selectedGenres.delete(genreId);
                chip.style.background = '#f0f0f0';
                chip.style.color = '#333';
                chip.style.borderColor = '#e0e0e0';
                chip.querySelector('i').style.color = color;
            } else {
                selectedGenres.add(genreId);
                chip.style.background = color;
                chip.style.color = 'white';
                chip.style.borderColor = color;
                chip.querySelector('i').style.color = 'white';
            }
            
            // Update hidden inputs
            updateHiddenInputs();
        }
        
        function updateHiddenInputs() {
            const container = document.getElementById('selectedGenresContainer');
            container.innerHTML = '';
            selectedGenres.forEach(id => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'genres';
                input.value = id;
                container.appendChild(input);
            });
        }
    </script>

    <style>
        .genre-chip {
            transition: all 0.2s ease;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }
        .genre-chip:active {
            transform: scale(0.95);
        }
        @media (max-width: 480px) {
            .genre-chip {
                padding: 10px 15px !important;
                font-size: 1rem !important;
            }
        }
    </style>
  `;
  
  return content;
}

// ===== HANDLE PLAYLIST CREATION POST =====
export async function handleAdminPlaylistCreatePost(req, env, ctx, auth) {
  const formData = await req.formData();
  const title = formData.get('title');
  const description = formData.get('description') || '';
  const curator = formData.get('curator') || 'ZEDALBUMS';
  const thumbnailFile = formData.get('thumbnail');
  const genres = formData.getAll('genres');

  if (!title) {
    return { success: false, error: 'Playlist title is required' };
  }

  const playlistId = sanitize(title) + "_" + Date.now();
  const playlists = await getPlaylists(env);

  // REMOVE slug generation and registration
  // const slugManager = new SlugManager(env);
  // const slug = slugManager.generatePlaylistSlug(title);
  // await slugManager.registerSlug('playlists', playlistId, slug, { title });

  let thumbnailKey = null;
  if (thumbnailFile && thumbnailFile.size > 0) {
    const imgType = thumbnailFile.type.includes('png') ? 'png' : 'jpg';
    thumbnailKey = `playlists/thumbnails/${playlistId}.${imgType}`;
    await env.media.put(thumbnailKey, thumbnailFile.stream());
  }

  playlists[playlistId] = {
    id: playlistId,
    title: title,
    description: description,
    curator: curator,
    thumbnail: thumbnailKey,
    created: Date.now(),
    updated: Date.now(),
    songs: [],
    genres: genres
    // slug: slug  // REMOVE THIS
  };

  await savePlaylists(env, playlists);
  
  // Log activity
  await logAdminActivity(env, auth.session.id, 'create', 'playlist', playlistId, title);

  return { 
    success: true, 
    redirect: `/admin/playlists?created=1` 
  };
}

// ===== EDIT PLAYLIST PAGE =====
export async function handleAdminPlaylistEdit(req, env, ctx, auth) {
  const url = new URL(req.url);
  const playlistId = url.searchParams.get('id');
  
  if (!playlistId) {
    return { redirect: '/admin/playlists' };
  }
  
  const playlists = await getPlaylists(env);
  const playlist = playlists[playlistId];
  // REMOVE: const slugManager = new SlugManager(env);
  
  if (!playlist) {
    return { redirect: '/admin/playlists' };
  }
  
  // REMOVE slug lookup - use playlistId directly
  // const playlistSlug = await slugManager.getSlugFromId('playlists', playlistId) || playlistId;
  
  // Load genres for selection
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  const genres = genresData.genres;
  const playlistGenres = playlist?.genres || [];
  
  const content = `
    <div style="max-width: 600px; margin: 0 auto; width: 100%; padding: 0 0 20px;">
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <a href="/admin/playlists" class="btn btn-secondary btn-sm" style="align-self: flex-start;">
                <i class="fas fa-arrow-left"></i> Back
            </a>
            <h2 style="font-size: 1.3rem; margin:0;">
                <i class="fas fa-edit" style="color: #ff5500;"></i> Edit Playlist: ${playlist.title}
            </h2>
            <div style="background: #f0f9ff; padding: 10px; border-radius: 8px; border-left: 4px solid #4a90e2;">
                <i class="fas fa-link" style="color: #4a90e2;"></i>
                <span style="margin-left: 5px;">Playlist URL:</span>
                <code style="background: white; padding: 4px 8px; border-radius: 4px; margin-left: 10px;">/playlist/${playlistId}</code>
            </div>
        </div>
        
        <form id="editForm" action="/admin/playlists/edit" method="POST" enctype="multipart/form-data" style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8;">
            <input type="hidden" name="playlistId" value="${playlistId}">
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Playlist Title</label>
                <input type="text" name="title" class="form-control" value="${playlist.title}" required style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Description</label>
                <textarea name="description" class="form-control" rows="4" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">${playlist.description || ''}</textarea>
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Curator Name</label>
                <input type="text" name="curator" class="form-control" value="${playlist.curator || 'ZEDALBUMS'}" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
            </div>
            
            <!-- GENRE SELECTION -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">
                    <i class="fas fa-tags" style="color: #4a90e2;"></i> Genres
                </label>
                
                <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 15px; background: #f8f9fa;">
                    <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #666;">
                        <i class="fas fa-hand-pointer"></i> Tap genres to select (multiple allowed):
                    </p>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;" id="genreChips">
                        ${genres.map(g => {
                          const isSelected = playlistGenres.includes(g.id);
                          return `
                            <div class="genre-chip ${isSelected ? 'selected' : ''}" 
                                 data-id="${g.id}"
                                 data-color="${g.color}"
                                 onclick="toggleGenre('${g.id}')"
                                 style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 15px; background: ${isSelected ? g.color : '#f0f0f0'}; color: ${isSelected ? 'white' : '#333'}; border-radius: 30px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; border: 1px solid ${isSelected ? g.color : '#e0e0e0'};">
                                <i class="fas ${g.icon}" style="color: ${isSelected ? 'white' : g.color};"></i>
                                <span>${g.name}</span>
                            </div>
                          `;
                        }).join('')}
                    </div>
                    
                    <!-- Hidden inputs to store selected genres -->
                    <div id="selectedGenresContainer">
                        ${playlistGenres.map(id => `
                            <input type="hidden" name="genres" value="${id}" class="genre-input">
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Cover Image</label>
                ${playlist.thumbnail ? 
                    `<div style="margin-bottom:15px;">
                        <img src="/${playlist.thumbnail}" style="width:120px; height:120px; border-radius:12px; object-fit:cover; border:3px solid #4a90e2;">
                    </div>` : 
                    '<p style="color:#999; margin-bottom:10px;">No image</p>'
                }
                <input type="file" name="thumbnail" accept="image/*" class="form-control" style="width:100%; padding:10px; border:2px dashed #e0e0e0; border-radius:8px;">
                <small style="color:#999; display:block; margin-top:5px;">Leave empty to keep current image</small>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 25px;">
                <button type="submit" class="btn btn-primary" style="width:100%; padding:14px; font-size:16px;">
                    <i class="fas fa-save"></i> Save Changes
                </button>
                <a href="/admin/playlists" class="btn btn-secondary" style="width:100%; padding:14px; font-size:16px; text-align:center; text-decoration:none;">
                    <i class="fas fa-times"></i> Cancel
                </a>
            </div>
        </form>
    </div>

    <script>
        const selectedGenres = new Set(${JSON.stringify(playlistGenres)});
        
        function toggleGenre(genreId) {
            const chip = document.querySelector(\`.genre-chip[data-id="\${genreId}"]\`);
            const color = chip.dataset.color;
            
            if (selectedGenres.has(genreId)) {
                selectedGenres.delete(genreId);
                chip.style.background = '#f0f0f0';
                chip.style.color = '#333';
                chip.style.borderColor = '#e0e0e0';
                chip.querySelector('i').style.color = color;
            } else {
                selectedGenres.add(genreId);
                chip.style.background = color;
                chip.style.color = 'white';
                chip.style.borderColor = color;
                chip.querySelector('i').style.color = 'white';
            }
            
            // Update hidden inputs
            updateHiddenInputs();
        }
        
        function updateHiddenInputs() {
            const container = document.getElementById('selectedGenresContainer');
            container.innerHTML = '';
            selectedGenres.forEach(id => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'genres';
                input.value = id;
                input.className = 'genre-input';
                container.appendChild(input);
            });
        }
        
        // Form submission confirmation
        document.getElementById('editForm')?.addEventListener('submit', function(e) {
            if (!confirm('Save changes to this playlist?')) {
                e.preventDefault();
            }
        });
    </script>

    <style>
        .genre-chip {
            transition: all 0.2s ease;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }
        .genre-chip:active {
            transform: scale(0.95);
        }
        @media (max-width: 480px) {
            .genre-chip {
                padding: 10px 15px !important;
                font-size: 1rem !important;
            }
        }
    </style>
  `;
  
  return { content };
}

// ===== HANDLE PLAYLIST EDIT POST =====
export async function handleAdminPlaylistEditPost(req, env, ctx, auth) {
  const formData = await req.formData();
  const playlistId = formData.get('playlistId');
  const title = formData.get('title');
  const description = formData.get('description');
  const curator = formData.get('curator');
  const genres = formData.getAll('genres');
  const thumbnailFile = formData.get('thumbnail');
  
  if (!playlistId || !title) {
    return { success: false, error: 'Missing required fields' };
  }
  
  try {
    const playlists = await getPlaylists(env);
    // REMOVE: const slugManager = new SlugManager(env);
    
    if (!playlists[playlistId]) {
      return { success: false, error: 'Playlist not found' };
    }
    
    // REMOVE slug update logic
    // const oldTitle = playlists[playlistId].title;
    // if (oldTitle !== title) {
    //   const newSlug = slugManager.generatePlaylistSlug(title);
    //   await slugManager.registerSlug('playlists', playlistId, newSlug, { title });
    //   playlists[playlistId].slug = newSlug;
    // }
    
    // Update playlist details
    playlists[playlistId].title = title;
    playlists[playlistId].description = description;
    playlists[playlistId].curator = curator;
    playlists[playlistId].genres = genres;
    playlists[playlistId].updated = Date.now();
    
    // Upload new thumbnail if provided
    if (thumbnailFile && thumbnailFile.size > 0) {
      const imgType = thumbnailFile.type.includes('png') ? 'png' : 'jpg';
      const thumbnailKey = `playlists/thumbnails/${playlistId}.${imgType}`;
      await env.media.put(thumbnailKey, thumbnailFile.stream());
      playlists[playlistId].thumbnail = thumbnailKey;
    }
    
    await savePlaylists(env, playlists);
    
    // Log activity
    await logAdminActivity(env, auth.session.id, 'edit', 'playlist', playlistId, title);
    
    return { success: true, redirect: '/admin/playlists?updated=1' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== HANDLE PLAYLIST DELETION - UPDATED to use trash =====
export async function handleAdminPlaylistDelete(req, env, ctx, auth) {
  const url = new URL(req.url);
  const playlistId = url.searchParams.get('id');
  
  if (!playlistId) {
    return { success: false, error: 'No playlist specified' };
  }
  
  try {
    const playlists = await getPlaylists(env);
    const playlist = playlists[playlistId];
    const playlistTitle = playlist?.title || 'Unknown playlist';
    
    // Get thumbnail path
    let thumbnailPath = null;
    if (playlist?.thumbnail) {
      thumbnailPath = playlist.thumbnail;
    }
    
    // Prepare metadata
    const itemData = {
      title: playlist?.title,
      description: playlist?.description,
      curator: playlist?.curator,
      songs: playlist?.songs,
      genres: playlist?.genres,
      created: playlist?.created,
      updated: playlist?.updated,
      thumbnail: playlist?.thumbnail
      // slug: playlist?.slug  // REMOVE THIS
    };
    
    // Move to trash
    const result = await moveToTrash(
      env,
      auth.session.id,
      'playlist',
      playlistId,
      playlistTitle,
      itemData,
      0 // Playlists don't have size
    );
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    // Remove from playlists index
    delete playlists[playlistId];
    await savePlaylists(env, playlists);
    
    // Log activity
    await logAdminActivity(env, auth.session.id, 'delete', 'playlist', playlistId, playlistTitle);
    
    return { success: true };
  } catch (error) {
    console.error('Error moving playlist to trash:', error);
    return { success: false, error: error.message };
  }
}

// ===== MANAGE PLAYLIST SONGS PAGE =====
export async function handleAdminPlaylistSongs(req, env, ctx, auth) {
  const url = new URL(req.url);
  const playlistId = url.searchParams.get('id');
  
  if (!playlistId) {
    return { redirect: '/admin/playlists' };
  }
  
  const playlists = await getPlaylists(env);
  const playlist = playlists[playlistId];
  const artists = await getArtists(env);
  
  if (!playlist) {
    return { redirect: '/admin/playlists' };
  }
  
  // Get all songs
  const songList = await env.media.list({ prefix: "songs/" });
  const songs = songList.objects || [];
  
  // Build song options with metadata
  const songOptions = await Promise.all(
    songs.map(async (song) => {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const inPlaylist = playlist.songs?.includes(baseName);
      const meta = await getMetadata(env, baseName);
      
      let artistName = baseName.split('_')[0];
      if (meta?.primaryArtist) {
        artistName = artists[meta.primaryArtist]?.name || meta.primaryArtist;
      }
      
      const title = meta?.title || baseName.split('_').slice(1).join(' ') || baseName;
      
      return `
        <tr>
            <td><input type="checkbox" name="songs" value="${baseName}" ${inPlaylist ? 'checked' : ''}></td>
            <td>${title}</td>
            <td>${artistName}</td>
            <td>${inPlaylist ? '<span class="badge" style="background:#4a90e2; color:white;">In Playlist</span>' : '-'}</td>
        </tr>
      `;
    })
  );
  
  const content = `
    <div style="max-width: 800px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-music"></i> Manage Songs: ${playlist.title}</h2>
        
        <form id="songsForm" action="/admin/playlists/songs" method="POST">
            <input type="hidden" name="playlistId" value="${playlistId}">
            
            <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button type="button" onclick="checkAll()" class="btn btn-secondary btn-sm">Select All</button>
                <button type="button" onclick="uncheckAll()" class="btn btn-secondary btn-sm">Deselect All</button>
                <span style="flex:1;"></span>
                <span><strong>Total Songs:</strong> ${playlist.songs?.length || 0}</span>
            </div>
            
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="selectAll" onclick="toggleAll()"></th>
                            <th>Song</th>
                            <th>Artist</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${songOptions.join('')}
                        ${songOptions.length === 0 ? `
                            <tr>
                                <td colspan="4" style="text-align: center; padding: 40px;">
                                    <i class="fas fa-music" style="font-size: 2rem; color: #ccc;"></i>
                                    <p>No songs found</p>
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 30px;">
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i> Save Changes
                </button>
                <a href="/admin/playlists" class="btn btn-secondary">
                    <i class="fas fa-times"></i> Cancel
                </a>
            </div>
        </form>
    </div>
    
    <script>
        function checkAll() {
            document.querySelectorAll('input[name="songs"]').forEach(cb => cb.checked = true);
            document.getElementById('selectAll').checked = true;
        }
        
        function uncheckAll() {
            document.querySelectorAll('input[name="songs"]').forEach(cb => cb.checked = false);
            document.getElementById('selectAll').checked = false;
        }
        
        function toggleAll() {
            const selectAll = document.getElementById('selectAll').checked;
            document.querySelectorAll('input[name="songs"]').forEach(cb => cb.checked = selectAll);
        }
        
        document.getElementById('songsForm').addEventListener('submit', function(e) {
            if (!confirm('Update playlist songs?')) {
                e.preventDefault();
            }
        });
    </script>
  `;
  
  return { content };
}

// ===== HANDLE PLAYLIST SONGS UPDATE =====
export async function handleAdminPlaylistSongsPost(req, env, ctx, auth) {
  const formData = await req.formData();
  const playlistId = formData.get('playlistId');
  const selectedSongs = formData.getAll('songs');
  
  if (!playlistId) {
    return { success: false, error: 'No playlist specified' };
  }
  
  try {
    const playlists = await getPlaylists(env);
    const playlistTitle = playlists[playlistId]?.title || 'Unknown playlist';
    
    if (!playlists[playlistId]) {
      return { success: false, error: 'Playlist not found' };
    }
    
    // Update playlist songs
    playlists[playlistId].songs = selectedSongs;
    playlists[playlistId].updated = Date.now();
    await savePlaylists(env, playlists);
    
    // Log activity
    await logAdminActivity(env, auth.session.id, 'update', 'playlist-songs', playlistId, 
      `Updated songs for ${playlistTitle}`);
    
    return { success: true, redirect: '/admin/playlists?updated=1' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== HELPER FUNCTIONS =====

// Mobile card with views (UPDATED to use id instead of slug)
function generateMobileCard(playlist) {
  const updated = new Date(playlist.updated).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short'
  });
  
  return `
    <div class="mobile-card">
        <div style="font-weight:700; margin-bottom:5px;">${playlist.title}</div>
        <div style="color:#4a90e2; margin-bottom:8px;">by ${playlist.curator}</div>
        <div style="font-size:0.7rem; color:#4a90e2; margin-bottom:8px;">
            <i class="fas fa-link"></i> /playlist/${playlist.id}
        </div>
        <div style="display:flex; gap:15px; flex-wrap:wrap; margin-bottom:8px;">
            <span><i class="fas fa-music"></i> ${playlist.songCount} songs</span>
            <span><i class="fas fa-users"></i> ${playlist.artistCount} artists</span>
            <span><i class="fas fa-play" style="color:#ff5500;"></i> ${formatNumber(playlist.plays)}</span>
            <span><i class="fas fa-eye" style="color:#4a90e2;"></i> ${formatNumber(playlist.views || 0)}</span>
        </div>
        <div style="font-size:0.75rem; color:#999; margin-bottom:10px;">Updated ${updated}</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button onclick="previewModal.show('playlist', '${playlist.id}')" class="btn btn-info btn-sm" style="flex:1; background: #00b894; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-eye"></i> Preview
            </button>
            <button onclick="editPlaylist('${playlist.id}')" class="btn btn-primary btn-sm" style="flex:1; background: #4a90e2; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="manageSongs('${playlist.id}')" class="btn btn-secondary btn-sm" style="flex:1; background: #6c757d; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-music"></i> Songs
            </button>
            <button onclick="deletePlaylist('${playlist.id}')" class="btn btn-danger btn-sm" style="flex:1; background: #dc3545; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    </div>
  `;
}

// Grid card with views (UPDATED to use id instead of slug)
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
            <div class="playlist-id-info">
                <i class="fas fa-link"></i> /playlist/${playlist.id}
            </div>
            <div class="playlist-stats">
                <span><i class="fas fa-music"></i> ${playlist.songCount}</span>
                <span><i class="fas fa-users"></i> ${playlist.artistCount}</span>
                <span><i class="fas fa-play"></i> ${formatNumber(playlist.plays)}</span>
                <span><i class="fas fa-eye" style="color:#4a90e2;"></i> ${formatNumber(playlist.views || 0)}</span>
            </div>
            <div style="font-size:0.75rem; color:#999; margin-top:5px;">Updated ${updated}</div>
            <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
                <button onclick="previewModal.show('playlist', '${playlist.id}')" class="btn btn-info btn-sm" title="Quick Preview" style="background: #00b894; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="editPlaylist('${playlist.id}')" class="btn btn-primary btn-sm" title="Edit" style="background: #4a90e2; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="manageSongs('${playlist.id}')" class="btn btn-secondary btn-sm" title="Songs" style="background: #6c757d; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-music"></i>
                </button>
                <button onclick="deletePlaylist('${playlist.id}')" class="btn btn-danger btn-sm" title="Delete" style="background: #dc3545; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    </div>
  `;
}

// Pagination helper
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