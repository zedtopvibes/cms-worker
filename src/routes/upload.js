// ==================== UPLOAD ROUTES ====================
import { getAlbums, getArtists, getPlaylists, saveArtists, saveMetadata, addSongToAlbum, addSongToPlaylist, addSongToArtist, addAlbumToArtist, addArtistToAlbum } from '../helpers/storage.js';
import { sanitize, formatDuration, fallbackDurationParser } from '../helpers/formatting.js';

export async function handleUpload(req, env, ctx) {
  const url = new URL(req.url);
  
  // GET - Show upload form
  if (req.method === "GET") {
    const albums = await getAlbums(env);
    const albumOptions = Object.keys(albums).map(id => {
      const album = albums[id];
      return `<option value="${id}">${album.title}</option>`;
    }).join("");
    
    const albumSection = `
      <label>Album (Optional)</label>
      <select name="album" style="padding:8px; margin-top:5px;">
        <option value="">-- Select Album --</option>
        ${albumOptions}
        <option value="__create_new__">[Create New Album]</option>
      </select>
      <p style="margin-top:5px; font-size:0.9em;">
        Or <a href="/album/create" style="color:#007bff; text-decoration:none;">create a new album</a>
      </p>
    `;

    const artists = await getArtists(env);
    const artistOptions = Object.keys(artists).map(id => {
      const artist = artists[id];
      return `<option value="${id}">${artist.name}</option>`;
    }).join("");
    
    const playlists = await getPlaylists(env);
    const playlistOptions = Object.keys(playlists).map(id => {
      const playlist = playlists[id];
      return `<option value="${id}">${playlist.title}</option>`;
    }).join("");
    
    const playlistSection = `
      <label>Add to Playlist (Optional)</label>
      <select name="playlist" style="padding:8px; margin-top:5px; border-color: #4a90e2;">
        <option value="">-- Select Playlist --</option>
        ${playlistOptions}
        <option value="__create_new__">[Create New Playlist]</option>
      </select>
      <p style="margin-top:5px; font-size:0.9em;">
        Or <a href="/playlist/create" style="color:#4a90e2; text-decoration:none;">create a new playlist</a>
      </p>
    `;
    
    const artistSection = `
      <label>Primary Artist</label>
      <select name="artist" id="artistSelect" required style="padding:8px; margin-top:5px;">
        <option value="">-- Select Primary Artist --</option>
        ${artistOptions}
        <option value="__create_new__">[Create New Artist]</option>
      </select>
      <p style="margin-top:5px; font-size:0.9em;">
        <a href="/artist/create" id="createArtistLink" style="color:#007bff; text-decoration:none; display:none;">Create New Artist</a>
        <span id="existingArtistNote" style="display:none;">Or select existing artist above</span>
      </p>
      <input type="text" name="artist_name" id="artistNameInput" placeholder="Enter new artist name" style="padding:8px; margin-top:5px; display:none;">

      <label>Featured Artists (Optional, multi-select)</label>
      <select name="featured" multiple size="4" style="padding:8px; margin-top:5px;">
        <option value="">-- None --</option>
        ${artistOptions}
      </select>
      <p style="margin-top:5px; font-size:0.9em; color:#666;">Hold Ctrl/Cmd to select multiple</p>
    `;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Upload Song - ZEDALBUMS</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 20px; border-left: 4px solid #ff5500; padding-left: 15px; }
        label { display: block; margin-top: 15px; font-weight: 600; color: #555; }
        input, textarea, select { width: 100%; padding: 12px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; }
        button { margin-top: 25px; padding: 14px; background: #ff5500; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 600; width: 100%; }
        button:hover { background: #ff6a1a; }
        .back-link { margin-top: 20px; text-align: center; }
        .back-link a { color: #666; text-decoration: none; }
        .back-link a:hover { color: #ff5500; }
        .section-title { margin-top: 25px; margin-bottom: 10px; font-size: 1.1rem; font-weight: 600; color: #444; border-bottom: 1px solid #eee; padding-bottom: 8px; }
        select[multiple] { height: auto; min-height: 100px; }
        #duration-display { margin-top: 10px; padding: 10px; background: #e8f4fd; border-radius: 4px; display: none; border-left: 3px solid #ff5500; }
        .progress-bar { width: 100%; height: 4px; background: #f0f0f0; border-radius: 2px; margin-top: 10px; display: none; }
        .progress-fill { height: 100%; background: #ff5500; width: 0%; border-radius: 2px; transition: width 0.3s; }
        .exact-badge { background: #00aa00; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px; margin-left: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Upload New Song</h1>
        <form id="uploadForm" action="/upload" method="POST" enctype="multipart/form-data">
            <label>Song Title</label>
            <input type="text" name="title" placeholder="e.g. My Song" required>
            
            ${artistSection}
            
            <label>Description</label>
            <textarea name="description" rows="3" placeholder="Song description..." required></textarea>
            
            <div class="section-title">Album Information</div>
            ${albumSection}
            
            <div class="section-title" style="border-bottom-color: #4a90e2;">Playlist Information</div>
            ${playlistSection}
            
            <label>Audio File (.mp3)</label>
            <input type="file" name="audio" id="audioFile" accept=".mp3" required>
            
            <!-- Hidden input for exact duration -->
            <input type="hidden" name="duration" id="durationInput" value="">
            
            <!-- Live duration display -->
            <div id="duration-display">
                <strong>Song Duration:</strong> <span id="duration-text">Analyzing...</span>
                <span class="exact-badge" id="exact-badge" style="display:none;">EXACT</span>
            </div>
            
            <div class="progress-bar" id="progress-bar">
                <div class="progress-fill" id="progress-fill"></div>
            </div>
            
            <label>Thumbnail Image</label>
            <input type="file" name="image" accept="image/*" required>
            
            <button type="submit" id="submitBtn">Upload Song</button>
        </form>
        
        <div class="back-link">
            <a href="/">← Back to Home</a> | 
            <a href="/playlists">View Playlists</a>
        </div>
    </div>

    <script>
        // Audio context for exact duration detection
        let audioContext = null;
        
        // Get elements
        const audioFile = document.getElementById('audioFile');
        const durationDisplay = document.getElementById('duration-display');
        const durationText = document.getElementById('duration-text');
        const durationInput = document.getElementById('durationInput');
        const progressBar = document.getElementById('progress-bar');
        const progressFill = document.getElementById('progress-fill');
        const exactBadge = document.getElementById('exact-badge');
        const submitBtn = document.getElementById('submitBtn');
        
        // When user selects an audio file
        audioFile.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // Show analyzing UI
            durationDisplay.style.display = 'block';
            durationText.textContent = 'Analyzing...';
            exactBadge.style.display = 'none';
            progressBar.style.display = 'block';
            progressFill.style.width = '30%';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            
            try {
                // Initialize AudioContext (requires user interaction - click is fine)
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                
                // Read file as ArrayBuffer
                const arrayBuffer = await file.arrayBuffer();
                
                // Decode audio data for EXACT duration
                progressFill.style.width = '60%';
                
                audioContext.decodeAudioData(
                    arrayBuffer,
                    function(buffer) {
                        // EXACT duration in seconds (with decimals)
                        const exactSeconds = buffer.duration;
                        const minutes = Math.floor(exactSeconds / 60);
                        const seconds = Math.floor(exactSeconds % 60);
                        const milliseconds = Math.floor((exactSeconds % 1) * 1000);
                        
                        // Format nicely
                        const formatted = minutes + ':' + seconds.toString().padStart(2,'0') + '.' + milliseconds.toString().padStart(3,'0');
                        
                        // Update display
                        durationText.innerHTML = formatted + ' <small>(' + exactSeconds.toFixed(3) + ' seconds)</small>';
                        durationInput.value = exactSeconds.toFixed(3);
                        
                        // Show exact badge
                        exactBadge.style.display = 'inline-block';
                        progressFill.style.width = '100%';
                        
                        // Enable submit button
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        
                        // Hide progress bar after a moment
                        setTimeout(() => {
                            progressBar.style.display = 'none';
                        }, 500);
                        
                        console.log('✅ Exact duration detected:', exactSeconds, 'seconds');
                    },
                    function(error) {
                        // Fallback if decoding fails
                        durationText.textContent = 'Could not detect exact duration (will use estimate)';
                        durationInput.value = '0';
                        exactBadge.style.display = 'none';
                        progressBar.style.display = 'none';
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        console.error('Decode error:', error);
                    }
                );
            } catch (error) {
                durationText.textContent = 'Error analyzing file';
                durationInput.value = '0';
                progressBar.style.display = 'none';
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                console.error('Error:', error);
            }
        });

        // Form submission warning if no exact duration
        document.getElementById('uploadForm').addEventListener('submit', function(e) {
            const duration = document.getElementById('durationInput').value;
            if (!duration || duration === '0' || duration === '0.000') {
                if (!confirm('⚠️ Exact duration could not be detected. Continue with estimated duration?')) {
                    e.preventDefault();
                }
            }
        });

        // Handle artist selection
        document.addEventListener('DOMContentLoaded', function() {
            const albumSelect = document.querySelector('select[name="album"]');
            if (albumSelect) {
                albumSelect.addEventListener('change', function() {
                    if (this.value === '__create_new__') {
                        window.location.href = '/album/create';
                    }
                });
            }
            
            const playlistSelect = document.querySelector('select[name="playlist"]');
            if (playlistSelect) {
                playlistSelect.addEventListener('change', function() {
                    if (this.value === '__create_new__') {
                        window.location.href = '/playlist/create';
                    }
                });
            }
            
            const artistSelect = document.getElementById('artistSelect');
            const createArtistLink = document.getElementById('createArtistLink');
            const existingArtistNote = document.getElementById('existingArtistNote');
            const artistNameInput = document.getElementById('artistNameInput');
            
            if (artistSelect) {
                artistSelect.addEventListener('change', function() {
                    if (this.value === '__create_new__') {
                        createArtistLink.style.display = 'block';
                        existingArtistNote.style.display = 'inline';
                        artistNameInput.style.display = 'block';
                        artistNameInput.required = true;
                    } else {
                        createArtistLink.style.display = 'none';
                        existingArtistNote.style.display = 'none';
                        artistNameInput.style.display = 'none';
                        artistNameInput.required = false;
                    }
                });
            }
            
            if (createArtistLink) {
                createArtistLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    const newArtistName = artistNameInput.value.trim();
                    if (newArtistName) {
                        sessionStorage.setItem('newArtistName', newArtistName);
                        window.location.href = '/artist/create';
                    } else {
                        alert('Please enter an artist name first');
                    }
                });
            }
        });
    </script>
</body>
</html>
    `;
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }

  // POST - Handle upload
  if (req.method === "POST") {
    const formData = await req.formData();
    const title = formData.get("title");
    const artist = formData.get("artist");
    const description = formData.get("description");
    const audioFile = formData.get("audio");
    const imageFile = formData.get("image");
    const albumId = formData.get("album");
    const playlistId = formData.get("playlist");
    const artistNameInput = formData.get("artist_name");
    const featured = formData.getAll("featured");
    const browserDuration = formData.get("duration");

    if (!title || !audioFile || !imageFile) {
      return new Response("Missing fields", { status: 400 });
    }

    let artistName = artist;
    let artistId = artist;
    
    // Create new artist if needed
    if (artist === "__create_new__" && artistNameInput) {
      artistName = artistNameInput;
      artistId = sanitize(artistNameInput);
      
      const artists = await getArtists(env);
      
      if (!artists[artistId]) {
        artists[artistId] = {
          id: artistId,
          name: artistName,
          description: "",
          thumbnail: "",
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
    const imgType = imageFile.type.includes("png") ? "png" : "jpg";
    const imageKey = `images/${baseName}.${imgType}`;

    // Read audio file
    const audioBuffer = await audioFile.arrayBuffer();
    
    // Use browser duration if available, otherwise fallback
    let duration;
    if (browserDuration && browserDuration !== '0' && browserDuration !== '0.000') {
      duration = parseFloat(browserDuration);
      console.log(`✅ Using EXACT browser duration: ${duration} seconds`);
    } else {
      // Fallback to simple estimation
      duration = fallbackDurationParser(audioBuffer);
      console.log(`⚠️ Using estimated duration: ${duration} seconds`);
    }

    // Upload files
    await env.media.put(audioKey, audioBuffer);
    await env.media.put(imageKey, imageFile.stream());
    await env.media.put(descKey, description);

    // Create metadata with EXACT duration
    const featuredArtists = featured.filter(id => id && id !== "");
    const metadata = {
      title,
      primaryArtist: artistId,
      featuredArtists,
      description,
      duration: duration
    };
    await saveMetadata(env, baseName, metadata);

    // Add to album if selected
    if (albumId && albumId !== "" && albumId !== "__create_new__") {
      await addSongToAlbum(env, albumId, baseName);
      await addAlbumToArtist(env, artistId, albumId);
      await addArtistToAlbum(env, artistId, albumId);
    }
    
    // Add to playlist if selected
    if (playlistId && playlistId !== "" && playlistId !== "__create_new__") {
      await addSongToPlaylist(env, playlistId, baseName);
    }
    
    // Add to artist's songs
    await addSongToArtist(env, artistId, baseName);
    for (const fid of featuredArtists) {
      await addSongToArtist(env, fid, baseName);
    }

    // Success page
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Successful - ZEDALBUMS</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; text-align: center; }
          .success { background: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
          h1 { color: #28a745; }
          .btn { display: inline-block; margin: 10px; padding: 12px 24px; background: #ff5500; color: white; text-decoration: none; border-radius: 4px; }
          .btn:hover { background: #ff6a1a; }
          .btn-playlist { background: #4a90e2; }
          .btn-playlist:hover { background: #3a7bc8; }
          .btn-album { background: #28a745; }
          .duration-info { background: #e8f4fd; padding: 10px; border-radius: 4px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✅ Upload Successful!</h1>
          <p style="font-size: 1.2rem; margin: 20px 0;">${title} by ${artistName}</p>
          <div class="duration-info">
            <strong>Duration:</strong> ${formatDuration(duration)} (exact)
          </div>
          <a href="/song/${encodeURIComponent(baseName + ".mp3")}" class="btn">View Song</a>
          ${playlistId ? `<a href="/playlist/${playlistId}" class="btn btn-playlist">View Playlist</a>` : ''}
          ${albumId && albumId !== "" && albumId !== "__create_new__" ? `<a href="/album/${albumId}" class="btn btn-album">View Album</a>` : ''}
          <p style="margin-top: 30px;">
            <a href="/upload">Upload Another Song</a> | 
            <a href="/">Back to Home</a>
          </p>
        </div>
      </body>
      </html>
    `;
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }

  return new Response("Method not allowed", { status: 405 });
}