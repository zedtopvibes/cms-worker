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
        songs: [], // Array of song keys
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
        }
      }
    };

    const removeSongFromPlaylist = async (playlistId, songKey) => {
      const playlists = await getPlaylists();
      if (playlists[playlistId]) {
        const index = playlists[playlistId].songs.indexOf(songKey);
        if (index !== -1) {
          playlists[playlistId].songs.splice(index, 1);
          await savePlaylists(playlists);
        }
      }
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
    // MANAGE PLAYLISTS PAGE
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
          const jpgObj = await env.media.get(`images/${songKey}.jpg`);
          if (jpgObj) {
            thumbUrl = `/images/${encodeURIComponent(songKey)}.jpg`;
          } else {
            const pngObj = await env.media.get(`images/${songKey}.png`);
            if (pngObj) {
              thumbUrl = `/images/${encodeURIComponent(songKey)}.png`;
            }
          }
          
          return {
            key: songKey,
            title: title,
            artist: artist,
            thumbnail: thumbUrl
          };
        })
      );
      
      // Get playlist details
      const playlistDetails = Object.values(playlists).map(playlist => ({
        id: playlist.id,
        title: playlist.title,
        songCount: playlist.songs.length,
        isPublic: playlist.isPublic
      }));
      
      // Generate song checkboxes for each playlist
      const playlistSections = Object.values(playlists).map(playlist => {
        const songCheckboxes = songDetails.map(song => {
          const isChecked = playlist.songs.includes(song.key);
          return `
            <div class="song-checkbox" style="display:flex; align-items:center; margin:5px 0; padding:5px; background:#f8f9fa; border-radius:4px;">
              <input type="checkbox" 
                     name="songs" 
                     value="${song.key}" 
                     ${isChecked ? 'checked' : ''}
                     onchange="updatePlaylistSong('${playlist.id}', '${song.key}', this.checked)"
                     style="margin-right:10px;">
              <img src="${song.thumbnail}" alt="${song.title}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; margin-right:10px;">
              <div>
                <strong>${song.title}</strong><br>
                <small style="color:#666;">${song.artist}</small>
              </div>
            </div>
          `;
        }).join('');
        
        return `
          <div class="playlist-section" style="background:#fff; border:1px solid #ddd; border-radius:8px; padding:15px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
              <h3 style="margin:0;">${playlist.title}</h3>
              <div>
                <button onclick="deletePlaylist('${playlist.id}')" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-left:10px;">Delete</button>
                <a href="/playlist/${playlist.id}" style="background:#3498db; color:white; padding:5px 10px; border-radius:4px; text-decoration:none; margin-left:10px;">View</a>
              </div>
            </div>
            <p><strong>${playlist.songs.length} songs</strong> | Status: ${playlist.isPublic ? 'Public' : 'Private'}</p>
            <div class="song-list" style="max-height:300px; overflow-y:auto; border:1px solid #eee; padding:10px; margin-top:10px;">
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
          body { font-family: Arial,sans-serif; background:#f0f0f0; padding:20px; }
          .header { text-align:center; margin-bottom:30px; }
          .container { max-width:1000px; margin:0 auto; }
          .create-btn { 
            display:inline-block; 
            background:#2ecc71; 
            color:white; 
            padding:10px 20px; 
            text-decoration:none; 
            border-radius:5px; 
            margin:10px; 
            border:none;
            cursor:pointer;
          }
          .controls { text-align:center; margin-bottom:20px; }
          .empty-state { text-align:center; padding:40px; background:#fff; border-radius:8px; }
        </style>
        <script>
          async function updatePlaylistSong(playlistId, songKey, add) {
            const endpoint = add ? '/playlist/add-song' : '/playlist/remove-song';
            
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                playlistId: playlistId, 
                songKey: songKey 
              })
            });
            
            const result = await response.json();
            if (!result.success) {
              alert('Error: ' + result.error);
              // Revert checkbox state
              const checkbox = document.querySelector(\`input[value="\${songKey}"][onchange*="\${playlistId}"]\`);
              if (checkbox) {
                checkbox.checked = !add;
              }
            }
          }
          
          async function deletePlaylist(playlistId) {
            if (!confirm('Are you sure you want to delete this playlist? This action cannot be undone.')) {
              return;
            }
            
            const response = await fetch('/playlist/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playlistId: playlistId })
            });
            
            const result = await response.json();
            if (result.success) {
              alert('Playlist deleted successfully!');
              location.reload();
            } else {
              alert('Error: ' + result.error);
            }
          }
          
          function createNewPlaylist() {
            window.location.href = '/playlist/create';
          }
          
          function toggleAllSongs(playlistId, checkAll) {
            const checkboxes = document.querySelectorAll(\`.playlist-section h3:contains("\${playlistId}") + .song-list input[type="checkbox"]\`);
            checkboxes.forEach(checkbox => {
              checkbox.checked = checkAll;
              updatePlaylistSong(playlistId, checkbox.value, checkAll);
            });
          }
        </script>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Manage Playlists</h1>
            <p>Add or remove songs from playlists. A song can appear in multiple playlists.</p>
            <div class="controls">
              <button onclick="createNewPlaylist()" class="create-btn">Create New Playlist</button>
              <a href="/playlist" style="color:#3498db; text-decoration:none; margin-left:10px;">View All Playlists</a>
              <a href="/" style="color:#7f8c8d; text-decoration:none; margin-left:10px;">← Home</a>
            </div>
          </div>
          
          ${playlistSections || `
            <div class="empty-state">
              <h3>No Playlists Yet</h3>
              <p>Create your first playlist to get started!</p>
              <button onclick="createNewPlaylist()" class="create-btn">Create Playlist</button>
            </div>
          `}
          
          <div style="margin-top:30px; text-align:center; color:#666; font-size:0.9em;">
            <p><strong>Tip:</strong> Check multiple boxes to add songs to playlists. Uncheck to remove.</p>
          </div>
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
        
        await addSongToPlaylist(playlistId, songKey);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: "Song added to playlist"
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
        
        await removeSongFromPlaylist(playlistId, songKey);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: "Song removed from playlist"
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
    // ADDITIONAL FILE SERVING FOR PLAYLISTS
    // =========================
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
    // REST OF THE EXISTING CODE
    // =========================
    // [Include all the existing routes for albums, artists, etc. here]
    // This includes: /album/create, /artist/create, /album/, /artist/, 
    // /assign-album-to-artist, /manage-album-artists, and file serving routes

    // Note: Add all your existing code from the original file below this point
    // Make sure to keep all the existing routes for albums, artists, etc.

    return new Response("Not found", { status: 404 });
  }
};