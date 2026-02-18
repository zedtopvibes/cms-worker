// ==================== ADMIN SONGS MANAGEMENT ====================
import { getArtists, getAlbums, getMetadata, saveMetadata } from '../../helpers/storage.js';
import { getSongStats } from '../../helpers/db.js';
import { getPageViews } from '../../helpers/pageViews.js';
import { formatDuration, formatNumber } from '../../helpers/formatting.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';

export async function handleAdminSongs(req, env, ctx, auth) {
const url = new URL(req.url);
const page = parseInt(url.searchParams.get('page')) || 1;
const search = url.searchParams.get('search') || '';
const sort = url.searchParams.get('sort') || 'date';
const ITEMS_PER_PAGE = 20;

// Get all songs
const songList = await env.media.list({ prefix: "songs/" });
const songs = songList.objects || [];
const artists = await getArtists(env);
const albums = await getAlbums(env);

// Get detailed song data with views
let songsData = await Promise.all(
songs.map(async (song) => {
const fileName = song.key.split('/')[1];
const baseName = fileName.replace('.mp3', '');
const meta = await getMetadata(env, baseName);
const stats = await getSongStats(baseName, env);
const pageViews = await getPageViews(env, 'song', baseName);

// Find album  
  let albumInfo = null;  
  for (const [id, album] of Object.entries(albums)) {  
    if (album.songs?.includes(baseName)) {  
      albumInfo = { id, title: album.title };  
      break;  
    }  
  }  

  // Get artist names  
  let primaryArtistName = baseName.split('_')[0];  
  if (meta?.primaryArtist) {  
    primaryArtistName = artists[meta.primaryArtist]?.name || meta.primaryArtist;  
  }  

  const featuredNames = meta?.featuredArtists?.map(id => artists[id]?.name || id).join(', ') || '';  

  return {  
    fileName,  
    baseName,  
    title: meta?.title || baseName.split('_').slice(1).join(' '),  
    primaryArtist: meta?.primaryArtist || baseName.split('_')[0],  
    primaryArtistName,  
    featuredArtists: meta?.featuredArtists || [],  
    featuredNames,  
    album: albumInfo,  
    duration: meta?.duration || 0,  
    plays: stats.plays,  
    downloads: stats.downloads,  
    views: pageViews,  
    uploaded: new Date(song.uploaded),  
    size: song.size  
  };  
})

);

// Apply search filter
if (search) {
const searchLower = search.toLowerCase();
songsData = songsData.filter(song =>
song.title.toLowerCase().includes(searchLower) ||
song.primaryArtistName.toLowerCase().includes(searchLower) ||
song.featuredNames.toLowerCase().includes(searchLower) ||
(song.album?.title || '').toLowerCase().includes(searchLower)
);
}

// Apply sorting with views
songsData.sort((a, b) => {
switch (sort) {
case 'title':
return a.title.localeCompare(b.title);
case 'artist':
return a.primaryArtistName.localeCompare(b.primaryArtistName);
case 'plays':
return b.plays - a.plays;
case 'downloads':
return b.downloads - a.downloads;
case 'views':
return (b.views || 0) - (a.views || 0);
case 'duration':
return b.duration - a.duration;
case 'date':
default:
return b.uploaded - a.uploaded;
}
});

// Pagination
const totalSongs = songsData.length;
const totalPages = Math.ceil(totalSongs / ITEMS_PER_PAGE);
const startIdx = (page - 1) * ITEMS_PER_PAGE;
const pageSongs = songsData.slice(startIdx, startIdx + ITEMS_PER_PAGE);

// Sort options with views
const sortOptions = [
{ value: 'date', label: 'Date Added' },
{ value: 'title', label: 'Title' },
{ value: 'artist', label: 'Artist' },
{ value: 'plays', label: 'Most Played' },
{ value: 'downloads', label: 'Most Downloaded' },
{ value: 'views', label: 'Most Viewed' },
{ value: 'duration', label: 'Duration' }
];

// Calculate totals
const totalPlays = songsData.reduce((acc, s) => acc + s.plays, 0);
const totalDownloads = songsData.reduce((acc, s) => acc + s.downloads, 0);
const totalViews = songsData.reduce((acc, s) => acc + (s.views || 0), 0);

const content = `
<div style="margin-bottom: 20px;">
<!-- Header -->
<div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
<div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;">
<h2 style="margin:0; font-size:1.3rem;"><i class="fas fa-music"></i> Songs Management</h2>
<a href="/admin/upload" class="btn btn-primary">
<i class="fas fa-cloud-upload-alt"></i> Upload New
</a>
</div>

<!-- Search and Filter -->  
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">  
            <div style="flex: 1; min-width: 200px;">  
                <div style="position: relative;">  
                    <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #999;"></i>  
                    <input type="text" id="searchInput" class="form-control" placeholder="Search songs, artists, albums..."   
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
            <div><i class="fas fa-music" style="color: #ff5500;"></i> Total: <strong>${totalSongs}</strong> songs</div>  
            <div><i class="fas fa-play" style="color: #ff5500;"></i> Plays: <strong>${formatNumber(totalPlays)}</strong></div>  
            <div><i class="fas fa-download" style="color: #ff5500;"></i> Downloads: <strong>${formatNumber(totalDownloads)}</strong></div>  
            <div><i class="fas fa-eye" style="color: #4a90e2;"></i> Views: <strong>${formatNumber(totalViews)}</strong></div>  
        </div>  
    </div>  
      
    <!-- Mobile Cards -->  
    <div class="mobile-cards">  
        ${pageSongs.map(song => generateMobileCard(song)).join('')}  
        ${pageSongs.length === 0 ? `  
            <div class="empty-state">  
                <i class="fas fa-music"></i>  
                <h3>No songs found</h3>  
                <p>Try adjusting your search or upload a new song</p>  
                <a href="/admin/upload" class="btn btn-primary" style="margin-top: 15px;">  
                    <i class="fas fa-cloud-upload-alt"></i> Upload Song  
                </a>  
            </div>  
        ` : ''}  
    </div>  
      
    <!-- Desktop Table -->  
    <div class="table-responsive">  
        <table class="admin-table">  
            <thead>  
                <tr>  
                    <th>Title</th>  
                    <th>Artist</th>  
                    <th>Album</th>  
                    <th>Duration</th>  
                    <th>Plays</th>  
                    <th>Downloads</th>  
                    <th>Views</th>  
                    <th>Added</th>  
                    <th>Actions</th>  
                </tr>  
            </thead>  
            <tbody>  
                ${pageSongs.map(song => generateTableRow(song)).join('')}  
                ${pageSongs.length === 0 ? `  
                    <tr>  
                        <td colspan="9" style="text-align: center; padding: 40px;">  
                            <i class="fas fa-music" style="font-size: 2rem; color: #ccc;"></i><br>  
                            No songs found  
                        </td>  
                    </tr>  
                ` : ''}  
            </tbody>  
        </table>  
    </div>  
      
    <!-- Pagination -->  
    ${generatePagination(page, totalPages, search, sort)}  
</div>  
  
<style>  
    @media (min-width: 768px) {  
        .mobile-cards { display: none; }  
    }  
    @media (max-width: 767px) {  
        .table-responsive { display: none; }  
    }  
</style>  
  
<script>  
    function applyFilters() {  
        const search = document.getElementById('searchInput').value;  
        const sort = document.getElementById('sortSelect').value;  
        let url = '/admin/songs?';  
        if (search) url += 'search=' + encodeURIComponent(search) + '&';  
        url += 'sort=' + sort;  
        window.location.href = url;  
    }  
      
    document.getElementById('searchInput').addEventListener('keypress', function(e) {  
        if (e.key === 'Enter') applyFilters();  
    });  
      
    window.deleteSong = function(baseName) {  
        if (confirm('Are you sure you want to delete this song? This action cannot be undone.')) {  
            window.location.href = '/admin/songs/delete?name=' + encodeURIComponent(baseName);  
        }  
    };  
      
    window.editSong = function(baseName) {  
        window.location.href = '/admin/songs/edit?name=' + encodeURIComponent(baseName);  
    };  
</script>

`;

return content;
}

