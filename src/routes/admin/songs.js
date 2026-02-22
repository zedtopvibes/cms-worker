// ==================== ADMIN SONGS MANAGEMENT ====================
import { getArtists, getAlbums, getMetadata, saveMetadata } from '../../helpers/storage.js';
import { getSongStats } from '../../helpers/db.js';
import { getPageViews } from '../../helpers/pageViews.js';
import { formatDuration, formatNumber } from '../../helpers/formatting.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';
import { moveToTrash } from '../../helpers/trash.js';
import { GenreManager } from '../../helpers/genreManager.js';
import { SlugManager } from '../../helpers/slug.js';  // ADD THIS IMPORT

export async function handleAdminSongs(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') || '';
  const sort = url.searchParams.get('sort') || 'date';
  const ITEMS_PER_PAGE = 20;
  const slugManager = new SlugManager(env);  // ADD THIS

  // Get all songs
  const songList = await env.media.list({ prefix: "songs/" });
  const songs = songList.objects || [];
  const artists = await getArtists(env);
  const albums = await getAlbums(env);

  // Get detailed song data with views
  let songsData = await Promise.all(
    songs.map(async (song) => {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const meta = await getMetadata(env, baseName);
      const stats = await getSongStats(baseName, env);
      const pageViews = await getPageViews(env, 'song', baseName);
      
      // Get slug for this song
      const songSlug = await slugManager.getSlugFromId('songs', baseName) || baseName;
      
      // Find album
      let albumInfo = null;
      for (const [id, album] of Object.entries(albums)) {
        if (album.songs?.includes(baseName)) {
          albumInfo = { id, title: album.title };
          break;
        }
      }

      // Get artist names
      let primaryArtistName = baseName.split('_')[0];
      if (meta?.primaryArtist) {
        primaryArtistName = artists[meta.primaryArtist]?.name || meta.primaryArtist;
      }

      const featuredNames = meta?.featuredArtists?.map(id => artists[id]?.name || id).join(', ') || '';

      return {
        fileName,
        baseName,
        slug: songSlug,  // ADD THIS
        title: meta?.title || baseName.split('_').slice(1).join(' '),
        primaryArtist: meta?.primaryArtist || baseName.split('_')[0],
        primaryArtistName,
        featuredArtists: meta?.featuredArtists || [],
        featuredNames,
        album: albumInfo,
        duration: meta?.duration || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        views: pageViews,
        uploaded: new Date(song.uploaded),
        size: song.size,
        genre: meta?.genre || null,
        genres: meta?.genres || []
      };
    })
  );

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    songsData = songsData.filter(song => 
      song.title.toLowerCase().includes(searchLower) ||
      song.primaryArtistName.toLowerCase().includes(searchLower) ||
      song.featuredNames.toLowerCase().includes(searchLower) ||
      (song.album?.title || '').toLowerCase().includes(searchLower)
    );
  }

  // Apply sorting with views
  songsData.sort((a, b) => {
    switch (sort) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'artist':
        return a.primaryArtistName.localeCompare(b.primaryArtistName);
      case 'plays':
        return b.plays - a.plays;
      case 'downloads':
        return b.downloads - a.downloads;
      case 'views':
        return (b.views || 0) - (a.views || 0);
      case 'duration':
        return b.duration - a.duration;
      case 'date':
      default:
        return b.uploaded - a.uploaded;
    }
  });

  // Pagination
  const totalSongs = songsData.length;
  const totalPages = Math.ceil(totalSongs / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const pageSongs = songsData.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Sort options with views
  const sortOptions = [
    { value: 'date', label: 'Date Added' },
    { value: 'title', label: 'Title' },
    { value: 'artist', label: 'Artist' },
    { value: 'plays', label: 'Most Played' },
    { value: 'downloads', label: 'Most Downloaded' },
    { value: 'views', label: 'Most Viewed' },
    { value: 'duration', label: 'Duration' }
  ];

  // Calculate totals
  const totalPlays = songsData.reduce((acc, s) => acc + s.plays, 0);
  const totalDownloads = songsData.reduce((acc, s) => acc + s.downloads, 0);
  const totalViews = songsData.reduce((acc, s) => acc + (s.views || 0), 0);

  const content = `
    <div style="margin-bottom: 20px;">
        <!-- Header -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
                <h2 style="margin:0; font-size:1.3rem;"><i class="fas fa-music"></i> Songs Management</h2>
                <a href="/admin/upload" class="btn btn-primary">
                    <i class="fas fa-cloud-upload-alt"></i> Upload New
                </a>
            </div>
            
            <!-- Search and Filter -->
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                        <input type="text" id="searchInput" class="form-control" placeholder="Search songs, artists, albums..." 
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
                <div><i class="fas fa-music" style="color: #ff5500;"></i> Total: <strong>${totalSongs}</strong> songs</div>
                <div><i class="fas fa-play" style="color: #ff5500;"></i> Plays: <strong>${formatNumber(totalPlays)}</strong></div>
                <div><i class="fas fa-download" style="color: #ff5500;"></i> Downloads: <strong>${formatNumber(totalDownloads)}</strong></div>
                <div><i class="fas fa-eye" style="color: #4a90e2;"></i> Views: <strong>${formatNumber(totalViews)}</strong></div>
            </div>
        </div>
        
        <!-- Mobile Cards -->
        <div class="mobile-cards">
            ${pageSongs.map(song => generateMobileCard(song)).join('')}
            ${pageSongs.length === 0 ? `
                <div class="empty-state">
                    <i class="fas fa-music"></i>
                    <h3>No songs found</h3>
                    <p>Try adjusting your search or upload a new song</p>
                    <a href="/admin/upload" class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-cloud-upload-alt"></i> Upload Song
                    </a>
                </div>
            ` : ''}
        </div>
        
        <!-- Desktop Table -->
        <div class="table-responsive">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Artist</th>
                        <th>Album</th>
                        <th>Genre</th>
                        <th>Duration</th>
                        <th>Plays</th>
                        <th>Views</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageSongs.map(song => generateTableRow(song)).join('')}
                    ${pageSongs.length === 0 ? `
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 40px;">
                                <i class="fas fa-music" style="font-size: 2rem; color: #ccc;"></i><br>
                                No songs found
                            </td>
                        </tr>
                    ` : ''}
                </tbody>
            </table>
        </div>
        
        <!-- Pagination -->
        ${generatePagination(page, totalPages, search, sort)}
    </div>
    
    <style>
        @media (min-width: 768px) {
            .mobile-cards { display: none; }
        }
        @media (max-width: 767px) {
            .table-responsive { display: none; }
        }
    </style>
    
    <script>
        function applyFilters() {
            const search = document.getElementById('searchInput').value;
            const sort = document.getElementById('sortSelect').value;
            let url = '/admin/songs?';
            if (search) url += 'search=' + encodeURIComponent(search) + '&';
            url += 'sort=' + sort;
            window.location.href = url;
        }
        
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') applyFilters();
        });
        
        window.deleteSong = function(baseName) {
            if (confirm('Are you sure you want to delete this song? It will be moved to trash.')) {
                window.location.href = '/admin/songs/delete?name=' + encodeURIComponent(baseName);
            }
        };
        
        window.editSong = function(baseName) {
            window.location.href = '/admin/songs/edit?name=' + encodeURIComponent(baseName);
        };
    </script>
  `;

  return content;
}

