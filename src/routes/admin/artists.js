// ==================== ADMIN ARTISTS MANAGEMENT ====================
import { getArtists, saveArtists, getAlbums } from '../../helpers/storage.js';
import { getAggregatedStats } from '../../helpers/db.js';
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
  
  // Get detailed artist data with stats
  let artistsData = await Promise.all(
    Object.entries(artists).map(async ([id, artist]) => {
      const stats = await getAggregatedStats(artist.songs || [], env);
      
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

  // Apply sorting
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

  // Generate sort options
  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'songs', label: 'Most Songs' },
    { value: 'albums', label: 'Most Albums' },
    { value: 'plays', label: 'Most Plays' },
    { value: 'listeners', label: 'Monthly Listeners' },
    { value: 'date', label: 'Date Added' }
  ];

  const content = `
    <div style="margin-bottom: 20px;">
        <!-- Header with Actions -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
                <h2 style="margin:0; font-size:1.3rem;"><i class="fas fa-microphone"></i> Artists Management</h2>
                <a href="/admin/artist/create" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Create New Artist
                </a>
            </div>
            
            <!-- Search and Filter Bar -->
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
            
            <!-- Stats Summary -->
            <div style="display: flex; gap: 15px; flex-wrap: wrap; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                <div><i class="fas fa-microphone" style="color: #ff5500;"></i> Total: <strong>${totalArtists}</strong> artists</div>
                <div><i class="fas fa-music" style="color: #ff5500;"></i> Total Songs: <strong>${artistsData.reduce((acc, a) => acc + a.songCount, 0)}</strong></div>
                <div><i class="fas fa-compact-disc" style="color: #ff5500;"></i> Total Albums: <strong>${artistsData.reduce((acc, a) => acc + a.albumCount, 0)}</strong></div>
                <div><i class="fas fa-headphones" style="color: #ff5500;"></i> Monthly Listeners: <strong>${formatNumber(artistsData.reduce((acc, a) => acc + a.monthlyListeners, 0))}</strong></div>
            </div>
        </div>
        
        <!-- Mobile Cards View -->
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
        
        <!-- Desktop Grid View -->
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
            transition: transform 0.2s, box-shadow 0.2s;
            border: 1px solid #e8e8e8;
            cursor: pointer;
        }
        
        .artist-grid-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(255,85,0,0.15);
            border-color: #ff5500;
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
            position: relative;
        }
        
        .artist-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .artist-thumbnail.no-image::before {
            content: "🎤";
            font-size: 3rem;
            opacity: 0.8;
        }
        
        .artist-info {
            padding: 15px;
        }
        
        .artist-name {
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 5px;
            color: #333;
        }
        
        .artist-genre {
            color: #9b59b6;
            font-size: 0.85rem;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        .artist-stats {
            display: flex;
            gap: 12px;
            font-size: 0.8rem;
            color: #666;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        
        .artist-stats span {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .artist-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            border-top: 1px solid #e8e8e8;
            padding-top: 12px;
        }
        
        .listener-badge {
            background: #9b59b6;
            color: white;
            padding: 2px 8px;
            border-radius: 20px;
            font-size: 0.7rem;
            font-weight: 600;
            display: inline-block;
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
            
            window.viewArtist = function(artistId) {
                window.open('/artist/' + artistId, '_blank');
            };
            
            window.editArtist = function(artistId) {
                window.location.href = '/admin/artists/edit?id=' + encodeURIComponent(artistId);
            };
            
            window.deleteArtist = function(artistId) {
                if (confirm('Are you sure you want to delete this artist? This action cannot be undone.')) {
                    window.location.href = '/admin/artists/delete?id=' + encodeURIComponent(artistId);
                }
            };
            
            window.mergeArtist = function(artistId) {
                window.location.href = '/admin/artists/merge?id=' + encodeURIComponent(artistId);
            };
    </script>
  `;

  return content;
}