// ===== EDIT/DELETE FUNCTIONS WITH ENHANCED ERROR HANDLING =====

// Handle song deletion - ENHANCED ERROR HANDLING VERSION
export async function handleAdminSongDelete(req, env, ctx, auth) {
console.log('🔍 ===== DELETE FUNCTION STARTED =====');

try {
console.log('🔍 1. Parsing URL...');
const url = new URL(req.url);
const baseName = url.searchParams.get('name');
console.log('🔍 2. Song to delete:', baseName);

if (!baseName) {  
  console.log('❌ 3. No song specified');  
  return { success: false, error: 'No song specified' };  
}  
  
console.log('🔍 4. Auth object present:', !!auth);  
console.log('🔍 5. Auth session present:', !!(auth?.session));  
console.log('🔍 6. Auth session ID:', auth?.session?.id);  
console.log('🔍 7. Auth type:', typeof auth);  
console.log('🔍 8. Auth keys:', Object.keys(auth || {}));  
  
// Get song title for logging  
console.log('🔍 9. Fetching metadata...');  
let meta, title;  
try {  
  meta = await getMetadata(env, baseName);  
  title = meta?.title || baseName;  
  console.log('🔍 10. Song title:', title);  
  console.log('🔍 11. Metadata found:', !!meta);  
} catch (metaError) {  
  console.error('❌ 12. Error fetching metadata:', metaError);  
  title = baseName; // Fallback  
  console.log('🔍 13. Using fallback title:', title);  
}  
  
// Delete from R2  
console.log('🔍 14. Deleting files from R2...');  
const deleteResults = [];  
const deleteErrors = [];  
  
// Try to delete each file type  
try {  
  await env.media.delete(`songs/${baseName}.mp3`);  
  deleteResults.push('✅ song.mp3');  
  console.log('✅ Song file deleted');  
} catch (e) {   
  deleteErrors.push('⚠️ song.mp3 not found');  
  console.log('⚠️ Song file not found or already deleted');   
}  
  
try {  
  await env.media.delete(`images/${baseName}.jpg`);  
  deleteResults.push('✅ image.jpg');  
  console.log('✅ JPG deleted');  
} catch (e) {   
  deleteErrors.push('⚠️ image.jpg not found');  
  console.log('⚠️ JPG not found');   
}  
  
try {  
  await env.media.delete(`images/${baseName}.png`);  
  deleteResults.push('✅ image.png');  
  console.log('✅ PNG deleted');  
} catch (e) {   
  deleteErrors.push('⚠️ image.png not found');  
  console.log('⚠️ PNG not found');   
}  
  
try {  
  await env.media.delete(`descriptions/${baseName}.txt`);  
  deleteResults.push('✅ description.txt');  
  console.log('✅ Description deleted');  
} catch (e) {   
  deleteErrors.push('⚠️ description.txt not found');  
  console.log('⚠️ Description not found');   
}  
  
try {  
  await env.media.delete(`metadata/${baseName}.json`);  
  deleteResults.push('✅ metadata.json');  
  console.log('✅ Metadata deleted');  
} catch (e) {   
  deleteErrors.push('⚠️ metadata.json not found');  
  console.log('⚠️ Metadata not found');   
}  
  
console.log('✅ 15. Files deleted from R2:', deleteResults.join(', '));  
if (deleteErrors.length > 0) {  
  console.log('⚠️ 16. Delete warnings:', deleteErrors.join(', '));  
}  
  
// Try to log activity with extensive error handling  
console.log('🔍 17. Attempting to log activity...');  
  
if (auth?.session?.id) {  
  console.log('🔍 18. Calling logAdminActivity with ID:', auth.session.id);  
  console.log('🔍 19. logAdminActivity params:', {  
    adminId: auth.session.id,  
    action: 'delete',  
    itemType: 'song',  
    itemId: baseName,  
    itemName: title  
  });  
    
  try {  
    console.log('🔍 20. Executing logAdminActivity...');  
    const logResult = await logAdminActivity(  
      env,   
      auth.session.id,   
      'delete',   
      'song',   
      baseName,   
      title  
    );  
      
    console.log('🔍 21. logAdminActivity result:', logResult);  
    console.log('🔍 22. Result type:', typeof logResult);  
      
    if (logResult === true) {  
      console.log('✅ 23. Activity logged successfully');  
    } else {  
      console.log('⚠️ 24. Activity logging returned:', logResult);  
    }  
      
  } catch (logError) {  
    console.error('❌ 25. Error in logAdminActivity:', logError);  
    console.error('❌ 26. Error name:', logError.name);  
    console.error('❌ 27. Error message:', logError.message);  
    console.error('❌ 28. Error stack:', logError.stack);  
  }  
} else {  
  console.log('❌ 29. Cannot log: auth.session.id is undefined');  
  console.log('🔍 30. Auth structure:', JSON.stringify(auth, null, 2));  
  console.log('🔍 31. Auth keys available:', Object.keys(auth || {}));  
  console.log('🔍 32. Session object:', auth?.session);  
}  
  
console.log('✅ 33. Delete function completed successfully');  
console.log('🔍 ===== DELETE FUNCTION ENDED =====');  
  
return { success: true };

} catch (error) {
console.error('❌ 34. Unhandled error in delete function:', error);
console.error('❌ 35. Error name:', error.name);
console.error('❌ 36. Error message:', error.message);
console.error('❌ 37. Error stack:', error.stack);
console.error('❌ 38. Error cause:', error.cause);
return { success: false, error: error.message };
}
}

