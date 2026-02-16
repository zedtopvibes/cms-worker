// ==================== ADMIN UPLOAD ====================
import { getAlbums, getArtists, getPlaylists, saveArtists, saveMetadata, addSongToAlbum, addSongToPlaylist, addSongToArtist, addAlbumToArtist, addArtistToAlbum } from '../../helpers/storage.js';
import { sanitize, formatDuration, fallbackDurationParser } from '../../helpers/formatting.js';

export async function handleAdminUpload(req, env, ctx, auth) {
  const albums = await getAlbums(env);
  const artists = await getArtists(env);
  const playlists = await getPlaylists(env);
  
  const albumOptions = Object.keys(albums).map(id => {
    const album = albums[id];
    return `<option value="${id}">${album.title} (${album.songs?.length || 0} tracks)</option>`;
  }).join("");

  const artistOptions = Object.keys(artists).map(id => {
    const artist = artists[id];
    const songCount = artist.songs?.length || 0;
    return `<option value="${id}">${artist.name} (${songCount} songs)</option>`;
  }).join("");

  const playlistOptions = Object.keys(playlists).map(id => {
    const playlist = playlists[id];
    return `<option value="${id}">${playlist.title} (${playlist.songs?.length || 0} songs)</option>`;
  }).join("");

  const content = `
    <div style="max-width: 800px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px; font-size: 1.3rem; display: flex; align-items: center; gap: 10px;">
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
                <input type="text" name="title" class="form-control" placeholder="e.g. My Song" required>
            </div>
            
            <!-- Primary Artist -->
            <div class="form-group">
                <label>
                    <i class="fas fa-microphone" style="color: #ff5500; width: 20px;"></i>
                    Primary Artist
                </label>
                <select name="artist" id="artistSelect" class="form-control" required>
                    <option value="">-- Select Primary Artist --</option>
                    ${artistOptions}
                    <option value="__create_new__">➕ Create New Artist</option>
                </select>
                <div id="newArtistContainer" style="margin-top: 10px; display: none;">
                    <input type="text" name="artist_name" id="artistNameInput" class="form-control" 
                           placeholder="Enter new artist name">
                </div>
            </div>
            
            <!-- Featured Artists - Redesigned -->
            <div class="form-group">
                <label>
                    <i class="fas fa-users" style="color: #ff5500; width: 20px;"></i>
                    Featured Artists
                </label>
                
                <!-- Selected Featured Artists Tags -->
                <div id="selectedFeaturedContainer" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; min-height: 40px; padding: 5px 0;">
                    <!-- Selected tags will appear here dynamically -->
                </div>
                
                <!-- Featured Artist Selector -->
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <select id="featuredArtistSelect" class="form-control" style="flex: 1; min-width: 200px;">
                        <option value="">-- Add Featured Artist --</option>
                        ${artistOptions}
                    </select>
                    <button type="button" id="addFeaturedBtn" class="btn btn-secondary" style="white-space: nowrap; padding: 0 20px;">
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>
                
                <!-- Create New Featured Artist Option -->
                <div style="margin-top: 10px;">
                    <button type="button" id="showNewFeaturedBtn" class="btn btn-secondary btn-sm" style="background: #f0f0f0;">
                        <i class="fas fa-plus-circle"></i> Create New Featured Artist
                    </button>
                </div>
                
                <!-- New Featured Artist Input (Hidden by default) -->
                <div id="newFeaturedContainer" style="margin-top: 10px; display: none;">
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <input type="text" id="newFeaturedName" class="form-control" placeholder="Enter new artist name" style="flex: 1;">
                        <button type="button" id="saveNewFeaturedBtn" class="btn btn-primary">
                            <i class="fas fa-save"></i> Save
                        </button>
                        <button type="button" id="cancelNewFeaturedBtn" class="btn btn-secondary">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Hidden input to store selected featured artists as JSON -->
                <input type="hidden" name="featured" id="featuredInput" value="">
                
                <p style="font-size: 0.8rem; color: #666; margin-top: 8px;">
                    <i class="fas fa-info-circle"></i> Click + to add artists. Click the ✕ on tags to remove.
                </p>
            </div>
            
            <!-- Description -->
            <div class="form-group">
                <label>
                    <i class="fas fa-align-left" style="color: #ff5500; width: 20px;"></i>
                    Description
                </label>
                <textarea name="description" class="form-control" rows="3" 
                          placeholder="Song description..." required></textarea>
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
                
                <!-- Duration Display -->
                <div id="durationContainer" style="margin-top: 15px; display: none;">
                    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #ff5500;">
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <i class="fas fa-clock" style="color: #ff5500;"></i>
                            <span style="font-weight: 600;">Duration:</span>
                            <span id="durationText">Analyzing...</span>
                            <span id="exactBadge" style="display: none; background: #28a745; color: white; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem;">EXACT</span>
                        </div>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div id="progressContainer" style="margin-top: 10px; display: none;">
                    <div style="height: 4px; background: #f0f0f0; border-radius: 2px; overflow: hidden;">
                        <div id="progressFill" style="height: 100%; background: #ff5500; width: 0%; transition: width 0.3s;"></div>
                    </div>
                </div>
                
                <!-- Hidden input for duration -->
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
                <button type="submit" id="submitBtn" class="btn btn-primary btn-block" style="padding: 16px;">
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
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .featured-tag i {
            color: #ff5500;
            cursor: pointer;
            font-size: 1rem;
            transition: transform 0.2s;
        }
        
        .featured-tag i:hover {
            transform: scale(1.2);
        }
        
        @media (max-width: 480px) {
            .featured-tag {
                font-size: 0.8rem;
                padding: 4px 10px;
            }
        }
    </style>
    
    <script>
        // ===== AUDIO DURATION DETECTION =====
        let audioContext = null;
        
        // Get elements
        const audioFile = document.getElementById('audioFile');
        const durationContainer = document.getElementById('durationContainer');
        const durationText = document.getElementById('durationText');
        const durationInput = document.getElementById('durationInput');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const exactBadge = document.getElementById('exactBadge');
        const submitBtn = document.getElementById('submitBtn');
        const loadingOverlay = document.getElementById('loadingOverlay');
        
        // ===== PRIMARY ARTIST HANDLING =====
        const artistSelect = document.getElementById('artistSelect');
        const newArtistContainer = document.getElementById('newArtistContainer');
        const artistNameInput = document.getElementById('artistNameInput');
        
        artistSelect.addEventListener('change', function() {
            if (this.value === '__create_new__') {
                newArtistContainer.style.display = 'block';
                artistNameInput.required = true;
            } else {
                newArtistContainer.style.display = 'none';
                artistNameInput.required = false;
            }
        });
        
        // ===== FEATURED ARTISTS HANDLING =====
        let featuredArtists = [];
        
        // DOM Elements for featured artists
        const featuredSelect = document.getElementById('featuredArtistSelect');
        const addFeaturedBtn = document.getElementById('addFeaturedBtn');
        const selectedContainer = document.getElementById('selectedFeaturedContainer');
        const featuredInput = document.getElementById('featuredInput');
        const showNewFeaturedBtn = document.getElementById('showNewFeaturedBtn');
        const newFeaturedContainer = document.getElementById('newFeaturedContainer');
        const newFeaturedName = document.getElementById('newFeaturedName');
        const saveNewFeaturedBtn = document.getElementById('saveNewFeaturedBtn');
        const cancelNewFeaturedBtn = document.getElementById('cancelNewFeaturedBtn');
        
        // Update the displayed tags
        function updateFeaturedTags() {
            // Clear container
            selectedContainer.innerHTML = '';
            
            if (featuredArtists.length === 0) {
                // Show empty state
                const emptyMsg = document.createElement('div');
                emptyMsg.style.cssText = 'color: #999; font-style: italic; padding: 8px 0;';
                emptyMsg.textContent = 'No featured artists added';
                selectedContainer.appendChild(emptyMsg);
                return;
            }
            
            // Create tags for each featured artist
            featuredArtists.forEach((artist, index) => {
                const tag = document.createElement('div');
                tag.className = 'featured-tag';
                
                // Get artist name from select options
                let artistName = artist;
                const option = Array.from(featuredSelect.options).find(opt => opt.value === artist);
                if (option) {
                    artistName = option.text.split(' (')[0]; // Remove song count if present
                } else if (artist.startsWith('new_')) {
                    artistName = artist.replace('new_', '');
                }
                
                tag.innerHTML = \`
                    <span>\${artistName}</span>
                    <i class="fas fa-times-circle" onclick="removeFeaturedArtist(\${index})"></i>
                \`;
                
                selectedContainer.appendChild(tag);
            });
            
            // Update hidden input
            featuredInput.value = JSON.stringify(featuredArtists);
        }
        
        // Add featured artist
        addFeaturedBtn.addEventListener('click', function() {
            const selectedValue = featuredSelect.value;
            if (!selectedValue) {
                alert('Please select an artist');
                return;
            }
            
            if (!featuredArtists.includes(selectedValue)) {
                featuredArtists.push(selectedValue);
                updateFeaturedTags();
                featuredSelect.value = ''; // Reset select
            } else {
                alert('This artist is already added');
            }
        });
        
        // Remove featured artist
        window.removeFeaturedArtist = function(index) {
            featuredArtists.splice(index, 1);
            updateFeaturedTags();
        };
        
        // Show new featured artist input
        showNewFeaturedBtn.addEventListener('click', function() {
            newFeaturedContainer.style.display = 'block';
            showNewFeaturedBtn.style.display = 'none';
            newFeaturedName.focus();
        });
        
        // Save new featured artist
        saveNewFeaturedBtn.addEventListener('click', async function() {
            const newName = newFeaturedName.value.trim();
            if (!newName) {
                alert('Please enter an artist name');
                return;
            }
            
            // Show loading
            saveNewFeaturedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveNewFeaturedBtn.disabled = true;
            
            // Create a temporary ID
            const tempId = 'new_' + newName.replace(/\\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
            
            // Add to featured artists
            if (!featuredArtists.includes(tempId)) {
                featuredArtists.push(tempId);
                updateFeaturedTags();
            }
            
            // Hide new artist input
            newFeaturedContainer.style.display = 'none';
            showNewFeaturedBtn.style.display = 'inline-flex';
            newFeaturedName.value = '';
            
            // Reset button
            saveNewFeaturedBtn.innerHTML = '<i class="fas fa-save"></i> Save';
            saveNewFeaturedBtn.disabled = false;
        });
        
        // Cancel new featured artist
        cancelNewFeaturedBtn.addEventListener('click', function() {
            newFeaturedContainer.style.display = 'none';
            showNewFeaturedBtn.style.display = 'inline-flex';
            newFeaturedName.value = '';
        });
        
        // ===== ALBUM & PLAYLIST REDIRECTS =====
        document.getElementById('albumSelect').addEventListener('change', function() {
            if (this.value === '__create_new__') {
                window.location.href = '/admin/album/create';
            }
        });
        
        document.getElementById('playlistSelect').addEventListener('change', function() {
            if (this.value === '__create_new__') {
                window.location.href = '/admin/playlist/create';
            }
        });
        
        // ===== AUDIO FILE HANDLING =====
        audioFile.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // Show UI
            durationContainer.style.display = 'block';
            progressContainer.style.display = 'block';
            progressFill.style.width = '30%';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            
            try {
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                
                const arrayBuffer = await file.arrayBuffer();
                progressFill.style.width = '60%';
                
                audioContext.decodeAudioData(
                    arrayBuffer,
                    function(buffer) {
                        const exactSeconds = buffer.duration;
                        const minutes = Math.floor(exactSeconds / 60);
                        const seconds = Math.floor(exactSeconds % 60);
                        
                        durationText.innerHTML = \`\${minutes}:\${seconds.toString().padStart(2,'0')} <small style="color: #666;">(\${exactSeconds.toFixed(2)} seconds)</small>\`;
                        durationInput.value = exactSeconds.toFixed(3);
                        
                        exactBadge.style.display = 'inline-block';
                        progressFill.style.width = '100%';
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        
                        setTimeout(() => {
                            progressContainer.style.display = 'none';
                        }, 500);
                    },
                    function(error) {
                        durationText.innerHTML = 'Could not detect exact duration (will use estimate)';
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
        
        // ===== FORM SUBMISSION =====
        document.getElementById('uploadForm').addEventListener('submit', function(e) {
            const duration = document.getElementById('durationInput').value;
            if (!duration || duration === '0' || duration === '0.000') {
                if (!confirm('⚠️ Exact duration could not be detected. Continue with estimated duration?')) {
                    e.preventDefault();
                    return;
                }
            }
            
            // Show loading overlay
            loadingOverlay.style.display = 'flex';
        });
        
        // Initialize featured tags on page load
        updateFeaturedTags();
    </script>
  `;

  return content;
}

