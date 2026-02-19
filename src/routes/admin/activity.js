// ==================== ADMIN ACTIVITY LOG ====================
import { formatNumber } from '../../helpers/formatting.js';

export async function handleAdminActivity(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const filter = url.searchParams.get('filter') || 'all';
  const days = parseInt(url.searchParams.get('days')) || 7;
  const ITEMS_PER_PAGE = 20;

  // Build query parameters safely
  const params = [];
  let whereClause = 'WHERE 1=1';
  
  // Date filter
  if (days > 0) {
    whereClause += ` AND timestamp >= datetime('now', ?)`;
    params.push(`-${days} days`);
  }

  // Action filter
  if (filter !== 'all') {
    whereClause += ` AND action = ?`;
    params.push(filter);
  }

  // Get total count for pagination
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM admin_activity ${whereClause}`
  ).bind(...params).first();
  
  const totalItems = countResult?.total || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  // Get activity logs with pagination params
  const logParams = [...params, ITEMS_PER_PAGE, offset];
  const { results } = await env.DB.prepare(
    `SELECT * FROM admin_activity 
     ${whereClause}
     ORDER BY timestamp DESC 
     LIMIT ? OFFSET ?`
  ).bind(...logParams).all();

  const activities = results || [];

  // Get unique actions for filter dropdown
  const { results: actionResults } = await env.DB.prepare(
    `SELECT DISTINCT action FROM admin_activity WHERE action IS NOT NULL ORDER BY action`
  ).all();
  
  const actions = actionResults || [];

  // Format activities with icons
  const activityRows = activities.map(log => {
    const timeAgo = getTimeAgo(new Date(log.timestamp));
    const iconInfo = getActionIcon(log.action);
    
    return `
      <div class="activity-item">
        <div class="activity-icon" style="background: ${iconInfo.bg};">
          <i class="fas ${iconInfo.icon}"></i>
        </div>
        <div class="activity-content">
          <div class="activity-text">
            <strong>${log.admin_id || 'Admin'}</strong> ${log.action} 
            ${log.item_type ? `<strong>${log.item_type}</strong>` : ''}
            ${log.item_name ? `"${log.item_name}"` : ''}
          </div>
          <div class="activity-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');

  const content = `
    <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
            <h2 style="margin:0;"><i class="fas fa-history" style="color: #ff5500;"></i> Activity Log</h2>
            <a href="/admin/activity/export" class="btn btn-secondary">
                <i class="fas fa-download"></i> Export Log
            </a>
        </div>
        
        <!-- Filters -->
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                <div style="flex: 1; min-width: 150px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.8rem; color: #666;">Action</label>
                    <select id="filterSelect" class="form-control">
                        <option value="all" ${filter === 'all' ? 'selected' : ''}>All Actions</option>
                        ${actions.map(a => `
                            <option value="${a.action}" ${filter === a.action ? 'selected' : ''}>
                                ${a.action.charAt(0).toUpperCase() + a.action.slice(1)}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div style="width: 150px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.8rem; color: #666;">Time Period</label>
                    <select id="daysSelect" class="form-control">
                        <option value="1" ${days === 1 ? 'selected' : ''}>Last 24 Hours</option>
                        <option value="7" ${days === 7 ? 'selected' : ''}>Last 7 Days</option>
                        <option value="30" ${days === 30 ? 'selected' : ''}>Last 30 Days</option>
                        <option value="0" ${days === 0 ? 'selected' : ''}>All Time</option>
                    </select>
                </div>
                
                <div style="display: flex; align-items: flex-end; gap: 10px;">
                    <button onclick="applyFilters()" class="btn btn-primary">
                        <i class="fas fa-filter"></i> Apply
                    </button>
                    <button onclick="clearFilters()" class="btn btn-secondary">
                        <i class="fas fa-times"></i> Clear
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Results Summary -->
        <div style="background: #e8f4fd; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
            <span><i class="fas fa-list"></i> Showing <strong>${activities.length}</strong> of <strong>${totalItems}</strong> activities</span>
            <span><i class="fas fa-clock"></i> Page ${page} of ${totalPages}</span>
        </div>
        
        <!-- Activity List -->
        <div class="activity-list">
            ${activityRows || getEmptyState()}
        </div>
        
        <!-- Pagination -->
        ${generatePagination(page, totalPages, filter, days)}
    </div>
    
    <style>
        .activity-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .activity-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e8e8e8;
            transition: all 0.2s;
        }
        
        .activity-item:hover {
            border-color: #ff5500;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .activity-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.2rem;
            flex-shrink: 0;
        }
        
        .activity-content {
            flex: 1;
        }
        
        .activity-text {
            font-size: 0.95rem;
            margin-bottom: 4px;
        }
        
        .activity-time {
            font-size: 0.75rem;
            color: #999;
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            background: white;
            border-radius: 12px;
        }
        
        .empty-state i {
            font-size: 3rem;
            color: #ccc;
            margin-bottom: 15px;
        }
        
        .empty-state h3 {
            margin-bottom: 10px;
            color: #333;
        }
        
        .empty-state p {
            color: #666;
        }
        
        @media (max-width: 480px) {
            .activity-item {
                flex-wrap: wrap;
            }
            .activity-icon {
                width: 35px;
                height: 35px;
                font-size: 1rem;
            }
        }
    </style>
    
    <script>
        function applyFilters() {
            const filter = document.getElementById('filterSelect').value;
            const days = document.getElementById('daysSelect').value;
            window.location.href = '/admin/activity?filter=' + encodeURIComponent(filter) + '&days=' + days;
        }
        
        function clearFilters() {
            window.location.href = '/admin/activity';
        }
    </script>
  `;

  return { content, title: 'Activity Log' };
}

// Helper function to get icon based on action
function getActionIcon(action) {
  const icons = {
    'upload': { icon: 'fa-cloud-upload-alt', bg: '#ff5500' },
    'edit': { icon: 'fa-edit', bg: '#4a90e2' },
    'delete': { icon: 'fa-trash', bg: '#dc3545' },
    'create': { icon: 'fa-plus-circle', bg: '#28a745' },
    'merge': { icon: 'fa-compress', bg: '#9b59b6' },
    'update': { icon: 'fa-sync', bg: '#00b894' },
    'bulk-delete': { icon: 'fa-trash-alt', bg: '#dc3545' },
    'login': { icon: 'fa-sign-in-alt', bg: '#6c5ce7' },
    'logout': { icon: 'fa-sign-out-alt', bg: '#6c5ce7' },
    'test': { icon: 'fa-vial', bg: '#666' }
  };
  return icons[action] || { icon: 'fa-history', bg: '#666' };
}

// Helper function to format time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return `${Math.floor(seconds / 604800)} weeks ago`;
}

// Generate empty state
function getEmptyState() {
  return `
    <div class="empty-state">
        <i class="fas fa-history"></i>
        <h3>No activity found</h3>
        <p style="color: #666;">Activities will appear here as you use the admin panel</p>
    </div>
  `;
}

// Generate pagination
function generatePagination(currentPage, totalPages, filter, days) {
  if (totalPages <= 1) return '';

  let html = '<div class="pagination" style="margin-top: 30px; justify-content: center;">';
  
  if (currentPage > 1) {
    html += `<a href="/admin/activity?page=${currentPage-1}&filter=${encodeURIComponent(filter)}&days=${days}" class="pagination-item pagination-prev"><i class="fas fa-chevron-left"></i> Prev</a>`;
  } else {
    html += `<span class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</span>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const active = i === currentPage ? 'active' : '';
      html += `<a href="/admin/activity?page=${i}&filter=${encodeURIComponent(filter)}&days=${days}" class="pagination-item ${active}">${i}</a>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  if (currentPage < totalPages) {
    html += `<a href="/admin/activity?page=${currentPage+1}&filter=${encodeURIComponent(filter)}&days=${days}" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>`;
  } else {
    html += `<span class="pagination-item pagination-next disabled">Next <i class="fas fa-chevron-right"></i></span>`;
  }

  html += '</div>';
  return html;
}

// Export activity log as CSV
export async function handleAdminActivityExport(req, env, ctx, auth) {
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days')) || 30;

  // Build query safely
  const params = [];
  let whereClause = 'WHERE 1=1';
  
  if (days > 0) {
    whereClause += ` AND timestamp >= datetime('now', ?)`;
    params.push(`-${days} days`);
  }

  const { results } = await env.DB.prepare(
    `SELECT * FROM admin_activity 
     ${whereClause}
     ORDER BY timestamp DESC`
  ).bind(...params).all();

  // Generate CSV
  let csv = 'Timestamp,Admin ID,Action,Item Type,Item ID,Item Name\n';
  
  for (const log of results || []) {
    csv += `"${log.timestamp}","${log.admin_id || ''}","${log.action || ''}","${log.item_type || ''}","${log.item_id || ''}","${log.item_name || ''}"\n`;
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="admin-activity-${Date.now()}.csv"`
    }
  });
}