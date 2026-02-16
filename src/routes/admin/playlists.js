// ==================== ADMIN PLAYLISTS MANAGEMENT ====================
import { getPlaylists, savePlaylists, getArtists, getAlbums, getMetadata } from '../../helpers/storage.js';
import { getAggregatedStats } from '../../helpers/db.js';
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
  
  // Get detailed playlist data with stats
  let playlistsData = await Promise.all(
    Object.entries(playlists).map(async ([id, playlist]) => {
      const stats = await getAggregatedStats(playlist.songs || [], env);
      
      // Get featured artists count (unique artists in playlist)
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

  // Apply sorting
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

  // Generate sort options
  const sortOptions = [
    { value: 'date', label: 'Date Created' },
    { value: 'updated', label: 'Last Updated' },
    { value: 'title', label: 'Title' },
    { value: 'curator', label: 'Curator' },
    { value: 'songs', label: 'Most Songs' },
    { value: 'artists', label: 'Most Artists' },
    { value: 'plays', label: 'Most Plays' }
  ];

  const content = `
    <div style="margin-bottom: 20px;">
        <!-- Header with Actions -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
                <h2 style="margin:0; font-size:1.3rem;"><i class="fas fa-list"></i> Playlists Management</h2>
                <a href="/admin/playlist/create" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Create New Playlist
                </a>
            </div>
            
            <!-- Search and Filter Bar -->
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
            
            <!-- Stats Summary -->
            <div style="display: flex; gap: 15px; flex-wrap: wrap; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                <div><i class="fas fa-list" style="color: #4a90e2;"></i> Total: <strong>${totalPlaylists}</strong> playlists</div>
                <div><i class="fas fa-music" style="color: #4a90e2;"></i> Total Songs: <strong>${playlistsData.reduce((acc, p) => acc + p.songCount, 0)}</strong></div>
                <div><i class="fas fa-users" style="color: #4a90e2;"></i> Total Artists: <strong>${playlistsData.reduce((acc, p) => acc + p.artistCount, 0)}</strong></div>
                <div><i class="fas fa-play" style="color: #4a90e2;"></i> Total Plays: <strong>${formatNumber(playlistsData.reduce((acc, p) => acc + p.plays, 0))}</strong></div>
            </div>
        </div>
        
        <!-- Mobile Cards View -->
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
        
        <!-- Desktop Grid View -->
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
            transition: transform 0.2s, box-shadow 0.2s;
            border: 1px solid #e8e8e8;
            cursor: pointer;
        }
        
        .playlist-grid-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(74,144,226,0.15);
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
            position: relative;
        }
        
        .playlist-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .playlist-thumbnail.no-image::before {
            content: "📋";
            font-size: 3rem;
            opacity: 0.8;
        }
        
        .playlist-info {
            padding: 15px;
        }
        
        .playlist-title {
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 5px;
            color: #333;
        }
        
        .playlist-curator {
            color: #4a90e2;
            font-size: 0.85rem;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        .playlist-stats {
            display: flex;
            gap: 12px;
            font-size: 0.8rem;
            color: #666;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        
        .playlist-stats span {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .playlist-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            border-top: 1px solid #e8e8e8;
            padding-top: 12px;
        }
        
        .updated-badge {
            background: #4a90e2;
            color: white;
            padding: 2px 8px;
            border-radius: 20px;
            font-size: 0.7rem;
            font-weight: 600;
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
            
            window.viewPlaylist = function(playlistId) {
                window.open('/playlist/' + playlistId, '_blank');
            };
            
            window.editPlaylist = function(playlistId) {
                window.location.href = '/admin/playlists/edit?id=' + encodeURIComponent(playlistId);
            };
            
            window.deletePlaylist = function(playlistId) {
                if (confirm('Are you sure you want to delete this playlist? This action cannot be undone.')) {
                    window.location.href = '/admin/playlists/delete?id=' + encodeURIComponent(playlistId);
                }
            };
            
            window.manageSongs = function(playlistId) {
                window.location.href = '/admin/playlists/songs?id=' + encodeURIComponent(playlistId);
            };
            
            window.featurePlaylist = function(playlistId, featured) {
                // This would be implemented to toggle featured status
                alert('Feature toggle coming soon!');
            };
    </script>
  `;

  return content;
}

// Generate mobile card HTML
function generateMobileCard(playlist) {
  const created = new Date(playlist.created).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  const updated = new Date(playlist.updated).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short'
  });
  
  return `
    <div class="mobile-card">
        <div style="display: flex; gap: 12px; margin-bottom: 10px;">
            <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; background: linear-gradient(135deg, #4a90e2, #9013fe); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white;">
                ${playlist.hasImage ? 
                    `<img src="/playlists/thumbnails/${playlist.id}.jpg" style="width:100%; height:100%; object-fit:cover;">` : 
                    `<span style="font-size: 1.5rem;">📋</span>`
                }
            </div>
            <div style="flex:1;">
                <div style="font-weight:700; font-size:1rem;">${playlist.title}</div>
                <div style="color:#4a90e2; font-size:0.85rem;">by ${playlist.curator}</div>
            </div>
        </div>
        
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-music"></i> Songs:</span>
            <span class="mobile-card-value">${playlist.songCount}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-users"></i> Artists:</span>
            <span class="mobile-card-value">${playlist.artistCount}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-play"></i> Plays:</span>
            <span class="mobile-card-value">${formatNumber(playlist.plays)}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-download"></i> Downloads:</span>
            <span class="mobile-card-value">${formatNumber(playlist.downloads)}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-calendar"></i> Updated:</span>
            <span class="mobile-card-value"><span class="updated-badge">${updated}</span></span>
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
            <button onclick="viewPlaylist('${playlist.id}')" class="btn btn-secondary btn-sm" style="flex:1;">
                <i class="fas fa-eye"></i> View
            </button>
            <button onclick="editPlaylist('${playlist.id}')" class="btn btn-primary btn-sm" style="flex:1;">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="manageSongs('${playlist.id}')" class="btn btn-secondary btn-sm" style="flex:1;">
                <i class="fas fa-music"></i> Songs
            </button>
            <button onclick="deletePlaylist('${playlist.id}')" class="btn btn-danger btn-sm" style="flex:1;">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    </div>
  `;
}