export async function handleAdminUploadPost(req, env, ctx) {
  try {
    const formData = await req.formData();
    const title = formData.get('title');
    const artist = formData.get('artist');
    const description = formData.get('description');
    const audioFile = formData.get('audio');
    const imageFile = formData.get('image');
    const albumId = formData.get('album');
    const playlistId = formData.get('playlist');
    const artistNameInput = formData.get('artist_name');
    const featuredJson = formData.get('featured');
    const browserDuration = formData.get('duration');

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

    // Process any new featured artists (those starting with 'new_')
    const processedFeatured = [];
    for (const feat of featuredArtists) {
      if (feat.startsWith('new_')) {
        // Create new artist
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

    // Create new primary artist if needed
    if (artist === '__create_new__' && artistNameInput) {
      artistName = artistNameInput;
      artistId = sanitize(artistNameInput);

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

    // Read audio file
    const audioBuffer = await audioFile.arrayBuffer();

    // Get duration
    let duration;
    if (browserDuration && browserDuration !== '0' && browserDuration !== '0.000') {
      duration = parseFloat(browserDuration);
    } else {
      duration = fallbackDurationParser(audioBuffer);
    }

    // Upload files
    await env.media.put(audioKey, audioBuffer);
    await env.media.put(imageKey, imageFile.stream());
    await env.media.put(descKey, description);

    // Create metadata
    const metadata = {
      title,
      primaryArtist: artistId,
      featuredArtists: processedFeatured,
      description,
      duration
    };
    await saveMetadata(env, baseName, metadata);

    // Add to album if selected
    if (albumId && albumId !== '' && albumId !== '__create_new__') {
      await addSongToAlbum(env, albumId, baseName);
      await addAlbumToArtist(env, artistId, albumId);
      await addArtistToAlbum(env, artistId, albumId);
    }

    // Add to playlist if selected
    if (playlistId && playlistId !== '' && playlistId !== '__create_new__') {
      await addSongToPlaylist(env, playlistId, baseName);
    }

    // Add to primary artist's songs
    await addSongToArtist(env, artistId, baseName);
    
    // Add to featured artists' songs
    for (const fid of processedFeatured) {
      await addSongToArtist(env, fid, baseName);
    }

    return {
      success: true,
      baseName,
      title,
      artistName,
      duration,
      albumId,
      playlistId
    };
    
  } catch (error) {
    console.error('Upload error:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred' 
    };
  }
}