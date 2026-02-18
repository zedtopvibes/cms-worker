// ==================== MASTER MIGRATION RUNNER ====================

import { up as migration001 } from './001_create_page_views_tables.js';
import { up as migration002 } from './002_create_plays_downloads_tables.js';
import { up as migration003 } from './003_create_trash_tables.js';

// Add future migrations here
const migrations = [
  { name: '001_create_page_views_tables', up: migration001 },
  { name: '002_create_plays_downloads_tables', up: migration002 },
  { name: '003_create_trash_tables', up: migration003 }
];

// Helper to ensure migrations table exists
async function ensureMigrationsTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT,
      details TEXT
    )
  `).run();
}

export async function runMigrations(env) {
  console.log('🔄 Running migrations...');
  
  // Ensure migrations table exists
  await ensureMigrationsTable(env);

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
        
        // Record success
        await env.DB.prepare(
          `INSERT INTO migrations (name, status, details) VALUES (?, ?, ?)`
        ).bind(migration.name, 'success', JSON.stringify(result)).run();
        
        console.log(`✅ Migration ${migration.name} completed`);
      } catch (error) {
        console.error(`❌ Migration ${migration.name} failed:`, error);
        results.push({
          name: migration.name,
          status: 'failed',
          error: error.message
        });
        
        // Record the failed migration
        await env.DB.prepare(
          `INSERT INTO migrations (name, status, details) VALUES (?, ?, ?)`
        ).bind(
          migration.name,
          'failed',
          JSON.stringify({ error: error.message })
        ).run();
        
        // Stop on first failure
        break;
      }
    } else {
      console.log(`⏭️  Skipping ${migration.name} (already executed)`);
    }
  }

  return results;
}

export async function getMigrationStatus(env) {
  await ensureMigrationsTable(env);
  
  const migrations = await env.DB.prepare(
    `SELECT * FROM migrations ORDER BY executed_at DESC`
  ).all();
  
  return migrations.results;
}

export async function getPendingMigrations(env) {
  await ensureMigrationsTable(env);
  
  const executed = await env.DB.prepare(
    `SELECT name FROM migrations WHERE status = 'success'`
  ).all();
  
  const executedNames = new Set(executed.results.map(r => r.name));
  
  return migrations.filter(m => !executedNames.has(m.name));
}