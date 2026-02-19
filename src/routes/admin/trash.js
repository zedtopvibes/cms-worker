// ==================== ADMIN TRASH/RECYCLE BIN ====================
import { 
  getTrashItems, 
  getTrashStats, 
  getTrashSettings,
  restoreFromTrash,
  deletePermanently,
  emptyTrash,
  updateTrashSettings
} from '../../helpers/trash.js';
import { formatNumber } from '../../helpers/formatting.js';

export async function handleAdminTrash(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const type = url.searchParams.get('type') || 'all';
  const search = url.searchParams.get('search') || '';

  // Get trash items
  const { items, total, totalPages } = await getTrashItems(env, type, page, 20, search);
  
  // Get stats
  const stats = await getTrashStats(env);
  
  // Get settings
  const settings = await getTrashSettings(env);

  const content = `
    <div style="margin-bottom: 20px;">
        <!-- Header -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
                <h2 style="margin:0; font-size:1.3rem;"><i class="fas fa-trash-alt" style="color: #dc3545;"></i> Trash / Recycle Bin</h2>
                <div style="display: flex; gap: 10px;">
                    <button onclick="emptyTrash('all')" class="btn btn-danger">
                        <i class="fas fa-trash-alt"></i> Empty Trash
                    </button>
                    <button onclick="showSettings()" class="btn btn-secondary">
                        <i class="fas fa-cog"></i> Settings
                    </button>
                </div>
            </div>
            
            <!-- Search and Filter -->
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                        <input type="text" id="searchInput" class="form-control" placeholder="Search deleted items..." 
                               value="${search}" style="padding-left: 40px;">
                    </div>
                </div>
                <select id="typeSelect" class="form-control" style="width: auto; min-width: 150px;">
                    <option value="all" ${type === 'all' ? 'selected' : ''}>All Types (${stats.total})</option>
                    <option value="song" ${type === 'song' ? 'selected' : ''}>Songs (${stats.songs})</option>
                    <option value="album" ${type === 'album' ? 'selected' : ''}>Albums (${stats.albums})</option>
                    <option value="artist" ${type === 'artist' ? 'selected' : ''}>Artists (${stats.artists})</option>
                    <option value="playlist" ${type === 'playlist' ? 'selected' : ''}>Playlists (${stats.playlists})</option>
                </select>
                <button onclick="applyFilters()" class="btn btn-primary">
                    <i class="fas fa-filter"></i> Apply
                </button>
            </div>
            
            <!-- Stats Summary -->
            <div style="display: flex; gap: 15px; flex-wrap: wrap; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                <div><i class="fas fa-trash-alt" style="color: #dc3545;"></i> Total: <strong>${stats.total}</strong></div>
                <div><i class="fas fa-music" style="color: #ff5500;"></i> Songs: <strong>${stats.songs}</strong></div>
                <div><i class="fas fa-compact-disc" style="color: #28a745;"></i> Albums: <strong>${stats.albums}</strong></div>
                <div><i class="fas fa-microphone" style="color: #9b59b6;"></i> Artists: <strong>${stats.artists}</strong></div>
                <div><i class="fas fa-list" style="color: #4a90e2;"></i> Playlists: <strong>${stats.playlists}</strong></div>
                <div><i class="fas fa-database" style="color: #6c757d;"></i> Size: <strong>${stats.formattedSize}</strong></div>
            </div>
            
            <!-- Auto-delete Info -->
            <div style="background: #fff3cd; color: #856404; padding: 10px 15px; border-radius: 8px; font-size: 0.9rem;">
                <i class="fas fa-clock"></i> 
                Items are automatically deleted after <strong>${settings.retention_days} days</strong>.
                <a href="#" onclick="showSettings()" style="color: #ff5500; margin-left: 10px;">Change settings</a>
            </div>
        </div>
        
        <!-- Mobile Cards -->
        <div class="mobile-cards">
            ${items.map(item => generateMobileCard(item)).join('')}
            ${items.length === 0 ? `
                <div class="empty-state">
                    <i class="fas fa-trash-alt"></i>
                    <h3>Trash is empty</h3>
                    <p>Deleted items will appear here</p>
                </div>
            ` : ''}
        </div>
        
        <!-- Desktop Grid -->
        <div class="trash-grid" style="display: none;">
            ${items.map(item => generateGridCard(item)).join('')}
        </div>
        
        <!-- Pagination -->
        ${generatePagination(page, totalPages, search, type)}
    </div>
    
    <!-- Settings Modal -->
    <div id="settingsModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background: white; max-width: 500px; width: 90%; border-radius: 12px; padding: 25px;">
            <h3 style="margin-bottom: 20px;"><i class="fas fa-cog" style="color: #ff5500;"></i> Trash Settings</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Auto-delete after (days)</label>
                <input type="number" id="retentionDays" value="${settings.retention_days}" min="1" max="365" class="form-control">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Max trash size (MB)</label>
                <input type="number" id="maxTrashSize" value="${settings.max_trash_size_mb}" min="100" max="10240" class="form-control">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="autoCleanup" ${settings.auto_cleanup ? 'checked' : ''}>
                    <span style="font-weight: 600;">Enable auto-cleanup</span>
                </label>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="notifyBeforeDelete" ${settings.notify_before_delete ? 'checked' : ''}>
                    <span style="font-weight: 600;">Notify before deletion</span>
                </label>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="closeSettings()" class="btn btn-secondary">Cancel</button>
                <button onclick="saveSettings()" class="btn btn-primary">Save Settings</button>
            </div>
        </div>
    </div>
    
    <style>
        .trash-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .trash-grid-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            transition: transform 0.2s;
            border: 1px solid #e8e8e8;
            position: relative;
        }
        
        .trash-grid-card:hover {
            transform: translateY(-4px);
            border-color: #dc3545;
        }
        
        .trash-grid-card.expiring {
            border-left: 4px solid #ffc107;
        }
        
        .trash-thumbnail {
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
        
        .trash-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .trash-thumbnail .type-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 0.7rem;
            font-weight: 600;
            color: white;
        }
        
        .trash-info {
            padding: 15px;
        }
        
        .trash-title {
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .trash-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            font-size: 0.8rem;
            color: #666;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e8e8e8;
        }
        
        .expiry-badge {
            background: #ffc107;
            color: #000;
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 0.7rem;
            font-weight: 600;
            display: inline-block;
        }
        
        .expiry-badge.expiring-soon {
            background: #dc3545;
            color: white;
        }
        
        @media (min-width: 768px) {
            .mobile-cards { display: none; }
            .trash-grid { display: grid !important; }
        }
    </style>
    
    <script>
        function applyFilters() {
            const search = document.getElementById('searchInput').value;
            const type = document.getElementById('typeSelect').value;
            window.location.href = '/admin/trash?search=' + encodeURIComponent(search) + '&type=' + type;
        }
        
        function showSettings() {
            document.getElementById('settingsModal').style.display = 'flex';
        }
        
        function closeSettings() {
            document.getElementById('settingsModal').style.display = 'none';
        }
        
        async function saveSettings() {
            const settings = {
                retention_days: parseInt(document.getElementById('retentionDays').value),
                max_trash_size_mb: parseInt(document.getElementById('maxTrashSize').value),
                auto_cleanup: document.getElementById('autoCleanup').checked,
                notify_before_delete: document.getElementById('notifyBeforeDelete').checked
            };
            
            const response = await fetch('/admin/trash/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            
            if (response.ok) {
                closeSettings();
                location.reload();
            } else {
                alert('Error saving settings');
            }
        }
        
        async function restoreItem(id) {
            if (confirm('Restore this item?')) {
                try {
                    const response = await fetch('/admin/trash/restore', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('✅ ' + (result.message || 'Item restored successfully'));
                        location.reload();
                    } else {
                        alert('❌ ' + (result.message || 'Failed to restore item'));
                        console.error('Restore failed:', result);
                    }
                } catch (error) {
                    alert('❌ Error: ' + error.message);
                }
            }
        }
        
        async function deletePermanently(id) {
            if (confirm('⚠️ Permanently delete this item? This cannot be undone.')) {
                try {
                    const response = await fetch('/admin/trash/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('✅ ' + (result.message || 'Item permanently deleted'));
                        location.reload();
                    } else {
                        alert('❌ ' + (result.message || 'Failed to delete item'));
                    }
                } catch (error) {
                    alert('❌ Error: ' + error.message);
                }
            }
        }
        
        async function emptyTrash(type) {
            if (confirm('⚠️ Permanently delete ALL items in trash? This cannot be undone.')) {
                try {
                    const response = await fetch('/admin/trash/empty', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('✅ ' + (result.message || 'Trash emptied successfully'));
                        location.reload();
                    } else {
                        alert('❌ ' + (result.message || 'Failed to empty trash'));
                    }
                } catch (error) {
                    alert('❌ Error: ' + error.message);
                }
            }
        }
    </script>
  `;

  return { content, title: 'Trash / Recycle Bin' };
}