// Edit song page
export async function handleAdminSongEdit(req, env, ctx, auth) {
const url = new URL(req.url);
const baseName = url.searchParams.get('name');

if (!baseName) {
return { redirect: '/admin/songs' };
}

// Get song data
const meta = await getMetadata(env, baseName);
const artists = await getArtists(env);
const albums = await getAlbums(env);

// Find current album
let currentAlbum = null;
for (const [id, album] of Object.entries(albums)) {
if (album.songs?.includes(baseName)) {
currentAlbum = { id, title: album.title };
break;
}
}

// Get description
let description = '';
try {
const descObj = await env.media.get(descriptions/${baseName}.txt);
if (descObj) description = await descObj.text();
} catch (e) {}

const content = `
<div style="max-width: 600px; margin: 0 auto;">
<h2 style="margin-bottom: 20px;"><i class="fas fa-edit"></i> Edit Song</h2>

<form id="editForm" action="/admin/songs/edit" method="POST">  
        <input type="hidden" name="baseName" value="${baseName}">  
          
        <div class="form-group">  
            <label>Title</label>  
            <input type="text" name="title" class="form-control" value="${meta?.title || baseName.split('_').slice(1).join(' ')}" required>  
        </div>  
          
        <div class="form-group">  
            <label>Primary Artist ID</label>  
            <input type="text" name="primaryArtist" class="form-control" value="${meta?.primaryArtist || baseName.split('_')[0]}" required>  
            <p style="font-size: 0.8rem; color: #666;">Artist ID (e.g., yo_maps)</p>  
        </div>  
          
        <div class="form-group">  
            <label>Featured Artists (comma-separated IDs)</label>  
            <input type="text" name="featuredArtists" class="form-control" value="${meta?.featuredArtists?.join(', ') || ''}">  
        </div>  
          
        <div class="form-group">  
            <label>Description</label>  
            <textarea name="description" class="form-control" rows="4">${description}</textarea>  
        </div>  
          
        <div class="form-group">  
            <label>Duration (seconds)</label>  
            <input type="number" name="duration" class="form-control" value="${meta?.duration || 0}" step="0.001">  
        </div>  
          
        <div style="display: flex; gap: 10px; margin-top: 30px;">  
            <button type="submit" class="btn btn-primary">  
                <i class="fas fa-save"></i> Save Changes  
            </button>  
            <a href="/admin/songs" class="btn btn-secondary">  
                <i class="fas fa-times"></i> Cancel  
            </a>  
        </div>  
    </form>  
</div>  
  
<script>  
    document.getElementById('editForm').addEventListener('submit', function(e) {  
        if (!confirm('Save changes to this song?')) {  
            e.preventDefault();  
        }  
    });  
</script>

`;

return { content };
}

