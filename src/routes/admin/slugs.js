// src/routes/admin/slugs.js
import { SlugManager } from '../../helpers/slug.js';
import { adminLayout } from './layout.js';

export async function handleSlugs(req, env, ctx, auth) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/admin/slugs', '') || '/';
  
  const slugManager = new SlugManager(env);
  const index = await slugManager.getSlugIndex();
  
  if (path === '/' || path === '') {
    const stats = {
      songs: Object.keys(index.songs || {}).length,
      artists: Object.keys(index.artists || {}).length,
      albums: Object.keys(index.albums || {}).length,
      playlists: Object.keys(index.playlists || {}).length,
      genres: Object.keys(index.genres || {}).length,
      total: Object.keys(index.songs || {}).length + 
             Object.keys(index.artists || {}).length +
             Object.keys(index.albums || {}).length +
             Object.keys(index.playlists || {}).length +
             Object.keys(index.genres || {}).length
    };
    
    const content = `
      <div class="slugs-dashboard">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-link" style="color: #ff5500;"></i> Slug Manager</h2>
        
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin: 20px 0;">
          <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e8e8e8;">
            <div style="font-size: 2rem; color: #ff5500;">${stats.songs}</div>
            <div style="color: #666;">Songs</div>
          </div>
          <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e8e8e8;">
            <div style="font-size: 2rem; color: #9b59b6;">${stats.artists}</div>
            <div style="color: #666;">Artists</div>
          </div>
          <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e8e8e8;">
            <div style="font-size: 2rem; color: #28a745;">${stats.albums}</div>
            <div style="color: #666;">Albums</div>
          </div>
          <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e8e8e8;">
            <div style="font-size: 2rem; color: #4a90e2;">${stats.playlists}</div>
            <div style="color: #666;">Playlists</div>
          </div>
          <div style="background: white; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e8e8e8;">
            <div style="font-size: 2rem; color: #ffc107;">${stats.genres}</div>
            <div style="color: #666;">Genres</div>
          </div>
        </div>
        
        <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8;">
          <h3 style="margin-bottom: 15px;">Recent Slugs</h3>
          <div class="table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Slug</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(index.songs || {}).slice(0, 5).map(([slug, data]) => `
                  <tr>
                    <td>🎵 Song</td>
                    <td><code>${slug}</code></td>
                    <td><a href="/song/${slug}" target="_blank" style="color: #ff5500;">/song/${slug}</a></td>
                  </tr>
                `).join('')}
                ${Object.entries(index.artists || {}).slice(0, 5).map(([slug, data]) => `
                  <tr>
                    <td>🎤 Artist</td>
                    <td><code>${slug}</code></td>
                    <td><a href="/artist/${slug}" target="_blank" style="color: #ff5500;">/artist/${slug}</a></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    return new Response(adminLayout('Slug Manager', content, auth, 'slugs'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  return new Response('Not found', { status: 404 });
}