// Mobile card generator
function generateMobileCard(item) {
  const typeColors = {
    song: '#ff5500',
    album: '#28a745',
    artist: '#9b59b6',
    playlist: '#4a90e2'
  };
  
  const typeIcons = {
    song: 'fa-music',
    album: 'fa-compact-disc',
    artist: 'fa-microphone',
    playlist: 'fa-list'
  };
  
  const isExpiringSoon = item.daysLeft < 7;
  
  return `
    <div class="mobile-card" style="border-left: 4px solid ${isExpiringSoon ? '#ffc107' : typeColors[item.item_type]};">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div>
                <span style="background: ${typeColors[item.item_type]}; color: white; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600;">
                    <i class="fas ${typeIcons[item.item_type]}"></i> ${item.item_type}
                </span>
                <span style="margin-left: 8px; font-size: 0.7rem; color: #999;">${item.formattedSize}</span>
            </div>
        </div>
        
        <div style="font-weight:700; font-size:1rem; margin-bottom:4px;">${item.item_name}</div>
        
        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:8px; font-size:0.8rem;">
            <span><i class="fas fa-user"></i> Deleted by: ${item.deleted_by || 'System'}</span>
            <span><i class="far fa-calendar"></i> ${item.deletedDate}</span>
        </div>
        
        <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom:12px;">
            <span class="expiry-badge ${isExpiringSoon ? 'expiring-soon' : ''}">
                <i class="fas fa-clock"></i> Expires in ${item.daysLeft} days
            </span>
        </div>
        
        <div style="display:flex; gap:8px;">
            <button onclick="restoreItem('${item.id}')" class="btn btn-success btn-sm" style="flex:1; background: #28a745;">
                <i class="fas fa-undo"></i> Restore
            </button>
            <button onclick="deletePermanently('${item.id}')" class="btn btn-danger btn-sm" style="flex:1;">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    </div>
  `;
}

