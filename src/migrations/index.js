// ==================== MASTER MIGRATION RUNNER ====================

import { up as migration001 } from './001_create_page_views_tables.js';

const migrations = [
  { name: '001_create_page_views_tables', up: migration001 }
];

// Helper to ensure migrations table exists (run this FIRST in every function)
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
  // ✅ Ensure table exists first
  await ensureMigrationsTable(env);
  
  const executed = await env.DB.prepare(
    `SELECT name FROM migrations WHERE status = 'success'`
  ).all();
  
  const executedNames = new Set(executed.results.map(r => r.name));
  const results = [];

  for (const migration of migrations) {
    if (!executedNames.has(migration.name)) {
      try {
        const result = await migration.up(env);
        results.push({ name: migration.name, status: 'success', details: result });
        
        // Record success
        await env.DB.prepare(
          `INSERT INTO migrations (name, status, details) VALUES (?, ?, ?)`
        ).bind(migration.name, 'success', JSON.stringify(result)).run();
        
      } catch (error) {
        results.push({ name: migration.name, status: 'failed', error: error.message });
        
        // Record failure
        await env.DB.prepare(
          `INSERT INTO migrations (name, status, details) VALUES (?, ?, ?)`
        ).bind(migration.name, 'failed', JSON.stringify({ error: error.message })).run();
        
        break;
      }
    }
  }

  return results;
}

export async function getMigrationStatus(env) {
  // ✅ Ensure table exists first
  await ensureMigrationsTable(env);
  
  const migrations = await env.DB.prepare(
    `SELECT * FROM migrations ORDER BY executed_at DESC`
  ).all();
  
  return migrations.results;
}

export async function getPendingMigrations(env) {
  // ✅ Ensure table exists first
  await ensureMigrationsTable(env);
  
  const executed = await env.DB.prepare(
    `SELECT name FROM migrations WHERE status = 'success'`
  ).all();
  
  const executedNames = new Set(executed.results.map(r => r.name));
  
  return migrations.filter(m => !executedNames.has(m.name));
}