// Generate mobile card HTML
function generateMobileCard(artist) {
  const date = new Date(artist.created).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  return `
    <div class="mobile-card">
        <div style="display: flex; gap: 12px; margin-bottom: 10px;">
            <div style="width: 60px; height: 60px; border-radius: 30px; overflow: hidden; background: linear-gradient(135deg, #9b59b6, #8e44ad); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white;">
                ${artist.hasImage ? 
                    `<img src="/artists/thumbnails/${artist.id}.jpg" style="width:100%; height:100%; object-fit:cover;">` : 
                    `<span style="font-size: 1.5rem;">🎤</span>`
                }
            </div>
            <div style="flex:1;">
                <div style="font-weight:700; font-size:1rem;">${artist.name}</div>
                <div style="color:#9b59b6; font-size:0.85rem;">${artist.genre}</div>
            </div>
        </div>
        
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-music"></i> Songs:</span>
            <span class="mobile-card-value">${artist.songCount}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-compact-disc"></i> Albums:</span>
            <span class="mobile-card-value">${artist.albumCount}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-headphones"></i> Monthly:</span>
            <span class="mobile-card-value"><span class="listener-badge">${formatNumber(artist.monthlyListeners)}</span></span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-play"></i> Plays:</span>
            <span class="mobile-card-value">${formatNumber(artist.plays)}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-calendar"></i> Joined:</span>
            <span class="mobile-card-value">${date}</span>
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
            <button onclick="viewArtist('${artist.id}')" class="btn btn-secondary btn-sm" style="flex:1;">
                <i class="fas fa-eye"></i> View
            </button>
            <button onclick="editArtist('${artist.id}')" class="btn btn-primary btn-sm" style="flex:1;">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="mergeArtist('${artist.id}')" class="btn btn-secondary btn-sm" style="flex:1;">
                <i class="fas fa-compress"></i> Merge
            </button>
            <button onclick="deleteArtist('${artist.id}')" class="btn btn-danger btn-sm" style="flex:1;">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    </div>
  `;
}

