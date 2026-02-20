// ==================== ADMIN ARTISTS MANAGEMENT ====================
import { getArtists, saveArtists, getAlbums } from '../../helpers/storage.js';
import { getAggregatedStats } from '../../helpers/db.js';
import { getPageViews } from '../../helpers/pageViews.js';
import { sanitize, formatNumber } from '../../helpers/formatting.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';
import { moveToTrash } from '../../helpers/trash.js';  // ADD THIS IMPORT

// ===== LIST ALL ARTISTS =====
export async function handleAdminArtists(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') || '';
  const sort = url.searchParams.get('sort') || 'name';
  const ITEMS_PER_PAGE = 20;

  // Get all artists
  const artists = await getArtists(env);
  const albums = await getAlbums(env);
  
  // Get detailed artist data with views
  let artistsData = await Promise.all(
    Object.entries(artists).map(async ([id, artist]) => {
      const stats = await getAggregatedStats(artist.songs || [], env);
      const pageViews = await getPageViews(env, 'artist', id);
      
      // Get album count
      const albumCount = artist.albums?.length || 0;
      
      // Get monthly listeners (estimate based on plays)
      const monthlyListeners = Math.floor(stats.plays * 0.3);
      
      return {
        id,
        name: artist.name,
        description: artist.description || '',
        genre: artist.genre || 'Various',
        thumbnail: artist.thumbnail,
        songCount: artist.songs?.length || 0,
        albumCount,
        plays: stats.plays,
        downloads: stats.downloads,
        views: pageViews,
        monthlyListeners,
        created: artist.created,
        hasImage: !!artist.thumbnail
      };
    })
  );

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    artistsData = artistsData.filter(artist => 
      artist.name.toLowerCase().includes(searchLower) ||
      artist.genre.toLowerCase().includes(searchLower) ||
      artist.description.toLowerCase().includes(searchLower)
    );
  }

  // Apply sorting with views
  artistsData.sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'songs':
        return b.songCount - a.songCount;
      case 'albums':
        return b.albumCount - a.albumCount;
      case 'plays':
        return b.plays - a.plays;
      case 'listeners':
        return b.monthlyListeners - a.monthlyListeners;
      case 'views':
        return (b.views || 0) - (a.views || 0);
      case 'date':
        return b.created - a.created;
      default:
        return a.name.localeCompare(b.name);
    }
  });

  // Pagination
  const totalArtists = artistsData.length;
  const totalPages = Math.ceil(totalArtists / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const pageArtists = artistsData.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Sort options with views
  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'songs', label: 'Most Songs' },
    { value: 'albums', label: 'Most Albums' },
    { value: 'plays', label: 'Most Plays' },
    { value: 'listeners', label: 'Monthly Listeners' },
    { value: 'views', label: 'Most Viewed' },
    { value: 'date', label: 'Date Added' }
  ];

  // Calculate totals
  const totalSongs = artistsData.reduce((acc, a) => acc + a.songCount, 0);
  const totalAlbums = artistsData.reduce((acc, a) => acc + a.albumCount, 0);
  const totalPlays = artistsData.reduce((acc, a) => acc + a.plays, 0);
  const totalDownloads = artistsData.reduce((acc, a) => acc + a.downloads, 0);
  const totalViews = artistsData.reduce((acc, a) => acc + (a.views || 0), 0);
  const totalListeners = artistsData.reduce((acc, a) => acc + a.monthlyListeners, 0);

  const content = `
    <div style="margin-bottom: 20px;">
        <!-- Header -->
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
                <h2 style="margin:0; font-size:1.3rem;"><i class="fas fa-microphone"></i> Artists Management</h2>
                <a href="/admin/artist/create" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Create New Artist
                </a>
            </div>
            
            <!-- Search and Filter -->
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                        <input type="text" id="searchInput" class="form-control" placeholder="Search artists, genres..." 
                               value="${search}" style="padding-left: 40px;">
                    </div>
                </div>
                <select id="sortSelect" class="form-control" style="width: auto; min-width: 150px;">
                    ${sortOptions.map(opt => `
                        <option value="${opt.value}" ${sort === opt.value ? 'selected' : ''}>Sort by: ${opt.label}</option>
                    `).join('')}
                </select>
                <button onclick="applyFilters()" class="btn btn-primary">
                    <i class="fas fa-filter"></i> Apply
                </button>
            </div>
            
            <!-- Stats Summary with Views -->
            <div style="display: flex; gap: 15px; flex-wrap: wrap; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                <div><i class="fas fa-microphone" style="color: #ff5500;"></i> Artists: <strong>${totalArtists}</strong></div>
                <div><i class="fas fa-music" style="color: #ff5500;"></i> Songs: <strong>${totalSongs}</strong></div>
                <div><i class="fas fa-compact-disc" style="color: #ff5500;"></i> Albums: <strong>${totalAlbums}</strong></div>
                <div><i class="fas fa-headphones" style="color: #9b59b6;"></i> Listeners: <strong>${formatNumber(totalListeners)}</strong></div>
                <div><i class="fas fa-eye" style="color: #4a90e2;"></i> Views: <strong>${formatNumber(totalViews)}</strong></div>
            </div>
            
            <!-- Bulk Actions -->
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="selectAllArtists()" class="btn btn-secondary btn-sm">
                    <i class="fas fa-check-double"></i> Select All
                </button>
                <button onclick="bulkDeleteArtists()" class="btn btn-danger btn-sm" id="bulkDeleteBtn" disabled>
                    <i class="fas fa-trash-alt"></i> Delete Selected (<span id="selectedCount">0</span>)
                </button>
            </div>
        </div>
        
        <!-- Mobile Cards -->
        <div class="mobile-cards">
            ${pageArtists.map(artist => generateMobileCard(artist)).join('')}
            ${pageArtists.length === 0 ? `
                <div class="empty-state">
                    <i class="fas fa-microphone"></i>
                    <h3>No artists found</h3>
                    <p>Try adjusting your search or create a new artist</p>
                    <a href="/admin/artist/create" class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Create New Artist
                    </a>
                </div>
            ` : ''}
        </div>
        
        <!-- Desktop Grid -->
        <div class="artists-grid" style="display: none;">
            ${pageArtists.map(artist => generateGridCard(artist)).join('')}
        </div>
        
        <!-- Pagination -->
        ${generatePagination(page, totalPages, search, sort)}
    </div>
    
    <!-- Progress Modal for Bulk Operations -->
    <div id="progressModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background: white; max-width: 500px; width: 90%; border-radius: 12px; padding: 25px;">
            <h3 style="margin-bottom: 20px;"><i class="fas fa-trash-alt" style="color: #dc3545;"></i> <span id="progressTitle">Deleting Artists</span></h3>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span id="progressStatus">Processing...</span>
                    <span id="progressPercentage" style="font-weight: 600;">0%</span>
                </div>
                <div style="height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden;">
                    <div id="progressBar" style="width: 0%; height: 100%; background: #dc3545; transition: width 0.3s;"></div>
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; max-height: 200px; overflow-y: auto;">
                <div id="progressLog"></div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="closeProgressModal()" class="btn btn-secondary" id="closeProgressBtn">Close</button>
            </div>
        </div>
    </div>
    
    <style>
        .artists-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .artist-grid-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            transition: transform 0.2s;
            border: 1px solid #e8e8e8;
            position: relative;
        }
        
        .artist-grid-card.selected {
            border: 2px solid #ff5500;
            box-shadow: 0 0 0 3px rgba(255,85,0,0.2);
        }
        
        .artist-grid-card:hover {
            transform: translateY(-4px);
            border-color: #9b59b6;
        }
        
        .artist-thumbnail {
            width: 100%;
            aspect-ratio: 1;
            background: linear-gradient(135deg, #9b59b6, #8e44ad);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 3rem;
            position: relative;
            cursor: pointer;
        }
        
        .artist-thumbnail .selection-checkbox {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 24px;
            height: 24px;
            background: white;
            border: 2px solid #ff5500;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
        }
        
        .artist-thumbnail .selection-checkbox.checked {
            background: #ff5500;
        }
        
        .artist-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .artist-info {
            padding: 15px;
        }
        
        .artist-name {
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 5px;
            cursor: pointer;
        }
        
        .artist-genre {
            color: #9b59b6;
            font-size: 0.85rem;
            margin-bottom: 8px;
            cursor: pointer;
        }
        
        .artist-stats {
            display: flex;
            gap: 12px;
            font-size: 0.8rem;
            color: #666;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        
        .progress-container {
            animation: slideDown 0.3s ease;
            margin: 10px 0;
        }
        
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .progress-bar-fill {
            transition: width 0.3s ease;
        }
        
        .btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
        
        .fa-spinner {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @media (min-width: 768px) {
            .mobile-cards { display: none; }
            .artists-grid { display: grid !important; }
        }
    </style>
    
    <script>
        // Selection state
        let selectedArtists = new Set();
        
        function applyFilters() {
            const search = document.getElementById('searchInput').value;
            const sort = document.getElementById('sortSelect').value;
            let url = '/admin/artists?';
            if (search) url += 'search=' + encodeURIComponent(search) + '&';
            url += 'sort=' + sort;
            window.location.href = url;
        }
        
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') applyFilters();
        });
        
        // Selection functions
        function toggleArtistSelection(id, checkbox) {
            if (selectedArtists.has(id)) {
                selectedArtists.delete(id);
                if (checkbox) {
                    checkbox.classList.remove('checked');
                    checkbox.innerHTML = '';
                }
            } else {
                selectedArtists.add(id);
                if (checkbox) {
                    checkbox.classList.add('checked');
                    checkbox.innerHTML = '✓';
                }
            }
            
            updateBulkDeleteButton();
            
            // Update card selection class
            const card = document.getElementById('artist-' + id);
            if (card) {
                if (selectedArtists.has(id)) {
                    card.classList.add('selected');
                } else {
                    card.classList.remove('selected');
                }
            }
        }
        
        function selectAllArtists() {
            const checkboxes = document.querySelectorAll('.selection-checkbox');
            const allSelected = selectedArtists.size === checkboxes.length;
            
            checkboxes.forEach(checkbox => {
                const id = checkbox.dataset.id;
                if (!allSelected && !selectedArtists.has(id)) {
                    toggleArtistSelection(id, checkbox);
                } else if (allSelected) {
                    toggleArtistSelection(id, checkbox);
                }
            });
        }
        
        function updateBulkDeleteButton() {
            const btn = document.getElementById('bulkDeleteBtn');
            const countSpan = document.getElementById('selectedCount');
            const count = selectedArtists.size;
            
            countSpan.textContent = count;
            btn.disabled = count === 0;
        }
        
        // Progress tracking functions
        function showProgressModal(title) {
            const modal = document.getElementById('progressModal');
            const titleEl = document.getElementById('progressTitle');
            const progressBar = document.getElementById('progressBar');
            const progressStatus = document.getElementById('progressStatus');
            const progressPercentage = document.getElementById('progressPercentage');
            const progressLog = document.getElementById('progressLog');
            const closeBtn = document.getElementById('closeProgressBtn');
            
            titleEl.textContent = title;
            progressBar.style.width = '0%';
            progressPercentage.textContent = '0%';
            progressStatus.textContent = 'Starting...';
            progressLog.innerHTML = '';
            closeBtn.disabled = true;
            
            modal.style.display = 'flex';
        }
        
        function updateProgress(percent, status, logMessage) {
            const progressBar = document.getElementById('progressBar');
            const progressStatus = document.getElementById('progressStatus');
            const progressPercentage = document.getElementById('progressPercentage');
            const progressLog = document.getElementById('progressLog');
            
            progressBar.style.width = percent + '%';
            progressPercentage.textContent = percent + '%';
            progressStatus.textContent = status;
            
            if (logMessage) {
                const logEntry = document.createElement('div');
                logEntry.style.marginBottom = '5px';
                logEntry.style.fontSize = '0.85rem';
                logEntry.style.color = '#666';
                logEntry.innerHTML = logMessage;
                progressLog.appendChild(logEntry);
                progressLog.scrollTop = progressLog.scrollHeight;
            }
        }
        
        function closeProgressModal() {
            document.getElementById('progressModal').style.display = 'none';
        }
        
        // ===== PROGRESS TRACKING FOR SINGLE DELETE =====
        async function deleteArtist(id) {
            if (!confirm('⚠️ Delete this artist? It will be moved to trash.')) return;
            
            const btn = event.target.closest('button');
            const originalText = btn.innerHTML;
            const card = btn.closest('.mobile-card, .artist-grid-card');
            
            btn.innerHTML = '<i class=\"fas fa-spinner fa-spin\"></i> Deleting...';
            btn.disabled = true;
            
            // Create progress bar
            const progressDiv = document.createElement('div');
            progressDiv.className = 'progress-container';
            progressDiv.innerHTML = '<div style=\"margin-top: 10px; padding: 8px; background: #f8f9fa; border-radius: 6px;\">' +
                '<div style=\"display: flex; justify-content: space-between; margin-bottom: 5px;\">' +
                '<span style=\"font-size: 0.8rem;\">Moving to trash...</span>' +
                '<span class=\"progress-percent\" style=\"font-size: 0.8rem; font-weight: 600;\">0%</span>' +
                '</div>' +
                '<div style=\"height: 6px; background: #e9ecef; border-radius: 3px; overflow: hidden;\">' +
                '<div class=\"progress-bar-fill\" style=\"width: 0%; height: 100%; background: #9b59b6; transition: width 0.3s;\"></div>' +
                '</div>' +
                '<div class=\"progress-status\" style=\"font-size: 0.7rem; color: #666; margin-top: 5px;\">Starting...</div>' +
                '</div>';
            
            // Remove any existing progress bar
            const existingProgress = card.querySelector('.progress-container');
            if (existingProgress) existingProgress.remove();
            
            // Add new progress bar
            const buttonContainer = btn.closest('div[style*="gap:8px;"]') || btn.parentNode;
            buttonContainer.parentNode.insertBefore(progressDiv, buttonContainer.nextSibling);
            
            try {
                // Update progress
                updateProgressBar(progressDiv, 30, 'Preparing artist data...');
                
                const response = await fetch('/admin/artists/delete?id=' + id, {
                    method: 'POST'
                });
                
                updateProgressBar(progressDiv, 70, 'Moving files to trash...');
                
                const result = await response.json();
                
                if (result.success) {
                    updateProgressBar(progressDiv, 100, '✅ Artist moved to trash!');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    progressDiv.querySelector('.progress-status').innerHTML = '❌ ' + (result.error || 'Delete failed');
                    progressDiv.querySelector('.progress-status').style.color = '#dc3545';
                    setTimeout(() => progressDiv.remove(), 3000);
                }
            } catch (error) {
                console.error('Delete error:', error);
                btn.innerHTML = originalText;
                btn.disabled = false;
                const status = progressDiv.querySelector('.progress-status');
                status.innerHTML = '❌ Error: ' + error.message;
                status.style.color = '#dc3545';
                setTimeout(() => progressDiv.remove(), 3000);
            }
        }
        
        // Helper function to update progress bar
        function updateProgressBar(container, percent, status) {
            const fill = container.querySelector('.progress-bar-fill');
            const percentSpan = container.querySelector('.progress-percent');
            const statusSpan = container.querySelector('.progress-status');
            
            if (fill) fill.style.width = percent + '%';
            if (percentSpan) percentSpan.textContent = percent + '%';
            if (statusSpan) statusSpan.textContent = status;
        }
        
        // ===== PARALLEL PROCESSING FOR BULK DELETE =====
        async function bulkDeleteArtists() {
            if (selectedArtists.size === 0) return;
            
            if (!confirm(\`⚠️ Delete \${selectedArtists.size} artist(s)? They will be moved to trash.\`)) return;
            
            const artistsToDelete = Array.from(selectedArtists);
            const totalArtists = artistsToDelete.length;
            let completed = 0;
            let failed = 0;
            
            // Show progress modal
            showProgressModal(\`Deleting \${totalArtists} Artists\`);
            updateProgress(0, 'Starting parallel deletion...', 'Initializing...');
            
            // Disable all delete buttons
            document.querySelectorAll('.btn-danger').forEach(btn => btn.disabled = true);
            
            // Process in parallel batches (5 at a time)
            const batchSize = 5;
            for (let i = 0; i < artistsToDelete.length; i += batchSize) {
                const batch = artistsToDelete.slice(i, i + batchSize);
                const batchNum = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(totalArtists / batchSize);
                
                updateProgress(
                    Math.floor((i / totalArtists) * 100),
                    \`Processing batch \${batchNum}/\${totalBatches}...\`,
                    \`📦 Starting batch \${batchNum} (\${batch.length} artists)\`
                );
                
                // Process batch in parallel
                const batchPromises = batch.map(async (artistId) => {
                    try {
                        const response = await fetch('/admin/artists/delete?id=' + artistId, {
                            method: 'POST'
                        });
                        const result = await response.json();
                        
                        if (result.success) {
                            completed++;
                            return { success: true, id: artistId };
                        } else {
                            failed++;
                            return { success: false, id: artistId, error: result.error };
                        }
                    } catch (error) {
                        failed++;
                        return { success: false, id: artistId, error: error.message };
                    }
                });
                
                // Wait for all in batch to complete
                const results = await Promise.all(batchPromises);
                
                // Log results
                results.forEach(result => {
                    if (result.success) {
                        updateProgress(
                            Math.floor((completed / totalArtists) * 100),
                            \`Processing... \${completed}/\${totalArtists} completed\`,
                            \`✅ Deleted artist: \${result.id}\`
                        );
                        
                        // Remove card from UI
                        const card = document.getElementById('artist-' + result.id);
                        if (card) {
                            card.style.opacity = '0.5';
                            setTimeout(() => card.remove(), 500);
                        }
                    } else {
                        updateProgress(
                            Math.floor((completed / totalArtists) * 100),
                            'Processing...',
                            \`❌ Failed to delete \${result.id}: \${result.error}\`
                        );
                    }
                });
            }
            
            // Final update
            if (failed === 0) {
                updateProgress(100, \`✅ Successfully deleted \${completed} artists\`, 
                    \`🎉 All \${completed} artists moved to trash successfully!\`);
            } else {
                updateProgress(100, \`⚠️ Completed with \${failed} failures\`, 
                    \`⚠️ \${completed} succeeded, \${failed} failed. Check logs above.\`);
            }
            
            // Enable close button
            document.getElementById('closeProgressBtn').disabled = false;
            
            // Clear selection
            selectedArtists.clear();
            updateBulkDeleteButton();
            
            // Reload after delay
            setTimeout(() => location.reload(), 2000);
        }
        
        // View functions
        window.viewArtist = function(id) { window.open('/artist/' + id, '_blank'); };
        window.editArtist = function(id) { window.location.href = '/admin/artists/edit?id=' + id; };
        window.mergeArtist = function(id) { window.location.href = '/admin/artists/merge?id=' + id; };
        window.deleteArtist = deleteArtist;
        window.bulkDeleteArtists = bulkDeleteArtists;
        window.selectAllArtists = selectAllArtists;
        window.toggleArtistSelection = toggleArtistSelection;
    </script>
  `;

  return { content, title: 'Artists Management' };
}