// Handle edit submission
export async function handleAdminSongEditPost(req, env, ctx, auth) {
const formData = await req.formData();
const baseName = formData.get('baseName');
const title = formData.get('title');
const primaryArtist = formData.get('primaryArtist');
const featuredArtistsStr = formData.get('featuredArtists');
const description = formData.get('description');
const duration = parseFloat(formData.get('duration'));

if (!baseName || !title || !primaryArtist) {
return { success: false, error: 'Missing required fields' };
}

// Parse featured artists
const featuredArtists = featuredArtistsStr
? featuredArtistsStr.split(',').map(s => s.trim()).filter(s => s)
: [];

try {
// Update metadata
const metadata = {
title,
primaryArtist,
featuredArtists,
description,
duration
};
await saveMetadata(env, baseName, metadata);

// Update description file  
await env.media.put(`descriptions/${baseName}.txt`, description);  
  
// ✅ LOG ADMIN ACTIVITY  
if (auth?.session?.id) {  
  await logAdminActivity(env, auth.session.id, 'edit', 'song', baseName, title);  
} else {  
  console.log('⚠️ No admin session ID found, skipping activity log for edit');  
}  
  
return { success: true, redirect: '/admin/songs?updated=1' };

} catch (error) {
return { success: false, error: error.message };
}
}

