// ==================== ADMIN ACTIVITY LOG ROUTE ====================
// FIXED: Correct import paths and consistent layout matching codes 1-5
import { getActivities } from '../../helpers/activity.js';

export async function handleAdminActivity(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const filter = url.searchParams.get('filter') || 'all';
  const days = parseInt(url.searchParams.get('days')) || 7;
  const ITEMS_PER_PAGE = 20;

  try {
    // Get activities
    const { logs, total, totalPages, actions } = await getActivities(env, filter, days, page, ITEMS_PER_PAGE);

    // Calculate totals for stats summary
    const uniqueActions = new Set(logs.map(l => l.action)).size;

    // Format activities with icons
    const activityRows = logs.map(log => {
      const timeAgo = getTimeAgo(new Date(log.time));
      const iconInfo = getActionIcon(log.action);
      const details = log.details || {};
      
      return generateActivityItem(log, iconInfo, timeAgo, details);
    }).join('');

    // Sort options
    const sortOptions = [
      { value: 'newest', label: 'Newest First' },
      { value: 'oldest', label: 'Oldest First' },
      { value: 'action', label: 'Action Type' },
      { value: 'admin', label: 'Admin Name' }
    ];

    const content = `
      <div style="margin-bottom: 20px;">
          <!-- Header -->
          <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
              <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
                  <h2 style="margin:0; font-size:1.3rem;">
                      <i class="fas fa-history" style="color: #ff5500;"></i> Activity Log
                  </h2>
                  <div style="display: flex; gap: 10px;">
                      <a href="/admin/activity/export?days=${days}&filter=${filter}" class="btn btn-secondary">
                          <i class="fas fa-download"></i> Export Log
                      </a>
                  </div>
              </div>
              
              <!-- Search and Filter section -->
              <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                  <div style="flex: 1; min-width: 200px;">
                      <div style="position: relative;">
                          <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                          <input type="text" id="searchInput" class="form-control" placeholder="Search activities..." 
                                 style="padding-left: 40px;" value="${url.searchParams.get('search') || ''}">
                      </div>
                  </div>
                  <select id="filterSelect" class="form-control" style="width: auto; min-width: 150px;">
                      <option value="all" ${filter === 'all' ? 'selected' : ''}>All Actions</option>
                      ${actions.map(action => `
                          <option value="${action}" ${filter === action ? 'selected' : ''}>
                              ${action.charAt(0).toUpperCase() + action.slice(1)}
                          </option>
                      `).join('')}
                  </select>
                  <select id="daysSelect" class="form-control" style="width: auto; min-width: 150px;">
                      <option value="1" ${days === 1 ? 'selected' : ''}>Last 24 Hours</option>
                      <option value="7" ${days === 7 ? 'selected' : ''}>Last 7 Days</option>
                      <option value="30" ${days === 30 ? 'selected' : ''}>Last 30 Days</option>
                      <option value="90" ${days === 90 ? 'selected' : ''}>Last 90 Days</option>
                      <option value="0" ${days === 0 ? 'selected' : ''}>All Time</option>
                  </select>
                  <select id="sortSelect" class="form-control" style="width: auto; min-width: 150px;">
                      ${sortOptions.map(opt => `
                          <option value="${opt.value}">Sort by: ${opt.label}</option>
                      `).join('')}
                  </select>
                  <button onclick="applyFilters()" class="btn btn-primary">
                      <i class="fas fa-filter"></i> Apply
                  </button>
              </div>
              
              <!-- Stats Summary -->
              <div style="display: flex; gap: 15px; flex-wrap: wrap; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                  <div><i class="fas fa-history" style="color: #ff5500;"></i> Total: <strong>${total}</strong> activities</div>
                  <div><i class="fas fa-tasks" style="color: #4a90e2;"></i> Actions: <strong>${actions.length}</strong></div>
                  <div><i class="fas fa-users" style="color: #28a745;"></i> Unique Actions: <strong>${uniqueActions}</strong></div>
                  <div><i class="fas fa-clock" style="color: #6c757d;"></i> Page: <strong>${page}/${totalPages}</strong></div>
              </div>
          </div>
          
          <!-- Mobile Cards View -->
          <div class="mobile-cards">
              ${logs.map(log => generateMobileCard(log)).join('')}
              ${logs.length === 0 ? getEmptyState('mobile') : ''}
          </div>
          
          <!-- Desktop Activity List -->
          <div class="activity-grid" style="display: none;">
              ${activityRows || getEmptyState('desktop')}
          </div>
          
          <!-- Pagination -->
          ${generatePagination(page, totalPages, filter, days)}
      </div>
      
      <style>
          .activity-grid {
              display: flex;
              flex-direction: column;
              gap: 10px;
              margin-top: 20px;
          }
          
          .activity-item {
              display: flex;
              align-items: flex-start;
              gap: 15px;
              padding: 15px;
              background: white;
              border-radius: 8px;
              border: 1px solid #e8e8e8;
              transition: all 0.2s;
          }
          
          .activity-item:hover {
              border-color: #ff5500;
              box-shadow: var(--shadow);
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
              display: flex;
              gap: 10px;
              align-items: center;
          }
          
          .activity-time i {
              font-size: 0.7rem;
          }
          
          .activity-details {
              font-size: 0.7rem;
              color: #666;
              margin-top: 8px;
              padding: 6px 10px;
              background: #f8f9fa;
              border-radius: 6px;
              border-left: 3px solid #ff5500;
          }
          
          .mobile-card {
              background: white;
              border-radius: 12px;
              padding: 15px;
              margin-bottom: 10px;
              border: 1px solid #e8e8e8;
          }
          
          .mobile-card .activity-icon {
              width: 35px;
              height: 35px;
              font-size: 1rem;
          }
          
          .empty-state {
              text-align: center;
              padding: 60px 20px;
              background: white;
              border-radius: 12px;
              border: 1px solid #e8e8e8;
          }
          
          .empty-state i {
              font-size: 3rem;
              color: #ccc;
              margin-bottom: 15px;
          }
          
          .empty-state h3 {
              margin-bottom: 10px;
              color: #333;
              font-size: 1.2rem;
          }
          
          .empty-state p {
              color: #666;
              margin-bottom: 20px;
          }
          
          @media (min-width: 768px) {
              .mobile-cards { display: none; }
              .activity-grid { display: flex !important; }
          }
      </style>
      
      <script>
          function applyFilters() {
              const search = document.getElementById('searchInput').value;
              const filter = document.getElementById('filterSelect').value;
              const days = document.getElementById('daysSelect').value;
              const sort = document.getElementById('sortSelect').value;
              
              let url = '/admin/activity?';
              if (search) url += 'search=' + encodeURIComponent(search) + '&';
              url += 'filter=' + encodeURIComponent(filter) + '&days=' + days + '&sort=' + sort;
              window.location.href = url;
          }
          
          function clearFilters() {
              window.location.href = '/admin/activity';
          }
          
          document.getElementById('searchInput').addEventListener('keypress', function(e) {
              if (e.key === 'Enter') applyFilters();
          });
      </script>
    `;

    // Return using the imported adminLayout from code #1
    return new Response(adminLayout('Activity Log', content, auth, 'activity'), {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Error in activity log:', error);
    return new Response(adminLayout('Error', `
      <div class="empty-state">
          <i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i>
          <h3>Error Loading Activity Log</h3>
          <p style="color: #666;">${error.message}</p>
          <a href="/admin" class="btn btn-primary" style="margin-top: 15px;">
              <i class="fas fa-arrow-left"></i> Back to Dashboard
          </a>
      </div>
    `, auth, 'activity'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// ===== EXPORT HANDLER =====
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

// ===== HELPER FUNCTIONS =====
function generateMobileCard(log) {
  const iconInfo = getActionIcon(log.action);
  const timeAgo = getTimeAgo(new Date(log.time));
  const details = log.details || {};
  
  return `
    <div class="mobile-card">
        <div style="display: flex; gap: 12px; margin-bottom: 10px;">
            <div class="activity-icon" style="background: ${iconInfo.bg};">
                <i class="fas ${iconInfo.icon}"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px;">
                    ${log.admin || 'System'} 
                    <span style="color: ${iconInfo.bg};">${log.action}</span>
                </div>
                ${log.file ? `<div style="font-size: 0.9rem; color: #333;">${log.file}</div>` : ''}
                ${details.type ? `<div style="font-size: 0.8rem; color: #666;">Type: ${details.type}</div>` : ''}
            </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #999;">
            <span><i class="far fa-clock"></i> ${timeAgo}</span>
            <span>${new Date(log.time).toLocaleString()}</span>
        </div>
        
        ${Object.keys(details).filter(k => k !== 'type').length > 0 ? `
            <div style="margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 6px; font-size: 0.7rem; color: #666;">
                <i class="fas fa-info-circle"></i> 
                ${JSON.stringify(details)}
            </div>
        ` : ''}
    </div>
  `;
}

function generateActivityItem(log, iconInfo, timeAgo, details) {
  return `
    <div class="activity-item">
        <div class="activity-icon" style="background: ${iconInfo.bg};">
            <i class="fas ${iconInfo.icon}"></i>
        </div>
        <div class="activity-content">
            <div class="activity-text">
                <strong>${log.admin || 'System'}</strong> 
                <span style="color: ${iconInfo.bg};">${log.action}</span>
                ${log.file ? `<strong>${log.file}</strong>` : ''}
                ${details.type ? `<span style="color: #666;">(${details.type})</span>` : ''}
            </div>
            <div class="activity-time">
                <i class="far fa-clock"></i> ${timeAgo} • 
                <i class="far fa-calendar"></i> ${new Date(log.time).toLocaleString()}
                ${log.ip ? `• <i class="fas fa-network-wired"></i> ${log.ip}` : ''}
            </div>
            ${Object.keys(details).filter(k => k !== 'type').length > 0 ? `
                <div class="activity-details">
                    <i class="fas fa-info-circle"></i> 
                    ${JSON.stringify(details)}
                </div>
            ` : ''}
        </div>
    </div>
  `;
}

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

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)} weeks ago`;
  return `${Math.floor(seconds / 2592000)} months ago`;
}

function getEmptyState(view = 'desktop') {
  if (view === 'mobile') {
    return `
      <div class="empty-state" style="padding: 40px 20px;">
          <i class="fas fa-history"></i>
          <h3>No activity found</h3>
          <p>Activities will appear here as you use the admin panel</p>
          <button onclick="clearFilters()" class="btn btn-secondary" style="margin-top: 15px;">
              <i class="fas fa-times"></i> Clear Filters
          </button>
      </div>
    `;
  }
  
  return `
    <div class="empty-state">
        <i class="fas fa-history"></i>
        <h3>No activity found</h3>
        <p style="color: #666;">Activities will appear here as you use the admin panel</p>
        <button onclick="clearFilters()" class="btn btn-secondary" style="margin-top: 15px;">
            <i class="fas fa-times"></i> Clear Filters
        </button>
    </div>
  `;
}

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