// ===== EDIT/DELETE FUNCTIONS WITH ACTIVITY LOGGING =====

// Handle song deletion - UPDATED to use trash
export async function handleAdminSongDelete(req, env, ctx, auth) {
  const url = new URL(req.url);
  const baseName = url.searchParams.get('name');
  
  if (!baseName) {
    return { success: false, error: 'No song specified' };
  }
  
  try {
    // Get song metadata
    const meta = await getMetadata(env, baseName);
    const title = meta?.title || baseName;
    
    // Get thumbnail path
    let thumbnailPath = null;
    try {
      const jpgObj = await env.media.get(`images/${baseName}.jpg`);
      if (jpgObj) thumbnailPath = `images/${baseName}.jpg`;
      else {
        const pngObj = await env.media.get(`images/${baseName}.png`);
        if (pngObj) thumbnailPath = `images/${baseName}.png`;
      }
    } catch (e) {}
    
    // Get file size
    let totalSize = 0;
    try {
      const songObj = await env.media.get(`songs/${baseName}.mp3`);
      totalSize = songObj?.size || 0;
    } catch (e) {}
    
    // Prepare metadata for trash
    const itemData = {
      title: meta?.title,
      primaryArtist: meta?.primaryArtist,
      featuredArtists: meta?.featuredArtists,
      description: meta?.description,
      duration: meta?.duration,
      thumbnail: thumbnailPath,
      genre: meta?.genre,
      genres: meta?.genres
    };
    
    // Move to trash instead of deleting
    const result = await moveToTrash(
      env, 
      auth.session.id, 
      'song', 
      baseName, 
      title, 
      itemData,
      totalSize
    );
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    // Log activity
    await logAdminActivity(env, auth.session.id, 'delete', 'song', baseName, title);
    
    return { success: true };
  } catch (error) {
    console.error('Error moving song to trash:', error);
    return { success: false, error: error.message };
  }
}

