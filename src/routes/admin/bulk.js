// ==================== BULK OPERATIONS ====================
import { getAlbums, getArtists, getPlaylists, saveAlbums, saveArtists, savePlaylists, getMetadata, saveMetadata } from '../../helpers/storage.js';
import { getSongStats } from '../../helpers/db.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';
import { formatDuration, formatNumber } from '../../helpers/formatting.js';

export async function handleAdminBulk(req, env, ctx, auth) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'menu';
  const type = url.searchParams.get('type') || 'songs';

  if (action === 'menu') {
    return await renderBulkMenu(env, auth, type);
  } else if (action === 'select') {
    return await renderSelectionPage(env, auth, type, req);
  } else if (action === 'confirm') {
    return await renderConfirmPage(env, auth, req);
  } else if (action === 'execute') {
    return await executeBulkAction(req, env, ctx, auth);
  }

  return new Response('Invalid bulk action', { status: 400 });
}

// Render bulk operations menu
async function renderBulkMenu(env, auth, type) {
  const content = `
    <div style="max-width: 800px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-tasks" style="color: #ff5500;"></i> Bulk Operations</h2>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <div class="stat-card" style="padding: 20px; cursor: pointer;" onclick="window.location='/admin/bulk?action=select&type=songs'">
                <i class="fas fa-music" style="font-size: 2rem; color: #ff5500; margin-bottom: 10px;"></i>
                <h3 style="margin-bottom: 5px;">Bulk Songs</h3>
                <p style="color: #666; font-size: 0.9rem;">Delete, export, or add multiple songs to albums/playlists</p>
            </div>
            
            <div class="stat-card" style="padding: 20px; cursor: pointer;" onclick="window.location='/admin/bulk?action=select&type=albums'">
                <i class="fas fa-compact-disc" style="font-size: 2rem; color: #28a745; margin-bottom: 10px;"></i>
                <h3 style="margin-bottom: 5px;">Bulk Albums</h3>
                <p style="color: #666; font-size: 0.9rem;">Delete or export multiple albums</p>
            </div>
            
            <div class="stat-card" style="padding: 20px; cursor: pointer;" onclick="window.location='/admin/bulk?action=select&type=artists'">
                <i class="fas fa-microphone" style="font-size: 2rem; color: #9b59b6; margin-bottom: 10px;"></i>
                <h3 style="margin-bottom: 5px;">Bulk Artists</h3>
                <p style="color: #666; font-size: 0.9rem;">Delete or export multiple artists</p>
            </div>
            
            <div class="stat-card" style="padding: 20px; cursor: pointer;" onclick="window.location='/admin/bulk?action=select&type=playlists'">
                <i class="fas fa-list" style="font-size: 2rem; color: #4a90e2; margin-bottom: 10px;"></i>
                <h3 style="margin-bottom: 5px;">Bulk Playlists</h3>
                <p style="color: #666; font-size: 0.9rem;">Delete or export multiple playlists</p>
            </div>
        </div>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px;">
            <h3 style="margin-bottom: 10px;">What can you do?</h3>
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 8px;"><i class="fas fa-check-circle" style="color: #28a745;"></i> Delete multiple items at once</li>
                <li style="margin-bottom: 8px;"><i class="fas fa-check-circle" style="color: #28a745;"></i> Export selected items as CSV</li>
                <li style="margin-bottom: 8px;"><i class="fas fa-check-circle" style="color: #28a745;"></i> Add multiple songs to an album</li>
                <li style="margin-bottom: 8px;"><i class="fas fa-check-circle" style="color: #28a745;"></i> Add multiple songs to a playlist</li>
            </ul>
        </div>
    </div>
    
    <style>
        .stat-card {
            transition: transform 0.2s, box-shadow 0.2s;
            text-align: center;
        }
        .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
    </style>
  `;

  return { content, title: 'Bulk Operations' };
}

