// ==================== MIGRATION 003: Trash/Recycle Bin ====================

export async function up(env) {
  console.log('Running migration 003: Creating trash tables...');
  
  const queries = [
    // Track deleted items
    `CREATE TABLE IF NOT EXISTS trash_items (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL,      -- 'song', 'album', 'artist', 'playlist'
      item_id TEXT NOT NULL,         -- Original ID/filename
      item_name TEXT,                -- Display name
      original_path TEXT,            -- Original R2 path
      trash_path TEXT,               -- Current trash path
      metadata TEXT,                 -- JSON of metadata (for display)
      deleted_by TEXT,
      deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      size_bytes INTEGER DEFAULT 0,
      restored_at TIMESTAMP,
      restored_by TEXT
    )`,
    
    // Settings table
    `CREATE TABLE IF NOT EXISTS trash_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      retention_days INTEGER DEFAULT 30,
      auto_cleanup INTEGER DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_trash_expires ON trash_items(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_trash_type ON trash_items(item_type)`
  ];

  for (const query of queries) {
    await env.DB.prepare(query).run();
  }

  // Insert default settings
  await env.DB.prepare(
    `INSERT INTO trash_settings (id, retention_days, auto_cleanup, updated_by)
     VALUES (1, 30, 1, 'system')
     ON CONFLICT(id) DO NOTHING`
  ).run();

  console.log('✅ Migration 003 complete');
}

export async function down(env) {
  await env.DB.prepare(`DROP TABLE IF EXISTS trash_items`).run();
  await env.DB.prepare(`DROP TABLE IF EXISTS trash_settings`).run();
}