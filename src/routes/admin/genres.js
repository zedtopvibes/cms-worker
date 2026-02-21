//src/routes/admin/genres.js
import { GenreManager } from '../../helpers/genreManager.js';
import { adminLayout } from './layout.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';

export async function handleGenres(req, env, ctx, auth) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/admin/genres', '') || '/';
  
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  const genres = genresData.genres;
  const stats = await genreManager.getGenreStats();

  // ===== MAIN GENRES DASHBOARD =====
  if (path === '/' || path === '') {
    const content = `
      <div class="genres-dashboard">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 style="font-size: 1.5rem; margin-bottom: 5px;">
              <i class="fas fa-tags" style="color: #ff5500;"></i> Genre Management
            </h2>
            <p style="color: #666;">Manage music genres across your library</p>
          </div>
          <a href="/admin/genres/create" class="btn btn-primary">
            <i class="fas fa-plus"></i> Add New Genre
          </a>
        </div>

        <!-- Genre Stats Summary -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px;">
          <div style="background: white; padding: 15px; border-radius: 12px; border: 1px solid #e8e8e8;">
            <div style="font-size: 0.7rem; color: #666;">TOTAL GENRES</div>
            <div style="font-size: 2rem; font-weight: 700; color: #ff5500;">${genres.length}</div>
          </div>
          <div style="background: white; padding: 15px; border-radius: 12px; border: 1px solid #e8e8e8;">
            <div style="font-size: 0.7rem; color: #666;">SONGS WITH GENRES</div>
            <div style="font-size: 2rem; font-weight: 700; color: #28a745;">${stats.reduce((sum, g) => sum + g.songCount, 0)}</div>
          </div>
          <div style="background: white; padding: 15px; border-radius: 12px; border: 1px solid #e8e8e8;">
            <div style="font-size: 0.7rem; color: #666;">ARTISTS WITH GENRES</div>
            <div style="font-size: 2rem; font-weight: 700; color: #9b59b6;">${stats.reduce((sum, g) => sum + g.artistCount, 0)}</div>
          </div>
          <div style="background: white; padding: 15px; border-radius: 12px; border: 1px solid #e8e8e8;">
            <div style="font-size: 0.7rem; color: #666;">MOST POPULAR</div>
            <div style="font-size: 1.2rem; font-weight: 600; color: #ff5500;">${stats[0]?.name || 'N/A'}</div>
          </div>
        </div>

        <!-- Genres Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; margin-bottom: 30px;">
          ${genres.map(genre => {
            const genreStats = stats.find(s => s.id === genre.id) || { songCount: 0, artistCount: 0, albumCount: 0 };
            return `
            <div class="genre-card" style="background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e8e8e8;">
              <div style="height: 8px; background: ${genre.color};"></div>
              <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                  <div>
                    <i class="fas ${genre.icon}" style="color: ${genre.color}; font-size: 1.8rem;"></i>
                    <h3 style="margin: 10px 0 5px; font-size: 1.2rem;">${genre.name}</h3>
                    <code style="font-size: 0.7rem; color: #999;">${genre.id}</code>
                  </div>
                  <div style="display: flex; gap: 5px;">
                    <a href="/admin/genres/edit?id=${genre.id}" class="btn btn-sm btn-secondary" style="padding: 6px 10px;" title="Edit">
                      <i class="fas fa-edit"></i>
                    </a>
                    <button onclick="deleteGenre('${genre.id}')" class="btn btn-sm btn-danger" style="padding: 6px 10px;" title="Delete">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                
                <p style="font-size: 0.85rem; color: #666; margin-bottom: 15px;">${genre.description || 'No description'}</p>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.8rem;">
                  <div><i class="fas fa-music" style="color: #ff5500;"></i> ${genreStats.songCount} songs</div>
                  <div><i class="fas fa-microphone" style="color: #9b59b6;"></i> ${genreStats.artistCount} artists</div>
                  <div><i class="fas fa-compact-disc" style="color: #28a745;"></i> ${genreStats.albumCount} albums</div>
                  <div><i class="fas fa-list" style="color: #4a90e2;"></i> ${genreStats.playlistCount || 0} playlists</div>
                </div>
              </div>
            </div>
            `;
          }).join('')}
        </div>

        <!-- Genre Distribution Chart -->
        ${stats.length > 0 ? `
        <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8;">
          <h3 style="margin-bottom: 15px; font-size: 1.1rem;">
            <i class="fas fa-chart-pie" style="color: #ff5500;"></i> Genre Distribution
          </h3>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${stats.slice(0, 10).map(g => `
              <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span><i class="fas ${g.icon}" style="color: ${g.color};"></i> ${g.name}</span>
                  <span>${g.songCount} songs</span>
                </div>
                <div style="height: 8px; background: #e8e8e8; border-radius: 4px;">
                  <div style="width: ${(g.songCount / stats[0].songCount) * 100}%; height: 8px; background: ${g.color}; border-radius: 4px;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>

      <script>
        function deleteGenre(id) {
          if (confirm('Are you sure you want to delete this genre? It will be removed from all songs, artists, albums and playlists.')) {
            window.location.href = '/admin/genres/delete?id=' + id;
          }
        }
      </script>

      <style>
        .genre-card {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .genre-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        @media (max-width: 768px) {
          .genre-card {
            transform: none !important;
          }
        }
      </style>
    `;

    return new Response(adminLayout('Genre Management', content, auth, 'genres'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== CREATE GENRE PAGE =====
  if (path === '/create' && req.method === 'GET') {
    const colors = genreManager.getColorPalette();
    const icons = genreManager.getIconOptions();

    const content = `
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/genres" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i> Back
          </a>
          <h2 style="font-size: 1.3rem; margin:0;">
            <i class="fas fa-plus-circle" style="color: #ff5500;"></i> Create New Genre
          </h2>
        </div>

        <form action="/admin/genres/create" method="POST" style="background: white; border-radius: 12px; padding: 25px; border: 1px solid #e8e8e8;">
          <div class="form-group">
            <label>Genre ID (unique, no spaces)</label>
            <input type="text" name="id" class="form-control" placeholder="e.g., dancehall, hip-hop" required pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only">
            <small style="color: #999;">This will be used in URLs: /genre/dancehall</small>
          </div>

          <div class="form-group">
            <label>Display Name</label>
            <input type="text" name="name" class="form-control" placeholder="e.g., Dancehall" required>
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea name="description" class="form-control" rows="3" placeholder="Brief description of this genre..."></textarea>
          </div>

          <div class="form-group">
            <label>Color Theme</label>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
              ${colors.map(color => `
                <label style="display: block; cursor: pointer;">
                  <input type="radio" name="color" value="${color}" style="display: none;">
                  <div style="height: 40px; background: ${color}; border-radius: 8px; border: 2px solid transparent;" 
                       onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.color-preview').forEach(el => el.style.borderColor = 'transparent'); this.style.borderColor = '#333';">
                  </div>
                </label>
              `).join('')}
            </div>
            <input type="hidden" name="color" id="selectedColor" value="${colors[0]}">
          </div>

          <div class="form-group">
            <label>Icon</label>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;">
              ${icons.map(icon => `
                <label style="display: block; cursor: pointer; text-align: center;">
                  <input type="radio" name="icon" value="${icon}" style="display: none;">
                  <div style="padding: 10px; border: 2px solid #e8e8e8; border-radius: 8px;" 
                       onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.icon-preview').forEach(el => el.style.borderColor = '#e8e8e8'); this.style.borderColor = '#ff5500';">
                    <i class="fas ${icon}" style="font-size: 1.2rem;"></i>
                  </div>
                </label>
              `).join('')}
            </div>
            <input type="hidden" name="icon" id="selectedIcon" value="${icons[0]}">
          </div>

          <div style="display: flex; gap: 10px; margin-top: 25px;">
            <button type="submit" class="btn btn-primary" style="flex: 1;">Create Genre</button>
            <a href="/admin/genres" class="btn btn-secondary" style="flex: 1;">Cancel</a>
          </div>
        </form>

        <script>
          // Set first color and icon as default
          document.querySelector('input[name="color"]').checked = true;
          document.querySelector('input[name="icon"]').checked = true;
          
          // Update hidden inputs on selection
          document.querySelectorAll('input[name="color"]').forEach(radio => {
            radio.addEventListener('change', function() {
              document.getElementById('selectedColor').value = this.value;
            });
          });
          
          document.querySelectorAll('input[name="icon"]').forEach(radio => {
            radio.addEventListener('change', function() {
              document.getElementById('selectedIcon').value = this.value;
            });
          });
        </script>
      </div>
    `;

    return new Response(adminLayout('Create Genre', content, auth, 'genres'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== CREATE GENRE POST =====
  if (path === '/create' && req.method === 'POST') {
    const formData = await req.formData();
    const id = formData.get('id');
    const name = formData.get('name');
    const description = formData.get('description') || '';
    const color = formData.get('color') || '#ff5500';
    const icon = formData.get('icon') || 'fa-music';

    try {
      await genreManager.addGenre({ id, name, description, color, icon });
      await logAdminActivity(env, auth.session.id, 'create', 'genre', id, name);
      
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/genres?created=1' }
      });
    } catch (error) {
      const content = `
        <div style="text-align: center; padding: 40px 20px;">
          <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #dc3545;"></i>
          <h3 style="margin: 15px 0;">Error Creating Genre</h3>
          <p style="color: #666;">${error.message}</p>
          <a href="/admin/genres/create" class="btn btn-primary" style="margin-top: 20px;">Try Again</a>
        </div>
      `;
      return new Response(adminLayout('Error', content, auth, 'genres'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // ===== EDIT GENRE PAGE =====
  if (path === '/edit' && req.method === 'GET') {
    const id = url.searchParams.get('id');
    const genre = genres.find(g => g.id === id);
    
    if (!genre) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/genres?error=not_found' }
      });
    }

    const colors = genreManager.getColorPalette();
    const icons = genreManager.getIconOptions();

    const content = `
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/genres" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i> Back
          </a>
          <h2 style="font-size: 1.3rem; margin:0;">
            <i class="fas fa-edit" style="color: #ff5500;"></i> Edit Genre: ${genre.name}
          </h2>
        </div>

        <form action="/admin/genres/edit" method="POST" style="background: white; border-radius: 12px; padding: 25px; border: 1px solid #e8e8e8;">
          <input type="hidden" name="id" value="${genre.id}">

          <div class="form-group">
            <label>Display Name</label>
            <input type="text" name="name" class="form-control" value="${genre.name}" required>
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea name="description" class="form-control" rows="3">${genre.description || ''}</textarea>
          </div>

          <div class="form-group">
            <label>Color Theme</label>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
              ${colors.map(color => `
                <label style="display: block; cursor: pointer;">
                  <input type="radio" name="color" value="${color}" ${color === genre.color ? 'checked' : ''} style="display: none;">
                  <div style="height: 40px; background: ${color}; border-radius: 8px; border: 2px solid ${color === genre.color ? '#333' : 'transparent'};" 
                       onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.color-preview').forEach(el => el.style.borderColor = 'transparent'); this.style.borderColor = '#333';">
                  </div>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>Icon</label>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;">
              ${icons.map(icon => `
                <label style="display: block; cursor: pointer; text-align: center;">
                  <input type="radio" name="icon" value="${icon}" ${icon === genre.icon ? 'checked' : ''} style="display: none;">
                  <div style="padding: 10px; border: 2px solid ${icon === genre.icon ? '#ff5500' : '#e8e8e8'}; border-radius: 8px;" 
                       onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.icon-preview').forEach(el => el.style.borderColor = '#e8e8e8'); this.style.borderColor = '#ff5500';">
                    <i class="fas ${icon}" style="font-size: 1.2rem;"></i>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 25px;">
            <button type="submit" class="btn btn-primary" style="flex: 1;">Save Changes</button>
            <a href="/admin/genres" class="btn btn-secondary" style="flex: 1;">Cancel</a>
          </div>
        </form>
      </div>
    `;

    return new Response(adminLayout('Edit Genre', content, auth, 'genres'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== EDIT GENRE POST =====
  if (path === '/edit' && req.method === 'POST') {
    const formData = await req.formData();
    const id = formData.get('id');
    const name = formData.get('name');
    const description = formData.get('description');
    const color = formData.get('color');
    const icon = formData.get('icon');

    try {
      await genreManager.updateGenre(id, { name, description, color, icon });
      await logAdminActivity(env, auth.session.id, 'edit', 'genre', id, name);
      
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/genres?updated=1' }
      });
    } catch (error) {
      const content = `
        <div style="text-align: center; padding: 40px 20px;">
          <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #dc3545;"></i>
          <h3 style="margin: 15px 0;">Error Updating Genre</h3>
          <p style="color: #666;">${error.message}</p>
          <a href="/admin/genres/edit?id=${id}" class="btn btn-primary" style="margin-top: 20px;">Try Again</a>
        </div>
      `;
      return new Response(adminLayout('Error', content, auth, 'genres'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // ===== DELETE GENRE =====
  if (path === '/delete' && req.method === 'GET') {
    const id = url.searchParams.get('id');
    
    try {
      await genreManager.deleteGenre(id);
      await logAdminActivity(env, auth.session.id, 'delete', 'genre', id, id);
      
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/genres?deleted=1' }
      });
    } catch (error) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/genres?error=delete_failed' }
      });
    }
  }

  return new Response('Not Found', { status: 404 });
}