// Render selection page
async function renderSelectionPage(env, auth, type, req) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') || '';
  const ITEMS_PER_PAGE = 20;

  let items = [];
  let totalItems = 0;

  if (type === 'songs') {
    const songList = await env.media.list({ prefix: "songs/" });
    const songs = songList.objects || [];
    const artists = await getArtists(env);
    const albums = await getAlbums(env);

    items = await Promise.all(
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

        return {
          id: baseName,
          title: meta?.title || baseName,
          artist: meta?.primaryArtist ? (artists[meta.primaryArtist]?.name || meta.primaryArtist) : baseName.split('_')[0],
          album: albumInfo?.title || '—',
          duration: meta?.duration || 0,
          plays: stats.plays,
          downloads: stats.downloads,
          selected: false
        };
      })
    );
    totalItems = items.length;
  } else if (type === 'albums') {
    const albums = await getAlbums(env);
    const artists = await getArtists(env);

    items = Object.entries(albums).map(([id, album]) => {
      const primaryArtist = album.artists?.length ? (artists[album.artists[0]]?.name || 'Various') : 'Various';
      return {
        id,
        title: album.title,
        artist: primaryArtist,
        songCount: album.songs?.length || 0,
        created: new Date(album.created).toLocaleDateString(),
        selected: false
      };
    });
    totalItems = items.length;
  } else if (type === 'artists') {
    const artists = await getArtists(env);

    items = Object.entries(artists).map(([id, artist]) => ({
      id,
      name: artist.name,
      genre: artist.genre || 'Various',
      songCount: artist.songs?.length || 0,
      albumCount: artist.albums?.length || 0,
      created: new Date(artist.created).toLocaleDateString(),
      selected: false
    }));
    totalItems = items.length;
  } else if (type === 'playlists') {
    const playlists = await getPlaylists(env);

    items = Object.entries(playlists).map(([id, playlist]) => ({
      id,
      title: playlist.title,
      curator: playlist.curator || 'ZEDALBUMS',
      songCount: playlist.songs?.length || 0,
      created: new Date(playlist.created).toLocaleDateString(),
      selected: false
    }));
    totalItems = items.length;
  }

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    items = items.filter(item => {
      if (type === 'songs') {
        return item.title.toLowerCase().includes(searchLower) || 
               item.artist.toLowerCase().includes(searchLower);
      } else if (type === 'albums') {
        return item.title.toLowerCase().includes(searchLower) || 
               item.artist.toLowerCase().includes(searchLower);
      } else if (type === 'artists') {
        return item.name.toLowerCase().includes(searchLower) || 
               item.genre.toLowerCase().includes(searchLower);
      } else if (type === 'playlists') {
        return item.title.toLowerCase().includes(searchLower) || 
               item.curator.toLowerCase().includes(searchLower);
      }
      return false;
    });
  }

  // Pagination
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const pageItems = items.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Get albums and playlists for add options (for songs)
  const albums = await getAlbums(env);
  const playlists = await getPlaylists(env);

  const albumOptions = Object.entries(albums).map(([id, album]) => 
    `<option value="${id}">${album.title}</option>`
  ).join('');

  const playlistOptions = Object.entries(playlists).map(([id, playlist]) => 
    `<option value="${id}">${playlist.title}</option>`
  ).join('');

  const content = `
    <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin:0;"><i class="fas fa-check-square"></i> Select ${type.charAt(0).toUpperCase() + type.slice(1)}</h2>
            <a href="/admin/bulk" class="btn btn-secondary">
                <i class="fas fa-arrow-left"></i> Back to Menu
            </a>
        </div>
        
        <!-- Search Bar -->
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <div style="flex: 1; position: relative;">
                <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                <input type="text" id="searchInput" class="form-control" placeholder="Search..." 
                       value="${search}" style="padding-left: 40px;">
            </div>
            <button onclick="applySearch()" class="btn btn-primary">Search</button>
        </div>
        
        <!-- Bulk Action Controls -->
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                <div>
                    <input type="checkbox" id="selectAll" onchange="toggleAll()">
                    <label for="selectAll">Select All (${pageItems.length})</label>
                </div>
                
                <div style="flex: 1;"></div>
                
                <select id="bulkAction" class="form-control" style="width: auto; min-width: 150px;">
                    <option value="">-- Choose Action --</option>
                    <option value="delete">🗑️ Delete Selected</option>
                    <option value="export">📥 Export Selected</option>
                    ${type === 'songs' ? `
                        <option value="addToAlbum">➕ Add to Album</option>
                        <option value="addToPlaylist">📋 Add to Playlist</option>
                    ` : ''}
                </select>
                
                ${type === 'songs' ? `
                    <select id="targetAlbum" class="form-control" style="width: auto; min-width: 150px; display: none;">
                        <option value="">-- Select Album --</option>
                        ${albumOptions}
                    </select>
                    
                    <select id="targetPlaylist" class="form-control" style="width: auto; min-width: 150px; display: none;">
                        <option value="">-- Select Playlist --</option>
                        ${playlistOptions}
                    </select>
                ` : ''}
                
                <button onclick="executeBulkAction()" class="btn btn-primary">Apply</button>
            </div>
        </div>
        
        <!-- Items List -->
        <div class="bulk-items">
            ${pageItems.map((item, index) => {
              if (type === 'songs') {
                return generateSongItem(item, index, startIdx);
              } else if (type === 'albums') {
                return generateAlbumItem(item, index, startIdx);
              } else if (type === 'artists') {
                return generateArtistItem(item, index, startIdx);
              } else if (type === 'playlists') {
                return generatePlaylistItem(item, index, startIdx);
              }
              return '';
            }).join('')}
            
            ${pageItems.length === 0 ? `
                <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-search" style="font-size: 3rem; color: #ccc;"></i>
                    <h3>No items found</h3>
                    <p>Try adjusting your search</p>
                </div>
            ` : ''}
        </div>
        
        <!-- Pagination -->
        ${generatePagination(page, totalPages, search, type)}
    </div>
    
    <style>
        .bulk-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 12px;
            background: white;
            border-radius: 8px;
            margin-bottom: 8px;
            border: 1px solid #e8e8e8;
        }
        .bulk-item:hover {
            background: #f8f9fa;
        }
        .item-info {
            flex: 1;
        }
        .item-title {
            font-weight: 600;
            margin-bottom: 4px;
        }
        .item-meta {
            font-size: 0.8rem;
            color: #666;
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        @media (max-width: 768px) {
            .bulk-item {
                flex-wrap: wrap;
            }
        }
    </style>
    
    <script>
        let selectedItems = new Set();
        
        function toggleAll() {
            const checkboxes = document.querySelectorAll('.item-checkbox');
            const selectAll = document.getElementById('selectAll').checked;
            checkboxes.forEach(cb => {
                cb.checked = selectAll;
                const id = cb.value;
                if (selectAll) {
                    selectedItems.add(id);
                } else {
                    selectedItems.delete(id);
                }
            });
            updateSelectedCount();
        }
        
        function toggleItem(checkbox) {
            const id = checkbox.value;
            if (checkbox.checked) {
                selectedItems.add(id);
            } else {
                selectedItems.delete(id);
                document.getElementById('selectAll').checked = false;
            }
            updateSelectedCount();
        }
        
        function updateSelectedCount() {
            const count = selectedItems.size;
            // You could display this somewhere
        }
        
        function applySearch() {
            const search = document.getElementById('searchInput').value;
            const url = new URL(window.location.href);
            url.searchParams.set('search', search);
            url.searchParams.set('page', '1');
            window.location.href = url.toString();
        }
        
        document.getElementById('bulkAction')?.addEventListener('change', function() {
            const action = this.value;
            const targetAlbum = document.getElementById('targetAlbum');
            const targetPlaylist = document.getElementById('targetPlaylist');
            
            if (targetAlbum) targetAlbum.style.display = 'none';
            if (targetPlaylist) targetPlaylist.style.display = 'none';
            
            if (action === 'addToAlbum' && targetAlbum) {
                targetAlbum.style.display = 'inline-block';
            } else if (action === 'addToPlaylist' && targetPlaylist) {
                targetPlaylist.style.display = 'inline-block';
            }
        });
        
        async function executeBulkAction() {
            const action = document.getElementById('bulkAction').value;
            if (!action) {
                alert('Please select an action');
                return;
            }
            
            if (selectedItems.size === 0) {
                alert('Please select at least one item');
                return;
            }
            
            let targetId = null;
            if (action === 'addToAlbum') {
                targetId = document.getElementById('targetAlbum').value;
                if (!targetId) {
                    alert('Please select an album');
                    return;
                }
            } else if (action === 'addToPlaylist') {
                targetId = document.getElementById('targetPlaylist').value;
                if (!targetId) {
                    alert('Please select a playlist');
                    return;
                }
            }
            
            if (action === 'delete') {
                if (!confirm(\`Are you sure you want to delete \${selectedItems.size} item(s)?\`)) {
                    return;
                }
            }
            
            // Submit to server
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/admin/bulk?action=execute';
            
            const itemsInput = document.createElement('input');
            itemsInput.type = 'hidden';
            itemsInput.name = 'items';
            itemsInput.value = JSON.stringify(Array.from(selectedItems));
            form.appendChild(itemsInput);
            
            const actionInput = document.createElement('input');
            actionInput.type = 'hidden';
            actionInput.name = 'bulkAction';
            actionInput.value = action;
            form.appendChild(actionInput);
            
            const typeInput = document.createElement('input');
            typeInput.type = 'hidden';
            typeInput.name = 'type';
            typeInput.value = '${type}';
            form.appendChild(typeInput);
            
            if (targetId) {
                const targetInput = document.createElement('input');
                targetInput.type = 'hidden';
                targetInput.name = 'targetId';
                targetInput.value = targetId;
                form.appendChild(targetInput);
            }
            
            document.body.appendChild(form);
            form.submit();
        }
    </script>
  `;

  return { content, title: `Bulk Select ${type}` };
}

