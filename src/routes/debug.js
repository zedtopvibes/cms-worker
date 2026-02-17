// ==================== DEBUG ROUTES ====================
// Add these routes to help test and debug your stats

import express from 'express';
const router = express.Router();

/**
 * GET /debug/stats - View current stats
 */
router.get('/debug/stats', async (req, res) => {
  try {
    const { env } = req;
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Check page_views table
    const allViews = await env.DB.prepare(
      `SELECT * FROM page_views ORDER BY last_viewed DESC LIMIT 10`
    ).all();
    
    // Check song_stats table
    const allStats = await env.DB.prepare(
      `SELECT * FROM song_stats ORDER BY last_played DESC LIMIT 10`
    ).all();
    
    // Check daily_stats table
    const dailyStats = await env.DB.prepare(
      `SELECT * FROM daily_stats ORDER BY date DESC LIMIT 7`
    ).all();
    
    // Get today's counts
    const todayViews = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM page_views WHERE date(last_viewed_date) = date(?)`
    ).bind(today).all();
    
    const todayPlays = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM song_stats WHERE date(last_played_date) = date(?)`
    ).bind(today).all();
    
    const todayDownloads = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM song_stats WHERE date(last_downloaded_date) = date(?)`
    ).bind(today).all();
    
    // Get table counts
    const pageViewsCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM page_views`).all();
    const songStatsCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM song_stats`).all();
    const dailyStatsCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM daily_stats`).all();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      today: {
        date: today,
        views: todayViews.results[0]?.count || 0,
        plays: todayPlays.results[0]?.count || 0,
        downloads: todayDownloads.results[0]?.count || 0
      },
      totals: {
        page_views: pageViewsCount.results[0]?.count || 0,
        song_stats: songStatsCount.results[0]?.count || 0,
        daily_stats: dailyStatsCount.results[0]?.count || 0
      },
      recentViews: allViews.results || [],
      recentStats: allStats.results || [],
      dailyStats: dailyStats.results || []
    });
  } catch (error) {
    console.error('Debug stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /debug/test-view/:type/:id - Test recording a view
 */
router.get('/debug/test-view/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { env } = req;
    
    // Import and call incrementPageView
    const { incrementPageView } = await import('../helpers/pageViews.js');
    const result = await incrementPageView(env, type, id);
    
    // Get the updated record
    const record = await env.DB.prepare(
      `SELECT * FROM page_views WHERE page_type = ? AND page_id = ?`
    ).bind(type, id).first();
    
    res.json({
      success: result,
      message: result ? `✅ Recorded view for ${type}: ${id}` : '❌ Failed to record view',
      record: record || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /debug/test-play/:songKey - Test recording a play
 */
router.get('/debug/test-play/:songKey', async (req, res) => {
  try {
    const { songKey } = req.params;
    const { env } = req;
    
    const { incrementPlay } = await import('../helpers/db.js');
    const result = await incrementPlay(songKey, env);
    
    const record = await env.DB.prepare(
      `SELECT * FROM song_stats WHERE song_key = ?`
    ).bind(songKey).first();
    
    res.json({
      success: result,
      message: result ? `✅ Recorded play for song: ${songKey}` : '❌ Failed to record play',
      record: record || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /debug/test-download/:songKey - Test recording a download
 */
router.get('/debug/test-download/:songKey', async (req, res) => {
  try {
    const { songKey } = req.params;
    const { env } = req;
    
    const { incrementDownload } = await import('../helpers/db.js');
    const result = await incrementDownload(songKey, env);
    
    const record = await env.DB.prepare(
      `SELECT * FROM song_stats WHERE song_key = ?`
    ).bind(songKey).first();
    
    res.json({
      success: result,
      message: result ? `✅ Recorded download for song: ${songKey}` : '❌ Failed to record download',
      record: record || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /debug/run-test - Run the full test suite
 */
router.get('/debug/run-test', async (req, res) => {
  try {
    const { testStats } = await import('../test-stats.js');
    const results = await testStats(req.env);
    res.json(results);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /debug/update-daily-stats - Manually trigger daily stats update
 */
router.get('/debug/update-daily-stats', async (req, res) => {
  try {
    const { updateDailyStats } = await import('../helpers/dashboardStats.js');
    const result = await updateDailyStats(req.env);
    
    res.json({
      success: true,
      message: 'Daily stats updated',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /debug/clear-test-data - Clear test data (BE CAREFUL!)
 */
router.get('/debug/clear-test-data', async (req, res) => {
  try {
    const { env } = req;
    
    // Only delete test data
    await env.DB.prepare(`DELETE FROM page_views WHERE page_type = 'test'`).run();
    await env.DB.prepare(`DELETE FROM song_stats WHERE song_key LIKE 'test_%'`).run();
    
    res.json({
      success: true,
      message: 'Test data cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;