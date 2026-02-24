// ==================== OPTIMIZED ADMIN UPLOAD HELPER ====================
import { getAlbums, getArtists, getPlaylists, saveArtists, saveMetadata, addSongToAlbum, addSongToPlaylist, addSongToArtist, addAlbumToArtist, addArtistToAlbum } from '../../helpers/storage.js';
import { sanitize, formatDuration, fallbackDurationParser } from '../../helpers/formatting.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';
import { GenreManager } from '../../helpers/genreManager.js';
import { SlugManager } from '../../helpers/slug.js';

// Cache for frequently accessed data
const dataCache = {
  albums: { data: null, timestamp: 0, TTL: 60000 }, // 1 minute
  artists: { data: null, timestamp: 0, TTL: 60000 },
  playlists: { data: null, timestamp: 0, TTL: 60000 },
  genres: { data: null, timestamp: 0, TTL: 300000 } // 5 minutes
};

async function getCachedData(env, type) {
  const cache = dataCache[type];
  const now = Date.now();
  
  if (cache.data && (now - cache.timestamp < cache.TTL)) {
    return cache.data;
  }
  
  let data;
  switch(type) {
    case 'albums':
      data = await getAlbums(env);
      break;
    case 'artists':
      data = await getArtists(env);
      break;
    case 'playlists':
      data = await getPlaylists(env);
      break;
  }
  
  cache.data = data;
  cache.timestamp = now;
  return data;
}

