// ==================== PAGE VIEWS HELPER ====================
// Handles all page view operations

/**
 * Increment page view count for a specific page
 * @param {Object} env - Environment object with DB binding
 * @param {string} pageType - Type of page (song, album, artist, etc.)
 * @param {string} pageId - Unique identifier for the page
 * @returns {Promise<boolean>} - Success status
 */
export async function incrementPageView(env, pageType, pageId) {
  try {
    if (!env || !env.DB) {
      console.error('❌ Database connection not available');
      return false;
    }

    const result = await env.DB.prepare(
      `INSERT INTO page_views (page_type, page_id, views, last_viewed, last_viewed_date)
       VALUES (?, ?, 1, CURRENT_TIMESTAMP, date('now'))
       ON CONFLICT(page_type, page_id) DO UPDATE SET 
         views = views + 1,
         last_viewed = CURRENT_TIMESTAMP,
         last_viewed_date = date('now')`
    ).bind(pageType, pageId).run();
    
    console.log(`✅ Page view recorded: ${pageType}/${pageId}`);
    return true;
  } catch (error) {
    console.error('❌ Error incrementing page view:', error);
    console.error('   Page Type:', pageType);
    console.error('   Page ID:', pageId);
    return false;
  }
}

/**
 * Get page views for a specific item
 * @param {Object} env - Environment object with DB binding
 * @param {string} pageType - Type of page
 * @param {string} pageId - Page identifier
 * @returns {Promise<number>} - Total views count
 */
export async function getPageViews(env, pageType, pageId) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT views FROM page_views WHERE page_type = ? AND page_id = ?`
    ).bind(pageType, pageId).all();
    
    return results[0]?.views || 0;
  } catch (error) {
    console.error('❌ Error getting page views:', error);
    return 0;
  }
}

/**
 * Get popular pages (top viewed)
 * @param {Object} env - Environment object with DB binding
 * @param {number} limit - Number of results to return
 * @param {string|null} pageType - Filter by page type (optional)
 * @returns {Promise<Array>} - Array of popular pages
 */
export async function getPopularPages(env, limit = 10, pageType = null) {
  try {
    let query = `SELECT page_type, page_id, views, last_viewed FROM page_views`;
    let params = [];
    
    if (pageType) {
      query += ` WHERE page_type = ?`;
      params.push(pageType);
    }
    
    query += ` ORDER BY views DESC LIMIT ?`;
    params.push(limit);
    
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return results || [];
  } catch (error) {
    console.error('❌ Error getting popular pages:', error);
    return [];
  }
}

/**
 * Get total views across all pages
 * @param {Object} env - Environment object with DB binding
 * @returns {Promise<number>} - Total views count
 */
export async function getTotalPageViews(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT SUM(views) as total FROM page_views`
    ).all();
    
    return results[0]?.total || 0;
  } catch (error) {
    console.error('❌ Error getting total page views:', error);
    return 0;
  }
}

/**
 * Get views grouped by page type
 * @param {Object} env - Environment object with DB binding
 * @returns {Promise<Array>} - Array of stats by type
 */
export async function getViewsByType(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT page_type, SUM(views) as total, COUNT(*) as count
       FROM page_views
       GROUP BY page_type
       ORDER BY total DESC`
    ).all();
    
    return results || [];
  } catch (error) {
    console.error('❌ Error getting views by type:', error);
    return [];
  }
}

/**
 * Get today's page views count
 * @param {Object} env - Environment object with DB binding
 * @returns {Promise<number>} - Today's views count
 */
export async function getTodayViews(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM page_views 
       WHERE date(last_viewed_date) = date('now')`
    ).all();
    
    return results[0]?.total || 0;
  } catch (error) {
    console.error('❌ Error getting today\'s views:', error);
    return 0;
  }
}

/**
 * Get views for a specific date
 * @param {Object} env - Environment object with DB binding
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<number>} - Views count for that date
 */
export async function getViewsByDate(env, date) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM page_views 
       WHERE date(last_viewed_date) = date(?)`
    ).bind(date).all();
    
    return results[0]?.total || 0;
  } catch (error) {
    console.error('❌ Error getting views by date:', error);
    return 0;
  }
}

/**
 * Get recent page views (last 7 days)
 * @param {Object} env - Environment object with DB binding
 * @returns {Promise<Array>} - Array of daily view counts
 */
export async function getRecentViews(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT date(last_viewed_date) as view_date, COUNT(*) as count
       FROM page_views
       WHERE last_viewed_date >= date('now', '-7 days')
       GROUP BY date(last_viewed_date)
       ORDER BY view_date DESC`
    ).all();
    
    return results || [];
  } catch (error) {
    console.error('❌ Error getting recent views:', error);
    return [];
  }
}

export default {
  incrementPageView,
  getPageViews,
  getPopularPages,
  getTotalPageViews,
  getViewsByType,
  getTodayViews,
  getViewsByDate,
  getRecentViews
};