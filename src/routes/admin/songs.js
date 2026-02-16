// ==================== ADMIN SONGS MANAGEMENT ====================
import { getArtists, getAlbums, getMetadata } from '../../helpers/storage.js';
import { getSongStats } from '../../helpers/db.js';
import { formatDuration, formatNumber } from '../../helpers/formatting.js';

export async function handleAdminSongs(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') || '';
  const sort = url.searchParams.get('sort') || 'date';
  const ITEMS_PER_PAGE = 20;

  // Get all songs
  const songList = await env.media.list({ prefix: "songs/" });
  const songs = songList.objects || [];
  const artists = await getArtists(env);
  const albums = await getAlbums(env);

  // Get detailed song data
  let songsData = await Promise.all(
    songs.map(async (song) => {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const meta = await getMetadata(env, baseName);
      const stats = await getSongStats(baseName, env);
      
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
        title: meta?.title || baseName.split('_').slice(1).join(' '),
        primaryArtist: meta?.primaryArtist || baseName.split('_')[0],
        primaryArtistName,
        featuredArtists: meta?.featuredArtists || [],
        featuredNames,
        album: albumInfo,
        duration: meta?.duration || 0,
        plays: stats.plays,
        downloads: stats.downloads,
        uploaded: new Date(song.uploaded),
        size: song.size
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

  // Apply sorting
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

  // Generate sort options
  const sortOptions = [
    { value: 'date', label: 'Date Added' },
    { value: 'title', label: 'Title' },
    { value: 'artist', label: 'Artist' },
    { value: 'plays', label: 'Most Played' },
    { value: 'downloads', label: 'Most Downloaded' },
    { value: 'duration', label: 'Duration' }
  ];

  const content = `
    <div style="margin-bottom: 20px;">
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <!-- Search and Filter Bar -->
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
                <a href="/admin/upload" class="btn btn-primary">
                    <i class="fas fa-cloud-upload-alt"></i> Upload New
                </a>
            </div>
            
            <!-- Stats Summary -->
            <div style="display: flex; gap: 15px; flex-wrap: wrap; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                <div><i class="fas fa-music" style="color: #ff5500;"></i> Total: <strong>${totalSongs}</strong> songs</div>
                <div><i class="fas fa-play" style="color: #ff5500;"></i> Total Plays: <strong>${formatNumber(songsData.reduce((acc, s) => acc + s.plays, 0))}</strong></div>
                <div><i class="fas fa-download" style="color: #ff5500;"></i> Total Downloads: <strong>${formatNumber(songsData.reduce((acc, s) => acc + s.downloads, 0))}</strong></div>
            </div>
        </div>
        
        <!-- Mobile Cards View -->
        <div class="mobile-cards">
            ${pageSongs.map(song => generateMobileCard(song, artists)).join('')}
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
        
        <!-- Desktop Table View -->
        <div class="table-responsive">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Artist</th>
                        <th>Album</th>
                        <th>Duration</th>
                        <th>Plays</th>
                        <th>Downloads</th>
                        <th>Added</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageSongs.map(song => generateTableRow(song)).join('')}
                    ${pageSongs.length === 0 ? `
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 40px;">
                                <i class="fas fa-music" style="font-size: 2rem; color: #ccc; margin-bottom: 10px; display: block;"></i>
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
            
            function searchSongs() {
                applyFilters();
            }
            
            // Enter key in search
            document.getElementById('searchInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') applyFilters();
            });
            
            // Delete confirmation
            window.deleteSong = function(baseName) {
                if (confirm('Are you sure you want to delete this song? This action cannot be undone.')) {
                    window.location.href = '/admin/songs/delete?name=' + encodeURIComponent(baseName);
                }
            };
            
            // Edit song
            window.editSong = function(baseName) {
                window.location.href = '/admin/songs/edit?name=' + encodeURIComponent(baseName);
            };
    </script>
  `;

  return content;
}

// Generate mobile card HTML
function generateMobileCard(song, artists) {
  const date = song.uploaded.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  const featuredHtml = song.featuredNames ? 
    `<div style="font-size: 0.8rem; color: #666; margin-top: 2px;">
        <i class="fas fa-users" style="color: #ff5500; width: 16px;"></i> ${song.featuredNames}
    </div>` : '';

  return `
    <div class="mobile-card">
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-heading"></i> Title:</span>
            <span class="mobile-card-value">${song.title}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-microphone"></i> Artist:</span>
            <span class="mobile-card-value">${song.primaryArtistName}</span>
        </div>
        ${featuredHtml}
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-compact-disc"></i> Album:</span>
            <span class="mobile-card-value">${song.album?.title || '—'}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-clock"></i> Duration:</span>
            <span class="mobile-card-value">${formatDuration(song.duration)}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-play"></i> Plays:</span>
            <span class="mobile-card-value">${formatNumber(song.plays)}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-download"></i> Downloads:</span>
            <span class="mobile-card-value">${formatNumber(song.downloads)}</span>
        </div>
        <div class="mobile-card-row">
            <span class="mobile-card-label"><i class="fas fa-calendar"></i> Added:</span>
            <span class="mobile-card-value">${date}</span>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button onclick="editSong('${song.baseName}')" class="btn btn-primary btn-sm" style="flex: 1;">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="deleteSong('${song.baseName}')" class="btn btn-danger btn-sm" style="flex: 1;">
                <i class="fas fa-trash"></i> Delete
            </button>
            <a href="/song/${encodeURIComponent(song.fileName)}" target="_blank" class="btn btn-secondary btn-sm" style="flex: 1;">
                <i class="fas fa-eye"></i> View
            </a>
        </div>
    </div>
  `;
}

// Generate table row HTML
function generateTableRow(song) {
  const date = song.uploaded.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  return `
    <tr>
        <td><strong>${song.title}</strong></td>
        <td>
            ${song.primaryArtistName}
            ${song.featuredNames ? `<br><small style="color: #666;">feat. ${song.featuredNames}</small>` : ''}
        </td>
        <td>${song.album?.title || '—'}</td>
        <td>${formatDuration(song.duration)}</td>
        <td>${formatNumber(song.plays)}</td>
        <td>${formatNumber(song.downloads)}</td>
        <td>${date}</td>
        <td>
            <div style="display: flex; gap: 5px;">
                <button onclick="editSong('${song.baseName}')" class="btn btn-primary btn-sm" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteSong('${song.baseName}')" class="btn btn-danger btn-sm" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
                <a href="/song/${encodeURIComponent(song.fileName)}" target="_blank" class="btn btn-secondary btn-sm" title="View">
                    <i class="fas fa-eye"></i>
                </a>
            </div>
        </td>
    </tr>
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

// Handle song deletion
export async function handleAdminSongDelete(req, env, ctx, auth) {
  const url = new URL(req.url);
  const baseName = url.searchParams.get('name');
  
  if (!baseName) {
    return { success: false, error: 'No song specified' };
  }
  
  try {
    // Delete from R2
    await env.media.delete(`songs/${baseName}.mp3`).catch(() => {});
    await env.media.delete(`images/${baseName}.jpg`).catch(() => {});
    await env.media.delete(`images/${baseName}.png`).catch(() => {});
    await env.media.delete(`descriptions/${baseName}.txt`).catch(() => {});
    await env.media.delete(`metadata/${baseName}.json`).catch(() => {});
    
    return { success: true };
  } catch (error) {
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
    <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-edit"></i> Edit Song</h2>
        
        <form id="editForm" action="/admin/songs/edit" method="POST">
            <input type="hidden" name="baseName" value="${baseName}">
            
            <div class="form-group">
                <label>Title</label>
                <input type="text" name="title" class="form-control" value="${meta?.title || baseName.split('_').slice(1).join(' ')}" required>
            </div>
            
            <div class="form-group">
                <label>Primary Artist ID</label>
                <input type="text" name="primaryArtist" class="form-control" value="${meta?.primaryArtist || baseName.split('_')[0]}" required>
                <p style="font-size: 0.8rem; color: #666;">Artist ID (e.g., yo_maps)</p>
            </div>
            
            <div class="form-group">
                <label>Featured Artists (comma-separated IDs)</label>
                <input type="text" name="featuredArtists" class="form-control" value="${meta?.featuredArtists?.join(', ') || ''}">
            </div>
            
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="form-control" rows="4">${description}</textarea>
            </div>
            
            <div class="form-group">
                <label>Duration (seconds)</label>
                <input type="number" name="duration" class="form-control" value="${meta?.duration || 0}" step="0.001">
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 30px;">
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i> Save Changes
                </button>
                <a href="/admin/songs" class="btn btn-secondary">
                    <i class="fas fa-times"></i> Cancel
                </a>
            </div>
        </form>
    </div>
    
    <script>
        document.getElementById('editForm').addEventListener('submit', function(e) {
            if (!confirm('Save changes to this song?')) {
                e.preventDefault();
            }
        });
    </script>
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
      duration
    };
    await saveMetadata(env, baseName, metadata);
    
    // Update description file
    await env.media.put(`descriptions/${baseName}.txt`, description);
    
    return { success: true, redirect: '/admin/songs' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}