export async function handleAdminUpload(req, env, ctx, auth) {
  // Parallel data fetching
  const [albums, artists, playlists] = await Promise.all([
    getCachedData(env, 'albums'),
    getCachedData(env, 'artists'),
    getCachedData(env, 'playlists')
  ]);
  
  // Lazy load genre manager only when needed
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  const genres = genresData.genres;
  
  // Pre-compile options with streaming for better performance
  const albumOptions = generateOptionsHtml(albums, 'album');
  const artistOptions = generateOptionsHtml(artists, 'artist');
  const playlistOptions = generateOptionsHtml(playlists, 'playlist');
  
  const colorPalette = genreManager.getColorPalette();
  const iconOptions = genreManager.getIconOptions();

  const content = `
    <div style="max-width: 800px; margin: 0 auto; padding: 0 10px;">
        <h2 style="margin-bottom: 20px; font-size: 1.3rem; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <i class="fas fa-cloud-upload-alt" style="color: #ff5500;"></i> 
            Upload New Song
        </h2>
        
        <form id="uploadForm" action="/admin/upload" method="POST" enctype="multipart/form-data">
            <!-- Song Title -->
            <div class="form-group">
                <label>
                    <i class="fas fa-heading" style="color: #ff5500; width: 20px;"></i>
                    Song Title
                </label>
                <input type="text" name="title" id="songTitle" class="form-control" 
                       placeholder="e.g. Drake - God's Plan" required
                       autocomplete="off">
                
                <!-- URL Preview - Optimized with debounced updates -->
                <div style="margin-top: 10px; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                    <div style="display: flex; align-items: flex-start; gap: 8px; flex-direction: column;">
                        <div style="display: flex; align-items: center; gap: 5px; color: #666; width: 100%;">
                            <i class="fas fa-link" style="color: #ff5500;"></i>
                            <span style="font-size: 0.9rem; font-weight: 500;">Final URL:</span>
                        </div>
                        <div style="display: flex; width: 100%; gap: 8px; flex-wrap: wrap;">
                            <code id="urlPreview" style="flex: 1; padding: 8px 10px; background: white; 
                                  border-radius: 4px; font-size: 0.85rem; border: 1px solid #e0e0e0; 
                                  word-break: break-all;">
                                /song/...
                            </code>
                            <button type="button" onclick="copyUrl()" class="btn btn-secondary" 
                                    style="padding: 8px 15px; font-size: 0.9rem;">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Primary Artist - Virtualized dropdown for better performance -->
            <div class="form-group">
                <label>
                    <i class="fas fa-microphone" style="color: #ff5500;"></i>
                    Primary Artist <span style="color: #ff5500;">*</span>
                </label>
                
                <div class="searchable-select-container">
                    <div class="searchable-select" onclick="toggleDropdown('primary')">
                        <span id="primarySelectedDisplay">-- Select Primary Artist --</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    
                    <div id="primaryDropdown" class="searchable-dropdown" style="display: none;">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="primarySearch" placeholder="Search artists..." 
                                   onkeyup="debounceFilter('primary')" autocomplete="off">
                        </div>
                        <div class="artist-list" id="primaryArtistList"></div>
                        <div class="dropdown-footer">
                            <button type="button" onclick="showCreateArtist('primary')" class="btn btn-secondary btn-sm">
                                <i class="fas fa-plus-circle"></i> Create New Artist
                            </button>
                        </div>
                    </div>
                </div>
                
                <input type="hidden" name="artist" id="primaryArtistInput" value="">
            </div>
            
            <!-- Featured Artists - Lazy loaded -->
            <div class="form-group">
                <label>
                    <i class="fas fa-users" style="color: #ff5500;"></i>
                    Featured Artists
                </label>
                
                <div id="selectedFeaturedContainer" class="tags-container"></div>
                
                <div class="searchable-select-container">
                    <div class="searchable-select" onclick="toggleDropdown('featured')">
                        <span id="featuredSelectedDisplay">-- Add Featured Artist --</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    
                    <div id="featuredDropdown" class="searchable-dropdown" style="display: none;">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="featuredSearch" placeholder="Search artists..." 
                                   onkeyup="debounceFilter('featured')" autocomplete="off">
                        </div>
                        <div class="artist-list" id="featuredArtistList"></div>
                        <div class="dropdown-footer">
                            <button type="button" onclick="showCreateArtist('featured')" class="btn btn-secondary btn-sm">
                                <i class="fas fa-plus-circle"></i> Create New Artist
                            </button>
                        </div>
                    </div>
                </div>
                
                <input type="hidden" name="featured" id="featuredInput" value="">
            </div>
            
            <!-- GENRE SELECTION - Optimized palette -->
            <div class="form-group">
                <label>
                    <i class="fas fa-tags" style="color: #ff5500;"></i>
                    Genre
                </label>
                
                <div id="selectedGenreContainer" class="tags-container"></div>
                
                <div class="searchable-select-container">
                    <div class="searchable-select" onclick="toggleDropdown('genre')">
                        <span id="genreSelectedDisplay">-- Add Genre --</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    
                    <div id="genreDropdown" class="searchable-dropdown" style="display: none;">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="genreSearch" placeholder="Search genres..." 
                                   onkeyup="debounceFilter('genre')" autocomplete="off">
                        </div>
                        <div class="artist-list" id="genreList"></div>
                        <div class="dropdown-footer">
                            <button type="button" onclick="showCreateGenre()" class="btn btn-secondary btn-sm">
                                <i class="fas fa-plus-circle"></i> Create New Genre
                            </button>
                        </div>
                    </div>
                </div>
                
                <div id="genreNewContainer" style="display: none;">
                    <div class="new-genre-form">
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
                            <input type="text" id="genreNewId" class="form-control" 
                                   placeholder="Genre ID (e.g., dancehall)" style="flex: 1;">
                            <input type="text" id="genreNewName" class="form-control" 
                                   placeholder="Display Name" style="flex: 1;">
                        </div>
                        
                        <!-- Color Palette - Grid optimized -->
                        <div class="color-palette">
                            <label style="display: block; margin-bottom: 5px;">Color</label>
                            <div class="color-grid">
                                ${generateColorPaletteHtml(colorPalette)}
                            </div>
                        </div>
                        
                        <!-- Icon Grid -->
                        <div class="icon-palette">
                            <label style="display: block; margin-bottom: 5px;">Icon</label>
                            <div class="icon-grid">
                                ${generateIconGridHtml(iconOptions)}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 8px; margin-top: 15px;">
                            <button type="button" onclick="saveNewGenre()" class="btn btn-primary" style="flex: 1;">
                                <i class="fas fa-save"></i> Create
                            </button>
                            <button type="button" onclick="cancelNewGenre()" class="btn btn-secondary" style="flex: 1;">
                                <i class="fas fa-times"></i> Cancel
                            </button>
                        </div>
                    </div>
                </div>
                
                <input type="hidden" name="genre" id="genreInput" value="">
            </div>
            
            <!-- Description -->
            <div class="form-group">
                <label>
                    <i class="fas fa-align-left" style="color: #ff5500;"></i>
                    Description
                </label>
                <textarea name="description" class="form-control" rows="3" 
                          placeholder="Song description..." required></textarea>
            </div>
            
            <!-- Album Selection -->
            <div class="form-group">
                <label>
                    <i class="fas fa-compact-disc" style="color: #ff5500;"></i>
                    Album (Optional)
                </label>
                <select name="album" id="albumSelect" class="form-control">
                    <option value="">-- Select Album --</option>
                    ${albumOptions}
                    <option value="__create_new__">➕ Create New Album</option>
                </select>
            </div>
            
            <!-- Playlist Selection -->
            <div class="form-group">
                <label>
                    <i class="fas fa-list" style="color: #ff5500;"></i>
                    Add to Playlist (Optional)
                </label>
                <select name="playlist" id="playlistSelect" class="form-control">
                    <option value="">-- Select Playlist --</option>
                    ${playlistOptions}
                    <option value="__create_new__">➕ Create New Playlist</option>
                </select>
            </div>
            
            <!-- Audio File -->
            <div class="form-group">
                <label>
                    <i class="fas fa-file-audio" style="color: #ff5500;"></i>
                    Audio File (.mp3)
                </label>
                <input type="file" name="audio" id="audioFile" accept=".mp3" class="form-control" required>
                
                <div id="durationContainer" style="margin-top: 15px; display: none;">
                    <div class="duration-display">
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <i class="fas fa-clock" style="color: #ff5500;"></i>
                            <span style="font-weight: 600;">Duration:</span>
                            <span id="durationText">Analyzing...</span>
                            <span id="exactBadge" style="display: none;" class="exact-badge">EXACT</span>
                        </div>
                    </div>
                </div>
                
                <div id="progressContainer" style="margin-top: 10px; display: none;">
                    <div class="progress-bar">
                        <div id="progressFill" class="progress-fill"></div>
                    </div>
                </div>
                
                <input type="hidden" name="duration" id="durationInput" value="">
            </div>
            
            <!-- Thumbnail Image -->
            <div class="form-group">
                <label>
                    <i class="fas fa-image" style="color: #ff5500;"></i>
                    Thumbnail Image
                </label>
                <input type="file" name="image" accept="image/*" class="form-control" required>
            </div>
            
            <!-- Submit Button -->
            <div style="margin-top: 30px;">
                <button type="submit" id="submitBtn" class="btn btn-primary btn-block" style="padding: 16px;">
                    <i class="fas fa-cloud-upload-alt"></i> Upload Song
                </button>
            </div>
            
            <!-- Loading Overlay -->
            <div id="loadingOverlay" class="loading-overlay" style="display: none;">
                <div class="loading-modal">
                    <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #ff5500;"></i>
                    <h3>Uploading...</h3>
                    <p>Please don't close this page</p>
                </div>
            </div>
        </form>
    </div>
    
    <style>
        /* Optimized CSS - Combined and minified */
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; overflow-x: hidden; }
        
        .form-group { margin-bottom: 20px; width: 100%; }
        
        .form-control {
            width: 100%; padding: 12px 15px; border: 2px solid #e0e0e0;
            border-radius: 8px; font-size: 16px; transition: border-color 0.2s;
        }
        .form-control:focus { outline: none; border-color: #ff5500; }
        
        .searchable-select-container { position: relative; width: 100%; }
        .searchable-select {
            width: 100%; padding: 12px 15px; background: white;
            border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer;
            display: flex; justify-content: space-between; align-items: center;
            min-height: 44px;
        }
        .searchable-select:hover { border-color: #ff5500; }
        
        .searchable-dropdown {
            position: absolute; top: 100%; left: 0; right: 0; background: white;
            border: 2px solid #e0e0e0; border-radius: 8px; margin-top: 5px;
            max-height: 400px; overflow: hidden; z-index: 1000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .search-box {
            padding: 10px; border-bottom: 1px solid #e0e0e0;
            display: flex; align-items: center; gap: 8px;
        }
        .search-box input { flex: 1; border: none; outline: none; font-size: 14px; padding: 8px 0; }
        
        .artist-list { max-height: 250px; overflow-y: auto; padding: 5px 0; }
        
        .artist-item {
            padding: 10px 15px; cursor: pointer; display: flex;
            justify-content: space-between; align-items: center;
            transition: background 0.2s;
        }
        .artist-item:hover { background: #f0f0f0; }
        .artist-item.selected { background: #fff0e6; border-left: 3px solid #ff5500; }
        
        .tags-container {
            display: flex; flex-wrap: wrap; gap: 8px;
            margin-bottom: 12px; min-height: 40px;
        }
        
        .featured-tag {
            display: inline-flex; align-items: center; gap: 6px;
            background: #f0f0f0; border-radius: 30px; padding: 6px 12px;
            font-size: 0.9rem; border: 1px solid #e0e0e0;
            animation: slideIn 0.3s ease;
        }
        
        .genre-tag {
            display: inline-flex; align-items: center; gap: 6px;
            background: #ff5500; color: white; border-radius: 30px;
            padding: 6px 15px; font-size: 0.9rem; animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .btn {
            padding: 12px 20px; border: none; border-radius: 6px;
            cursor: pointer; font-size: 1rem; transition: background 0.2s;
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn-primary { background: #ff5500; color: white; }
        .btn-primary:hover { background: #e64c00; }
        .btn-secondary { background: #6c757d; color: white; }
        .btn-secondary:hover { background: #5a6268; }
        .btn-block { width: 100%; }
        
        .progress-bar {
            height: 4px; background: #f0f0f0; border-radius: 2px; overflow: hidden;
        }
        .progress-fill {
            height: 100%; background: #ff5500; width: 0%;
            transition: width 0.3s;
        }
        
        .loading-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); z-index: 1000;
            display: flex; align-items: center; justify-content: center;
        }
        .loading-modal {
            background: white; padding: 30px; border-radius: 12px;
            text-align: center; max-width: 300px; margin: 20px;
        }
        
        .color-grid {
            display: grid; grid-template-columns: repeat(5, 1fr);
            gap: 8px; margin-bottom: 15px;
        }
        .icon-grid {
            display: grid; grid-template-columns: repeat(6, 1fr);
            gap: 8px; margin-bottom: 15px;
        }
        
        @media (max-width: 768px) {
            .searchable-dropdown {
                position: fixed; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 90%; max-width: 400px; max-height: 80vh;
            }
            .btn { width: 100%; margin: 5px 0; }
            .color-grid { grid-template-columns: repeat(3, 1fr); }
            .icon-grid { grid-template-columns: repeat(3, 1fr); }
        }
    </style>
    
    <script>
        // Optimized JavaScript with debouncing and efficient data structures
        (function() {
            // Data initialization
            const artistsData = ${JSON.stringify(Object.entries(artists).map(([id, artist]) => ({
                id,
                name: artist.name,
                songCount: artist.songs?.length || 0
            })).sort((a, b) => a.name.localeCompare(b.name)))};
            
            const genresData = ${JSON.stringify(genres)};
            
            // State management
            const state = {
                featuredArtists: new Set(),
                selectedGenre: null,
                audioContext: null,
                searchDebounceTimers: new Map()
            };
            
            // DOM cache
            const dom = {
                audioFile: document.getElementById('audioFile'),
                durationContainer: document.getElementById('durationContainer'),
                durationText: document.getElementById('durationText'),
                durationInput: document.getElementById('durationInput'),
                progressContainer: document.getElementById('progressContainer'),
                progressFill: document.getElementById('progressFill'),
                exactBadge: document.getElementById('exactBadge'),
                submitBtn: document.getElementById('submitBtn'),
                loadingOverlay: document.getElementById('loadingOverlay'),
                urlPreview: document.getElementById('urlPreview'),
                songTitle: document.getElementById('songTitle'),
                primarySelectedDisplay: document.getElementById('primarySelectedDisplay'),
                primaryArtistInput: document.getElementById('primaryArtistInput'),
                selectedFeaturedContainer: document.getElementById('selectedFeaturedContainer'),
                featuredInput: document.getElementById('featuredInput'),
                selectedGenreContainer: document.getElementById('selectedGenreContainer'),
                genreInput: document.getElementById('genreInput')
            };
            
            // Debounce utility
            function debounce(func, wait, key) {
                return function(...args) {
                    clearTimeout(state.searchDebounceTimers.get(key));
                    state.searchDebounceTimers.set(key, setTimeout(() => func.apply(this, args), wait));
                };
            }
            
            // URL Preview with debouncing
            function updateUrlPreview() {
                const title = dom.songTitle.value.trim();
                const artistName = dom.primarySelectedDisplay.textContent;
                
                if (!title) {
                    dom.urlPreview.textContent = '/song/...';
                    return;
                }
                
                const slug = title.toLowerCase()
                    .replace(/[^a-z0-9\\s]/g, '')
                    .replace(/\\s+/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '') || 'untitled';
                
                dom.urlPreview.textContent = window.location.origin + '/song/' + slug;
            }
            
            // Debounced URL update
            const debouncedUrlUpdate = debounce(updateUrlPreview, 300, 'url');
            
            // Event listeners
            dom.songTitle.addEventListener('input', debouncedUrlUpdate);
            
            // Dropdown toggling
            window.toggleDropdown = function(type) {
                document.querySelectorAll('.searchable-dropdown').forEach(d => d.style.display = 'none');
                const dropdown = document.getElementById(type + 'Dropdown');
                dropdown.style.display = 'block';
                
                if (type === 'genre') {
                    renderGenreList('');
                    document.getElementById('genreSearch').focus();
                } else {
                    renderArtistList(type, '');
                    document.getElementById(type + 'Search').focus();
                }
            };
            
            // Efficient filtering with debouncing
            window.debounceFilter = debounce(function(type) {
                const searchTerm = document.getElementById(type + 'Search').value.toLowerCase();
                if (type === 'genre') {
                    renderGenreList(searchTerm);
                } else {
                    renderArtistList(type, searchTerm);
                }
            }, 200);
            
            // Optimized artist list rendering
            function renderArtistList(type, searchTerm) {
                const listContainer = document.getElementById(type + 'ArtistList');
                const filtered = searchTerm ? 
                    artistsData.filter(a => a.name.toLowerCase().includes(searchTerm)) : 
                    artistsData;
                
                if (filtered.length === 0) {
                    listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">No artists found</div>';
                    return;
                }
                
                const selectedId = type === 'primary' ? dom.primaryArtistInput.value : null;
                
                // Use DocumentFragment for better performance
                const fragment = document.createDocumentFragment();
                filtered.forEach(artist => {
                    const isSelected = type === 'primary' ? artist.id === selectedId : state.featuredArtists.has(artist.id);
                    const div = document.createElement('div');
                    div.className = 'artist-item' + (isSelected ? ' selected' : '');
                    div.onclick = () => selectArtist(type, artist.id, artist.name);
                    div.innerHTML = \`
                        <span class="artist-name">\${artist.name}</span>
                        <span class="artist-song-count">\${artist.songCount} songs</span>
                    \`;
                    fragment.appendChild(div);
                });
                
                listContainer.innerHTML = '';
                listContainer.appendChild(fragment);
            }
            
            // Optimized genre list rendering
            function renderGenreList(searchTerm) {
                const listContainer = document.getElementById('genreList');
                const filtered = searchTerm ? 
                    genresData.filter(g => g.name.toLowerCase().includes(searchTerm) || g.id.includes(searchTerm)) : 
                    genresData;
                
                if (filtered.length === 0) {
                    listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">No genres found</div>';
                    return;
                }
                
                const fragment = document.createDocumentFragment();
                filtered.forEach(genre => {
                    const div = document.createElement('div');
                    div.className = 'artist-item' + (state.selectedGenre === genre.id ? ' selected' : '');
                    div.onclick = () => selectGenre(genre.id, genre.name, genre.color);
                    div.innerHTML = \`
                        <span style="display: flex; align-items: center; gap: 8px;">
                            <i class="fas \${genre.icon}" style="color: \${genre.color};"></i>
                            <span class="artist-name">\${genre.name}</span>
                        </span>
                        <span class="artist-song-count">\${genre.id}</span>
                    \`;
                    fragment.appendChild(div);
                });
                
                listContainer.innerHTML = '';
                listContainer.appendChild(fragment);
            }
            
            // Selection functions
            window.selectArtist = function(type, id, name) {
                if (type === 'primary') {
                    dom.primaryArtistInput.value = id;
                    dom.primarySelectedDisplay.textContent = name;
                    updateUrlPreview();
                } else {
                    if (!state.featuredArtists.has(id)) {
                        state.featuredArtists.add(id);
                        updateFeaturedTags();
                    }
                }
                document.getElementById(type + 'Dropdown').style.display = 'none';
            };
            
            window.selectGenre = function(id, name, color) {
                state.selectedGenre = id;
                updateGenreTag(name, color);
                document.getElementById('genreDropdown').style.display = 'none';
            };
            
            // Tag management
            function updateFeaturedTags() {
                if (state.featuredArtists.size === 0) {
                    dom.selectedFeaturedContainer.innerHTML = '<div style="color:#999; padding:8px 0;">No featured artists added</div>';
                    dom.featuredInput.value = '';
                    return;
                }
                
                const fragment = document.createDocumentFragment();
                state.featuredArtists.forEach((id, index) => {
                    const artist = artistsData.find(a => a.id === id);
                    const name = artist ? artist.name : id.startsWith('new_') ? id.replace('new_', '') : id;
                    
                    const tag = document.createElement('div');
                    tag.className = 'featured-tag';
                    tag.innerHTML = \`<span>\${name}</span><i class="fas fa-times-circle" onclick="removeFeatured('\${id}')"></i>\`;
                    fragment.appendChild(tag);
                });
                
                dom.selectedFeaturedContainer.innerHTML = '';
                dom.selectedFeaturedContainer.appendChild(fragment);
                dom.featuredInput.value = JSON.stringify([...state.featuredArtists]);
            }
            
            function updateGenreTag(name, color) {
                if (state.selectedGenre) {
                    dom.selectedGenreContainer.innerHTML = \`
                        <div class="genre-tag" style="background: \${color};">
                            <span>\${name}</span>
                            <i class="fas fa-times-circle" onclick="removeGenre()"></i>
                        </div>
                    \`;
                    dom.genreInput.value = state.selectedGenre;
                } else {
                    dom.selectedGenreContainer.innerHTML = '<div style="color:#999; padding:8px 0;">No genres added</div>';
                    dom.genreInput.value = '';
                }
            }
            
            window.removeFeatured = function(id) {
                state.featuredArtists.delete(id);
                updateFeaturedTags();
            };
            
            window.removeGenre = function() {
                state.selectedGenre = null;
                updateGenreTag();
            };
            
            // New artist creation
            window.showCreateArtist = function(type) {
                document.getElementById(type + 'Dropdown').style.display = 'none';
                document.getElementById(type + 'NewArtistContainer').style.display = 'block';
                document.getElementById(type + 'NewArtistName').focus();
            };
            
            window.saveNewArtist = function(type) {
                const name = document.getElementById(type + 'NewArtistName').value.trim();
                if (!name) { alert('Please enter a name'); return; }
                
                const tempId = 'new_' + name.replace(/\\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
                
                if (type === 'primary') {
                    dom.primaryArtistInput.value = tempId;
                    dom.primarySelectedDisplay.textContent = name + ' (new)';
                    updateUrlPreview();
                } else {
                    if (!state.featuredArtists.has(tempId)) {
                        state.featuredArtists.add(tempId);
                        updateFeaturedTags();
                    }
                }
                
                document.getElementById(type + 'NewArtistContainer').style.display = 'none';
                document.getElementById(type + 'NewArtistName').value = '';
            };
            
            window.cancelNewArtist = function(type) {
                document.getElementById(type + 'NewArtistContainer').style.display = 'none';
                document.getElementById(type + 'NewArtistName').value = '';
            };
            
            // New genre creation
            window.showCreateGenre = function() {
                document.getElementById('genreDropdown').style.display = 'none';
                document.getElementById('genreNewContainer').style.display = 'block';
                document.getElementById('genreNewName').focus();
            };
            
            window.saveNewGenre = function() {
                const id = document.getElementById('genreNewId').value.trim().toLowerCase().replace(/\\s+/g, '-');
                const name = document.getElementById('genreNewName').value.trim();
                const color = document.querySelector('input[name="newGenreColor"]:checked')?.value;
                const icon = document.querySelector('input[name="newGenreIcon"]:checked')?.value;
                
                if (!id || !name || !color || !icon) {
                    alert('Please fill in all fields');
                    return;
                }
                
                const newGenre = { id, name, color, icon };
                genresData.push(newGenre);
                state.selectedGenre = id;
                updateGenreTag(name, color);
                
                dom.genreInput.value = 'new_' + JSON.stringify(newGenre);
                
                document.getElementById('genreNewContainer').style.display = 'none';
                document.getElementById('genreNewId').value = '';
                document.getElementById('genreNewName').value = '';
            };
            
            window.cancelNewGenre = function() {
                document.getElementById('genreNewContainer').style.display = 'none';
                document.getElementById('genreNewId').value = '';
                document.getElementById('genreNewName').value = '';
            };
            
            // Close dropdown on outside click
            document.addEventListener('click', function(e) {
                if (!e.target.closest('.searchable-select-container')) {
                    document.querySelectorAll('.searchable-dropdown').forEach(d => d.style.display = 'none');
                }
            });
            
            // Album/Playlist redirects
            document.getElementById('albumSelect')?.addEventListener('change', function() {
                if (this.value === '__create_new__') window.location.href = '/admin/album/create';
            });
            
            document.getElementById('playlistSelect')?.addEventListener('change', function() {
                if (this.value === '__create_new__') window.location.href = '/admin/playlist/create';
            });
            
            // Audio duration detection - Optimized
            dom.audioFile.addEventListener('change', async function(e) {
                const file = e.target.files[0];
                if (!file) return;
                
                dom.durationContainer.style.display = 'block';
                dom.progressContainer.style.display = 'block';
                dom.progressFill.style.width = '30%';
                dom.submitBtn.disabled = true;
                dom.submitBtn.style.opacity = '0.5';
                
                try {
                    if (!state.audioContext) {
                        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    
                    const buffer = await file.arrayBuffer();
                    dom.progressFill.style.width = '60%';
                    
                    state.audioContext.decodeAudioData(buffer,
                        function(b) {
                            const sec = b.duration;
                            const min = Math.floor(sec / 60);
                            const secs = Math.floor(sec % 60);
                            dom.durationText.innerHTML = \`\${min}:\${secs.toString().padStart(2,'0')}\`;
                            dom.durationInput.value = sec.toFixed(3);
                            dom.exactBadge.style.display = 'inline-block';
                            dom.progressFill.style.width = '100%';
                            dom.submitBtn.disabled = false;
                            dom.submitBtn.style.opacity = '1';
                            setTimeout(() => dom.progressContainer.style.display = 'none', 500);
                        },
                        function() {
                            dom.durationText.innerHTML = 'Could not detect exact duration';
                            dom.durationInput.value = '0';
                            dom.progressContainer.style.display = 'none';
                            dom.submitBtn.disabled = false;
                            dom.submitBtn.style.opacity = '1';
                        }
                    );
                } catch (error) {
                    dom.durationText.innerHTML = 'Error analyzing file';
                    dom.durationInput.value = '0';
                    dom.progressContainer.style.display = 'none';
                    dom.submitBtn.disabled = false;
                    dom.submitBtn.style.opacity = '1';
                }
            });
            
            // Form submission
            document.getElementById('uploadForm').addEventListener('submit', function(e) {
                if (!dom.durationInput.value || dom.durationInput.value === '0' || dom.durationInput.value === '0.000') {
                    if (!confirm('⚠️ No exact duration. Continue with estimate?')) {
                        e.preventDefault();
                        return;
                    }
                }
                dom.loadingOverlay.style.display = 'flex';
            });
            
            // Copy URL function
            window.copyUrl = function() {
                navigator.clipboard.writeText(dom.urlPreview.textContent).then(() => {
                    const btn = event.target.closest('button');
                    const originalHtml = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
                }).catch(() => {
                    alert('URL: ' + dom.urlPreview.textContent);
                });
            };
            
            // Initialize
            updateUrlPreview();
            updateFeaturedTags();
            updateGenreTag();
        })();
    </script>
  `;

  return content;
}

