// src/routes/admin/genres.js
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
      <div class="genres-dashboard" style="max-width: 100%; overflow-x: hidden;">
        <!-- Header - Stack on mobile, row on desktop -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <h2 style="font-size: 1.5rem; margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <i class="fas fa-tags" style="color: #ff5500;"></i> 
              <span>Genre Management</span>
            </h2>
            <p style="color: #666; margin: 0; font-size: 0.9rem;">Manage music genres across your library</p>
          </div>
          <div style="display: flex; justify-content: flex-start;">
            <a href="/admin/genres/create" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;">
              <i class="fas fa-plus"></i> Add New Genre
            </a>
          </div>
        </div>

        <!-- Stats Summary - 2x2 grid on mobile, 4x1 on desktop -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 25px;">
          <div style="background: white; padding: 15px 10px; border-radius: 12px; border: 1px solid #e8e8e8;">
            <div style="font-size: 0.7rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">TOTAL GENRES</div>
            <div style="font-size: 1.8rem; font-weight: 700; color: #ff5500; line-height: 1.2;">${genres.length}</div>
          </div>
          <div style="background: white; padding: 15px 10px; border-radius: 12px; border: 1px solid #e8e8e8;">
            <div style="font-size: 0.7rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">SONGS WITH GENRES</div>
            <div style="font-size: 1.8rem; font-weight: 700; color: #28a745; line-height: 1.2;">${stats.reduce((sum, g) => sum + g.songCount, 0)}</div>
          </div>
          <div style="background: white; padding: 15px 10px; border-radius: 12px; border: 1px solid #e8e8e8;">
            <div style="font-size: 0.7rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">ARTISTS WITH GENRES</div>
            <div style="font-size: 1.8rem; font-weight: 700; color: #9b59b6; line-height: 1.2;">${stats.reduce((sum, g) => sum + g.artistCount, 0)}</div>
          </div>
          <div style="background: white; padding: 15px 10px; border-radius: 12px; border: 1px solid #e8e8e8;">
            <div style="font-size: 0.7rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">MOST POPULAR</div>
            <div style="font-size: 1.1rem; font-weight: 600; color: #ff5500; line-height: 1.2; word-break: break-word;">${stats[0]?.name || 'N/A'}</div>
          </div>
        </div>

        <!-- Genres Grid - 1 column on mobile, 2 on tablet, 3-4 on desktop -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 30px;">
          ${genres.map(genre => {
            const genreStats = stats.find(s => s.id === genre.id) || { songCount: 0, artistCount: 0, albumCount: 0 };
            return `
            <div class="genre-card" style="background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e8e8e8; width: 100%;">
              <div style="height: 6px; background: ${genre.color};"></div>
              <div style="padding: 16px;">
                <!-- Header with icon, title and actions -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 10px;">
                  <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                    <i class="fas ${genre.icon}" style="color: ${genre.color}; font-size: 1.8rem; flex-shrink: 0;"></i>
                    <div style="min-width: 0; flex: 1;">
                      <h3 style="margin: 0 0 3px; font-size: 1.1rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${genre.name}</h3>
                      <code style="font-size: 0.65rem; color: #999; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${genre.id}</code>
                    </div>
                  </div>
                  <div style="display: flex; gap: 6px; flex-shrink: 0;">
                    <a href="/admin/genres/edit?id=${genre.id}" class="btn btn-sm btn-secondary" style="padding: 6px 10px;" title="Edit">
                      <i class="fas fa-edit"></i>
                    </a>
                    <button onclick="deleteGenre('${genre.id}')" class="btn btn-sm btn-danger" style="padding: 6px 10px;" title="Delete">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                
                <!-- Description - truncate on mobile -->
                <p style="font-size: 0.85rem; color: #666; margin-bottom: 15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">
                  ${genre.description || 'No description'}
                </p>
                
                <!-- Stats - 2x2 grid on mobile -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.8rem;">
                  <div style="display: flex; align-items: center; gap: 5px; min-width: 0;">
                    <i class="fas fa-music" style="color: #ff5500; flex-shrink: 0;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${genreStats.songCount} songs</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 5px; min-width: 0;">
                    <i class="fas fa-microphone" style="color: #9b59b6; flex-shrink: 0;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${genreStats.artistCount} artists</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 5px; min-width: 0;">
                    <i class="fas fa-compact-disc" style="color: #28a745; flex-shrink: 0;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${genreStats.albumCount} albums</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 5px; min-width: 0;">
                    <i class="fas fa-list" style="color: #4a90e2; flex-shrink: 0;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${genreStats.playlistCount || 0} playlists</span>
                  </div>
                </div>
              </div>
            </div>
            `;
          }).join('')}
        </div>

        <!-- Genre Distribution Chart - Fully responsive -->
        ${stats.length > 0 ? `
        <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8; width: 100%; overflow-x: hidden;">
          <h3 style="margin-bottom: 15px; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-chart-pie" style="color: #ff5500;"></i> Genre Distribution
          </h3>
          <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
            ${stats.slice(0, 8).map(g => {
              const percentage = Math.min(100, (g.songCount / (stats[0]?.songCount || 1)) * 100);
              return `
              <div style="width: 100%;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.85rem; flex-wrap: wrap; gap: 5px;">
                  <span style="display: flex; align-items: center; gap: 5px; min-width: 0; flex: 1;">
                    <i class="fas ${g.icon}" style="color: ${g.color}; flex-shrink: 0;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${g.name}</span>
                  </span>
                  <span style="font-weight: 600; flex-shrink: 0;">${g.songCount} songs</span>
                </div>
                <div style="height: 8px; background: #e8e8e8; border-radius: 4px; width: 100%;">
                  <div style="width: ${percentage}%; height: 8px; background: ${g.color}; border-radius: 4px; transition: width 0.3s;"></div>
                </div>
              </div>
              `;
            }).join('')}
          </div>
          ${stats.length > 8 ? `
            <div style="text-align: center; margin-top: 15px; color: #999; font-size: 0.8rem;">
              +${stats.length - 8} more genres
            </div>
          ` : ''}
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
        @media (min-width: 640px) {
          .genres-dashboard .genre-card {
            /* Tablet styles handled by grid */
          }
        }
        
        @media (min-width: 768px) {
          .genres-dashboard > div:first-child {
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
          }
          
          .genres-dashboard > div:first-child > div:first-child {
            flex: 1;
          }
          
          .genres-dashboard > div:nth-child(2) {
            grid-template-columns: repeat(4, 1fr) !important;
          }
          
          .genres-dashboard > div:nth-child(3) {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        
        @media (min-width: 1024px) {
          .genres-dashboard > div:nth-child(3) {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        
        @media (min-width: 1280px) {
          .genres-dashboard > div:nth-child(3) {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
        
        .genre-card {
          transition: transform 0.2s, box-shadow 0.2s;
          width: 100%;
        }
        
        .genre-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
        
        @media (max-width: 640px) {
          .genre-card:hover {
            transform: none;
          }
          
          .btn-sm {
            padding: 8px 12px !important;
          }
        }
      </style>
    `;

    return new Response(adminLayout('Genre Management', content, auth, 'genres', 0, 
      { total: 0 }, { total: 0 }, { total: 0 }, { total: genres.length }
    ), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== CREATE GENRE PAGE =====
  if (path === '/create' && req.method === 'GET') {
    const colors = genreManager.getColorPalette();
    const icons = genreManager.getIconOptions();

    const content = `
      <div style="max-width: 600px; margin: 0 auto; width: 100%; padding: 0 0 20px;">
        <!-- Header with back button - stacked on mobile -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
          <a href="/admin/genres" class="btn btn-secondary btn-sm" style="align-self: flex-start; display: inline-flex; align-items: center; gap: 5px;">
            <i class="fas fa-arrow-left"></i> Back
          </a>
          <h2 style="font-size: 1.3rem; margin:0; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-plus-circle" style="color: #ff5500;"></i> Create New Genre
          </h2>
        </div>

        <form action="/admin/genres/create" method="POST" style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8; width: 100%;">
          <div class="form-group" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Genre ID <span style="color: #ff5500;">*</span></label>
            <input type="text" name="id" class="form-control" placeholder="e.g., dancehall, hip-hop" required pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
            <small style="color: #999; display: block; margin-top: 5px;">This will be used in URLs: /genre/dancehall</small>
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Display Name <span style="color: #ff5500;">*</span></label>
            <input type="text" name="name" class="form-control" placeholder="e.g., Dancehall" required style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Description</label>
            <textarea name="description" class="form-control" rows="3" placeholder="Brief description of this genre..." style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; resize: vertical;"></textarea>
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 10px; font-weight: 600;">Color Theme</label>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              ${colors.map(color => `
                <label style="display: block; cursor: pointer; aspect-ratio: 1;">
                  <input type="radio" name="color" value="${color}" style="display: none;">
                  <div style="width: 100%; height: 100%; background: ${color}; border-radius: 8px; border: 2px solid transparent;" 
                       onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.color-preview').forEach(el => el.style.borderColor = 'transparent'); this.style.borderColor = '#333';">
                  </div>
                </label>
              `).join('')}
            </div>
            <input type="hidden" name="color" id="selectedColor" value="${colors[0]}">
            <small style="color: #999; display: block; margin-top: 5px;">Select a color for the genre</small>
          </div>

          <div class="form-group" style="margin-bottom: 25px;">
            <label style="display: block; margin-bottom: 10px; font-weight: 600;">Icon</label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              ${icons.map(icon => `
                <label style="display: block; cursor: pointer; text-align: center;">
                  <input type="radio" name="icon" value="${icon}" style="display: none;">
                  <div style="padding: 12px 5px; border: 2px solid #e8e8e8; border-radius: 8px;" 
                       onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.icon-preview').forEach(el => el.style.borderColor = '#e8e8e8'); this.style.borderColor = '#ff5500';">
                    <i class="fas ${icon}" style="font-size: 1.3rem;"></i>
                  </div>
                </label>
              `).join('')}
            </div>
            <input type="hidden" name="icon" id="selectedIcon" value="${icons[0]}">
            <small style="color: #999; display: block; margin-top: 5px;">Choose an icon for the genre</small>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 25px;">
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 16px;">Create Genre</button>
            <a href="/admin/genres" class="btn btn-secondary" style="width: 100%; padding: 14px; font-size: 16px; text-align: center;">Cancel</a>
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

        <style>
          @media (min-width: 480px) {
            form > div:last-child {
              flex-direction: row !important;
            }
            
            .color-grid {
              grid-template-columns: repeat(5, 1fr) !important;
            }
            
            .icon-grid {
              grid-template-columns: repeat(6, 1fr) !important;
            }
          }
        </style>
      </div>
    `;

    return new Response(adminLayout('Create Genre', content, auth, 'genres', 0, 
      { total: 0 }, { total: 0 }, { total: 0 }, { total: 0 }
    ), {
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
        <div style="text-align: center; padding: 40px 20px; max-width: 100%;">
          <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #dc3545; margin-bottom: 20px;"></i>
          <h3 style="margin: 15px 0; font-size: 1.2rem;">Error Creating Genre</h3>
          <p style="color: #666; margin-bottom: 20px; word-break: break-word;">${error.message}</p>
          <a href="/admin/genres/create" class="btn btn-primary" style="display: inline-block; padding: 12px 24px;">Try Again</a>
        </div>
      `;
      return new Response(adminLayout('Error', content, auth, 'genres', 0, 
        { total: 0 }, { total: 0 }, { total: 0 }, { total: 0 }
      ), {
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
      <div style="max-width: 600px; margin: 0 auto; width: 100%; padding: 0 0 20px;">
        <!-- Header with back button - stacked on mobile -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
          <a href="/admin/genres" class="btn btn-secondary btn-sm" style="align-self: flex-start; display: inline-flex; align-items: center; gap: 5px;">
            <i class="fas fa-arrow-left"></i> Back
          </a>
          <h2 style="font-size: 1.3rem; margin:0; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-edit" style="color: #ff5500;"></i> Edit Genre: <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${genre.name}</span>
          </h2>
        </div>

        <form action="/admin/genres/edit" method="POST" style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8; width: 100%;">
          <input type="hidden" name="id" value="${genre.id}">

          <div class="form-group" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Display Name <span style="color: #ff5500;">*</span></label>
            <input type="text" name="name" class="form-control" value="${genre.name}" required style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px;">
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Description</label>
            <textarea name="description" class="form-control" rows="3" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; resize: vertical;">${genre.description || ''}</textarea>
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 10px; font-weight: 600;">Color Theme</label>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              ${colors.map(color => `
                <label style="display: block; cursor: pointer; aspect-ratio: 1;">
                  <input type="radio" name="color" value="${color}" ${color === genre.color ? 'checked' : ''} style="display: none;">
                  <div style="width: 100%; height: 100%; background: ${color}; border-radius: 8px; border: 2px solid ${color === genre.color ? '#333' : 'transparent'};" 
                       onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.color-preview').forEach(el => el.style.borderColor = 'transparent'); this.style.borderColor = '#333';">
                  </div>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 25px;">
            <label style="display: block; margin-bottom: 10px; font-weight: 600;">Icon</label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              ${icons.map(icon => `
                <label style="display: block; cursor: pointer; text-align: center;">
                  <input type="radio" name="icon" value="${icon}" ${icon === genre.icon ? 'checked' : ''} style="display: none;">
                  <div style="padding: 12px 5px; border: 2px solid ${icon === genre.icon ? '#ff5500' : '#e8e8e8'}; border-radius: 8px;" 
                       onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.icon-preview').forEach(el => el.style.borderColor = '#e8e8e8'); this.style.borderColor = '#ff5500';">
                    <i class="fas ${icon}" style="font-size: 1.3rem;"></i>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 25px;">
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 16px;">Save Changes</button>
            <a href="/admin/genres" class="btn btn-secondary" style="width: 100%; padding: 14px; font-size: 16px; text-align: center;">Cancel</a>
          </div>
        </form>

        <style>
          @media (min-width: 480px) {
            form > div:last-child {
              flex-direction: row !important;
            }
            
            .color-grid {
              grid-template-columns: repeat(5, 1fr) !important;
            }
            
            .icon-grid {
              grid-template-columns: repeat(6, 1fr) !important;
            }
          }
        </style>
      </div>
    `;

    return new Response(adminLayout('Edit Genre', content, auth, 'genres', 0, 
      { total: 0 }, { total: 0 }, { total: 0 }, { total: 0 }
    ), {
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
        <div style="text-align: center; padding: 40px 20px; max-width: 100%;">
          <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #dc3545; margin-bottom: 20px;"></i>
          <h3 style="margin: 15px 0; font-size: 1.2rem;">Error Updating Genre</h3>
          <p style="color: #666; margin-bottom: 20px; word-break: break-word;">${error.message}</p>
          <a href="/admin/genres/edit?id=${id}" class="btn btn-primary" style="display: inline-block; padding: 12px 24px;">Try Again</a>
        </div>
      `;
      return new Response(adminLayout('Error', content, auth, 'genres', 0, 
        { total: 0 }, { total: 0 }, { total: 0 }, { total: 0 }
      ), {
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