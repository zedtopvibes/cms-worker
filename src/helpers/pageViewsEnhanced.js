// ==================== ENHANCED PAGE VIEWS HELPER ====================
// Supports daily, weekly, monthly, and total views tracking

// Helper to get date components
function getDateParts(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Get week number (ISO week)
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

// ===== ENHANCED INCREMENT FUNCTION =====
// Updates ALL tables (original + new daily/weekly/monthly/total)
export async function incrementPageView(env, pageType, pageId) {
  try {
    const now = new Date();
    const { date, yearMonth, yearWeek } = getDateParts(now);
    
    const batch = [];
    
    // 1. Update original page_views table (for backward compatibility)
    batch.push(
      env.DB.prepare(
        `INSERT INTO page_views (page_type, page_id, views, last_viewed)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(page_type, page_id) DO UPDATE SET 
           views = views + 1,
           last_viewed = CURRENT_TIMESTAMP`
      ).bind(pageType, pageId)
    );
    
    // 2. Update daily stats
    batch.push(
      env.DB.prepare(
        `INSERT INTO daily_page_views (page_type, page_id, view_date, views)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(page_type, page_id, view_date) DO UPDATE SET 
           views = views + 1`
      ).bind(pageType, pageId, date)
    );
    
    // 3. Update weekly stats
    batch.push(
      env.DB.prepare(
        `INSERT INTO weekly_page_views (page_type, page_id, year_week, views)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(page_type, page_id, year_week) DO UPDATE SET 
           views = views + 1`
      ).bind(pageType, pageId, yearWeek)
    );
    
    // 4. Update monthly stats
    batch.push(
      env.DB.prepare(
        `INSERT INTO monthly_page_views (page_type, page_id, year_month, views)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(page_type, page_id, year_month) DO UPDATE SET 
           views = views + 1`
      ).bind(pageType, pageId, yearMonth)
    );
    
    // 5. Update total stats
    batch.push(
      env.DB.prepare(
        `INSERT INTO total_page_views (page_type, page_id, total_views, last_updated)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(page_type, page_id) DO UPDATE SET 
           total_views = total_views + 1,
           last_updated = CURRENT_TIMESTAMP`
      ).bind(pageType, pageId)
    );
    
    await env.DB.batch(batch);
    return true;
    
  } catch (error) {
    console.error('Error incrementing page view:', error);
    return false;
  }
}

// ===== GET VIEWS FOR SPECIFIC PERIOD =====
export async function getPageViewsForPeriod(env, pageType, pageId, period = 'total') {
  try {
    let query = '';
    let params = [pageType, pageId];
    
    switch(period) {
      case 'today':
        const { date } = getDateParts();
        query = `SELECT views FROM daily_page_views 
                 WHERE page_type = ? AND page_id = ? AND view_date = ?`;
        params.push(date);
        break;
        
      case 'week':
        const { yearWeek } = getDateParts();
        query = `SELECT views FROM weekly_page_views 
                 WHERE page_type = ? AND page_id = ? AND year_week = ?`;
        params.push(yearWeek);
        break;
        
      case 'month':
        const { yearMonth } = getDateParts();
        query = `SELECT views FROM monthly_page_views 
                 WHERE page_type = ? AND page_id = ? AND year_month = ?`;
        params.push(yearMonth);
        break;
        
      case 'total':
      default:
        query = `SELECT total_views as views FROM total_page_views 
                 WHERE page_type = ? AND page_id = ?`;
        break;
    }
    
    const result = await env.DB.prepare(query).bind(...params).first();
    return result?.views || 0;
    
  } catch (error) {
    console.error('Error getting page views for period:', error);
    return 0;
  }
}

// ===== GET TODAY'S VIEWS =====
export async function getTodayViews(env, pageType = null, pageId = null) {
  try {
    const { date } = getDateParts();
    
    if (pageType && pageId) {
      // Get views for specific item today
      const result = await env.DB.prepare(
        `SELECT views FROM daily_page_views 
         WHERE page_type = ? AND page_id = ? AND view_date = ?`
      ).bind(pageType, pageId, date).first();
      
      return result?.views || 0;
    } else {
      // Get total views for today across all items
      let query = `SELECT SUM(views) as total FROM daily_page_views WHERE view_date = ?`;
      let params = [date];
      
      if (pageType) {
        query += ` AND page_type = ?`;
        params.push(pageType);
      }
      
      const result = await env.DB.prepare(query).bind(...params).first();
      return result?.total || 0;
    }
  } catch (error) {
    console.error('Error getting today views:', error);
    return 0;
  }
}

// ===== GET THIS WEEK'S VIEWS =====
export async function getWeekViews(env, pageType = null, pageId = null) {
  try {
    const { yearWeek } = getDateParts();
    
    if (pageType && pageId) {
      // Get views for specific item this week
      const result = await env.DB.prepare(
        `SELECT views FROM weekly_page_views 
         WHERE page_type = ? AND page_id = ? AND year_week = ?`
      ).bind(pageType, pageId, yearWeek).first();
      
      return result?.views || 0;
    } else {
      // Get total views for this week across all items
      let query = `SELECT SUM(views) as total FROM weekly_page_views WHERE year_week = ?`;
      let params = [yearWeek];
      
      if (pageType) {
        query += ` AND page_type = ?`;
        params.push(pageType);
      }
      
      const result = await env.DB.prepare(query).bind(...params).first();
      return result?.total || 0;
    }
  } catch (error) {
    console.error('Error getting week views:', error);
    return 0;
  }
}

// ===== GET THIS MONTH'S VIEWS =====
export async function getMonthViews(env, pageType = null, pageId = null) {
  try {
    const { yearMonth } = getDateParts();
    
    if (pageType && pageId) {
      // Get views for specific item this month
      const result = await env.DB.prepare(
        `SELECT views FROM monthly_page_views 
         WHERE page_type = ? AND page_id = ? AND year_month = ?`
      ).bind(pageType, pageId, yearMonth).first();
      
      return result?.views || 0;
    } else {
      // Get total views for this month across all items
      let query = `SELECT SUM(views) as total FROM monthly_page_views WHERE year_month = ?`;
      let params = [yearMonth];
      
      if (pageType) {
        query += ` AND page_type = ?`;
        params.push(pageType);
      }
      
      const result = await env.DB.prepare(query).bind(...params).first();
      return result?.total || 0;
    }
  } catch (error) {
    console.error('Error getting month views:', error);
    return 0;
  }
}

// ===== GET POPULAR PAGES FOR A PERIOD =====
export async function getPopularPagesForPeriod(env, period = 'total', limit = 10, pageType = null) {
  try {
    let query = '';
    let params = [];
    
    switch(period) {
      case 'today':
        const { date } = getDateParts();
        query = `SELECT page_type, page_id, views FROM daily_page_views 
                 WHERE view_date = ?`;
        params.push(date);
        break;
        
      case 'week':
        const { yearWeek } = getDateParts();
        query = `SELECT page_type, page_id, views FROM weekly_page_views 
                 WHERE year_week = ?`;
        params.push(yearWeek);
        break;
        
      case 'month':
        const { yearMonth } = getDateParts();
        query = `SELECT page_type, page_id, views FROM monthly_page_views 
                 WHERE year_month = ?`;
        params.push(yearMonth);
        break;
        
      case 'total':
      default:
        query = `SELECT page_type, page_id, total_views as views FROM total_page_views`;
        break;
    }
    
    if (pageType) {
      query += ` AND page_type = ?`;
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

// ===== GET VIEW TRENDS (COMPARE PERIODS) =====
export async function getViewTrends(env, pageType, pageId) {
  try {
    const now = new Date();
    const today = getDateParts(now);
    
    // Get yesterday's date
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayParts = getDateParts(yesterday);
    
    // Get last week
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekParts = getDateParts(lastWeek);
    
    // Get last month
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthParts = getDateParts(lastMonth);
    
    // Get all values in parallel
    const [
      todayViews,
      yesterdayResult,
      thisWeekViews,
      lastWeekResult,
      thisMonthViews,
      lastMonthResult,
      totalViews
    ] = await Promise.all([
      getPageViewsForPeriod(env, pageType, pageId, 'today'),
      env.DB.prepare(
        `SELECT views FROM daily_page_views 
         WHERE page_type = ? AND page_id = ? AND view_date = ?`
      ).bind(pageType, pageId, yesterdayParts.date).first(),
      getPageViewsForPeriod(env, pageType, pageId, 'week'),
      env.DB.prepare(
        `SELECT views FROM weekly_page_views 
         WHERE page_type = ? AND page_id = ? AND year_week = ?`
      ).bind(pageType, pageId, lastWeekParts.yearWeek).first(),
      getPageViewsForPeriod(env, pageType, pageId, 'month'),
      env.DB.prepare(
        `SELECT views FROM monthly_page_views 
         WHERE page_type = ? AND page_id = ? AND year_month = ?`
      ).bind(pageType, pageId, lastMonthParts.yearMonth).first(),
      getPageViewsForPeriod(env, pageType, pageId, 'total')
    ]);
    
    const yesterdayViews = yesterdayResult?.views || 0;
    const lastWeekViews = lastWeekResult?.views || 0;
    const lastMonthViews = lastMonthResult?.views || 0;
    
    return {
      today: todayViews,
      yesterday: yesterdayViews,
      thisWeek: thisWeekViews,
      lastWeek: lastWeekViews,
      thisMonth: thisMonthViews,
      lastMonth: lastMonthViews,
      total: totalViews,
      
      // Calculate changes
      dailyChange: todayViews - yesterdayViews,
      weeklyChange: thisWeekViews - lastWeekViews,
      monthlyChange: thisMonthViews - lastMonthViews,
      
      // Calculate percentages
      dailyChangePercent: yesterdayViews === 0 ? 100 : Math.round((todayViews - yesterdayViews) / yesterdayViews * 100),
      weeklyChangePercent: lastWeekViews === 0 ? 100 : Math.round((thisWeekViews - lastWeekViews) / lastWeekViews * 100),
      monthlyChangePercent: lastMonthViews === 0 ? 100 : Math.round((thisMonthViews - lastMonthViews) / lastMonthViews * 100),
      
      // Trends
      dailyTrend: todayViews > yesterdayViews ? 'up' : todayViews < yesterdayViews ? 'down' : 'same',
      weeklyTrend: thisWeekViews > lastWeekViews ? 'up' : thisWeekViews < lastWeekViews ? 'down' : 'same',
      monthlyTrend: thisMonthViews > lastMonthViews ? 'up' : thisMonthViews < lastMonthViews ? 'down' : 'same'
    };
    
  } catch (error) {
    console.error('Error getting view trends:', error);
    return null;
  }
}

// ===== GET CHART DATA =====
export async function getViewsChartData(env, range = 'week', pageType = null, pageId = null) {
  try {
    const now = new Date();
    let query = '';
    let params = [];
    let labels = [];
    
    if (range === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const parts = getDateParts(date);
        labels.push(parts.date);
      }
      
      query = `SELECT view_date, SUM(views) as views 
               FROM daily_page_views 
               WHERE view_date BETWEEN ? AND ?`;
      
      const endDate = getDateParts(now).date;
      const startDate = getDateParts(new Date(now.setDate(now.getDate() - 6))).date;
      params = [startDate, endDate];
      
    } else if (range === 'month') {
      // Last 30 days grouped by week
      for (let i = 4; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - (i * 7));
        const parts = getDateParts(date);
        labels.push(`Week ${parts.weekNumber}`);
      }
      
      query = `SELECT year_week, SUM(views) as views 
               FROM weekly_page_views 
               WHERE year_week >= ?`;
      
      const startWeek = getDateParts(new Date(now.setDate(now.getDate() - 28))).yearWeek;
      params = [startWeek];
      
    } else if (range === 'year') {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const parts = getDateParts(date);
        labels.push(`${parts.year}-${parts.month}`);
      }
      
      query = `SELECT year_month, SUM(views) as views 
               FROM monthly_page_views 
               WHERE year_month >= ?`;
      
      const startMonth = getDateParts(new Date(now.setMonth(now.getMonth() - 11))).yearMonth;
      params = [startMonth];
    }
    
    if (pageType && pageId) {
      query += ` AND page_type = ? AND page_id = ?`;
      params.push(pageType, pageId);
    }
    
    query += ` GROUP BY ${range === 'week' ? 'view_date' : range === 'month' ? 'year_week' : 'year_month'} 
               ORDER BY ${range === 'week' ? 'view_date' : range === 'month' ? 'year_week' : 'year_month'} ASC`;
    
    const { results } = await env.DB.prepare(query).bind(...params).all();
    
    // Map results to labels
    const data = labels.map(label => {
      const found = results.find(r => {
        if (range === 'week') return r.view_date === label;
        if (range === 'month') return r.year_week === label;
        return r.year_month === label;
      });
      return found?.views || 0;
    });
    
    return { labels, data };
    
  } catch (error) {
    console.error('Error getting chart data:', error);
    return { labels: [], data: [] };
  }
}

// ===== GET VIEWS SUMMARY FOR DASHBOARD =====
export async function getViewsSummary(env) {
  try {
    const [total, byType, today, week, month] = await Promise.all([
      // Total views
      env.DB.prepare(`SELECT SUM(total_views) as total FROM total_page_views`).first(),
      
      // Views by type
      env.DB.prepare(`
        SELECT page_type, SUM(total_views) as total, COUNT(*) as count
        FROM total_page_views 
        GROUP BY page_type 
        ORDER BY total DESC
      `).all(),
      
      // Today's views
      getTodayViews(env),
      
      // This week's views
      getWeekViews(env),
      
      // This month's views
      getMonthViews(env)
    ]);
    
    return {
      totalViews: total?.total || 0,
      todayViews: today || 0,
      weekViews: week || 0,
      monthViews: month || 0,
      byType: byType.results || []
    };
    
  } catch (error) {
    console.error('Error getting views summary:', error);
    return {
      totalViews: 0,
      todayViews: 0,
      weekViews: 0,
      monthViews: 0,
      byType: []
    };
  }
}

// ===== BACKFILL EXISTING DATA FROM OLD TABLE =====
export async function backfillPageViews(env) {
  try {
    console.log('Starting page views backfill...');
    
    // Check if old table exists
    const tableCheck = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='page_views'`
    ).first();
    
    if (!tableCheck) {
      console.log('No existing page_views table to backfill from');
      return { success: 0, failed: 0, message: 'No data to backfill' };
    }
    
    // Get all existing page views
    const { results } = await env.DB.prepare(
      `SELECT page_type, page_id, views, last_viewed FROM page_views`
    ).all();
    
    console.log(`Found ${results.length} existing records to backfill`);
    
    let success = 0;
    let failed = 0;
    let errors = [];
    
    // Process in batches of 50 to avoid memory issues
    for (let i = 0; i < results.length; i += 50) {
      const batch = [];
      const batchItems = results.slice(i, i + 50);
      
      for (const row of batchItems) {
        try {
          // Use last_viewed if available, otherwise use current date
          const viewDate = row.last_viewed ? new Date(row.last_viewed) : new Date();
          const { date, yearMonth, yearWeek } = getDateParts(viewDate);
          
          // Daily
          batch.push(
            env.DB.prepare(
              `INSERT INTO daily_page_views (page_type, page_id, view_date, views)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(page_type, page_id, view_date) DO UPDATE SET 
                 views = views + ?`
            ).bind(row.page_type, row.page_id, date, row.views, row.views)
          );
          
          // Weekly
          batch.push(
            env.DB.prepare(
              `INSERT INTO weekly_page_views (page_type, page_id, year_week, views)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(page_type, page_id, year_week) DO UPDATE SET 
                 views = views + ?`
            ).bind(row.page_type, row.page_id, yearWeek, row.views, row.views)
          );
          
          // Monthly
          batch.push(
            env.DB.prepare(
              `INSERT INTO monthly_page_views (page_type, page_id, year_month, views)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(page_type, page_id, year_month) DO UPDATE SET 
                 views = views + ?`
            ).bind(row.page_type, row.page_id, yearMonth, row.views, row.views)
          );
          
          // Total
          batch.push(
            env.DB.prepare(
              `INSERT INTO total_page_views (page_type, page_id, total_views, last_updated)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(page_type, page_id) DO UPDATE SET 
                 total_views = total_views + ?,
                 last_updated = CURRENT_TIMESTAMP`
            ).bind(row.page_type, row.page_id, row.views, row.last_viewed || new Date().toISOString(), row.views)
          );
          
          success++;
        } catch (error) {
          failed++;
          errors.push({ row: row.page_id, error: error.message });
        }
      }
      
      if (batch.length > 0) {
        await env.DB.batch(batch);
        console.log(`Processed batch ${Math.floor(i/50) + 1}/${Math.ceil(results.length/50)}`);
      }
    }
    
    console.log(`\n=== Backfill Complete ===`);
    console.log(`✅ Success: ${success}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (errors.length > 0) {
      console.log('First 5 errors:', errors.slice(0, 5));
    }
    
    return { success, failed, errors: errors.slice(0, 10) };
    
  } catch (error) {
    console.error('Backfill error:', error);
    return { success: 0, failed: 0, error: error.message };
  }
}

// ===== CLEAN UP OLD DATA (OPTIONAL) =====
export async function cleanupOldViews(env, daysToKeep = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const { date } = getDateParts(cutoffDate);
    
    const result = await env.DB.prepare(
      `DELETE FROM daily_page_views WHERE view_date < ?`
    ).bind(date).run();
    
    console.log(`Cleaned up daily views older than ${date}`);
    return { success: true, deleted: result.meta?.changes || 0 };
    
  } catch (error) {
    console.error('Error cleaning up old views:', error);
    return { success: false, error: error.message };
  }
}