// Helper function to generate options HTML efficiently
function generateOptionsHtml(items, type) {
  if (!items || Object.keys(items).length === 0) return '';
  
  return Object.keys(items).map(id => {
    const item = items[id];
    if (type === 'album') {
      return `<option value="${id}">${item.title} (${item.songs?.length || 0} tracks)${item.genre ? ` - ${item.genre}` : ''}</option>`;
    }
    if (type === 'artist') {
      return `<option value="${id}">${item.name} (${item.songs?.length || 0} songs)${item.genre ? ` - ${item.genre}` : ''}</option>`;
    }
    if (type === 'playlist') {
      return `<option value="${id}">${item.title} (${item.songs?.length || 0} songs)</option>`;
    }
    return '';
  }).join('');
}

function generateColorPaletteHtml(colors) {
  return colors.map(color => `
    <label style="display: block; cursor: pointer;">
        <input type="radio" name="newGenreColor" value="${color}" style="display: none;">
        <div style="height: 40px; background: ${color}; border-radius: 8px; border: 2px solid transparent;" 
             onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.color-preview').forEach(el => el.style.borderColor = 'transparent'); this.style.borderColor = '#333';">
        </div>
    </label>
  `).join('');
}

function generateIconGridHtml(icons) {
  return icons.map(icon => `
    <label style="display: block; cursor: pointer; text-align: center;">
        <input type="radio" name="newGenreIcon" value="${icon}" style="display: none;">
        <div style="padding: 10px; border: 2px solid #e8e8e8; border-radius: 8px;" 
             onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.icon-preview').forEach(el => el.style.borderColor = '#e8e8e8'); this.style.borderColor = '#ff5500';">
            <i class="fas ${icon}" style="font-size: 1.2rem;"></i>
        </div>
    </label>
  `).join('');
}

