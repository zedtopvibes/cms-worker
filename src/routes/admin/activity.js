// ==================== ADMIN ACTIVITY LOG ROUTE ====================
// FIXED: Correct import paths and consistent layout matching codes 1-5
import { getActivities } from '../../helpers/activity.js';

export async function handleAdminActivity(req, env, ctx, auth) {  // Added auth parameter for consistency
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const filter = url.searchParams.get('filter') || 'all';
  const days = parseInt(url.searchParams.get('days')) || 7;
  const ITEMS_PER_PAGE = 20;

  try {
    // Get activities
    const { logs, total, totalPages, actions } = await getActivities(env, filter, days, page, ITEMS_PER_PAGE);

    // Calculate totals for stats summary (like other modules)
    const uniqueActions = new Set(logs.map(l => l.action)).size;

    // Format activities with icons
    const activityRows = logs.map(log => {
      const timeAgo = getTimeAgo(new Date(log.time));
      const iconInfo = getActionIcon(log.action);
      const details = log.details || {};
      
      return generateActivityItem(log, iconInfo, timeAgo, details);
    }).join('');

    // Sort options (like other modules)
    const sortOptions = [
      { value: 'newest', label: 'Newest First' },
      { value: 'oldest', label: 'Oldest First' },
      { value: 'action', label: 'Action Type' },
      { value: 'admin', label: 'Admin Name' }
    ];

    const content = `
      <div style="margin-bottom: 20px;">
          <!-- Header with consistent styling from codes 1-5 -->
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
              
              <!-- Search and Filter section (matching other modules) -->
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
              
              <!-- Stats Summary (matches other modules) -->
              <div style="display: flex; gap: 15px; flex-wrap: wrap; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                  <div><i class="fas fa-history" style="color: #ff5500;"></i> Total: <strong>${total}</strong> activities</div>
                  <div><i class="fas fa-tasks" style="color: #4a90e2;"></i> Actions: <strong>${actions.length}</strong></div>
                  <div><i class="fas fa-users" style="color: #28a745;"></i> Unique Actions: <strong>${uniqueActions}</strong></div>
                  <div><i class="fas fa-clock" style="color: #6c757d;"></i> Page: <strong>${page}/${totalPages}</strong></div>
              </div>
          </div>
          
          <!-- Mobile Cards View (consistent with other modules) -->
          <div class="mobile-cards">
              ${logs.map(log => generateMobileCard(log)).join('')}
              ${logs.length === 0 ? getEmptyState('mobile') : ''}
          </div>
          
          <!-- Desktop Activity List (replaces table/grid from other modules) -->
          <div class="activity-grid" style="display: none;">
              ${activityRows || getEmptyState('desktop')}
          </div>
          
          <!-- Pagination (consistent with other modules) -->
          ${generatePagination(page, totalPages, filter, days)}
      </div>
      
      <style>
          /* Keep existing activity styles but add grid layout */
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
          
          /* Mobile card styles (consistent with other modules) */
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
          
          /* Empty state */
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
          
          /* Desktop/ mobile visibility */
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

    // Use the shared adminLayout from code #1 with proper parameters
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

// ===== MOBILE CARD GENERATOR (matches other modules) =====
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

// ===== ACTIVITY ITEM GENERATOR (desktop view) =====
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

// ===== EMPTY STATE GENERATOR =====
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

// [Keep existing helper functions: getActionIcon, getTimeAgo, generatePagination, adminLayout]
// ... (these remain the same as your original)