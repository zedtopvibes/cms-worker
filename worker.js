export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

    // -----------------------------
    // PERFORMANCE OPTIMIZATIONS
    // -----------------------------
    let homepageCache = null;
    let cacheTimestamp = 0;
    const CACHE_DURATION = 30000;
    
    let albumsCache = null;
    let artistsCache = null;
    let playlistsCache = null;
    let dataCacheTimestamp = 0;
    const DATA_CACHE_DURATION = 60000;

    // -----------------------------
    // Helper to sanitize filenames
    // -----------------------------
    const sanitize = str => str.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");

    // === PLAYLISTS FUNCTIONS ===
    const getPlaylists = async () => {
      const now = Date.now();
      if (playlistsCache && (now - dataCacheTimestamp < DATA_CACHE_DURATION)) {
        return playlistsCache;
      }
      
      try {
        const playlistsObj = await env.media.get("playlists/index.json");
        if (!playlistsObj) {
          playlistsCache = {};
          dataCacheTimestamp = now;
          return {};
        }
        const text = await playlistsObj.text();
        playlistsCache = JSON.parse(text || "{}");
        dataCacheTimestamp = now;
        return playlistsCache;
      } catch (e) {
        playlistsCache = {};
        dataCacheTimestamp = now;
        return {};
      }
    };

    const savePlaylists = async (playlists) => {
      await env.media.put("playlists/index.json", JSON.stringify(playlists));
      playlistsCache = playlists;
      dataCacheTimestamp = Date.now();
    };

    const createPlaylist = async (playlistId, title, description, thumbnailKey) => {
      const playlists = await getPlaylists();
      playlists[playlistId] = {
        id: playlistId,
        title: title,
        description: description || "",
        thumbnail: thumbnailKey || "",
        created: Date.now(),
        songs: [],
        isPublic: true
      };
      await savePlaylists(playlists);
      return playlistId;
    };

    const addSongToPlaylist = async (playlistId, songKey) => {
      const playlists = await getPlaylists();
      if (playlists[playlistId]) {
        if (!playlists[playlistId].songs.includes(songKey)) {
          playlists[playlistId].songs.push(songKey);
          await savePlaylists(playlists);
          return true;
        }
      }
      return false;
    };

    const removeSongFromPlaylist = async (playlistId, songKey) => {
      const playlists = await getPlaylists();
      if (playlists[playlistId]) {
        const index = playlists[playlistId].songs.indexOf(songKey);
        if (index !== -1) {
          playlists[playlistId].songs.splice(index, 1);
          await savePlaylists(playlists);
          return true;
        }
      }
      return false;
    };

    const getPlaylistSongs = async (playlistId) => {
      const playlists = await getPlaylists();
      return playlists[playlistId] ? playlists[playlistId].songs || [] : [];
    };

    const getPlaylistInfo = async (playlistId) => {
      const playlists = await getPlaylists();
      return playlists[playlistId];
    };

    const updatePlaylist = async (playlistId, updates) => {
      const playlists = await getPlaylists();
      if (playlists[playlistId]) {
        playlists[playlistId] = { ...playlists[playlistId], ...updates };
        await savePlaylists(playlists);
        return true;
      }
      return false;
    };

    const deletePlaylist = async (playlistId) => {
      const playlists = await getPlaylists();
      if (playlists[playlistId]) {
        delete playlists[playlistId];
        await savePlaylists(playlists);
        return true;
      }
      return false;
    };

    // === ALBUMS FUNCTIONS ===
    const getAlbums = async () => {
      const now = Date.now();
      if (albumsCache && (now - dataCacheTimestamp < DATA_CACHE_DURATION)) {
        return albumsCache;
      }
      
      try {
        const albumsObj = await env.media.get("albums/index.json");
        if (!albumsObj) {
          albumsCache = {};
          dataCacheTimestamp = now;
          return {};
        }
        const text = await albumsObj.text();
        albumsCache = JSON.parse(text || "{}");
        dataCacheTimestamp = now;
        return albumsCache;
      } catch (e) {
        albumsCache = {};
        dataCacheTimestamp = now;
        return {};
      }
    };

    const saveAlbums = async (albums) => {
      await env.media.put("albums/index.json", JSON.stringify(albums));
      albumsCache = albums;
      dataCacheTimestamp = Date.now();
    };

    const addSongToAlbum = async (albumId, songKey) => {
      const albums = await getAlbums();
      if (albums[albumId]) {
        if (!albums[albumId].songs.includes(songKey)) {
          albums[albumId].songs.push(songKey);
          await saveAlbums(albums);
        }
      }
    };

    const getAlbumSongs = async (albumId) => {
      const albums = await getAlbums();
      return albums[albumId] ? albums[albumId].songs || [] : [];
    };

    // === ARTISTS FUNCTIONS ===
    const getArtists = async () => {
      const now = Date.now();
      if (artistsCache && (now - dataCacheTimestamp < DATA_CACHE_DURATION)) {
        return artistsCache;
      }
      
      try {
        const artistsObj = await env.media.get("artists/index.json");
        if (!artistsObj) {
          artistsCache = {};
          dataCacheTimestamp = now;
          return {};
        }
        const text = await artistsObj.text();
        artistsCache = JSON.parse(text || "{}");
        dataCacheTimestamp = now;
        return artistsCache;
      } catch (e) {
        artistsCache = {};
        dataCacheTimestamp = now;
        return {};
      }
    };

    const saveArtists = async (artists) => {
      await env.media.put("artists/index.json", JSON.stringify(artists));
      artistsCache = artists;
      dataCacheTimestamp = Date.now();
    };

    const addSongToArtist = async (artistId, songKey) => {
      const artists = await getArtists();
      if (artists[artistId]) {
        if (!artists[artistId].songs.includes(songKey)) {
          artists[artistId].songs.push(songKey);
          await saveArtists(artists);
        }
      }
    };

    const getArtistSongs = async (artistId) => {
      const artists = await getArtists();
      return artists[artistId] ? artists[artistId].songs || [] : [];
    };

    // === ALBUM-ARTIST ASSIGNMENT FUNCTIONS ===
    const addAlbumToArtist = async (artistId, albumId) => {
      const artists = await getArtists();
      if (artists[artistId]) {
        if (!artists[artistId].albums) {
          artists[artistId].albums = [];
        }
        if (!artists[artistId].albums.includes(albumId)) {
          artists[artistId].albums.push(albumId);
          await saveArtists(artists);
        }
      }
    };

    const removeAlbumFromArtist = async (artistId, albumId) => {
      const artists = await getArtists();
      if (artists[artistId] && artists[artistId].albums) {
        const index = artists[artistId].albums.indexOf(albumId);
        if (index !== -1) {
          artists[artistId].albums.splice(index, 1);
          await saveArtists(artists);
        }
      }
    };

    const getArtistAlbums = async (artistId) => {
      const artists = await getArtists();
      return artists[artistId] ? artists[artistId].albums || [] : [];
    };

    // =========================
    // CREATE PLAYLIST PAGE (GET)
    // =========================
    if (path === "/playlist/create" && req.method === "GET") {
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Create Playlist</title>
        <style>
          body { font-family: Arial,sans-serif; padding:50px; background:#f0f0f0; }
          form { display:flex; flex-direction:column; max-width:400px; margin:auto; }
          label { margin-top:10px; font-weight:bold; }
          input, textarea, select { padding:8px; margin-top:5px; }
          button { margin-top:20px; padding:10px; background:#28a745; color:#fff; border:none; cursor:pointer; border-radius:5px; }
          button:hover { background:#218838; }
          .back-link { margin-top:20px; }
        </style>
      </head>
      <body>
        <h1>Create New Playlist</h1>
        <form action="/playlist/create" method="POST" enctype="multipart/form-data">
          <label>Playlist Title</label>
          <input type="text" name="title" required>
          <label>Playlist Description</label>
          <textarea name="description" rows="3"></textarea>
          <label>Playlist Thumbnail (.jpg, .png) (Optional)</label>
          <input type="file" name="thumbnail" accept="image/*">
          <label>
            <input type="checkbox" name="isPublic" checked> Make playlist public
          </label>
          <button type="submit">Create Playlist</button>
        </form>
        <div class="back-link">
          <a href="/manage-playlists">← Manage Playlists</a> | 
          <a href="/">Home</a>
        </div>
      </body>
      </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // CREATE PLAYLIST HANDLER (POST)
    // =========================
    if (path === "/playlist/create" && req.method === "POST") {
      const formData = await req.formData();
      const title = formData.get("title");
      const description = formData.get("description");
      const thumbnailFile = formData.get("thumbnail");
      const isPublic = formData.get("isPublic") === "on";

      if (!title) {
        return new Response("Missing playlist title", { status: 400 });
      }

      const playlistId = sanitize(title) + "_" + Date.now();
      let thumbnailKey = "";
      
      if (thumbnailFile && thumbnailFile.size > 0) {
        const imgType = thumbnailFile.type.includes("png") ? "png" : "jpg";
        thumbnailKey = `playlists/thumbnails/${playlistId}.${imgType}`;
        await env.media.put(thumbnailKey, thumbnailFile.stream());
      }

      await createPlaylist(playlistId, title, description, thumbnailKey);
      
      // Update privacy status
      await updatePlaylist(playlistId, { isPublic });
      
      homepageCache = null;
      cacheTimestamp = 0;

      const html = `
        <h1>Playlist Created Successfully!</h1>
        <p>Playlist: ${title}</p>
        <p><a href="/manage-playlists">← Back to Manage Playlists</a></p>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // MANAGE PLAYLISTS PAGE (FIXED VERSION)
    // =========================
    if (path === "/manage-playlists" && req.method === "GET") {
      const playlists = await getPlaylists();
      const allSongs = await env.media.list({ prefix: "songs/" });
      
      // Get song details for display
      const songDetails = await Promise.all(
        allSongs.objects.map(async (songObj) => {
          const songKey = songObj.key.split("/")[1].replace(".mp3", "");
          const [artist, ...titleParts] = songKey.split("_");
          const title = titleParts.join(" ");
          
          let thumbUrl = "/images/placeholder.jpg";
          try {
            const jpgObj = await env.media.get(`images/${songKey}.jpg`);
            if (jpgObj) {
              thumbUrl = `/images/${encodeURIComponent(songKey)}.jpg`;
            } else {
              const pngObj = await env.media.get(`images/${songKey}.png`);
              if (pngObj) {
                thumbUrl = `/images/${encodeURIComponent(songKey)}.png`;
              }
            }
          } catch (e) {
            // Use placeholder if error
          }
          
          return {
            key: songKey,
            title: title,
            artist: artist,
            thumbnail: thumbUrl
          };
        })
      );
      
      // Generate playlist sections
      const playlistSections = Object.values(playlists).map(playlist => {
        // Sort songs by title for better organization
        const sortedSongs = [...songDetails].sort((a, b) => a.title.localeCompare(b.title));
        
        const songCheckboxes = sortedSongs.map(song => {
          const isChecked = playlist.songs.includes(song.key);
          return `
            <div class="song-checkbox" 
                 style="display:flex; align-items:center; margin:5px 0; padding:5px; background:#f8f9fa; border-radius:4px;"
                 data-playlist="${playlist.id}"
                 data-song="${song.key}">
              <input type="checkbox" 
                     id="song_${playlist.id}_${song.key}"
                     ${isChecked ? 'checked' : ''}
                     onchange="updateSongInPlaylist('${playlist.id}', '${song.key}', this.checked)"
                     style="margin-right:10px; cursor:pointer;">
              <img src="${song.thumbnail}" alt="${song.title}" 
                   style="width:40px; height:40px; object-fit:cover; border-radius:4px; margin-right:10px;">
              <div style="flex-grow:1;">
                <strong>${song.title}</strong><br>
                <small style="color:#666;">${song.artist}</small>
              </div>
              <div style="font-size:0.8em; color:#7f8c8d;">
                ${playlist.songs.includes(song.key) ? '✓ In playlist' : ''}
              </div>
            </div>
          `;
        }).join('');
        
        return `
          <div class="playlist-section" id="playlist-${playlist.id}" style="background:#fff; border:1px solid #ddd; border-radius:8px; padding:15px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
              <div>
                <h3 style="margin:0; display:inline-block;">${playlist.title}</h3>
                <span style="margin-left:10px; font-size:0.8em; color:${playlist.isPublic ? '#2ecc71' : '#e74c3c'};">
                  ${playlist.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <div>
                <button onclick="deletePlaylist('${playlist.id}')" 
                        style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-left:10px;">
                  Delete
                </button>
                <a href="/playlist/${playlist.id}" 
                   style="background:#3498db; color:white; padding:5px 10px; border-radius:4px; text-decoration:none; margin-left:10px;">
                  View
                </a>
              </div>
            </div>
            <div style="margin-bottom:10px;">
              <p><strong>${playlist.songs.length} songs</strong> • Created: ${new Date(playlist.created).toLocaleDateString()}</p>
              <div style="margin:10px 0;">
                <button onclick="selectAllSongs('${playlist.id}', true)" 
                        style="background:#95a5a6; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-right:5px; font-size:0.9em;">
                  Select All
                </button>
                <button onclick="selectAllSongs('${playlist.id}', false)" 
                        style="background:#95a5a6; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-right:5px; font-size:0.9em;">
                  Deselect All
                </button>
              </div>
            </div>
            <div style="margin:10px 0;">
              <input type="text" 
                     placeholder="Search songs..." 
                     oninput="filterSongs('${playlist.id}', this.value)"
                     style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;"
                     aria-label="Search songs in playlist">
            </div>
            <div class="song-list" style="max-height:400px; overflow-y:auto; border:1px solid #eee; padding:10px; margin-top:10px;">
              ${songCheckboxes}
            </div>
          </div>
        `;
      }).join('');
      
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Manage Playlists</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; 
            background:#f0f0f0; 
            padding:20px;
            margin:0;
          }
          .header { 
            text-align:center; 
            margin-bottom:30px; 
            padding:20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color:white;
            border-radius:12px;
          }
          .container { 
            max-width:1200px; 
            margin:0 auto; 
            padding:0 20px;
          }
          .create-btn { 
            display:inline-block; 
            background:#2ecc71; 
            color:white; 
            padding:12px 24px; 
            text-decoration:none; 
            border-radius:8px; 
            margin:10px; 
            border:none;
            cursor:pointer;
            font-weight:600;
            transition:all 0.3s ease;
            box-shadow:0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08);
          }
          .create-btn:hover { 
            background:#27ae60; 
            transform:translateY(-2px);
            box-shadow:0 7px 14px rgba(50, 50, 93, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08);
          }
          .controls { 
            text-align:center; 
            margin-bottom:30px; 
            padding:20px;
            background:white;
            border-radius:12px;
            box-shadow:0 2px 10px rgba(0,0,0,0.1);
          }
          .empty-state { 
            text-align:center; 
            padding:60px 40px; 
            background:#fff; 
            border-radius:12px;
            box-shadow:0 2px 10px rgba(0,0,0,0.1);
            margin:20px 0;
          }
          .empty-state h3 { color:#2c3e50; margin-bottom:15px; }
          .empty-state p { color:#7f8c8d; max-width:500px; margin:0 auto 25px; }
          .status-message {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .status-success {
            background: #2ecc71;
            opacity: 1;
            transform: translateY(0);
          }
          .status-error {
            background: #e74c3c;
            opacity: 1;
            transform: translateY(0);
          }
          .playlist-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-top: 20px;
          }
          @media (max-width: 768px) {
            .playlist-grid {
              grid-template-columns: 1fr;
            }
          }
          .song-checkbox:hover {
            background: #edf2f7;
            transform: translateX(5px);
            transition: all 0.2s ease;
          }
          input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }
        </style>
        <script>
          // Show status message
          function showStatus(message, isSuccess) {
            const statusDiv = document.getElementById('status-message');
            if (!statusDiv) {
              const div = document.createElement('div');
              div.id = 'status-message';
              div.className = 'status-message';
              document.body.appendChild(div);
            }
            
            const statusEl = document.getElementById('status-message');
            statusEl.textContent = message;
            statusEl.className = 'status-message ' + (isSuccess ? 'status-success' : 'status-error');
            
            // Hide after 3 seconds
            setTimeout(() => {
              statusEl.className = 'status-message';
            }, 3000);
          }
          
          // Update song in playlist
          async function updateSongInPlaylist(playlistId, songKey, add) {
            const endpoint = add ? '/playlist/add-song' : '/playlist/remove-song';
            const checkbox = document.getElementById('song_' + playlistId + '_' + songKey);
            
            // Disable checkbox while updating
            checkbox.disabled = true;
            
            try {
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                  playlistId: playlistId, 
                  songKey: songKey 
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                // Update the status text
                const songElement = checkbox.closest('.song-checkbox');
                const statusDiv = songElement.querySelector('div > div:nth-child(3)');
                if (statusDiv) {
                  statusDiv.textContent = add ? '✓ In playlist' : '';
                  statusDiv.style.color = add ? '#2ecc71' : '#7f8c8d';
                }
                
                // Update song count
                const playlistSection = document.getElementById('playlist-' + playlistId);
                const songCountElement = playlistSection.querySelector('p > strong');
                if (songCountElement) {
                  const currentText = songCountElement.textContent;
                  const currentCount = parseInt(currentText.match(/\d+/)[0]);
                  const newCount = add ? currentCount + 1 : currentCount - 1;
                  songCountElement.textContent = newCount + ' songs';
                }
                
                showStatus(result.message || (add ? 'Song added to playlist' : 'Song removed from playlist'), true);
              } else {
                // Revert checkbox if failed
                checkbox.checked = !add;
                showStatus('Error: ' + (result.error || 'Operation failed'), false);
              }
            } catch (error) {
              // Revert checkbox on network error
              checkbox.checked = !add;
              showStatus('Network error. Please try again.', false);
              console.error('Error:', error);
            } finally {
              // Re-enable checkbox
              checkbox.disabled = false;
            }
          }
          
          // Select all songs in a playlist
          async function selectAllSongs(playlistId, selectAll) {
            const checkboxes = document.querySelectorAll('#playlist-' + playlistId + ' input[type="checkbox"]');
            const updates = [];
            
            // Disable all checkboxes
            checkboxes.forEach(cb => cb.disabled = true);
            
            // Process each checkbox
            for (const checkbox of checkboxes) {
              const songKey = checkbox.id.replace('song_' + playlistId + '_', '');
              
              // Only update if state is changing
              if (checkbox.checked !== selectAll) {
                updates.push(updateSongInPlaylist(playlistId, songKey, selectAll));
              }
            }
            
            // Wait for all updates to complete
            try {
              await Promise.all(updates);
              showStatus(selectAll ? 'Added all songs successfully' : 'Removed all songs successfully', true);
            } catch (error) {
              showStatus('Some operations failed', false);
            }
            
            // Re-enable checkboxes
            setTimeout(() => {
              checkboxes.forEach(cb => cb.disabled = false);
            }, 1000);
          }
          
          // Delete playlist
          async function deletePlaylist(playlistId) {
            if (!confirm('Are you sure you want to delete the playlist "' + 
                        document.querySelector('#playlist-' + playlistId + ' h3').textContent + 
                        '"? This action cannot be undone.')) {
              return;
            }
            
            try {
              const response = await fetch('/playlist/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlistId: playlistId })
              });
              
              const result = await response.json();
              if (result.success) {
                showStatus('Playlist deleted successfully!', true);
                // Remove the playlist section from the page
                const playlistElement = document.getElementById('playlist-' + playlistId);
                if (playlistElement) {
                  playlistElement.style.opacity = '0.5';
                  playlistElement.style.transition = 'opacity 0.3s ease';
                  setTimeout(() => {
                    playlistElement.remove();
                    // Check if no playlists left
                    if (document.querySelectorAll('.playlist-section').length === 0) {
                      location.reload();
                    }
                  }, 300);
                }
              } else {
                showStatus('Error: ' + result.error, false);
              }
            } catch (error) {
              showStatus('Network error. Please try again.', false);
              console.error('Error:', error);
            }
          }
          
          // Create new playlist
          function createNewPlaylist() {
            window.location.href = '/playlist/create';
          }
          
          // Search/filter songs in playlist
          function filterSongs(playlistId, searchTerm) {
            const songElements = document.querySelectorAll('#playlist-' + playlistId + ' .song-checkbox');
            searchTerm = searchTerm.toLowerCase();
            
            songElements.forEach(element => {
              const title = element.querySelector('strong').textContent.toLowerCase();
              const artist = element.querySelector('small').textContent.toLowerCase();
              const matches = title.includes(searchTerm) || artist.includes(searchTerm);
              element.style.display = matches ? 'flex' : 'none';
            });
          }
        </script>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0 0 10px 0;">🎵 Manage Playlists</h1>
            <p style="margin:0; opacity:0.9; max-width:600px; margin:0 auto;">
              Add or remove songs from playlists. A song can appear in multiple playlists.
            </p>
          </div>
          
          <div class="controls">
            <button onclick="createNewPlaylist()" class="create-btn">+ Create New Playlist</button>
            <a href="/playlist" style="color:#3498db; text-decoration:none; margin-left:10px; font-weight:600;">View All Playlists</a>
            <a href="/" style="color:#7f8c8d; text-decoration:none; margin-left:10px;">← Back to Home</a>
          </div>
          
          ${Object.keys(playlists).length > 0 ? `
            <div style="margin-bottom:20px; padding:15px; background:white; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
              <h3 style="margin:0 0 10px 0; color:#2c3e50;">📊 Quick Stats</h3>
              <div style="display:flex; gap:20px; flex-wrap:wrap;">
                <div style="background:#f8f9fa; padding:10px 15px; border-radius:6px;">
                  <strong>${Object.keys(playlists).length}</strong> Playlists
                </div>
                <div style="background:#f8f9fa; padding:10px 15px; border-radius:6px;">
                  <strong>${songDetails.length}</strong> Total Songs
                </div>
                <div style="background:#f8f9fa; padding:10px 15px; border-radius:6px;">
                  <strong>${Object.values(playlists).reduce((sum, p) => sum + p.songs.length, 0)}</strong> Total Assignments
                </div>
              </div>
            </div>
            
            <div class="playlist-grid">
              ${playlistSections}
            </div>
            
            <div style="margin-top:30px; text-align:center; color:#666; font-size:0.9em; padding:20px; background:white; border-radius:8px;">
              <p><strong>💡 Tips:</strong></p>
              <ul style="list-style:none; padding:0; margin:10px 0;">
                <li>✓ Click checkboxes to add/remove songs from playlists</li>
                <li>✓ Use "Select All" / "Deselect All" for bulk operations</li>
                <li>✓ Search songs by title or artist within each playlist</li>
                <li>✓ A song can be in multiple playlists at the same time</li>
              </ul>
            </div>
          ` : `
            <div class="empty-state">
              <h3>🎶 No Playlists Yet</h3>
              <p>Playlists help you organize your music collection. Create your first playlist to get started!</p>
              <button onclick="createNewPlaylist()" class="create-btn">+ Create Your First Playlist</button>
              <p style="margin-top:20px; font-size:0.9em;">
                <a href="/playlist" style="color:#3498db;">View example playlists</a> or 
                <a href="/upload" style="color:#2ecc71;">upload some songs first</a>
              </p>
            </div>
          `}
        </div>
      </body>
      </html>
      `;
      return new Response(html, { 
        headers: { ...CORS_HEADERS, "Content-Type": "text/html" } 
      });
    }

    // =========================
    // PLAYLIST PAGE (View only, no management)
    // =========================
    if (path.startsWith("/playlist/") && !path.startsWith("/playlist/create") && path !== "/playlist/delete") {
      const playlistId = decodeURIComponent(path.replace("/playlist/", ""));
      
      if (playlistId === "") {
        // List all playlists
        const playlists = await getPlaylists();
        const playlistList = Object.values(playlists).sort((a, b) => b.created - a.created);
        
        const playlistCards = await Promise.all(playlistList.map(async playlist => {
          let thumbUrl = "/images/placeholder.jpg";
          if (playlist.thumbnail) {
            const thumbObj = await env.media.get(playlist.thumbnail);
            if (thumbObj) {
              const ext = playlist.thumbnail.split(".").pop();
              thumbUrl = `/playlists/thumbnails/${encodeURIComponent(playlist.id)}.${ext}`;
            }
          }
          
          return `
            <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin:10px; background:#fff; display:inline-block; width:200px; vertical-align:top; text-align:center;">
              <img src="${thumbUrl}" alt="${playlist.title}" style="width:150px; height:150px; object-fit:cover; border-radius:8px; margin-bottom:10px;">
              <h3 style="margin:10px 0 5px 0;"><a href="/playlist/${playlist.id}">${playlist.title}</a></h3>
              <p style="font-size:0.9em; color:#666; margin:0 0 5px 0;">${playlist.songs.length} songs</p>
              ${!playlist.isPublic ? '<span style="font-size:0.8em; color:#e74c3c;">Private</span>' : ''}
            </div>
          `;
        }));

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>All Playlists</title>
          <style>
            body { font-family: Arial,sans-serif; padding:20px; background:#f0f0f0; }
            .header { text-align:center; margin-bottom:30px; }
            .playlists-grid { text-align:center; }
            .create-btn { 
              display:inline-block; 
              background:#3498db; 
              color:white; 
              padding:10px 20px; 
              text-decoration:none; 
              border-radius:5px; 
              margin:10px; 
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>All Playlists</h1>
            <p>
              <a href="/">← Back to Home</a> | 
              <a href="/playlist/create" class="create-btn">Create New Playlist</a>
              <a href="/manage-playlists" style="color:#2ecc71; margin-left:10px;">Manage Playlists</a>
            </p>
          </div>
          <div class="playlists-grid">
            ${playlistCards.join("")}
          </div>
        </body>
        </html>
        `;
        return new Response(html, { 
          headers: { 
            "Content-Type": "text/html",
            "Cache-Control": "public, max-age=300"
          } 
        });
      }

      // Single playlist page (View only)
      const playlist = await getPlaylistInfo(playlistId);
      
      if (!playlist) {
        return new Response("Playlist not found", { status: 404 });
      }

      // Get playlist songs
      const songList = await Promise.all(playlist.songs.map(async songKey => {
        const audioObj = await env.media.get(`songs/${songKey}.mp3`);
        if (!audioObj) return null;

        const [artist, ...titleParts] = songKey.split("_");
        const title = titleParts.join(" ");

        let thumbUrl = "/images/placeholder.jpg";
        const jpgObj = await env.media.get(`images/${songKey}.jpg`);
        if (jpgObj) {
          thumbUrl = `/images/${encodeURIComponent(songKey)}.jpg`;
        } else {
          const pngObj = await env.media.get(`images/${songKey}.png`);
          if (pngObj) {
            thumbUrl = `/images/${encodeURIComponent(songKey)}.png`;
          }
        }

        return `
          <div class="song" style="display:flex;align-items:center;margin-bottom:10px; padding:10px; background:#fff; border-radius:8px;">
            <img src="${thumbUrl}" alt="${title}" style="width:60px;height:60px;object-fit:cover;margin-right:10px;border-radius:8px;">
            <div style="flex-grow:1;">
              <a href="/song/${encodeURIComponent(songKey + ".mp3")}" style="font-weight:bold;">${title}</a>
              <br>
              <small>${artist}</small>
            </div>
          </div>
        `;
      }));

      // Get playlist thumbnail
      let playlistThumb = "";
      if (playlist.thumbnail) {
        const thumbObj = await env.media.get(playlist.thumbnail);
        if (thumbObj) {
          const ext = playlist.thumbnail.split(".").pop();
          playlistThumb = `<img src="/playlists/thumbnails/${encodeURIComponent(playlist.id)}.${ext}" alt="${playlist.title}" style="max-width:300px;margin:10px 0;border-radius:8px;">`;
        }
      }

      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${playlist.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial,sans-serif; background:#f0f0f0; padding:20px; }
          .playlist-header { text-align:center; margin-bottom:30px; }
          .songs-list { max-width:600px; margin:0 auto; }
          img { max-width:100%; height:auto; border-radius:8px; }
          .manage-link { display:inline-block; background:#f39c12; color:white; padding:8px 15px; border-radius:4px; text-decoration:none; margin-top:10px; }
        </style>
      </head>
      <body>
        <div class="playlist-header">
          <h1>${playlist.title}</h1>
          ${playlistThumb}
          <p>${playlist.description}</p>
          <p><small>Status: ${playlist.isPublic ? 'Public' : 'Private'} | Created: ${new Date(playlist.created).toLocaleDateString()}</small></p>
          <p>
            <a href="/playlist">← All Playlists</a> | 
            <a href="/">Home</a> |
            <a href="/manage-playlists" class="manage-link">Manage Playlists</a>
          </p>
        </div>
        
        <div class="songs-list">
          <h2>Songs (${playlist.songs.length})</h2>
          ${songList.filter(s => s).join("")}
          ${playlist.songs.length === 0 ? '<p>No songs in this playlist yet.</p>' : ''}
        </div>
      </body>
      </html>
      `;
      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300"
        } 
      });
    }

    // =========================
    // PLAYLIST MANAGEMENT ENDPOINTS
    // =========================
    if (path === "/playlist/add-song" && req.method === "POST") {
      try {
        const data = await req.json();
        const { playlistId, songKey } = data;
        
        if (!playlistId || !songKey) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing playlistId or songKey" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
        
        const added = await addSongToPlaylist(playlistId, songKey);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: added ? "Song added to playlist" : "Song already in playlist"
        }), { 
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), { 
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
        });
      }
    }

    if (path === "/playlist/remove-song" && req.method === "POST") {
      try {
        const data = await req.json();
        const { playlistId, songKey } = data;
        
        if (!playlistId || !songKey) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing playlistId or songKey" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
        
        const removed = await removeSongFromPlaylist(playlistId, songKey);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: removed ? "Song removed from playlist" : "Song not in playlist"
        }), { 
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), { 
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
        });
      }
    }

    if (path === "/playlist/delete" && req.method === "POST") {
      try {
        const data = await req.json();
        const { playlistId } = data;
        
        if (!playlistId) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing playlistId" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
        
        const success = await deletePlaylist(playlistId);
        
        if (success) {
          return new Response(JSON.stringify({ 
            success: true,
            message: "Playlist deleted"
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        } else {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Playlist not found" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), { 
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
        });
      }
    }

    // =========================
    // UPLOAD PAGE (GET) - Updated with playlist option
    // =========================
    if (path === "/upload" && req.method === "GET") {
      const albums = await getAlbums();
      const albumOptions = Object.keys(albums).map(id => {
        const album = albums[id];
        return `<option value="${id}">${album.title}</option>`;
      }).join("");
      
      const artists = await getArtists();
      const artistOptions = Object.keys(artists).map(id => {
        const artist = artists[id];
        return `<option value="${id}">${artist.name}</option>`;
      }).join("");
      
      const playlists = await getPlaylists();
      const playlistOptions = Object.keys(playlists).map(id => {
        const playlist = playlists[id];
        return `<option value="${id}">${playlist.title}</option>`;
      }).join("");

      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Upload Song</title>
        <style>
          body { font-family: Arial,sans-serif; padding:50px; background:#f0f0f0; }
          form { display:flex; flex-direction:column; max-width:400px; margin:auto; }
          label { margin-top:10px; font-weight:bold; }
          input, textarea, select { padding:8px; margin-top:5px; }
          button { margin-top:20px; padding:10px; background:#28a745; color:#fff; border:none; cursor:pointer; border-radius:5px; }
          button:hover { background:#218838; }
          .playlist-section { margin-top:20px; background:#fff; padding:15px; border-radius:8px; }
          .playlist-checkboxes { max-height:150px; overflow-y:auto; border:1px solid #ddd; padding:10px; margin-top:5px; }
        </style>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const albumSelect = document.querySelector('select[name="album"]');
            if (albumSelect) {
              albumSelect.addEventListener('change', function() {
                if (this.value === '__create_new__') {
                  window.location.href = '/album/create';
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
      </head>
      <body>
        <h1>Upload Song</h1>
        <form action="/upload" method="POST" enctype="multipart/form-data">
          <label>Song Title</label>
          <input type="text" name="title" required>
          
          <label>Artist</label>
          <select name="artist" id="artistSelect" required style="padding:8px; margin-top:5px;">
            <option value="">-- Select Artist --</option>
            ${artistOptions}
            <option value="__create_new__">[Create New Artist]</option>
          </select>
          <p style="margin-top:5px; font-size:0.9em;">
            <a href="/artist/create" id="createArtistLink" style="color:#007bff; text-decoration:none; display:none;">Create New Artist</a>
            <span id="existingArtistNote" style="display:none;">Or select existing artist above</span>
          </p>
          <input type="text" name="artist_name" id="artistNameInput" placeholder="Enter new artist name" style="padding:8px; margin-top:5px; display:none;">
          
          <label>Description</label>
          <textarea name="description" rows="3" required></textarea>
          
          <label>Album (Optional)</label>
          <select name="album" style="padding:8px; margin-top:5px;">
            <option value="">-- Select Album --</option>
            ${albumOptions}
            <option value="__create_new__">[Create New Album]</option>
          </select>
          <p style="margin-top:5px; font-size:0.9em;">
            Or <a href="/album/create" style="color:#007bff; text-decoration:none;">create a new album</a>
          </p>
          
          <div class="playlist-section">
            <label>Add to Playlists (Optional)</label>
            <div class="playlist-checkboxes">
              ${playlistOptions ? playlistOptions.replace(/<option value="([^"]+)">([^<]+)<\/option>/g, 
                '<label style="display:block; margin:5px 0;"><input type="checkbox" name="playlists" value="$1"> $2</label>') : 
                '<p>No playlists created yet. <a href="/playlist/create">Create one</a></p>'}
            </div>
          </div>
          
          <label>Audio File (.mp3)</label>
          <input type="file" name="audio" accept=".mp3" required>
          <label>Thumbnail Image</label>
          <input type="file" name="image" accept="image/*" required>
          <button type="submit">Upload</button>
        </form>
      </body>
      </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // UPLOAD HANDLER (POST) - Updated to handle playlists
    // =========================
    if (path === "/upload" && req.method === "POST") {
      const formData = await req.formData();
      const title = formData.get("title");
      const artist = formData.get("artist");
      const description = formData.get("description");
      const audioFile = formData.get("audio");
      const imageFile = formData.get("image");
      const albumId = formData.get("album");
      const artistNameInput = formData.get("artist_name");
      const selectedPlaylists = formData.getAll("playlists");

      if (!title || !audioFile || !imageFile) {
        return new Response("Missing fields", { status: 400 });
      }

      let artistName = artist;
      let artistId = artist;
      
      if (artist === "__create_new__" && artistNameInput) {
        artistName = artistNameInput;
        artistId = sanitize(artistNameInput);
        
        const artists = await getArtists();
        
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
          await saveArtists(artists);
        }
      }

      const safeTitle = sanitize(title);
      const safeArtist = sanitize(artistName);
      const baseName = `${safeArtist}_${safeTitle}`;

      const audioKey = `songs/${baseName}.mp3`;
      const descKey = `descriptions/${baseName}.txt`;
      const imgType = imageFile.type.includes("png") ? "png" : "jpg";
      const imageKey = `images/${baseName}.${imgType}`;

      await env.media.put(audioKey, audioFile.stream());
      await env.media.put(imageKey, imageFile.stream());
      await env.media.put(descKey, description);

      // Add song to album if selected
      if (albumId && albumId !== "" && albumId !== "__create_new__") {
        await addSongToAlbum(albumId, baseName);
        await addAlbumToArtist(artistId, albumId);
      }
      
      // Add song to artist
      await addSongToArtist(artistId, baseName);
      
      // Add song to selected playlists
      for (const playlistId of selectedPlaylists) {
        await addSongToPlaylist(playlistId, baseName);
      }

      homepageCache = null;
      cacheTimestamp = 0;

      const html = `
        <h1>Upload Successful!</h1>
        <p><a href="/song/${encodeURIComponent(baseName + ".mp3")}">View Song Page</a></p>
        <p><a href="/">Back to Home</a></p>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // CREATE ALBUM PAGE (GET)
    // =========================
    if (path === "/album/create" && req.method === "GET") {
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Create Album</title>
        <style>
          body { font-family: Arial,sans-serif; padding:50px; background:#f0f0f0; }
          form { display:flex; flex-direction:column; max-width:400px; margin:auto; }
          label { margin-top:10px; font-weight:bold; }
          input, textarea { padding:8px; margin-top:5px; }
          button { margin-top:20px; padding:10px; background:#28a745; color:#fff; border:none; cursor:pointer; border-radius:5px; }
          button:hover { background:#218838; }
          .back-link { margin-top:20px; }
        </style>
      </head>
      <body>
        <h1>Create New Album</h1>
        <form action="/album/create" method="POST" enctype="multipart/form-data">
          <label>Album Title</label>
          <input type="text" name="title" required>
          <label>Album Description</label>
          <textarea name="description" rows="3" required></textarea>
          <label>Album Thumbnail (.jpg, .png)</label>
          <input type="file" name="thumbnail" accept="image/*" required>
          <button type="submit">Create Album</button>
        </form>
        <div class="back-link">
          <a href="/upload">← Back to Upload</a>
        </div>
      </body>
      </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // CREATE ALBUM HANDLER (POST) - UPDATED
    // =========================
    if (path === "/album/create" && req.method === "POST") {
      const formData = await req.formData();
      const title = formData.get("title");
      const description = formData.get("description");
      const thumbnailFile = formData.get("thumbnail");

      if (!title || !thumbnailFile) {
        return new Response("Missing fields", { status: 400 });
      }

      const albumId = sanitize(title) + "_" + Date.now();
      const albums = await getAlbums();

      const imgType = thumbnailFile.type.includes("png") ? "png" : "jpg";
      const thumbnailKey = `albums/thumbnails/${albumId}.${imgType}`;
      await env.media.put(thumbnailKey, thumbnailFile.stream());

      // Create album record with artists array
      albums[albumId] = {
        id: albumId,
        title: title,
        description: description || "",
        thumbnail: thumbnailKey,
        created: Date.now(),
        songs: [],
        artists: []
      };

      await saveAlbums(albums);
      
      homepageCache = null;
      cacheTimestamp = 0;

      const html = `
        <h1>Album Created Successfully!</h1>
        <p>Album: ${title}</p>
        <p><a href="/album/${albumId}">View Album Page</a></p>
        <p><a href="/upload">← Back to Upload</a></p>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // ALBUM PAGE
    // =========================
    if (path.startsWith("/album/") && !path.startsWith("/album/create")) {
      const albumId = decodeURIComponent(path.replace("/album/", ""));
      
      if (albumId === "") {
        const albums = await getAlbums();
        const albumList = Object.values(albums).sort((a, b) => b.created - a.created);
        
        const albumCards = await Promise.all(albumList.map(async album => {
          let thumbUrl = "/images/placeholder.jpg";
          const thumbObj = await env.media.get(album.thumbnail);
          if (thumbObj) {
            const ext = album.thumbnail.split(".").pop();
            thumbUrl = `/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}`;
          }
          
          return `
            <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin:10px; background:#fff; display:inline-block; width:200px; vertical-align:top;">
              <img src="${thumbUrl}" alt="${album.title}" style="width:100%; height:150px; object-fit:cover; border-radius:4px;">
              <h3 style="margin:10px 0 5px 0;"><a href="/album/${album.id}">${album.title}</a></h3>
              <p style="font-size:0.9em; color:#666; margin:0 0 10px 0;">${album.songs.length} songs</p>
            </div>
          `;
        }));

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>All Albums</title>
          <style>
            body { font-family: Arial,sans-serif; padding:20px; background:#f0f0f0; }
            .header { text-align:center; margin-bottom:30px; }
            .albums-grid { text-align:center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>All Albums</h1>
            <p><a href="/">← Back to Home</a> | <a href="/upload">Upload New Song</a></p>
          </div>
          <div class="albums-grid">
            ${albumCards.join("")}
          </div>
        </body>
        </html>
        `;
        return new Response(html, { 
          headers: { 
            "Content-Type": "text/html",
            "Cache-Control": "public, max-age=300"
          } 
        });
      }

      // Single album page
      const albums = await getAlbums();
      const album = albums[albumId];
      
      if (!album) {
        return new Response("Album not found", { status: 404 });
      }

      // Get album songs
      const songList = await Promise.all(album.songs.map(async songKey => {
        const audioObj = await env.media.get(`songs/${songKey}.mp3`);
        if (!audioObj) return null;

        const [artist, ...titleParts] = songKey.split("_");
        const title = titleParts.join(" ");

        let thumbUrl = "/images/placeholder.jpg";
        const jpgObj = await env.media.get(`images/${songKey}.jpg`);
        if (jpgObj) {
          thumbUrl = `/images/${encodeURIComponent(songKey)}.jpg`;
        } else {
          const pngObj = await env.media.get(`images/${songKey}.png`);
          if (pngObj) {
            thumbUrl = `/images/${encodeURIComponent(songKey)}.png`;
          }
        }

        return `
          <div class="song" style="display:flex;align-items:center;margin-bottom:10px; padding:10px; background:#fff; border-radius:8px;">
            <img src="${thumbUrl}" alt="${title}" style="width:60px;height:60px;object-fit:cover;margin-right:10px;border-radius:8px;">
            <div style="flex-grow:1;">
              <a href="/song/${encodeURIComponent(songKey + ".mp3")}" style="font-weight:bold;">${title}</a>
              <br>
              <small>${artist}</small>
            </div>
          </div>
        `;
      }));

      // Get album thumbnail
      let albumThumb = "";
      const thumbObj = await env.media.get(album.thumbnail);
      if (thumbObj) {
        const ext = album.thumbnail.split(".").pop();
        albumThumb = `<img src="/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}" alt="${album.title}" style="max-width:300px;margin:10px 0;border-radius:8px;">`;
      }

      // Get artists for this album
      const artists = await getArtists();
      const albumArtists = album.artists || [];
      const artistLinks = albumArtists.map(artistId => {
        const artist = artists[artistId];
        if (artist) {
          return `<a href="/artist/${artistId}" style="display:inline-block; margin:5px; padding:5px 10px; background:#3498db; color:white; border-radius:15px; text-decoration:none;">${artist.name}</a>`;
        }
        return '';
      }).filter(link => link).join('');

      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${album.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial,sans-serif; background:#f0f0f0; padding:20px; }
          .album-header { text-align:center; margin-bottom:30px; }
          .songs-list { max-width:600px; margin:0 auto; }
          img { max-width:100%; height:auto; border-radius:8px; }
          .artists-section { margin:20px 0; }
        </style>
      </head>
      <body>
        <div class="album-header">
          <h1>${album.title}</h1>
          ${albumThumb}
          <p>${album.description}</p>
          
          ${artistLinks ? `
            <div class="artists-section">
              <h3>Featured Artists:</h3>
              ${artistLinks}
            </div>
          ` : ''}
          
          <p>
            <a href="/album">← All Albums</a> | 
            <a href="/">Home</a> | 
            <a href="/upload">Upload</a>
          </p>
        </div>
        
        <div class="songs-list">
          <h2>Songs (${album.songs.length})</h2>
          ${songList.filter(s => s).join("")}
          ${album.songs.length === 0 ? '<p>No songs in this album yet.</p>' : ''}
        </div>
      </body>
      </html>
      `;
      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300"
        } 
      });
    }

    // =========================
    // CREATE ARTIST PAGE (GET)
    // =========================
    if (path === "/artist/create" && req.method === "GET") {
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Create Artist</title>
        <style>
          body { font-family: Arial,sans-serif; padding:50px; background:#f0f0f0; }
          form { display:flex; flex-direction:column; max-width:400px; margin:auto; }
          label { margin-top:10px; font-weight:bold; }
          input, textarea { padding:8px; margin-top:5px; }
          button { margin-top:20px; padding:10px; background:#28a745; color:#fff; border:none; cursor:pointer; border-radius:5px; }
          button:hover { background:#218838; }
          .back-link { margin-top:20px; }
        </style>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const storedName = sessionStorage.getItem('newArtistName');
            if (storedName) {
              document.getElementById('artistName').value = storedName;
              sessionStorage.removeItem('newArtistName');
            }
          });
        </script>
      </head>
      <body>
        <h1>Create New Artist</h1>
        <form action="/artist/create" method="POST" enctype="multipart/form-data">
          <label>Artist Name</label>
          <input type="text" name="name" id="artistName" required>
          <label>Artist Description</label>
          <textarea name="description" rows="3"></textarea>
          <label>Artist Thumbnail (.jpg, .png) (Optional)</label>
          <input type="file" name="thumbnail" accept="image/*">
          <button type="submit">Create Artist</button>
        </form>
        <div class="back-link">
          <a href="/upload">← Back to Upload</a>
        </div>
      </body>
      </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // CREATE ARTIST HANDLER (POST) - UPDATED
    // =========================
    if (path === "/artist/create" && req.method === "POST") {
      const formData = await req.formData();
      const name = formData.get("name");
      const description = formData.get("description");
      const thumbnailFile = formData.get("thumbnail");

      if (!name) {
        return new Response("Missing artist name", { status: 400 });
      }

      const artistId = sanitize(name);
      const artists = await getArtists();

      if (artists[artistId]) {
        const html = `
          <h1>Artist Already Exists</h1>
          <p>Artist "${name}" already exists.</p>
          <p><a href="/upload">← Back to Upload</a></p>
        `;
        return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
      }

      let thumbnailKey = "";
      if (thumbnailFile && thumbnailFile.size > 0) {
        const imgType = thumbnailFile.type.includes("png") ? "png" : "jpg";
        thumbnailKey = `artists/thumbnails/${artistId}.${imgType}`;
        await env.media.put(thumbnailKey, thumbnailFile.stream());
      }

      // Create artist record with albums array
      artists[artistId] = {
        id: artistId,
        name: name,
        description: description || "",
        thumbnail: thumbnailKey,
        created: Date.now(),
        songs: [],
        albums: []
      };

      await saveArtists(artists);
      
      homepageCache = null;
      cacheTimestamp = 0;

      const html = `
        <h1>Artist Created Successfully!</h1>
        <p>Artist: ${name}</p>
        <p><a href="/artist/${artistId}">View Artist Page</a></p>
        <p><a href="/upload">← Back to Upload</a></p>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // ARTISTS PAGE
    // =========================
    if (path.startsWith("/artist/") && !path.startsWith("/artist/create")) {
      const artistId = decodeURIComponent(path.replace("/artist/", ""));
      
      if (artistId === "") {
        // List all artists
        const artists = await getArtists();
        const artistList = Object.values(artists).sort((a, b) => b.created - a.created);
        
        const artistCards = await Promise.all(artistList.map(async artist => {
          let thumbUrl = "/images/placeholder.jpg";
          if (artist.thumbnail) {
            const thumbObj = await env.media.get(artist.thumbnail);
            if (thumbObj) {
              const ext = artist.thumbnail.split(".").pop();
              thumbUrl = `/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}`;
            }
          }
          
          const albumCount = artist.albums ? artist.albums.length : 0;
          
          return `
            <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin:10px; background:#fff; display:inline-block; width:200px; vertical-align:top; text-align:center;">
              <img src="${thumbUrl}" alt="${artist.name}" style="width:150px; height:150px; object-fit:cover; border-radius:50%; margin-bottom:10px;">
              <h3 style="margin:10px 0 5px 0;"><a href="/artist/${artist.id}">${artist.name}</a></h3>
              <p style="font-size:0.9em; color:#666; margin:0 0 5px 0;">
                ${artist.songs.length} songs<br>
                ${albumCount} albums
              </p>
            </div>
          `;
        }));

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>All Artists</title>
          <style>
            body { font-family: Arial,sans-serif; padding:20px; background:#f0f0f0; }
            .header { text-align:center; margin-bottom:30px; }
            .artists-grid { text-align:center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>All Artists</h1>
            <p><a href="/">← Back to Home</a> | <a href="/upload">Upload New Song</a> | <a href="/artist/create">Create New Artist</a></p>
          </div>
          <div class="artists-grid">
            ${artistCards.join("")}
          </div>
        </body>
        </html>
        `;
        return new Response(html, { 
          headers: { 
            "Content-Type": "text/html",
            "Cache-Control": "public, max-age=300"
          } 
        });
      }

      // Single artist page
      const artists = await getArtists();
      const artist = artists[artistId];
      
      if (!artist) {
        return new Response("Artist not found", { status: 404 });
      }

      // Get artist's albums
      const artistAlbums = artist.albums || [];
      
      // Get artist thumbnail
      let artistThumb = "";
      if (artist.thumbnail) {
        const thumbObj = await env.media.get(artist.thumbnail);
        if (thumbObj) {
          const ext = artist.thumbnail.split(".").pop();
          artistThumb = `<img src="/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}" alt="${artist.name}" style="width:200px; height:200px; object-fit:cover; border-radius:50%; margin:10px 0;">`;
        }
      }

      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${artist.name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial,sans-serif; background:#f0f0f0; padding:20px; }
          .artist-header { text-align:center; margin-bottom:30px; }
          img { max-width:100%; height:auto; border-radius:8px; }
        </style>
      </head>
      <body>
        <div class="artist-header">
          <h1>${artist.name}</h1>
          ${artistThumb}
          <p>${artist.description}</p>
          <p>
            <a href="/artist">← All Artists</a> | 
            <a href="/">Home</a> | 
            <a href="/upload">Upload</a>
          </p>
        </div>
      </body>
      </html>
      `;
      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300"
        } 
      });
    }

    // =========================
    // SONG PAGE - Updated to show playlists
    // =========================
    if (path.startsWith("/song/")) {
      const fileName = decodeURIComponent(path.replace("/song/",""));
      const baseName = fileName.replace(".mp3","");
      
      const audioObj = await env.media.get(`songs/${fileName}`);
      if (!audioObj) return new Response("Song not found", { status: 404 });

      const [artist, ...titleParts] = baseName.split("_");
      const title = titleParts.join(" ");

      let description = "";
      const descObj = await env.media.get(`descriptions/${baseName}.txt`);
      if (descObj) description = await descObj.text();

      let imgTag = "";
      const jpgObj = await env.media.get(`images/${baseName}.jpg`);
      if (jpgObj) {
        imgTag = `<img src="/images/${encodeURIComponent(baseName)}.jpg" alt="${title}" style="max-width:300px;margin:10px 0;">`;
      } else {
        const pngObj = await env.media.get(`images/${baseName}.png`);
        if (pngObj) {
          imgTag = `<img src="/images/${encodeURIComponent(baseName)}.png" alt="${title}" style="max-width:300px;margin:10px 0;">`;
        }
      }

      // Get all playlists this song is in
      const allPlaylists = await getPlaylists();
      const songPlaylists = [];
      for (const playlistId in allPlaylists) {
        if (allPlaylists[playlistId].songs.includes(baseName)) {
          songPlaylists.push({
            id: playlistId,
            title: allPlaylists[playlistId].title
          });
        }
      }

      const playlistsSection = songPlaylists.length > 0 ? `
        <div style="margin-top:20px; padding:15px; background:#fff; border-radius:8px;">
          <h3>Playlists containing this song:</h3>
          <ul>
            ${songPlaylists.map(p => `<li><a href="/playlist/${p.id}">${p.title}</a></li>`).join('')}
          </ul>
          <p><a href="/manage-playlists" style="font-size:0.9em; color:#3498db;">Manage playlists →</a></p>
        </div>
      ` : '';

      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${title} - ${artist}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial,sans-serif; background:#f0f0f0; text-align:center; padding:20px; }
          img { max-width:100%; height:auto; border-radius:8px; margin:10px 0; }
          audio { width:100%; max-width:400px; margin-top:10px; }
          .song-info { max-width:600px; margin:0 auto; text-align:left; background:#fff; padding:20px; border-radius:8px; }
          .playlists { margin-top:20px; }
        </style>
      </head>
      <body>
        <div class="song-info">
          <h1>${title}</h1>
          <h2>by ${artist}</h2>
          ${imgTag}
          <p>${description}</p>
          <audio controls src="/songs/${encodeURIComponent(fileName)}"></audio>
          ${playlistsSection}
          <p style="margin-top:20px;">
            <a href="/download/${encodeURIComponent(fileName)}">Download</a> | 
            <a href="/">Back to Home</a>
          </p>
        </div>
      </body>
      </html>
      `;
      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300"
        } 
      });
    }

    // =========================
    // HOMEPAGE - Updated to include playlists
    // =========================
    if (path === "/") {
      const now = Date.now();
      if (homepageCache && (now - cacheTimestamp < CACHE_DURATION)) {
        return new Response(homepageCache, { 
          headers: { 
            "Content-Type": "text/html",
            "Cache-Control": "public, max-age=300"
          } 
        });
      }

      const file = await env.media.get("index.html");
      if (!file) return new Response("index.html not found", { status: 500 });

      let html = await file.text();

      // Latest songs
      const list = await env.media.list({ prefix: "songs/", limit: 50 });
      const files = list.objects || [];
      files.sort((a,b) => b.uploaded - a.uploaded);
      const latest = files.slice(0,10);

      const fmHtml = await Promise.all(latest.map(async f => {
        const fileName = f.key.split("/")[1];
        const baseName = fileName.replace(".mp3","");
        const [artist, ...titleParts] = baseName.split("_");
        const title = titleParts.join(" ");

        let thumbUrl = "/images/placeholder.jpg";
        try {
          const jpgObj = await env.media.get(`images/${baseName}.jpg`);
          if (jpgObj) {
            thumbUrl = `/images/${encodeURIComponent(baseName)}.jpg`;
          } else {
            const pngObj = await env.media.get(`images/${baseName}.png`);
            if (pngObj) {
              thumbUrl = `/images/${encodeURIComponent(baseName)}.png`;
            }
          }
        } catch (e) {}

        return `<div class="song" style="display:flex;align-items:center;margin-bottom:10px;">
          <img src="${thumbUrl}" alt="${title}" style="width:80px;height:auto;margin-right:10px;border-radius:8px;">
          <a href="/song/${encodeURIComponent(fileName)}">${title}<br><small>${artist}</small></a>
        </div>`;
      }));

      html = html.replace(/\[fm\].*?\[\/fm\]/gs, fmHtml.join(""));

      // Latest albums
      const albums = await getAlbums();
      const albumList = Object.values(albums).sort((a, b) => b.created - a.created).slice(0, 6);
      
      const albumsHtml = await Promise.all(albumList.map(async album => {
        let thumbUrl = "/images/placeholder.jpg";
        if (album.thumbnail) {
          try {
            const thumbObj = await env.media.get(album.thumbnail);
            if (thumbObj) {
              const ext = album.thumbnail.split(".").pop();
              thumbUrl = `/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}`;
            }
          } catch (e) {}
        }
        
        return `
          <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin:10px; background:#fff; display:inline-block; width:180px; vertical-align:top; text-align:center;">
            <img src="${thumbUrl}" alt="${album.title}" style="width:100%; height:120px; object-fit:cover; border-radius:4px; margin-bottom:10px;">
            <h3 style="margin:0 0 5px 0; font-size:1rem;"><a href="/album/${album.id}" style="text-decoration:none; color:#333;">${album.title}</a></h3>
            <p style="font-size:0.8em; color:#666; margin:0 0 5px 0;">${album.songs.length} songs</p>
            <a href="/album/${album.id}" style="font-size:0.8em; color:#007bff; text-decoration:none;">View Album →</a>
          </div>
        `;
      }));

      if (albumList.length > 0) {
        const albumsSection = `
          <div style="margin-top:40px;">
            <div class="section-title">Latest Albums</div>
            <div style="text-align:center; margin-top:15px;">
              ${albumsHtml.join("")}
            </div>
            ${albumList.length >= 6 ? `<p style="text-align:center; margin-top:15px;"><a href="/album" style="color:#007bff; text-decoration:none;">View All Albums →</a></p>` : ''}
          </div>
        `;
        html = html.replace('</section>', `</section>${albumsSection}`);
      }

      // Latest artists
      const artists = await getArtists();
      const artistList = Object.values(artists).sort((a, b) => b.created - a.created).slice(0, 6);
      
      const artistsHtml = await Promise.all(artistList.map(async artist => {
        let thumbUrl = "/images/placeholder.jpg";
        if (artist.thumbnail) {
          try {
            const thumbObj = await env.media.get(artist.thumbnail);
            if (thumbObj) {
              const ext = artist.thumbnail.split(".").pop();
              thumbUrl = `/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}`;
            }
          } catch (e) {}
        }
        
        const albumCount = artist.albums ? artist.albums.length : 0;
        
        return `
          <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin:10px; background:#fff; display:inline-block; width:180px; vertical-align:top; text-align:center;">
            <img src="${thumbUrl}" alt="${artist.name}" style="width:150px; height:150px; object-fit:cover; border-radius:50%; margin-bottom:10px;">
            <h3 style="margin:0 0 5px 0; font-size:1rem;"><a href="/artist/${artist.id}" style="text-decoration:none; color:#333;">${artist.name}</a></h3>
            <p style="font-size:0.8em; color:#666; margin:0 0 5px 0;">
              ${artist.songs.length} songs<br>
              ${albumCount} albums
            </p>
            <a href="/artist/${artist.id}" style="font-size:0.8em; color:#007bff; text-decoration:none;">View Artist →</a>
          </div>
        `;
      }));

      if (artistList.length > 0) {
        const artistsSection = `
          <div style="margin-top:40px;">
            <div class="section-title">Featured Artists</div>
            <div style="text-align:center; margin-top:15px;">
              ${artistsHtml.join("")}
            </div>
            ${artistList.length >= 6 ? `<p style="text-align:center; margin-top:15px;"><a href="/artist" style="color:#007bff; text-decoration:none;">View All Artists →</a></p>` : ''}
          </div>
        `;
        html = html.replace('</section>', `</section>${artistsSection}`);
      }

      // Latest playlists
      const playlists = await getPlaylists();
      const playlistList = Object.values(playlists).sort((a, b) => b.created - a.created).slice(0, 6);
      
      const playlistsHtml = await Promise.all(playlistList.map(async playlist => {
        let thumbUrl = "/images/placeholder.jpg";
        if (playlist.thumbnail) {
          try {
            const thumbObj = await env.media.get(playlist.thumbnail);
            if (thumbObj) {
              const ext = playlist.thumbnail.split(".").pop();
              thumbUrl = `/playlists/thumbnails/${encodeURIComponent(playlist.id)}.${ext}`;
            }
          } catch (e) {}
        }
        
        return `
          <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin:10px; background:#fff; display:inline-block; width:180px; vertical-align:top; text-align:center;">
            <img src="${thumbUrl}" alt="${playlist.title}" style="width:150px; height:150px; object-fit:cover; border-radius:8px; margin-bottom:10px;">
            <h3 style="margin:0 0 5px 0; font-size:1rem;"><a href="/playlist/${playlist.id}" style="text-decoration:none; color:#333;">${playlist.title}</a></h3>
            <p style="font-size:0.8em; color:#666; margin:0 0 5px 0;">${playlist.songs.length} songs</p>
            ${!playlist.isPublic ? '<span style="font-size:0.7em; color:#e74c3c; background:#ffeaa7; padding:2px 5px; border-radius:3px;">Private</span>' : ''}
            <a href="/playlist/${playlist.id}" style="font-size:0.8em; color:#007bff; text-decoration:none; display:block; margin-top:5px;">View Playlist →</a>
          </div>
        `;
      }));

      if (playlistList.length > 0) {
        const playlistsSection = `
          <div style="margin-top:40px;">
            <div class="section-title">Featured Playlists</div>
            <div style="text-align:center; margin-top:15px;">
              ${playlistsHtml.join("")}
            </div>
            ${playlistList.length >= 6 ? `
              <p style="text-align:center; margin-top:15px;">
                <a href="/playlist" style="color:#007bff; text-decoration:none;">View All Playlists →</a> | 
                <a href="/playlist/create" style="color:#2ecc71; text-decoration:none;">Create New Playlist</a> |
                <a href="/manage-playlists" style="color:#f39c12; text-decoration:none;">Manage Playlists</a>
              </p>
            ` : ''}
          </div>
        `;
        html = html.replace('</section>', `</section>${playlistsSection}`);
      }

      homepageCache = html;
      cacheTimestamp = now;

      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300"
        } 
      });
    }

    // =========================
    // DOWNLOAD PAGE
    // =========================
    if (path.startsWith("/download/")) {
      const fileName = decodeURIComponent(path.replace("/download/",""));
      const html = `
        <h1>Download ${fileName}</h1>
        <a href="/songs/${encodeURIComponent(fileName)}" download>Click to Download</a>
        <p><a href="/">Back to Home</a></p>
      `;
      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300"
        } 
      });
    }

    // =========================
    // FILE SERVING
    // =========================
    if (path.startsWith("/songs/") || path.startsWith("/images/")) {
      const fileName = decodeURIComponent(path.slice(1));
      const obj = await env.media.get(fileName);
      if (!obj) return new Response("File not found", { status: 404 });

      let contentType = "application/octet-stream";
      let cacheControl = "public, max-age=300";
      
      if (fileName.endsWith(".mp3")) {
        contentType = "audio/mpeg";
        cacheControl = "public, max-age=604800";
      } else if (fileName.endsWith(".jpg")) {
        contentType = "image/jpeg";
        cacheControl = "public, max-age=604800";
      } else if (fileName.endsWith(".png")) {
        contentType = "image/png";
        cacheControl = "public, max-age=604800";
      }

      return new Response(obj.body, { 
        headers: { 
          "Content-Type": contentType,
          "Cache-Control": cacheControl
        } 
      });
    }

    if (path.startsWith("/albums/thumbnails/")) {
      const fileName = decodeURIComponent(path.slice(1));
      const obj = await env.media.get(fileName);
      if (!obj) return new Response("Album thumbnail not found", { status: 404 });

      let contentType = "application/octet-stream";
      if (fileName.endsWith(".jpg")) contentType = "image/jpeg";
      else if (fileName.endsWith(".png")) contentType = "image/png";

      return new Response(obj.body, { 
        headers: { 
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=604800"
        } 
      });
    }

    if (path.startsWith("/artists/thumbnails/")) {
      const fileName = decodeURIComponent(path.slice(1));
      const obj = await env.media.get(fileName);
      if (!obj) return new Response("Artist thumbnail not found", { status: 404 });

      let contentType = "application/octet-stream";
      if (fileName.endsWith(".jpg")) contentType = "image/jpeg";
      else if (fileName.endsWith(".png")) contentType = "image/png";

      return new Response(obj.body, { 
        headers: { 
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=604800"
        } 
      });
    }

    if (path.startsWith("/playlists/thumbnails/")) {
      const fileName = decodeURIComponent(path.slice(1));
      const obj = await env.media.get(fileName);
      if (!obj) return new Response("Playlist thumbnail not found", { status: 404 });

      let contentType = "application/octet-stream";
      if (fileName.endsWith(".jpg")) contentType = "image/jpeg";
      else if (fileName.endsWith(".png")) contentType = "image/png";

      return new Response(obj.body, { 
        headers: { 
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=604800"
        } 
      });
    }

    // =========================
    // ALBUM-ARTIST ASSIGNMENT ENDPOINT
    // =========================
    if (path === "/assign-album-to-artist" && req.method === "POST") {
      try {
        const data = await req.json();
        const { albumId, artistId, assign } = data;
        
        if (!albumId || !artistId) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing albumId or artistId" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
        
        if (assign) {
          await addAlbumToArtist(artistId, albumId);
        } else {
          await removeAlbumFromArtist(artistId, albumId);
        }
        
        return new Response(JSON.stringify({ 
          success: true,
          message: assign ? "Album assigned to artist" : "Album removed from artist"
        }), { 
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), { 
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
        });
      }
    }

    // =========================
    // SIMPLE ALBUM MANAGEMENT PAGE
    // =========================
    if (path === "/manage-album-artists" && req.method === "GET") {
      const albums = await getAlbums();
      const artists = await getArtists();
      
      const albumOptions = Object.keys(albums).map(id => {
        const album = albums[id];
        return `<option value="${id}">${album.title}</option>`;
      }).join("");
      
      const artistOptions = Object.keys(artists).map(id => {
        const artist = artists[id];
        return `<option value="${id}">${artist.name}</option>`;
      }).join("");
      
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Assign Albums to Artists</title>
        <style>
          body { font-family: Arial,sans-serif; padding:20px; background:#f0f0f0; }
          .container { max-width:600px; margin:0 auto; background:#fff; padding:20px; border-radius:8px; }
          h1 { color:#333; }
          .form-group { margin-bottom:15px; }
          label { display:block; margin-bottom:5px; font-weight:bold; }
          select, button { width:100%; padding:10px; margin-bottom:10px; }
          button { background:#3498db; color:white; border:none; border-radius:4px; cursor:pointer; }
          button:hover { background:#2980b9; }
          .back-link { margin-top:20px; }
          .current-assignments { margin-top:30px; padding:15px; background:#f8f9fa; border-radius:8px; }
          .assignment-item { padding:5px 0; border-bottom:1px solid #eee; }
        </style>
        <script>
          async function assignAlbumToArtist() {
            const albumId = document.getElementById('albumSelect').value;
            const artistId = document.getElementById('artistSelect').value;
            
            if (!albumId || !artistId) {
              alert('Please select both album and artist');
              return;
            }
            
            const response = await fetch('/assign-album-to-artist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ albumId, artistId, assign: true })
            });
            
            const result = await response.json();
            
            if (result.success) {
              alert('Album assigned to artist successfully!');
              location.reload();
            } else {
              alert('Error: ' + result.error);
            }
          }
        </script>
      </head>
      <body>
        <div class="container">
          <h1>Assign Albums to Artists</h1>
          
          <div class="form-group">
            <label for="albumSelect">Select Album:</label>
            <select id="albumSelect">
              <option value="">-- Choose an Album --</option>
              ${albumOptions}
            </select>
          </div>
          
          <div class="form-group">
            <label for="artistSelect">Select Artist:</label>
            <select id="artistSelect">
              <option value="">-- Choose an Artist --</option>
              ${artistOptions}
            </select>
          </div>
          
          <button onclick="assignAlbumToArtist()">Assign Album to Artist</button>
          
          <div class="back-link">
            <a href="/">← Back to Home</a> | 
            <a href="/album">View Albums</a> | 
            <a href="/artist">View Artists</a>
          </div>
          
          <div class="current-assignments">
            <h3>Current Album-Artist Assignments</h3>
            <p><em>Note: Albums are automatically assigned when songs are uploaded to albums.</em></p>
            <p>To manually assign albums:</p>
            <ol>
              <li>Upload a song and select an album</li>
              <li>Or use the form above</li>
            </ol>
          </div>
        </div>
      </body>
      </html>
      `;
      
      return new Response(html, { 
        headers: { ...CORS_HEADERS, "Content-Type": "text/html" } 
      });
    }

    return new Response("Not found", { status: 404 });
  }
};