// ===== OPTIMIZED POST HANDLER =====
export async function handleAdminUploadPost(req, env, ctx, auth) {
  try {
    const formData = await req.formData();
    const title = formData.get('title');
    const artist = formData.get('artist');
    const description = formData.get('description');
    const audioFile = formData.get('audio');
    const imageFile = formData.get('image');
    const albumId = formData.get('album');
    const playlistId = formData.get('playlist');
    const featuredJson = formData.get('featured');
    const browserDuration = formData.get('duration');
    const genreInput = formData.get('genre');

    if (!title || !audioFile || !imageFile) {
      return { success: false, error: 'Missing required fields' };
    }

    // Parse featured artists
    let featuredArtists = [];
    if (featuredJson) {
      try {
        featuredArtists = JSON.parse(featuredJson);
      } catch (e) {
        console.error('Error parsing featured artists:', e);
      }
    }

    // Process genre
    let genre = null;
    if (genreInput) {
      if (genreInput.startsWith('new_')) {
        const genreData = JSON.parse(genreInput.replace('new_', ''));
        const genreManager = new GenreManager(env);
        await genreManager.addGenre(genreData);
        genre = genreData.id;
      } else {
        genre = genreInput;
      }
    }

    // Batch process new artists
    const artists = await getArtists(env);
    const artistsToSave = { ...artists };
    let artistsModified = false;

    // Process primary artist
    let artistName = artist;
    let artistId = artist;
    if (artist && artist.startsWith('new_')) {
      artistName = artist.replace('new_', '');
      artistId = sanitize(artistName);
      if (!artistsToSave[artistId]) {
        artistsToSave[artistId] = createNewArtist(artistId, artistName);
        artistsModified = true;
      }
    }

    // Process featured artists
    const processedFeatured = [];
    for (const feat of featuredArtists) {
      if (feat.startsWith('new_')) {
        const newArtistName = feat.replace('new_', '');
        const newArtistId = sanitize(newArtistName);
        if (!artistsToSave[newArtistId]) {
          artistsToSave[newArtistId] = createNewArtist(newArtistId, newArtistName);
          artistsModified = true;
        }
        processedFeatured.push(newArtistId);
      } else {
        processedFeatured.push(feat);
      }
    }

    // Save artists only if modified
    if (artistsModified) {
      await saveArtists(env, artistsToSave);
    }

    const safeTitle = sanitize(title);
    const safeArtist = sanitize(artistName);
    const baseName = `${safeArtist}_${safeTitle}`;

    const audioKey = `songs/${baseName}.mp3`;
    const descKey = `descriptions/${baseName}.txt`;
    const imgType = imageFile.type.includes('png') ? 'png' : 'jpg';
    const imageKey = `images/${baseName}.${imgType}`;

    // Process audio in parallel with other operations
    const audioBuffer = await audioFile.arrayBuffer();

    let duration;
    if (browserDuration && browserDuration !== '0' && browserDuration !== '0.000') {
      duration = parseFloat(browserDuration);
    } else {
      duration = fallbackDurationParser(audioBuffer);
    }

    // Parallel operations for better performance
    const SITENAME = "ZEDALBUMS";
    
    // Tag audio and upload
    const taggedMp3 = addID3Tags(audioBuffer, {
      title: `${title} (${SITENAME})`,
      artist: `${artistName} | ${SITENAME}`,
      duration: Math.floor(duration * 1000)
    });
    
    const finalFilename = `${title} (${SITENAME}).mp3`;
    
    // Upload all files in parallel
    await Promise.all([
      env.media.put(audioKey, taggedMp3, {
        httpMetadata: { 
          contentType: 'audio/mpeg',
          contentDisposition: `inline; filename="${finalFilename}"`
        }
      }),
      env.media.put(imageKey, imageFile.stream()),
      env.media.put(descKey, description)
    ]);

    // Generate and register slug
    const slugManager = new SlugManager(env);
    const baseSlug = slugManager.generateSongSlug(title, '');
    const finalSlug = await slugManager.generateUniqueSlug('songs', baseSlug);
    
    await slugManager.registerSlug('songs', baseName, finalSlug, {
      title,
      artist: artistId,
      artistName,
      duration,
      genre,
      featured: processedFeatured,
      uploadedAt: Date.now()
    });

    // Save metadata
    await saveMetadata(env, baseName, {
      title,
      primaryArtist: artistId,
      featuredArtists: processedFeatured,
      description,
      duration,
      genre,
      filename: finalFilename
    });

    // Handle associations in parallel
    const associationPromises = [
      addSongToArtist(env, artistId, baseName)
    ];

    if (albumId && albumId !== '' && albumId !== '__create_new__') {
      associationPromises.push(
        addSongToAlbum(env, albumId, baseName),
        addAlbumToArtist(env, artistId, albumId),
        addArtistToAlbum(env, artistId, albumId)
      );
    }

    if (playlistId && playlistId !== '' && playlistId !== '__create_new__') {
      associationPromises.push(addSongToPlaylist(env, playlistId, baseName));
    }

    for (const fid of processedFeatured) {
      associationPromises.push(addSongToArtist(env, fid, baseName));
    }

    await Promise.all(associationPromises);

    // Log activity (non-critical, don't await)
    logAdminActivity(env, auth.session.id, 'upload', 'song', baseName, title).catch(console.error);

    return {
      success: true,
      baseName,
      slug: finalSlug,
      title,
      artistName,
      duration,
      albumId,
      playlistId,
      filename: finalFilename
    };
    
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

function createNewArtist(id, name) {
  return {
    id,
    name,
    description: '',
    thumbnail: '',
    created: Date.now(),
    songs: [],
    albums: []
  };
}

// ===== ID3 TAGGING FUNCTIONS (Optimized) =====
function addID3Tags(audioBuffer, tags) {
  const audioBytes = new Uint8Array(audioBuffer);
  const frames = [];
  
  if (tags.artist) frames.push(createTextFrame('TPE1', tags.artist));
  if (tags.title) frames.push(createTextFrame('TIT2', tags.title));
  if (tags.duration) frames.push(createTextFrame('TLEN', tags.duration.toString()));
  
  const framesSize = frames.reduce((acc, f) => acc + f.length, 0);
  
  // Pre-allocate buffer for better performance
  const final = new Uint8Array(10 + framesSize + audioBytes.length);
  
  // Write header
  final[0] = 0x49; // I
  final[1] = 0x44; // D
  final[2] = 0x33; // 3
  final[3] = 0x03; // Version 2.3.0
  final[4] = 0x00;
  final[5] = 0x00;
  
  // Write size (syncsafe)
  const size = encodeSynchsafe(framesSize);
  final[6] = size[0];
  final[7] = size[1];
  final[8] = size[2];
  final[9] = size[3];
  
  // Write frames
  let offset = 10;
  for (const f of frames) {
    final.set(f, offset);
    offset += f.length;
  }
  
  // Write audio data
  final.set(audioBytes, offset);
  
  return final;
}

function createTextFrame(type, value) {
  const enc = new TextEncoder().encode(value);
  const frame = new Uint8Array(10 + 1 + enc.length);
  
  // Frame ID
  frame[0] = type.charCodeAt(0);
  frame[1] = type.charCodeAt(1);
  frame[2] = type.charCodeAt(2);
  frame[3] = type.charCodeAt(3);
  
  // Frame size
  const size = 1 + enc.length;
  frame[4] = (size >> 24) & 0xFF;
  frame[5] = (size >> 16) & 0xFF;
  frame[6] = (size >> 8) & 0xFF;
  frame[7] = size & 0xFF;
  
  // Flags
  frame[8] = 0x00;
  frame[9] = 0x00;
  
  // Encoding (0 = ISO-8859-1)
  frame[10] = 0x00;
  
  // Frame content
  frame.set(enc, 11);
  
  return frame;
}

function encodeSynchsafe(size) {
  return [
    (size >> 21) & 0x7F,
    (size >> 14) & 0x7F,
    (size >> 7) & 0x7F,
    size & 0x7F
  ];
}