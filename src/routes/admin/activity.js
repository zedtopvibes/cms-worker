// ==================== ADMIN ACTIVITY LOG ====================
// MODIFIED: Using R2 instead of D1 database
import { formatNumber } from '../../helpers/formatting.js';

export async function handleAdminActivity(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const filter = url.searchParams.get('filter') || 'all';
  const days = parseInt(url.searchParams.get('days')) || 7;
  const ITEMS_PER_PAGE = 20;

  try {
    // Get activities from R2
    const { activities, totalItems, actions } = await getActivitiesFromR2(env, filter, days, page, ITEMS_PER_PAGE);
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

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
              <strong>${log.item_type}</strong> 
              "${log.item_name || log.item_id}"
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
                              <option value="${a}" ${filter === a ? 'selected' : ''}>
                                  ${a.charAt(0).toUpperCase() + a.slice(1)}
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
              window.location.href = '/admin/activity?filter=' + filter + '&days=' + days;
          }
          
          function clearFilters() {
              window.location.href = '/admin/activity';
          }
      </script>
    `;

    return { content, title: 'Activity Log' };

  } catch (error) {
    console.error('Error in activity log:', error);
    return { 
      content: `<div class="error-message">Error loading activity log: ${error.message}</div>`, 
      title: 'Error' 
    };
  }
}

// ==================== R2 FUNCTIONS ====================

async function getActivitiesFromR2(env, filter, days, page, itemsPerPage) {
  try {
    // List all activity log files from R2
    // Assuming logs are stored with keys like: activity/YYYY-MM-DD-HH-MM-SS.json or activity/timestamp-uuid.json
    const objects = await env.R2_BUCKET.list({ prefix: 'activity/' });
    
    let allActivities = [];
    
    // Fetch each log file
    for (const object of objects.objects) {
      try {
        const file = await env.R2_BUCKET.get(object.key);
        if (file) {
          const logData = await file.json();
          
          // Add timestamp from object metadata or use upload date
          allActivities.push({
            timestamp: object.uploaded.toISOString(),
            ...logData
          });
        }
      } catch (err) {
        console.error(`Error parsing log file ${object.key}:`, err);
        // Continue with other files
      }
    }
    
    // Sort by timestamp (newest first)
    allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply time filter
    if (days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      allActivities = allActivities.filter(log => new Date(log.timestamp) > cutoffDate);
    }
    
    // Apply action filter
    if (filter !== 'all') {
      allActivities = allActivities.filter(log => log.action === filter);
    }
    
    // Get unique actions for filter dropdown
    const actions = [...new Set(allActivities.map(log => log.action))].sort();
    
    // Calculate pagination
    const totalItems = allActivities.length;
    const start = (page - 1) * itemsPerPage;
    const activities = allActivities.slice(start, start + itemsPerPage);
    
    return { activities, totalItems, actions };
    
  } catch (error) {
    console.error('Error reading from R2:', error);
    return { activities: [], totalItems: 0, actions: [] };
  }
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
    'restore': { icon: 'fa-undo', bg: '#28a745' },
    'download': { icon: 'fa-download', bg: '#ff5500' }
  };
  return icons[action] || { icon: 'fa-circle', bg: '#666' };
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
    html += `<a href="/admin/activity?page=${currentPage-1}&filter=${filter}&days=${days}" class="pagination-item pagination-prev"><i class="fas fa-chevron-left"></i> Prev</a>`;
  } else {
    html += `<span class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</span>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const active = i === currentPage ? 'active' : '';
      html += `<a href="/admin/activity?page=${i}&filter=${filter}&days=${days}" class="pagination-item ${active}">${i}</a>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  if (currentPage < totalPages) {
    html += `<a href="/admin/activity?page=${currentPage+1}&filter=${filter}&days=${days}" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>`;
  } else {
    html += `<span class="pagination-item pagination-next disabled">Next <i class="fas fa-chevron-right"></i></span>`;
  }

  html += '</div>';
  return html;
}

// Export activity log as CSV
export async function handleAdminActivityExport(req, env, ctx, auth) {
  try {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days')) || 30;
    const filter = url.searchParams.get('filter') || 'all';

    // Get all logs (unpaginated) for export
    const { activities } = await getActivitiesFromR2(env, filter, days, 1, 10000); // Get up to 10000 records

    // Generate CSV
    let csv = 'Timestamp,Admin ID,Action,Item Type,Item ID,Item Name\n';
    
    for (const log of activities) {
      csv += `"${log.timestamp}","${log.admin_id || ''}","${log.action}","${log.item_type}","${log.item_id}","${log.item_name || ''}"\n`;
    }

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="admin-activity-${Date.now()}.csv"`
      }
    });

  } catch (error) {
    console.error('Error exporting activity log:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}