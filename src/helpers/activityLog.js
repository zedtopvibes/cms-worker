// ==================== KV-BASED ACTIVITY LOGGING ====================

// Log admin activity to KV (no more D1 errors!)
export async function logAdminActivity(env, adminId, action, itemType, itemId, itemName) {
  try {
    const timestamp = Date.now();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Create log entry
    const logEntry = {
      id: `${timestamp}-${Math.random().toString(36).substring(2, 10)}`,
      adminId: adminId || 'unknown',
      action,
      itemType,
      itemId,
      itemName: itemName || itemId,
      timestamp,
      date,
      readableTime: new Date(timestamp).toLocaleString()
    };
    
    // Store in KV with multiple keys for different queries
    
    // 1. Store by ID (for individual retrieval)
    await env.ACTIVITY_LOGS.put(
      `log:${logEntry.id}`,
      JSON.stringify(logEntry)
    );
    
    // 2. Store in date-based list (for daily views)
    await addToDateList(env, date, logEntry.id);
    
    // 3. Store in admin-based list (for user-specific views)
    await addToAdminList(env, adminId || 'unknown', logEntry.id);
    
    // 4. Store in action-based list (for filtering)
    await addToActionList(env, action, logEntry.id);
    
    // 5. Keep a recent list (last 100 logs)
    await addToRecentList(env, logEntry.id);
    
    console.log(`✅ Activity logged to KV: ${action} ${itemType} - ${itemName || itemId}`);
    return true;
  } catch (error) {
    console.error('❌ Error logging activity to KV:', error);
    return false;
  }
}

// Helper to add to date-based list
async function addToDateList(env, date, logId) {
  const key = `date:${date}`;
  const existing = await env.ACTIVITY_LOGS.get(key, 'json') || [];
  const updated = [logId, ...existing].slice(0, 100); // Keep last 100 per day
  await env.ACTIVITY_LOGS.put(key, JSON.stringify(updated));
}

// Helper to add to admin-based list
async function addToAdminList(env, adminId, logId) {
  const key = `admin:${adminId}`;
  const existing = await env.ACTIVITY_LOGS.get(key, 'json') || [];
  const updated = [logId, ...existing].slice(0, 100); // Keep last 100 per admin
  await env.ACTIVITY_LOGS.put(key, JSON.stringify(updated));
}

// Helper to add to action-based list
async function addToActionList(env, action, logId) {
  const key = `action:${action}`;
  const existing = await env.ACTIVITY_LOGS.get(key, 'json') || [];
  const updated = [logId, ...existing].slice(0, 100); // Keep last 100 per action
  await env.ACTIVITY_LOGS.put(key, JSON.stringify(updated));
}

// Helper to add to recent list
async function addToRecentList(env, logId) {
  const key = 'recent';
  const existing = await env.ACTIVITY_LOGS.get(key, 'json') || [];
  const updated = [logId, ...existing].slice(0, 100); // Keep last 100 overall
  await env.ACTIVITY_LOGS.put(key, JSON.stringify(updated));
}

// Get recent activity logs
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

// Get activity by admin
export async function getActivityByAdmin(env, adminId, limit = 50) {
  try {
    const adminList = await env.ACTIVITY_LOGS.get(`admin:${adminId}`, 'json') || [];
    const logs = [];
    
    for (let i = 0; i < Math.min(limit, adminList.length); i++) {
      const log = await env.ACTIVITY_LOGS.get(`log:${adminList[i]}`, 'json');
      if (log) logs.push(log);
    }
    
    return logs;
  } catch (error) {
    console.error('Error getting activity by admin:', error);
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

// Format activity for display (matches your existing UI)
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
  
  // Format time ago
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