// Grid card generator
function generateGridCard(item) {
  const typeColors = {
    song: '#ff5500',
    album: '#28a745',
    artist: '#9b59b6',
    playlist: '#4a90e2'
  };
  
  const typeIcons = {
    song: 'fa-music',
    album: 'fa-compact-disc',
    artist: 'fa-microphone',
    playlist: 'fa-list'
  };
  
  const isExpiringSoon = item.daysLeft < 7;
  
  return `
    <div class="trash-grid-card ${isExpiringSoon ? 'expiring' : ''}">
        <div class="trash-thumbnail">
            ${item.thumbnail ? 
                `<img src="${item.thumbnail}" alt="${item.item_name}">` : 
                `<i class="fas ${typeIcons[item.item_type]}" style="color: ${typeColors[item.item_type]}; opacity:0.5;"></i>`
            }
            <span class="type-badge" style="background: ${typeColors[item.item_type]};">
                <i class="fas ${typeIcons[item.item_type]}"></i> ${item.item_type}
            </span>
        </div>
        
        <div class="trash-info">
            <div class="trash-title">
                <span title="${item.item_name}">${truncate(item.item_name, 25)}</span>
            </div>
            
            <div class="trash-meta">
                <span><i class="fas fa-user"></i> ${item.deleted_by || 'System'}</span>
                <span><i class="far fa-calendar"></i> ${item.deletedDate}</span>
                <span><i class="fas fa-database"></i> ${item.formattedSize}</span>
            </div>
            
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom:12px;">
                <span class="expiry-badge ${isExpiringSoon ? 'expiring-soon' : ''}">
                    <i class="fas fa-clock"></i> ${item.daysLeft} days left
                </span>
            </div>
            
            <div style="display:flex; gap:8px;">
                <button onclick="restoreItem('${item.id}')" class="btn btn-success btn-sm" style="flex:1; background: #28a745;">
                    <i class="fas fa-undo"></i> Restore
                </button>
                <button onclick="deletePermanently('${item.id}')" class="btn btn-danger btn-sm" style="flex:1;">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    </div>
  `;
}