// Generate song item
function generateSongItem(song, index, startIdx) {
  const duration = formatDuration(song.duration);
  return `
    <div class="bulk-item">
        <input type="checkbox" class="item-checkbox" value="${song.id}" onchange="toggleItem(this)">
        <div class="item-info">
            <div class="item-title">${song.title}</div>
            <div class="item-meta">
                <span><i class="fas fa-user"></i> ${song.artist}</span>
                <span><i class="fas fa-compact-disc"></i> ${song.album}</span>
                <span><i class="fas fa-clock"></i> ${duration}</span>
                <span><i class="fas fa-play"></i> ${formatNumber(song.plays)}</span>
            </div>
        </div>
    </div>
  `;
}

// Generate album item
function generateAlbumItem(album, index, startIdx) {
  return `
    <div class="bulk-item">
        <input type="checkbox" class="item-checkbox" value="${album.id}" onchange="toggleItem(this)">
        <div class="item-info">
            <div class="item-title">${album.title}</div>
            <div class="item-meta">
                <span><i class="fas fa-user"></i> ${album.artist}</span>
                <span><i class="fas fa-music"></i> ${album.songCount} tracks</span>
                <span><i class="fas fa-calendar"></i> ${album.created}</span>
            </div>
        </div>
    </div>
  `;
}

