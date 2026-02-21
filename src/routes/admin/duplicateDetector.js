// src/routes/admin/duplicateDetector.js
import { DuplicateDetector } from '../../helpers/duplicateDetector.js';
import { formatNumber } from '../../helpers/formatting.js';
import { adminLayout } from './layout.js';

// ===== DUPLICATE DETECTOR DASHBOARD =====
export async function handleDuplicateDetector(req, env, ctx, auth) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/admin/duplicate-detector', '') || '/';
  
  const detector = new DuplicateDetector(env);

  // Main dashboard
  if (path === '/' || path === '') {
    const stats = await detector.getDuplicateStats();
    
    const content = `
      <div class="duplicate-detector">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
          <h2 style="font-size: 1.5rem; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-copy" style="color: #ff5500;"></i>
            Duplicate Detector
          </h2>
        </div>

        <!-- Stats Cards -->
        <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px;">
          <div class="stat-card" style="padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <h3 style="color: rgba(255,255,255,0.9); font-size: 0.8rem;">DUPLICATE ARTISTS</h3>
            <div style="font-size: 2rem; font-weight: 700;">${stats.total.artists}</div>
            <div style="font-size: 0.8rem;">${stats.items.artists} duplicate items</div>
          </div>
          
          <div class="stat-card" style="padding: 15px; background: linear-gradient(135deg, #ff5500, #ff8c00); color: white;">
            <h3 style="color: rgba(255,255,255,0.9); font-size: 0.8rem;">DUPLICATE ALBUMS</h3>
            <div style="font-size: 2rem; font-weight: 700;">${stats.total.albums}</div>
            <div style="font-size: 0.8rem;">${stats.items.albums} duplicate items</div>
          </div>
          
          <div class="stat-card" style="padding: 15px; background: linear-gradient(135deg, #28a745, #20c997); color: white;">
            <h3 style="color: rgba(255,255,255,0.9); font-size: 0.8rem;">DUPLICATE PLAYLISTS</h3>
            <div style="font-size: 2rem; font-weight: 700;">${stats.total.playlists}</div>
            <div style="font-size: 0.8rem;">${stats.items.playlists} duplicate items</div>
          </div>
          
          <div class="stat-card" style="padding: 15px; background: linear-gradient(135deg, #4a90e2, #357abd); color: white;">
            <h3 style="color: rgba(255,255,255,0.9); font-size: 0.8rem;">DUPLICATE SONGS</h3>
            <div style="font-size: 2rem; font-weight: 700;">${stats.total.songs}</div>
            <div style="font-size: 0.8rem;">${stats.items.songs} duplicate items</div>
          </div>
        </div>

        <!-- Scan Options -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
          <a href="/admin/duplicate-detector/scan?type=artists" class="scan-card">
            <i class="fas fa-microphone" style="font-size: 2rem; color: #667eea;"></i>
            <h3>Artists</h3>
            <p>Find artists with similar names</p>
            ${stats.total.artists > 0 ? 
              `<span class="badge" style="background: #ff5500; color: white;">${stats.total.artists} groups</span>` : 
              '<span class="badge" style="background: #28a745; color: white;">Clean</span>'}
          </a>
          
          <a href="/admin/duplicate-detector/scan?type=albums" class="scan-card">
            <i class="fas fa-compact-disc" style="font-size: 2rem; color: #ff5500;"></i>
            <h3>Albums</h3>
            <p>Find duplicate albums by same artist</p>
            ${stats.total.albums > 0 ? 
              `<span class="badge" style="background: #ff5500; color: white;">${stats.total.albums} groups</span>` : 
              '<span class="badge" style="background: #28a745; color: white;">Clean</span>'}
          </a>
          
          <a href="/admin/duplicate-detector/scan?type=playlists" class="scan-card">
            <i class="fas fa-list" style="font-size: 2rem; color: #28a745;"></i>
            <h3>Playlists</h3>
            <p>Find playlists with same songs</p>
            ${stats.total.playlists > 0 ? 
              `<span class="badge" style="background: #ff5500; color: white;">${stats.total.playlists} groups</span>` : 
              '<span class="badge" style="background: #28a745; color: white;">Clean</span>'}
          </a>
          
          <a href="/admin/duplicate-detector/scan?type=songs" class="scan-card">
            <i class="fas fa-music" style="font-size: 2rem; color: #4a90e2;"></i>
            <h3>Songs</h3>
            <p>Find duplicate songs by title/artist</p>
            ${stats.total.songs > 0 ? 
              `<span class="badge" style="background: #ff5500; color: white;">${stats.total.songs} groups</span>` : 
              '<span class="badge" style="background: #28a745; color: white;">Clean</span>'}
          </a>
        </div>

        <!-- Threshold Settings -->
        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 25px; border: 1px solid #e8e8e8;">
          <h3 style="margin-bottom: 15px;"><i class="fas fa-sliders-h" style="color: #ff5500;"></i> Scan Settings</h3>
          
          <form id="scanForm" action="/admin/duplicate-detector/scan" method="GET">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
              <div class="form-group">
                <label>Entity Type</label>
                <select name="type" class="form-control" id="scanType">
                  <option value="artists">Artists</option>
                  <option value="albums">Albums</option>
                  <option value="playlists">Playlists</option>
                  <option value="songs">Songs</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>Similarity Threshold</label>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <input type="range" id="threshold" name="threshold" min="0.5" max="1" step="0.05" value="0.85" 
                         oninput="document.getElementById('thresholdValue').textContent = this.value" style="flex: 1;">
                  <span id="thresholdValue" style="min-width: 45px; font-weight: 600; color: #ff5500;">0.85</span>
                </div>
                <p style="font-size: 0.7rem; color: #666; margin-top: 5px;">Higher = stricter matching</p>
              </div>
            </div>
            
            <button type="submit" class="btn btn-primary" style="margin-top: 15px;">
              <i class="fas fa-search"></i> Start Scan
            </button>
          </form>
        </div>

        <style>
          .scan-card {
            display: block;
            padding: 20px;
            background: white;
            border-radius: 12px;
            text-decoration: none;
            color: #333;
            text-align: center;
            border: 2px solid transparent;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          
          .scan-card:hover {
            border-color: #ff5500;
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
          }
          
          .scan-card h3 {
            margin: 15px 0 10px;
            font-size: 1.2rem;
          }
          
          .scan-card p {
            font-size: 0.8rem;
            color: #666;
            margin-bottom: 15px;
          }
        </style>
      </div>
    `;

    return new Response(adminLayout('Duplicate Detector', content, auth, 'duplicate-detector'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  return new Response('Not Found', { status: 404 });
}

// ===== SCAN FOR DUPLICATES =====
export async function handleDuplicateDetectorScan(req, env, ctx, auth) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'artists';
  const threshold = parseFloat(url.searchParams.get('threshold') || '0.85');
  const results = url.searchParams.get('results') === '1';
  
  const detector = new DuplicateDetector(env);
  
  // Show loading state if not results yet
  if (!results) {
    const loadingContent = `
      <div style="text-align: center; padding: 60px 20px;">
        <div style="width: 80px; height: 80px; margin: 0 auto 20px; border: 4px solid #f0f0f0; border-top-color: #ff5500; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <h3 style="margin-bottom: 10px;">Scanning for duplicate ${type}...</h3>
        <p style="color: #666;">This may take a moment depending on your library size</p>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        <meta http-equiv="refresh" content="2;url=/admin/duplicate-detector/scan?type=${type}&threshold=${threshold}&results=1">
      </div>
    `;
    
    return new Response(adminLayout('Scanning...', loadingContent, auth, 'duplicate-detector'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Actually perform the scan
  try {
    let duplicates = [];
    let title = '';

    switch(type) {
      case 'artists':
        duplicates = await detector.findDuplicateArtists({ threshold });
        title = 'Duplicate Artists';
        break;
      case 'albums':
        duplicates = await detector.findDuplicateAlbums({ threshold });
        title = 'Duplicate Albums';
        break;
      case 'playlists':
        duplicates = await detector.findDuplicatePlaylists({ threshold });
        title = 'Duplicate Playlists';
        break;
      case 'songs':
        duplicates = await detector.findDuplicateSongs({ threshold });
        title = 'Duplicate Songs';
        break;
    }

    const totalDuplicates = duplicates.reduce((sum, g) => sum + g.duplicates.length, 0);

    const content = `
      <div class="scan-results">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
          <div>
            <h2 style="font-size: 1.5rem;">
              <i class="fas fa-search"></i> ${title}
            </h2>
            <p style="color: #666; margin-top: 5px;">
              Found ${duplicates.length} groups with ${totalDuplicates} potential duplicates
              (Threshold: ${Math.round(threshold * 100)}%)
            </p>
          </div>
          <a href="/admin/duplicate-detector" class="btn btn-secondary">
            <i class="fas fa-arrow-left"></i> Back
          </a>
        </div>

        ${duplicates.length === 0 ? `
          <div class="empty-state" style="text-align: center; padding: 60px 20px;">
            <i class="fas fa-check-circle" style="font-size: 4rem; color: #28a745;"></i>
            <h3 style="margin: 20px 0 10px;">No Duplicates Found</h3>
            <p style="color: #666;">No duplicate ${type} were found with the current threshold.</p>
            <a href="/admin/duplicate-detector" class="btn btn-primary" style="margin-top: 20px;">
              Try Different Settings
            </a>
          </div>
        ` : `
          <div class="duplicate-groups">
            ${duplicates.map((group, index) => renderDuplicateGroup(group, type, index)).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(adminLayout('Scan Results', content, auth, 'duplicate-detector'), {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    console.error('Scan error:', error);
    const errorContent = `
      <div class="empty-state" style="text-align: center; padding: 60px 20px;">
        <i class="fas fa-exclamation-circle" style="font-size: 4rem; color: #dc3545;"></i>
        <h3 style="margin: 20px 0 10px;">Scan Failed</h3>
        <p style="color: #666;">${error.message}</p>
        <a href="/admin/duplicate-detector" class="btn btn-primary" style="margin-top: 20px;">
          Try Again
        </a>
      </div>
    `;
    
    return new Response(adminLayout('Scan Failed', errorContent, auth, 'duplicate-detector'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// ===== MERGE DUPLICATES (Redirects to appropriate page) =====
export async function handleDuplicateDetectorMerge(req, env, ctx, auth) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const primaryId = url.searchParams.get('primary');
  const duplicateIds = url.searchParams.getAll('duplicate');

  if (!type || !primaryId || duplicateIds.length === 0) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/admin/duplicate-detector?error=missing_params' }
    });
  }

  // Build the redirect URL based on type
  let redirectUrl = '';
  switch(type) {
    case 'artists':
      redirectUrl = `/admin/artists/merge?primary=${primaryId}&duplicate=${duplicateIds.join('&duplicate=')}`;
      break;
    case 'albums':
      // You can add album merge functionality later
      redirectUrl = `/admin/albums?highlight=${primaryId}`;
      break;
    case 'playlists':
      redirectUrl = `/admin/playlists?highlight=${primaryId}`;
      break;
    case 'songs':
      redirectUrl = `/admin/songs?highlight=${primaryId}`;
      break;
  }

  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl }
  });
}

// Helper function to render duplicate groups
function renderDuplicateGroup(group, type, index) {
  const primary = group.primary;
  const duplicates = group.duplicates;

  const getTypeIcon = () => {
    switch(type) {
      case 'artists': return 'fa-microphone';
      case 'albums': return 'fa-compact-disc';
      case 'playlists': return 'fa-list';
      case 'songs': return 'fa-music';
      default: return 'fa-copy';
    }
  };

  const getPrimaryDetails = () => {
    switch(type) {
      case 'artists':
        return `
          <div style="display: flex; gap: 15px; font-size: 0.8rem; color: #666;">
            <span><i class="fas fa-music"></i> ${primary.songCount || 0} songs</span>
            <span><i class="fas fa-compact-disc"></i> ${primary.albumCount || 0} albums</span>
          </div>
        `;
      case 'albums':
        return `
          <div style="display: flex; gap: 15px; font-size: 0.8rem; color: #666;">
            <span><i class="fas fa-user"></i> ${primary.primaryArtist}</span>
            <span><i class="fas fa-list"></i> ${primary.songCount || 0} tracks</span>
          </div>
        `;
      case 'playlists':
        return `
          <div style="display: flex; gap: 15px; font-size: 0.8rem; color: #666;">
            <span><i class="fas fa-user"></i> ${primary.curator}</span>
            <span><i class="fas fa-music"></i> ${primary.songCount || 0} songs</span>
          </div>
        `;
      case 'songs':
        return `
          <div style="display: flex; gap: 15px; font-size: 0.8rem; color: #666;">
            <span><i class="fas fa-user"></i> ${primary.artistName}</span>
            ${primary.duration ? `<span><i class="fas fa-clock"></i> ${formatDuration(primary.duration)}</span>` : ''}
          </div>
        `;
      default:
        return '';
    }
  };

  return `
    <div class="duplicate-group" style="margin-bottom: 20px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e8e8e8;">
      <div style="background: #f8f9fa; padding: 15px 20px; border-bottom: 1px solid #e8e8e8;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h4 style="font-size: 1.1rem; margin-bottom: 5px;">
              <i class="fas ${getTypeIcon()}" style="color: #ff5500;"></i>
              Primary: ${primary.name || primary.title}
            </h4>
            ${getPrimaryDetails()}
          </div>
          <a href="/admin/duplicate-detector/merge?type=${type}&primary=${primary.id}&${duplicates.map(d => `duplicate=${d.id}`).join('&')}" 
             class="btn btn-primary btn-sm">
            <i class="fas fa-compress-alt"></i> Merge Group
          </a>
        </div>
      </div>
      
      <div style="padding: 15px;">
        <h5 style="margin-bottom: 10px; color: #666;">Potential Duplicates (${duplicates.length}):</h5>
        
        <!-- Mobile view for duplicates -->
        <div class="mobile-cards">
          ${duplicates.map(dup => `
            <div class="mobile-card" style="margin-bottom: 8px;">
              <div style="font-weight: 600; margin-bottom: 5px;">${dup.name || dup.title}</div>
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                <span>Similarity: ${Math.round(dup.similarityScore * 100)}%</span>
                <span class="similarity-badge" style="
                  padding: 2px 6px;
                  border-radius: 12px;
                  background: ${dup.similarityScore > 0.9 ? '#d4edda' : '#fff3cd'};
                  color: ${dup.similarityScore > 0.9 ? '#155724' : '#856404'};
                ">${Math.round(dup.similarityScore * 100)}%</span>
              </div>
            </div>
          `).join('')}
        </div>
        
        <!-- Desktop table for duplicates -->
        <div class="table-responsive">
          <table class="admin-table" style="min-width: auto;">
            <thead>
              <tr>
                <th style="padding: 8px;">Name/Title</th>
                <th style="padding: 8px;">Details</th>
                <th style="padding: 8px; text-align: center;">Similarity</th>
                <th style="padding: 8px;">Match Reasons</th>
              </tr>
            </thead>
            <tbody>
              ${duplicates.map(dup => `
                <tr>
                  <td style="padding: 8px; font-weight: 600;">${dup.name || dup.title}</td>
                  <td style="padding: 8px; font-size: 0.8rem; color: #666;">
                    ${type === 'artists' ? `${dup.songCount || 0} songs` : ''}
                    ${type === 'albums' ? dup.primaryArtist : ''}
                    ${type === 'playlists' ? dup.curator : ''}
                    ${type === 'songs' ? dup.artistName : ''}
                  </td>
                  <td style="padding: 8px; text-align: center;">
                    <span class="similarity-badge" style="
                      padding: 3px 8px;
                      border-radius: 20px;
                      background: ${dup.similarityScore > 0.9 ? '#d4edda' : dup.similarityScore > 0.7 ? '#fff3cd' : '#f8d7da'};
                      color: ${dup.similarityScore > 0.9 ? '#155724' : dup.similarityScore > 0.7 ? '#856404' : '#721c24'};
                      font-weight: 600;
                    ">
                      ${Math.round(dup.similarityScore * 100)}%
                    </span>
                  </td>
                  <td style="padding: 8px;">
                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                      ${dup.reasons ? dup.reasons.map(reason => `
                        <span style="
                          padding: 2px 6px;
                          background: #e8e8e8;
                          border-radius: 12px;
                          font-size: 0.7rem;
                          color: #666;
                        ">
                          ${reason.factor}: ${Math.round(reason.score * 100)}%
                        </span>
                      `).join('') : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// Helper function for formatting duration
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}