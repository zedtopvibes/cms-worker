// src/routes/admin/missingMetadata.js
import { MissingMetadataDetector } from '../../helpers/missingMetadataDetector.js';
import { getArtists, getMetadata } from '../../helpers/storage.js';  // Added getMetadata here!
import { adminLayout } from './layout.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';

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

    return new Response(adminLayout('Missing Metadata', content, auth, 'missing-metadata', 0, { total: 0 }, { total: totalIssues }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Songs missing info (with bulk assign)
  if (path === '/songs') {
    const songs = await detector.findSongsMissingInfo();
    const artists = await getArtists(env);
    
    // Build artist options for dropdown
    const artistOptions = Object.entries(artists).map(([id, artist]) => 
      `<option value="${id}">${artist.name} (${id})</option>`
    ).join('');

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
          <!-- Bulk Assign Bar -->
          <div style="background: #f8f9fa; border-radius: 12px; padding: 15px; margin-bottom: 20px; border: 1px solid #e0e0e0;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
              <i class="fas fa-tasks" style="color: #ff5500;"></i>
              <span style="font-weight: 600;">Bulk Assign:</span>
              <select id="bulkArtistSelect" class="form-control" style="width: auto; min-width: 200px; flex: 1;">
                <option value="">-- Select Artist --</option>
                ${artistOptions}
              </select>
              <button onclick="bulkAssign()" class="btn btn-primary">
                <i class="fas fa-check-double"></i> Assign to Selected
              </button>
              <button onclick="selectAll()" class="btn btn-secondary btn-sm">Select All</button>
              <button onclick="deselectAll()" class="btn btn-secondary btn-sm">Deselect All</button>
            </div>
            <p style="font-size:0.8rem; color:#666; margin-top:10px;">
              <i class="fas fa-info-circle"></i> Select songs below, then choose an artist to assign them all at once.
            </p>
          </div>

          <form id="bulkAssignForm" method="POST" action="/admin/missing-metadata/bulk-assign">
            <div class="mobile-cards">
              ${songs.map(song => `
                <div class="mobile-card" style="margin-bottom: 10px;">
                  <label style="display: flex; align-items: start; gap: 10px; cursor: pointer;">
                    <input type="checkbox" name="songIds" value="${song.baseName}" class="song-checkbox" style="margin-top: 3px;">
                    <div style="flex: 1;">
                      <div style="font-weight:600; margin-bottom:5px;">${song.title}</div>
                      <div style="font-size:0.8rem; color:#666; margin-bottom:8px;">${song.baseName}</div>
                      <div style="margin-bottom:8px;">
                        ${song.issues.map(issue => `
                          <span class="badge" style="background:#ff5500; color:white; margin-right:5px;">${issue}</span>
                        `).join('')}
                      </div>
                      <div style="font-size:0.8rem; color:#ff5500;">
                        Current Artist ID: <strong>${song.artistId}</strong>
                      </div>
                    </div>
                  </label>
                </div>
              `).join('')}
            </div>
            
            <!-- Hidden field for selected artist -->
            <input type="hidden" name="targetArtist" id="targetArtist">
          </form>

          <script>
            function selectAll() {
              document.querySelectorAll('.song-checkbox').forEach(cb => cb.checked = true);
            }
            
            function deselectAll() {
              document.querySelectorAll('.song-checkbox').forEach(cb => cb.checked = false);
            }
            
            function bulkAssign() {
              const selectedArtist = document.getElementById('bulkArtistSelect').value;
              const selectedSongs = document.querySelectorAll('.song-checkbox:checked');
              
              if (!selectedArtist) {
                alert('Please select an artist to assign to.');
                return;
              }
              
              if (selectedSongs.length === 0) {
                alert('Please select at least one song.');
                return;
              }
              
              if (confirm(\`Assign \${selectedSongs.length} song(s) to the selected artist?\`)) {
                document.getElementById('targetArtist').value = selectedArtist;
                document.getElementById('bulkAssignForm').submit();
              }
            }
          </script>
        `}
      </div>
    `;

    return new Response(adminLayout('Missing Song Info', content, auth, 'missing-metadata', 0, { total: 0 }, { total: songs.length }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Bulk assign handler - ENHANCED VERSION WITH DEBUGGING
if (path === '/bulk-assign' && req.method === 'POST') {
  const formData = await req.formData();
  const songIds = formData.getAll('songIds');
  const targetArtist = formData.get('targetArtist');
  
  console.log('Bulk assign request:', { songIds, targetArtist }); // Debug log
  
  if (!targetArtist || songIds.length === 0) {
    console.log('Missing target artist or song IDs');
    return new Response(null, {
      status: 302,
      headers: { Location: '/admin/missing-metadata/songs?error=invalid' }
    });
  }

  try {
    const artists = await getArtists(env);
    console.log('Available artists:', Object.keys(artists)); // Debug log
    
    // Verify target artist exists
    if (!artists[targetArtist]) {
      console.log(`Target artist ${targetArtist} not found in artists list`);
      throw new Error(`Selected artist "${targetArtist}" does not exist`);
    }

    const results = {
      success: [],
      failed: []
    };

    // Update each song's metadata
    for (const songId of songIds) {
      try {
        console.log(`Processing song: ${songId}`); // Debug log
        
        // Get existing metadata - FIX: Use correct path
        let meta = {};
        try {
          const metadataObj = await env.media.get(`metadata/${songId}.json`);
          if (metadataObj) {
            const metadataText = await metadataObj.text();
            meta = JSON.parse(metadataText);
            console.log(`Found existing metadata for ${songId}:`, meta);
          } else {
            console.log(`No metadata file found for ${songId}, creating new`);
          }
        } catch (e) {
          console.log(`Error reading metadata for ${songId}:`, e.message);
          // Continue with empty metadata
        }
        
        // Create updated metadata
        const updatedMeta = { 
          ...meta,
          title: meta?.title || songId.split('_').slice(1).join(' ') || songId,
          primaryArtist: targetArtist,
          featuredArtists: meta?.featuredArtists || []
        };
        
        console.log(`Saving updated metadata for ${songId}:`, updatedMeta); // Debug log
        
        // Save updated metadata back to R2
        await env.media.put(`metadata/${songId}.json`, JSON.stringify(updatedMeta, null, 2), {
          httpMetadata: { contentType: 'application/json' }
        });
        
        // Also try to update the song's own metadata if it exists in a different format
        try {
          // Some songs might have metadata embedded in a different location
          // This is optional and might fail
        } catch (e) {
          // Ignore
        }
        
        results.success.push(songId);
        console.log(`Successfully updated ${songId}`); // Debug log
      } catch (error) {
        console.error(`Failed to update song ${songId}:`, error);
        results.failed.push({ id: songId, error: error.message });
      }
    }

    // Log activity
    await logAdminActivity(env, auth.session.id, 'bulk-assign', 'songs', 
      `Bulk assigned ${results.success.length} songs to artist ${targetArtist}`);

    // Show results
    const content = `
      <div style="text-align: center; padding: 40px 20px;">
        <i class="fas fa-check-circle" style="font-size: 4rem; color: #28a745; margin-bottom: 20px;"></i>
        <h2 style="margin-bottom: 10px;">Bulk Assign Complete</h2>
        <p style="color: #666; margin-bottom: 20px;">
          Successfully updated ${results.success.length} songs<br>
          ${results.failed.length > 0 ? `
            <span style="color: #dc3545;">${results.failed.length} songs failed</span><br>
            ${results.failed.map(f => `<small>${f.id}: ${f.error}</small><br>`).join('')}
          ` : ''}
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <a href="/admin/missing-metadata/songs" class="btn btn-primary">
            Back to Missing Songs
          </a>
          <a href="/admin/missing-metadata" class="btn btn-secondary">
            Back to Dashboard
          </a>
        </div>
      </div>
    `;
    
    return new Response(adminLayout('Bulk Assign Results', content, auth, 'missing-metadata', 0, { total: 0 }, { total: 0 }), {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Bulk assign error:', error);
    const content = `
      <div style="text-align: center; padding: 40px 20px;">
        <i class="fas fa-exclamation-circle" style="font-size: 4rem; color: #dc3545; margin-bottom: 20px;"></i>
        <h2 style="margin-bottom: 10px;">Bulk Assign Failed</h2>
        <p style="color: #666; margin-bottom: 20px;">${error.message}</p>
        <a href="/admin/missing-metadata/songs" class="btn btn-primary">Try Again</a>
      </div>
    `;
    
    return new Response(adminLayout('Bulk Assign Failed', content, auth, 'missing-metadata', 0, { total: 0 }, { total: 0 }), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
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

    return new Response(adminLayout('Missing Thumbnails', content, auth, 'missing-metadata', 0, { total: 0 }, { total: songs.length }), {
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

    return new Response(adminLayout('Empty Albums', content, auth, 'missing-metadata', 0, { total: 0 }, { total: albums.length }), {
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

    return new Response(adminLayout('Empty Playlists', content, auth, 'missing-metadata', 0, { total: 0 }, { total: playlists.length }), {
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

    return new Response(adminLayout('Playlists Missing Thumbnails', content, auth, 'missing-metadata', 0, { total: 0 }, { total: playlists.length }), {
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

    return new Response(adminLayout('Orphaned Files', content, auth, 'missing-metadata', 0, { total: 0 }, { total: orphaned.total }), {
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
    
    return new Response(adminLayout('Cleanup Results', content, auth, 'missing-metadata', 0, { total: 0 }, { total: 0 }), {
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