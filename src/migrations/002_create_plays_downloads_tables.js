// ==================== MIGRATION 002: Plays and Downloads Tables ====================

export async function up(env) {
  console.log('Running migration 002: Creating plays and downloads tables...');
  
  const results = {
    name: '002_create_plays_downloads_tables',
    success: [],
    failed: []
  };

  const queries = [
    // ===== PLAYS TABLES =====
    `CREATE TABLE IF NOT EXISTS daily_plays (
      item_type TEXT,      -- 'song', 'album', 'artist', 'playlist'
      item_id TEXT,
      play_date DATE,
      plays INTEGER DEFAULT 0,
      PRIMARY KEY (item_type, item_id, play_date)
    )`,
    
    `CREATE TABLE IF NOT EXISTS weekly_plays (
      item_type TEXT,
      item_id TEXT,
      year_week TEXT,      -- Format: '2024-15'
      plays INTEGER DEFAULT 0,
      PRIMARY KEY (item_type, item_id, year_week)
    )`,
    
    `CREATE TABLE IF NOT EXISTS monthly_plays (
      item_type TEXT,
      item_id TEXT,
      year_month TEXT,     -- Format: '2024-04'
      plays INTEGER DEFAULT 0,
      PRIMARY KEY (item_type, item_id, year_month)
    )`,
    
    `CREATE TABLE IF NOT EXISTS total_plays (
      item_type TEXT,
      item_id TEXT,
      total_plays INTEGER DEFAULT 0,
      last_updated TIMESTAMP,
      PRIMARY KEY (item_type, item_id)
    )`,
    
    // ===== DOWNLOADS TABLES =====
    `CREATE TABLE IF NOT EXISTS daily_downloads (
      item_type TEXT,      -- 'song', 'album', 'artist', 'playlist'
      item_id TEXT,
      download_date DATE,
      downloads INTEGER DEFAULT 0,
      PRIMARY KEY (item_type, item_id, download_date)
    )`,
    
    `CREATE TABLE IF NOT EXISTS weekly_downloads (
      item_type TEXT,
      item_id TEXT,
      year_week TEXT,      -- Format: '2024-15'
      downloads INTEGER DEFAULT 0,
      PRIMARY KEY (item_type, item_id, year_week)
    )`,
    
    `CREATE TABLE IF NOT EXISTS monthly_downloads (
      item_type TEXT,
      item_id TEXT,
      year_month TEXT,     -- Format: '2024-04'
      downloads INTEGER DEFAULT 0,
      PRIMARY KEY (item_type, item_id, year_month)
    )`,
    
    `CREATE TABLE IF NOT EXISTS total_downloads (
      item_type TEXT,
      item_id TEXT,
      total_downloads INTEGER DEFAULT 0,
      last_updated TIMESTAMP,
      PRIMARY KEY (item_type, item_id)
    )`,
    
    // ===== INDEXES FOR PLAYS =====
    `CREATE INDEX IF NOT EXISTS idx_daily_plays_date ON daily_plays(play_date)`,
    `CREATE INDEX IF NOT EXISTS idx_daily_plays_type ON daily_plays(item_type)`,
    `CREATE INDEX IF NOT EXISTS idx_weekly_plays_week ON weekly_plays(year_week)`,
    `CREATE INDEX IF NOT EXISTS idx_weekly_plays_type ON weekly_plays(item_type)`,
    `CREATE INDEX IF NOT EXISTS idx_monthly_plays_month ON monthly_plays(year_month)`,
    `CREATE INDEX IF NOT EXISTS idx_monthly_plays_type ON monthly_plays(item_type)`,
    `CREATE INDEX IF NOT EXISTS idx_total_plays_value ON total_plays(total_plays DESC)`,
    
    // ===== INDEXES FOR DOWNLOADS =====
    `CREATE INDEX IF NOT EXISTS idx_daily_downloads_date ON daily_downloads(download_date)`,
    `CREATE INDEX IF NOT EXISTS idx_daily_downloads_type ON daily_downloads(item_type)`,
    `CREATE INDEX IF NOT EXISTS idx_weekly_downloads_week ON weekly_downloads(year_week)`,
    `CREATE INDEX IF NOT EXISTS idx_weekly_downloads_type ON weekly_downloads(item_type)`,
    `CREATE INDEX IF NOT EXISTS idx_monthly_downloads_month ON monthly_downloads(year_month)`,
    `CREATE INDEX IF NOT EXISTS idx_monthly_downloads_type ON monthly_downloads(item_type)`,
    `CREATE INDEX IF NOT EXISTS idx_total_downloads_value ON total_downloads(total_downloads DESC)`
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

  console.log(`\n=== Migration 002 Complete ===`);
  console.log(`✅ Successful queries: ${results.success.length}`);
  console.log(`❌ Failed queries: ${results.failed.length}`);
  
  return results;
}

export async function down(env) {
  console.log('Rolling back migration 002...');
  
  const queries = [
    `DROP TABLE IF EXISTS daily_plays`,
    `DROP TABLE IF EXISTS weekly_plays`,
    `DROP TABLE IF EXISTS monthly_plays`,
    `DROP TABLE IF EXISTS total_plays`,
    `DROP TABLE IF EXISTS daily_downloads`,
    `DROP TABLE IF EXISTS weekly_downloads`,
    `DROP TABLE IF EXISTS monthly_downloads`,
    `DROP TABLE IF EXISTS total_downloads`
  ];
  
  for (const query of queries) {
    await env.DB.prepare(query).run();
  }
  
  console.log('✅ Rollback complete');
}