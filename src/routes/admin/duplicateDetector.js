// src/routes/admin/duplicateDetector.js
import { DuplicateDetector } from '../../helpers/duplicateDetector.js';
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
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 1.5rem; margin-bottom: 15px;">
            <i class="fas fa-copy" style="color: #ff5500;"></i>
            Duplicate Detector
          </h2>
          <p style="color: #666; margin-bottom: 20px;">Find and merge duplicate artists, albums, playlists, and songs. Default threshold is 50% to catch common variations.</p>
        </div>

        <!-- Stats Cards - 2 per row layout -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px;">
          <!-- Artists Card -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-microphone" style="font-size: 2rem; opacity: 0.8;"></i>
              <div style="flex: 1;">
                <div style="font-size: 0.75rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">DUPLICATE ARTISTS</div>
                <div style="font-size: 2.2rem; font-weight: 700; line-height: 1.2;">${stats.total.artists}</div>
                <div style="font-size: 0.8rem; opacity: 0.8;">${stats.items.artists} duplicate items</div>
              </div>
            </div>
          </div>
          
          <!-- Albums Card -->
          <div style="background: linear-gradient(135deg, #ff5500, #ff8c00); color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-compact-disc" style="font-size: 2rem; opacity: 0.8;"></i>
              <div style="flex: 1;">
                <div style="font-size: 0.75rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">DUPLICATE ALBUMS</div>
                <div style="font-size: 2.2rem; font-weight: 700; line-height: 1.2;">${stats.total.albums}</div>
                <div style="font-size: 0.8rem; opacity: 0.8;">${stats.items.albums} duplicate items</div>
              </div>
            </div>
          </div>
          
          <!-- Playlists Card -->
          <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-list" style="font-size: 2rem; opacity: 0.8;"></i>
              <div style="flex: 1;">
                <div style="font-size: 0.75rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">DUPLICATE PLAYLISTS</div>
                <div style="font-size: 2.2rem; font-weight: 700; line-height: 1.2;">${stats.total.playlists}</div>
                <div style="font-size: 0.8rem; opacity: 0.8;">${stats.items.playlists} duplicate items</div>
              </div>
            </div>
          </div>
          
          <!-- Songs Card -->
          <div style="background: linear-gradient(135deg, #4a90e2, #357abd); color: white; padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <i class="fas fa-music" style="font-size: 2rem; opacity: 0.8;"></i>
              <div style="flex: 1;">
                <div style="font-size: 0.75rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">DUPLICATE SONGS</div>
                <div style="font-size: 2.2rem; font-weight: 700; line-height: 1.2;">${stats.total.songs}</div>
                <div style="font-size: 0.8rem; opacity: 0.8;">${stats.items.songs} duplicate items</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Scan Options - Mobile Friendly Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px;">
          <a href="/admin/duplicate-detector/scan?type=artists" class="scan-card">
            <i class="fas fa-microphone" style="font-size: 1.8rem; color: #667eea;"></i>
            <h3 style="font-size: 1rem; margin: 8px 0;">Artists</h3>
            <span class="badge" style="background: ${stats.total.artists > 0 ? '#ff5500' : '#28a745'}; color: white; display: inline-block; padding: 3px 8px; border-radius: 20px; font-size: 0.7rem;">
              ${stats.total.artists > 0 ? `${stats.total.artists} groups` : 'Clean'}
            </span>
          </a>
          
          <a href="/admin/duplicate-detector/scan?type=albums" class="scan-card">
            <i class="fas fa-compact-disc" style="font-size: 1.8rem; color: #ff5500;"></i>
            <h3 style="font-size: 1rem; margin: 8px 0;">Albums</h3>
            <span class="badge" style="background: ${stats.total.albums > 0 ? '#ff5500' : '#28a745'}; color: white; display: inline-block; padding: 3px 8px; border-radius: 20px; font-size: 0.7rem;">
              ${stats.total.albums > 0 ? `${stats.total.albums} groups` : 'Clean'}
            </span>
          </a>
          
          <a href="/admin/duplicate-detector/scan?type=playlists" class="scan-card">
            <i class="fas fa-list" style="font-size: 1.8rem; color: #28a745;"></i>
            <h3 style="font-size: 1rem; margin: 8px 0;">Playlists</h3>
            <span class="badge" style="background: ${stats.total.playlists > 0 ? '#ff5500' : '#28a745'}; color: white; display: inline-block; padding: 3px 8px; border-radius: 20px; font-size: 0.7rem;">
              ${stats.total.playlists > 0 ? `${stats.total.playlists} groups` : 'Clean'}
            </span>
          </a>
          
          <a href="/admin/duplicate-detector/scan?type=songs" class="scan-card">
            <i class="fas fa-music" style="font-size: 1.8rem; color: #4a90e2;"></i>
            <h3 style="font-size: 1rem; margin: 8px 0;">Songs</h3>
            <span class="badge" style="background: ${stats.total.songs > 0 ? '#ff5500' : '#28a745'}; color: white; display: inline-block; padding: 3px 8px; border-radius: 20px; font-size: 0.7rem;">
              ${stats.total.songs > 0 ? `${stats.total.songs} groups` : 'Clean'}
            </span>
          </a>
        </div>

        <!-- Threshold Settings - Mobile Optimized -->
        <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e8e8e8;">
          <h3 style="margin-bottom: 15px; font-size: 1.1rem;">
            <i class="fas fa-sliders-h" style="color: #ff5500;"></i> Scan Settings
          </h3>
          
          <form id="scanForm" action="/admin/duplicate-detector/scan" method="GET">
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600;">Entity Type</label>
              <select name="type" class="form-control" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;">
                <option value="artists">Artists</option>
                <option value="albums">Albums</option>
                <option value="playlists">Playlists</option>
                <option value="songs">Songs</option>
              </select>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600;">Similarity Threshold: <span id="thresholdValue" style="color: #ff5500;">0.50</span></label>
              <input type="range" id="threshold" name="threshold" min="0.3" max="1" step="0.05" value="0.5" 
                     oninput="document.getElementById('thresholdValue').textContent = parseFloat(this.value).toFixed(2)" 
                     style="width: 100%; height: 44px;">
              <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.7rem; color: #666;">
                <span>Loose (30%)</span>
                <span>Balanced (50%)</span>
                <span>Strict (100%)</span>
              </div>
              <p style="font-size: 0.8rem; color: #ff5500; margin-top: 8px; background: #fff3e0; padding: 8px; border-radius: 6px;">
                <i class="fas fa-info-circle"></i> 50% catches common variations like stage names and featuring artists
              </p>
            </div>
            
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 1rem;">
              <i class="fas fa-search"></i> Start Scan
            </button>
          </form>
        </div>

        <style>
          .scan-card {
            display: block;
            padding: 15px 10px;
            background: white;
            border-radius: 12px;
            text-decoration: none;
            color: #333;
            text-align: center;
            border: 1px solid #e8e8e8;
            transition: all 0.3s;
          }
          
          .scan-card:hover {
            border-color: #ff5500;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
          }
          
          @media (min-width: 768px) {
            .scan-card {
              padding: 20px;
            }
            
            .scan-card i {
              font-size: 2.2rem !important;
            }
            
            .scan-card h3 {
              font-size: 1.2rem !important;
            }
            
            /* On desktop, stats cards become 4 per row */
            .stats-grid {
              grid-template-columns: repeat(4, 1fr) !important;
            }
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
  const threshold = parseFloat(url.searchParams.get('threshold') || '0.5');
  const results = url.searchParams.get('results') === '1';
  
  const detector = new DuplicateDetector(env);
  
  // Show loading state if not results yet
  if (!results) {
    const loadingContent = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="width: 60px; height: 60px; margin: 0 auto 20px; border: 4px solid #f0f0f0; border-top-color: #ff5500; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <h3 style="margin-bottom: 10px;">Scanning for duplicate ${type}...</h3>
        <p style="color: #666;">This may take a moment</p>
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
        <div style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <a href="/admin/duplicate-detector" class="btn btn-secondary btn-sm" style="padding: 8px 12px;">
              <i class="fas fa-arrow-left"></i>
            </a>
            <h2 style="font-size: 1.3rem; margin:0;">${title}</h2>
          </div>
          <p style="color: #666; background: #f8f9fa; padding: 10px; border-radius: 8px;">
            <i class="fas fa-info-circle"></i> 
            Found ${duplicates.length} groups with ${totalDuplicates} potential duplicates
            (Threshold: ${Math.round(threshold * 100)}%)
          </p>
        </div>

        ${duplicates.length === 0 ? `
          <div class="empty-state" style="text-align: center; padding: 40px 20px;">
            <i class="fas fa-check-circle" style="font-size: 3rem; color: #28a745;"></i>
            <h3 style="margin: 15px 0 10px;">No Duplicates Found</h3>
            <p style="color: #666; margin-bottom: 20px;">No duplicate ${type} were found with ${Math.round(threshold * 100)}% threshold.</p>
            <a href="/admin/duplicate-detector" class="btn btn-primary">Try Different Settings</a>
          </div>
        ` : `
          <div class="duplicate-groups" style="display: flex; flex-direction: column; gap: 15px;">
            ${duplicates.map((group, index) => renderDuplicateGroupMobile(group, type, index)).join('')}
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
      <div class="empty-state" style="text-align: center; padding: 40px 20px;">
        <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #dc3545;"></i>
        <h3 style="margin: 15px 0 10px;">Scan Failed</h3>
        <p style="color: #666; margin-bottom: 20px;">${error.message}</p>
        <a href="/admin/duplicate-detector" class="btn btn-primary">Try Again</a>
      </div>
    `;
    
    return new Response(adminLayout('Scan Failed', errorContent, auth, 'duplicate-detector'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// ===== MERGE DUPLICATES =====
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

// Mobile-optimized duplicate group renderer with HORIZONTAL duplicate cards (no scrolling)
function renderDuplicateGroupMobile(group, type, index) {
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
        return `${primary.songCount || 0} songs • ${primary.albumCount || 0} albums`;
      case 'albums':
        return `${primary.songCount || 0} tracks`;
      case 'playlists':
        return `${primary.songCount || 0} songs`;
      case 'songs':
        return primary.duration ? formatDuration(primary.duration) : '';
      default:
        return '';
    }
  };

  const getDuplicateDetails = (dup) => {
    switch(type) {
      case 'artists':
        return `${dup.songCount || 0} songs`;
      case 'albums':
        return `${dup.songCount || 0} tracks`;
      case 'playlists':
        return `${dup.songCount || 0} songs`;
      case 'songs':
        return dup.duration ? formatDuration(dup.duration) : '';
      default:
        return '';
    }
  };

  return `
    <div class="duplicate-group" style="background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e8e8e8;">
      <!-- Primary Item -->
      <div style="background: #f8f9fa; padding: 15px; border-bottom: 2px solid #ff5500;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
          <i class="fas ${getTypeIcon()}" style="color: #ff5500; font-size: 1.2rem;"></i>
          <h4 style="font-size: 1.1rem; margin:0; flex:1;">${primary.name || primary.title}</h4>
          <span style="background: #ff5500; color: white; padding: 3px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600;">PRIMARY</span>
        </div>
        ${getPrimaryDetails() ? `<div style="font-size: 0.8rem; color: #666;">${getPrimaryDetails()}</div>` : ''}
      </div>
      
      <!-- Duplicates - HORIZONTAL LAYOUT (no scroll) -->
      <div style="padding: 15px;">
        <p style="font-size: 0.9rem; font-weight: 600; margin-bottom: 12px; color: #666;">
          <i class="fas fa-copy"></i> ${duplicates.length} Duplicates:
        </p>
        
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          ${duplicates.map(dup => `
            <div style="flex: 1 1 calc(50% - 5px); min-width: 140px; background: #f8f9fa; border-radius: 10px; padding: 12px; border-left: 4px solid ${dup.similarityScore > 0.8 ? '#28a745' : dup.similarityScore > 0.6 ? '#ffc107' : '#ff5500'};">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                <div style="font-weight: 600; font-size: 0.9rem; line-height: 1.3; max-width: 70%;">${dup.name || dup.title}</div>
                <span style="
                  background: ${dup.similarityScore > 0.8 ? '#d4edda' : dup.similarityScore > 0.6 ? '#fff3cd' : '#ff5500'};
                  color: ${dup.similarityScore > 0.8 ? '#155724' : dup.similarityScore > 0.6 ? '#856404' : 'white'};
                  padding: 2px 6px;
                  border-radius: 12px;
                  font-size: 0.65rem;
                  font-weight: 600;
                  white-space: nowrap;
                ">${Math.round(dup.similarityScore * 100)}%</span>
              </div>
              
              ${getDuplicateDetails(dup) ? `
                <div style="font-size: 0.75rem; color: #666; margin-bottom: 10px;">
                  ${getDuplicateDetails(dup)}
                </div>
              ` : ''}
              
              <div style="display: flex; gap: 5px; margin-top: 8px;">
                <a href="/admin/duplicate-detector/merge?type=${type}&primary=${primary.id}&duplicate=${dup.id}" 
                   class="btn btn-primary btn-sm" style="flex: 1; padding: 6px; font-size: 0.7rem;">
                  Merge
                </a>
                <button onclick="previewModal.show('${type.slice(0,-1)}', '${dup.id}')" 
                        class="btn btn-secondary btn-sm" style="flex: 1; padding: 6px; font-size: 0.7rem;">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
        
        <!-- Merge All Button -->
        ${duplicates.length > 1 ? `
          <a href="/admin/duplicate-detector/merge?type=${type}&primary=${primary.id}&${duplicates.map(d => `duplicate=${d.id}`).join('&')}" 
             class="btn btn-primary" style="display: block; text-align: center; padding: 12px; margin-top: 15px;">
            <i class="fas fa-compress-alt"></i> Merge All ${duplicates.length} Duplicates
          </a>
        ` : ''}
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