// ==================== MIGRATION 003: Trash/Recycle Bin Tables ====================

export async function up(env) {
  console.log('Running migration 003: Creating trash tables...');
  
  const results = {
    name: '003_create_trash_tables',
    success: [],
    failed: []
  };

  const queries = [
    // Main trash items table
    `CREATE TABLE IF NOT EXISTS trash_items (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT,
      original_path TEXT,
      trash_path TEXT,
      metadata TEXT,
      deleted_by TEXT,
      deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      restored_at TIMESTAMP,
      restored_by TEXT,
      size_bytes INTEGER DEFAULT 0
    )`,
    
    // Trash settings table
    `CREATE TABLE IF NOT EXISTS trash_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      retention_days INTEGER DEFAULT 30,
      auto_cleanup INTEGER DEFAULT 1,
      max_trash_size_mb INTEGER DEFAULT 1024,
      notify_before_delete INTEGER DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_trash_expires ON trash_items(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_trash_type ON trash_items(item_type)`,
    `CREATE INDEX IF NOT EXISTS idx_trash_deleted ON trash_items(deleted_at)`
  ];

  // Execute each query
  for (let i = 0; i < queries.length; i++) {
    try {
      await env.DB.prepare(queries[i]).run();
      results.success.push({ index: i, query: queries[i].substring(0, 50) + '...' });
      console.log(`✅ Query ${i + 1}/${queries.length} succeeded`);
    } catch (error) {
      // If error is "duplicate column" or "table already exists", it's ok
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        results.success.push({ index: i, query: queries[i].substring(0, 50) + '... (already existed)' });
        console.log(`⚠️ Query ${i + 1}/${queries.length} already existed, skipping`);
      } else {
        results.failed.push({ index: i, query: queries[i].substring(0, 50) + '...', error: error.message });
        console.error(`❌ Query ${i + 1}/${queries.length} failed:`, error.message);
      }
    }
  }

  // Insert default settings if not exists
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO trash_settings (id, retention_days, auto_cleanup, max_trash_size_mb, notify_before_delete, updated_by)
       VALUES (1, 30, 1, 1024, 1, 'system')`
    ).run();
    results.success.push({ index: queries.length, query: 'Insert default settings' });
  } catch (error) {
    results.failed.push({ index: queries.length, query: 'Insert default settings', error: error.message });
  }

  // Now try to insert the migration record with INSERT OR IGNORE
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO migrations (name, status, details, executed_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      results.name,
      results.failed.length === 0 ? 'success' : 'partial',
      JSON.stringify(results)
    ).run();
    
    // If it was ignored, update it
    await env.DB.prepare(
      `UPDATE migrations SET status = ?, details = ?, executed_at = CURRENT_TIMESTAMP WHERE name = ?`
    ).bind(
      results.failed.length === 0 ? 'success' : 'partial',
      JSON.stringify(results),
      results.name
    ).run();
    
  } catch (error) {
    console.error('Error recording migration:', error);
  }

  console.log(`\n=== Migration 003 Complete ===`);
  console.log(`✅ Successful queries: ${results.success.length}`);
  console.log(`❌ Failed queries: ${results.failed.length}`);
  
  return results;
}

export async function down(env) {
  console.log('Rolling back migration 003...');
  
  const queries = [
    `DROP TABLE IF EXISTS trash_items`,
    `DROP TABLE IF EXISTS trash_settings`
  ];
  
  for (const query of queries) {
    await env.DB.prepare(query).run();
  }
  
  // Remove migration record
  await env.DB.prepare(
    `DELETE FROM migrations WHERE name = '003_create_trash_tables'`
  ).run();
  
  console.log('✅ Rollback complete');
}