// Mobile card with views
function generateMobileCard(song) {
const date = song.uploaded.toLocaleDateString('en-GB', {
day: '2-digit', month: 'short', year: 'numeric'
});

const featuredHtml = song.featuredNames ?
<div style="font-size: 0.8rem; color: #666; margin-top: 2px;">   <i class="fas fa-users" style="color: #ff5500;"></i> ${song.featuredNames}   </div> : '';

return   <div class="mobile-card">   <div style="font-weight: 700; margin-bottom: 8px;">${song.title}</div>   <div style="color: #ff5500; font-size: 0.9rem; margin-bottom: 5px;">${song.primaryArtistName}</div>   ${featuredHtml}   <div style="font-size: 0.85rem; color: #666; margin: 5px 0;">Album: ${song.album?.title || '—'}</div>   <div style="display: flex; gap: 15px; flex-wrap: wrap; margin: 8px 0;">   <span><i class="fas fa-clock"></i> ${formatDuration(song.duration)}</span>   <span><i class="fas fa-play" style="color: #ff5500;"></i> ${formatNumber(song.plays)}</span>   <span><i class="fas fa-download" style="color: #ff5500;"></i> ${formatNumber(song.downloads)}</span>   <span><i class="fas fa-eye" style="color: #4a90e2;"></i> ${formatNumber(song.views || 0)}</span>   </div>   <div style="font-size: 0.75rem; color: #999; margin-bottom: 10px;">Added: ${date}</div>   <div style="display: flex; gap: 8px;">   <button onclick="editSong('${song.baseName}')" class="btn btn-primary btn-sm" style="flex:1;">Edit</button>   <button onclick="deleteSong('${song.baseName}')" class="btn btn-danger btn-sm" style="flex:1;">Delete</button>   <a href="/song/${encodeURIComponent(song.fileName)}" target="_blank" class="btn btn-secondary btn-sm" style="flex:1;">View</a>   </div>   </div>  ;
}

// Table row with views
function generateTableRow(song) {
const date = song.uploaded.toLocaleDateString('en-GB', {
day: '2-digit', month: 'short', year: 'numeric'
});

return   <tr>   <td><strong>${song.title}</strong></td>   <td>${song.primaryArtistName}${song.featuredNames ?<br><small>feat. ${song.featuredNames}</small>: ''}</td>   <td>${song.album?.title || '—'}</td>   <td>${formatDuration(song.duration)}</td>   <td>${formatNumber(song.plays)}</td>   <td>${formatNumber(song.downloads)}</td>   <td><span style="color: #4a90e2; font-weight: 600;">${formatNumber(song.views || 0)}</span></td>   <td>${date}</td>   <td>   <button onclick="editSong('${song.baseName}')" class="btn btn-primary btn-sm" title="Edit"><i class="fas fa-edit"></i></button>   <button onclick="deleteSong('${song.baseName}')" class="btn btn-danger btn-sm" title="Delete"><i class="fas fa-trash"></i></button>   <a href="/song/${encodeURIComponent(song.fileName)}" target="_blank" class="btn btn-secondary btn-sm" title="View"><i class="fas fa-eye"></i></a>   </td>   </tr>  ;
}

// Pagination helper
function generatePagination(currentPage, totalPages, search, sort) {
if (totalPages <= 1) return '';

let html = '<div class="pagination" style="margin-top: 30px; justify-content: center;">';

if (currentPage > 1) {
html += <a href="?page=${currentPage-1}&search=${encodeURIComponent(search)}&sort=${sort}" class="pagination-item pagination-prev"><i class="fas fa-chevron-left"></i> Prev</a>;
} else {
html += <span class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</span>;
}

for (let i = 1; i <= totalPages; i++) {
if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
html += <a href="?page=${i}&search=${encodeURIComponent(search)}&sort=${sort}" class="pagination-item ${i === currentPage ? 'active' : ''}">${i}</a>;
} else if (i === currentPage - 3 || i === currentPage + 3) {
html += <span class="pagination-ellipsis">...</span>;
}
}

if (currentPage < totalPages) {
html += <a href="?page=${currentPage+1}&search=${encodeURIComponent(search)}&sort=${sort}" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>;
} else {
html += <span class="pagination-item pagination-next disabled">Next <i class="fas fa-chevron-right"></i></span>;
}

html += '</div>';
return html;
}