// Generate grid card HTML for desktop
function generateGridCard(artist) {
  return `
    <div class="artist-grid-card">
        <div class="artist-thumbnail ${!artist.hasImage ? 'no-image' : ''}" onclick="viewArtist('${artist.id}')">
            ${artist.hasImage ? 
                `<img src="/artists/thumbnails/${artist.id}.jpg" alt="${artist.name}">` : 
                ''
            }
        </div>
        <div class="artist-info">
            <div class="artist-name" onclick="viewArtist('${artist.id}')">${artist.name}</div>
            <div class="artist-genre" onclick="viewArtist('${artist.id}')">${artist.genre}</div>
            
            <div class="artist-stats">
                <span><i class="fas fa-music"></i> ${artist.songCount}</span>
                <span><i class="fas fa-compact-disc"></i> ${artist.albumCount}</span>
                <span><i class="fas fa-headphones"></i> ${formatNumber(artist.monthlyListeners)}</span>
            </div>
            
            <div class="artist-actions">
                <button onclick="editArtist('${artist.id}')" class="btn btn-primary btn-sm" style="flex:1;" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="mergeArtist('${artist.id}')" class="btn btn-secondary btn-sm" style="flex:1;" title="Merge">
                    <i class="fas fa-compress"></i>
                </button>
                <button onclick="deleteArtist('${artist.id}')" class="btn btn-danger btn-sm" style="flex:1;" title="Delete">
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

// ===== EDIT ARTIST PAGE =====
export async function handleAdminArtistEdit(req, env, ctx, auth) {
  const url = new URL(req.url);
  const artistId = url.searchParams.get('id');
  
  if (!artistId) {
    return { redirect: '/admin/artists' };
  }
  
  const artists = await getArtists(env);
  const artist = artists[artistId];
  
  if (!artist) {
    return { redirect: '/admin/artists' };
  }
  
  const content = `
    <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-edit"></i> Edit Artist: ${artist.name}</h2>
        
        <form id="editForm" action="/admin/artists/edit" method="POST" enctype="multipart/form-data">
            <input type="hidden" name="artistId" value="${artistId}">
            
            <div class="form-group">
                <label>Artist Name</label>
                <input type="text" name="name" class="form-control" value="${artist.name}" required>
            </div>
            
            <div class="form-group">
                <label>Genre</label>
                <input type="text" name="genre" class="form-control" value="${artist.genre || ''}" placeholder="e.g. Zam Pop, Gospel, Hip Hop">
            </div>
            
            <div class="form-group">
                <label>Bio</label>
                <textarea name="description" class="form-control" rows="4">${artist.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label>Origin/Location</label>
                <input type="text" name="origin" class="form-control" value="${artist.origin || ''}" placeholder="e.g. Lusaka, Zambia">
            </div>
            
            <div class="form-group">
                <label>Current Image</label>
                ${artist.thumbnail ? 
                    `<div style="margin-bottom:10px;">
                        <img src="/artists/thumbnails/${artistId}.jpg" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid #9b59b6;">
                    </div>` : 
                    '<p>No image</p>'
                }
                <label>New Image (optional)</label>
                <input type="file" name="thumbnail" accept="image/*" class="form-control">
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 30px;">
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i> Save Changes
                </button>
                <a href="/admin/artists" class="btn btn-secondary">
                    <i class="fas fa-times"></i> Cancel
                </a>
            </div>
        </form>
    </div>
    
    <script>
        document.getElementById('editForm').addEventListener('submit', function(e) {
            if (!confirm('Save changes to this artist?')) {
                e.preventDefault();
            }
        });
    </script>
  `;
  
  return { content };
}

// Handle artist edit submission
export async function handleAdminArtistEditPost(req, env, ctx, auth) {
  const formData = await req.formData();
  const artistId = formData.get('artistId');
  const name = formData.get('name');
  const genre = formData.get('genre');
  const description = formData.get('description');
  const origin = formData.get('origin');
  const thumbnailFile = formData.get('thumbnail');
  
  if (!artistId || !name) {
    return { success: false, error: 'Missing required fields' };
  }
  
  try {
    const artists = await getArtists(env);
    
    if (!artists[artistId]) {
      return { success: false, error: 'Artist not found' };
    }
    
    // Update artist details
    artists[artistId].name = name;
    artists[artistId].genre = genre;
    artists[artistId].description = description;
    artists[artistId].origin = origin;
    
    // Upload new thumbnail if provided
    if (thumbnailFile && thumbnailFile.size > 0) {
      const imgType = thumbnailFile.type.includes('png') ? 'png' : 'jpg';
      const thumbnailKey = `artists/thumbnails/${artistId}.${imgType}`;
      await env.media.put(thumbnailKey, thumbnailFile.stream());
      artists[artistId].thumbnail = thumbnailKey;
    }
    
    await saveArtists(env, artists);
    
    return { success: true, redirect: '/admin/artists?updated=1' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle artist deletion
export async function handleAdminArtistDelete(req, env, ctx, auth) {
  const url = new URL(req.url);
  const artistId = url.searchParams.get('id');
  
  if (!artistId) {
    return { success: false, error: 'No artist specified' };
  }
  
  try {
    const artists = await getArtists(env);
    
    // Delete thumbnail if exists
    if (artists[artistId]?.thumbnail) {
      await env.media.delete(artists[artistId].thumbnail).catch(() => {});
    }
    
    // Remove artist from index
    delete artists[artistId];
    await saveArtists(env, artists);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== MERGE ARTISTS PAGE =====
export async function handleAdminArtistMerge(req, env, ctx, auth) {
  const url = new URL(req.url);
  const artistId = url.searchParams.get('id');
  
  if (!artistId) {
    return { redirect: '/admin/artists' };
  }
  
  const artists = await getArtists(env);
  const mainArtist = artists[artistId];
  
  if (!mainArtist) {
    return { redirect: '/admin/artists' };
  }
  
  // Get all other artists for merging
  const otherArtists = Object.entries(artists)
    .filter(([id]) => id !== artistId)
    .map(([id, artist]) => ({
      id,
      name: artist.name,
      songCount: artist.songs?.length || 0,
      albumCount: artist.albums?.length || 0
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const artistOptions = otherArtists.map(artist => 
    `<option value="${artist.id}">${artist.name} (${artist.songCount} songs, ${artist.albumCount} albums)</option>`
  ).join('');
  
  const content = `
    <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-compress"></i> Merge Artists</h2>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #9b59b6;">
            <p><strong>Main Artist:</strong> ${mainArtist.name}</p>
            <p><i class="fas fa-info-circle"></i> This artist will receive all songs and albums from the merged artist.</p>
        </div>
        
        <form id="mergeForm" action="/admin/artists/merge" method="POST">
            <input type="hidden" name="mainArtistId" value="${artistId}">
            
            <div class="form-group">
                <label>Select Artist to Merge into ${mainArtist.name}</label>
                <select name="mergeArtistId" class="form-control" required>
                    <option value="">-- Select Artist --</option>
                    ${artistOptions}
                </select>
            </div>
            
            <div class="form-group">
                <label>Action after merge</label>
                <div style="display: flex; gap: 20px; margin-top: 10px;">
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="deleteAfter" value="yes" checked> Delete merged artist
                    </label>
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="deleteAfter" value="no"> Keep merged artist
                    </label>
                </div>
            </div>
            
            <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Warning:</strong> This action cannot be undone. All songs and albums from the merged artist will be transferred to ${mainArtist.name}.
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 30px;">
                <button type="submit" class="btn btn-primary" onclick="return confirmMerge()">
                    <i class="fas fa-compress"></i> Merge Artists
                </button>
                <a href="/admin/artists" class="btn btn-secondary">
                    <i class="fas fa-times"></i> Cancel
                </a>
            </div>
        </form>
    </div>
    
    <script>
        function confirmMerge() {
            return confirm('Are you sure you want to merge these artists? This cannot be undone.');
        }
    </script>
  `;
  
  return { content };
}

// Handle artist merge
export async function handleAdminArtistMergePost(req, env, ctx, auth) {
  const formData = await req.formData();
  const mainArtistId = formData.get('mainArtistId');
  const mergeArtistId = formData.get('mergeArtistId');
  const deleteAfter = formData.get('deleteAfter');
  
  if (!mainArtistId || !mergeArtistId) {
    return { success: false, error: 'Missing artist IDs' };
  }
  
  if (mainArtistId === mergeArtistId) {
    return { success: false, error: 'Cannot merge an artist with itself' };
  }
  
  try {
    const artists = await getArtists(env);
    const albums = await getAlbums(env);
    
    const mainArtist = artists[mainArtistId];
    const mergeArtist = artists[mergeArtistId];
    
    if (!mainArtist || !mergeArtist) {
      return { success: false, error: 'Artist not found' };
    }
    
    // Transfer songs
    if (mergeArtist.songs) {
      for (const songKey of mergeArtist.songs) {
        if (!mainArtist.songs.includes(songKey)) {
          mainArtist.songs.push(songKey);
        }
      }
    }
    
    // Transfer albums
    if (mergeArtist.albums) {
      for (const albumId of mergeArtist.albums) {
        if (!mainArtist.albums.includes(albumId)) {
          mainArtist.albums.push(albumId);
        }
        
        // Update album's artists array
        if (albums[albumId]) {
          if (!albums[albumId].artists) albums[albumId].artists = [];
          if (!albums[albumId].artists.includes(mainArtistId)) {
            // Replace mergeArtistId with mainArtistId
            const index = albums[albumId].artists.indexOf(mergeArtistId);
            if (index !== -1) {
              albums[albumId].artists[index] = mainArtistId;
            } else {
              albums[albumId].artists.push(mainArtistId);
            }
          }
        }
      }
    }
    
    // Save updated albums
    await saveAlbums(env, albums);
    
    // Delete merged artist if requested
    if (deleteAfter === 'yes') {
      // Delete thumbnail if exists
      if (mergeArtist.thumbnail) {
        await env.media.delete(mergeArtist.thumbnail).catch(() => {});
      }
      delete artists[mergeArtistId];
    }
    
    // Save main artist
    await saveArtists(env, artists);
    
    return { success: true, redirect: '/admin/artists?merged=1' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}