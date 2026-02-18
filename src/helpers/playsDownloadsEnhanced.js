// ==================== ENHANCED PLAYS & DOWNLOADS HELPER ====================

// Helper to get date components (same as pageViewsEnhanced)
function getDateParts(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
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

// ===== INCREMENT PLAYS =====
export async function incrementPlays(env, itemType, itemId) {
  try {
    const now = new Date();
    const { date, yearMonth, yearWeek } = getDateParts(now);
    
    const batch = [];
    
    // Daily plays
    batch.push(
      env.DB.prepare(
        `INSERT INTO daily_plays (item_type, item_id, play_date, plays)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(item_type, item_id, play_date) DO UPDATE SET 
           plays = plays + 1`
      ).bind(itemType, itemId, date)
    );
    
    // Weekly plays
    batch.push(
      env.DB.prepare(
        `INSERT INTO weekly_plays (item_type, item_id, year_week, plays)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(item_type, item_id, year_week) DO UPDATE SET 
           plays = plays + 1`
      ).bind(itemType, itemId, yearWeek)
    );
    
    // Monthly plays
    batch.push(
      env.DB.prepare(
        `INSERT INTO monthly_plays (item_type, item_id, year_month, plays)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(item_type, item_id, year_month) DO UPDATE SET 
           plays = plays + 1`
      ).bind(itemType, itemId, yearMonth)
    );
    
    // Total plays
    batch.push(
      env.DB.prepare(
        `INSERT INTO total_plays (item_type, item_id, total_plays, last_updated)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(item_type, item_id) DO UPDATE SET 
           total_plays = total_plays + 1,
           last_updated = CURRENT_TIMESTAMP`
      ).bind(itemType, itemId)
    );
    
    await env.DB.batch(batch);
    return true;
    
  } catch (error) {
    console.error('Error incrementing plays:', error);
    return false;
  }
}

// ===== INCREMENT DOWNLOADS =====
export async function incrementDownloads(env, itemType, itemId) {
  try {
    const now = new Date();
    const { date, yearMonth, yearWeek } = getDateParts(now);
    
    const batch = [];
    
    // Daily downloads
    batch.push(
      env.DB.prepare(
        `INSERT INTO daily_downloads (item_type, item_id, download_date, downloads)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(item_type, item_id, download_date) DO UPDATE SET 
           downloads = downloads + 1`
      ).bind(itemType, itemId, date)
    );
    
    // Weekly downloads
    batch.push(
      env.DB.prepare(
        `INSERT INTO weekly_downloads (item_type, item_id, year_week, downloads)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(item_type, item_id, year_week) DO UPDATE SET 
           downloads = downloads + 1`
      ).bind(itemType, itemId, yearWeek)
    );
    
    // Monthly downloads
    batch.push(
      env.DB.prepare(
        `INSERT INTO monthly_downloads (item_type, item_id, year_month, downloads)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(item_type, item_id, year_month) DO UPDATE SET 
           downloads = downloads + 1`
      ).bind(itemType, itemId, yearMonth)
    );
    
    // Total downloads
    batch.push(
      env.DB.prepare(
        `INSERT INTO total_downloads (item_type, item_id, total_downloads, last_updated)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(item_type, item_id) DO UPDATE SET 
           total_downloads = total_downloads + 1,
           last_updated = CURRENT_TIMESTAMP`
      ).bind(itemType, itemId)
    );
    
    await env.DB.batch(batch);
    return true;
    
  } catch (error) {
    console.error('Error incrementing downloads:', error);
    return false;
  }
}

// ===== GET PLAYS FOR PERIOD =====
export async function getPlaysForPeriod(env, itemType, itemId, period = 'total') {
  try {
    let query = '';
    let params = [itemType, itemId];
    
    switch(period) {
      case 'today':
        const { date } = getDateParts();
        query = `SELECT plays FROM daily_plays 
                 WHERE item_type = ? AND item_id = ? AND play_date = ?`;
        params.push(date);
        break;
        
      case 'week':
        const { yearWeek } = getDateParts();
        query = `SELECT plays FROM weekly_plays 
                 WHERE item_type = ? AND item_id = ? AND year_week = ?`;
        params.push(yearWeek);
        break;
        
      case 'month':
        const { yearMonth } = getDateParts();
        query = `SELECT plays FROM monthly_plays 
                 WHERE item_type = ? AND item_id = ? AND year_month = ?`;
        params.push(yearMonth);
        break;
        
      case 'total':
      default:
        query = `SELECT total_plays as plays FROM total_plays 
                 WHERE item_type = ? AND item_id = ?`;
        break;
    }
    
    const result = await env.DB.prepare(query).bind(...params).first();
    return result?.plays || 0;
    
  } catch (error) {
    console.error('Error getting plays:', error);
    return 0;
  }
}

// ===== GET DOWNLOADS FOR PERIOD =====
export async function getDownloadsForPeriod(env, itemType, itemId, period = 'total') {
  try {
    let query = '';
    let params = [itemType, itemId];
    
    switch(period) {
      case 'today':
        const { date } = getDateParts();
        query = `SELECT downloads FROM daily_downloads 
                 WHERE item_type = ? AND item_id = ? AND download_date = ?`;
        params.push(date);
        break;
        
      case 'week':
        const { yearWeek } = getDateParts();
        query = `SELECT downloads FROM weekly_downloads 
                 WHERE item_type = ? AND item_id = ? AND year_week = ?`;
        params.push(yearWeek);
        break;
        
      case 'month':
        const { yearMonth } = getDateParts();
        query = `SELECT downloads FROM monthly_downloads 
                 WHERE item_type = ? AND item_id = ? AND year_month = ?`;
        params.push(yearMonth);
        break;
        
      case 'total':
      default:
        query = `SELECT total_downloads as downloads FROM total_downloads 
                 WHERE item_type = ? AND item_id = ?`;
        break;
    }
    
    const result = await env.DB.prepare(query).bind(...params).first();
    return result?.downloads || 0;
    
  } catch (error) {
    console.error('Error getting downloads:', error);
    return 0;
  }
}

// ===== GET POPULAR ITEMS BY PLAYS =====
export async function getPopularByPlays(env, period = 'total', limit = 10, itemType = null) {
  try {
    let query = '';
    let params = [];
    
    switch(period) {
      case 'today':
        const { date } = getDateParts();
        query = `SELECT item_type, item_id, plays FROM daily_plays 
                 WHERE play_date = ?`;
        params.push(date);
        break;
        
      case 'week':
        const { yearWeek } = getDateParts();
        query = `SELECT item_type, item_id, plays FROM weekly_plays 
                 WHERE year_week = ?`;
        params.push(yearWeek);
        break;
        
      case 'month':
        const { yearMonth } = getDateParts();
        query = `SELECT item_type, item_id, plays FROM monthly_plays 
                 WHERE year_month = ?`;
        params.push(yearMonth);
        break;
        
      case 'total':
      default:
        query = `SELECT item_type, item_id, total_plays as plays FROM total_plays`;
        break;
    }
    
    if (itemType) {
      query += ` AND item_type = ?`;
      params.push(itemType);
    }
    
    query += ` ORDER BY plays DESC LIMIT ?`;
    params.push(limit);
    
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return results;
    
  } catch (error) {
    console.error('Error getting popular by plays:', error);
    return [];
  }
}

// ===== GET POPULAR ITEMS BY DOWNLOADS =====
export async function getPopularByDownloads(env, period = 'total', limit = 10, itemType = null) {
  try {
    let query = '';
    let params = [];
    
    switch(period) {
      case 'today':
        const { date } = getDateParts();
        query = `SELECT item_type, item_id, downloads FROM daily_downloads 
                 WHERE download_date = ?`;
        params.push(date);
        break;
        
      case 'week':
        const { yearWeek } = getDateParts();
        query = `SELECT item_type, item_id, downloads FROM weekly_downloads 
                 WHERE year_week = ?`;
        params.push(yearWeek);
        break;
        
      case 'month':
        const { yearMonth } = getDateParts();
        query = `SELECT item_type, item_id, downloads FROM monthly_downloads 
                 WHERE year_month = ?`;
        params.push(yearMonth);
        break;
        
      case 'total':
      default:
        query = `SELECT item_type, item_id, total_downloads as downloads FROM total_downloads`;
        break;
    }
    
    if (itemType) {
      query += ` AND item_type = ?`;
      params.push(itemType);
    }
    
    query += ` ORDER BY downloads DESC LIMIT ?`;
    params.push(limit);
    
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return results;
    
  } catch (error) {
    console.error('Error getting popular by downloads:', error);
    return [];
  }
}

// ===== GET PLAYS TRENDS =====
export async function getPlaysTrends(env, itemType, itemId) {
  try {
    const now = new Date();
    
    // Get yesterday
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
    
    const [
      todayPlays,
      yesterdayResult,
      thisWeekPlays,
      lastWeekResult,
      thisMonthPlays,
      lastMonthResult,
      totalPlays
    ] = await Promise.all([
      getPlaysForPeriod(env, itemType, itemId, 'today'),
      env.DB.prepare(
        `SELECT plays FROM daily_plays 
         WHERE item_type = ? AND item_id = ? AND play_date = ?`
      ).bind(itemType, itemId, yesterdayParts.date).first(),
      getPlaysForPeriod(env, itemType, itemId, 'week'),
      env.DB.prepare(
        `SELECT plays FROM weekly_plays 
         WHERE item_type = ? AND item_id = ? AND year_week = ?`
      ).bind(itemType, itemId, lastWeekParts.yearWeek).first(),
      getPlaysForPeriod(env, itemType, itemId, 'month'),
      env.DB.prepare(
        `SELECT plays FROM monthly_plays 
         WHERE item_type = ? AND item_id = ? AND year_month = ?`
      ).bind(itemType, itemId, lastMonthParts.yearMonth).first(),
      getPlaysForPeriod(env, itemType, itemId, 'total')
    ]);
    
    const yesterdayPlays = yesterdayResult?.plays || 0;
    const lastWeekPlays = lastWeekResult?.plays || 0;
    const lastMonthPlays = lastMonthResult?.plays || 0;
    
    return {
      today: todayPlays,
      yesterday: yesterdayPlays,
      thisWeek: thisWeekPlays,
      lastWeek: lastWeekPlays,
      thisMonth: thisMonthPlays,
      lastMonth: lastMonthPlays,
      total: totalPlays,
      
      dailyChange: todayPlays - yesterdayPlays,
      weeklyChange: thisWeekPlays - lastWeekPlays,
      monthlyChange: thisMonthPlays - lastMonthPlays,
      
      dailyChangePercent: yesterdayPlays === 0 ? 100 : Math.round((todayPlays - yesterdayPlays) / yesterdayPlays * 100),
      weeklyChangePercent: lastWeekPlays === 0 ? 100 : Math.round((thisWeekPlays - lastWeekPlays) / lastWeekPlays * 100),
      monthlyChangePercent: lastMonthPlays === 0 ? 100 : Math.round((thisMonthPlays - lastMonthPlays) / lastMonthPlays * 100)
    };
    
  } catch (error) {
    console.error('Error getting plays trends:', error);
    return null;
  }
}

// ===== GET DOWNLOADS TRENDS =====
export async function getDownloadsTrends(env, itemType, itemId) {
  try {
    const now = new Date();
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayParts = getDateParts(yesterday);
    
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekParts = getDateParts(lastWeek);
    
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthParts = getDateParts(lastMonth);
    
    const [
      todayDownloads,
      yesterdayResult,
      thisWeekDownloads,
      lastWeekResult,
      thisMonthDownloads,
      lastMonthResult,
      totalDownloads
    ] = await Promise.all([
      getDownloadsForPeriod(env, itemType, itemId, 'today'),
      env.DB.prepare(
        `SELECT downloads FROM daily_downloads 
         WHERE item_type = ? AND item_id = ? AND download_date = ?`
      ).bind(itemType, itemId, yesterdayParts.date).first(),
      getDownloadsForPeriod(env, itemType, itemId, 'week'),
      env.DB.prepare(
        `SELECT downloads FROM weekly_downloads 
         WHERE item_type = ? AND item_id = ? AND year_week = ?`
      ).bind(itemType, itemId, lastWeekParts.yearWeek).first(),
      getDownloadsForPeriod(env, itemType, itemId, 'month'),
      env.DB.prepare(
        `SELECT downloads FROM monthly_downloads 
         WHERE item_type = ? AND item_id = ? AND year_month = ?`
      ).bind(itemType, itemId, lastMonthParts.yearMonth).first(),
      getDownloadsForPeriod(env, itemType, itemId, 'total')
    ]);
    
    const yesterdayDownloads = yesterdayResult?.downloads || 0;
    const lastWeekDownloads = lastWeekResult?.downloads || 0;
    const lastMonthDownloads = lastMonthResult?.downloads || 0;
    
    return {
      today: todayDownloads,
      yesterday: yesterdayDownloads,
      thisWeek: thisWeekDownloads,
      lastWeek: lastWeekDownloads,
      thisMonth: thisMonthDownloads,
      lastMonth: lastMonthDownloads,
      total: totalDownloads,
      
      dailyChange: todayDownloads - yesterdayDownloads,
      weeklyChange: thisWeekDownloads - lastWeekDownloads,
      monthlyChange: thisMonthDownloads - lastMonthDownloads,
      
      dailyChangePercent: yesterdayDownloads === 0 ? 100 : Math.round((todayDownloads - yesterdayDownloads) / yesterdayDownloads * 100),
      weeklyChangePercent: lastWeekDownloads === 0 ? 100 : Math.round((thisWeekDownloads - lastWeekDownloads) / lastWeekDownloads * 100),
      monthlyChangePercent: lastMonthDownloads === 0 ? 100 : Math.round((thisMonthDownloads - lastMonthDownloads) / lastMonthDownloads * 100)
    };
    
  } catch (error) {
    console.error('Error getting downloads trends:', error);
    return null;
  }
}

// ===== GET SUMMARY =====
export async function getPlaysDownloadsSummary(env) {
  try {
    const [total, today, week, month] = await Promise.all([
      // Total stats
      env.DB.prepare(`
        SELECT 
          (SELECT SUM(total_plays) FROM total_plays) as total_plays,
          (SELECT SUM(total_downloads) FROM total_downloads) as total_downloads
      `).first(),
      
      // Today's stats
      env.DB.prepare(`
        SELECT 
          (SELECT SUM(plays) FROM daily_plays WHERE play_date = ?) as today_plays,
          (SELECT SUM(downloads) FROM daily_downloads WHERE download_date = ?) as today_downloads
      `).bind(getDateParts().date, getDateParts().date).first(),
      
      // This week's stats
      env.DB.prepare(`
        SELECT 
          (SELECT SUM(plays) FROM weekly_plays WHERE year_week = ?) as week_plays,
          (SELECT SUM(downloads) FROM weekly_downloads WHERE year_week = ?) as week_downloads
      `).bind(getDateParts().yearWeek, getDateParts().yearWeek).first(),
      
      // This month's stats
      env.DB.prepare(`
        SELECT 
          (SELECT SUM(plays) FROM monthly_plays WHERE year_month = ?) as month_plays,
          (SELECT SUM(downloads) FROM monthly_downloads WHERE year_month = ?) as month_downloads
      `).bind(getDateParts().yearMonth, getDateParts().yearMonth).first()
    ]);
    
    return {
      total: {
        plays: total?.total_plays || 0,
        downloads: total?.total_downloads || 0
      },
      today: {
        plays: today?.today_plays || 0,
        downloads: today?.today_downloads || 0
      },
      week: {
        plays: week?.week_plays || 0,
        downloads: week?.week_downloads || 0
      },
      month: {
        plays: month?.month_plays || 0,
        downloads: month?.month_downloads || 0
      }
    };
    
  } catch (error) {
    console.error('Error getting summary:', error);
    return null;
  }
}