
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
    let dataCacheTimestamp = 0;
    const DATA_CACHE_DURATION = 60000;

    // --- Playlists cache ---
    let playlistsCache = null;
    let playlistsCacheTimestamp = 0;
    const PLAYLISTS_CACHE_DURATION = 60000;

    // -----------------------------
    // Helper to sanitize filenames
    // -----------------------------
    const sanitize = str => str.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");

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

    const addArtistToAlbum = async (artistId, albumId) => {
      const albums = await getAlbums();
      const album = albums[albumId];
      if (album) {
        if (!album.artists) album.artists = [];
        if (!album.artists.includes(artistId)) {
          album.artists.push(artistId);
          await saveAlbums(albums);
        }
      }
    };

    const removeArtistFromAlbum = async (artistId, albumId) => {
      const albums = await getAlbums();
      const album = albums[albumId];
      if (album && album.artists) {
        const index = album.artists.indexOf(artistId);
        if (index !== -1) {
          album.artists.splice(index, 1);
          await saveAlbums(albums);
        }
      }
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

    const getArtistAlbumsAndSingles = async (artistId) => {
      const artists = await getArtists();
      const albums = await getAlbums();
      const artist = artists[artistId];
      
      if (!artist) {
        return { albums: [], singles: [], totalSongs: 0, totalAlbums: 0, totalSingles: 0 };
      }
      
      const assignedAlbums = artist.albums || [];
      const artistAlbums = [];
      const albumSongIds = new Set();
      let totalSongsInAlbums = 0;
      
      for (const albumId of assignedAlbums) {
        const album = albums[albumId];
        if (album) {
          const albumSongsByArtist = [];
          
          for (const songKey of album.songs) {
            const [songArtistId] = songKey.split("_");
            if (songArtistId === artistId) {
              albumSongsByArtist.push(songKey);
              albumSongIds.add(songKey);
            }
          }
          
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
          
          const artistSongCount = albumSongsByArtist.length;
          totalSongsInAlbums += artistSongCount;
          
          artistAlbums.push({
            id: albumId,
            title: album.title,
            description: album.description,
            thumbnail: thumbUrl,
            songCount: album.songs.length,
            artistSongCount: artistSongCount,
            songs: albumSongsByArtist,
            created: album.created,
            explicitlyAssigned: true
          });
        }
      }
      
      for (const albumId in albums) {
        if (assignedAlbums.includes(albumId)) continue;
        
        const album = albums[albumId];
        const albumSongsByArtist = [];
        
        for (const songKey of album.songs) {
          const [songArtistId] = songKey.split("_");
          if (songArtistId === artistId) {
            albumSongsByArtist.push(songKey);
            albumSongIds.add(songKey);
          }
        }
        
        if (albumSongsByArtist.length > 0) {
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
          
          const artistSongCount = albumSongsByArtist.length;
          totalSongsInAlbums += artistSongCount;
          
          artistAlbums.push({
            id: albumId,
            title: album.title,
            description: album.description,
            thumbnail: thumbUrl,
            songCount: album.songs.length,
            artistSongCount: artistSongCount,
            songs: albumSongsByArtist,
            created: album.created,
            explicitlyAssigned: false
          });
        }
      }
      
      artistAlbums.sort((a, b) => b.created - a.created);
      
      const singles = [];
      for (const songKey of artist.songs) {
        if (!albumSongIds.has(songKey)) {
          singles.push(songKey);
        }
      }
      
      const sortedSingles = await Promise.all(singles.map(async songKey => {
        try {
          const audioObj = await env.media.get(`songs/${songKey}.mp3`);
          const uploaded = audioObj ? audioObj.uploaded : Date.now();
          return { key: songKey, uploaded };
        } catch (e) {
          return { key: songKey, uploaded: Date.now() };
        }
      }));
      
      sortedSingles.sort((a, b) => b.uploaded - a.uploaded);
      const singleKeys = sortedSingles.map(s => s.key);
      
      const totalSingles = singleKeys.length;
      const totalSongs = totalSingles + totalSongsInAlbums;
      
      return {
        albums: artistAlbums,
        singles: singleKeys,
        totalSongs,
        totalSongsInAlbums,
        totalSingles,
        totalAlbums: artistAlbums.length,
        assignedAlbumsCount: assignedAlbums.length
      };
    };

    // === PLAYLIST FUNCTIONS ===
    const getPlaylists = async () => {
      const now = Date.now();
      if (playlistsCache && (now - playlistsCacheTimestamp < PLAYLISTS_CACHE_DURATION)) {
        return playlistsCache;
      }
      try {
        const playlistsObj = await env.media.get("playlists/index.json");
        if (!playlistsObj) {
          playlistsCache = {};
          playlistsCacheTimestamp = now;
          return {};
        }
        const text = await playlistsObj.text();
        playlistsCache = JSON.parse(text || "{}");
        playlistsCacheTimestamp = now;
        return playlistsCache;
      } catch (e) {
        playlistsCache = {};
        playlistsCacheTimestamp = now;
        return {};
      }
    };

    const savePlaylists = async (playlists) => {
      await env.media.put("playlists/index.json", JSON.stringify(playlists));
      playlistsCache = playlists;
      playlistsCacheTimestamp = Date.now();
    };

    const addSongToPlaylist = async (playlistId, songKey) => {
      const playlists = await getPlaylists();
      if (playlists[playlistId]) {
        if (!playlists[playlistId].songs) playlists[playlistId].songs = [];
        if (!playlists[playlistId].songs.includes(songKey)) {
          playlists[playlistId].songs.push(songKey);
          playlists[playlistId].updated = Date.now();
          await savePlaylists(playlists);
        }
      }
    };

    const removeSongFromPlaylist = async (playlistId, songKey) => {
      const playlists = await getPlaylists();
      if (playlists[playlistId] && playlists[playlistId].songs) {
        const index = playlists[playlistId].songs.indexOf(songKey);
        if (index !== -1) {
          playlists[playlistId].songs.splice(index, 1);
          playlists[playlistId].updated = Date.now();
          await savePlaylists(playlists);
        }
      }
    };

    const getPlaylistSongs = async (playlistId) => {
      const playlists = await getPlaylists();
      return playlists[playlistId] ? playlists[playlistId].songs || [] : [];
    };

    // =========================
    // UPLOAD PAGE (GET) - WITH PLAYLIST OPTIONS
    // =========================
    if (path === "/upload" && req.method === "GET") {
      const albums = await getAlbums();
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

      const artists = await getArtists();
      const artistOptions = Object.keys(artists).map(id => {
        const artist = artists[id];
        return `<option value="${id}">${artist.name}</option>`;
      }).join("");
      
      // === NEW: Get playlists for dropdown ===
      const playlists = await getPlaylists();
      const playlistOptions = Object.keys(playlists).map(id => {
        const playlist = playlists[id];
        return `<option value="${id}">${playlist.title}</option>`;
      }).join("");
      
      const playlistSection = `
        <label>Add to Playlist (Optional)</label>
        <select name="playlist" style="padding:8px; margin-top:5px;">
          <option value="">-- Select Playlist --</option>
          ${playlistOptions}
          <option value="__create_new__">[Create New Playlist]</option>
        </select>
        <p style="margin-top:5px; font-size:0.9em;">
          Or <a href="/playlist/create" style="color:#4a90e2; text-decoration:none;">create a new playlist</a>
        </p>
      `;
      
      const artistSection = `
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
      `;

      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Upload Song - ZEDALBUMS.TOP</title>
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
            
            // === NEW: Playlist create redirect ===
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
      </head>
      <body>
        <div class="container">
          <h1>Upload New Song</h1>
          <form action="/upload" method="POST" enctype="multipart/form-data">
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
            <input type="file" name="audio" accept=".mp3" required>
            
            <label>Thumbnail Image</label>
            <input type="file" name="image" accept="image/*" required>
            
            <button type="submit">Upload Song</button>
          </form>
          
          <div class="back-link">
            <a href="/">← Back to Home</a> | 
            <a href="/playlists">View Playlists</a>
          </div>
        </div>
      </body>
      </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // UPLOAD HANDLER (POST) - WITH PLAYLIST SUPPORT
    // =========================
    if (path === "/upload" && req.method === "POST") {
      const formData = await req.formData();
      const title = formData.get("title");
      const artist = formData.get("artist");
      const description = formData.get("description");
      const audioFile = formData.get("audio");
      const imageFile = formData.get("image");
      const albumId = formData.get("album");
      const playlistId = formData.get("playlist"); // NEW: Get playlist ID
      const artistNameInput = formData.get("artist_name");

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

      // Add to album if selected
      if (albumId && albumId !== "" && albumId !== "__create_new__") {
        await addSongToAlbum(albumId, baseName);
        await addAlbumToArtist(artistId, albumId);
        await addArtistToAlbum(artistId, albumId);
      }
      
      // === NEW: Add to playlist if selected ===
      if (playlistId && playlistId !== "" && playlistId !== "__create_new__") {
        await addSongToPlaylist(playlistId, baseName);
      }
      
      await addSongToArtist(artistId, baseName);

      homepageCache = null;
      cacheTimestamp = 0;

      // Generate success page with links
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Upload Successful</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; text-align: center; }
            .success { background: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
            h1 { color: #28a745; }
            .btn { display: inline-block; margin: 10px; padding: 12px 24px; background: #ff5500; color: white; text-decoration: none; border-radius: 4px; }
            .btn:hover { background: #ff6a1a; }
            .btn-playlist { background: #4a90e2; }
            .btn-playlist:hover { background: #3a7bc8; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ Upload Successful!</h1>
            <p style="font-size: 1.2rem;">${title} by ${artistName}</p>
            <a href="/song/${encodeURIComponent(baseName + ".mp3")}" class="btn">View Song</a>
            ${playlistId ? `<a href="/playlist/${playlistId}" class="btn btn-playlist">View Playlist</a>` : ''}
            <p style="margin-top: 20px;">
              <a href="/upload">Upload Another Song</a> | 
              <a href="/">Back to Home</a>
            </p>
          </div>
        </body>
        </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // CREATE PLAYLIST PAGE (GET)
    // =========================
    if (path === "/playlist/create" && req.method === "GET") {
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Create Playlist - ZEDALBUMS.TOP</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; margin-bottom: 20px; border-left: 4px solid #4a90e2; padding-left: 15px; }
          label { display: block; margin-top: 15px; font-weight: 600; color: #555; }
          input, textarea, select { width: 100%; padding: 12px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; }
          button { margin-top: 25px; padding: 14px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 600; width: 100%; }
          button:hover { background: #3a7bc8; }
          .back-link { margin-top: 20px; text-align: center; }
          .back-link a { color: #666; text-decoration: none; }
          .back-link a:hover { color: #4a90e2; }
          .note { background: #f8f9fa; padding: 12px; border-radius: 4px; margin-top: 20px; font-size: 0.9rem; color: #666; border-left: 3px solid #4a90e2; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Create New Playlist</h1>
          <form action="/playlist/create" method="POST" enctype="multipart/form-data">
            <label>Playlist Title</label>
            <input type="text" name="title" placeholder="e.g. Zambian Hits 2024" required>
            
            <label>Description (Optional)</label>
            <textarea name="description" rows="3" placeholder="Describe your playlist..."></textarea>
            
            <label>Curator Name (Optional)</label>
            <input type="text" name="curator" placeholder="e.g. ZEDALBUMS.TOP" value="ZEDALBUMS.TOP">
            
            <label>Cover Image (Optional)</label>
            <input type="file" name="thumbnail" accept="image/*">
            
            <button type="submit">Create Playlist</button>
          </form>
          
          <div class="note">
            <strong>💡 Tip:</strong> After creating your playlist, you can add songs to it from the upload form.
          </div>
          
          <div class="back-link">
            <a href="/upload">← Back to Upload</a> | 
            <a href="/playlists">View All Playlists</a>
          </div>
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
      const description = formData.get("description") || "";
      const curator = formData.get("curator") || "ZEDALBUMS.TOP";
      const thumbnailFile = formData.get("thumbnail");

      if (!title) {
        return new Response("Missing playlist title", { status: 400 });
      }

      const playlistId = sanitize(title) + "_" + Date.now();
      const playlists = await getPlaylists();

      let thumbnailKey = null;
      if (thumbnailFile && thumbnailFile.size > 0) {
        const imgType = thumbnailFile.type.includes("png") ? "png" : "jpg";
        thumbnailKey = `playlists/thumbnails/${playlistId}.${imgType}`;
        await env.media.put(thumbnailKey, thumbnailFile.stream());
      }

      playlists[playlistId] = {
        id: playlistId,
        title: title,
        description: description,
        curator: curator,
        thumbnail: thumbnailKey,
        created: Date.now(),
        updated: Date.now(),
        songs: []
      };

      await savePlaylists(playlists);
      
      homepageCache = null;
      cacheTimestamp = 0;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Playlist Created</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; text-align: center; }
            .success { background: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
            h1 { color: #4a90e2; }
            .btn { display: inline-block; margin: 10px; padding: 12px 24px; background: #4a90e2; color: white; text-decoration: none; border-radius: 4px; }
            .btn:hover { background: #3a7bc8; }
            .btn-upload { background: #ff5500; }
            .btn-upload:hover { background: #ff6a1a; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ Playlist Created!</h1>
            <p style="font-size: 1.2rem; margin: 20px 0;">"${title}"</p>
            <a href="/playlist/${playlistId}" class="btn">View Playlist</a>
            <a href="/upload" class="btn btn-upload">Upload Songs</a>
            <p style="margin-top: 20px;">
              <a href="/playlist/create">Create Another Playlist</a> | 
              <a href="/playlists">All Playlists</a>
            </p>
          </div>
        </body>
        </html>
      `;
      
      return new Response(html, { 
        headers: { ...CORS_HEADERS, "Content-Type": "text/html" } 
      });
    }

    // =========================
    // API: GET ALL PLAYLISTS (for dropdowns)
    // =========================
    if (path === "/api/playlists/list" && req.method === "GET") {
      const playlists = await getPlaylists();
      const playlistArray = Object.values(playlists).map(p => ({
        id: p.id,
        title: p.title,
        songs: p.songs || [],
        created: p.created,
        songCount: (p.songs || []).length
      }));
      
      return new Response(JSON.stringify(playlistArray), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
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
        <title>Create Album - ZEDALBUMS.TOP</title>
        <style>
          body { font-family: Arial,sans-serif; padding:50px; background:#f0f0f0; }
          .container { max-width:500px; margin:0 auto; background:white; padding:30px; border-radius:8px; }
          h1 { color:#333; border-left:4px solid #28a745; padding-left:15px; }
          label { display:block; margin-top:15px; font-weight:bold; }
          input, textarea { width:100%; padding:12px; margin-top:5px; border:1px solid #ddd; border-radius:4px; }
          button { margin-top:25px; padding:14px; background:#28a745; color:#fff; border:none; border-radius:4px; cursor:pointer; width:100%; font-size:16px; }
          button:hover { background:#218838; }
          .back-link { margin-top:20px; text-align:center; }
        </style>
      </head>
      <body>
        <div class="container">
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
        </div>
      </body>
      </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // CREATE ALBUM HANDLER (POST)
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
    // CREATE ARTIST PAGE (GET)
    // =========================
    if (path === "/artist/create" && req.method === "GET") {
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Create Artist - ZEDALBUMS.TOP</title>
        <style>
          body { font-family: Arial,sans-serif; padding:50px; background:#f0f0f0; }
          .container { max-width:500px; margin:0 auto; background:white; padding:30px; border-radius:8px; }
          h1 { color:#333; border-left:4px solid #9b59b6; padding-left:15px; }
          label { display:block; margin-top:15px; font-weight:bold; }
          input, textarea { width:100%; padding:12px; margin-top:5px; border:1px solid #ddd; border-radius:4px; }
          button { margin-top:25px; padding:14px; background:#9b59b6; color:#fff; border:none; border-radius:4px; cursor:pointer; width:100%; font-size:16px; }
          button:hover { background:#8e44ad; }
          .back-link { margin-top:20px; text-align:center; }
        </style>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const urlParams = new URLSearchParams(window.location.search);
            const fromUpload = urlParams.get('from') === 'upload';
            
            const backLink = document.querySelector('.back-link a');
            if (fromUpload && backLink) {
              backLink.href = '/upload';
              backLink.innerHTML = '← Back to Upload';
            }
            
            const newArtistName = sessionStorage.getItem('newArtistName');
            if (newArtistName) {
              document.querySelector('input[name="name"]').value = newArtistName;
              sessionStorage.removeItem('newArtistName');
            }
          });
        </script>
      </head>
      <body>
        <div class="container">
          <h1>Create New Artist</h1>
          <form action="/artist/create" method="POST" enctype="multipart/form-data">
            <label>Artist Name</label>
            <input type="text" name="name" required>
            <label>Artist Bio (Optional)</label>
            <textarea name="description" rows="3"></textarea>
            <label>Genre (Optional)</label>
            <input type="text" name="genre" placeholder="e.g. Zam Pop, Gospel, Hip Hop">
            <label>Artist Image (Optional)</label>
            <input type="file" name="thumbnail" accept="image/*">
            <button type="submit">Create Artist</button>
          </form>
          <div class="back-link">
            <a href="/">← Back to Home</a>
          </div>
        </div>
      </body>
      </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // CREATE ARTIST HANDLER (POST)
    // =========================
    if (path === "/artist/create" && req.method === "POST") {
      const formData = await req.formData();
      const name = formData.get("name");
      const description = formData.get("description") || "";
      const genre = formData.get("genre") || "";
      const thumbnailFile = formData.get("thumbnail");

      if (!name) {
        return new Response("Missing artist name", { status: 400 });
      }

      const artistId = sanitize(name);
      const artists = await getArtists();

      let thumbnailKey = null;
      if (thumbnailFile && thumbnailFile.size > 0) {
        const imgType = thumbnailFile.type.includes("png") ? "png" : "jpg";
        thumbnailKey = `artists/thumbnails/${artistId}.${imgType}`;
        await env.media.put(thumbnailKey, thumbnailFile.stream());
      }

      if (!artists[artistId]) {
        artists[artistId] = {
          id: artistId,
          name: name,
          description: description,
          genre: genre,
          thumbnail: thumbnailKey,
          created: Date.now(),
          songs: [],
          albums: []
        };
        await saveArtists(artists);
      }

      homepageCache = null;
      cacheTimestamp = 0;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Artist Created</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; text-align: center; }
            .success { background: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
            h1 { color: #9b59b6; }
            .btn { display: inline-block; margin: 10px; padding: 12px 24px; background: #9b59b6; color: white; text-decoration: none; border-radius: 4px; }
            .btn:hover { background: #8e44ad; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ Artist Created!</h1>
            <p style="font-size: 1.2rem;">${name}</p>
            <a href="/artist/${artistId}" class="btn">View Artist</a>
            <a href="/upload" class="btn" style="background: #ff5500;">Upload Songs</a>
            <p style="margin-top: 20px;"><a href="/artist/create">Create Another Artist</a></p>
          </div>
        </body>
        </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // ALBUMS PAGE - DYNAMIC FROM TEMPLATE
    // =========================
    if (path === "/albums") {
      // ... (keep your existing albums page code) ...
    }

    // =========================
    // ALBUM DETAIL PAGE
    // =========================
    if (path.startsWith("/album/") && !path.startsWith("/album/create")) {
      // ... (keep your existing album detail code) ...
    }

    // =========================
    // SONG DETAIL PAGE
    // =========================
    if (path.startsWith("/song/")) {
      // ... (keep your existing song detail code) ...
    }

    // =========================
    // ARTISTS PAGE
    // =========================
    if (path === "/artists") {
      // ... (keep your existing artists page code) ...
    }

    // =========================
    // ARTIST DETAIL PAGE
    // =========================
    if (path.startsWith("/artist/") && !path.startsWith("/artist/create")) {
      // ... (keep your existing artist detail code) ...
    }

    // =========================
    // HOMEPAGE
    // =========================
    if (path === "/") {
      // ... (keep your existing homepage code) ...
    }

    // =========================
    // PLAYLISTS LIST PAGE
    // =========================
    if (path === "/playlists") {
      // ... (keep your existing playlists list code) ...
    }

    // =========================
    // PLAYLIST DETAIL PAGE
    // =========================
    if (path.startsWith("/playlist/") && !path.startsWith("/playlist/create")) {
      // ... (keep your existing playlist detail code) ...
    }

    // =========================
    // DOWNLOAD PAGE
    // =========================
    if (path.startsWith("/download/")) {
      const fileName = decodeURIComponent(path.replace("/download/",""));
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Downloading...</title>
          <meta http-equiv="refresh" content="0;url=/songs/${encodeURIComponent(fileName)}">
        </head>
        <body>
          <p>Download started. <a href="/songs/${encodeURIComponent(fileName)}">Click here</a> if download doesn't start automatically.</p>
          <p><a href="/">Back to Home</a></p>
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
    // FILE SERVING
    // =========================
    if (path.startsWith("/songs/") || path.startsWith("/images/")) {
      const fileName = decodeURIComponent(path.slice(1));
      const obj = await env.media.get(fileName);
      if (!obj) return new Response("File not found", { status: 404 });

      let contentType = "application/octet-stream";
      let cacheControl = "public, max-age=300";
      let contentDisposition = "inline";
      
      if (fileName.endsWith(".mp3")) {
        contentType = "audio/mpeg";
        cacheControl = "public, max-age=604800";
        contentDisposition = "inline";
      } else if (fileName.endsWith(".jpg")) {
        contentType = "image/jpeg";
        cacheControl = "public, max-age=604800";
      } else if (fileName.endsWith(".png")) {
        contentType = "image/png";
        cacheControl = "public, max-age=604800";
      }

      const headers = {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
        "Accept-Ranges": "bytes",
      };

      if (path.startsWith("/download/")) {
        contentDisposition = `attachment; filename="${fileName.split('/').pop()}"`;
      }

      headers["Content-Disposition"] = contentDisposition;

      return new Response(obj.body, { headers });
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
          await addArtistToAlbum(artistId, albumId);
        } else {
          await removeAlbumFromArtist(artistId, albumId);
          await removeArtistFromAlbum(artistId, albumId);
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
            <a href="/albums">View Albums</a> | 
            <a href="/artists">View Artists</a>
          </div>
          
          <div class="current-assignments">
            <h3>Current Album-Artist Assignments</h3>
            <p><em>Note: Albums are automatically assigned when songs are uploaded to albums.</em></p>
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
    // REDIRECT OLD ROUTES
    // =========================
    if (path === "/album") {
      return Response.redirect("/albums", 301);
    }
    
    if (path === "/artist") {
      return Response.redirect("/artists", 301);
    }

    if (path === "/playlist") {
      return Response.redirect("/playlists", 301);
    }

    if (path === "/new-design") {
      return Response.redirect("/", 301);
    }

    // =========================
    // 404 NOT FOUND
    // =========================
    return new Response("Not found", { status: 404 });
  }
};