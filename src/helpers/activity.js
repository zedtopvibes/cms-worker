// ==================== ACTIVITY LOG HELPER (PURE R2) ====================

// Log activity to R2
export async function logActivity(env, action, file, adminId, details = {}, ip = 'unknown') {
  const logKey = '_logs/activity.json';
  const existing = await env.media.get(logKey);
  
  let logs = [];
  if (existing) {
    logs = JSON.parse(await existing.text());
  }
  
  logs.unshift({
    action,
    file,
    admin: adminId,
    ip,
    time: new Date().toISOString(),
    details
  });
  
  // Keep only latest 500 logs
  logs = logs.slice(0, 500);
  
  await env.media.put(logKey, JSON.stringify(logs, null, 2), {
    httpMetadata: { contentType: 'application/json' }
  });
  
  return { success: true };
}

// Get activities from R2 with filtering
export async function getActivities(env, filter = 'all', days = 7, page = 1, limit = 20) {
  const logFile = await env.media.get('_logs/activity.json');
  let allLogs = [];
  
  if (logFile) {
    allLogs = JSON.parse(await logFile.text());
  }

  // Apply filters
  let filteredLogs = [...allLogs];
  
  // Date filter
  if (days > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    filteredLogs = filteredLogs.filter(log => new Date(log.time) >= cutoffDate);
  }

  // Action filter
  if (filter !== 'all') {
    filteredLogs = filteredLogs.filter(log => log.action === filter);
  }

  // Get unique actions
  const actions = [...new Set(allLogs.map(log => log.action))].filter(Boolean);

  // Pagination
  const total = filteredLogs.length;
  const totalPages = Math.ceil(total / limit);
  const startIdx = (page - 1) * limit;
  const paginatedLogs = filteredLogs.slice(startIdx, startIdx + limit);

  return {
    logs: paginatedLogs,
    total,
    page,
    totalPages,
    actions
  };
}

// Delete old logs (for cron job)
export async function cleanupOldLogs(env, keepDays = 30) {
  const logFile = await env.media.get('_logs/activity.json');
  
  if (!logFile) return { success: true, deleted: 0 };
  
  const logs = JSON.parse(await logFile.text());
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - keepDays);
  
  const filteredLogs = logs.filter(log => new Date(log.time) >= cutoffDate);
  const deleted = logs.length - filteredLogs.length;
  
  await env.media.put('_logs/activity.json', JSON.stringify(filteredLogs, null, 2), {
    httpMetadata: { contentType: 'application/json' }
  });
  
  return { success: true, deleted };
}