// Edit song page
export async function handleAdminSongEdit(req, env, ctx, auth) {
  const url = new URL(req.url);
  const baseName = url.searchParams.get('name');
  
  if (!baseName) {
    return { redirect: '/admin/songs' };
  }
  
  // Get song data
  const meta = await getMetadata(env, baseName);
  const artists = await getArtists(env);
  const albums = await getAlbums(env);
  const slugManager = new SlugManager(env);  // ADD THIS
  
  // Get song slug
  const songSlug = await slugManager.getSlugFromId('songs', baseName) || baseName;
  
  // Load genres for selection
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  const genres = genresData.genres;
  const songGenre = meta?.genre || '';
  const songGenres = meta?.genres || [];
  
  // Find current album
  let currentAlbum = null;
  for (const [id, album] of Object.entries(albums)) {
    if (album.songs?.includes(baseName)) {
      currentAlbum = { id, title: album.title };
      break;
    }
  }
  
  // Get description
  let description = '';
  try {
    const descObj = await env.media.get(`descriptions/${baseName}.txt`);
    if (descObj) description = await descObj.text();
  } catch (e) {}
  
  const content = `
    <div style="max-width: 600px; margin: 0 auto; width: 100%; padding: 0 0 20px;">
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <a href="/admin/songs" class="btn btn-secondary btn-sm" style="align-self: flex-start;">
                <i class="fas fa-arrow-left"></i> Back
            </a>
            <h2 style="font-size: 1.3rem; margin:0;">
                <i class="fas fa-edit" style="color: #ff5500;"></i> Edit Song
            </h2>
            <div style="background: #f0f9ff; padding: 10px; border-radius: 8px; border-left: 4px solid #ff5500;">
                <i class="fas fa-link" style="color: #ff5500;"></i>
                <span style="margin-left: 5px;">Song URL:</span>
                <code style="background: white; padding: 4px 8px; border-radius: 4px; margin-left: 10px;">/song/${songSlug}</code>
            </div>
        </div>
        
        <form id="editForm" action="/admin/songs/edit" method="POST" style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8;">
            <input type="hidden" name="baseName" value="${baseName}">
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Title</label>
                <input type="text" name="title" class="form-control" value="${meta?.title || baseName.split('_').slice(1).join(' ')}" required style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Primary Artist ID</label>
                <input type="text" name="primaryArtist" class="form-control" value="${meta?.primaryArtist || baseName.split('_')[0]}" required style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
                <p style="font-size: 0.8rem; color: #666; margin-top: 5px;">Artist ID (e.g., yo_maps)</p>
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Featured Artists (comma-separated IDs)</label>
                <input type="text" name="featuredArtists" class="form-control" value="${meta?.featuredArtists?.join(', ') || ''}" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
            </div>
            
            <!-- GENRE SELECTION -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">
                    <i class="fas fa-tags" style="color: #ff5500;"></i> Genre
                </label>
                
                <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 15px; background: #f8f9fa;">
                    <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #666;">
                        <i class="fas fa-hand-pointer"></i> Select a genre:
                    </p>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;" id="genreChips">
                        <div class="genre-chip ${!songGenre ? 'selected' : ''}" 
                             data-id=""
                             onclick="selectGenre('')"
                             style="display: inline-flex; align-items: center; gap: 5px; padding: 8px 15px; background: ${!songGenre ? '#ff5500' : '#f0f0f0'}; color: ${!songGenre ? 'white' : '#333'}; border-radius: 30px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; border: 1px solid ${!songGenre ? '#ff5500' : '#e0e0e0'};">
                            <i class="fas fa-ban" style="color: ${!songGenre ? 'white' : '#999'};"></i>
                            <span>No Genre</span>
                        </div>
                        
                        ${genres.map(g => {
                          const isSelected = songGenre === g.id;
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
                    <input type="hidden" name="genre" id="selectedGenre" value="${songGenre}">
                </div>
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Description</label>
                <textarea name="description" class="form-control" rows="4" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">${description}</textarea>
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Duration (seconds)</label>
                <input type="number" name="duration" class="form-control" value="${meta?.duration || 0}" step="0.001" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 25px;">
                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 16px;">
                    <i class="fas fa-save"></i> Save Changes
                </button>
                <a href="/admin/songs" class="btn btn-secondary" style="width: 100%; padding: 14px; font-size: 16px; text-align: center; text-decoration: none;">
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
            if (!confirm('Save changes to this song?')) {
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

// Handle edit submission
export async function handleAdminSongEditPost(req, env, ctx, auth) {
  const formData = await req.formData();
  const baseName = formData.get('baseName');
  const title = formData.get('title');
  const primaryArtist = formData.get('primaryArtist');
  const featuredArtistsStr = formData.get('featuredArtists');
  const description = formData.get('description');
  const duration = parseFloat(formData.get('duration'));
  const genre = formData.get('genre');  // Get selected genre
  
  if (!baseName || !title || !primaryArtist) {
    return { success: false, error: 'Missing required fields' };
  }
  
  // Parse featured artists
  const featuredArtists = featuredArtistsStr
    ? featuredArtistsStr.split(',').map(s => s.trim()).filter(s => s)
    : [];
  
  try {
    // Update metadata
    const metadata = {
      title,
      primaryArtist,
      featuredArtists,
      description,
      duration,
      genre: genre || undefined  // Save genre (undefined if empty)
    };
    await saveMetadata(env, baseName, metadata);
    
    // Update description file
    await env.media.put(`descriptions/${baseName}.txt`, description);
    
    // Log activity
    await logAdminActivity(env, auth.session.id, 'edit', 'song', baseName, title);
    
    return { success: true, redirect: '/admin/songs?updated=1' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Mobile card with views
function generateMobileCard(song) {
  const date = song.uploaded.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  const featuredHtml = song.featuredNames ? 
    `<div style="font-size: 0.8rem; color: #666; margin-top: 2px;">
        <i class="fas fa-users" style="color: #ff5500;"></i> ${song.featuredNames}
    </div>` : '';

  const genreHtml = song.genre ? 
    `<span class="badge" style="background: #ff5500; color: white; margin-left: 5px;">${song.genre}</span>` : '';

  return `
    <div class="mobile-card">
        <div style="font-weight: 700; margin-bottom: 5px;">${song.title} ${genreHtml}</div>
        <div style="color: #ff5500; font-size: 0.9rem; margin-bottom: 5px;">${song.primaryArtistName}</div>
        ${featuredHtml}
        <div style="font-size: 0.85rem; color: #666; margin: 5px 0;">Album: ${song.album?.title || '—'}</div>
        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin: 8px 0;">
            <span><i class="fas fa-clock"></i> ${formatDuration(song.duration)}</span>
            <span><i class="fas fa-play" style="color: #ff5500;"></i> ${formatNumber(song.plays)}</span>
            <span><i class="fas fa-eye" style="color: #4a90e2;"></i> ${formatNumber(song.views || 0)}</span>
        </div>
        <div style="font-size: 0.75rem; color: #999; margin-bottom: 10px;">Added: ${date}</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button onclick="previewModal.show('song', '${song.baseName}')" class="btn btn-info btn-sm" style="flex:1; background: #00b894; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-eye"></i> Preview
            </button>
            <button onclick="editSong('${song.baseName}')" class="btn btn-primary btn-sm" style="flex:1; background: #ff5500; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="deleteSong('${song.baseName}')" class="btn btn-danger btn-sm" style="flex:1; background: #dc3545; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    </div>
  `;
}

// Table row with views
function generateTableRow(song) {
  const date = song.uploaded.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  const genreHtml = song.genre ? 
    `<span class="badge" style="background: #ff5500; color: white;">${song.genre}</span>` : '-';
  
  return `
    <tr>
        <td><strong>${song.title}</strong></td>
        <td>${song.primaryArtistName}${song.featuredNames ? `<br><small>feat. ${song.featuredNames}</small>` : ''}</td>
        <td>${song.album?.title || '—'}</td>
        <td>${genreHtml}</td>
        <td>${formatDuration(song.duration)}</td>
        <td>${formatNumber(song.plays)}</td>
        <td><span style="color: #4a90e2; font-weight: 600;">${formatNumber(song.views || 0)}</span></td>
        <td style="white-space: nowrap;">
            <button onclick="previewModal.show('song', '${song.baseName}')" class="btn btn-info btn-sm" title="Quick Preview" style="background: #00b894; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; margin-right: 5px;">
                <i class="fas fa-eye"></i>
            </button>
            <button onclick="editSong('${song.baseName}')" class="btn btn-primary btn-sm" title="Edit" style="background: #ff5500; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; margin-right: 5px;">
                <i class="fas fa-edit"></i>
            </button>
            <button onclick="deleteSong('${song.baseName}')" class="btn btn-danger btn-sm" title="Delete" style="background: #dc3545; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; margin-right: 5px;">
                <i class="fas fa-trash"></i>
            </button>
            <a href="/song/${song.slug}" target="_blank" class="btn btn-secondary btn-sm" title="View" style="background: #6c757d; color: white; border: none; padding: 6px 10px; border-radius: 6px; text-decoration: none; display: inline-block;">
                <i class="fas fa-external-link-alt"></i>
            </a>
        </td>
    </tr>
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