// ===== CREATE NEW ARTIST PAGE =====
export async function handleAdminArtistCreate(req, env, ctx, auth) {
  const content = `
    <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-plus-circle" style="color: #9b59b6;"></i> Create New Artist</h2>
        
        <form action="/admin/artist/create" method="POST" enctype="multipart/form-data">
            <div class="form-group">
                <label>Artist Name</label>
                <input type="text" name="name" class="form-control" placeholder="e.g. Yo Maps" required>
            </div>
            
            <div class="form-group">
                <label>Genre</label>
                <input type="text" name="genre" class="form-control" placeholder="e.g. Zam Pop, Gospel, Hip Hop">
            </div>
            
            <div class="form-group">
                <label>Bio</label>
                <textarea name="description" class="form-control" rows="4" placeholder="Artist biography..."></textarea>
            </div>
            
            <div class="form-group">
                <label>Origin/Location</label>
                <input type="text" name="origin" class="form-control" placeholder="e.g. Lusaka, Zambia">
            </div>
            
            <div class="form-group">
                <label>Artist Image</label>
                <input type="file" name="thumbnail" accept="image/*" class="form-control">
                <p style="font-size: 0.8rem; color: #666; margin-top: 5px;">Square image recommended (JPG or PNG)</p>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 30px;">
                <button type="submit" class="btn btn-primary" style="background: #9b59b6;">
                    <i class="fas fa-save"></i> Create Artist
                </button>
                <a href="/admin/artists" class="btn btn-secondary">
                    <i class="fas fa-times"></i> Cancel
                </a>
            </div>
        </form>
    </div>
  `;
  
  return { content, title: 'Create Artist' };
}

