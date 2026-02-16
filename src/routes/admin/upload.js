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
            
            <!-- Primary Artist - Searchable Select -->
            <div class="form-group">
                <label>
                    <i class="fas fa-microphone" style="color: #ff5500; width: 20px;"></i>
                    Primary Artist
                </label>
                
                <!-- Searchable Select Container -->
                <div class="searchable-select-container">
                    <div class="searchable-select" onclick="toggleDropdown('primary')">
                        <span id="primarySelectedDisplay">-- Select Primary Artist --</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    
                    <!-- Dropdown with Search -->
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
                
                <!-- Create New Artist Input -->
                <div id="primaryNewArtistContainer" style="margin-top: 10px; display: none;">
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <input type="text" id="primaryNewArtistName" class="form-control" placeholder="Enter new artist name" style="flex: 1;">
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
                
                <!-- Selected Tags -->
                <div id="selectedFeaturedContainer" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; min-height: 40px;"></div>
                
                <!-- Searchable Select -->
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
                
                <!-- Create New Featured Artist -->
                <div id="featuredNewArtistContainer" style="margin-top: 10px; display: none;">
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <input type="text" id="featuredNewArtistName" class="form-control" placeholder="Enter new artist name" style="flex: 1;">
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
        .search-box i { color: #999; }
        .search-box input {
            flex: 1; border: none; outline: none; font-size: 14px; padding: 8px 0;
        }
        .artist-list { max-height: 250px; overflow-y: auto; padding: 5px 0; }
        .artist-item {
            padding: 10px 15px; cursor: pointer;
            display: flex; justify-content: space-between; align-items: center;
            transition: background 0.2s;
        }
        .artist-item:hover { background: #f0f0f0; }
        .artist-item.selected {
            background: #fff0e6; border-left: 3px solid #ff5500;
        }
        .artist-name { font-weight: 500; }
        .artist-song-count {
            font-size: 0.7rem; color: #999; background: #f0f0f0;
            padding: 2px 6px; border-radius: 12px;
        }
        .dropdown-footer {
            padding: 10px; border-top: 1px solid #e0e0e0; background: #f9f9f9;
        }
        .featured-tag {
            display: inline-flex; align-items: center; gap: 6px;
            background: #f0f0f0; border-radius: 30px; padding: 6px 12px;
            font-size: 0.9rem; border: 1px solid #e0e0e0;
            animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .featured-tag i {
            color: #ff5500; cursor: pointer; font-size: 1rem;
            transition: transform 0.2s;
        }
        .featured-tag i:hover { transform: scale(1.2); }
        @media (max-width: 768px) {
            .searchable-dropdown {
                position: fixed; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 90%; max-width: 400px; max-height: 80vh;
            }
        }
        @media (max-width: 480px) {
            .featured-tag { font-size: 0.8rem; padding: 4px 10px; }
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
        
        // State
        let featuredArtists = [];
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
        
        // Dropdown Functions
        function toggleDropdown(type) {
            document.querySelectorAll('.searchable-dropdown').forEach(d => d.style.display = 'none');
            const dropdown = document.getElementById(type + 'Dropdown');
            dropdown.style.display = 'block';
            renderArtistList(type);
            setTimeout(() => {
                document.getElementById(type + 'Search').focus();
            }, 100);
        }
        
        function filterArtists(type) {
            renderArtistList(type);
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
        
        function showCreateArtist(type) {
            document.getElementById(type + 'Dropdown').style.display = 'none';
            document.getElementById(type + 'NewArtistContainer').style.display = 'block';
            document.getElementById(type + 'NewArtistName').focus();
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
        
        function cancelNewArtist(type) {
            document.getElementById(type + 'NewArtistContainer').style.display = 'none';
            document.getElementById(type + 'NewArtistName').value = '';
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
        
        window.removeFeatured = function(index) {
            featuredArtists.splice(index, 1);
            updateFeaturedTags();
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

    // Process new featured artists
    const processedFeatured = [];
    for (const feat of featuredArtists) {
      if (feat.startsWith('new_')) {
        const newName = feat.replace('new_', '');
        const newId = sanitize(newName);
        const artists = await getArtists(env);
        if (!artists[newId]) {
          artists[newId] = {
            id: newId,
            name: newName,
            description: '',
            thumbnail: '',
            created: Date.now(),
            songs: [],
            albums: []
          };
          await saveArtists(env, artists);
        }
        processedFeatured.push(newId);
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

    await env.media.put(audioKey, audioBuffer);
    await env.media.put(imageKey, imageFile.stream());
    await env.media.put(descKey, description);

    const metadata = {
      title,
      primaryArtist: artistId,
      featuredArtists: processedFeatured,
      description,
      duration
    };
    await saveMetadata(env, baseName, metadata);

    if (albumId && albumId !== '' && albumId !== '__create_new__') {
      await addSongToAlbum(env, albumId, baseName);
      await addAlbumToArtist(env, artistId, albumId);
      await addArtistToAlbum(env, artistId, albumId);
    }

    if (playlistId && playlistId !== '' && playlistId !== '__create_new__') {
      await addSongToPlaylist(env, playlistId, baseName);
    }

    await addSongToArtist(env, artistId, baseName);
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
    return { success: false, error: error.message || 'Unknown error' };
  }
}