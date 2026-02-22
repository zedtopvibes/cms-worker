// ==================== ADMIN  UPLOAD HELPER FUNCTIONS ====================
import { getAlbums, getArtists, getPlaylists, saveArtists, saveMetadata, addSongToAlbum, addSongToPlaylist, addSongToArtist, addAlbumToArtist, addArtistToAlbum } from '../../helpers/storage.js';
import { sanitize, formatDuration, fallbackDurationParser } from '../../helpers/formatting.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';
import { GenreManager } from '../../helpers/genreManager.js';
// REMOVE: import { SlugManager } from '../../helpers/slug.js';

export async function handleAdminUpload(req, env, ctx, auth) {
  const albums = await getAlbums(env);
  const artists = await getArtists(env);
  const playlists = await getPlaylists(env);
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  const genres = genresData.genres;
  
  const albumOptions = Object.keys(albums).map(id => {
    const album = albums[id];
    return `<option value="${id}">${album.title} (${album.songs?.length || 0} tracks)${album.genre ? ` - ${album.genre}` : ''}</option>`;
  }).join("");

  const artistOptions = Object.keys(artists).map(id => {
    const artist = artists[id];
    const songCount = artist.songs?.length || 0;
    return `<option value="${id}">${artist.name} (${songCount} songs)${artist.genre ? ` - ${artist.genre}` : ''}</option>`;
  }).join("");

  const playlistOptions = Object.keys(playlists).map(id => {
    const playlist = playlists[id];
    return `<option value="${id}">${playlist.title} (${playlist.songs?.length || 0} songs)</option>`;
  }).join("");

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
                <input type="text" name="title" id="songTitle" class="form-control" placeholder="e.g. My Song" required>
                
                <!-- URL Preview Section - Mobile Friendly -->
                <div style="margin-top: 10px; background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0;">
                    <div style="display: flex; align-items: flex-start; gap: 8px; flex-direction: column;">
                        <div style="display: flex; align-items: center; gap: 5px; color: #666; width: 100%;">
                            <i class="fas fa-link" style="color: #ff5500; flex-shrink: 0;"></i>
                            <span style="font-size: 0.9rem; font-weight: 500;">Final URL:</span>
                        </div>
                        <div style="display: flex; width: 100%; gap: 8px; flex-wrap: wrap;">
                            <code id="urlPreview" style="flex: 1; min-width: 200px; padding: 8px 10px; background: white; border-radius: 4px; font-size: 0.85rem; border: 1px solid #e0e0e0; word-break: break-all; white-space: normal;">
                                /song/...
                            </code>
                            <button type="button" onclick="copyUrl()" class="btn btn-secondary" style="padding: 8px 15px; font-size: 0.9rem; white-space: nowrap;">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                    <p style="font-size: 0.8rem; color: #666; margin-top: 8px; margin-bottom: 0;">
                        <i class="fas fa-info-circle"></i> 
                        URL is generated from the title and artist name.
                    </p>
                </div>
            </div>
            
            <!-- Primary Artist - Searchable Select -->
            <div class="form-group">
                <label>
                    <i class="fas fa-microphone" style="color: #ff5500; width: 20px;"></i>
                    Primary Artist
                </label>
                
                <div class="searchable-select-container">
                    <div class="searchable-select" onclick="toggleDropdown('primary')">
                        <span id="primarySelectedDisplay">-- Select Primary Artist --</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    
                    <div id="primaryDropdown" class="searchable-dropdown" style="display: none;">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="primarySearch" placeholder="Search artists..." onkeyup="filterArtists('primary')">
                        </div>
                        <div class="artist-list" id="primaryArtistList"></div>
                        <div class="dropdown-footer">
                            <button type="button" onclick="showCreateArtist('primary')" class="btn btn-secondary btn-sm" style="width: 100%;">
                                <i class="fas fa-plus-circle"></i> Create New Artist
                            </button>
                        </div>
                    </div>
                </div>
                
                <input type="hidden" name="artist" id="primaryArtistInput" value="">
                
                <div id="primaryNewArtistContainer" style="margin-top: 10px; display: none;">
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <input type="text" id="primaryNewArtistName" class="form-control" placeholder="Enter new artist name" style="flex: 1; min-width: 200px;">
                        <button type="button" onclick="saveNewArtist('primary')" class="btn btn-primary">
                            <i class="fas fa-save"></i> Save
                        </button>
                        <button type="button" onclick="cancelNewArtist('primary')" class="btn btn-secondary">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Featured Artists -->
            <div class="form-group">
                <label>
                    <i class="fas fa-users" style="color: #ff5500; width: 20px;"></i>
                    Featured Artists
                </label>
                
                <div id="selectedFeaturedContainer" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; min-height: 40px;"></div>
                
                <div class="searchable-select-container">
                    <div class="searchable-select" onclick="toggleDropdown('featured')">
                        <span id="featuredSelectedDisplay">-- Add Featured Artist --</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    
                    <div id="featuredDropdown" class="searchable-dropdown" style="display: none;">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="featuredSearch" placeholder="Search artists..." onkeyup="filterArtists('featured')">
                        </div>
                        <div class="artist-list" id="featuredArtistList"></div>
                        <div class="dropdown-footer">
                            <button type="button" onclick="showCreateArtist('featured')" class="btn btn-secondary btn-sm" style="width: 100%;">
                                <i class="fas fa-plus-circle"></i> Create New Artist
                            </button>
                        </div>
                    </div>
                </div>
                
                <div id="featuredNewArtistContainer" style="margin-top: 10px; display: none;">
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <input type="text" id="featuredNewArtistName" class="form-control" placeholder="Enter new artist name" style="flex: 1; min-width: 200px;">
                        <button type="button" onclick="saveNewArtist('featured')" class="btn btn-primary">
                            <i class="fas fa-save"></i> Save
                        </button>
                        <button type="button" onclick="cancelNewArtist('featured')" class="btn btn-secondary">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <input type="hidden" name="featured" id="featuredInput" value="">
                <p style="font-size: 0.8rem; color: #666; margin-top: 8px;">
                    <i class="fas fa-info-circle"></i> Click to search and select artists. Click ✕ on tags to remove.
                </p>
            </div>
            
            <!-- GENRE SELECTION -->
            <div class="form-group">
                <label>
                    <i class="fas fa-tags" style="color: #ff5500; width: 20px;"></i>
                    Genre
                </label>
                
                <div id="selectedGenreContainer" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; min-height: 40px;"></div>
                
                <div class="searchable-select-container">
                    <div class="searchable-select" onclick="toggleDropdown('genre')">
                        <span id="genreSelectedDisplay">-- Add Genre --</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    
                    <div id="genreDropdown" class="searchable-dropdown" style="display: none;">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="genreSearch" placeholder="Search genres..." onkeyup="filterGenres()">
                        </div>
                        <div class="artist-list" id="genreList"></div>
                        <div class="dropdown-footer">
                            <button type="button" onclick="showCreateGenre()" class="btn btn-secondary btn-sm" style="width: 100%;">
                                <i class="fas fa-plus-circle"></i> Create New Genre
                            </button>
                        </div>
                    </div>
                </div>
                
                <div id="genreNewContainer" style="margin-top: 10px; display: none;">
                    <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 15px; background: #f8f9fa;">
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
                            <input type="text" id="genreNewId" class="form-control" placeholder="Genre ID (e.g., dancehall)" style="flex: 1; min-width: 200px;">
                            <input type="text" id="genreNewName" class="form-control" placeholder="Display Name (e.g., Dancehall)" style="flex: 1; min-width: 200px;">
                        </div>
                        
                        <div style="margin-bottom: 15px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 5px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Color</label>
                            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; min-width: 300px;">
                                ${genreManager.getColorPalette().map(color => `
                                    <label style="display: block; cursor: pointer;">
                                        <input type="radio" name="newGenreColor" value="${color}" style="display: none;">
                                        <div style="height: 40px; background: ${color}; border-radius: 8px; border: 2px solid transparent;" 
                                             onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.color-preview').forEach(el => el.style.borderColor = 'transparent'); this.style.borderColor = '#333';">
                                        </div>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 15px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 5px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Icon</label>
                            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; min-width: 400px;">
                                ${genreManager.getIconOptions().map(icon => `
                                    <label style="display: block; cursor: pointer; text-align: center;">
                                        <input type="radio" name="newGenreIcon" value="${icon}" style="display: none;">
                                        <div style="padding: 10px; border: 2px solid #e8e8e8; border-radius: 8px;" 
                                             onclick="this.parentNode.querySelector('input').checked = true; document.querySelectorAll('.icon-preview').forEach(el => el.style.borderColor = '#e8e8e8'); this.style.borderColor = '#ff5500';">
                                            <i class="fas ${icon}" style="font-size: 1.2rem;"></i>
                                        </div>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" onclick="saveNewGenre()" class="btn btn-primary" style="flex: 1; min-width: 120px;">
                                <i class="fas fa-save"></i> Create Genre
                            </button>
                            <button type="button" onclick="cancelNewGenre()" class="btn btn-secondary" style="flex: 1; min-width: 120px;">
                                <i class="fas fa-times"></i> Cancel
                            </button>
                        </div>
                    </div>
                </div>
                
                <input type="hidden" name="genre" id="genreInput" value="">
                <p style="font-size: 0.8rem; color: #666; margin-top: 8px;">
                    <i class="fas fa-info-circle"></i> Select a genre for this song. Click ✕ on tag to remove.
                </p>
            </div>
            
            <!-- Description -->
            <div class="form-group">
                <label>
                    <i class="fas fa-align-left" style="color: #ff5500; width: 20px;"></i>
                    Description
                </label>
                <textarea name="description" class="form-control" rows="3" placeholder="Song description..." required></textarea>
            </div>
            
            <!-- Album Selection -->
            <div class="form-group">
                <label>
                    <i class="fas fa-compact-disc" style="color: #ff5500; width: 20px;"></i>
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
                    <i class="fas fa-list" style="color: #ff5500; width: 20px;"></i>
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
                    <i class="fas fa-file-audio" style="color: #ff5500; width: 20px;"></i>
                    Audio File (.mp3)
                </label>
                <input type="file" name="audio" id="audioFile" accept=".mp3" class="form-control" required>
                
                <div id="durationContainer" style="margin-top: 15px; display: none;">
                    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #ff5500;">
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <i class="fas fa-clock" style="color: #ff5500; flex-shrink: 0;"></i>
                            <span style="font-weight: 600;">Duration:</span>
                            <span id="durationText">Analyzing...</span>
                            <span id="exactBadge" style="display: none; background: #28a745; color: white; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem;">EXACT</span>
                        </div>
                    </div>
                </div>
                
                <div id="progressContainer" style="margin-top: 10px; display: none;">
                    <div style="height: 4px; background: #f0f0f0; border-radius: 2px; overflow: hidden;">
                        <div id="progressFill" style="height: 100%; background: #ff5500; width: 0%; transition: width 0.3s;"></div>
                    </div>
                </div>
                
                <input type="hidden" name="duration" id="durationInput" value="">
            </div>
            
            <!-- Thumbnail Image -->
            <div class="form-group">
                <label>
                    <i class="fas fa-image" style="color: #ff5500; width: 20px;"></i>
                    Thumbnail Image
                </label>
                <input type="file" name="image" accept="image/*" class="form-control" required>
                <p style="font-size: 0.8rem; color: #666; margin-top: 5px;">
                    <i class="fas fa-info-circle"></i> Recommended: Square image, JPG or PNG
                </p>
            </div>
            
            <!-- Submit Button -->
            <div style="margin-top: 30px;">
                <button type="submit" id="submitBtn" class="btn btn-primary btn-block" style="padding: 16px; width: 100%;">
                    <i class="fas fa-cloud-upload-alt"></i> Upload Song
                </button>
            </div>
            
            <!-- Loading Overlay -->
            <div id="loadingOverlay" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center; flex-direction: column;">
                <div style="background: white; padding: 30px; border-radius: 12px; text-align: center; max-width: 300px; margin: 20px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #ff5500; margin-bottom: 20px;"></i>
                    <h3 style="margin-bottom: 10px;">Uploading...</h3>
                    <p style="color: #666;">Please don't close this page</p>
                </div>
            </div>
        </form>
    </div>
    
    <style>
        /* Base styles */
        * {
            box-sizing: border-box;
        }
        
        body {
            margin: 0;
            padding: 0;
            overflow-x: hidden;
        }
        
        .form-group {
            margin-bottom: 20px;
            width: 100%;
        }
        
        .form-control {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.2s;
            max-width: 100%;
        }
        
        .form-control:focus {
            outline: none;
            border-color: #ff5500;
        }
        
        .searchable-select-container { 
            position: relative; 
            width: 100%; 
            max-width: 100%;
        }
        
        .searchable-select {
            width: 100%; 
            padding: 12px 15px; 
            background: white;
            border: 2px solid #e0e0e0; 
            border-radius: 8px; 
            cursor: pointer;
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            min-height: 44px;
            word-break: break-word;
        }
        
        .searchable-select:hover { 
            border-color: #ff5500; 
        }
        
        .searchable-dropdown {
            position: absolute; 
            top: 100%; 
            left: 0; 
            right: 0; 
            background: white;
            border: 2px solid #e0e0e0; 
            border-radius: 8px; 
            margin-top: 5px;
            max-height: 400px; 
            overflow: hidden; 
            z-index: 1000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .search-box {
            padding: 10px; 
            border-bottom: 1px solid #e0e0e0;
            display: flex; 
            align-items: center; 
            gap: 8px;
        }
        
        .search-box i { 
            color: #999; 
            flex-shrink: 0;
        }
        
        .search-box input {
            flex: 1; 
            border: none; 
            outline: none; 
            font-size: 14px; 
            padding: 8px 0;
            min-width: 0;
            width: 100%;
        }
        
        .artist-list { 
            max-height: 250px; 
            overflow-y: auto; 
            padding: 5px 0; 
        }
        
        .artist-item {
            padding: 10px 15px; 
            cursor: pointer;
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            transition: background 0.2s;
            word-break: break-word;
            gap: 10px;
        }
        
        .artist-item:hover { 
            background: #f0f0f0; 
        }
        
        .artist-item.selected {
            background: #fff0e6; 
            border-left: 3px solid #ff5500;
        }
        
        .artist-name { 
            font-weight: 500; 
            word-break: break-word;
        }
        
        .artist-song-count {
            font-size: 0.7rem; 
            color: #999; 
            background: #f0f0f0;
            padding: 2px 6px; 
            border-radius: 12px;
            white-space: nowrap;
        }
        
        .dropdown-footer {
            padding: 10px; 
            border-top: 1px solid #e0e0e0; 
            background: #f9f9f9;
        }
        
        .featured-tag {
            display: inline-flex; 
            align-items: center; 
            gap: 6px;
            background: #f0f0f0; 
            border-radius: 30px; 
            padding: 6px 12px;
            font-size: 0.9rem; 
            border: 1px solid #e0e0e0;
            animation: slideIn 0.3s ease;
            word-break: break-word;
            max-width: 100%;
        }
        
        .genre-tag {
            display: inline-flex; 
            align-items: center; 
            gap: 6px;
            background: #ff5500; 
            color: white; 
            border-radius: 30px; 
            padding: 6px 15px;
            font-size: 0.9rem; 
            border: none;
            animation: slideIn 0.3s ease;
            word-break: break-word;
            max-width: 100%;
        }
        
        .genre-tag i {
            cursor: pointer; 
            font-size: 1rem;
            transition: transform 0.2s;
            flex-shrink: 0;
        }
        
        .genre-tag i:hover { 
            transform: scale(1.2); 
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .btn {
            padding: 12px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            transition: background 0.2s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .btn-primary {
            background: #ff5500;
            color: white;
        }
        
        .btn-primary:hover {
            background: #e64c00;
        }
        
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #5a6268;
        }
        
        .btn-block {
            width: 100%;
        }
        
        /* Mobile styles */
        @media (max-width: 768px) {
            .searchable-dropdown {
                position: fixed; 
                top: 50%; 
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%; 
                max-width: 400px; 
                max-height: 80vh;
            }
            
            .btn {
                width: 100%;
                margin: 5px 0;
            }
            
            .featured-tag, .genre-tag { 
                font-size: 0.8rem; 
                padding: 4px 10px; 
            }
            
            h2 {
                font-size: 1.2rem;
            }
        }
        
        @media (max-width: 480px) {
            .form-control {
                font-size: 14px;
                padding: 10px 12px;
            }
            
            .searchable-select {
                padding: 10px 12px;
                font-size: 14px;
            }
            
            .btn {
                padding: 10px 16px;
                font-size: 0.9rem;
            }
            
            .featured-tag, .genre-tag { 
                font-size: 0.75rem; 
                padding: 4px 8px; 
            }
        }
        
        /* Prevent horizontal scroll */
        html, body {
            max-width: 100%;
            overflow-x: hidden;
        }
        
        .container, .form-group, div {
            max-width: 100%;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        code {
            word-break: break-all;
            white-space: normal;
        }
    </style>
    
    <script>
        // Artists data
        const artistsData = [
            ${Object.entries(artists).map(([id, artist]) => {
                return `{ id: "${id}", name: "${artist.name.replace(/"/g, '\\"')}", songCount: ${artist.songs?.length || 0} }`;
            }).join(',')}
        ];
        artistsData.sort((a, b) => a.name.localeCompare(b.name));
        
        // Genres data
        const genresData = ${JSON.stringify(genres)};
        
        // State
        let featuredArtists = [];
        let selectedGenre = null;
        let audioContext = null;
        
        // DOM Elements
        const audioFile = document.getElementById('audioFile');
        const durationContainer = document.getElementById('durationContainer');
        const durationText = document.getElementById('durationText');
        const durationInput = document.getElementById('durationInput');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const exactBadge = document.getElementById('exactBadge');
        const submitBtn = document.getElementById('submitBtn');
        const loadingOverlay = document.getElementById('loadingOverlay');
        
        // ===== URL PREVIEW FUNCTIONS =====
        (function() {
            const titleInput = document.getElementById('songTitle');
            const urlPreview = document.getElementById('urlPreview');
            
            if (!titleInput || !urlPreview) {
                console.error('URL preview elements not found');
                return;
            }
            
            function generateFilename(title) {
                if (!title || title.trim() === '') return 'untitled';
                
                // Simple sanitization - remove special chars, replace spaces with underscores
                let filename = title
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
                    .replace(/\s+/g, '_') // Replace spaces with underscore
                    .replace(/_+/g, '_') // Remove multiple underscores
                    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
                
                // If filename is empty after processing
                if (!filename) filename = 'untitled';
                
                return filename;
            }
            
            function updateUrlPreview() {
                const title = titleInput.value.trim();
                const filename = generateFilename(title);
                const baseUrl = window.location.origin;
                urlPreview.textContent = baseUrl + '/song/' + filename;
            }
            
            // Initial update
            updateUrlPreview();
            
            // Update preview when user types
            titleInput.addEventListener('input', function() {
                updateUrlPreview();
            });
            
            // Also update on blur
            titleInput.addEventListener('blur', function() {
                updateUrlPreview();
            });
            
            // Make copyUrl function globally available
            window.copyUrl = function() {
                const url = urlPreview.textContent;
                navigator.clipboard.writeText(url).then(() => {
                    const btn = event.target.closest('button');
                    const originalHtml = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        btn.innerHTML = originalHtml;
                    }, 2000);
                }).catch(() => {
                    // Fallback for mobile
                    alert('URL: ' + url);
                });
            };
        })();
        
        // Dropdown Functions
        function toggleDropdown(type) {
            document.querySelectorAll('.searchable-dropdown').forEach(d => d.style.display = 'none');
            const dropdown = document.getElementById(type + 'Dropdown');
            dropdown.style.display = 'block';
            if (type === 'genre') {
                renderGenreList();
                setTimeout(() => document.getElementById('genreSearch').focus(), 100);
            } else {
                renderArtistList(type);
                setTimeout(() => document.getElementById(type + 'Search').focus(), 100);
            }
        }
        
        function filterArtists(type) {
            renderArtistList(type);
        }
        
        function filterGenres() {
            renderGenreList();
        }
        
        function renderArtistList(type) {
            const searchTerm = document.getElementById(type + 'Search').value.toLowerCase();
            const listContainer = document.getElementById(type + 'ArtistList');
            
            const filtered = artistsData.filter(a => a.name.toLowerCase().includes(searchTerm));
            
            if (filtered.length === 0) {
                listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">No artists found</div>';
                return;
            }
            
            const selectedId = type === 'primary' ? document.getElementById('primaryArtistInput').value : null;
            
            listContainer.innerHTML = filtered.map(artist => {
                const isSelected = type === 'primary' ? artist.id === selectedId : featuredArtists.includes(artist.id);
                return \`
                    <div class="artist-item \${isSelected ? 'selected' : ''}" 
                         onclick="selectArtist('\${type}', '\${artist.id}', '\${artist.name.replace(/'/g, "\\\\'")}')">
                        <span class="artist-name">\${artist.name}</span>
                        <span class="artist-song-count">\${artist.songCount} songs</span>
                    </div>
                \`;
            }).join('');
        }
        
        function renderGenreList() {
            const searchTerm = document.getElementById('genreSearch').value.toLowerCase();
            const listContainer = document.getElementById('genreList');
            
            const filtered = genresData.filter(g => g.name.toLowerCase().includes(searchTerm) || g.id.toLowerCase().includes(searchTerm));
            
            if (filtered.length === 0) {
                listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">No genres found</div>';
                return;
            }
            
            listContainer.innerHTML = filtered.map(genre => \`
                <div class="artist-item" onclick="selectGenre('\${genre.id}', '\${genre.name.replace(/'/g, "\\\\'")}', '\${genre.color}')">
                    <span style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas \${genre.icon}" style="color: \${genre.color};"></i>
                        <span class="artist-name">\${genre.name}</span>
                    </span>
                    <span class="artist-song-count">\${genre.id}</span>
                </div>
            \`).join('');
        }
        
        function selectArtist(type, id, name) {
            if (type === 'primary') {
                document.getElementById('primaryArtistInput').value = id;
                document.getElementById('primarySelectedDisplay').textContent = name;
            } else {
                if (!featuredArtists.includes(id)) {
                    featuredArtists.push(id);
                    updateFeaturedTags();
                }
            }
            document.getElementById(type + 'Dropdown').style.display = 'none';
        }
        
        function selectGenre(id, name, color) {
            selectedGenre = id;
            updateGenreTag(name, color);
            document.getElementById('genreDropdown').style.display = 'none';
        }
        
        function showCreateArtist(type) {
            document.getElementById(type + 'Dropdown').style.display = 'none';
            document.getElementById(type + 'NewArtistContainer').style.display = 'block';
            document.getElementById(type + 'NewArtistName').focus();
        }
        
        function showCreateGenre() {
            document.getElementById('genreDropdown').style.display = 'none';
            document.getElementById('genreNewContainer').style.display = 'block';
            document.getElementById('genreNewName').focus();
        }
        
        function saveNewArtist(type) {
            const name = document.getElementById(type + 'NewArtistName').value.trim();
            if (!name) { alert('Please enter a name'); return; }
            
            const tempId = 'new_' + name.replace(/\\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
            
            if (type === 'primary') {
                document.getElementById('primaryArtistInput').value = tempId;
                document.getElementById('primarySelectedDisplay').textContent = name + ' (new)';
            } else {
                if (!featuredArtists.includes(tempId)) {
                    featuredArtists.push(tempId);
                    updateFeaturedTags();
                }
            }
            
            document.getElementById(type + 'NewArtistContainer').style.display = 'none';
            document.getElementById(type + 'NewArtistName').value = '';
        }
        
        function saveNewGenre() {
            const id = document.getElementById('genreNewId').value.trim().toLowerCase().replace(/\\s+/g, '-');
            const name = document.getElementById('genreNewName').value.trim();
            const color = document.querySelector('input[name="newGenreColor"]:checked')?.value;
            const icon = document.querySelector('input[name="newGenreIcon"]:checked')?.value;
            
            if (!id || !name || !color || !icon) {
                alert('Please fill in all fields');
                return;
            }
            
            // Add to UI immediately
            const newGenre = { id, name, color, icon };
            genresData.push(newGenre);
            selectedGenre = id;
            updateGenreTag(name, color);
            
            // Store in hidden input with special prefix
            document.getElementById('genreInput').value = 'new_' + JSON.stringify(newGenre);
            
            document.getElementById('genreNewContainer').style.display = 'none';
            document.getElementById('genreNewId').value = '';
            document.getElementById('genreNewName').value = '';
        }
        
        function cancelNewArtist(type) {
            document.getElementById(type + 'NewArtistContainer').style.display = 'none';
            document.getElementById(type + 'NewArtistName').value = '';
        }
        
        function cancelNewGenre() {
            document.getElementById('genreNewContainer').style.display = 'none';
            document.getElementById('genreNewId').value = '';
            document.getElementById('genreNewName').value = '';
        }
        
        // Featured Tags
        function updateFeaturedTags() {
            const container = document.getElementById('selectedFeaturedContainer');
            const input = document.getElementById('featuredInput');
            
            container.innerHTML = '';
            
            if (featuredArtists.length === 0) {
                container.innerHTML = '<div style="color:#999; font-style:italic; padding:8px 0;">No featured artists added</div>';
                input.value = '';
                return;
            }
            
            featuredArtists.forEach((id, index) => {
                let name = id;
                const artist = artistsData.find(a => a.id === id);
                if (artist) name = artist.name;
                else if (id.startsWith('new_')) name = id.replace('new_', '');
                
                const tag = document.createElement('div');
                tag.className = 'featured-tag';
                tag.innerHTML = \`<span>\${name}</span><i class="fas fa-times-circle" onclick="removeFeatured(\${index})"></i>\`;
                container.appendChild(tag);
            });
            
            input.value = JSON.stringify(featuredArtists);
        }
        
        // Genre Tag
        function updateGenreTag(name, color) {
            const container = document.getElementById('selectedGenreContainer');
            const input = document.getElementById('genreInput');
            
            container.innerHTML = '';
            
            if (selectedGenre) {
                const tag = document.createElement('div');
                tag.className = 'genre-tag';
                tag.style.background = color;
                tag.innerHTML = \`<span>\${name}</span><i class="fas fa-times-circle" onclick="removeGenre()"></i>\`;
                container.appendChild(tag);
                input.value = selectedGenre;
            } else {
                container.innerHTML = '<div style="color:#999; font-style:italic; padding:8px 0;">No genres added</div>';
                input.value = '';
            }
        }
        
        window.removeFeatured = function(index) {
            featuredArtists.splice(index, 1);
            updateFeaturedTags();
        };
        
        window.removeGenre = function() {
            selectedGenre = null;
            updateGenreTag();
        };
        
        // Close dropdown on outside click
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.searchable-select-container')) {
                document.querySelectorAll('.searchable-dropdown').forEach(d => d.style.display = 'none');
            }
        });
        
        // Album/Playlist redirects
        document.getElementById('albumSelect').addEventListener('change', function() {
            if (this.value === '__create_new__') window.location.href = '/admin/album/create';
        });
        
        document.getElementById('playlistSelect').addEventListener('change', function() {
            if (this.value === '__create_new__') window.location.href = '/admin/playlist/create';
        });
        
        // Audio duration detection
        audioFile.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            durationContainer.style.display = 'block';
            progressContainer.style.display = 'block';
            progressFill.style.width = '30%';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            
            try {
                if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const buffer = await file.arrayBuffer();
                progressFill.style.width = '60%';
                
                audioContext.decodeAudioData(buffer,
                    function(b) {
                        const sec = b.duration;
                        const min = Math.floor(sec / 60);
                        const secs = Math.floor(sec % 60);
                        durationText.innerHTML = \`\${min}:\${secs.toString().padStart(2,'0')} <small style="color:#666;">(\${sec.toFixed(2)}s)</small>\`;
                        durationInput.value = sec.toFixed(3);
                        
                        // Store milliseconds for ID3 tagging
                        window.id3Duration = Math.floor(sec * 1000);
                        
                        exactBadge.style.display = 'inline-block';
                        progressFill.style.width = '100%';
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        setTimeout(() => progressContainer.style.display = 'none', 500);
                    },
                    function() {
                        durationText.innerHTML = 'Could not detect exact duration';
                        durationInput.value = '0';
                        progressContainer.style.display = 'none';
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                    }
                );
            } catch (error) {
                durationText.innerHTML = 'Error analyzing file';
                durationInput.value = '0';
                progressContainer.style.display = 'none';
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
        });
        
        // Form submission
        document.getElementById('uploadForm').addEventListener('submit', function(e) {
            if (!durationInput.value || durationInput.value === '0' || durationInput.value === '0.000') {
                if (!confirm('⚠️ No exact duration. Continue with estimate?')) {
                    e.preventDefault();
                    return;
                }
            }
            loadingOverlay.style.display = 'flex';
        });
        
        // Initialize
        updateFeaturedTags();
        updateGenreTag();
    </script>
  `;

  return content;
}

// ===== POST HANDLER WITH ID3 TAGGING =====
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
    try {
      featuredArtists = featuredJson ? JSON.parse(featuredJson) : [];
    } catch (e) {
      console.error('Error parsing featured artists:', e);
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

    // Process any new featured artists
    const processedFeatured = [];
    for (const feat of featuredArtists) {
      if (feat.startsWith('new_')) {
        const newArtistName = feat.replace('new_', '');
        const newArtistId = sanitize(newArtistName);
        
        const artists = await getArtists(env);
        if (!artists[newArtistId]) {
          artists[newArtistId] = {
            id: newArtistId,
            name: newArtistName,
            description: '',
            thumbnail: '',
            created: Date.now(),
            songs: [],
            albums: []
          };
          await saveArtists(env, artists);
        }
        processedFeatured.push(newArtistId);
      } else {
        processedFeatured.push(feat);
      }
    }

    let artistName = artist;
    let artistId = artist;

    // Process new primary artist
    if (artist && artist.startsWith('new_')) {
      artistName = artist.replace('new_', '');
      artistId = sanitize(artistName);
      const artists = await getArtists(env);
      if (!artists[artistId]) {
        artists[artistId] = {
          id: artistId,
          name: artistName,
          description: '',
          thumbnail: '',
          created: Date.now(),
          songs: [],
          albums: []
        };
        await saveArtists(env, artists);
      }
    }

    const safeTitle = sanitize(title);
    const safeArtist = sanitize(artistName);
    const baseName = `${safeArtist}_${safeTitle}`;

    const audioKey = `songs/${baseName}.mp3`;
    const descKey = `descriptions/${baseName}.txt`;
    const imgType = imageFile.type.includes('png') ? 'png' : 'jpg';
    const imageKey = `images/${baseName}.${imgType}`;

    const audioBuffer = await audioFile.arrayBuffer();

    let duration;
    if (browserDuration && browserDuration !== '0' && browserDuration !== '0.000') {
      duration = parseFloat(browserDuration);
    } else {
      duration = fallbackDurationParser(audioBuffer);
    }

    // ===== ID3 TAGGING SECTION =====
    const SITENAME = "ZEDALBUMS"; // Your site name for branding
    
    // Construct artist string for ID3 tag
    let id3ArtistString = artistName;
    if (processedFeatured.length > 0) {
      // Get featured artist names
      const artists = await getArtists(env);
      const featuredNames = processedFeatured.map(fid => artists[fid]?.name || fid).join(', ');
      id3ArtistString = `${artistName} feat. ${featuredNames}`;
    }
    
    // Add site name to artist and title (as per ID3 script)
    const taggedTitle = `${title} (${SITENAME})`;
    const taggedArtist = `${id3ArtistString} | ${SITENAME}`;
    
    // Convert duration to milliseconds for ID3 tag
    const durationMs = Math.floor(duration * 1000);
    
    // Run through ID3 tagger
    const taggedMp3 = addID3Tags(audioBuffer, {
      title: taggedTitle,
      artist: taggedArtist,
      duration: durationMs
    });
    
    // Generate filename with site name
    const finalFilename = `${title} - ${artistName} (${SITENAME}).mp3`;
    
    // Store the TAGGED file (overwrites the original upload)
    await env.media.put(audioKey, taggedMp3, {
      httpMetadata: { 
        contentType: 'audio/mpeg',
        contentDisposition: `inline; filename="${finalFilename}"`
      }
    });
    // ===== END ID3 TAGGING =====

    // Store image and description (unchanged)
    await env.media.put(imageKey, imageFile.stream());
    await env.media.put(descKey, description);

    // REMOVE slug generation and registration
    // const slugManager = new SlugManager(env);
    // const slug = slugManager.generateSongSlug(title);
    // await slugManager.registerSlug('songs', baseName, slug, {
    //   title,
    //   artist: artistId,
    //   artistName,
    //   duration,
    //   genre
    // });

    // Store metadata (without slug)
    const metadata = {
      title,
      primaryArtist: artistId,
      featuredArtists: processedFeatured,
      description,
      duration,
      genre,
      // slug, // REMOVED
      filename: finalFilename // Store the branded filename
    };
    await saveMetadata(env, baseName, metadata);

    // Handle album associations
    if (albumId && albumId !== '' && albumId !== '__create_new__') {
      await addSongToAlbum(env, albumId, baseName);
      await addAlbumToArtist(env, artistId, albumId);
      await addArtistToAlbum(env, artistId, albumId);
    }

    // Handle playlist associations
    if (playlistId && playlistId !== '' && playlistId !== '__create_new__') {
      await addSongToPlaylist(env, playlistId, baseName);
    }

    // Add to artist song lists
    await addSongToArtist(env, artistId, baseName);
    for (const fid of processedFeatured) {
      await addSongToArtist(env, fid, baseName);
    }

    // Log admin activity
    await logAdminActivity(env, auth.session.id, 'upload', 'song', baseName, title);

    return {
      success: true,
      baseName,
      title,
      artistName,
      duration,
      albumId,
      playlistId,
      // slug, // REMOVED
      filename: finalFilename
    };
    
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// ===== ID3 TAGGING FUNCTIONS =====
function addID3Tags(audioBuffer, tags) {
  const audioBytes = new Uint8Array(audioBuffer);
  const frames = [];
  
  // Add text frames
  if (tags.artist) frames.push(createTextFrame('TPE1', tags.artist));
  if (tags.title) frames.push(createTextFrame('TIT2', tags.title));
  if (tags.duration) frames.push(createTextFrame('TLEN', tags.duration.toString()));
  
  // Calculate total frames size
  const framesSize = frames.reduce((acc, f) => acc + f.length, 0);
  
  // Create ID3 header (10 bytes)
  const header = new Uint8Array(10);
  header.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00], 0); // ID3v2.3.0
  header.set(encodeSynchsafe(framesSize), 6);
  
  // Combine header + frames + original audio
  const final = new Uint8Array(10 + framesSize + audioBytes.length);
  final.set(header, 0);
  
  let offset = 10;
  for (const f of frames) {
    final.set(f, offset);
    offset += f.length;
  }
  
  final.set(audioBytes, offset);
  
  return final;
}

function createTextFrame(type, value) {
  const enc = new TextEncoder().encode(value);
  const frame = new Uint8Array(10 + 1 + enc.length);
  
  // Frame header (10 bytes)
  frame.set(new TextEncoder().encode(type), 0);
  const size = 1 + enc.length;
  frame[4] = (size >> 24) & 0xFF;
  frame[5] = (size >> 16) & 0xFF;
  frame[6] = (size >> 8) & 0xFF;
  frame[7] = size & 0xFF;
  
  // Encoding byte (0x00 = ISO-8859-1)
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