// Generate artist item
function generateArtistItem(artist, index, startIdx) {
  return `
    <div class="bulk-item">
        <input type="checkbox" class="item-checkbox" value="${artist.id}" onchange="toggleItem(this)">
        <div class="item-info">
            <div class="item-title">${artist.name}</div>
            <div class="item-meta">
                <span><i class="fas fa-tag"></i> ${artist.genre}</span>
                <span><i class="fas fa-music"></i> ${artist.songCount} songs</span>
                <span><i class="fas fa-compact-disc"></i> ${artist.albumCount} albums</span>
            </div>
        </div>
    </div>
  `;
}

// Generate playlist item
function generatePlaylistItem(playlist, index, startIdx) {
  return `
    <div class="bulk-item">
        <input type="checkbox" class="item-checkbox" value="${playlist.id}" onchange="toggleItem(this)">
        <div class="item-info">
            <div class="item-title">${playlist.title}</div>
            <div class="item-meta">
                <span><i class="fas fa-user"></i> ${playlist.curator}</span>
                <span><i class="fas fa-music"></i> ${playlist.songCount} songs</span>
                <span><i class="fas fa-calendar"></i> ${playlist.created}</span>
            </div>
        </div>
    </div>
  `;
}

// Generate pagination
function generatePagination(currentPage, totalPages, search, type) {
  if (totalPages <= 1) return '';

  let html = '<div class="pagination" style="margin-top: 30px; justify-content: center;">';
  
  if (currentPage > 1) {
    html += `<a href="/admin/bulk?action=select&type=${type}&page=${currentPage-1}&search=${encodeURIComponent(search)}" class="pagination-item pagination-prev"><i class="fas fa-chevron-left"></i> Prev</a>`;
  } else {
    html += `<span class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</span>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const active = i === currentPage ? 'active' : '';
      html += `<a href="/admin/bulk?action=select&type=${type}&page=${i}&search=${encodeURIComponent(search)}" class="pagination-item ${active}">${i}</a>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  if (currentPage < totalPages) {
    html += `<a href="/admin/bulk?action=select&type=${type}&page=${currentPage+1}&search=${encodeURIComponent(search)}" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>`;
  } else {
    html += `<span class="pagination-item pagination-next disabled">Next <i class="fas fa-chevron-right"></i></span>`;
  }

  html += '</div>';
  return html;
}

// Render confirmation page
async function renderConfirmPage(env, auth, req) {
  const formData = await req.formData();
  const itemsJson = formData.get('items');
  const bulkAction = formData.get('bulkAction');
  const type = formData.get('type');
  const targetId = formData.get('targetId');

  const items = JSON.parse(itemsJson);
  
  let targetName = '';
  if (targetId) {
    try {
      if (bulkAction === 'addToAlbum') {
        const albums = await getAlbums(env);
        targetName = albums[targetId]?.title || targetId;
      } else if (bulkAction === 'addToPlaylist') {
        const playlists = await getPlaylists(env);
        targetName = playlists[targetId]?.title || targetId;
      }
    } catch (e) {
      targetName = targetId; // Fallback to ID if lookup fails
    }
  }

  const actionNames = {
    'delete': 'Delete',
    'export': 'Export',
    'addToAlbum': `Add to Album: ${targetName}`,
    'addToPlaylist': `Add to Playlist: ${targetName}`
  };

  const content = `
    <div style="max-width: 600px; margin: 0 auto; text-align: center;">
        <h2 style="margin-bottom: 20px;">Confirm Bulk Action</h2>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <i class="fas ${bulkAction === 'delete' ? 'fa-exclamation-triangle' : 'fa-check-circle'}" 
               style="font-size: 3rem; color: ${bulkAction === 'delete' ? '#dc3545' : '#28a745'}; margin-bottom: 15px;"></i>
            
            <h3 style="margin-bottom: 10px;">${actionNames[bulkAction] || bulkAction}</h3>
            <p style="font-size: 1.2rem; margin-bottom: 5px;">${items.length} item(s) selected</p>
            
            ${bulkAction === 'delete' ? 
                '<p style="color: #dc3545; margin-top: 10px;">⚠️ This action cannot be undone!</p>' : 
                ''}
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: center;">
            <form action="/admin/bulk?action=execute" method="POST">
                <input type="hidden" name="items" value='${itemsJson}'>
                <input type="hidden" name="bulkAction" value="${bulkAction}">
                <input type="hidden" name="type" value="${type}">
                ${targetId ? `<input type="hidden" name="targetId" value="${targetId}">` : ''}
                <button type="submit" class="btn ${bulkAction === 'delete' ? 'btn-danger' : 'btn-primary'}" style="padding: 12px 30px;">
                    <i class="fas fa-check"></i> Confirm
                </button>
            </form>
            <a href="/admin/bulk?action=select&type=${type}" class="btn btn-secondary" style="padding: 12px 30px;">
                <i class="fas fa-times"></i> Cancel
            </a>
        </div>
    </div>
  `;

  return { content, title: 'Confirm Action' };
}

// Execute bulk action (FIXED ERROR HANDLING)
export async function executeBulkAction(req, env, ctx, auth) {
  const formData = await req.formData();
  const itemsJson = formData.get('items');
  const bulkAction = formData.get('bulkAction');
  const type = formData.get('type');
  const targetId = formData.get('targetId');

  const items = JSON.parse(itemsJson);
  let success = true;
  let message = '';
  let results = [];

  try {
    if (bulkAction === 'delete') {
      if (type === 'songs') {
        for (const baseName of items) {
          try {
            await env.media.delete(`songs/${baseName}.mp3`).catch(() => {});
            await env.media.delete(`images/${baseName}.jpg`).catch(() => {});
            await env.media.delete(`images/${baseName}.png`).catch(() => {});
            await env.media.delete(`descriptions/${baseName}.txt`).catch(() => {});
            await env.media.delete(`metadata/${baseName}.json`).catch(() => {});
            results.push({ id: baseName, status: 'deleted' });
          } catch (e) {
            results.push({ id: baseName, status: 'failed', error: e.message });
          }
        }
        message = `Deleted ${results.filter(r => r.status === 'deleted').length} songs`;
      } else if (type === 'albums') {
        const albums = await getAlbums(env);
        for (const albumId of items) {
          if (albums[albumId]?.thumbnail) {
            await env.media.delete(albums[albumId].thumbnail).catch(() => {});
          }
          delete albums[albumId];
        }
        await saveAlbums(env, albums);
        message = `Deleted ${items.length} albums`;
      } else if (type === 'artists') {
        const artists = await getArtists(env);
        for (const artistId of items) {
          if (artists[artistId]?.thumbnail) {
            await env.media.delete(artists[artistId].thumbnail).catch(() => {});
          }
          delete artists[artistId];
        }
        await saveArtists(env, artists);
        message = `Deleted ${items.length} artists`;
      } else if (type === 'playlists') {
        const playlists = await getPlaylists(env);
        for (const playlistId of items) {
          if (playlists[playlistId]?.thumbnail) {
            await env.media.delete(playlists[playlistId].thumbnail).catch(() => {});
          }
          delete playlists[playlistId];
        }
        await savePlaylists(env, playlists);
        message = `Deleted ${items.length} playlists`;
      }
      
      await logAdminActivity(env, auth.session.id, 'bulk-delete', type, 'multiple', `Deleted ${items.length} ${type}`);

    } else if (bulkAction === 'export') {
      // Generate CSV
      let csv = '';
      if (type === 'songs') {
        csv = 'ID,Title,Artist,Album,Duration,Plays,Downloads\n';
        for (const baseName of items) {
          const meta = await getMetadata(env, baseName);
          const stats = await getSongStats(baseName, env);
          const title = meta?.title || baseName;
          const artist = meta?.primaryArtist || baseName.split('_')[0];
          csv += `"${baseName}","${title}","${artist}",,${meta?.duration || 0},${stats.plays},${stats.downloads}\n`;
        }
      }
      
      await logAdminActivity(env, auth.session.id, 'bulk-export', type, 'multiple', `Exported ${items.length} ${type}`);
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type}-export-${Date.now()}.csv"`
        }
      });

    } else if (bulkAction === 'addToAlbum' && targetId) {
      const albums = await getAlbums(env);
      // FIXED: Safely access album title with fallback
      const albumTitle = albums[targetId]?.title || 'Unknown Album';
      
      if (albums[targetId]) {
        for (const baseName of items) {
          if (!albums[targetId].songs.includes(baseName)) {
            albums[targetId].songs.push(baseName);
          }
        }
        await saveAlbums(env, albums);
        message = `Added ${items.length} songs to album "${albumTitle}"`;
        
        await logAdminActivity(env, auth.session.id, 'bulk-add-to-album', type, targetId, 
          `Added ${items.length} songs to album "${albumTitle}"`);
      } else {
        message = `Album not found`;
        success = false;
      }
      
    } else if (bulkAction === 'addToPlaylist' && targetId) {
      const playlists = await getPlaylists(env);
      // FIXED: Safely access playlist title with fallback
      const playlistTitle = playlists[targetId]?.title || 'Unknown Playlist';
      
      if (playlists[targetId]) {
        for (const baseName of items) {
          if (!playlists[targetId].songs.includes(baseName)) {
            playlists[targetId].songs.push(baseName);
          }
        }
        playlists[targetId].updated = Date.now();
        await savePlaylists(env, playlists);
        message = `Added ${items.length} songs to playlist "${playlistTitle}"`;
        
        await logAdminActivity(env, auth.session.id, 'bulk-add-to-playlist', type, targetId, 
          `Added ${items.length} songs to playlist "${playlistTitle}"`);
      } else {
        message = `Playlist not found`;
        success = false;
      }
    }

    // Redirect back to bulk menu with success/error message
    if (success) {
      return new Response(null, {
        status: 302,
        headers: { 
          'Location': `/admin/bulk?success=${encodeURIComponent(message)}` 
        }
      });
    } else {
      return new Response(null, {
        status: 302,
        headers: { 
          'Location': `/admin/bulk?error=${encodeURIComponent(message)}` 
        }
      });
    }

  } catch (error) {
    console.error('Bulk operation error:', error);
    return new Response(null, {
      status: 302,
      headers: { 
        'Location': `/admin/bulk?error=${encodeURIComponent(error.message)}` 
      }
    });
  }
}