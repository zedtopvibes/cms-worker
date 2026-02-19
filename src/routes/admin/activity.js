// ==================== ADMIN ACTIVITY LOG ROUTE ====================
// FIXED: Correct import paths (from helpers folder, not current directory)
import { getActivities } from '../../helpers/activity.js';

// These imports are NOT needed in activity.js - remove them!
// The activity page doesn't need storage, db, stats etc.

export async function handleAdminActivity(req, env, ctx) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const filter = url.searchParams.get('filter') || 'all';
  const days = parseInt(url.searchParams.get('days')) || 7;
  const ITEMS_PER_PAGE = 20;

  try {
    // Get activities from R2
    const { logs, total, totalPages, actions } = await getActivities(env, filter, days, page, ITEMS_PER_PAGE);

    // Format activities with icons - using original design's simpler format
    const activityRows = logs.map(log => {
      const timeAgo = getTimeAgo(new Date(log.time));
      const iconInfo = getActionIcon(log.action);
      const details = log.details || {};
      
      return `
        <div class="activity-item">
          <div class="activity-icon" style="background: ${iconInfo.bg};">
            <i class="fas ${iconInfo.icon}"></i>
          </div>
          <div class="activity-content">
            <div class="activity-text">
              <strong>${log.admin || 'System'}</strong> ${log.action} 
              ${details.type ? `<strong>${details.type}</strong>` : ''}
              ${log.file ? `"${log.file}"` : ''}
            </div>
            <div class="activity-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');

    // ORIGINAL DESIGN HTML/CSS from the first version
    const content = `
      <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
              <h2 style="margin:0;"><i class="fas fa-history" style="color: #ff5500;"></i> Activity Log</h2>
              <a href="/admin/activity/export?days=${days}&filter=${filter}" class="btn btn-secondary">
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
                          ${actions.map(action => `
                              <option value="${action}" ${filter === action ? 'selected' : ''}>
                                  ${action.charAt(0).toUpperCase() + action.slice(1)}
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
              <span><i class="fas fa-list"></i> Showing <strong>${logs.length}</strong> of <strong>${total}</strong> activities</span>
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

    // Return the response with admin layout
    return new Response(adminLayout(content, 'Activity Log'), {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Error in activity log:', error);
    return new Response(adminLayout(`
      <div style="padding: 40px; text-align: center;">
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #dc3545; margin-bottom: 20px;"></i>
        <h3>Error Loading Activity Log</h3>
        <p style="color: #666; margin-bottom: 20px;">${error.message}</p>
        <a href="/admin" class="btn btn-primary">Back to Dashboard</a>
      </div>
    `, 'Error'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Export handler
export async function handleAdminActivityExport(req, env, ctx) {
  try {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days')) || 30;
    const filter = url.searchParams.get('filter') || 'all';

    // Get logs from R2
    const { logs } = await getActivities(env, filter, days, 1, 1000);

    // Generate CSV
    let csv = 'Timestamp,Action,File,Admin,IP Address,Details\n';
    
    for (const log of logs) {
      const details = JSON.stringify(log.details || {});
      csv += `"${log.time}","${log.action || ''}","${log.file || ''}","${log.admin || ''}","${log.ip || ''}","${details}"\n`;
    }

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="activity-log-${Date.now()}.csv"`
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

// Helper function to get icon based on action
function getActionIcon(action) {
  const icons = {
    'upload': { icon: 'fa-cloud-upload-alt', bg: '#ff5500' },
    'edit': { icon: 'fa-edit', bg: '#4a90e2' },
    'delete': { icon: 'fa-trash', bg: '#dc3545' },
    'create': { icon: 'fa-plus-circle', bg: '#28a745' },
    'restore': { icon: 'fa-undo', bg: '#28a745' },
    'merge': { icon: 'fa-compress', bg: '#9b59b6' },
    'update': { icon: 'fa-sync', bg: '#00b894' },
    'bulk-delete': { icon: 'fa-trash-alt', bg: '#dc3545' },
    'login': { icon: 'fa-sign-in-alt', bg: '#6c5ce7' },
    'logout': { icon: 'fa-sign-out-alt', bg: '#6c5ce7' },
    'play': { icon: 'fa-play', bg: '#ff5500' },
    'download': { icon: 'fa-download', bg: '#ff5500' },
    'cron': { icon: 'fa-clock', bg: '#6c757d' },
    'test': { icon: 'fa-vial', bg: '#666' }
  };
  return icons[action] || { icon: 'fa-history', bg: '#666' };
}

// Helper function to format time ago (simpler version from original)
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

// You need an adminLayout function - add this or import it
function adminLayout(content, title) {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Admin</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #f5f5f5;
        }
        .admin-container {
            display: flex;
            min-height: 100vh;
        }
        .sidebar {
            width: 250px;
            background: white;
            box-shadow: 2px 0 10px rgba(0,0,0,0.05);
        }
        .main-content {
            flex: 1;
            padding: 20px;
        }
        .top-bar {
            background: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .btn {
            display: inline-block;
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #ff5500;
            color: white;
        }
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        .form-control {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 0.9rem;
        }
        .pagination {
            display: flex;
            gap: 5px;
            margin-top: 20px;
        }
        .pagination-item {
            padding: 5px 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            text-decoration: none;
            color: #333;
        }
        .pagination-item.active {
            background: #ff5500;
            color: white;
            border-color: #ff5500;
        }
    </style>
</head>
<body>
    <div class="admin-container">
        <div class="sidebar">
            <!-- Your sidebar content -->
        </div>
        <div class="main-content">
            <div class="top-bar">
                <h2>${title}</h2>
                <div>Admin</div>
            </div>
            ${content}
        </div>
    </div>
</body>
</html>`;
}