// ===== HANDLE ARTIST CREATION POST =====
export async function handleAdminArtistCreatePost(req, env, ctx, auth) {
  const formData = await req.formData();
  const name = formData.get('name');
  const genre = formData.get('genre') || '';
  const description = formData.get('description') || '';
  const origin = formData.get('origin') || '';
  const thumbnailFile = formData.get('thumbnail');

  if (!name) {
    return new Response(JSON.stringify({ success: false, error: 'Artist name is required' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const artistId = sanitize(name);
  const artists = await getArtists(env);

  // Check if artist already exists
  if (artists[artistId]) {
    return new Response(JSON.stringify({ success: false, error: 'Artist with this name already exists' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let thumbnailKey = null;
  if (thumbnailFile && thumbnailFile.size > 0) {
    const imgType = thumbnailFile.type.includes('png') ? 'png' : 'jpg';
    thumbnailKey = `artists/thumbnails/${artistId}.${imgType}`;
    await env.media.put(thumbnailKey, thumbnailFile.stream());
  }

  artists[artistId] = {
    id: artistId,
    name: name,
    description: description,
    genre: genre,
    origin: origin,
    thumbnail: thumbnailKey,
    created: Date.now(),
    songs: [],
    albums: []
  };

  await saveArtists(env, artists);
  
  // Log activity
  await logAdminActivity(env, auth.session.id, 'create', 'artist', artistId, name);

  return Response.redirect('/admin/artists?created=1', 302);
}

// ===== EDIT ARTIST PAGE =====
export async function handleAdminArtistEdit(req, env, ctx, auth) {
  const url = new URL(req.url);
  const artistId = url.searchParams.get('id');
  
  if (!artistId) {
    return Response.redirect('/admin/artists', 302);
  }
  
  const artists = await getArtists(env);
  const artist = artists[artistId];
  
  if (!artist) {
    return Response.redirect('/admin/artists', 302);
  }
  
  const content = `
    <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-edit"></i> Edit Artist: ${artist.name}</h2>
        
        <form id="editForm" action="/admin/artists/edit" method="POST" enctype="multipart/form-data">
            <input type="hidden" name="artistId" value="${artistId}">
            
            <div class="form-group">
                <label>Artist Name</label>
                <input type="text" name="name" class="form-control" value="${artist.name}" required>
            </div>
            
            <div class="form-group">
                <label>Genre</label>
                <input type="text" name="genre" class="form-control" value="${artist.genre || ''}" placeholder="e.g. Zam Pop, Gospel, Hip Hop">
            </div>
            
            <div class="form-group">
                <label>Bio</label>
                <textarea name="description" class="form-control" rows="4">${artist.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label>Origin/Location</label>
                <input type="text" name="origin" class="form-control" value="${artist.origin || ''}" placeholder="e.g. Lusaka, Zambia">
            </div>
            
            <div class="form-group">
                <label>Current Image</label>
                ${artist.thumbnail ? 
                    `<div style="margin-bottom:10px;">
                        <img src="/${artist.thumbnail}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid #9b59b6;">
                    </div>` : 
                    '<p>No image</p>'
                }
                <label>New Image (optional)</label>
                <input type="file" name="thumbnail" accept="image/*" class="form-control">
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 30px;">
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i> Save Changes
                </button>
                <a href="/admin/artists" class="btn btn-secondary">
                    <i class="fas fa-times"></i> Cancel
                </a>
            </div>
        </form>
    </div>
    
    <script>
        document.getElementById('editForm').addEventListener('submit', function(e) {
            if (!confirm('Save changes to this artist?')) {
                e.preventDefault();
            }
        });
    </script>
  `;
  
  return { content, title: 'Edit Artist' };
}

// ===== HANDLE ARTIST EDIT POST =====
export async function handleAdminArtistEditPost(req, env, ctx, auth) {
  const formData = await req.formData();
  const artistId = formData.get('artistId');
  const name = formData.get('name');
  const genre = formData.get('genre');
  const description = formData.get('description');
  const origin = formData.get('origin');
  const thumbnailFile = formData.get('thumbnail');
  
  if (!artistId || !name) {
    return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const artists = await getArtists(env);
    
    if (!artists[artistId]) {
      return new Response(JSON.stringify({ success: false, error: 'Artist not found' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update artist details
    artists[artistId].name = name;
    artists[artistId].genre = genre;
    artists[artistId].description = description;
    artists[artistId].origin = origin;
    
    // Upload new thumbnail if provided
    if (thumbnailFile && thumbnailFile.size > 0) {
      const imgType = thumbnailFile.type.includes('png') ? 'png' : 'jpg';
      const thumbnailKey = `artists/thumbnails/${artistId}.${imgType}`;
      await env.media.put(thumbnailKey, thumbnailFile.stream());
      artists[artistId].thumbnail = thumbnailKey;
    }
    
    await saveArtists(env, artists);
    
    // Log activity
    await logAdminActivity(env, auth.session.id, 'edit', 'artist', artistId, name);
    
    return Response.redirect('/admin/artists?updated=1', 302);
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ===== HANDLE ARTIST DELETION - UPDATED to use trash =====
export async function handleAdminArtistDelete(req, env, ctx, auth) {
  const url = new URL(req.url);
  const artistId = url.searchParams.get('id');
  
  if (!artistId) {
    return new Response(JSON.stringify({ success: false, error: 'No artist specified' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const artists = await getArtists(env);
    const artist = artists[artistId];
    const artistName = artist?.name || 'Unknown artist';
    
    if (!artist) {
      return new Response(JSON.stringify({ success: false, error: 'Artist not found' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get thumbnail path
    let thumbnailPath = null;
    if (artist?.thumbnail) {
      thumbnailPath = artist.thumbnail;
    }
    
    // Calculate total size (sum of all songs by artist)
    let totalSize = 0;
    if (artist?.songs) {
      for (const songId of artist.songs) {
        try {
          const songObj = await env.media.get(`songs/${songId}.mp3`);
          totalSize += songObj?.size || 0;
        } catch (e) {}
      }
    }
    
    // Prepare metadata
    const itemData = {
      name: artist?.name,
      description: artist?.description,
      genre: artist?.genre,
      origin: artist?.origin,
      songs: artist?.songs,
      albums: artist?.albums,
      created: artist?.created,
      thumbnail: artist?.thumbnail
    };
    
    // Move to trash
    const result = await moveToTrash(
      env,
      auth.session.id,
      'artist',
      artistId,
      artistName,
      itemData,
      totalSize
    );
    
    if (!result.success) {
      return new Response(JSON.stringify({ success: false, error: result.error }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Remove from artists index
    delete artists[artistId];
    await saveArtists(env, artists);
    
    // Log activity
    await logAdminActivity(env, auth.session.id, 'delete', 'artist', artistId, artistName);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error moving artist to trash:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ===== MERGE ARTISTS PAGE =====
export async function handleAdminArtistMerge(req, env, ctx, auth) {
  const url = new URL(req.url);
  const artistId = url.searchParams.get('id');
  
  if (!artistId) {
    return Response.redirect('/admin/artists', 302);
  }
  
  const artists = await getArtists(env);
  const mainArtist = artists[artistId];
  
  if (!mainArtist) {
    return Response.redirect('/admin/artists', 302);
  }
  
  // Get all other artists for merging
  const otherArtists = Object.entries(artists)
    .filter(([id]) => id !== artistId)
    .map(([id, artist]) => ({
      id,
      name: artist.name,
      songCount: artist.songs?.length || 0,
      albumCount: artist.albums?.length || 0
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const artistOptions = otherArtists.map(artist => 
    `<option value="${artist.id}">${artist.name} (${artist.songCount} songs, ${artist.albumCount} albums)</option>`
  ).join('');
  
  const content = `
    <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;"><i class="fas fa-compress"></i> Merge Artists</h2>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #9b59b6;">
            <p><strong>Main Artist:</strong> ${mainArtist.name}</p>
            <p><i class="fas fa-info-circle"></i> This artist will receive all songs and albums from the merged artist.</p>
        </div>
        
        <form id="mergeForm" action="/admin/artists/merge" method="POST">
            <input type="hidden" name="mainArtistId" value="${artistId}">
            
            <div class="form-group">
                <label>Select Artist to Merge into ${mainArtist.name}</label>
                <select name="mergeArtistId" class="form-control" required>
                    <option value="">-- Select Artist --</option>
                    ${artistOptions}
                </select>
            </div>
            
            <div class="form-group">
                <label>Action after merge</label>
                <div style="display: flex; gap: 20px; margin-top: 10px;">
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="deleteAfter" value="yes" checked> Delete merged artist
                    </label>
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="deleteAfter" value="no"> Keep merged artist
                    </label>
                </div>
            </div>
            
            <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Warning:</strong> This action cannot be undone. All songs and albums from the merged artist will be transferred to ${mainArtist.name}.
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 30px;">
                <button type="submit" class="btn btn-primary" onclick="return confirm('Are you sure you want to merge these artists?')">
                    <i class="fas fa-compress"></i> Merge Artists
                </button>
                <a href="/admin/artists" class="btn btn-secondary">
                    <i class="fas fa-times"></i> Cancel
                </a>
            </div>
        </form>
    </div>
  `;
  
  return { content, title: 'Merge Artists' };
}

// ===== HANDLE ARTIST MERGE POST =====
export async function handleAdminArtistMergePost(req, env, ctx, auth) {
  const formData = await req.formData();
  const mainArtistId = formData.get('mainArtistId');
  const mergeArtistId = formData.get('mergeArtistId');
  const deleteAfter = formData.get('deleteAfter');
  
  if (!mainArtistId || !mergeArtistId) {
    return new Response(JSON.stringify({ success: false, error: 'Missing artist IDs' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (mainArtistId === mergeArtistId) {
    return new Response(JSON.stringify({ success: false, error: 'Cannot merge an artist with itself' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const artists = await getArtists(env);
    const albums = await getAlbums(env);
    
    const mainArtist = artists[mainArtistId];
    const mergeArtist = artists[mergeArtistId];
    const mergeArtistName = mergeArtist?.name || 'Unknown artist';
    
    if (!mainArtist || !mergeArtist) {
      return new Response(JSON.stringify({ success: false, error: 'Artist not found' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Transfer songs
    if (mergeArtist.songs) {
      for (const songKey of mergeArtist.songs) {
        if (!mainArtist.songs.includes(songKey)) {
          mainArtist.songs.push(songKey);
        }
      }
    }
    
    // Transfer albums
    if (mergeArtist.albums) {
      for (const albumId of mergeArtist.albums) {
        if (!mainArtist.albums.includes(albumId)) {
          mainArtist.albums.push(albumId);
        }
        
        // Update album's artists array
        if (albums[albumId]) {
          if (!albums[albumId].artists) albums[albumId].artists = [];
          if (!albums[albumId].artists.includes(mainArtistId)) {
            // Replace mergeArtistId with mainArtistId
            const index = albums[albumId].artists.indexOf(mergeArtistId);
            if (index !== -1) {
              albums[albumId].artists[index] = mainArtistId;
            } else {
              albums[albumId].artists.push(mainArtistId);
            }
          }
        }
      }
    }
    
    // Save updated albums
    await saveAlbums(env, albums);
    
    // Delete merged artist if requested
    if (deleteAfter === 'yes') {
      // Delete thumbnail if exists
      if (mergeArtist.thumbnail) {
        await env.media.delete(mergeArtist.thumbnail).catch(() => {});
      }
      delete artists[mergeArtistId];
    }
    
    // Save main artist
    await saveArtists(env, artists);
    
    // Log activity
    await logAdminActivity(env, auth.session.id, 'merge', 'artist', mainArtistId, 
      `Merged ${mergeArtistName} into ${mainArtist.name}`);
    
    return Response.redirect('/admin/artists?merged=1', 302);
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ===== HELPER FUNCTIONS =====

// Mobile card with views and selection checkbox
function generateMobileCard(artist) {
  const date = new Date(artist.created).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  
  return `
    <div class="mobile-card" id="artist-${artist.id}">
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="font-weight:700; margin-bottom:5px;">${artist.name}</div>
            <div class="selection-checkbox" data-id="${artist.id}" onclick="toggleArtistSelection('${artist.id}', this)"></div>
        </div>
        <div style="color:#9b59b6; margin-bottom:8px;">${artist.genre}</div>
        <div style="display:flex; gap:15px; flex-wrap:wrap; margin-bottom:8px;">
            <span><i class="fas fa-music"></i> ${artist.songCount} songs</span>
            <span><i class="fas fa-compact-disc"></i> ${artist.albumCount} albums</span>
            <span><i class="fas fa-headphones" style="color:#9b59b6;"></i> ${formatNumber(artist.monthlyListeners)}</span>
            <span><i class="fas fa-eye" style="color:#4a90e2;"></i> ${formatNumber(artist.views || 0)}</span>
        </div>
        <div style="font-size:0.75rem; color:#999; margin-bottom:10px;">Since ${date}</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button onclick="previewModal.show('artist', '${artist.id}')" class="btn btn-info btn-sm" style="flex:1; background: #00b894; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-eye"></i> Preview
            </button>
            <button onclick="editArtist('${artist.id}')" class="btn btn-primary btn-sm" style="flex:1; background: #9b59b6; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="mergeArtist('${artist.id}')" class="btn btn-secondary btn-sm" style="flex:1; background: #6c757d; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-compress"></i> Merge
            </button>
            <button onclick="deleteArtist('${artist.id}')" class="btn btn-danger btn-sm" style="flex:1; background: #dc3545; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    </div>
  `;
}

// Grid card with views and selection checkbox
function generateGridCard(artist) {
  return `
    <div class="artist-grid-card" id="artist-${artist.id}">
        <div class="artist-thumbnail" onclick="viewArtist('${artist.id}')">
            ${artist.thumbnail ? `<img src="/${artist.thumbnail}">` : '🎤'}
            <div class="selection-checkbox" data-id="${artist.id}" onclick="event.stopPropagation(); toggleArtistSelection('${artist.id}', this)"></div>
        </div>
        <div class="artist-info">
            <div class="artist-name" onclick="viewArtist('${artist.id}')">${artist.name}</div>
            <div class="artist-genre" onclick="viewArtist('${artist.id}')">${artist.genre}</div>
            <div class="artist-stats">
                <span><i class="fas fa-music"></i> ${artist.songCount}</span>
                <span><i class="fas fa-compact-disc"></i> ${artist.albumCount}</span>
                <span><i class="fas fa-headphones"></i> ${formatNumber(artist.monthlyListeners)}</span>
                <span><i class="fas fa-eye" style="color:#4a90e2;"></i> ${formatNumber(artist.views || 0)}</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
                <button onclick="previewModal.show('artist', '${artist.id}')" class="btn btn-info btn-sm" title="Quick Preview" style="background: #00b894; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="editArtist('${artist.id}')" class="btn btn-primary btn-sm" title="Edit" style="background: #9b59b6; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="mergeArtist('${artist.id}')" class="btn btn-secondary btn-sm" title="Merge" style="background: #6c757d; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-compress"></i>
                </button>
                <button onclick="deleteArtist('${artist.id}')" class="btn btn-danger btn-sm" title="Delete" style="background: #dc3545; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    </div>
  `;
}

// Pagination helper
function generatePagination(currentPage, totalPages, search, sort) {
  if (totalPages <= 1) return '';
  let html = '<div class="pagination" style="margin-top: 30px; justify-content: center;">';
  if (currentPage > 1) {
    html += `<a href="?page=${currentPage-1}&search=${encodeURIComponent(search)}&sort=${sort}" class="pagination-item pagination-prev"><i class="fas fa-chevron-left"></i> Prev</a>`;
  } else {
    html += `<span class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</span>`;
  }
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<a href="?page=${i}&search=${encodeURIComponent(search)}&sort=${sort}" class="pagination-item ${i === currentPage ? 'active' : ''}">${i}</a>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }
  if (currentPage < totalPages) {
    html += `<a href="?page=${currentPage+1}&search=${encodeURIComponent(search)}&sort=${sort}" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>`;
  } else {
    html += `<span class="pagination-item pagination-next disabled">Next <i class="fas fa-chevron-right"></i></span>`;
  }
  html += '</div>';
  return html;
}