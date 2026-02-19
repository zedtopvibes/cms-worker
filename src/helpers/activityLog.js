// ==================== KV ACTIVITY LOGGING (NO D1) ====================

// Log admin activity to KV
export async function logAdminActivity(env, adminId, action, itemType, itemId, itemName) {
  try {
    const timestamp = Date.now();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Create unique log ID
    const logId = `${timestamp}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Create log entry
    const logEntry = {
      id: logId,
      adminId: adminId || 'system',
      adminName: adminId === 'system' ? 'System' : 'Admin',
      action,
      itemType,
      itemId,
      itemName: itemName || itemId,
      timestamp,
      date,
      readableTime: new Date(timestamp).toLocaleString()
    };
    
    // Store individual log
    await env.ACTIVITY_LOGS.put(`log:${logId}`, JSON.stringify(logEntry));
    
    // Add to recent list (keep last 100)
    await addToRecentList(env, logId);
    
    // Add to date list
    await addToDateList(env, date, logId);
    
    // Add to action list
    await addToActionList(env, action, logId);
    
    console.log(`✅ Activity logged: ${action} ${itemType} - ${itemName || itemId}`);
    return true;
  } catch (error) {
    console.error('❌ Error logging activity:', error);
    return false;
  }
}

// Helper: Add to recent list
async function addToRecentList(env, logId) {
  const key = 'recent';
  const existing = await env.ACTIVITY_LOGS.get(key, 'json') || [];
  const updated = [logId, ...existing].slice(0, 100);
  await env.ACTIVITY_LOGS.put(key, JSON.stringify(updated));
}

// Helper: Add to date list
async function addToDateList(env, date, logId) {
  const key = `date:${date}`;
  const existing = await env.ACTIVITY_LOGS.get(key, 'json') || [];
  const updated = [logId, ...existing].slice(0, 100);
  await env.ACTIVITY_LOGS.put(key, JSON.stringify(updated));
}

// Helper: Add to action list
async function addToActionList(env, action, logId) {
  const key = `action:${action}`;
  const existing = await env.ACTIVITY_LOGS.get(key, 'json') || [];
  const updated = [logId, ...existing].slice(0, 100);
  await env.ACTIVITY_LOGS.put(key, JSON.stringify(updated));
}

// Get recent activity
export async function getRecentActivity(env, limit = 20) {
  try {
    const recentList = await env.ACTIVITY_LOGS.get('recent', 'json') || [];
    const logs = [];
    
    for (let i = 0; i < Math.min(limit, recentList.length); i++) {
      const log = await env.ACTIVITY_LOGS.get(`log:${recentList[i]}`, 'json');
      if (log) logs.push(log);
    }
    
    return logs;
  } catch (error) {
    console.error('Error getting recent activity:', error);
    return [];
  }
}

// Get activity by date
export async function getActivityByDate(env, date, limit = 50) {
  try {
    const dateList = await env.ACTIVITY_LOGS.get(`date:${date}`, 'json') || [];
    const logs = [];
    
    for (let i = 0; i < Math.min(limit, dateList.length); i++) {
      const log = await env.ACTIVITY_LOGS.get(`log:${dateList[i]}`, 'json');
      if (log) logs.push(log);
    }
    
    return logs;
  } catch (error) {
    console.error('Error getting activity by date:', error);
    return [];
  }
}

// Get activity by action
export async function getActivityByAction(env, action, limit = 50) {
  try {
    const actionList = await env.ACTIVITY_LOGS.get(`action:${action}`, 'json') || [];
    const logs = [];
    
    for (let i = 0; i < Math.min(limit, actionList.length); i++) {
      const log = await env.ACTIVITY_LOGS.get(`log:${actionList[i]}`, 'json');
      if (log) logs.push(log);
    }
    
    return logs;
  } catch (error) {
    console.error('Error getting activity by action:', error);
    return [];
  }
}

// Format for display
export function formatActivityForDisplay(log) {
  const icons = {
    'upload': { icon: 'fa-cloud-upload-alt', bg: '#ff5500' },
    'edit': { icon: 'fa-edit', bg: '#4a90e2' },
    'delete': { icon: 'fa-trash', bg: '#dc3545' },
    'create': { icon: 'fa-plus-circle', bg: '#28a745' },
    'merge': { icon: 'fa-compress', bg: '#9b59b6' },
    'update': { icon: 'fa-sync', bg: '#00b894' }
  };
  
  const iconInfo = icons[log.action] || { icon: 'fa-circle', bg: '#666' };
  
  // Time ago
  const seconds = Math.floor((Date.now() - log.timestamp) / 1000);
  let timeAgo = 'just now';
  if (seconds > 60) timeAgo = `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds > 3600) timeAgo = `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds > 86400) timeAgo = `${Math.floor(seconds / 86400)} days ago`;
  
  return {
    icon: iconInfo.icon,
    iconBg: iconInfo.bg,
    text: `${log.action} ${log.itemType} "${log.itemName}"`,
    time: timeAgo,
    raw: log
  };
}