// Generate grid card HTML for desktop
function generateGridCard(playlist) {
  const updated = new Date(playlist.updated).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short'
  });
  
  return `
    <div class="playlist-grid-card">
        <div class="playlist-thumbnail ${!playlist.hasImage ? 'no-image' : ''}" onclick="viewPlaylist('${playlist.id}')">
            ${playlist.hasImage ? 
                `<img src="/playlists/thumbnails/${playlist.id}.jpg" alt="${playlist.title}">` : 
                ''
            }
        </div>
        <div class="playlist-info">
            <div class="playlist-title" onclick="viewPlaylist('${playlist.id}')">${playlist.title}</div>
            <div class="playlist-curator" onclick="viewPlaylist('${playlist.id}')">by ${playlist.curator}</div>
            
            <div class="playlist-stats">
                <span><i class="fas fa-music"></i> ${playlist.songCount}</span>
                <span><i class="fas fa-users"></i> ${playlist.artistCount}</span>
                <span><i class="fas fa-play"></i> ${formatNumber(playlist.plays)}</span>
            </div>
            
            <div style="font-size:0.75rem; color:#999; margin-top:5px;">
                <i class="fas fa-clock"></i> Updated ${updated}
            </div>
            
            <div class="playlist-actions">
                <button onclick="editPlaylist('${playlist.id}')" class="btn btn-primary btn-sm" style="flex:1;" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="manageSongs('${playlist.id}')" class="btn btn-secondary btn-sm" style="flex:1;" title="Songs">
                    <i class="fas fa-music"></i>
                </button>
                <button onclick="deletePlaylist('${playlist.id}')" class="btn btn-danger btn-sm" style="flex:1;" title="Delete">
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

// ===== EDIT PLAYLIST PAGE =====
export async function handleAdminPlaylistEdit(req, env, ctx, auth) {
  const url = new URL(req.url);
  const playlistId = url.searchParams.get('id');
  
  if (!playlistId) {
    return { redirect: '/admin/playlists' };
  }
  
  const playlists = await getPlaylists(env);
  const playlist = playlists[playlistId];
  
  if (!playlist) {
    return { redirect: '/admin/playlists' };
  }
  
  const content = `
    <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-edit"></i> Edit Playlist: ${playlist.title}</h2>
        
        <form id="editForm" action="/admin/playlists/edit" method="POST" enctype="multipart/form-data">
            <input type="hidden" name="playlistId" value="${playlistId}">
            
            <div class="form-group">
                <label>Playlist Title</label>
                <input type="text" name="title" class="form-control" value="${playlist.title}" required>
            </div>
            
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="form-control" rows="4">${playlist.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label>Curator Name</label>
                <input type="text" name="curator" class="form-control" value="${playlist.curator || 'ZEDALBUMS'}">
            </div>
            
            <div class="form-group">
                <label>Current Cover Image</label>
                ${playlist.thumbnail ? 
                    `<div style="margin-bottom:10px;">
                        <img src="/playlists/thumbnails/${playlistId}.jpg" style="width:100px; height:100px; border-radius:8px; object-fit:cover; border:3px solid #4a90e2;">
                    </div>` : 
                    '<p>No image</p>'
                }
                <label>New Cover Image (optional)</label>
                <input type="file" name="thumbnail" accept="image/*" class="form-control">
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
        document.getElementById('editForm').addEventListener('submit', function(e) {
            if (!confirm('Save changes to this playlist?')) {
                e.preventDefault();
            }
        });
    </script>
  `;
  
  return { content };
}

// Handle playlist edit submission
export async function handleAdminPlaylistEditPost(req, env, ctx, auth) {
  const formData = await req.formData();
  const playlistId = formData.get('playlistId');
  const title = formData.get('title');
  const description = formData.get('description');
  const curator = formData.get('curator');
  const thumbnailFile = formData.get('thumbnail');
  
  if (!playlistId || !title) {
    return { success: false, error: 'Missing required fields' };
  }
  
  try {
    const playlists = await getPlaylists(env);
    
    if (!playlists[playlistId]) {
      return { success: false, error: 'Playlist not found' };
    }
    
    // Update playlist details
    playlists[playlistId].title = title;
    playlists[playlistId].description = description;
    playlists[playlistId].curator = curator;
    playlists[playlistId].updated = Date.now();
    
    // Upload new thumbnail if provided
    if (thumbnailFile && thumbnailFile.size > 0) {
      const imgType = thumbnailFile.type.includes('png') ? 'png' : 'jpg';
      const thumbnailKey = `playlists/thumbnails/${playlistId}.${imgType}`;
      await env.media.put(thumbnailKey, thumbnailFile.stream());
      playlists[playlistId].thumbnail = thumbnailKey;
    }
    
    await savePlaylists(env, playlists);
    
    return { success: true, redirect: '/admin/playlists?updated=1' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle playlist deletion
export async function handleAdminPlaylistDelete(req, env, ctx, auth) {
  const url = new URL(req.url);
  const playlistId = url.searchParams.get('id');
  
  if (!playlistId) {
    return { success: false, error: 'No playlist specified' };
  }
  
  try {
    const playlists = await getPlaylists(env);
    
    // Delete thumbnail if exists
    if (playlists[playlistId]?.thumbnail) {
      await env.media.delete(playlists[playlistId].thumbnail).catch(() => {});
    }
    
    // Remove playlist from index
    delete playlists[playlistId];
    await savePlaylists(env, playlists);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== MANAGE PLAYLIST SONGS =====
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
      
      const title = meta?.title || baseName.split('_').slice(1).join(' ');
      
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

// Handle playlist songs update
export async function handleAdminPlaylistSongsPost(req, env, ctx, auth) {
  const formData = await req.formData();
  const playlistId = formData.get('playlistId');
  const selectedSongs = formData.getAll('songs');
  
  if (!playlistId) {
    return { success: false, error: 'No playlist specified' };
  }
  
  try {
    const playlists = await getPlaylists(env);
    
    if (!playlists[playlistId]) {
      return { success: false, error: 'Playlist not found' };
    }
    
    // Update playlist songs
    playlists[playlistId].songs = selectedSongs;
    playlists[playlistId].updated = Date.now();
    await savePlaylists(env, playlists);
    
    return { success: true, redirect: '/admin/playlists?updated=1' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}