// src/routes/admin/contentQuality.js
import { ContentQualityAnalyzer } from '../../helpers/contentQualityAnalyzer.js';
import { adminLayout } from './layout.js';
import { formatDuration } from '../../helpers/formatting.js';

export async function handleContentQuality(req, env, ctx, auth) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/admin/content-quality', '') || '/';
  
  const analyzer = new ContentQualityAnalyzer(env);

  // Main dashboard
  if (path === '/' || path === '') {
    const scan = await analyzer.scanAll();
    
    const content = `
      <div class="content-quality">
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 1.5rem; margin-bottom: 15px;">
            <i class="fas fa-chart-line" style="color: #ff5500;"></i>
            Content Quality Analyzer
          </h2>
          <p style="color: #666; margin-bottom: 20px;">Analyze and improve the quality of your music library.</p>
        </div>

        <!-- Quality Score Overview -->
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 25px; border-radius: 16px; margin-bottom: 25px;">
          <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
            <div style="text-align: center;">
              <div style="font-size: 3rem; font-weight: 800;">${Math.max(0, 100 - scan.totals.total)}</div>
              <div style="font-size: 0.9rem; opacity: 0.9;">Quality Score</div>
            </div>
            <div style="flex: 1;">
              <div style="height: 10px; background: rgba(255,255,255,0.3); border-radius: 5px;">
                <div style="width: ${Math.max(0, 100 - scan.totals.total)}%; height: 10px; background: #ff5500; border-radius: 5px;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.8rem;">
                <span>Poor</span>
                <span>Good</span>
                <span>Excellent</span>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 2rem; font-weight: 700;">${scan.totals.total}</div>
              <div style="font-size: 0.8rem; opacity: 0.9;">Issues Found</div>
            </div>
          </div>
        </div>

        <!-- Stats Grid - 2 per row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px;">
          <!-- Low Bitrate -->
          <div style="background: ${scan.totals.lowBitrateSongs > 0 ? 'linear-gradient(135deg, #ff6b6b, #ff4757)' : 'linear-gradient(135deg, #7bed9f, #2ed573)'}; color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-headphones" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">LOW BITRATE</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.lowBitrateSongs}</div>
                <div style="font-size: 0.7rem;">songs < 128kbps</div>
              </div>
            </div>
          </div>

          <!-- Missing Descriptions -->
          <div style="background: ${scan.totals.missingDescriptions > 0 ? 'linear-gradient(135deg, #ffa502, #ff7f50)' : 'linear-gradient(135deg, #7bed9f, #2ed573)'}; color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-align-left" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">MISSING DESCRIPTIONS</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.missingDescriptions}</div>
              </div>
            </div>
          </div>

          <!-- Incomplete Artist Bios -->
          <div style="background: ${scan.totals.incompleteArtistBios > 0 ? 'linear-gradient(135deg, #ff6b81, #ff4757)' : 'linear-gradient(135deg, #7bed9f, #2ed573)'}; color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-user" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">INCOMPLETE BIOS</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.incompleteArtistBios}</div>
              </div>
            </div>
          </div>

          <!-- Albums Missing Years -->
          <div style="background: ${scan.totals.albumsMissingYears > 0 ? 'linear-gradient(135deg, #70a1ff, #1e90ff)' : 'linear-gradient(135deg, #7bed9f, #2ed573)'}; color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-calendar" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">ALBUMS MISSING YEARS</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.albumsMissingYears}</div>
              </div>
            </div>
          </div>

          <!-- Songs No Genre -->
          <div style="background: ${scan.totals.songsNoGenre > 0 ? 'linear-gradient(135deg, #ffb142, #cc8e34)' : 'linear-gradient(135deg, #7bed9f, #2ed573)'}; color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-tag" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">SONGS NO GENRE</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.songsNoGenre}</div>
              </div>
            </div>
          </div>

          <!-- Songs No Duration -->
          <div style="background: ${scan.totals.songsNoDuration > 0 ? 'linear-gradient(135deg, #ff6b6b, #ee5a24)' : 'linear-gradient(135deg, #7bed9f, #2ed573)'}; color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-clock" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">SONGS NO DURATION</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.songsNoDuration}</div>
              </div>
            </div>
          </div>
 
          <!-- Artists No Image -->
          <div style="background: ${scan.totals.artistsNoImage > 0 ? 'linear-gradient(135deg, #9b59b6, #8e44ad)' : 'linear-gradient(135deg, #7bed9f, #2ed573)'}; color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-camera" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">ARTISTS NO IMAGE</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.artistsNoImage}</div>
              </div>
            </div>
          </div>

          <!-- Albums No Thumbnail -->
          <div style="background: ${scan.totals.albumsNoThumbnail > 0 ? 'linear-gradient(135deg, #00b894, #00cec9)' : 'linear-gradient(135deg, #7bed9f, #2ed573)'}; color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-image" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">ALBUMS NO THUMBNAIL</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.albumsNoThumbnail}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 25px;">
          <a href="/admin/content-quality/low-bitrate" class="action-card">
            <i class="fas fa-headphones" style="color: #ff6b6b;"></i>
            <h3>Low Bitrate Songs</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.lowBitrateSongs}</span>
          </a>
          
          <a href="/admin/content-quality/missing-descriptions" class="action-card">
            <i class="fas fa-align-left" style="color: #ffa502;"></i>
            <h3>Missing Descriptions</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.missingDescriptions}</span>
          </a>
          
          <a href="/admin/content-quality/incomplete-bios" class="action-card">
            <i class="fas fa-user" style="color: #ff6b81;"></i>
            <h3>Incomplete Artist Bios</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.incompleteArtistBios}</span>
          </a>
          
          <a href="/admin/content-quality/albums-missing-years" class="action-card">
            <i class="fas fa-calendar" style="color: #70a1ff;"></i>
            <h3>Albums Missing Years</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.albumsMissingYears}</span>
          </a>
          
          <a href="/admin/content-quality/songs-no-genre" class="action-card">
            <i class="fas fa-tag" style="color: #ffb142;"></i>
            <h3>Songs No Genre</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.songsNoGenre}</span>
          </a>
          
          <a href="/admin/content-quality/songs-no-duration" class="action-card">
            <i class="fas fa-clock" style="color: #ff6b6b;"></i>
            <h3>Songs No Duration</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.songsNoDuration}</span>
          </a>
          
          <a href="/admin/content-quality/artists-no-image" class="action-card">
            <i class="fas fa-camera" style="color: #9b59b6;"></i>
            <h3>Artists No Image</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.artistsNoImage}</span>
          </a>
          
          <a href="/admin/content-quality/albums-no-thumbnail" class="action-card">
            <i class="fas fa-image" style="color: #00b894;"></i>
            <h3>Albums No Thumbnail</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.albumsNoThumbnail}</span>
          </a>
        </div>

        <style>
          .action-card {
            display: block;
            padding: 20px 15px;
            background: white;
            border-radius: 12px;
            text-decoration: none;
            color: #333;
            text-align: center;
            border: 1px solid #e8e8e8;
            transition: all 0.3s;
          }
          
          .action-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            border-color: #ff5500;
          }
          
          .action-card i {
            font-size: 2rem;
            margin-bottom: 10px;
          }
          
          .action-card h3 {
            font-size: 0.9rem;
            margin-bottom: 8px;
          }
          
          .action-card .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 20px;
            font-size: 0.8rem;
          }
        </style>
      </div>
    `;

    return new Response(adminLayout('Content Quality', content, auth, 'content-quality', 0, { total: 0 }, { total: scan.totals.total }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Low Bitrate Songs
  if (path === '/low-bitrate') {
    const songs = await analyzer.findLowBitrateSongs();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/content-quality" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Low Bitrate Songs</h2>
        </div>
        
        ${songs.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All songs have good audio quality.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${songs.map(song => `
              <div class="mobile-card" style="border-left: 4px solid ${song.needsAttention === 'critical' ? '#dc3545' : '#ffc107'};">
                <div style="font-weight:600; margin-bottom:5px;">${song.title}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:8px;">${song.baseName}</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span class="badge" style="background: ${song.estimatedBitrate < 96 ? '#dc3545' : '#ffc107'}; color: white;">
                    ${song.estimatedBitrate} kbps
                  </span>
                  <span>${formatDuration(song.duration)}</span>
                  <span>${formatFileSize(song.size)}</span>
                </div>
                <div style="display:flex; gap:8px;">
                  <a href="/admin/songs/edit?name=${song.baseName}" class="btn btn-primary btn-sm" style="flex:1;">Replace</a>
                  <button onclick="previewModal.show('song', '${song.baseName}')" class="btn btn-secondary btn-sm">Preview</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Low Bitrate Songs', content, auth, 'content-quality', 0, { total: 0 }, { total: songs.length }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Missing Descriptions
  if (path === '/missing-descriptions') {
    const missing = await analyzer.findMissingDescriptions();
    const total = missing.songs.length + missing.albums.length + missing.playlists.length;
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/content-quality" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Missing Descriptions</h2>
        </div>
        
        ${total === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All items have descriptions.</p>
          </div>
        ` : `
          ${missing.songs.length > 0 && `
            <h3 style="margin: 15px 0 10px;">Songs (${missing.songs.length})</h3>
            <div class="mobile-cards">
              ${missing.songs.map(item => `
                <div class="mobile-card">
                  <div style="font-weight:600;">${item.title}</div>
                  <div style="font-size:0.8rem; color:#666; margin:5px 0;">${item.id}</div>
                  <a href="/admin/songs/edit?name=${item.id}" class="btn btn-primary btn-sm">Add Description</a>
                </div>
              `).join('')}
            </div>
          `}
          
          ${missing.albums.length > 0 && `
            <h3 style="margin: 15px 0 10px;">Albums (${missing.albums.length})</h3>
            <div class="mobile-cards">
              ${missing.albums.map(item => `
                <div class="mobile-card">
                  <div style="font-weight:600;">${item.title}</div>
                  <a href="/admin/albums/edit?id=${item.id}" class="btn btn-primary btn-sm">Add Description</a>
                </div>
              `).join('')}
            </div>
          `}
          
          ${missing.playlists.length > 0 && `
            <h3 style="margin: 15px 0 10px;">Playlists (${missing.playlists.length})</h3>
            <div class="mobile-cards">
              ${missing.playlists.map(item => `
                <div class="mobile-card">
                  <div style="font-weight:600;">${item.title}</div>
                  <a href="/admin/playlists/edit?id=${item.id}" class="btn btn-primary btn-sm">Add Description</a>
                </div>
              `).join('')}
            </div>
          `}
        `}
      </div>
    `;

    return new Response(adminLayout('Missing Descriptions', content, auth, 'content-quality', 0, { total: 0 }, { total: total }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Incomplete Artist Bios
  if (path === '/incomplete-bios') {
    const artists = await analyzer.findIncompleteArtistBios();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/content-quality" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Incomplete Artist Bios</h2>
        </div>
        
        ${artists.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All artists have complete profiles.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${artists.map(artist => `
              <div class="mobile-card">
                <div style="font-weight:600; margin-bottom:5px;">${artist.name}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:8px;">${artist.songCount} songs • ${artist.albumCount} albums</div>
                <div style="margin-bottom:10px;">
                  <div style="font-size:0.8rem; margin-bottom:5px;">Completeness Score: ${artist.score}%</div>
                  <div style="height:6px; background:#e8e8e8; border-radius:3px;">
                    <div style="width:${artist.score}%; height:6px; background:#ff5500; border-radius:3px;"></div>
                  </div>
                </div>
                <div style="margin-bottom:10px;">
                  ${artist.issues.map(issue => `
                    <span class="badge" style="background:#ff5500; color:white; margin-right:5px; margin-bottom:5px; display:inline-block;">${issue}</span>
                  `).join('')}
                </div>
                <a href="/admin/artists/edit?id=${artist.id}" class="btn btn-primary btn-sm">Edit Artist</a>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Incomplete Artist Bios', content, auth, 'content-quality', 0, { total: 0 }, { total: artists.length }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Albums Missing Years
  if (path === '/albums-missing-years') {
    const albums = await analyzer.findAlbumsMissingYears();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/content-quality" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Albums Missing Years</h2>
        </div>
        
        ${albums.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All albums have release years.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${albums.map(album => `
              <div class="mobile-card">
                <div style="font-weight:600; margin-bottom:5px;">${album.title}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:5px;">${album.artist}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:10px;">${album.songCount} songs</div>
                ${album.guessedYear ? `
                  <div style="background:#e8f5e9; padding:8px; border-radius:6px; margin-bottom:10px;">
                    <small>Suggested year: ${album.guessedYear}</small>
                  </div>
                ` : ''}
                <a href="/admin/albums/edit?id=${album.id}" class="btn btn-primary btn-sm">Add Year</a>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Albums Missing Years', content, auth, 'content-quality', 0, { total: 0 }, { total: albums.length }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Songs No Genre
  if (path === '/songs-no-genre') {
    const songs = await analyzer.findSongsNoGenre();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/content-quality" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Songs Missing Genre</h2>
        </div>
        
        ${songs.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All songs have genres.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${songs.map(song => `
              <div class="mobile-card">
                <div style="font-weight:600; margin-bottom:5px;">${song.title}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:5px;">${song.artist}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:10px;">${formatDuration(song.duration)}</div>
                <a href="/admin/songs/edit?name=${song.baseName}" class="btn btn-primary btn-sm">Add Genre</a>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Songs Missing Genre', content, auth, 'content-quality', 0, { total: 0 }, { total: songs.length }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Songs No Duration
  if (path === '/songs-no-duration') {
    const songs = await analyzer.findSongsNoDuration();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/content-quality" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Songs Missing Duration</h2>
        </div>
        
        ${songs.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All songs have duration info.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${songs.map(song => `
              <div class="mobile-card">
                <div style="font-weight:600; margin-bottom:5px;">${song.title}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:5px;">${song.artist}</div>
                <div style="background:#fff3cd; padding:8px; border-radius:6px; margin-bottom:10px;">
                  <small>Estimated duration: ${formatDuration(song.estimatedDuration * 60)}</small>
                </div>
                <a href="/admin/songs/edit?name=${song.baseName}" class="btn btn-primary btn-sm">Add Duration</a>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Songs Missing Duration', content, auth, 'content-quality', 0, { total: 0 }, { total: songs.length }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Artists No Image
  if (path === '/artists-no-image') {
    const artists = await analyzer.findArtistsNoImage();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/content-quality" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Artists Missing Profile Images</h2>
        </div>
        
        ${artists.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All artists have profile images.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${artists.map(artist => `
              <div class="mobile-card">
                <div style="font-weight:600; margin-bottom:5px;">${artist.name}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:8px;">${artist.songCount} songs • ${artist.albumCount} albums</div>
                <a href="/admin/artists/edit?id=${artist.id}" class="btn btn-primary btn-sm">Add Image</a>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Artists Missing Images', content, auth, 'content-quality', 0, { total: 0 }, { total: artists.length }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Albums No Thumbnail
  if (path === '/albums-no-thumbnail') {
    const albums = await analyzer.findAlbumsNoThumbnail();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/content-quality" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Albums Missing Thumbnails</h2>
        </div>
        
        ${albums.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All albums have thumbnails.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${albums.map(album => `
              <div class="mobile-card">
                <div style="font-weight:600; margin-bottom:5px;">${album.title}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:5px;">${album.artist}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:10px;">${album.songCount} songs</div>
                <a href="/admin/albums/edit?id=${album.id}" class="btn btn-primary btn-sm">Add Thumbnail</a>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Albums Missing Thumbnails', content, auth, 'content-quality', 0, { total: 0 }, { total: albums.length }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  return new Response('Not Found', { status: 404 });
}

// Local formatFileSize function
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}