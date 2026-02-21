// src/routes/admin/missingMetadata.js
import { MissingMetadataDetector } from '../../helpers/missingMetadataDetector.js';
import { adminLayout } from './layout.js';
import { formatFileSize } from '../../helpers/formatting.js';

export async function handleMissingMetadata(req, env, ctx, auth) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/admin/missing-metadata', '') || '/';
  
  const detector = new MissingMetadataDetector(env);

  // Main dashboard
  if (path === '/' || path === '') {
    const scan = await detector.scanAll();
    const totalIssues = scan.totals.songsMissingInfo + 
                        scan.totals.songsMissingThumbnails + 
                        scan.totals.emptyAlbums + 
                        scan.totals.emptyPlaylists + 
                        scan.totals.playlistsMissingThumbnails +
                        scan.totals.orphanedFiles;

    const content = `
      <div class="missing-metadata">
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 1.5rem; margin-bottom: 15px;">
            <i class="fas fa-exclamation-triangle" style="color: #ff5500;"></i>
            Missing Metadata Detector
          </h2>
          <p style="color: #666; margin-bottom: 20px;">Find and fix missing information, empty collections, and orphaned files.</p>
        </div>

        <!-- Summary Cards - 2 per row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px;">
          <div style="background: linear-gradient(135deg, #ff6b6b, #ff4757); color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-music" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">SONGS MISSING INFO</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.songsMissingInfo}</div>
              </div>
            </div>
          </div>
          
          <div style="background: linear-gradient(135deg, #ffa502, #ff7f50); color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-image" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">MISSING THUMBNAILS</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.songsMissingThumbnails}</div>
              </div>
            </div>
          </div>
          
          <div style="background: linear-gradient(135deg, #ff6b81, #ff4757); color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-compact-disc" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">EMPTY ALBUMS</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.emptyAlbums}</div>
              </div>
            </div>
          </div>
          
          <div style="background: linear-gradient(135deg, #70a1ff, #1e90ff); color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-list" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">EMPTY PLAYLISTS</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.emptyPlaylists}</div>
              </div>
            </div>
          </div>
          
          <div style="background: linear-gradient(135deg, #7bed9f, #2ed573); color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-list" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">PLAYLISTS NO THUMB</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.playlistsMissingThumbnails}</div>
              </div>
            </div>
          </div>
          
          <div style="background: linear-gradient(135deg, #ffb142, #cc8e34); color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-trash-alt" style="font-size: 2rem; opacity: 0.8;"></i>
              <div>
                <div style="font-size: 0.75rem; opacity: 0.9;">ORPHANED FILES</div>
                <div style="font-size: 2rem; font-weight: 700;">${scan.totals.orphanedFiles}</div>
                <div style="font-size: 0.7rem;">${formatFileSize(scan.totals.orphanedSize)}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 25px;">
          <a href="/admin/missing-metadata/songs" class="action-card">
            <i class="fas fa-music" style="color: #ff6b6b;"></i>
            <h3>Songs Missing Info</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.songsMissingInfo}</span>
          </a>
          
          <a href="/admin/missing-metadata/thumbnails" class="action-card">
            <i class="fas fa-image" style="color: #ffa502;"></i>
            <h3>Missing Thumbnails</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.songsMissingThumbnails}</span>
          </a>
          
          <a href="/admin/missing-metadata/empty-albums" class="action-card">
            <i class="fas fa-compact-disc" style="color: #ff6b81;"></i>
            <h3>Empty Albums</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.emptyAlbums}</span>
          </a>
          
          <a href="/admin/missing-metadata/empty-playlists" class="action-card">
            <i class="fas fa-list" style="color: #70a1ff;"></i>
            <h3>Empty Playlists</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.emptyPlaylists}</span>
          </a>
          
          <a href="/admin/missing-metadata/playlist-thumbnails" class="action-card">
            <i class="fas fa-list" style="color: #7bed9f;"></i>
            <h3>Playlists Missing Thumb</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.playlistsMissingThumbnails}</span>
          </a>
          
          <a href="/admin/missing-metadata/orphaned" class="action-card">
            <i class="fas fa-trash-alt" style="color: #ffb142;"></i>
            <h3>Orphaned Files</h3>
            <span class="badge" style="background: #ff5500;">${scan.totals.orphanedFiles}</span>
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

    return new Response(adminLayout('Missing Metadata', content, auth, 'missing-metadata', 0, { total: totalIssues }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Songs missing info
  if (path === '/songs') {
    const songs = await detector.findSongsMissingInfo();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/missing-metadata" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Songs Missing Information</h2>
        </div>
        
        ${songs.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All songs have proper metadata.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${songs.map(song => `
              <div class="mobile-card">
                <div style="font-weight:600; margin-bottom:5px;">${song.title}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:8px;">${song.baseName}</div>
                <div style="margin-bottom:8px;">
                  ${song.issues.map(issue => `
                    <span class="badge" style="background:#ff5500; color:white; margin-right:5px;">${issue}</span>
                  `).join('')}
                </div>
                <div style="display:flex; gap:8px;">
                  <a href="/admin/songs/edit?name=${song.baseName}" class="btn btn-primary btn-sm" style="flex:1;">Edit</a>
                  <button onclick="previewModal.show('song', '${song.baseName}')" class="btn btn-secondary btn-sm">Preview</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Missing Song Info', content, auth, 'missing-metadata'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Missing thumbnails
  if (path === '/thumbnails') {
    const songs = await detector.findSongsMissingThumbnails();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/missing-metadata" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Songs Missing Thumbnails</h2>
        </div>
        
        ${songs.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All songs have thumbnails.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${songs.map(song => `
              <div class="mobile-card">
                <div style="font-weight:600; margin-bottom:5px;">${song.title}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:8px;">${song.baseName}</div>
                <div style="display:flex; gap:8px;">
                  <a href="/admin/upload?fix=${song.baseName}" class="btn btn-primary btn-sm" style="flex:1;">Upload Thumb</a>
                  <button onclick="previewModal.show('song', '${song.baseName}')" class="btn btn-secondary btn-sm">Preview</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Missing Thumbnails', content, auth, 'missing-metadata'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Empty albums
  if (path === '/empty-albums') {
    const albums = await detector.findEmptyAlbums();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/missing-metadata" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Empty Albums</h2>
        </div>
        
        ${albums.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All albums have songs.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${albums.map(album => `
              <div class="mobile-card">
                <div style="font-weight:600; margin-bottom:5px;">${album.title}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:8px;">Created: ${new Date(album.created).toLocaleDateString()}</div>
                <div style="display:flex; gap:8px;">
                  <a href="/admin/albums/delete?id=${album.id}" class="btn btn-danger btn-sm" style="flex:1;" onclick="return confirm('Delete this empty album?')">Delete</a>
                  <a href="/admin/albums/edit?id=${album.id}" class="btn btn-primary btn-sm" style="flex:1;">Edit</a>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Empty Albums', content, auth, 'missing-metadata'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Empty playlists
  if (path === '/empty-playlists') {
    const playlists = await detector.findEmptyPlaylists();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/missing-metadata" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Empty Playlists</h2>
        </div>
        
        ${playlists.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All playlists have songs.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${playlists.map(playlist => `
              <div class="mobile-card">
                <div style="font-weight:600; margin-bottom:5px;">${playlist.title}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:8px;">Curator: ${playlist.curator}</div>
                <div style="display:flex; gap:8px;">
                  <a href="/admin/playlists/delete?id=${playlist.id}" class="btn btn-danger btn-sm" style="flex:1;" onclick="return confirm('Delete this empty playlist?')">Delete</a>
                  <a href="/admin/playlists/songs?id=${playlist.id}" class="btn btn-primary btn-sm" style="flex:1;">Add Songs</a>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Empty Playlists', content, auth, 'missing-metadata'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Playlists missing thumbnails
  if (path === '/playlist-thumbnails') {
    const playlists = await detector.findPlaylistsMissingThumbnails();
    
    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/missing-metadata" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Playlists Missing Thumbnails</h2>
        </div>
        
        ${playlists.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No issues found</h3>
            <p>All playlists have thumbnails.</p>
          </div>
        ` : `
          <div class="mobile-cards">
            ${playlists.map(playlist => `
              <div class="mobile-card">
                <div style="font-weight:600; margin-bottom:5px;">${playlist.title}</div>
                <div style="font-size:0.8rem; color:#666; margin-bottom:8px;">${playlist.songCount} songs</div>
                <a href="/admin/playlists/edit?id=${playlist.id}" class="btn btn-primary btn-sm">Add Thumbnail</a>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Playlists Missing Thumbnails', content, auth, 'missing-metadata'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Orphaned files
  if (path === '/orphaned') {
    const orphaned = await detector.findOrphanedFiles();
    const allOrphanedKeys = [
      ...orphaned.images.map(f => f.key),
      ...orphaned.metadata.map(f => f.key),
      ...orphaned.descriptions.map(f => f.key),
      ...orphaned.other.map(f => f.key)
    ];

    const content = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <a href="/admin/missing-metadata" class="btn btn-secondary btn-sm">
            <i class="fas fa-arrow-left"></i>
          </a>
          <h2 style="font-size: 1.3rem;">Orphaned Files</h2>
          <span style="margin-left: auto; background: #ff5500; color: white; padding: 5px 10px; border-radius: 20px; font-size: 0.8rem;">
            ${formatFileSize(orphaned.totalSize)}
          </span>
        </div>
        
        ${orphaned.total === 0 ? `
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color: #28a745; font-size: 3rem;"></i>
            <h3>No orphaned files found</h3>
            <p>Your R2 storage is clean!</p>
          </div>
        ` : `
          <form id="cleanupForm" method="POST" action="/admin/missing-metadata/cleanup">
            <div style="margin-bottom: 20px;">
              <button type="button" onclick="selectAll()" class="btn btn-secondary btn-sm">Select All</button>
              <button type="button" onclick="deselectAll()" class="btn btn-secondary btn-sm">Deselect All</button>
              <button type="submit" class="btn btn-danger btn-sm" style="float: right;" onclick="return confirm('Delete selected orphaned files?')">
                <i class="fas fa-trash"></i> Delete Selected
              </button>
            </div>

            ${orphaned.images.length > 0 && `
              <h3 style="margin: 15px 0 10px;">Orphaned Images (${orphaned.images.length})</h3>
              ${orphaned.images.map(file => `
                <div class="mobile-card" style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" name="files" value="${file.key}">
                    <div style="flex:1;">
                      <div style="font-size:0.8rem;">${file.key}</div>
                      <div style="font-size:0.7rem; color:#666;">${formatFileSize(file.size)} • ${new Date(file.lastModified).toLocaleDateString()}</div>
                    </div>
                  </label>
                </div>
              `).join('')}
            `}

            ${orphaned.metadata.length > 0 && `
              <h3 style="margin: 15px 0 10px;">Orphaned Metadata (${orphaned.metadata.length})</h3>
              ${orphaned.metadata.map(file => `
                <div class="mobile-card" style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" name="files" value="${file.key}">
                    <div style="flex:1;">
                      <div style="font-size:0.8rem;">${file.key}</div>
                      <div style="font-size:0.7rem; color:#666;">${formatFileSize(file.size)}</div>
                    </div>
                  </label>
                </div>
              `).join('')}
            `}

            ${orphaned.descriptions.length > 0 && `
              <h3 style="margin: 15px 0 10px;">Orphaned Descriptions (${orphaned.descriptions.length})</h3>
              ${orphaned.descriptions.map(file => `
                <div class="mobile-card" style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" name="files" value="${file.key}">
                    <div style="flex:1;">
                      <div style="font-size:0.8rem;">${file.key}</div>
                      <div style="font-size:0.7rem; color:#666;">${formatFileSize(file.size)}</div>
                    </div>
                  </label>
                </div>
              `).join('')}
            `}

            ${orphaned.other.length > 0 && `
              <h3 style="margin: 15px 0 10px;">Other Orphaned Files (${orphaned.other.length})</h3>
              ${orphaned.other.map(file => `
                <div class="mobile-card" style="margin-bottom: 8px;">
                  <label style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" name="files" value="${file.key}">
                    <div style="flex:1;">
                      <div style="font-size:0.8rem;">${file.key}</div>
                      <div style="font-size:0.7rem; color:#666;">${formatFileSize(file.size)}</div>
                    </div>
                  </label>
                </div>
              `).join('')}
            `}
          </form>

          <script>
            function selectAll() {
              document.querySelectorAll('input[name="files"]').forEach(cb => cb.checked = true);
            }
            function deselectAll() {
              document.querySelectorAll('input[name="files"]').forEach(cb => cb.checked = false);
            }
          </script>
        `}
      </div>
    `;

    return new Response(adminLayout('Orphaned Files', content, auth, 'missing-metadata'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Cleanup orphaned files
  if (path === '/cleanup' && req.method === 'POST') {
    const formData = await req.formData();
    const filesToDelete = formData.getAll('files');
    
    const detector = new MissingMetadataDetector(env);
    const results = await detector.deleteOrphanedFiles(filesToDelete);
    
    const content = `
      <div style="text-align: center; padding: 40px 20px;">
        <i class="fas fa-check-circle" style="font-size: 4rem; color: #28a745; margin-bottom: 20px;"></i>
        <h2 style="margin-bottom: 10px;">Cleanup Complete</h2>
        <p style="color: #666; margin-bottom: 20px;">
          Successfully deleted ${results.success.length} files<br>
          ${results.failed.length > 0 ? `${results.failed.length} files failed` : ''}
        </p>
        <a href="/admin/missing-metadata" class="btn btn-primary">Back to Dashboard</a>
      </div>
    `;
    
    return new Response(adminLayout('Cleanup Results', content, auth, 'missing-metadata'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  return new Response('Not Found', { status: 404 });
}