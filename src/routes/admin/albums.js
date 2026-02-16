// ==================== ADMIN ALBUMS MANAGEMENT ====================
import { getAlbums, getArtists, saveAlbums } from '../../helpers/storage.js';
import { getAggregatedStats } from '../../helpers/db.js';
import { formatNumber } from '../../helpers/formatting.js';

export async function handleAdminAlbums(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') || '';
  const sort = url.searchParams.get('sort') || 'date';
  const ITEMS_PER_PAGE = 15;

  // Get all albums
  const albums = await getAlbums(env);
  const artists = await getArtists(env);
  
  // Get detailed album data with stats
  let albumsData = await Promise.all(
    Object.entries(albums).map(async ([id, album]) => {
      const stats = await getAggregatedStats(album.songs || [], env);
      
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
        created: album.created,
        hasThumbnail: !!album.thumbnail
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

  // Apply sorting
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

  // Generate sort options
  const sortOptions = [
    { value: 'date', label: 'Date Added' },
    { value: 'title', label: 'Title' },
    { value: 'artist', label: 'Artist' },
    { value: 'songs', label: 'Most Songs' },
    { value: 'plays', label: 'Most Played' },
    { value: 'downloads', label: 'Most Downloaded' }
  ];

  const content = `
    <div style="margin-bottom: 20px;">
        <!-- Header with Actions -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
                <h2 style="margin:0; font-size:1.3rem;"><i class="fas fa-compact-disc"></i> Albums Management</h2>
                <a href="/admin/album/create" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Create New Album
                </a>
            </div>
            
            <!-- Search and Filter Bar -->
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
            
            <!-- Stats Summary -->
            <div style="display: flex; gap: 15px; flex-wrap: wrap; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                <div><i class="fas fa-compact-disc" style="color: #ff5500;"></i> Total: <strong>${totalAlbums}</strong> albums</div>
                <div><i class="fas fa-music" style="color: #ff5500;"></i> Total Songs: <strong>${albumsData.reduce((acc, a) => acc + a.songCount, 0)}</strong></div>
                <div><i class="fas fa-play" style="color: #ff5500;"></i> Total Plays: <strong>${formatNumber(albumsData.reduce((acc, a) => acc + a.plays, 0))}</strong></div>
            </div>
        </div>
        
        <!-- Mobile Cards View -->
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
        
        <!-- Desktop Grid View -->
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
            transition: transform 0.2s, box-shadow 0.2s;
            border: 1px solid #e8e8e8;
            cursor: pointer;
        }
        
        .album-grid-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(255,85,0,0.15);
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
            position: relative;
        }
        
        .album-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .album-thumbnail.no-image::before {
            content: "💿";
            font-size: 3rem;
            opacity: 0.5;
        }
        
        .album-info {
            padding: 15px;
        }
        
        .album-title {
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 5px;
            color: #333;
        }
        
        .album-artist {
            color: #ff5500;
            font-size: 0.9rem;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        .album-stats {
            display: flex;
            gap: 10px;
            font-size: 0.8rem;
            color: #666;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        
        .album-stats span {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .album-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            border-top: 1px solid #e8e8e8;
            padding-top: 12px;
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
            
            window.viewAlbum = function(albumId) {
                window.open('/album/' + albumId, '_blank');
            };
            
            window.editAlbum = function(albumId) {
                window.location.href = '/admin/albums/edit?id=' + encodeURIComponent(albumId);
            };
            
            window.deleteAlbum = function(albumId) {
                if (confirm('Are you sure you want to delete this album? This action cannot be undone.')) {
                    window.location.href = '/admin/albums/delete?id=' + encodeURIComponent(albumId);
                }
            };
            
            window.manageSongs = function(albumId) {
                window.location.href = '/admin/albums/songs?id=' + encodeURIComponent(albumId);
            };
    </script>
  `;

  return content;
}

// Generate mobile card HTML
function generateMobileCard(album) {
  const date = new Date(album.created).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  return `
    <div class="mobile-card">
        <div style="display: flex; gap: 12px; margin-bottom: 10px;">
            <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; background: #f0f0f0; flex-shrink: 0;">
                ${album.thumbnail ? 
                    `<img src="/albums/thumbnails/${album.id}.jpg" style="width:100%; height:100%; object-fit:cover;">` : 
                    `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#999;">💿</div>`
                }
            </div>
            <div style="flex:1;">
                <div style="font-weight:700; font-size:1rem;">${album.title}</div>
                <div style="color:#ff5500; font-size:0.85rem;">${album.primaryArtist}</div>
            </div>
        </div>
        
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-music"></i> Songs:</span>
            <span class="mobile-card-value">${album.songCount}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-play"></i> Plays:</span>
            <span class="mobile-card-value">${formatNumber(album.plays)}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-download"></i> Downloads:</span>
            <span class="mobile-card-value">${formatNumber(album.downloads)}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-calendar"></i> Released:</span>
            <span class="mobile-card-value">${date}</span>
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
            <button onclick="viewAlbum('${album.id}')" class="btn btn-secondary btn-sm" style="flex:1;">
                <i class="fas fa-eye"></i> View
            </button>
            <button onclick="editAlbum('${album.id}')" class="btn btn-primary btn-sm" style="flex:1;">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="manageSongs('${album.id}')" class="btn btn-secondary btn-sm" style="flex:1;">
                <i class="fas fa-music"></i> Songs
            </button>
            <button onclick="deleteAlbum('${album.id}')" class="btn btn-danger btn-sm" style="flex:1;">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    </div>
  `;
}

// Generate grid card HTML for desktop
function generateGridCard(album) {
  const date = new Date(album.created).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  return `
    <div class="album-grid-card">
        <div class="album-thumbnail ${!album.thumbnail ? 'no-image' : ''}" onclick="viewAlbum('${album.id}')">
            ${album.thumbnail ? 
                `<img src="/albums/thumbnails/${album.id}.jpg" alt="${album.title}">` : 
                ''
            }
        </div>
        <div class="album-info">
            <div class="album-title" onclick="viewAlbum('${album.id}')">${album.title}</div>
            <div class="album-artist" onclick="viewAlbum('${album.id}')">${album.primaryArtist}</div>
            
            <div class="album-stats">
                <span><i class="fas fa-music"></i> ${album.songCount}</span>
                <span><i class="fas fa-play"></i> ${formatNumber(album.plays)}</span>
                <span><i class="fas fa-download"></i> ${formatNumber(album.downloads)}</span>
            </div>
            
            <div class="album-actions">
                <button onclick="editAlbum('${album.id}')" class="btn btn-primary btn-sm" style="flex:1;" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="manageSongs('${album.id}')" class="btn btn-secondary btn-sm" style="flex:1;" title="Manage Songs">
                    <i class="fas fa-music"></i>
                </button>
                <button onclick="deleteAlbum('${album.id}')" class="btn btn-danger btn-sm" style="flex:1;" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    </div>
  `;
}

// Generate pagination HTML
function generatePagination(currentPage, totalPages, search, sort) {
  if (totalPages <= 1) return '';

  let html = '<div class="pagination" style="margin-top: 30px; justify-content: center;">';
  
  // Previous button
  if (currentPage > 1) {
    html += `<a href="?page=${currentPage-1}&search=${encodeURIComponent(search)}&sort=${sort}" class="pagination-item pagination-prev">
                <i class="fas fa-chevron-left"></i> Prev
             </a>`;
  } else {
    html += `<span class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</span>`;
  }
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<a href="?page=${i}&search=${encodeURIComponent(search)}&sort=${sort}" 
                  class="pagination-item ${i === currentPage ? 'active' : ''}">${i}</a>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }
  
  // Next button
  if (currentPage < totalPages) {
    html += `<a href="?page=${currentPage+1}&search=${encodeURIComponent(search)}&sort=${sort}" class="pagination-item pagination-next">
                Next <i class="fas fa-chevron-right"></i>
             </a>`;
  } else {
    html += `<span class="pagination-item pagination-next disabled">Next <i class="fas fa-chevron-right"></i></span>`;
  }
  
  html += '</div>';
  return html;
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
  
  if (!album) {
    return { redirect: '/admin/albums' };
  }
  
  // Artist options for dropdown
  const artistOptions = Object.entries(artists).map(([id, artist]) => {
    const selected = album.artists?.includes(id) ? 'selected' : '';
    return `<option value="${id}" ${selected}>${artist.name}</option>`;
  }).join('');
  
  const content = `
    <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-edit"></i> Edit Album: ${album.title}</h2>
        
        <form id="editForm" action="/admin/albums/edit" method="POST" enctype="multipart/form-data">
            <input type="hidden" name="albumId" value="${albumId}">
            
            <div class="form-group">
                <label>Album Title</label>
                <input type="text" name="title" class="form-control" value="${album.title}" required>
            </div>
            
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="form-control" rows="4">${album.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label>Artists (select multiple)</label>
                <select name="artists" multiple class="form-control" size="5">
                    ${artistOptions}
                </select>
                <p style="font-size:0.8rem; color:#666;">Hold Ctrl/Cmd to select multiple artists</p>
            </div>
            
            <div class="form-group">
                <label>Current Thumbnail</label>
                ${album.thumbnail ? 
                    `<div style="margin-bottom:10px;">
                        <img src="/albums/thumbnails/${albumId}.jpg" style="max-width:200px; max-height:200px; border-radius:8px; border:1px solid #e0e0e0;">
                    </div>` : 
                    '<p>No thumbnail</p>'
                }
                <label>New Thumbnail (optional)</label>
                <input type="file" name="thumbnail" accept="image/*" class="form-control">
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
        document.getElementById('editForm').addEventListener('submit', function(e) {
            if (!confirm('Save changes to this album?')) {
                e.preventDefault();
            }
        });
    </script>
  `;
  
  return { content };
}

// Handle album edit submission
export async function handleAdminAlbumEditPost(req, env, ctx, auth) {
  const formData = await req.formData();
  const albumId = formData.get('albumId');
  const title = formData.get('title');
  const description = formData.get('description');
  const artists = formData.getAll('artists');
  const thumbnailFile = formData.get('thumbnail');
  
  if (!albumId || !title) {
    return { success: false, error: 'Missing required fields' };
  }
  
  try {
    const albums = await getAlbums(env);
    
    if (!albums[albumId]) {
      return { success: false, error: 'Album not found' };
    }
    
    // Update album details
    albums[albumId].title = title;
    albums[albumId].description = description;
    albums[albumId].artists = artists.filter(a => a); // Remove empty values
    
    // Upload new thumbnail if provided
    if (thumbnailFile && thumbnailFile.size > 0) {
      const imgType = thumbnailFile.type.includes('png') ? 'png' : 'jpg';
      const thumbnailKey = `albums/thumbnails/${albumId}.${imgType}`;
      await env.media.put(thumbnailKey, thumbnailFile.stream());
      albums[albumId].thumbnail = thumbnailKey;
    }
    
    await saveAlbums(env, albums);
    
    return { success: true, redirect: '/admin/albums?updated=1' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle album deletion
export async function handleAdminAlbumDelete(req, env, ctx, auth) {
  const url = new URL(req.url);
  const albumId = url.searchParams.get('id');
  
  if (!albumId) {
    return { success: false, error: 'No album specified' };
  }
  
  try {
    const albums = await getAlbums(env);
    
    // Delete thumbnail if exists
    if (albums[albumId]?.thumbnail) {
      await env.media.delete(albums[albumId].thumbnail).catch(() => {});
    }
    
    // Remove album from index
    delete albums[albumId];
    await saveAlbums(env, albums);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== MANAGE ALBUM SONGS =====
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
      
      return `
        <tr>
            <td><input type="checkbox" name="songs" value="${baseName}" ${inAlbum ? 'checked' : ''}></td>
            <td>${baseName}</td>
            <td>${artistName}</td>
            <td>${inAlbum ? '<span class="badge badge-success">In Album</span>' : '-'}</td>
        </tr>
      `;
    })
  );
  
  const content = `
    <div style="max-width: 800px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-music"></i> Manage Songs: ${album.title}</h2>
        
        <form id="songsForm" action="/admin/albums/songs" method="POST">
            <input type="hidden" name="albumId" value="${albumId}">
            
            <div style="margin-bottom: 20px;">
                <button type="button" onclick="checkAll()" class="btn btn-secondary btn-sm">Select All</button>
                <button type="button" onclick="uncheckAll()" class="btn btn-secondary btn-sm">Deselect All</button>
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

// Handle album songs update
export async function handleAdminAlbumSongsPost(req, env, ctx, auth) {
  const formData = await req.formData();
  const albumId = formData.get('albumId');
  const selectedSongs = formData.getAll('songs');
  
  if (!albumId) {
    return { success: false, error: 'No album specified' };
  }
  
  try {
    const albums = await getAlbums(env);
    
    if (!albums[albumId]) {
      return { success: false, error: 'Album not found' };
    }
    
    // Update album songs
    albums[albumId].songs = selectedSongs;
    await saveAlbums(env, albums);
    
    return { success: true, redirect: '/admin/albums?updated=1' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}