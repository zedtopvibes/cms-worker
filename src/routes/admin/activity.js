// ==================== ADMIN ACTIVITY LOG VIEWER ====================
import { getRecentActivity, getActivityByDate, getActivityByAdmin, getActivityByAction, formatActivityForDisplay } from '../../helpers/activityLog.js';

export async function handleAdminActivity(req, env, ctx, auth) {
  const url = new URL(req.url);
  const view = url.searchParams.get('view') || 'recent';
  const filter = url.searchParams.get('filter') || '';
  const page = parseInt(url.searchParams.get('page')) || 1;
  const limit = 20;

  let logs = [];
  let title = 'Recent Activity';

  // Get logs based on view
  if (view === 'recent') {
    logs = await getRecentActivity(env, limit);
    title = 'Recent Activity';
  } else if (view === 'date' && filter) {
    logs = await getActivityByDate(env, filter, limit);
    title = `Activity for ${filter}`;
  } else if (view === 'admin' && filter) {
    logs = await getActivityByAdmin(env, filter, limit);
    title = `Activity by Admin`;
  } else if (view === 'action' && filter) {
    logs = await getActivityByAction(env, filter, limit);
    title = `${filter} Activities`;
  }

  // Format for display
  const displayLogs = logs.map(log => formatActivityForDisplay(log));

  const content = `
    <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
            <h2 style="margin:0;"><i class="fas fa-history" style="color: #ff5500;"></i> ${title}</h2>
        </div>
        
        <!-- Filter Tabs -->
        <div style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding: 5px 0;">
            <a href="/admin/activity?view=recent" class="tab-btn ${view === 'recent' ? 'active' : ''}">
                <i class="fas fa-clock"></i> Recent
            </a>
            <a href="/admin/activity?view=date&filter=${new Date().toISOString().split('T')[0]}" class="tab-btn ${view === 'date' ? 'active' : ''}">
                <i class="fas fa-calendar"></i> Today
            </a>
            <a href="/admin/activity?view=action&filter=upload" class="tab-btn ${view === 'action' && filter === 'upload' ? 'active' : ''}">
                <i class="fas fa-cloud-upload-alt"></i> Uploads
            </a>
            <a href="/admin/activity?view=action&filter=edit" class="tab-btn ${view === 'action' && filter === 'edit' ? 'active' : ''}">
                <i class="fas fa-edit"></i> Edits
            </a>
            <a href="/admin/activity?view=action&filter=delete" class="tab-btn ${view === 'action' && filter === 'delete' ? 'active' : ''}">
                <i class="fas fa-trash"></i> Deletes
            </a>
        </div>
        
        <!-- Activity List -->
        <div class="activity-list">
            ${displayLogs.map(log => `
                <div class="activity-item">
                    <div class="activity-icon" style="background: ${log.iconBg};">
                        <i class="fas ${log.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">${log.text}</div>
                        <div class="activity-time">${log.time}</div>
                        <div style="font-size: 0.7rem; color: #999; margin-top: 4px;">
                            ID: ${log.raw.id} • ${new Date(log.raw.timestamp).toLocaleString()}
                        </div>
                    </div>
                </div>
            `).join('')}
            
            ${displayLogs.length === 0 ? `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>No activity found</h3>
                    <p>Activities will appear here as you use the admin panel</p>
                </div>
            ` : ''}
        </div>
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
            font-weight: 500;
        }
        .activity-time {
            font-size: 0.75rem;
            color: #999;
            margin-top: 4px;
        }
        .tab-btn {
            padding: 8px 16px;
            background: #f8f9fa;
            border: 1px solid #e8e8e8;
            border-radius: 20px;
            color: #666;
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 600;
            white-space: nowrap;
        }
        .tab-btn.active {
            background: #ff5500;
            color: white;
            border-color: #ff5500;
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
    </style>
  `;

  return { content, title: 'Activity Log' };
}