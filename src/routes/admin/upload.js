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
                            <i class="fas fa-file-audio" style="color: #4a90e2; flex-shrink: 0;"></i>
                            <span style="font-size: 0.9rem; font-weight: 500;">Download Filename:</span>
                            <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;" id="filenamePreview">untitled (ZEDALBUMS).mp3</code>
                        </div>
                    </div>
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
                        <button type="button" onclick="saveNewArtist('primary')" class="btn btn-primary">Save</button>
                        <button type="button" onclick="cancelNewArtist('primary')" class="btn btn-secondary">✕</button>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label><i class="fas fa-users" style="color: #ff5500; width: 20px;"></i> Featured Artists</label>
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
                            <button type="button" onclick="showCreateArtist('featured')" class="btn btn-secondary btn-sm" style="width: 100%;">Create New Artist</button>
                        </div>
                    </div>
                </div>
                <input type="hidden" name="featured" id="featuredInput" value="">
            </div>

            <div class="form-group">
                <label><i class="fas fa-tags" style="color: #ff5500; width: 20px;"></i> Genre</label>
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
                    </div>
                </div>
                <input type="hidden" name="genre" id="genreInput" value="">
            </div>

            <div class="form-group">
                <label><i class="fas fa-align-left" style="color: #ff5500; width: 20px;"></i> Description</label>
                <textarea name="description" class="form-control" rows="3" placeholder="Song description..." required></textarea>
            </div>

            <div class="form-group">
                <label><i class="fas fa-compact-disc" style="color: #ff5500; width: 20px;"></i> Album (Optional)</label>
                <select name="album" id="albumSelect" class="form-control">
                    <option value="">-- Select Album --</option>
                    ${albumOptions}
                    <option value="__create_new__">➕ Create New Album</option>
                </select>
            </div>
            
            <div class="form-group">
                <label><i class="fas fa-list" style="color: #ff5500; width: 20px;"></i> Add to Playlist (Optional)</label>
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
                        <input type="hidden" name="duration" id="durationInput" value="">
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label><i class="fas fa-image" style="color: #ff5500; width: 20px;"></i> Thumbnail Image</label>
                <input type="file" name="image" accept="image/*" class="form-control" required>
            </div>

            <div style="margin-top: 30px;">
                <button type="submit" id="submitBtn" class="btn btn-primary btn-block" style="padding: 16px; width: 100%;">
                    <i class="fas fa-cloud-upload-alt"></i> Upload Song
                </button>
            </div>

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
        .btn { padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; }
        .btn-primary { background: #ff5500; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .searchable-select-container { position: relative; }
        .searchable-select { padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; }
        .searchable-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 2px solid #e0e0e0; z-index: 1000; max-height: 300px; overflow-y: auto; }
        .artist-item { padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; }
        .artist-item:hover { background: #f8f9fa; }
        .featured-tag, .genre-tag { display: inline-flex; align-items: center; gap: 5px; background: #eee; padding: 5px 10px; border-radius: 20px; margin: 2px; }
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
                const old = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => btn.innerHTML = old, 2000);
            });
        };

        // Standard helpers for selection
        function toggleDropdown(id) { 
            const d = document.getElementById(id + 'Dropdown');
            d.style.display = d.style.display === 'none' ? 'block' : 'none';
        }
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
        function updateFeaturedTags() {
            const container = document.getElementById('selectedFeaturedContainer');
            container.innerHTML = featuredArtists.map((id, i) => \`<div class="featured-tag">\${id} <i class="fas fa-times" onclick="removeFeat(\${i})"></i></div>\`).join('');
            document.getElementById('featuredInput').value = JSON.stringify(featuredArtists);
        }
        window.removeFeat = (i) => { featuredArtists.splice(i, 1); updateFeaturedTags(); };
        
        // Duration logic
        document.getElementById('audioFile').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            document.getElementById('durationContainer').style.display = 'block';
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const buffer = await file.arrayBuffer();
            ctx.decodeAudioData(buffer, (b) => {
                document.getElementById('durationInput').value = b.duration.toFixed(3);
                document.getElementById('durationText').textContent = "Duration: " + Math.floor(b.duration/60) + ":" + Math.floor(b.duration%60).toString().padStart(2,'0');
            });
        });

        // Initialize lists
        function renderArtistList(type) {
            const list = document.getElementById(type + 'ArtistList');
            list.innerHTML = artistsData.map(a => \`<div class="artist-item" onclick="selectArtist('\${type}', '\${a.id}', '\${a.name}')">\${a.name}</div>\`).join('');
        }
        renderArtistList('primary'); renderArtistList('featured');
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
    const browserDuration = formData.get('duration');
    const genreInput = formData.get('genre');
    const SITENAME = "ZEDALBUMS";

    // 1. Resolve Primary Artist Name (Clean for ID3)
    let primaryArtistName = rawArtist;
    let artistId = rawArtist;
    if (rawArtist && rawArtist.startsWith('new_')) {
      primaryArtistName = rawArtist.replace('new_', '');
      artistId = sanitize(primaryArtistName);
      const artists = await getArtists(env);
      if (!artists[artistId]) {
        artists[artistId] = { id: artistId, name: primaryArtistName, created: Date.now(), songs: [], albums: [] };
        await saveArtists(env, artists);
      }
    } else {
      const artists = await getArtists(env);
      primaryArtistName = artists[rawArtist]?.name || rawArtist;
    }

    // 2. Storage Keys
    const safeTitle = sanitize(rawTitle);
    const audioKey = `songs/${safeTitle}.mp3`; // Filename is just title.mp3
    const imageKey = `images/${safeTitle}.${imageFile.type.includes('png') ? 'png' : 'jpg'}`;

    // 3. ID3 Preparation
    const audioBuffer = await audioFile.arrayBuffer();
    const duration = parseFloat(browserDuration) || 0;
    
    const taggedTitle = `${rawTitle} (${SITENAME})`; 
    const taggedArtist = `${primaryArtistName} | ${SITENAME}`; // No featured artists
    const finalFilename = `${rawTitle} (${SITENAME}).mp3`; // Clean download name

    const taggedMp3 = addID3Tags(audioBuffer, {
      title: taggedTitle,
      artist: taggedArtist,
      duration: Math.floor(duration * 1000)
    });

    // 4. Save to R2
    await env.media.put(audioKey, taggedMp3, {
      httpMetadata: { 
        contentType: 'audio/mpeg',
        contentDisposition: `attachment; filename="${finalFilename}"`
      }
    });
    await env.media.put(imageKey, imageFile.stream());

    // 5. Register Slug & Metadata
    const slugManager = new SlugManager(env);
    const baseSlug = slugManager.generateSongSlug(rawTitle, '');
    const finalSlug = await slugManager.generateUniqueSlug('songs', baseSlug);

    await slugManager.registerSlug('songs', safeTitle, finalSlug, {
      title: rawTitle,
      artist: artistId,
      artistName: primaryArtistName,
      duration,
      uploadedAt: Date.now()
    });

    return { success: true, slug: finalSlug, filename: finalFilename };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== ID3 HELPERS (UTF-8 FIX) =====
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
