// ==================== ADMIN MIGRATION ROUTE ====================

import { runMigrations, getMigrationStatus, getPendingMigrations } from '../../migrations/index.js';
import { backfillPageViews } from '../../helpers/pageViewsEnhanced.js';

export async function handleAdminMigrations(req, env, ctx, auth) {
  const url = new URL(req.url);
  const path = url.pathname; // You need this for the backfill-progress endpoint
  const action = url.searchParams.get('action') || 'status';

  // Handle POST requests (run migrations, backfill)
  if (req.method === 'POST') {
    if (action === 'run') {
      // Run all pending migrations
      const results = await runMigrations(env);
      
      // Check if page views migration was successful
      const pageViewsMigration = results.find(r => r.name === '002_create_page_views_tables');
      
      const content = `
        <div style="max-width: 800px; margin: 0 auto;">
          <h2 style="margin-bottom: 20px;"><i class="fas fa-database"></i> Migration Results</h2>
          
          ${results.map(r => `
            <div style="background: ${r.status === 'success' ? '#d4edda' : '#f8d7da'}; 
                        color: ${r.status === 'success' ? '#155724' : '#721c24'};
                        padding: 15px; border-radius: 8px; margin-bottom: 10px;
                        border-left: 4px solid ${r.status === 'success' ? '#28a745' : '#dc3545'};">
              <strong style="font-size: 1.1rem;">${r.name}</strong><br>
              <span style="text-transform: uppercase; font-size: 0.8rem;">${r.status}</span>
              ${r.error ? `<br><small>${r.error}</small>` : ''}
              ${r.details ? `<br><small>✅ ${r.details.success?.length || 0} queries succeeded</small>` : ''}
            </div>
          `).join('')}
          
          ${pageViewsMigration?.status === 'success' ? `
            <div style="background: #e7f5ff; color: #004085; padding: 20px; border-radius: 8px; margin-top: 30px; border-left: 4px solid #004085;">
              <h3 style="margin-bottom: 10px;"><i class="fas fa-sync"></i> Page Views Backfill</h3>
              <p>New tables created successfully! Would you like to backfill existing data from your old page_views table?</p>
              <p style="font-size: 0.9rem; color: #666;">This will copy all historical views to the new daily/weekly/monthly tables.</p>
              <form method="POST" action="/admin/migrate?action=backfill">
                <button type="submit" class="btn btn-primary" style="background: #004085;">
                  <i class="fas fa-sync"></i> Start Backfill
                </button>
              </form>
            </div>
          ` : ''}
          
          <div style="display: flex; gap: 10px; margin-top: 30px;">
            <a href="/admin/migrate" class="btn btn-secondary">
              <i class="fas fa-redo"></i> Refresh Status
            </a>
            <a href="/admin/dashboard" class="btn btn-secondary">
              <i class="fas fa-tachometer-alt"></i> Dashboard
            </a>
            <a href="/admin/stats" class="btn btn-secondary">
              <i class="fas fa-chart-bar"></i> View Stats
            </a>
          </div>
        </div>
      `;
      
      // After running migrations, pending should be 0
      return new Response(adminLayout('Migration Results', content, auth, 'migrate', 0), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    if (action === 'backfill') {
      // Show backfill in progress
      const content = `
        <div style="max-width: 600px; margin: 0 auto; text-align: center;">
          <h2><i class="fas fa-sync fa-spin"></i> Backfill in Progress</h2>
          <p>Please wait while we process your existing data...</p>
          <div style="background: #f0f0f0; height: 20px; border-radius: 10px; margin: 20px 0; overflow: hidden;">
            <div id="progressBar" style="width: 0%; height: 100%; background: #ff5500; transition: width 0.3s;"></div>
          </div>
          <div id="status">Starting backfill...</div>
        </div>
        
        <script>
          (async function() {
            try {
              const response = await fetch('/admin/migrate/backfill-progress', { method: 'POST' });
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const data = JSON.parse(decoder.decode(value));
                document.getElementById('progressBar').style.width = data.percentage + '%';
                document.getElementById('status').innerHTML = 
                  \`Processed \${data.processed} of \${data.total} records...\`;
                
                if (data.complete) {
                  setTimeout(() => {
                    window.location.href = '/admin/migrate?backfill=complete';
                  }, 1000);
                }
              }
            } catch (error) {
              document.getElementById('status').innerHTML = 'Error: ' + error.message;
            }
          })();
        </script>
      `;
      
      // During backfill, pending count remains the same
      const pending = await getPendingMigrations(env);
      return new Response(adminLayout('Backfill Progress', content, auth, 'migrate', pending.length), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // Handle backfill progress endpoint
  if (req.method === 'POST' && path.endsWith('/backfill-progress')) {
    const result = await backfillPageViews(env);
    
    return new Response(JSON.stringify({
      complete: true,
      processed: result.success,
      total: result.success + result.failed,
      percentage: 100
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET - Show migration status page
  const migrations = await getMigrationStatus(env);
  const pending = await getPendingMigrations(env);

  const content = `
    <div style="max-width: 900px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
        <h2 style="margin:0;"><i class="fas fa-database" style="color: #ff5500;"></i> Database Migrations</h2>
        
        ${pending.length > 0 ? `
          <form method="POST" action="/admin/migrate?action=run" 
                onsubmit="return confirm('Run pending migrations? This may take a few minutes.')">
            <button type="submit" class="btn btn-primary">
              <i class="fas fa-play"></i> Run Pending Migrations (${pending.length})
            </button>
          </form>
        ` : ''}
      </div>
      
      ${pending.length > 0 ? `
        <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
          <i class="fas fa-info-circle"></i>
          <strong>${pending.length} pending migration(s) available.</strong> 
          Run them to enable new features.
          <ul style="margin-top: 10px; margin-bottom: 0;">
            ${pending.map(p => `<li><code>${p.name}</code></li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${url.searchParams.get('backfill') === 'complete' ? `
        <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #28a745;">
          <i class="fas fa-check-circle"></i>
          <strong>Backfill completed successfully!</strong> Your historical data has been migrated.
        </div>
      ` : ''}
      
      <h3 style="margin-bottom: 15px;">Migration History</h3>
      
      <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: #f8f9fa;">
            <tr>
              <th style="padding: 12px; text-align: left;">Migration</th>
              <th style="padding: 12px; text-align: left;">Status</th>
              <th style="padding: 12px; text-align: left;">Executed At</th>
              <th style="padding: 12px; text-align: left;">Details</th>
            </tr>
          </thead>
          <tbody>
            ${migrations.length === 0 ? `
              <tr>
                <td colspan="4" style="padding: 60px 20px; text-align: center; color: #666;">
                  <i class="fas fa-database" style="font-size: 3rem; color: #ddd; margin-bottom: 15px;"></i><br>
                  No migrations have been run yet.
                </td>
              </tr>
            ` : migrations.map(m => {
              const details = m.details ? JSON.parse(m.details) : null;
              return `
                <tr style="border-bottom: 1px solid #e8e8e8;">
                  <td style="padding: 12px;">
                    <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${m.name}</code>
                  </td>
                  <td style="padding: 12px;">
                    <span style="background: ${m.status === 'success' ? '#28a745' : m.status === 'partial' ? '#ffc107' : '#dc3545'}; 
                                 color: ${m.status === 'success' ? 'white' : m.status === 'partial' ? 'black' : 'white'};
                                 padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                      ${m.status}
                    </span>
                  </td>
                  <td style="padding: 12px;">
                    ${new Date(m.executed_at).toLocaleString()}
                  </td>
                  <td style="padding: 12px;">
                    ${details ? `
                      <span style="font-size: 0.8rem;">
                        ✅ ${details.success?.length || 0} successful queries<br>
                        ${details.failed?.length ? `❌ ${details.failed.length} failed` : ''}
                      </span>
                    ` : '-'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 30px; background: #f8f9fa; padding: 20px; border-radius: 12px;">
        <h4 style="margin-bottom: 10px;"><i class="fas fa-info-circle"></i> Available Migrations:</h4>
        <ul style="margin: 0; padding-left: 20px;">
          <li><strong>002_create_page_views_tables</strong> - Creates daily/weekly/monthly page views tables for enhanced analytics</li>
        </ul>
        <p style="margin-top: 15px; font-size: 0.9rem; color: #666;">
          <i class="fas fa-clock"></i> Future migrations will be numbered sequentially (003_, 004_, etc.)
        </p>
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <a href="/admin/dashboard" class="btn btn-secondary">
          <i class="fas fa-arrow-left"></i> Back to Dashboard
        </a>
      </div>
    </div>
  `;

  // ✅ Pass pending.length to show/hide the notification badge on the Migrations tab
  return new Response(adminLayout('Migrations', content, auth, 'migrate', pending.length), {
    headers: { 'Content-Type': 'text/html' }
  });
}