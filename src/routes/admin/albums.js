// ==================== ADMIN ALBUMS  MANAGEMENT ====================
import { getAlbums, getArtists, saveAlbums, getMetadata } from '../../helpers/storage.js';
import { getAggregatedStats } from '../../helpers/db.js';
import { getPageViews } from '../../helpers/pageViews.js';
import { formatNumber } from '../../helpers/formatting.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';
import { moveToTrash } from '../../helpers/trash.js';
import { GenreManager } from '../../helpers/genreManager.js';
// REMOVE: import { SlugManager } from '../../helpers/slug.js';

// ===== LIST ALL ALBUMS =====
export async function handleAdminAlbums(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') || '';
  const sort = url.searchParams.get('sort') || 'date';
  const ITEMS_PER_PAGE = 15;
  // REMOVE: const slugManager = new SlugManager(env);

  // Get all albums
  const albums = await getAlbums(env);
  const artists = await getArtists(env);
  
  // Get detailed album data with views
  let albumsData = await Promise.all(
    Object.entries(albums).map(async ([id, album]) => {
      const stats = await getAggregatedStats(album.songs || [], env);
      const pageViews = await getPageViews(env, 'album', id);
      
      // REMOVE slug lookup - use id directly
      // const albumSlug = await slugManager.getSlugFromId('albums', id) || id;
      
      // Get primary artist name
      let primaryArtist = 'Various';
      if (album.artists && album.artists.length > 0) {
        const artistObj = artists[album.artists[0]];
        if (artistObj) primaryArtist = artistObj.name;
      }
      
      // Get all artist names
      const artistNames = album.artists?.map(aid => artists[aid]?.name || aid).join(', ') || 'Various';
      
      return {
        id,
        // slug: albumSlug,  // REMOVE THIS
        title: album.title,
        description: album.description || '',
        thumbnail: album.thumbnail,
        primaryArtist,
        artistNames,
        artists: album.artists || [],
        songs: album.songs || [],
        songCount: album.songs?.length || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        views: pageViews,
        created: album.created,
        hasThumbnail: !!album.thumbnail,
        genre: album.genre || null
      };
    })
  );

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    albumsData = albumsData.filter(album => 
      album.title.toLowerCase().includes(searchLower) ||
      album.artistNames.toLowerCase().includes(searchLower) ||
      album.description.toLowerCase().includes(searchLower)
    );
  }

  // Apply sorting with views
  albumsData.sort((a, b) => {
    switch (sort) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'artist':
        return a.primaryArtist.localeCompare(b.primaryArtist);
      case 'songs':
        return b.songCount - a.songCount;
      case 'plays':
        return b.plays - a.plays;
      case 'downloads':
        return b.downloads - a.downloads;
      case 'views':
        return (b.views || 0) - (a.views || 0);
      case 'date':
      default:
        return b.created - a.created;
    }
  });

  // Pagination
  const totalAlbums = albumsData.length;
  const totalPages = Math.ceil(totalAlbums / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const pageAlbums = albumsData.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Sort options with views
  const sortOptions = [
    { value: 'date', label: 'Date Added' },
    { value: 'title', label: 'Title' },
    { value: 'artist', label: 'Artist' },
    { value: 'songs', label: 'Most Songs' },
    { value: 'plays', label: 'Most Played' },
    { value: 'downloads', label: 'Most Downloaded' },
    { value: 'views', label: 'Most Viewed' }
  ];

  // Calculate totals
  const totalSongs = albumsData.reduce((acc, a) => acc + a.songCount, 0);
  const totalPlays = albumsData.reduce((acc, a) => acc + a.plays, 0);
  const totalDownloads = albumsData.reduce((acc, a) => acc + a.downloads, 0);
  const totalViews = albumsData.reduce((acc, a) => acc + (a.views || 0), 0);

  const content = `
    <div style="margin-bottom: 20px;">
        <!-- Header -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
                <h2 style="margin:0; font-size:1.3rem;"><i class="fas fa-compact-disc"></i> Albums Management</h2>
                <a href="/admin/album/create" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Create New Album
                </a>
            </div>
            
            <!-- Search and Filter -->
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                        <input type="text" id="searchInput" class="form-control" placeholder="Search albums, artists..." 
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
                <div><i class="fas fa-compact-disc" style="color: #ff5500;"></i> Albums: <strong>${totalAlbums}</strong></div>
                <div><i class="fas fa-music" style="color: #ff5500;"></i> Songs: <strong>${totalSongs}</strong></div>
                <div><i class="fas fa-play" style="color: #ff5500;"></i> Plays: <strong>${formatNumber(totalPlays)}</strong></div>
                <div><i class="fas fa-download" style="color: #ff5500;"></i> Downloads: <strong>${formatNumber(totalDownloads)}</strong></div>
                <div><i class="fas fa-eye" style="color: #4a90e2;"></i> Views: <strong>${formatNumber(totalViews)}</strong></div>
            </div>
        </div>
        
        <!-- Mobile Cards -->
        <div class="mobile-cards">
            ${pageAlbums.map(album => generateMobileCard(album)).join('')}
            ${pageAlbums.length === 0 ? `
                <div class="empty-state">
                    <i class="fas fa-compact-disc"></i>
                    <h3>No albums found</h3>
                    <p>Try adjusting your search or create a new album</p>
                    <a href="/admin/album/create" class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Create New Album
                    </a>
                </div>
            ` : ''}
        </div>
        
        <!-- Desktop Grid -->
        <div class="albums-grid" style="display: none;">
            ${pageAlbums.map(album => generateGridCard(album)).join('')}
        </div>
        
        <!-- Pagination -->
        ${generatePagination(page, totalPages, search, sort)}
    </div>
    
    <style>
        .albums-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .album-grid-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            transition: transform 0.2s;
            border: 1px solid #e8e8e8;
        }
        
        .album-grid-card:hover {
            transform: translateY(-4px);
            border-color: #ff5500;
        }
        
        .album-thumbnail {
            width: 100%;
            aspect-ratio: 1;
            background: linear-gradient(135deg, #f0f0f0, #e8e8e8);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
            font-size: 3rem;
            cursor: pointer;
        }
        
        .album-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .album-info {
            padding: 15px;
        }
        
        .album-title {
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 5px;
            cursor: pointer;
        }
        
        .album-title:hover {
            color: #ff5500;
        }
        
        .album-artist {
            color: #ff5500;
            font-size: 0.9rem;
            margin-bottom: 8px;
            cursor: pointer;
        }
        
        .album-stats {
            display: flex;
            gap: 10px;
            font-size: 0.8rem;
            color: #666;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        
        .album-id-info {
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
            .albums-grid { display: grid !important; }
        }
    </style>
    
    <script>
        function applyFilters() {
            const search = document.getElementById('searchInput').value;
            const sort = document.getElementById('sortSelect').value;
            let url = '/admin/albums?';
            if (search) url += 'search=' + encodeURIComponent(search) + '&';
            url += 'sort=' + sort;
            window.location.href = url;
        }
        
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') applyFilters();
        });
        
        window.viewAlbum = function(id) { 
            window.open('/album/' + id, '_blank'); 
        };
        
        // REMOVE slug function
        // window.viewAlbumBySlug = function(slug) { 
        //     window.open('/album/' + slug, '_blank'); 
        // };
        
        window.editAlbum = function(id) { 
            window.location.href = '/admin/albums/edit?id=' + id; 
        };
        
        window.manageSongs = function(id) { 
            window.location.href = '/admin/albums/songs?id=' + id; 
        };
        
        window.deleteAlbum = function(id) {
            if (confirm('Delete this album? It will be moved to trash.')) {
                window.location.href = '/admin/albums/delete?id=' + id;
            }
        };
    </script>
  `;

  return content;
}

