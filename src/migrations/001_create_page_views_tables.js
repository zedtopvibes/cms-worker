// ==================== MIGRATION 001:  Page Views Enhanced Tables ====================

export async function up(env) {
  console.log('Running migration 001: Creating page views enhanced tables...');
  
  const results = {
    name: '001_create_page_views_tables',
    success: [],
    failed: []
  };

  const queries = [
    // Daily page views table
    `CREATE TABLE IF NOT EXISTS daily_page_views (
      page_type TEXT,
      page_id TEXT,
      view_date DATE,
      views INTEGER DEFAULT 0,
      PRIMARY KEY (page_type, page_id, view_date)
    )`,
    
    // Weekly page views table
    `CREATE TABLE IF NOT EXISTS weekly_page_views (
      page_type TEXT,
      page_id TEXT,
      year_week TEXT,
      views INTEGER DEFAULT 0,
      PRIMARY KEY (page_type, page_id, year_week)
    )`,
    
    // Monthly page views table
    `CREATE TABLE IF NOT EXISTS monthly_page_views (
      page_type TEXT,
      page_id TEXT,
      year_month TEXT,
      views INTEGER DEFAULT 0,
      PRIMARY KEY (page_type, page_id, year_month)
    )`,
    
    // Total page views table
    `CREATE TABLE IF NOT EXISTS total_page_views (
      page_type TEXT,
      page_id TEXT,
      total_views INTEGER DEFAULT 0,
      last_updated TIMESTAMP,
      PRIMARY KEY (page_type, page_id)
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_daily_views_date ON daily_page_views(view_date)`,
    `CREATE INDEX IF NOT EXISTS idx_daily_views_type ON daily_page_views(page_type)`,
    `CREATE INDEX IF NOT EXISTS idx_weekly_views_week ON weekly_page_views(year_week)`,
    `CREATE INDEX IF NOT EXISTS idx_weekly_views_type ON weekly_page_views(page_type)`,
    `CREATE INDEX IF NOT EXISTS idx_monthly_views_month ON monthly_page_views(year_month)`,
    `CREATE INDEX IF NOT EXISTS idx_monthly_views_type ON monthly_page_views(page_type)`,
    `CREATE INDEX IF NOT EXISTS idx_total_views_type ON total_page_views(page_type)`,
    `CREATE INDEX IF NOT EXISTS idx_total_views_views ON total_page_views(total_views DESC)`
  ];

  // Execute each query
  for (let i = 0; i < queries.length; i++) {
    try {
      await env.DB.prepare(queries[i]).run();
      results.success.push({ 
        index: i, 
        query: queries[i].substring(0, 50) + '...' 
      });
      console.log(`✅ Query ${i + 1}/${queries.length} succeeded`);
    } catch (error) {
      results.failed.push({ 
        index: i, 
        query: queries[i].substring(0, 50) + '...', 
        error: error.message 
      });
      console.error(`❌ Query ${i + 1}/${queries.length} failed:`, error.message);
    }
  }

  // Create migrations tracking table
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT,
      details TEXT
    )
  `).run();

  // Record migration
  await env.DB.prepare(
    `INSERT INTO migrations (name, status, details) VALUES (?, ?, ?)`
  ).bind(
    results.name,
    results.failed.length === 0 ? 'success' : 'partial',
    JSON.stringify(results)
  ).run();

  console.log(`\n=== Migration 001 Complete ===`);
  console.log(`✅ Successful queries: ${results.success.length}`);
  console.log(`❌ Failed queries: ${results.failed.length}`);
  
  return results;
}

export async function down(env) {
  // Rollback - drop all created tables
  console.log('Rolling back migration 001...');
  
  const queries = [
    `DROP TABLE IF EXISTS daily_page_views`,
    `DROP TABLE IF EXISTS weekly_page_views`,
    `DROP TABLE IF EXISTS monthly_page_views`,
    `DROP TABLE IF EXISTS total_page_views`
  ];
  
  for (const query of queries) {
    await env.DB.prepare(query).run();
  }
  
  await env.DB.prepare(
    `DELETE FROM migrations WHERE name = '001_create_page_views_tables'`
  ).run();
  
  console.log('✅ Rollback complete');
}