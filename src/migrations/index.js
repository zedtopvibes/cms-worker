// ==================== MASTER MIGRATION RUNNER ====================

import { up as migration001 } from './001_create_page_views_tables.js';

// Add future migrations here
const migrations = [
  { name: '001_create_page_views_tables', up: migration001 }
];

export async function runMigrations(env) {
  console.log('🔄 Running migrations...');
  
  // Ensure migrations table exists
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT,
      details TEXT
    )
  `).run();

  // Get executed migrations
  const executed = await env.DB.prepare(
    `SELECT name FROM migrations WHERE status = 'success'`
  ).all();
  
  const executedNames = new Set(executed.results.map(r => r.name));
  
  const results = [];

  // Run pending migrations in order
  for (const migration of migrations) {
    if (!executedNames.has(migration.name)) {
      console.log(`📦 Running migration: ${migration.name}`);
      
      try {
        const result = await migration.up(env);
        results.push({
          name: migration.name,
          status: 'success',
          details: result
        });
        console.log(`✅ Migration ${migration.name} completed`);
      } catch (error) {
        console.error(`❌ Migration ${migration.name} failed:`, error);
        results.push({
          name: migration.name,
          status: 'failed',
          error: error.message
        });
        break;
      }
    } else {
      console.log(`⏭️  Skipping ${migration.name} (already executed)`);
    }
  }

  return results;
}

export async function getMigrationStatus(env) {
  const migrations = await env.DB.prepare(
    `SELECT * FROM migrations ORDER BY executed_at DESC`
  ).all();
  
  return migrations.results;
}

export async function getPendingMigrations(env) {
  const executed = await env.DB.prepare(
    `SELECT name FROM migrations WHERE status = 'success'`
  ).all();
  
  const executedNames = new Set(executed.results.map(r => r.name));
  
  return migrations.filter(m => !executedNames.has(m.name));
}