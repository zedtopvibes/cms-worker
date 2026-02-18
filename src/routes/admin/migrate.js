// ==================== ADMIN MIGRATION ROUTE ====================

import { runMigrations, getMigrationStatus, getPendingMigrations } from '../../migrations/index.js';
import { backfillPageViews } from '../../helpers/pageViewsEnhanced.js';

export async function handleAdminMigrations(req, env, ctx, auth) {
  const url = new URL(req.url);
  const path = url.pathname;
  const action = url.searchParams.get('action') || 'status';

  try {
    // Handle POST requests
    if (req.method === 'POST') {
      if (action === 'run') {
        const results = await runMigrations(env);
        const pageViewsMigration = results.find(r => r.name === '001_create_page_views_tables');
        
        const content = `
          <div style="max-width: 800px; margin: 0 auto;">
            <h2 style="margin-bottom: 20px;"><i class="fas fa-database"></i> Migration Results</h2>
            
            ${results.map(r => `
              <div style="background: ${r.status === 'success' ? '#d4edda' : '#f8d7da'}; 
                          color: ${r.status === 'success' ? '#155724' : '#721c24'};
                          padding: 15px; border-radius: 8px; margin-bottom: 10px;
                          border-left: 4px solid ${r.status === 'success' ? '#28a745' : '#dc3545'};">
                <strong>${r.name}</strong><br>
                <span style="text-transform: uppercase;">${r.status}</span>
                ${r.error ? `<br><small>${r.error}</small>` : ''}
              </div>
            `).join('')}
            
            ${pageViewsMigration?.status === 'success' ? `
              <div style="background: #e7f5ff; color: #004085; padding: 20px; border-radius: 8px; margin-top: 30px;">
                <h3><i class="fas fa-sync"></i> Page Views Backfill</h3>
                <p>New tables created! Backfill existing data?</p>
                <form method="POST" action="/admin/migrate?action=backfill">
                  <button type="submit" class="btn btn-primary">Start Backfill</button>
                </form>
              </div>
            ` : ''}
            
            <div style="margin-top: 30px;">
              <a href="/admin/migrate" class="btn btn-secondary">Refresh</a>
              <a href="/admin/dashboard" class="btn btn-secondary">Dashboard</a>
            </div>
          </div>
        `;
        
        return new Response(adminLayout('Migration Results', content, auth, 'migrate', 0), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
      if (action === 'backfill') {
        const content = `<div>Backfill in progress...</div>`;
        const pending = await getPendingMigrations(env);
        return new Response(adminLayout('Backfill', content, auth, 'migrate', pending.length), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }

    // Handle backfill progress
    if (req.method === 'POST' && path.endsWith('/backfill-progress')) {
      const result = await backfillPageViews(env);
      return new Response(JSON.stringify({ complete: true, ...result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET - Show migration status page
    const migrations = await getMigrationStatus(env);
    const pending = await getPendingMigrations(env);

    const content = `
      <div style="max-width: 900px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
          <h2><i class="fas fa-database" style="color: #ff5500;"></i> Database Migrations</h2>
          
          ${pending.length > 0 ? `
            <form method="POST" action="/admin/migrate?action=run">
              <button type="submit" class="btn btn-primary">
                Run Migrations (${pending.length})
              </button>
            </form>
          ` : ''}
        </div>
        
        ${pending.length > 0 ? `
          <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong>${pending.length} pending migration(s)</strong>
            <ul>${pending.map(p => `<li><code>${p.name}</code></li>`).join('')}</ul>
          </div>
        ` : ''}
        
        <h3>Migration History</h3>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr><th>Migration</th><th>Status</th><th>Executed At</th></tr>
          </thead>
          <tbody>
            ${migrations.length === 0 ? `
              <tr><td colspan="3" style="text-align:center; padding:40px;">No migrations yet</td></tr>
            ` : migrations.map(m => `
              <tr>
                <td><code>${m.name}</code></td>
                <td><span style="background:${m.status==='success'?'#28a745':'#ffc107'}; color:white; padding:4px 8px; border-radius:20px;">${m.status}</span></td>
                <td>${new Date(m.executed_at).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    return new Response(adminLayout('Migrations', content, auth, 'migrate', pending.length), {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    // If anything fails, show a friendly error page
    const content = `
      <div style="max-width: 600px; margin: 50px auto; text-align: center;">
        <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #dc3545; margin-bottom: 20px;"></i>
        <h2>Migration System Error</h2>
        <p style="color: #666; margin: 20px 0;">${error.message}</p>
        <p>This is normal on first run. Click the button below to initialize the migration system.</p>
        <form method="POST" action="/admin/migrate?action=run">
          <button type="submit" class="btn btn-primary" style="padding: 15px 30px; margin-top: 20px;">
            <i class="fas fa-play"></i> Initialize Migration System
          </button>
        </form>
      </div>
    `;
    
    return new Response(adminLayout('Migration Error', content, auth, 'migrate', 0), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}