// ===== CREATE NEW ALBUM PAGE =====
export async function handleAdminAlbumCreate(req, env, ctx, auth) {
  // Load genres for selection
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  const genres = genresData.genres;

  const content = `
    <div style="max-width: 600px; margin: 0 auto; width: 100%; padding: 0 0 20px;">
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <a href="/admin/albums" class="btn btn-secondary btn-sm" style="align-self: flex-start;">
                <i class="fas fa-arrow-left"></i> Back
            </a>
            <h2 style="font-size: 1.3rem; margin:0;">
                <i class="fas fa-plus-circle" style="color: #ff5500;"></i> Create New Album
            </h2>
        </div>
        
        <form action="/admin/album/create" method="POST" enctype="multipart/form-data" style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8;">
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Album Title <span style="color: #ff5500;">*</span></label>
                <input type="text" name="title" class="form-control" placeholder="e.g. My Awesome Album" required style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Description</label>
                <textarea name="description" class="form-control" rows="4" placeholder="Album description..." required style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;"></textarea>
            </div>
            
            <!-- GENRE SELECTION -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">
                    <i class="fas fa-tags" style="color: #ff5500;"></i> Album Genre
                </label>
                
                <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 15px; background: #f8f9fa;">
                    <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #666;">
                        <i class="fas fa-hand-pointer"></i> Select a genre:
                    </p>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;" id="genreChips">
                        <div class="genre-chip" 
                             data-id=""
                             onclick="selectGenre('')"
                             style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 15px; background: #f0f0f0; color: #333; border-radius: 30px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; border: 1px solid #e0e0e0;">
                            <i class="fas fa-ban" style="color: #999;"></i>
                            <span>No Genre</span>
                        </div>
                        
                        ${genres.map(g => `
                            <div class="genre-chip" 
                                 data-id="${g.id}"
                                 data-color="${g.color}"
                                 onclick="selectGenre('${g.id}')"
                                 style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 15px; background: #f0f0f0; color: #333; border-radius: 30px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; border: 1px solid #e0e0e0;">
                                <i class="fas ${g.icon}" style="color: ${g.color};"></i>
                                <span>${g.name}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- Hidden input to store selected genre -->
                    <input type="hidden" name="genre" id="selectedGenre" value="">
                </div>
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Album Thumbnail <span style="color: #ff5500;">*</span></label>
                <input type="file" name="thumbnail" accept="image/*" class="form-control" required style="width: 100%; padding: 10px; border: 2px dashed #e0e0e0; border-radius: 8px;">
                <p style="font-size: 0.8rem; color: #666; margin-top: 5px;">Square image recommended (JPG or PNG)</p>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 25px;">
                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 16px;">
                    <i class="fas fa-save"></i> Create Album
                </button>
                <a href="/admin/albums" class="btn btn-secondary" style="width: 100%; padding: 14px; font-size: 16px; text-align: center; text-decoration: none;">
                    <i class="fas fa-times"></i> Cancel
                </a>
            </div>
        </form>
    </div>

    <script>
        function selectGenre(genreId) {
            // Update hidden input
            document.getElementById('selectedGenre').value = genreId;
            
            // Update chip styles
            document.querySelectorAll('.genre-chip').forEach(chip => {
                const chipGenreId = chip.dataset.id;
                const color = chip.dataset.color;
                
                if (chipGenreId === genreId) {
                    // Selected chip
                    chip.style.background = color || '#ff5500';
                    chip.style.color = 'white';
                    chip.style.borderColor = color || '#ff5500';
                    const icon = chip.querySelector('i');
                    if (icon) icon.style.color = 'white';
                } else {
                    // Non-selected chip
                    chip.style.background = '#f0f0f0';
                    chip.style.color = '#333';
                    chip.style.borderColor = '#e0e0e0';
                    const icon = chip.querySelector('i');
                    if (icon && chipGenreId) {
                        icon.style.color = color || '#999';
                    } else if (icon) {
                        icon.style.color = '#999';
                    }
                }
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

// ===== HANDLE ALBUM CREATION POST =====
export async function handleAdminAlbumCreatePost(req, env, ctx, auth) {
  const formData = await req.formData();
  const title = formData.get('title');
  const description = formData.get('description');
  const thumbnailFile = formData.get('thumbnail');
  const genre = formData.get('genre');

  if (!title || !thumbnailFile) {
    return { success: false, error: 'Missing required fields' };
  }

  const sanitize = (str) => str.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");
  const albumId = sanitize(title) + "_" + Date.now();
  const albums = await getAlbums(env);

  const imgType = thumbnailFile.type.includes('png') ? 'png' : 'jpg';
  const thumbnailKey = `albums/thumbnails/${albumId}.${imgType}`;
  await env.media.put(thumbnailKey, thumbnailFile.stream());

  // REMOVE slug generation and registration
  // const slugManager = new SlugManager(env);
  // const slug = slugManager.generateAlbumSlug(title);
  // await slugManager.registerSlug('albums', albumId, slug, { title });

  albums[albumId] = {
    id: albumId,
    title: title,
    description: description || "",
    thumbnail: thumbnailKey,
    created: Date.now(),
    songs: [],
    artists: [],
    genre: genre || undefined
    // slug: slug  // REMOVE THIS
  };

  await saveAlbums(env, albums);
  
  // Log activity
  await logAdminActivity(env, auth.session.id, 'create', 'album', albumId, title);

  return { 
    success: true, 
    redirect: `/admin/albums?created=1` 
  };
}

// ===== EDIT ALBUM PAGE =====
export async function handleAdminAlbumEdit(req, env, ctx, auth) {
  const url = new URL(req.url);
  const albumId = url.searchParams.get('id');
  
  if (!albumId) {
    return { redirect: '/admin/albums' };
  }
  
  const albums = await getAlbums(env);
  const album = albums[albumId];
  const artists = await getArtists(env);
  // REMOVE: const slugManager = new SlugManager(env);
  
  if (!album) {
    return { redirect: '/admin/albums' };
  }
  
  // REMOVE slug lookup - use albumId directly
  // const albumSlug = await slugManager.getSlugFromId('albums', albumId) || albumId;
  
  // Load genres for selection
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  const genres = genresData.genres;
  const albumGenre = album.genre || '';
  
  // Artist options for dropdown
  const artistOptions = Object.entries(artists).map(([id, artist]) => {
    const selected = album.artists?.includes(id) ? 'selected' : '';
    return `<option value="${id}" ${selected}>${artist.name}</option>`;
  }).join('');
  
  const content = `
    <div style="max-width: 600px; margin: 0 auto; width: 100%; padding: 0 0 20px;">
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <a href="/admin/albums" class="btn btn-secondary btn-sm" style="align-self: flex-start;">
                <i class="fas fa-arrow-left"></i> Back
            </a>
            <h2 style="font-size: 1.3rem; margin:0;">
                <i class="fas fa-edit" style="color: #ff5500;"></i> Edit Album: ${album.title}
            </h2>
            <div style="background: #f0f9ff; padding: 10px; border-radius: 8px; border-left: 4px solid #ff5500;">
                <i class="fas fa-link" style="color: #ff5500;"></i>
                <span style="margin-left: 5px;">Album URL:</span>
                <code style="background: white; padding: 4px 8px; border-radius: 4px; margin-left: 10px;">/album/${albumId}</code>
            </div>
        </div>
        
        <form id="editForm" action="/admin/albums/edit" method="POST" enctype="multipart/form-data" style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8;">
            <input type="hidden" name="albumId" value="${albumId}">
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Album Title</label>
                <input type="text" name="title" class="form-control" value="${album.title}" required style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Description</label>
                <textarea name="description" class="form-control" rows="4" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">${album.description || ''}</textarea>
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Artists (select multiple)</label>
                <select name="artists" multiple class="form-control" size="5" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
                    ${artistOptions}
                </select>
                <p style="font-size:0.8rem; color:#666; margin-top:5px;">Hold Ctrl/Cmd to select multiple artists</p>
            </div>
            
            <!-- GENRE SELECTION -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">
                    <i class="fas fa-tags" style="color: #ff5500;"></i> Album Genre
                </label>
                
                <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 15px; background: #f8f9fa;">
                    <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #666;">
                        <i class="fas fa-hand-pointer"></i> Select a genre:
                    </p>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;" id="genreChips">
                        <div class="genre-chip ${!albumGenre ? 'selected' : ''}" 
                             data-id=""
                             onclick="selectGenre('')"
                             style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 15px; background: ${!albumGenre ? '#ff5500' : '#f0f0f0'}; color: ${!albumGenre ? 'white' : '#333'}; border-radius: 30px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; border: 1px solid ${!albumGenre ? '#ff5500' : '#e0e0e0'};">
                            <i class="fas fa-ban" style="color: ${!albumGenre ? 'white' : '#999'};"></i>
                            <span>No Genre</span>
                        </div>
                        
                        ${genres.map(g => {
                          const isSelected = albumGenre === g.id;
                          return `
                            <div class="genre-chip ${isSelected ? 'selected' : ''}" 
                                 data-id="${g.id}"
                                 data-color="${g.color}"
                                 onclick="selectGenre('${g.id}')"
                                 style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 15px; background: ${isSelected ? g.color : '#f0f0f0'}; color: ${isSelected ? 'white' : '#333'}; border-radius: 30px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; border: 1px solid ${isSelected ? g.color : '#e0e0e0'};">
                                <i class="fas ${g.icon}" style="color: ${isSelected ? 'white' : g.color};"></i>
                                <span>${g.name}</span>
                            </div>
                          `;
                        }).join('')}
                    </div>
                    
                    <!-- Hidden input to store selected genre -->
                    <input type="hidden" name="genre" id="selectedGenre" value="${albumGenre}">
                </div>
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Current Thumbnail</label>
                ${album.thumbnail ? 
                    `<div style="margin-bottom:15px;">
                        <img src="/albums/thumbnails/${albumId}.jpg" style="max-width:200px; max-height:200px; border-radius:8px; border:1px solid #e0e0e0;">
                    </div>` : 
                    '<p style="color:#999; margin-bottom:10px;">No thumbnail</p>'
                }
                <label>New Thumbnail (optional)</label>
                <input type="file" name="thumbnail" accept="image/*" class="form-control" style="width:100%; padding:10px; border:2px dashed #e0e0e0; border-radius:8px;">
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 25px;">
                <button type="submit" class="btn btn-primary" style="width:100%; padding:14px; font-size:16px;">
                    <i class="fas fa-save"></i> Save Changes
                </button>
                <a href="/admin/albums" class="btn btn-secondary" style="width:100%; padding:14px; font-size:16px; text-align:center; text-decoration:none;">
                    <i class="fas fa-times"></i> Cancel
                </a>
            </div>
        </form>
    </div>

    <script>
        function selectGenre(genreId) {
            // Update hidden input
            document.getElementById('selectedGenre').value = genreId;
            
            // Update chip styles
            document.querySelectorAll('.genre-chip').forEach(chip => {
                const chipGenreId = chip.dataset.id;
                const color = chip.dataset.color;
                
                if (chipGenreId === genreId) {
                    // Selected chip
                    chip.style.background = color || '#ff5500';
                    chip.style.color = 'white';
                    chip.style.borderColor = color || '#ff5500';
                    const icon = chip.querySelector('i');
                    if (icon) icon.style.color = 'white';
                } else {
                    // Non-selected chip
                    chip.style.background = '#f0f0f0';
                    chip.style.color = '#333';
                    chip.style.borderColor = '#e0e0e0';
                    const icon = chip.querySelector('i');
                    if (icon && chipGenreId) {
                        icon.style.color = color || '#999';
                    } else if (icon) {
                        icon.style.color = '#999';
                    }
                }
            });
        }
        
        document.getElementById('editForm').addEventListener('submit', function(e) {
            if (!confirm('Save changes to this album?')) {
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

// ===== HANDLE ALBUM EDIT POST =====
export async function handleAdminAlbumEditPost(req, env, ctx, auth) {
  const formData = await req.formData();
  const albumId = formData.get('albumId');
  const title = formData.get('title');
  const description = formData.get('description');
  const artists = formData.getAll('artists');
  const genre = formData.get('genre');
  const thumbnailFile = formData.get('thumbnail');
  
  if (!albumId || !title) {
    return { success: false, error: 'Missing required fields' };
  }
  
  try {
    const albums = await getAlbums(env);
    // REMOVE: const slugManager = new SlugManager(env);
    
    if (!albums[albumId]) {
      return { success: false, error: 'Album not found' };
    }
    
    // REMOVE slug update logic
    // const oldTitle = albums[albumId].title;
    // if (oldTitle !== title) {
    //   const newSlug = slugManager.generateAlbumSlug(title);
    //   await slugManager.registerSlug('albums', albumId, newSlug, { title });
    //   albums[albumId].slug = newSlug;
    // }
    
    // Update album details
    albums[albumId].title = title;
    albums[albumId].description = description;
    albums[albumId].artists = artists.filter(a => a);
    albums[albumId].genre = genre || undefined;
    
    // Upload new thumbnail if provided
    if (thumbnailFile && thumbnailFile.size > 0) {
      const imgType = thumbnailFile.type.includes('png') ? 'png' : 'jpg';
      const thumbnailKey = `albums/thumbnails/${albumId}.${imgType}`;
      await env.media.put(thumbnailKey, thumbnailFile.stream());
      albums[albumId].thumbnail = thumbnailKey;
    }
    
    await saveAlbums(env, albums);
    
    // Log activity
    await logAdminActivity(env, auth.session.id, 'edit', 'album', albumId, title);
    
    return { success: true, redirect: '/admin/albums?updated=1' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== HANDLE ALBUM DELETION - UPDATED to use trash =====
export async function handleAdminAlbumDelete(req, env, ctx, auth) {
  const url = new URL(req.url);
  const albumId = url.searchParams.get('id');
  
  if (!albumId) {
    return { success: false, error: 'No album specified' };
  }
  
  try {
    const albums = await getAlbums(env);
    const album = albums[albumId];
    const albumTitle = album?.title || 'Unknown album';
    
    // Get thumbnail path
    let thumbnailPath = null;
    if (album?.thumbnail) {
      thumbnailPath = album.thumbnail;
    }
    
    // Calculate total size (sum of all songs in album)
    let totalSize = 0;
    if (album?.songs) {
      for (const songId of album.songs) {
        try {
          const songObj = await env.media.get(`songs/${songId}.mp3`);
          totalSize += songObj?.size || 0;
        } catch (e) {}
      }
    }
    
    // Prepare metadata
    const itemData = {
      title: album?.title,
      description: album?.description,
      artists: album?.artists,
      songs: album?.songs,
      genre: album?.genre,
      created: album?.created,
      thumbnail: album?.thumbnail
      // slug: album?.slug  // REMOVE THIS
    };
    
    // Move to trash
    const result = await moveToTrash(
      env,
      auth.session.id,
      'album',
      albumId,
      albumTitle,
      itemData,
      totalSize
    );
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    // Remove from albums index
    delete albums[albumId];
    await saveAlbums(env, albums);
    
    // Log activity
    await logAdminActivity(env, auth.session.id, 'delete', 'album', albumId, albumTitle);
    
    return { success: true };
  } catch (error) {
    console.error('Error moving album to trash:', error);
    return { success: false, error: error.message };
  }
}

// ===== MANAGE ALBUM SONGS PAGE =====
export async function handleAdminAlbumSongs(req, env, ctx, auth) {
  const url = new URL(req.url);
  const albumId = url.searchParams.get('id');
  
  if (!albumId) {
    return { redirect: '/admin/albums' };
  }
  
  const albums = await getAlbums(env);
  const album = albums[albumId];
  const artists = await getArtists(env);
  
  if (!album) {
    return { redirect: '/admin/albums' };
  }
  
  // Get all songs
  const songList = await env.media.list({ prefix: "songs/" });
  const songs = songList.objects || [];
  
  // Build song options
  const songOptions = await Promise.all(
    songs.map(async (song) => {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const inAlbum = album.songs?.includes(baseName);
      const artistId = baseName.split('_')[0];
      const artistName = artists[artistId]?.name || artistId;
      const meta = await getMetadata(env, baseName);
      const title = meta?.title || baseName;
      const genre = meta?.genre ? ` (${meta.genre})` : '';
      
      return `
        <tr>
            <td><input type="checkbox" name="songs" value="${baseName}" ${inAlbum ? 'checked' : ''}></td>
            <td>${title}</td>
            <td>${artistName}</td>
            <td>${inAlbum ? '<span class="badge badge-success">In Album</span>' : '-'}</td>
            <td>${genre}</td>
        </tr>
      `;
    })
  );
  
  const content = `
    <div style="max-width: 900px; margin: 0 auto;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
            <a href="/admin/albums" class="btn btn-secondary btn-sm">
                <i class="fas fa-arrow-left"></i> Back
            </a>
            <h2 style="font-size: 1.3rem; margin:0;">
                <i class="fas fa-music"></i> Manage Songs: ${album.title}
            </h2>
            ${album.genre ? `<span class="badge" style="background: #ff5500; color: white; margin-left: 10px;">${album.genre}</span>` : ''}
        </div>
        
        <form id="songsForm" action="/admin/albums/songs" method="POST" style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8;">
            <input type="hidden" name="albumId" value="${albumId}">
            
            <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                <button type="button" onclick="checkAll()" class="btn btn-secondary btn-sm">Select All</button>
                <button type="button" onclick="uncheckAll()" class="btn btn-secondary btn-sm">Deselect All</button>
                <span style="margin-left: 15px;">Total Songs: ${album.songs?.length || 0}</span>
            </div>
            
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;"><input type="checkbox" id="selectAll" onclick="toggleAll()"></th>
                            <th>Song</th>
                            <th>Artist</th>
                            <th>Status</th>
                            <th>Genre</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${songOptions.join('')}
                        ${songOptions.length === 0 ? `
                            <tr>
                                <td colspan="5" style="text-align: center; padding: 40px;">
                                    <i class="fas fa-music" style="font-size: 2rem; color: #ccc;"></i><br>
                                    No songs found
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
                <a href="/admin/albums" class="btn btn-secondary">
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
            if (!confirm('Update album songs?')) {
                e.preventDefault();
            }
        });
    </script>
  `;
  
  return { content };
}

// ===== HANDLE ALBUM SONGS UPDATE =====
export async function handleAdminAlbumSongsPost(req, env, ctx, auth) {
  const formData = await req.formData();
  const albumId = formData.get('albumId');
  const selectedSongs = formData.getAll('songs');
  
  if (!albumId) {
    return { success: false, error: 'No album specified' };
  }
  
  try {
    const albums = await getAlbums(env);
    const albumTitle = albums[albumId]?.title || 'Unknown album';
    
    if (!albums[albumId]) {
      return { success: false, error: 'Album not found' };
    }
    
    // Update album songs
    albums[albumId].songs = selectedSongs;
    await saveAlbums(env, albums);
    
    // Log activity
    await logAdminActivity(env, auth.session.id, 'update', 'album-songs', albumId, `Updated songs for ${albumTitle}`);
    
    return { success: true, redirect: '/admin/albums?updated=1' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== HELPER FUNCTIONS =====

// Mobile card with views (UPDATED to use id instead of slug)
function generateMobileCard(album) {
  const date = new Date(album.created).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  const genreHtml = album.genre ? 
    `<span class="badge" style="background: #ff5500; color: white; margin-left: 5px;">${album.genre}</span>` : '';

  return `
    <div class="mobile-card">
        <div style="font-weight:700; margin-bottom:5px;">${album.title} ${genreHtml}</div>
        <div style="color:#ff5500; margin-bottom:8px;">${album.primaryArtist}</div>
        <div style="display:flex; gap:15px; flex-wrap:wrap; margin-bottom:8px;">
            <span><i class="fas fa-music"></i> ${album.songCount} songs</span>
            <span><i class="fas fa-play" style="color:#ff5500;"></i> ${formatNumber(album.plays)}</span>
            <span><i class="fas fa-eye" style="color:#4a90e2;"></i> ${formatNumber(album.views || 0)}</span>
        </div>
        <div style="font-size:0.75rem; color:#999; margin-bottom:10px;">${date}</div>
        <div style="font-size:0.7rem; color:#4a90e2; margin-bottom:8px;">
            <i class="fas fa-link"></i> /album/${album.id}
        </div>
        <div style="display:flex; gap:8px;">
            <button onclick="editAlbum('${album.id}')" class="btn btn-primary btn-sm" style="flex:1;">Edit</button>
            <button onclick="manageSongs('${album.id}')" class="btn btn-secondary btn-sm" style="flex:1;">Songs</button>
            <button onclick="deleteAlbum('${album.id}')" class="btn btn-danger btn-sm" style="flex:1;">Delete</button>
        </div>
    </div>
  `;
}

// Grid card with views (UPDATED to use id instead of slug)
function generateGridCard(album) {
  return `
    <div class="album-grid-card">
        <div class="album-thumbnail" onclick="viewAlbum('${album.id}')">
            ${album.thumbnail ? `<img src="/albums/thumbnails/${album.id}.jpg">` : '💿'}
        </div>
        <div class="album-info">
            <div class="album-title" onclick="viewAlbum('${album.id}')">${album.title}</div>
            <div class="album-artist" onclick="viewAlbum('${album.id}')">${album.primaryArtist}</div>
            ${album.genre ? `<div style="color: #ff5500; font-size: 0.8rem; margin-bottom: 5px;">${album.genre}</div>` : ''}
            <div class="album-id-info">
                <i class="fas fa-link"></i> /album/${album.id}
            </div>
            <div class="album-stats">
                <span><i class="fas fa-music"></i> ${album.songCount}</span>
                <span><i class="fas fa-play"></i> ${formatNumber(album.plays)}</span>
                <span><i class="fas fa-eye" style="color:#4a90e2;"></i> ${formatNumber(album.views || 0)}</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:12px;">
                <button onclick="editAlbum('${album.id}')" class="btn btn-primary btn-sm" style="flex:1;">Edit</button>
                <button onclick="manageSongs('${album.id}')" class="btn btn-secondary btn-sm" style="flex:1;">Songs</button>
                <button onclick="deleteAlbum('${album.id}')" class="btn btn-danger btn-sm" style="flex:1;">Delete</button>
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