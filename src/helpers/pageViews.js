// ==================== PAGE VIEWS HELPER (UPDATED) ====================
// Maintains backward compatibility while using enhanced tables

import { 
  incrementPageView as enhancedIncrement,
  getPageViewsForPeriod,
  getPopularPagesForPeriod,
  getViewsSummary,
  getViewTrends,
  getViewsChartData
} from './pageViewsEnhanced.js';

// ===== ORIGINAL FUNCTIONS (UPDATED TO USE NEW TABLES) =====

// Increment page view - NOW UPDATES BOTH OLD AND NEW TABLES
export async function incrementPageView(env, pageType, pageId) {
  try {
    // Use enhanced version that updates all tables
    return await enhancedIncrement(env, pageType, pageId);
  } catch (error) {
    console.error('Error incrementing page view:', error);
    
    // Fallback to old method if enhanced fails
    try {
      await env.DB.prepare(
        `INSERT INTO page_views (page_type, page_id, views, last_viewed)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(page_type, page_id) DO UPDATE SET 
           views = views + 1,
           last_viewed = CURRENT_TIMESTAMP`
      ).bind(pageType, pageId).run();
      return true;
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      return false;
    }
  }
}

// Get page views for a specific item - NOW CHECKS NEW TABLE FIRST
export async function getPageViews(env, pageType, pageId) {
  try {
    // Try new total table first (more accurate)
    const result = await env.DB.prepare(
      `SELECT total_views as views FROM total_page_views 
       WHERE page_type = ? AND page_id = ?`
    ).bind(pageType, pageId).first();
    
    if (result?.views) return result.views;
  } catch {
    // Ignore error, try old table
  }
  
  // Fallback to old table
  try {
    const { results } = await env.DB.prepare(
      `SELECT views FROM page_views WHERE page_type = ? AND page_id = ?`
    ).bind(pageType, pageId).all();
    return results[0]?.views || 0;
  } catch (error) {
    console.error('Error getting page views:', error);
    return 0;
  }
}

// Get popular pages (top viewed) - NOW USES NEW TABLES WITH PERIOD OPTION
export async function getPopularPages(env, limit = 10, pageType = null, period = 'total') {
  try {
    // Use enhanced version with period support
    return await getPopularPagesForPeriod(env, period, limit, pageType);
  } catch (error) {
    console.error('Error getting popular pages from enhanced tables:', error);
    
    // Fallback to old method
    try {
      let query = `SELECT page_type, page_id, views FROM page_views`;
      let params = [];
      
      if (pageType) {
        query += ` WHERE page_type = ?`;
        params.push(pageType);
      }
      
      query += ` ORDER BY views DESC LIMIT ?`;
      params.push(limit);
      
      const { results } = await env.DB.prepare(query).bind(...params).all();
      return results;
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      return [];
    }
  }
}

// Get total views across all pages - NOW USES NEW TABLES
export async function getTotalPageViews(env) {
  try {
    // Try new total table first
    const result = await env.DB.prepare(
      `SELECT SUM(total_views) as total FROM total_page_views`
    ).first();
    
    if (result?.total) return result.total;
  } catch {
    // Ignore error, try old table
  }
  
  // Fallback to old table
  try {
    const { results } = await env.DB.prepare(
      `SELECT SUM(views) as total FROM page_views`
    ).all();
    return results[0]?.total || 0;
  } catch (error) {
    console.error('Error getting total page views:', error);
    return 0;
  }
}

// Get views by type - NOW USES NEW TABLES
export async function getViewsByType(env) {
  try {
    // Try new total table first
    const { results } = await env.DB.prepare(
      `SELECT page_type, SUM(total_views) as total, COUNT(*) as count
       FROM total_page_views
       GROUP BY page_type
       ORDER BY total DESC`
    ).all();
    
    if (results.length > 0) return results;
  } catch {
    // Ignore error, try old table
  }
  
  // Fallback to old table
  try {
    const { results } = await env.DB.prepare(
      `SELECT page_type, SUM(views) as total, COUNT(*) as count
       FROM page_views
       GROUP BY page_type
       ORDER BY total DESC`
    ).all();
    return results;
  } catch (error) {
    console.error('Error getting views by type:', error);
    return [];
  }
}

// ===== NEW HELPER FUNCTIONS (OPTIONAL BUT USEFUL) =====

// Get today's views
export async function getTodayViews(env, pageType = null, pageId = null) {
  if (pageType && pageId) {
    return await getPageViewsForPeriod(env, pageType, pageId, 'today');
  }
  
  try {
    const { date } = getDateParts();
    let query = `SELECT SUM(views) as total FROM daily_page_views WHERE view_date = ?`;
    let params = [date];
    
    if (pageType) {
      query += ` AND page_type = ?`;
      params.push(pageType);
    }
    
    const result = await env.DB.prepare(query).bind(...params).first();
    return result?.total || 0;
  } catch (error) {
    console.error('Error getting today views:', error);
    return 0;
  }
}

// Get this week's views
export async function getWeekViews(env, pageType = null, pageId = null) {
  if (pageType && pageId) {
    return await getPageViewsForPeriod(env, pageType, pageId, 'week');
  }
  
  try {
    const { yearWeek } = getDateParts();
    let query = `SELECT SUM(views) as total FROM weekly_page_views WHERE year_week = ?`;
    let params = [yearWeek];
    
    if (pageType) {
      query += ` AND page_type = ?`;
      params.push(pageType);
    }
    
    const result = await env.DB.prepare(query).bind(...params).first();
    return result?.total || 0;
  } catch (error) {
    console.error('Error getting week views:', error);
    return 0;
  }
}

// Get this month's views
export async function getMonthViews(env, pageType = null, pageId = null) {
  if (pageType && pageId) {
    return await getPageViewsForPeriod(env, pageType, pageId, 'month');
  }
  
  try {
    const { yearMonth } = getDateParts();
    let query = `SELECT SUM(views) as total FROM monthly_page_views WHERE year_month = ?`;
    let params = [yearMonth];
    
    if (pageType) {
      query += ` AND page_type = ?`;
      params.push(pageType);
    }
    
    const result = await env.DB.prepare(query).bind(...params).first();
    return result?.total || 0;
  } catch (error) {
    console.error('Error getting month views:', error);
    return 0;
  }
}

// Get view trends for dashboard
export async function getViewTrendsForDashboard(env) {
  try {
    const summary = await getViewsSummary(env);
    return summary;
  } catch (error) {
    console.error('Error getting view trends:', error);
    return {
      totalViews: 0,
      todayViews: 0,
      weekViews: 0,
      monthViews: 0,
      byType: []
    };
  }
}

// Get chart data for stats page
export async function getViewsChartDataForPeriod(env, range = 'week', pageType = null, pageId = null) {
  try {
    return await getViewsChartData(env, range, pageType, pageId);
  } catch (error) {
    console.error('Error getting chart data:', error);
    return { labels: [], data: [] };
  }
}

// Helper function (copied from enhanced for standalone use)
function getDateParts(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Get week number (simplified)
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  
  return {
    date: `${year}-${month}-${day}`,
    yearMonth: `${year}-${month}`,
    yearWeek: `${year}-${String(weekNumber).padStart(2, '0')}`,
    year,
    month,
    day,
    weekNumber
  };
}

// ===== BACKWARD COMPATIBILITY EXPORTS =====
// All original function names work exactly the same way
// But now they use enhanced data when available