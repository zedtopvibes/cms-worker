// ==================== ADMIN UPLOAD HELPER FUNCTIONS ====================
import { getAlbums, getArtists, getPlaylists, saveArtists, saveMetadata, addSongToAlbum, addSongToPlaylist, addSongToArtist, addAlbumToArtist, addArtistToAlbum } from '../../helpers/storage.js';
import { sanitize, formatDuration, fallbackDurationParser } from '../../helpers/formatting.js';
import { logAdminActivity } from '../../helpers/dashboardStats.js';
import { GenreManager } from '../../helpers/genreManager.js';
import { SlugManager } from '../../helpers/slug.js';

export async function handleAdminUpload(req, env, ctx, auth) {
  const albums = await getAlbums(env);
  const artists = await getArtists(env);
  const playlists = await getPlaylists(env);
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  const genres = genresData.genres;
  const slugManager = new SlugManager(env);
  
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
            <div class="form-group">
                <label>
                    <i class="fas fa-heading" style="color: #ff5500; width: 20px;"></i>
                    Song Title
                </label>
                <input type="text" name="title" id="songTitle" class="form-control" placeholder="e.g. Drake - God's Plan" required>
                
                <div style="margin-top: 10px; background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0;">
                    <div style="display: flex; align-items: flex-start; gap: 8px; flex-direction: column;">
                        <div style="display: flex; align-items: center; gap: 5px; color: #666; width: 100%;">
                            <i class="fas fa-link" style="color: #ff5500; flex-shrink: 0;"></i>
                            <span style="font-size: 0.9rem; font-weight: 500;">Final URL (slug):</span>
                        </div>
                        <div style="display: flex; width: 100%; gap: 8px; flex-wrap: wrap;">
                            <code id="urlPreview" style="flex: 1; min-width: 200px; padding: 8px 10px; background: white; border-radius: 4px; font-size: 0.85rem; border: 1px solid #e0e0e0; word-break: break-all; white-space: normal;">
                                /song/...
                            </code>
                            <button type="button" onclick="copyUrl(event)" class="btn btn-secondary" style="padding: 8px 15px; font-size: 0.9rem; white-space: nowrap;">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; color: #666; width: 100%; margin-top: 5px;">
                            <i class="fas fa-database" style="color: #4a90e2; flex-shrink: 0;"></i>
                            <span style="font-size: 0.9rem; font-weight: 500;">Download filename:</span>
                            <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;" id="filenamePreview">untitled (ZEDALBUMS).mp3</code>
                        </div>
                    </div>
                    <p style="font-size: 0.8rem; color: #666; margin-top: 8px; margin-bottom: 0;">
                        <i class="fas fa-info-circle"></i> 
                        Slug is generated from title only. Download filename includes site name.
                    </p>
                </div>
            </div>
            
            <div class="form-group">
                <label>
                    <i class="fas fa-microphone" style="color: #ff5500; width: 20px;"></i>
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
            </div>
            
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
                            <input type="text" id="genreNewId" class="form-control" placeholder="Genre ID" style="flex: 1; min-width: 200px;">
                            <input type="text" id="genreNewName" class="form-control" placeholder="Display Name" style="flex: 1; min-width: 200px;">
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" onclick="saveNewGenre()" class="btn btn-primary">Save Genre</button>
                            <button type="button" onclick="cancelNewGenre()" class="btn btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
                
                <input type="hidden" name="genre" id="genreInput" value="">
            </div>
            
            <div class="form-group">
                <label>
                    <i class="fas fa-align-left" style="color: #ff5500; width: 20px;"></i>
                    Description
                </label>
                <textarea name="description" class="form-control" rows="3" placeholder="Song description..." required></textarea>
            </div>
            
            <div class="form-group">
                <label><i class="fas fa-compact-disc" style="color: #ff5500; width: 20px;"></i> Album</label>
                <select name="album" id="albumSelect" class="form-control">
                    <option value="">-- Select Album --</option>
                    ${albumOptions}
                    <option value="__create_new__">➕ Create New Album</option>
                </select>
            </div>

            <div class="form-group">
                <label><i class="fas fa-list" style="color: #ff5500; width: 20px;"></i> Playlist</label>
                <select name="playlist" id="playlistSelect" class="form-control">
                    <option value="">-- Select Playlist --</option>
                    ${playlistOptions}
                    <option value="__create_new__">➕ Create New Playlist</option>
                </select>
            </div>
            
            <div class="form-group">
                <label><i class="fas fa-file-audio" style="color: #ff5500; width: 20px;"></i> Audio File (.mp3)</label>
                <input type="file" name="audio" id="audioFile" accept=".mp3" class="form-control" required>
                <div id="durationContainer" style="margin-top: 15px; display: none;">
                    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #ff5500;">
                        <span id="durationText">Analyzing...</span>
                    </div>
                </div>
                <input type="hidden" name="duration" id="durationInput" value="">
            </div>
            
            <div class="form-group">
                <label><i class="fas fa-image" style="color: #ff5500; width: 20px;"></i> Thumbnail Image</label>
                <input type="file" name="image" accept="image/*" class="form-control" required>
            </div>
            
            <button type="submit" id="submitBtn" class="btn btn-primary btn-block" style="width: 100%; padding: 16px;">
                <i class="fas fa-cloud-upload-alt"></i> Upload Song
            </button>

            <div id="loadingOverlay" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center; flex-direction: column;">
                <div style="background: white; padding: 30px; border-radius: 12px; text-align: center;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #ff5500; margin-bottom: 20px;"></i>
                    <h3>Uploading...</h3>
                </div>
            </div>
        </form>
    </div>
    
    <style>
        .form-group { margin-bottom: 20px; }
        .form-control { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; }
        .searchable-select-container { position: relative; }
        .searchable-select { padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; background: white; }
        .searchable-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 2px solid #e0e0e0; border-radius: 8px; z-index: 1000; max-height: 300px; overflow-y: auto; }
        .search-box { padding: 10px; border-bottom: 1px solid #eee; display: flex; gap: 8px; align-items: center; }
        .search-box input { border: none; outline: none; width: 100%; }
        .artist-item { padding: 10px 15px; cursor: pointer; }
        .artist-item:hover { background: #f8f9fa; }
        .btn { padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
        .btn-primary { background: #ff5500; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .featured-tag, .genre-tag { background: #eee; padding: 5px 12px; border-radius: 20px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px; margin: 2px; }
    </style>
    
    <script>
        const artistsData = [
            ${Object.entries(artists).map(([id, artist]) => `{ id: "${id}", name: "${artist.name.replace(/"/g, '\\"')}", songCount: ${artist.songs?.length || 0} }`).join(',')}
        ];
        const genresData = ${JSON.stringify(genres)};
        let featuredArtists = [];
        let selectedGenre = null;

        const titleInput = document.getElementById('songTitle');
        const urlPreview = document.getElementById('urlPreview');
        const filenamePreview = document.getElementById('filenamePreview');

        function generateSlug(text) {
            return text ? text.toLowerCase().replace(/[^a-z0-9\\s]/g, '').replace(/\\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : '';
        }

        function updateUrlPreview() {
            const title = titleInput.value.trim();
            const slug = generateSlug(title) || 'untitled';
            urlPreview.textContent = window.location.origin + '/song/' + slug;
            filenamePreview.textContent = (title || 'untitled') + ' (ZEDALBUMS).mp3';
        }

        titleInput.addEventListener('input', updateUrlPreview);

        window.copyUrl = function(e) {
            navigator.clipboard.writeText(urlPreview.textContent).then(() => {
                const btn = e.currentTarget;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i> Copy', 2000);
            });
        };

        function toggleDropdown(type) {
            const dropdown = document.getElementById(type + 'Dropdown');
            const isVisible = dropdown.style.display === 'block';
            document.querySelectorAll('.searchable-dropdown').forEach(d => d.style.display = 'none');
            dropdown.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) renderList(type);
        }

        function renderList(type) {
            const search = document.getElementById(type + 'Search')?.value.toLowerCase() || '';
            const list = document.getElementById(type === 'genre' ? 'genreList' : type + 'ArtistList');
            if (type === 'genre') {
                const filtered = genresData.filter(g => g.name.toLowerCase().includes(search));
                list.innerHTML = filtered.map(g => \`<div class="artist-item" onclick="selectGenre('\${g.id}', '\${g.name}')">\${g.name}</div>\`).join('');
            } else {
                const filtered = artistsData.filter(a => a.name.toLowerCase().includes(search));
                list.innerHTML = filtered.map(a => \`<div class="artist-item" onclick="selectArtist('\${type}', '\${a.id}', '\${a.name}')">\${a.name}</div>\`).join('');
            }
        }

        window.filterArtists = (type) => renderList(type);
        window.filterGenres = () => renderList('genre');

        function selectArtist(type, id, name) {
            if (type === 'primary') {
                document.getElementById('primaryArtistInput').value = id;
                document.getElementById('primarySelectedDisplay').textContent = name;
            } else if (!featuredArtists.includes(id)) {
                featuredArtists.push(id);
                updateFeaturedTags();
            }
            toggleDropdown(type);
        }

        function selectGenre(id, name) {
            selectedGenre = id;
            document.getElementById('genreInput').value = id;
            document.getElementById('genreSelectedDisplay').textContent = name;
            const container = document.getElementById('selectedGenreContainer');
            container.innerHTML = \`<div class="genre-tag">\${name} <i class="fas fa-times" onclick="removeGenre()"></i></div>\`;
            toggleDropdown('genre');
        }

        window.removeGenre = () => {
            selectedGenre = null;
            document.getElementById('genreInput').value = '';
            document.getElementById('genreSelectedDisplay').textContent = '-- Add Genre --';
            document.getElementById('selectedGenreContainer').innerHTML = '';
        };

        function updateFeaturedTags() {
            const container = document.getElementById('selectedFeaturedContainer');
            container.innerHTML = featuredArtists.map((id, i) => \`<div class="featured-tag">\${id} <i class="fas fa-times" onclick="removeFeat(\${i})"></i></div>\`).join('');
            document.getElementById('featuredInput').value = JSON.stringify(featuredArtists);
        }

        window.removeFeat = (i) => { featuredArtists.splice(i, 1); updateFeaturedTags(); };

        function showCreateArtist(type) {
            toggleDropdown(type);
            document.getElementById(type + 'NewArtistContainer').style.display = 'block';
        }

        function saveNewArtist(type) {
            const name = document.getElementById(type + 'NewArtistName').value.trim();
            if (name) selectArtist(type, 'new_' + name, name);
            cancelNewArtist(type);
        }

        function cancelNewArtist(type) {
            document.getElementById(type + 'NewArtistContainer').style.display = 'none';
        }

        document.getElementById('audioFile').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            document.getElementById('durationContainer').style.display = 'block';
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const buffer = await file.arrayBuffer();
            ctx.decodeAudioData(buffer, (b) => {
                document.getElementById('durationInput').value = b.duration.toFixed(3);
                document.getElementById('durationText').textContent = "Detected: " + Math.floor(b.duration/60) + ":" + Math.floor(b.duration%60).toString().padStart(2,'0');
            });
        });
        
        document.getElementById('uploadForm').onsubmit = () => { document.getElementById('loadingOverlay').style.display = 'flex'; };
    </script>
  `;

  return content;
}

// ===== POST HANDLER =====
export async function handleAdminUploadPost(req, env, ctx, auth) {
  try {
    const formData = await req.formData();
    const rawTitle = formData.get('title');
    const rawArtist = formData.get('artist');
    const description = formData.get('description');
    const audioFile = formData.get('audio');
    const imageFile = formData.get('image');
    const albumId = formData.get('album');
    const playlistId = formData.get('playlist');
    const featuredJson = formData.get('featured');
    const browserDuration = formData.get('duration');
    const genreInput = formData.get('genre');
    const SITENAME = "ZEDALBUMS";

    if (!rawTitle || !audioFile || !imageFile) {
      return { success: false, error: 'Missing required fields' };
    }

    // 1. Process Genre
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

    // 2. Resolve Featured Artists
    let featuredArtists = [];
    try { featuredArtists = featuredJson ? JSON.parse(featuredJson) : []; } catch (e) {}
    const processedFeatured = [];
    for (const feat of featuredArtists) {
      if (feat.startsWith('new_')) {
        const name = feat.replace('new_', '');
        const id = sanitize(name);
        const artists = await getArtists(env);
        if (!artists[id]) {
          artists[id] = { id, name, created: Date.now(), songs: [], albums: [] };
          await saveArtists(env, artists);
        }
        processedFeatured.push(id);
      } else { processedFeatured.push(feat); }
    }

    // 3. Resolve Primary Artist (Exclude "new_" from ID3 name)
    let artistName = rawArtist;
    let artistId = rawArtist;
    if (rawArtist && rawArtist.startsWith('new_')) {
      artistName = rawArtist.replace('new_', '');
      artistId = sanitize(artistName);
      const artists = await getArtists(env);
      if (!artists[artistId]) {
        artists[artistId] = { id: artistId, name: artistName, created: Date.now(), songs: [], albums: [] };
        await saveArtists(env, artists);
      }
    } else {
      const artists = await getArtists(env);
      artistName = artists[rawArtist]?.name || rawArtist;
    }

    // 4. File Management & ID3
    const safeTitle = sanitize(rawTitle);
    const audioKey = `songs/${safeTitle}.mp3`; // Internal key is just the title
    const imageKey = `images/${safeTitle}.${imageFile.type.includes('png') ? 'png' : 'jpg'}`;
    const descKey = `descriptions/${safeTitle}.txt`;

    const audioBuffer = await audioFile.arrayBuffer();
    const duration = parseFloat(browserDuration) || fallbackDurationParser(audioBuffer);

    // ID3 Logic
    const taggedTitle = `${rawTitle} (${SITENAME})`;
    const taggedArtist = `${artistName} | ${SITENAME}`; // No featured artists here
    const finalFilename = `${rawTitle} (${SITENAME}).mp3`; // Clean download name

    const taggedMp3 = addID3Tags(audioBuffer, {
      title: taggedTitle,
      artist: taggedArtist,
      duration: Math.floor(duration * 1000)
    });

    // Store Files
    await env.media.put(audioKey, taggedMp3, {
      httpMetadata: { 
        contentType: 'audio/mpeg',
        contentDisposition: `attachment; filename="${finalFilename}"`
      }
    });
    await env.media.put(imageKey, imageFile.stream());
    await env.media.put(descKey, description);

    // 5. Database & Slug registration
    const slugManager = new SlugManager(env);
    const baseSlug = slugManager.generateSongSlug(rawTitle, '');
    const finalSlug = await slugManager.generateUniqueSlug('songs', baseSlug);

    await slugManager.registerSlug('songs', safeTitle, finalSlug, {
      title: rawTitle,
      artist: artistId,
      artistName: artistName,
      duration,
      genre,
      featured: processedFeatured,
      uploadedAt: Date.now()
    });

    const metadata = { title: rawTitle, primaryArtist: artistId, featuredArtists: processedFeatured, description, duration, genre, filename: finalFilename };
    await saveMetadata(env, safeTitle, metadata);

    // Associations
    if (albumId && albumId !== '' && albumId !== '__create_new__') {
      await addSongToAlbum(env, albumId, safeTitle);
      await addAlbumToArtist(env, artistId, albumId);
      await addArtistToAlbum(env, artistId, albumId);
    }
    if (playlistId && playlistId !== '' && playlistId !== '__create_new__') {
      await addSongToPlaylist(env, playlistId, safeTitle);
    }
    await addSongToArtist(env, artistId, safeTitle);
    for (const fid of processedFeatured) { await addSongToArtist(env, fid, safeTitle); }

    await logAdminActivity(env, auth.session.id, 'upload', 'song', safeTitle, rawTitle);

    return { success: true, slug: finalSlug, title: rawTitle };
    
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message };
  }
}

// ===== ID3 TAGGING FUNCTIONS =====
function addID3Tags(audioBuffer, tags) {
  const audioBytes = new Uint8Array(audioBuffer);
  const frames = [];
  
  if (tags.artist) frames.push(createTextFrame('TPE1', tags.artist));
  if (tags.title) frames.push(createTextFrame('TIT2', tags.title));
  if (tags.duration) frames.push(createTextFrame('TLEN', tags.duration.toString()));
  
  const framesSize = frames.reduce((acc, f) => acc + f.length, 0);
  const header = new Uint8Array(10);
  header.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00], 0);
  
  const size = framesSize;
  header.set([(size >> 21) & 0x7F, (size >> 14) & 0x7F, (size >> 7) & 0x7F, size & 0x7F], 6);
  
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
  frame.set(new TextEncoder().encode(type), 0);
  const size = 1 + enc.length;
  frame[4] = (size >> 24) & 0xFF;
  frame[5] = (size >> 16) & 0xFF;
  frame[6] = (size >> 8) & 0xFF;
  frame[7] = size & 0xFF;
  frame[10] = 0x03; // UTF-8 Encoding
  frame.set(enc, 11);
  return frame;
}
