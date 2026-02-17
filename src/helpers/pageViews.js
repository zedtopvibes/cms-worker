// ==================== PAGE VIEWS HELPER ==================== 

// Increment page view
export async function incrementPageView(env, pageType, pageId) {
  try {
    await env.DB.prepare(
      `INSERT INTO page_views (page_type, page_id, views, last_viewed)
       VALUES (?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(page_type, page_id) DO UPDATE SET 
         views = views + 1,
         last_viewed = CURRENT_TIMESTAMP`
    ).bind(pageType, pageId).run();
    return true;
  } catch (error) {
    console.error('Error incrementing page view:', error);
    return false;
  }
}

// Get page views for a specific item
export async function getPageViews(env, pageType, pageId) {
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

// Get popular pages (top viewed)
export async function getPopularPages(env, limit = 10, pageType = null) {
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
  } catch (error) {
    console.error('Error getting popular pages:', error);
    return [];
  }
}

// Get total views across all pages
export async function getTotalPageViews(env) {
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

// Get views by type
export async function getViewsByType(env) {
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