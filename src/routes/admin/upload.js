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
  
  const albumOptions = Object.keys(albums).map(id => {
    const album = albums[id];
    return `<option value="${id}">${album.title} (${album.songs?.length || 0} tracks)${album.genre ? ` - ${album.genre}` : ''}</option>`;
  }).join("");

  const artistOptions = Object.keys(artists).map(id => {
    const artist = artists[id];
    return `<option value="${id}">${artist.name} (${artist.songs?.length || 0} songs)</option>`;
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
                <label><i class="fas fa-heading" style="color: #ff5500; width: 20px;"></i> Song Title</label>
                <input type="text" name="title" id="songTitle" class="form-control" placeholder="e.g. God's Plan" required>
                
                <div style="margin-top: 10px; background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0;">
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <span style="font-size: 0.85rem; color: #666;">Public URL (slug):</span>
                        <code id="urlPreview" style="color: #ff5500; font-weight: bold;">/song/...</code>
                        
                        <span style="font-size: 0.85rem; color: #666; margin-top: 5px;">Internal ID:</span>
                        <code id="idPreview" style="color: #4a90e2;">undefined</code>

                        <span style="font-size: 0.85rem; color: #666; margin-top: 5px;">Download Filename:</span>
                        <code id="filenamePreview" style="color: #28a745;">untitled (ZEDALBUMS).mp3</code>
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label><i class="fas fa-microphone" style="color: #ff5500; width: 20px;"></i> Primary Artist</label>
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
                            <button type="button" onclick="showCreateArtist('primary')" class="btn btn-secondary btn-sm" style="width: 100%;">+ Create New Artist</button>
                        </div>
                    </div>
                </div>
                <input type="hidden" name="artist" id="primaryArtistInput" value="">
                <div id="primaryNewArtistContainer" style="margin-top: 10px; display: none;">
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="primaryNewArtistName" class="form-control" placeholder="Artist Name">
                        <button type="button" onclick="saveNewArtist('primary')" class="btn btn-primary">Save</button>
                        <button type="button" onclick="cancelNewArtist('primary')" class="btn btn-secondary">X</button>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label><i class="fas fa-users" style="color: #ff5500; width: 20px;"></i> Featured Artists</label>
                <div id="selectedFeaturedContainer" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;"></div>
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
                            <button type="button" onclick="showCreateArtist('featured')" class="btn btn-secondary btn-sm" style="width: 100%;">+ Create New Artist</button>
                        </div>
                    </div>
                </div>
                <input type="hidden" name="featured" id="featuredInput" value="[]">
                <div id="featuredNewArtistContainer" style="margin-top: 10px; display: none;">
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="featuredNewArtistName" class="form-control" placeholder="Artist Name">
                        <button type="button" onclick="saveNewArtist('featured')" class="btn btn-primary">Save</button>
                        <button type="button" onclick="cancelNewArtist('featured')" class="btn btn-secondary">X</button>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label><i class="fas fa-tags" style="color: #ff5500; width: 20px;"></i> Genre</label>
                <div id="selectedGenreContainer" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;"></div>
                <div class="searchable-select-container">
                    <div class="searchable-select" onclick="toggleDropdown('genre')">
                        <span id="genreSelectedDisplay">-- Select Genre --</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <div id="genreDropdown" class="searchable-dropdown" style="display: none;">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="genreSearch" placeholder="Search genres..." onkeyup="filterGenres()">
                        </div>
                        <div class="artist-list" id="genreList"></div>
                    </div>
                </div>
                <input type="hidden" name="genre" id="genreInput" value="">
            </div>

            <div class="form-group">
                <label><i class="fas fa-align-left" style="color: #ff5500; width: 20px;"></i> Description</label>
                <textarea name="description" class="form-control" rows="3" required></textarea>
            </div>

            <div class="form-group">
                <label><i class="fas fa-compact-disc" style="color: #ff5500; width: 20px;"></i> Album (Optional)</label>
                <select name="album" class="form-control">
                    <option value="">-- No Album --</option>
                    ${albumOptions}
                </select>
            </div>

            <div class="form-group">
                <label><i class="fas fa-file-audio" style="color: #ff5500; width: 20px;"></i> Audio File (.mp3)</label>
                <input type="file" name="audio" id="audioFile" accept=".mp3" class="form-control" required>
                <div id="durationContainer" style="margin-top: 10px; display: none; padding: 10px; background: #fff3cd; border-radius: 5px;">
                    <span id="durationText">Duration: ?:??</span>
                </div>
                <input type="hidden" name="duration" id="durationInput" value="0">
            </div>

            <div class="form-group">
                <label><i class="fas fa-image" style="color: #ff5500; width: 20px;"></i> Cover Image</label>
                <input type="file" name="image" accept="image/*" class="form-control" required>
            </div>

            <button type="submit" id="submitBtn" class="btn btn-primary" style="width: 100%; padding: 15px; font-weight: bold;">UPLOAD SONG</button>

            <div id="loadingOverlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; flex-direction: column; align-items: center; justify-content: center; color: white;">
                <i class="fas fa-circle-notch fa-spin fa-3x" style="margin-bottom: 15px;"></i>
                <span>Processing ID3 Tags & Uploading...</span>
            </div>
        </form>
    </div>

    <style>
        .form-group { margin-bottom: 15px; }
        .form-control { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
        .searchable-select-container { position: relative; }
        .searchable-select { padding: 10px; border: 1px solid #ddd; border-radius: 5px; cursor: pointer; display: flex; justify-content: space-between; background: white; }
        .searchable-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ddd; z-index: 100; max-height: 250px; overflow-y: auto; }
        .search-box { padding: 10px; border-bottom: 1px solid #eee; display: flex; gap: 10px; }
        .artist-list { padding: 0; }
        .artist-item { padding: 10px; cursor: pointer; border-bottom: 1px solid #f9f9f9; }
        .artist-item:hover { background: #f0f0f0; }
        .btn { border: none; border-radius: 5px; cursor: pointer; }
        .btn-primary { background: #ff5500; color: white; }
        .btn-secondary { background: #666; color: white; }
        .tag { background: #ff5500; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; display: flex; align-items: center; gap: 5px; margin-right: 5px; margin-bottom: 5px; }
    </style>

    <script>
        const artists = ${JSON.stringify(artists)};
        const genres = ${JSON.stringify(genres)};
        let featuredList = [];

        // Correctly mirror your formatting.js sanitize function
        function sanitize(text) {
            if (!text) return '';
            return text.toLowerCase().replace(/[^a-z0-9\\s]/g, '').replace(/\\s+/g, '_');
        }

        // --- PREVIEW LOGIC (FIXED) ---
        document.getElementById('songTitle').addEventListener('input', function(e) {
            const title = e.target.value;
            const safe = sanitize(title);
            
            document.getElementById('idPreview').textContent = safe || 'undefined';
            document.getElementById('urlPreview').textContent = '/song/' + safe.replace(/_/g, '-');
            document.getElementById('filenamePreview').textContent = (title || 'untitled') + ' (ZEDALBUMS).mp3';
        });

        // --- DROPDOWN LOGIC ---
        function toggleDropdown(id) {
            const el = document.getElementById(id + 'Dropdown');
            const isNone = el.style.display === 'none';
            document.querySelectorAll('.searchable-dropdown').forEach(d => d.style.display = 'none');
            el.style.display = isNone ? 'block' : 'none';
            if(el.style.display === 'block') renderList(id);
        }

        function renderList(type) {
            const search = document.getElementById(type + 'Search').value.toLowerCase();
            const list = document.getElementById(type === 'genre' ? 'genreList' : type + 'ArtistList');
            let html = '';
            
            if(type === 'genre') {
                genres.filter(g => g.name.toLowerCase().includes(search)).forEach(g => {
                    html += \`<div class="artist-item" onclick="selectGenre('\${g.id}', '\${g.name}')">\${g.name}</div>\`;
                });
            } else {
                Object.keys(artists).filter(id => artists[id].name.toLowerCase().includes(search)).forEach(id => {
                    html += \`<div class="artist-item" onclick="selectArtist('\${type}', '\${id}', '\${artists[id].name}')">\${artists[id].name}</div>\`;
                });
            }
            list.innerHTML = html;
        }

        window.filterArtists = (type) => renderList(type);
        window.filterGenres = () => renderList('genre');

        function selectArtist(type, id, name) {
            if(type === 'primary') {
                document.getElementById('primaryArtistInput').value = id;
                document.getElementById('primarySelectedDisplay').textContent = name;
            } else {
                if(!featuredList.includes(id)) {
                    featuredList.push(id);
                    updateFeaturedUI();
                }
            }
            toggleDropdown(type);
        }

        function updateFeaturedUI() {
            const container = document.getElementById('selectedFeaturedContainer');
            container.innerHTML = featuredList.map(id => {
                const name = artists[id] ? artists[id].name : id.replace('new_', '');
                return \`<span class="tag">\${name} <i class="fas fa-times" style="cursor:pointer" onclick="removeFeatured('\${id}')"></i></span>\`;
            }).join('');
            document.getElementById('featuredInput').value = JSON.stringify(featuredList);
        }

        window.removeFeatured = (id) => {
            featuredList = featuredList.filter(i => i !== id);
            updateFeaturedUI();
        }

        function selectGenre(id, name) {
            document.getElementById('genreInput').value = id;
            document.getElementById('genreSelectedDisplay').textContent = name;
            document.getElementById('selectedGenreContainer').innerHTML = \`<span class="tag">\${name}</span>\`;
            toggleDropdown('genre');
        }

        function showCreateArtist(type) {
            document.getElementById(type + 'NewArtistContainer').style.display = 'block';
            document.querySelectorAll('.searchable-dropdown').forEach(d => d.style.display = 'none');
        }

        window.saveNewArtist = (type) => {
            const name = document.getElementById(type + 'NewArtistName').value;
            if(name) selectArtist(type, 'new_' + name, name);
            cancelNewArtist(type);
        }

        window.cancelNewArtist = (type) => {
            document.getElementById(type + 'NewArtistContainer').style.display = 'none';
            document.getElementById(type + 'NewArtistName').value = '';
        }

        // --- AUDIO DURATION (FIXED) ---
        document.getElementById('audioFile').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if(!file) return;
            const audio = new Audio();
            audio.src = URL.createObjectURL(file);
            audio.onloadedmetadata = function() {
                const dur = audio.duration;
                document.getElementById('durationInput').value = dur;
                const min = Math.floor(dur/60);
                const sec = Math.floor(dur%60).toString().padStart(2, '0');
                document.getElementById('durationText').textContent = "Duration: " + min + ":" + sec;
                document.getElementById('durationContainer').style.display = 'block';
            };
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
    const audioFile = formData.get('audio');
    const imageFile = formData.get('image');
    const SITENAME = "ZEDALBUMS";

    // 1. Resolve Primary Artist Name for ID3 (Clean)
    let cleanArtistName = "";
    if (rawArtist.startsWith('new_')) {
        cleanArtistName = rawArtist.replace('new_', '');
    } else {
        const artists = await getArtists(env);
        cleanArtistName = artists[rawArtist]?.name || "Unknown Artist";
    }

    // 2. Storage Setup
    const safeTitle = sanitize(rawTitle);
    const audioKey = `songs/${safeTitle}.mp3`; 
    const imageKey = `images/${safeTitle}.jpg`;

    // 3. ID3 & Filename
    const audioBuffer = await audioFile.arrayBuffer();
    const duration = parseFloat(formData.get('duration')) || 0;
    
    // Requirements: ID3 is title (site) | artist | site
    const taggedTitle = `${rawTitle} (${SITENAME})`;
    const taggedArtist = `${cleanArtistName} | ${SITENAME}`;
    const cleanDownloadName = `${rawTitle} (${SITENAME}).mp3`;

    const taggedMp3 = addID3Tags(audioBuffer, {
      title: taggedTitle,
      artist: taggedArtist,
      duration: Math.floor(duration * 1000)
    });

    // 4. Upload to R2 with correct download name header
    await env.media.put(audioKey, taggedMp3, {
      httpMetadata: { 
        contentType: 'audio/mpeg',
        contentDisposition: `attachment; filename="${cleanDownloadName}"`
      }
    });
    await env.media.put(imageKey, imageFile.stream());

    // 5. Database Save & Slug
    const slugManager = new SlugManager(env);
    const baseSlug = safeTitle.replace(/_/g, '-');
    const finalSlug = await slugManager.generateUniqueSlug('songs', baseSlug);

    const artistId = rawArtist.startsWith('new_') ? sanitize(cleanArtistName) : rawArtist;
    
    // Ensure artist exists in DB
    const artists = await getArtists(env);
    if (!artists[artistId]) {
        artists[artistId] = { id: artistId, name: cleanArtistName, created: Date.now(), songs: [], albums: [] };
        await saveArtists(env, artists);
    }

    await saveMetadata(env, safeTitle, {
      title: rawTitle,
      artist: artistId,
      artistName: cleanArtistName,
      duration: duration,
      uploadedAt: Date.now(),
      filename: cleanDownloadName
    });

    await addSongToArtist(env, artistId, safeTitle);
    await logAdminActivity(env, auth.session.id, 'upload', 'song', safeTitle, rawTitle);

    return { success: true, slug: finalSlug };

  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

// ===== ID3 ENGINE =====
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
  for (const f of frames) { final.set(f, offset); offset += f.length; }
  final.set(audioBytes, offset);
  return final;
}

function createTextFrame(type, value) {
  const enc = new TextEncoder().encode(value);
  const frame = new Uint8Array(10 + 1 + enc.length);
  frame.set(new TextEncoder().encode(type), 0);
  const size = 1 + enc.length;
  frame[4] = (size >> 24) & 0xFF; frame[5] = (size >> 16) & 0xFF; 
  frame[6] = (size >> 8) & 0xFF; frame[7] = size & 0xFF;
  frame[10] = 0x03; // UTF-8 Encoding
  frame.set(enc, 11);
  return frame;
}