// Pagination helper
function generatePagination(currentPage, totalPages, search, type) {
  if (totalPages <= 1) return '';
  
  let html = '<div class="pagination" style="margin-top: 30px; justify-content: center;">';
  
  if (currentPage > 1) {
    html += `<a href="/admin/trash?page=${currentPage-1}&search=${encodeURIComponent(search)}&type=${type}" class="pagination-item pagination-prev"><i class="fas fa-chevron-left"></i> Prev</a>`;
  } else {
    html += `<span class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</span>`;
  }
  
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<a href="/admin/trash?page=${i}&search=${encodeURIComponent(search)}&type=${type}" class="pagination-item ${i === currentPage ? 'active' : ''}">${i}</a>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }
  
  if (currentPage < totalPages) {
    html += `<a href="/admin/trash?page=${currentPage+1}&search=${encodeURIComponent(search)}&type=${type}" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>`;
  } else {
    html += `<span class="pagination-item pagination-next disabled">Next <i class="fas fa-chevron-right"></i></span>`;
  }
  
  html += '</div>';
  return html;
}

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

// ===== FIXED API HANDLERS =====

export async function handleTrashRestore(req, env, ctx, auth) {
  try {
    const { id } = await req.json();
    console.log('🔄 Restore request for:', id);
    console.log('👤 Auth session:', auth?.session);
    
    // FIX: Provide a default value if auth.session.id is undefined
    const adminId = auth?.session?.id || 'system';
    console.log('👤 Using adminId:', adminId);
    
    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        message: '❌ Missing trash item ID'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await restoreFromTrash(env, adminId, id);
    
    // Log the full result for debugging
    console.log('Restore result:', JSON.stringify(result, null, 2));
    
    return new Response(JSON.stringify({
      success: result.success,
      message: result.message || (result.success ? '✅ Item restored successfully' : '❌ Failed to restore item'),
      error: result.error,
      details: result.debug || null
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Restore handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '❌ Error: ' + error.message,
      error: error.message,
      stack: error.stack
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleTrashDelete(req, env, ctx, auth) {
  try {
    const { id } = await req.json();
    console.log('🗑️ Permanent delete request for:', id);
    
    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        message: '❌ Missing trash item ID'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await deletePermanently(env, id);
    
    return new Response(JSON.stringify({
      success: result.success,
      message: result.message || (result.success ? '✅ Item permanently deleted' : '❌ Failed to delete'),
      error: result.error
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Delete handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '❌ Error: ' + error.message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleTrashEmpty(req, env, ctx, auth) {
  try {
    const { type } = await req.json();
    console.log('🧹 Empty trash request for type:', type);
    
    const result = await emptyTrash(env, type || 'all');
    
    return new Response(JSON.stringify({
      success: result.success,
      message: result.message || (result.success ? '✅ Trash emptied successfully' : '❌ Failed to empty trash'),
      count: result.count
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Empty trash error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '❌ Error: ' + error.message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleTrashSettings(req, env, ctx, auth) {
  try {
    const settings = await req.json();
    console.log('⚙️ Update settings request:', settings);
    
    // FIX: Provide a default value if auth.session.id is undefined
    const adminId = auth?.session?.id || 'system';
    
    const result = await updateTrashSettings(env, adminId, settings);
    
    return new Response(JSON.stringify({
      success: result.success,
      message: result.message || (result.success ? '✅ Settings saved' : '❌ Failed to save settings')
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Settings error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '❌ Error: ' + error.message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}