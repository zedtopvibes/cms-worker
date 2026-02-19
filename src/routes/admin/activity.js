// ==================== ADMIN ACTIVITY LOG ROUTE ====================
import { getActivities } from '../../helpers/activity.js';

export async function handleAdminActivity(req, env, ctx) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const filter = url.searchParams.get('filter') || 'all';
  const days = parseInt(url.searchParams.get('days')) || 7;
  const ITEMS_PER_PAGE = 20;

  try {
    // Get activities from R2
    const { logs, total, totalPages, actions } = await getActivities(env, filter, days, page, ITEMS_PER_PAGE);

    // Format activities with icons
    const activityRows = logs.map(log => {
      const timeAgo = getTimeAgo(new Date(log.time));
      const iconInfo = getActionIcon(log.action);
      const details = log.details || {};
      
      // Format text to match your screenshot
      let actionText = '';
      if (log.action === 'create' && details.type === 'artist') {
        actionText = `${log.admin || 'Admin'} create artist "${log.file}"`;
      } else if (log.action === 'login') {
        actionText = `${log.admin || 'Admin'} login admin "${log.admin || 'Admin'} logged in"`;
      } else {
        actionText = `${log.admin || 'Admin'} ${log.action} ${details.type || ''} ${log.file ? `"${log.file}"` : ''}`;
      }
      
      return `
        <div class="activity-item">
          <div class="activity-icon" style="background: ${iconInfo.bg};">
            <i class="fas ${iconInfo.icon}"></i>
          </div>
          <div class="activity-content">
            <div class="activity-text">${actionText}</div>
            <div class="activity-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');

    // Return ONLY the content - NO adminLayout wrapper
    return { 
      content: `
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
      `,
      title: 'Activity Log' 
    };

  } catch (error) {
    console.error('Error in activity log:', error);
    return { 
      content: `
        <div style="padding: 40px; text-align: center;">
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #dc3545; margin-bottom: 20px;"></i>
          <h3>Error Loading Activity Log</h3>
          <p style="color: #666; margin-bottom: 20px;">${error.message}</p>
          <a href="/admin" class="btn btn-primary">Back to Dashboard</a>
        </div>
      `, 
      title: 'Error' 
    };
  }
}

// Keep all your helper functions (getActionIcon, getTimeAgo, getEmptyState, generatePagination, handleAdminActivityExport)
// ... but remove the adminLayout function entirely