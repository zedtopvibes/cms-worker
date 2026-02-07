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
    // PERFORMANCE OPTIMIZATIONS - ADDED
    // -----------------------------
    // Memory cache for homepage (lasts 30 seconds)
    let homepageCache = null;
    let cacheTimestamp = 0;
    const CACHE_DURATION = 30000; // 30 seconds
    
    // Memory cache for albums/artists data
    let albumsCache = null;
    let artistsCache = null;
    let dataCacheTimestamp = 0;
    const DATA_CACHE_DURATION = 60000; // 60 seconds

    // -----------------------------
    // Helper to sanitize filenames
    // -----------------------------
    const sanitize = str => str.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");

    // === NEW FEATURE START ===
    // Album storage helper functions - OPTIMIZED WITH CACHE
    const getAlbums = async () => {
      // Check memory cache first
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
      // Update cache
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
    // === NEW FEATURE END ===

    // === ARTISTS FEATURE START ===
    // Artists helper functions - OPTIMIZED WITH CACHE
    const getArtists = async () => {
      // Check memory cache first
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
      // Update cache
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
    
    // NEW: Helper to get artist's albums and singles
    const getArtistAlbumsAndSingles = async (artistId) => {
      const artists = await getArtists();
      const albums = await getAlbums();
      const artist = artists[artistId];
      
      if (!artist) {
        return { albums: [], singles: [], totalSongs: 0, totalAlbums: 0, totalSingles: 0 };
      }
      
      // Get all albums that contain songs by this artist
      const artistAlbums = [];
      const albumSongIds = new Set(); // Track songs that are in albums
      
      for (const albumId in albums) {
        const album = albums[albumId];
        const albumSongsByArtist = [];
        
        // Check each song in the album
        for (const songKey of album.songs) {
          const [songArtist] = songKey.split("_");
          if (songArtist === artistId) {
            albumSongsByArtist.push(songKey);
            albumSongIds.add(songKey);
          }
        }
        
        if (albumSongsByArtist.length > 0) {
          // Get album thumbnail
          let thumbUrl = "/images/placeholder.jpg";
          if (album.thumbnail) {
            const thumbObj = await env.media.get(album.thumbnail);
            if (thumbObj) {
              const ext = album.thumbnail.split(".").pop();
              thumbUrl = `/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}`;
            }
          }
          
          artistAlbums.push({
            id: albumId,
            title: album.title,
            description: album.description,
            thumbnail: thumbUrl,
            songCount: albumSongsByArtist.length,
            songs: albumSongsByArtist,
            created: album.created
          });
        }
      }
      
      // Sort albums by creation date (newest first)
      artistAlbums.sort((a, b) => b.created - a.created);
      
      // Get singles (songs not in any album)
      const singles = [];
      for (const songKey of artist.songs) {
        if (!albumSongIds.has(songKey)) {
          singles.push(songKey);
        }
      }
      
      // Sort singles by upload date (we need to get song info to sort properly)
      const sortedSingles = await Promise.all(singles.map(async songKey => {
        // Get song upload date from R2
        const audioObj = await env.media.get(`songs/${songKey}.mp3`);
        const uploaded = audioObj ? audioObj.uploaded : Date.now();
        
        return {
          key: songKey,
          uploaded: uploaded
        };
      }));
      
      sortedSingles.sort((a, b) => b.uploaded - a.uploaded);
      const singleKeys = sortedSingles.map(s => s.key);
      
      return {
        albums: artistAlbums,
        singles: singleKeys,
        totalSongs: artist.songs.length,
        totalAlbums: artistAlbums.length,
        totalSingles: singleKeys.length
      };
    };
    // === ARTISTS FEATURE END ===

    // =========================
    // UPLOAD PAGE (GET)
    // =========================
    if (path === "/upload" && req.method === "GET") {
      // === NEW FEATURE START ===
      // Get existing albums for dropdown
      const albums = await getAlbums();
      const albumOptions = Object.keys(albums).map(id => {
        const album = albums[id];
        return `<option value="${id}">${album.title}</option>`;
      }).join("");
      
      // Add album dropdown and create album link
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
      // === NEW FEATURE END ===

      // === ARTISTS FEATURE START ===
      // Get existing artists for dropdown
      const artists = await getArtists();
      const artistOptions = Object.keys(artists).map(id => {
        const artist = artists[id];
        return `<option value="${id}">${artist.name}</option>`;
      }).join("");
      
      // Add artists dropdown and create artist link
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
      // === ARTISTS FEATURE END ===

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
          .album-link { margin-top:5px; font-size:0.9em; }
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
            
            // === ARTISTS FEATURE START ===
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
                  // Store the artist name in sessionStorage to pre-fill the create artist form
                  sessionStorage.setItem('newArtistName', newArtistName);
                  window.location.href = '/artist/create';
                } else {
                  alert('Please enter an artist name first');
                }
              });
            }
            // === ARTISTS FEATURE END ===
          });
        </script>
      </head>
      <body>
        <h1>Upload Song</h1>
        <form action="/upload" method="POST" enctype="multipart/form-data">
          <label>Song Title</label>
          <input type="text" name="title" required>

          <!-- === ARTISTS FEATURE START === -->
          ${artistSection}
          <!-- === ARTISTS FEATURE END === -->

          <label>Description (inside song page)</label>
          <textarea name="description" rows="3" required></textarea>

          <!-- === NEW FEATURE START === -->
          ${albumSection}
          <!-- === NEW FEATURE END === -->

          <label>Audio File (.mp3)</label>
          <input type="file" name="audio" accept=".mp3" required>

          <label>Thumbnail Image (.jpg, .png)</label>
          <input type="file" name="image" accept="image/*" required>

          <button type="submit">Upload</button>
        </form>
      </body>
      </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // UPLOAD HANDLER (POST)
    // =========================
    if (path === "/upload" && req.method === "POST") {
      const formData = await req.formData();
      const title = formData.get("title");
      const artist = formData.get("artist");
      const description = formData.get("description");
      const audioFile = formData.get("audio");
      const imageFile = formData.get("image");
      
      // === NEW FEATURE START ===
      const albumId = formData.get("album");
      // === NEW FEATURE END ===
      
      // === ARTISTS FEATURE START ===
      const artistNameInput = formData.get("artist_name");
      // === ARTISTS FEATURE END ===

      if (!title || !audioFile || !imageFile) {
        return new Response("Missing fields", { status: 400 });
      }

      // === ARTISTS FEATURE START ===
      let artistName = artist;
      let artistId = artist;
      
      // If creating new artist, use the input name
      if (artist === "__create_new__" && artistNameInput) {
        artistName = artistNameInput;
        artistId = sanitize(artistNameInput);
        
        // Create the new artist
        const artists = await getArtists();
        
        // Check if artist already exists
        if (!artists[artistId]) {
          artists[artistId] = {
            id: artistId,
            name: artistName,
            description: "",
            thumbnail: "",
            created: Date.now(),
            songs: []
          };
          await saveArtists(artists);
        }
      }
      // === ARTISTS FEATURE END ===

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

      // === NEW FEATURE START ===
      // Add song to album if selected
      if (albumId && albumId !== "" && albumId !== "__create_new__") {
        await addSongToAlbum(albumId, baseName);
      }
      // === NEW FEATURE END ===
      
      // === ARTISTS FEATURE START ===
      // Add song to artist
      await addSongToArtist(artistId, baseName);
      // === ARTISTS FEATURE END ===

      // Clear homepage cache since new content was added
      homepageCache = null;
      cacheTimestamp = 0;

      const html = `
        <h1>Upload Successful!</h1>
        <p><a href="/song/${encodeURIComponent(baseName + ".mp3")}">View Song Page</a></p>
        <p><a href="/">Back to Home</a></p>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // === NEW FEATURE START ===
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

      // Store thumbnail
      const imgType = thumbnailFile.type.includes("png") ? "png" : "jpg";
      const thumbnailKey = `albums/thumbnails/${albumId}.${imgType}`;
      await env.media.put(thumbnailKey, thumbnailFile.stream());

      // Create album record
      albums[albumId] = {
        id: albumId,
        title: title,
        description: description || "",
        thumbnail: thumbnailKey,
        created: Date.now(),
        songs: []
      };

      await saveAlbums(albums);
      
      // Clear homepage cache since new content was added
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
        // List all albums
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
              <p style="font-size:0.8em; color:#888;">${new Date(album.created).toLocaleDateString()}</p>
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
            .album-card { display:inline-block; margin:15px; }
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
            "Cache-Control": "public, max-age=300" // Cache for 5 minutes
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
        // OPTIMIZED: Check .jpg first, then .png
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
        </style>
      </head>
      <body>
        <div class="album-header">
          <h1>${album.title}</h1>
          ${albumThumb}
          <p>${album.description}</p>
          <p><small>Created: ${new Date(album.created).toLocaleDateString()}</small></p>
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
          "Cache-Control": "public, max-age=300" // Cache for 5 minutes
        } 
      });
    }
    // === NEW FEATURE END ===

    // === ARTISTS FEATURE START ===
    // =========================
    // CREATE ARTIST PAGE (GET)
    // =========================
    if (path === "/artist/create" && req.method === "GET") {
      // Check for pre-filled artist name from session storage
      let artistNameValue = "";
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
            // Check for stored artist name
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
    // CREATE ARTIST HANDLER (POST)
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

      // Check if artist already exists
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
        // Store thumbnail
        const imgType = thumbnailFile.type.includes("png") ? "png" : "jpg";
        thumbnailKey = `artists/thumbnails/${artistId}.${imgType}`;
        await env.media.put(thumbnailKey, thumbnailFile.stream());
      }

      // Create artist record
      artists[artistId] = {
        id: artistId,
        name: name,
        description: description || "",
        thumbnail: thumbnailKey,
        created: Date.now(),
        songs: []
      };

      await saveArtists(artists);
      
      // Clear homepage cache since new content was added
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
    // ENHANCED ARTISTS PAGE WITH ALBUMS & SINGLES SEPARATION
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
          
          return `
            <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin:10px; background:#fff; display:inline-block; width:200px; vertical-align:top; text-align:center;">
              <img src="${thumbUrl}" alt="${artist.name}" style="width:150px; height:150px; object-fit:cover; border-radius:50%; margin-bottom:10px;">
              <h3 style="margin:10px 0 5px 0;"><a href="/artist/${artist.id}">${artist.name}</a></h3>
              <p style="font-size:0.9em; color:#666; margin:0 0 10px 0;">${artist.songs.length} songs</p>
              <p style="font-size:0.8em; color:#888;">${new Date(artist.created).toLocaleDateString()}</p>
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
            .artist-card { display:inline-block; margin:15px; }
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
            "Cache-Control": "public, max-age=300" // Cache for 5 minutes
          } 
        });
      }

      // Single artist page with albums and singles separation
      const artists = await getArtists();
      const artist = artists[artistId];
      
      if (!artist) {
        return new Response("Artist not found", { status: 404 });
      }

      // Get artist's albums and singles using the new helper
      const { albums: artistAlbums, singles, totalSongs, totalAlbums, totalSingles } = await getArtistAlbumsAndSingles(artistId);

      // Get artist thumbnail
      let artistThumb = "";
      if (artist.thumbnail) {
        const thumbObj = await env.media.get(artist.thumbnail);
        if (thumbObj) {
          const ext = artist.thumbnail.split(".").pop();
          artistThumb = `<img src="/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}" alt="${artist.name}" style="width:200px; height:200px; object-fit:cover; border-radius:50%; margin:10px 0;">`;
        }
      }

      // Generate albums section
      let albumsSection = '';
      if (artistAlbums.length > 0) {
        const albumCards = artistAlbums.map(album => {
          return `
            <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin:10px; background:#fff; display:inline-block; width:180px; vertical-align:top;">
              <a href="/album/${album.id}">
                <img src="${album.thumbnail}" alt="${album.title}" style="width:100%; height:150px; object-fit:cover; border-radius:4px;">
              </a>
              <h3 style="margin:10px 0 5px 0; font-size:1rem;">
                <a href="/album/${album.id}" style="text-decoration:none; color:#333;">${album.title}</a>
              </h3>
              <p style="font-size:0.9em; color:#666; margin:0 0 5px 0;">${album.songCount} song${album.songCount !== 1 ? 's' : ''}</p>
              <p style="font-size:0.8em; color:#888;">${new Date(album.created).toLocaleDateString()}</p>
            </div>
          `;
        }).join('');
        
        albumsSection = `
          <div style="margin-top:30px;">
            <h2>Albums (${totalAlbums})</h2>
            <div style="margin-top:15px; display:flex; flex-wrap:wrap; gap:15px; justify-content:center;">
              ${albumCards}
            </div>
          </div>
        `;
      }

      // Generate singles section
      let singlesSection = '';
      if (singles.length > 0) {
        const singleList = await Promise.all(singles.map(async songKey => {
          const audioObj = await env.media.get(`songs/${songKey}.mp3`);
          if (!audioObj) return null;

          const [songArtist, ...titleParts] = songKey.split("_");
          const title = titleParts.join(" ");

          let thumbUrl = "/images/placeholder.jpg";
          // OPTIMIZED: Check .jpg first, then .png
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
                <small>${songArtist}</small>
              </div>
              <span style="background:#ff6b6b; color:white; padding:3px 8px; border-radius:12px; font-size:0.8em;">Single</span>
            </div>
          `;
        }));

        singlesSection = `
          <div style="margin-top:30px;">
            <h2>Singles (${totalSingles})</h2>
            <div style="max-width:600px; margin:15px auto 0 auto;">
              ${singleList.filter(s => s).join("")}
            </div>
          </div>
        `;
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
          .stats { display:flex; justify-content:center; gap:20px; margin:15px 0 25px 0; flex-wrap:wrap; }
          .stat-card { background:#fff; padding:15px 20px; border-radius:8px; text-align:center; min-width:120px; box-shadow:0 2px 5px rgba(0,0,0,0.05); }
          .stat-number { font-size:1.5rem; font-weight:bold; color:#3498db; margin-bottom:5px; }
          .stat-label { font-size:0.9rem; color:#7f8c8d; }
          img { max-width:100%; height:auto; border-radius:8px; }
          .section-title { margin-bottom:15px; padding-bottom:10px; border-bottom:2px solid #3498db; }
        </style>
      </head>
      <body>
        <div class="artist-header">
          <h1>${artist.name}</h1>
          ${artistThumb}
          <p>${artist.description}</p>
          <div class="stats">
            <div class="stat-card">
              <div class="stat-number">${totalSongs}</div>
              <div class="stat-label">Total Songs</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${totalAlbums}</div>
              <div class="stat-label">Albums</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${totalSingles}</div>
              <div class="stat-label">Singles</div>
            </div>
          </div>
          <p><small>Joined: ${new Date(artist.created).toLocaleDateString()}</small></p>
          <p>
            <a href="/artist">← All Artists</a> | 
            <a href="/">Home</a> | 
            <a href="/upload">Upload</a>
          </p>
        </div>
        
        ${albumsSection}
        ${singlesSection}
        
        ${artistAlbums.length === 0 && singles.length === 0 ? 
          '<div style="text-align:center; padding:40px; background:#fff; border-radius:8px; max-width:600px; margin:0 auto;"><p>No songs by this artist yet.</p></div>' : ''}
      </body>
      </html>
      `;
      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300" // Cache for 5 minutes
        } 
      });
    }
    // === ARTISTS FEATURE END ===

    // =========================
    // HOMEPAGE - OPTIMIZED WITH CACHE
    // =========================
    if (path === "/") {
      // Check memory cache first
      const now = Date.now();
      if (homepageCache && (now - cacheTimestamp < CACHE_DURATION)) {
        return new Response(homepageCache, { 
          headers: { 
            "Content-Type": "text/html",
            "Cache-Control": "public, max-age=300" // Cache for 5 minutes
          } 
        });
      }

      const file = await env.media.get("index.html");
      if (!file) return new Response("index.html not found", { status: 500 });

      let html = await file.text();

      // Get latest songs - OPTIMIZED
      const list = await env.media.list({ prefix: "songs/", limit: 50 }); // Reduced from 1000
      const files = list.objects || [];
      files.sort((a,b) => b.uploaded - a.uploaded);
      const latest = files.slice(0,10);

      // OPTIMIZED: Parallel image lookup with fallback logic
      const fmHtml = await Promise.all(latest.map(async f => {
        const fileName = f.key.split("/")[1];
        const baseName = fileName.replace(".mp3","");
        const [artist, ...titleParts] = baseName.split("_");
        const title = titleParts.join(" ");

        let thumbUrl = "/images/placeholder.jpg";
        // OPTIMIZED: Check .jpg first, only check .png if .jpg not found
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
        } catch (e) {
          // Use placeholder if image not found
        }

        return `<div class="song" style="display:flex;align-items:center;margin-bottom:10px;">
          <img src="${thumbUrl}" alt="${title}" style="width:80px;height:auto;margin-right:10px;border-radius:8px;">
          <a href="/song/${encodeURIComponent(fileName)}">${title}<br><small>${artist}</small></a>
        </div>`;
      }));

      html = html.replace(/\[fm\].*?\[\/fm\]/gs, fmHtml.join(""));

      // === NEW FEATURE START ===
      // Add albums section to homepage
      const albums = await getAlbums(); // Uses cache
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
          } catch (e) {
            // Use placeholder if thumbnail not found
          }
        }
        
        return `
          <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin:10px; background:#fff; display:inline-block; width:180px; vertical-align:top; text-align:center;">
            <img src="${thumbUrl}" alt="${album.title}" style="width:100%; height:120px; object-fit:cover; border-radius:4px; margin-bottom:10px;">
            <h3 style="margin:0 0 5px 0; font-size:1rem;"><a href="/album/${album.id}" style="text-decoration:none; color:#333;">${album.title}</a></h3>
            <p style="font-size:0.8em; color:#666; margin:0 0 5px 0;">${album.songs.length} song${album.songs.length !== 1 ? 's' : ''}</p>
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
      // === NEW FEATURE END ===

      // === ARTISTS FEATURE START ===
      // Add artists section to homepage
      const artists = await getArtists(); // Uses cache
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
          } catch (e) {
            // Use placeholder if thumbnail not found
          }
        }
        
        return `
          <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin:10px; background:#fff; display:inline-block; width:180px; vertical-align:top; text-align:center;">
            <img src="${thumbUrl}" alt="${artist.name}" style="width:150px; height:150px; object-fit:cover; border-radius:50%; margin-bottom:10px;">
            <h3 style="margin:0 0 5px 0; font-size:1rem;"><a href="/artist/${artist.id}" style="text-decoration:none; color:#333;">${artist.name}</a></h3>
            <p style="font-size:0.8em; color:#666; margin:0 0 5px 0;">${artist.songs.length} song${artist.songs.length !== 1 ? 's' : ''}</p>
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
      // === ARTISTS FEATURE END ===

      // Store in cache
      homepageCache = html;
      cacheTimestamp = now;

      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300" // Cache for 5 minutes
        } 
      });
    }

    // =========================
    // SONG PAGE
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
      // OPTIMIZED: Check .jpg first, then .png
      const jpgObj = await env.media.get(`images/${baseName}.jpg`);
      if (jpgObj) {
        imgTag = `<img src="/images/${encodeURIComponent(baseName)}.jpg" alt="${title}" style="max-width:300px;margin:10px 0;">`;
      } else {
        const pngObj = await env.media.get(`images/${baseName}.png`);
        if (pngObj) {
          imgTag = `<img src="/images/${encodeURIComponent(baseName)}.png" alt="${title}" style="max-width:300px;margin:10px 0;">`;
        }
      }

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
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <h2>by ${artist}</h2>
        ${imgTag}
        <p>${description}</p>
        <audio controls src="/songs/${encodeURIComponent(fileName)}"></audio>
        <p><a href="/download/${encodeURIComponent(fileName)}">Go to Download Page</a></p>
        <p><a href="/">Back to Home</a></p>
      </body>
      </html>
      `;
      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300" // Cache for 5 minutes
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
          "Cache-Control": "public, max-age=300" // Cache for 5 minutes
        } 
      });
    }

    // =========================
    // SERVE SONGS AND IMAGES - OPTIMIZED WITH CACHE
    // =========================
    if (path.startsWith("/songs/") || path.startsWith("/images/")) {
      const fileName = decodeURIComponent(path.slice(1));
      const obj = await env.media.get(fileName);
      if (!obj) return new Response("File not found", { status: 404 });

      let contentType = "application/octet-stream";
      let cacheControl = "public, max-age=300"; // Default 5 minutes
      
      if (fileName.endsWith(".mp3")) {
        contentType = "audio/mpeg";
        cacheControl = "public, max-age=604800"; // 1 week for audio
      } else if (fileName.endsWith(".jpg")) {
        contentType = "image/jpeg";
        cacheControl = "public, max-age=604800"; // 1 week for images
      } else if (fileName.endsWith(".png")) {
        contentType = "image/png";
        cacheControl = "public, max-age=604800"; // 1 week for images
      }

      return new Response(obj.body, { 
        headers: { 
          "Content-Type": contentType,
          "Cache-Control": cacheControl
        } 
      });
    }

    // === NEW FEATURE START ===
    // =========================
    // SERVE ALBUM THUMBNAILS - OPTIMIZED WITH CACHE
    // =========================
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
          "Cache-Control": "public, max-age=604800" // 1 week for thumbnails
        } 
      });
    }
    // === NEW FEATURE END ===

    // === ARTISTS FEATURE START ===
    // =========================
    // SERVE ARTIST THUMBNAILS - OPTIMIZED WITH CACHE
    // =========================
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
          "Cache-Control": "public, max-age=604800" // 1 week for thumbnails
        } 
      });
    }
    // === ARTISTS FEATURE END ===

    // === NEW FEATURE START ===
    // =========================
    // SONG MANAGEMENT FEATURE
    // =========================

    // Helper functions for song management
    const getAllSongs = async (env) => {
      const list = await env.media.list({ prefix: "songs/", limit: 1000 });
      const songs = [];
      
      for (const file of list.objects || []) {
        const fileName = file.key.split("/")[1];
        const baseName = fileName.replace(".mp3", "");
        const [artist, ...titleParts] = baseName.split("_");
        const title = titleParts.join(" ");
        
        // Get description if exists
        let description = "";
        const descObj = await env.media.get(`descriptions/${baseName}.txt`);
        if (descObj) {
          description = await descObj.text();
        }
        
        // Get albums this song belongs to
        const albums = await getAlbums();
        const songAlbums = [];
        for (const albumId in albums) {
          if (albums[albumId].songs.includes(baseName)) {
            songAlbums.push({
              id: albumId,
              title: albums[albumId].title
            });
          }
        }
        
        songs.push({
          id: baseName,
          fileName: fileName,
          baseName: baseName,
          artist: artist,
          title: title,
          description: description,
          uploaded: file.uploaded,
          albums: songAlbums,
          audioUrl: `/songs/${encodeURIComponent(fileName)}`
        });
      }
      
      return songs.sort((a, b) => b.uploaded - a.uploaded);
    };

    const deleteSong = async (env, songId) => {
      try {
        // Delete audio file
        await env.media.delete(`songs/${songId}.mp3`);
        
        // Delete description
        await env.media.delete(`descriptions/${songId}.txt`);
        
        // Try to delete images
        await env.media.delete(`images/${songId}.jpg`);
        await env.media.delete(`images/${songId}.png`);
        
        // Remove from all albums
        const albums = await getAlbums();
        let modified = false;
        
        for (const albumId in albums) {
          const index = albums[albumId].songs.indexOf(songId);
          if (index !== -1) {
            albums[albumId].songs.splice(index, 1);
            modified = true;
          }
        }
        
        if (modified) {
          await saveAlbums(albums);
        }
        
        // === ARTISTS FEATURE START ===
        // Remove from all artists
        const artists = await getArtists();
        let artistsModified = false;
        
        for (const artistId in artists) {
          const index = artists[artistId].songs.indexOf(songId);
          if (index !== -1) {
            artists[artistId].songs.splice(index, 1);
            artistsModified = true;
          }
        }
        
        if (artistsModified) {
          await saveArtists(artists);
        }
        // === ARTISTS FEATURE END ===
        
        // Clear homepage cache
        homepageCache = null;
        cacheTimestamp = 0;
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    const updateSong = async (env, songId, updates) => {
      try {
        const { title, artist, description } = updates;
        
        // Generate new base name
        const newBaseName = sanitize(artist) + "_" + sanitize(title);
        
        if (newBaseName !== songId) {
          // Rename files if base name changed
          const oldAudioKey = `songs/${songId}.mp3`;
          const newAudioKey = `songs/${newBaseName}.mp3`;
          
          const oldDescKey = `descriptions/${songId}.txt`;
          const newDescKey = `descriptions/${newBaseName}.txt`;
          
          // Check if new name already exists
          const existing = await env.media.get(newAudioKey);
          if (existing) {
            return { success: false, error: "A song with this name already exists" };
          }
          
          // Copy and delete old files
          const audioObj = await env.media.get(oldAudioKey);
          if (audioObj) {
            await env.media.put(newAudioKey, audioObj.body);
            await env.media.delete(oldAudioKey);
          }
          
          // Update description
          await env.media.put(newDescKey, description || "");
          
          // Copy images if they exist
          const oldJpgKey = `images/${songId}.jpg`;
          const newJpgKey = `images/${newBaseName}.jpg`;
          const jpgObj = await env.media.get(oldJpgKey);
          if (jpgObj) {
            await env.media.put(newJpgKey, jpgObj.body);
            await env.media.delete(oldJpgKey);
          }
          
          const oldPngKey = `images/${songId}.png`;
          const newPngKey = `images/${newBaseName}.png`;
          const pngObj = await env.media.get(oldPngKey);
          if (pngObj) {
            await env.media.put(newPngKey, pngObj.body);
            await env.media.delete(oldPngKey);
          }
          
          // Update album references
          const albums = await getAlbums();
          let albumsModified = false;
          
          for (const albumId in albums) {
            const index = albums[albumId].songs.indexOf(songId);
            if (index !== -1) {
              albums[albumId].songs[index] = newBaseName;
              albumsModified = true;
            }
          }
          
          if (albumsModified) {
            await saveAlbums(albums);
          }
          
          // === ARTISTS FEATURE START ===
          // Update artist references
          const artists = await getArtists();
          let artistsModified = false;
          
          // Remove from old artist
          for (const artistId in artists) {
            const index = artists[artistId].songs.indexOf(songId);
            if (index !== -1) {
              artists[artistId].songs.splice(index, 1);
              artistsModified = true;
            }
          }
          
          // Add to new artist (create if doesn't exist)
          const newArtistId = sanitize(artist);
          if (!artists[newArtistId]) {
            artists[newArtistId] = {
              id: newArtistId,
              name: artist,
              description: "",
              thumbnail: "",
              created: Date.now(),
              songs: []
            };
            artistsModified = true;
          }
          
          if (!artists[newArtistId].songs.includes(newBaseName)) {
            artists[newArtistId].songs.push(newBaseName);
            artistsModified = true;
          }
          
          if (artistsModified) {
            await saveArtists(artists);
          }
          // === ARTISTS FEATURE END ===
          
          // Clear homepage cache
          homepageCache = null;
          cacheTimestamp = 0;
          
          return { success: true, newId: newBaseName };
        } else {
          // Only update description
          await env.media.put(`descriptions/${songId}.txt`, description || "");
          
          // Clear homepage cache
          homepageCache = null;
          cacheTimestamp = 0;
          
          return { success: true, newId: songId };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    const updateSongAlbums = async (songId, albumUpdates) => {
      try {
        const albums = await getAlbums();
        let modified = false;
        
        for (const albumId in albums) {
          const songIndex = albums[albumId].songs.indexOf(songId);
          const shouldBeInAlbum = albumUpdates[albumId] === true;
          
          if (shouldBeInAlbum && songIndex === -1) {
            // Add to album
            albums[albumId].songs.push(songId);
            modified = true;
          } else if (!shouldBeInAlbum && songIndex !== -1) {
            // Remove from album
            albums[albumId].songs.splice(songIndex, 1);
            modified = true;
          }
        }
        
        if (modified) {
          await saveAlbums(albums);
          // Clear homepage cache
          homepageCache = null;
          cacheTimestamp = 0;
        }
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // =========================
    // MANAGEMENT PAGE (GET)
    // =========================
    if (path === "/manage" && req.method === "GET") {
      const songs = await getAllSongs(env);
      const albums = await getAlbums();
      
      const songRows = songs.map(song => {
        const albumCheckboxes = Object.keys(albums).map(albumId => {
          const album = albums[albumId];
          const isInAlbum = song.albums.some(a => a.id === albumId);
          return `
            <label style="display:inline-block; margin-right:10px; margin-bottom:5px;">
              <input type="checkbox" name="album_${albumId}" value="${albumId}" ${isInAlbum ? 'checked' : ''} 
                     data-song="${song.id}" class="album-checkbox">
              ${album.title}
            </label>
          `;
        }).join("");
        
        return `
          <div class="song-row" style="border:1px solid #ddd; border-radius:8px; padding:15px; margin-bottom:15px; background:#fff;">
            <div style="display:flex; flex-wrap:wrap; gap:15px; align-items:flex-start;">
              <div style="flex:1; min-width:200px;">
                <h3 style="margin:0 0 5px 0;">${song.title}</h3>
                <p style="margin:0 0 10px 0; color:#666;">by ${song.artist}</p>
                <p style="margin:0 0 10px 0; font-size:0.9em; color:#888;">
                  Uploaded: ${new Date(song.uploaded).toLocaleDateString()}
                </p>
                <div style="margin-top:10px;">
                  <button onclick="editSong('${song.id}')" class="btn btn-edit">Edit</button>
                  <button onclick="deleteSong('${song.id}')" class="btn btn-delete">Delete</button>
                  <a href="/song/${encodeURIComponent(song.fileName)}" target="_blank" class="btn btn-view">View</a>
                  <a href="/download/${encodeURIComponent(song.fileName)}" class="btn btn-download">Download</a>
                </div>
              </div>
              
              <div style="flex:2; min-width:300px;">
                <div style="margin-bottom:15px;">
                  <strong>Description:</strong>
                  <p style="margin:5px 0; font-size:0.9em; color:#555; max-height:100px; overflow-y:auto; padding:5px; background:#f9f9f9; border-radius:4px;">
                    ${song.description || '<em>No description</em>'}
                  </p>
                </div>
                
                <div>
                  <strong>Albums:</strong>
                  <div style="margin-top:5px; padding:10px; background:#f9f9f9; border-radius:4px; max-height:150px; overflow-y:auto;">
                    ${albumCheckboxes || '<p style="margin:0; color:#888;"><em>No albums created yet</em></p>'}
                  </div>
                  <p style="margin:5px 0 0 0; font-size:0.8em; color:#666;">
                    Check albums to include this song
                  </p>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");
      
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Manage Songs</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
          }
          
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          
          h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 2rem;
          }
          
          .subtitle {
            color: #7f8c8d;
            margin-bottom: 20px;
          }
          
          .nav-links {
            display: flex;
            justify-content: center;
            gap: 15px;
            flex-wrap: wrap;
            margin-top: 15px;
          }
          
          .nav-links a {
            color: #3498db;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 5px;
            transition: background-color 0.2s;
          }
          
          .nav-links a:hover {
            background-color: #f0f7ff;
          }
          
          .stats {
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
            margin: 20px 0;
          }
          
          .stat-card {
            background: #fff;
            padding: 15px 25px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            min-width: 150px;
          }
          
          .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #3498db;
            margin-bottom: 5px;
          }
          
          .stat-label {
            font-size: 0.9rem;
            color: #7f8c8d;
          }
          
          .songs-container {
            margin-top: 20px;
          }
          
          .controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 20px;
            padding: 15px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          }
          
          .search-box {
            flex: 1;
            min-width: 200px;
            padding: 10px 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 1rem;
          }
          
          .filter-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          
          .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
            text-align: center;
          }
          
          .btn-edit {
            background: #3498db;
            color: white;
          }
          
          .btn-delete {
            background: #e74c3c;
            color: white;
          }
          
          .btn-view {
            background: #2ecc71;
            color: white;
          }
          
          .btn-download {
            background: #9b59b6;
            color: white;
          }
          
          .btn-save {
            background: #2ecc71;
            color: white;
          }
          
          .btn-cancel {
            background: #95a5a6;
            color: white;
          }
          
          .btn:hover {
            opacity: 0.9;
            transform: translateY(-1px);
          }
          
          .btn:active {
            transform: translateY(0);
          }
          
          .loading {
            text-align: center;
            padding: 40px;
            color: #7f8c8d;
          }
          
          .empty-state {
            text-align: center;
            padding: 40px;
            background: #fff;
            border-radius: 10px;
            color: #7f8c8d;
          }
          
          .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
          }
          
          .modal-content {
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
          }
          
          .modal h2 {
            margin-bottom: 20px;
            color: #2c3e50;
          }
          
          .form-group {
            margin-bottom: 20px;
          }
          
          .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #2c3e50;
          }
          
          .form-group input,
          .form-group textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 1rem;
          }
          
          .form-group textarea {
            min-height: 100px;
            resize: vertical;
          }
          
          .modal-buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 20px;
          }
          
          .album-checkbox {
            margin-right: 5px;
          }
          
          .album-checkbox:checked {
            accent-color: #3498db;
          }
          
          @media (max-width: 768px) {
            .header {
              padding: 15px;
            }
            
            h1 {
              font-size: 1.5rem;
            }
            
            .stat-card {
              min-width: 120px;
              padding: 12px 15px;
            }
            
            .stat-number {
              font-size: 1.5rem;
            }
            
            .controls {
              flex-direction: column;
              align-items: stretch;
            }
            
            .search-box {
              width: 100%;
            }
            
            .filter-buttons {
              justify-content: center;
            }
            
            .song-row > div {
              flex-direction: column;
            }
            
            .modal-content {
              padding: 20px;
              width: 95%;
            }
          }
          
          @media (max-width: 480px) {
            body {
              padding: 10px;
            }
            
            .nav-links {
              flex-direction: column;
              align-items: center;
            }
            
            .nav-links a {
              width: 100%;
              text-align: center;
            }
            
            .stats {
              gap: 10px;
            }
            
            .stat-card {
              min-width: 100px;
              padding: 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Song Management</h1>
          <p class="subtitle">Edit, delete, and organize your songs and albums</p>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-number">${songs.length}</div>
              <div class="stat-label">Total Songs</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${Object.keys(albums).length}</div>
              <div class="stat-label">Total Albums</div>
            </div>
          </div>
          
          <div class="nav-links">
            <a href="/">← Home</a>
            <a href="/upload">Upload New Song</a>
            <a href="/album">View Albums</a>
            <a href="/album/create">Create Album</a>
            <!-- === ARTISTS FEATURE START === -->
            <a href="/artist">View Artists</a>
            <a href="/artist/create">Create Artist</a>
            <!-- === ARTISTS FEATURE END === -->
          </div>
        </div>
        
        <div class="controls">
          <input type="text" id="searchInput" class="search-box" placeholder="Search songs by title or artist..." 
                 onkeyup="filterSongs()">
          <div class="filter-buttons">
            <button onclick="filterSongs('all')" class="btn">All Songs</button>
            <button onclick="filterSongs('recent')" class="btn">Recent First</button>
            <button onclick="filterSongs('oldest')" class="btn">Oldest First</button>
          </div>
        </div>
        
        <div class="songs-container" id="songsList">
          ${songs.length > 0 ? songRows : `
            <div class="empty-state">
              <h3>No songs found</h3>
              <p>Upload your first song to get started!</p>
              <a href="/upload" class="btn" style="margin-top:15px;">Upload Song</a>
            </div>
          `}
        </div>
        
        <div id="editModal" class="modal">
          <div class="modal-content">
            <h2>Edit Song</h2>
            <form id="editForm" onsubmit="saveSongChanges(event)">
              <div class="form-group">
                <label for="editTitle">Song Title</label>
                <input type="text" id="editTitle" required>
              </div>
              
              <div class="form-group">
                <label for="editArtist">Artist Name</label>
                <input type="text" id="editArtist" required>
              </div>
              
              <div class="form-group">
                <label for="editDescription">Description</label>
                <textarea id="editDescription"></textarea>
              </div>
              
              <input type="hidden" id="editSongId">
              
              <div class="modal-buttons">
                <button type="submit" class="btn btn-save">Save Changes</button>
                <button type="button" onclick="closeEditModal()" class="btn btn-cancel">Cancel</button>
              </div>
            </form>
          </div>
        </div>
        
        <script>
          let currentSongs = ${JSON.stringify(songs.map(s => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            description: s.description,
            uploaded: s.uploaded
          })))};
          
          function filterSongs(filter = '') {
            const searchInput = document.getElementById('searchInput');
            const searchTerm = searchInput.value.toLowerCase();
            const songRows = document.querySelectorAll('.song-row');
            
            songRows.forEach(row => {
              const title = row.querySelector('h3').textContent.toLowerCase();
              const artist = row.querySelector('p').textContent.toLowerCase();
              
              const matchesSearch = title.includes(searchTerm) || 
                                   artist.includes(searchTerm) ||
                                   searchTerm === '';
              
              row.style.display = matchesSearch ? '' : 'none';
            });
            
            // If filter is specified, sort the songs
            if (filter === 'recent') {
              sortSongs('recent');
            } else if (filter === 'oldest') {
              sortSongs('oldest');
            }
          }
          
          function sortSongs(order) {
            const container = document.getElementById('songsList');
            const rows = Array.from(container.querySelectorAll('.song-row'));
            
            rows.sort((a, b) => {
              const aId = a.querySelector('button').getAttribute('onclick').split("'")[1];
              const bId = b.querySelector('button').getAttribute('onclick').split("'")[1];
              
              const aSong = currentSongs.find(s => s.id === aId);
              const bSong = currentSongs.find(s => s.id === bId);
              
              if (order === 'recent') {
                return bSong.uploaded - aSong.uploaded;
              } else {
                return aSong.uploaded - bSong.uploaded;
              }
            });
            
            rows.forEach(row => container.appendChild(row));
          }
          
          function editSong(songId) {
            const song = currentSongs.find(s => s.id === songId);
            if (!song) return;
            
            document.getElementById('editTitle').value = song.title;
            document.getElementById('editArtist').value = song.artist;
            document.getElementById('editDescription').value = song.description;
            document.getElementById('editSongId').value = songId;
            
            document.getElementById('editModal').style.display = 'flex';
          }
          
          function closeEditModal() {
            document.getElementById('editModal').style.display = 'none';
            document.getElementById('editForm').reset();
          }
          
          async function saveSongChanges(event) {
            event.preventDefault();
            
            const songId = document.getElementById('editSongId').value;
            const title = document.getElementById('editTitle').value;
            const artist = document.getElementById('editArtist').value;
            const description = document.getElementById('editDescription').value;
            
            const response = await fetch('/manage/update', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                songId,
                title,
                artist,
                description
              })
            });
            
            const result = await response.json();
            
            if (result.success) {
              alert('Song updated successfully!');
              location.reload();
            } else {
              alert('Error: ' + result.error);
            }
          }
          
          async function deleteSong(songId) {
            if (!confirm('Are you sure you want to delete this song? This cannot be undone.')) {
              return;
            }
            
            const response = await fetch('/manage/delete', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ songId })
            });
            
            const result = await response.json();
            
            if (result.success) {
              alert('Song deleted successfully!');
              location.reload();
            } else {
              alert('Error deleting song: ' + result.error);
            }
          }
          
          // Handle album checkbox changes with debouncing
          let albumUpdateTimeout = null;
          const albumCheckboxes = document.querySelectorAll('.album-checkbox');
          
          albumCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
              const songId = this.getAttribute('data-song');
              const albumId = this.value;
              const isChecked = this.checked;
              
              // Clear any pending update
              if (albumUpdateTimeout) {
                clearTimeout(albumUpdateTimeout);
              }
              
              // Debounce the update to prevent too many requests
              albumUpdateTimeout = setTimeout(async () => {
                const response = await fetch('/manage/update-albums', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    songId,
                    albumUpdates: { [albumId]: isChecked }
                  })
                });
                
                const result = await response.json();
                if (!result.success) {
                  alert('Error updating album assignment');
                  // Revert the checkbox
                  this.checked = !isChecked;
                }
              }, 500);
            });
          });
          
          // Close modal when clicking outside
          document.getElementById('editModal').addEventListener('click', function(e) {
            if (e.target === this) {
              closeEditModal();
            }
          });
          
          // Initialize
          filterSongs();
        </script>
      </body>
      </html>
      `;
      
      return new Response(html, { 
        headers: { 
          ...CORS_HEADERS, 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300" // Cache for 5 minutes
        } 
      });
    }

    // =========================
    // UPDATE SONG HANDLER (POST)
    // =========================
    if (path === "/manage/update" && req.method === "POST") {
      try {
        const data = await req.json();
        const { songId, title, artist, description } = data;
        
        if (!songId || !title || !artist) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing required fields" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
        
        const result = await updateSong(env, songId, { title, artist, description });
        
        return new Response(JSON.stringify(result), { 
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
    // DELETE SONG HANDLER (POST)
    // =========================
    if (path === "/manage/delete" && req.method === "POST") {
      try {
        const data = await req.json();
        const { songId } = data;
        
        if (!songId) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing song ID" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
        
        const result = await deleteSong(env, songId);
        
        return new Response(JSON.stringify(result), { 
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
    // UPDATE SONG ALBUMS HANDLER (POST)
    // =========================
    if (path === "/manage/update-albums" && req.method === "POST") {
      try {
        const data = await req.json();
        const { songId, albumUpdates } = data;
        
        if (!songId || !albumUpdates) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing required data" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
        
        const result = await updateSongAlbums(songId, albumUpdates);
        
        return new Response(JSON.stringify(result), { 
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
    // === NEW FEATURE END ===

    // === ENHANCED ARTIST MANAGEMENT FEATURE START ===
    // =========================
    // ARTIST MANAGEMENT FEATURE
    // =========================

    // Helper functions for artist management
    const getAllArtistsWithSongs = async (env) => {
      const artists = await getArtists();
      const allSongs = await getAllSongs(env);
      
      const artistList = Object.values(artists).sort((a, b) => b.created - a.created);
      
      // Enrich each artist with their songs details
      const enrichedArtists = await Promise.all(artistList.map(async artist => {
        const songDetails = await Promise.all(artist.songs.map(async songKey => {
          const audioObj = await env.media.get(`songs/${songKey}.mp3`);
          if (!audioObj) return null;
          
          const [artistName, ...titleParts] = songKey.split("_");
          const title = titleParts.join(" ");
          
          return {
            id: songKey,
            title: title,
            artist: artistName,
            audioUrl: `/songs/${encodeURIComponent(songKey + ".mp3")}`
          };
        }));
        
        // Get artist thumbnail URL if exists
        let thumbnailUrl = "/images/placeholder.jpg";
        if (artist.thumbnail) {
          const thumbObj = await env.media.get(artist.thumbnail);
          if (thumbObj) {
            const ext = artist.thumbnail.split(".").pop();
            thumbnailUrl = `/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}`;
          }
        }
        
        // Get all available songs for assignment
        const availableSongs = allSongs.filter(song => 
          !artist.songs.includes(song.id)
        );
        
        return {
          ...artist,
          songDetails: songDetails.filter(s => s !== null),
          thumbnailUrl: thumbnailUrl,
          availableSongs: availableSongs,
          songCount: artist.songs.length
        };
      }));
      
      return enrichedArtists;
    };

    const deleteArtist = async (artistId) => {
      try {
        const artists = await getArtists();
        
        if (!artists[artistId]) {
          return { success: false, error: "Artist not found" };
        }
        
        // Check if artist has songs
        if (artists[artistId].songs.length > 0) {
          return { 
            success: false, 
            error: "Cannot delete artist with assigned songs. Please reassign or delete songs first." 
          };
        }
        
        // Delete artist thumbnail if exists
        if (artists[artistId].thumbnail) {
          await env.media.delete(artists[artistId].thumbnail);
        }
        
        // Delete artist record
        delete artists[artistId];
        await saveArtists(artists);
        
        // Clear homepage cache
        homepageCache = null;
        cacheTimestamp = 0;
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    const updateArtist = async (artistId, updates) => {
      try {
        const { name, description } = updates;
        
        if (!name) {
          return { success: false, error: "Artist name is required" };
        }
        
        const artists = await getArtists();
        
        if (!artists[artistId]) {
          return { success: false, error: "Artist not found" };
        }
        
        // Check if name changed and new name already exists
        const newArtistId = sanitize(name);
        if (newArtistId !== artistId && artists[newArtistId]) {
          return { success: false, error: "An artist with this name already exists" };
        }
        
        if (newArtistId !== artistId) {
          // Rename artist - need to update all references
          const artist = artists[artistId];
          artist.name = name;
          artist.id = newArtistId;
          
          // Update thumbnail key if exists
          if (artist.thumbnail) {
            const oldThumbKey = artist.thumbnail;
            const ext = oldThumbKey.split(".").pop();
            const newThumbKey = `artists/thumbnails/${newArtistId}.${ext}`;
            
            // Copy and delete old thumbnail
            const thumbObj = await env.media.get(oldThumbKey);
            if (thumbObj) {
              await env.media.put(newThumbKey, thumbObj.body);
              await env.media.delete(oldThumbKey);
            }
            artist.thumbnail = newThumbKey;
          }
          
          // Update artist record
          artists[newArtistId] = artist;
          delete artists[artistId];
          
          // Update all songs to use new artist name
          const allSongs = await getAllSongs(env);
          for (const song of allSongs) {
            if (song.artist === artists[artistId]?.name) {
              // This song belongs to the renamed artist
              const newSongKey = newArtistId + "_" + song.title.replace(/ /g, "_");
              
              if (newSongKey !== song.id) {
                // Rename song files
                const oldAudioKey = `songs/${song.id}.mp3`;
                const newAudioKey = `songs/${newSongKey}.mp3`;
                
                const oldDescKey = `descriptions/${song.id}.txt`;
                const newDescKey = `descriptions/${newSongKey}.txt`;
                
                // Copy and delete old files
                const audioObj = await env.media.get(oldAudioKey);
                if (audioObj) {
                  await env.media.put(newAudioKey, audioObj.body);
                  await env.media.delete(oldAudioKey);
                }
                
                // Copy description
                const descObj = await env.media.get(oldDescKey);
                if (descObj) {
                  await env.media.put(newDescKey, descObj.body);
                  await env.media.delete(oldDescKey);
                }
                
                // Copy images
                const oldJpgKey = `images/${song.id}.jpg`;
                const newJpgKey = `images/${newSongKey}.jpg`;
                const jpgObj = await env.media.get(oldJpgKey);
                if (jpgObj) {
                  await env.media.put(newJpgKey, jpgObj.body);
                  await env.media.delete(oldJpgKey);
                }
                
                const oldPngKey = `images/${song.id}.png`;
                const newPngKey = `images/${newSongKey}.png`;
                const pngObj = await env.media.get(oldPngKey);
                if (pngObj) {
                  await env.media.put(newPngKey, pngObj.body);
                  await env.media.delete(oldPngKey);
                }
                
                // Update album references
                const albums = await getAlbums();
                let albumsModified = false;
                
                for (const albumId in albums) {
                  const index = albums[albumId].songs.indexOf(song.id);
                  if (index !== -1) {
                    albums[albumId].songs[index] = newSongKey;
                    albumsModified = true;
                  }
                }
                
                if (albumsModified) {
                  await saveAlbums(albums);
                }
                
                // Update artist's songs list
                artist.songs = artist.songs.map(s => s === song.id ? newSongKey : s);
              }
            }
          }
          
          artists[newArtistId].songs = artist.songs;
        } else {
          // Only update description and name (if case changed)
          artists[artistId].name = name;
          artists[artistId].description = description || "";
        }
        
        await saveArtists(artists);
        
        // Clear homepage cache
        homepageCache = null;
        cacheTimestamp = 0;
        
        return { 
          success: true, 
          newId: newArtistId !== artistId ? newArtistId : artistId 
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    const updateArtistSongs = async (artistId, songUpdates) => {
      try {
        const artists = await getArtists();
        const allSongs = await getAllSongs(env);
        
        if (!artists[artistId]) {
          return { success: false, error: "Artist not found" };
        }
        
        let modified = false;
        
        // Process song assignments
        for (const songId in songUpdates) {
          const shouldBeAssigned = songUpdates[songId] === true;
          const songIndex = artists[artistId].songs.indexOf(songId);
          
          if (shouldBeAssigned && songIndex === -1) {
            // Add song to artist
            artists[artistId].songs.push(songId);
            modified = true;
            
            // Remove from other artists
            for (const otherArtistId in artists) {
              if (otherArtistId !== artistId) {
                const otherIndex = artists[otherArtistId].songs.indexOf(songId);
                if (otherIndex !== -1) {
                  artists[otherArtistId].songs.splice(otherIndex, 1);
                }
              }
            }
            
            // Update song file if artist name doesn't match
            const song = allSongs.find(s => s.id === songId);
            if (song && song.artist !== artists[artistId].name) {
              const newSongKey = sanitize(artists[artistId].name) + "_" + song.title.replace(/ /g, "_");
              
              if (newSongKey !== songId) {
                // Rename song files to match new artist
                const oldAudioKey = `songs/${songId}.mp3`;
                const newAudioKey = `songs/${newSongKey}.mp3`;
                
                const oldDescKey = `descriptions/${songId}.txt`;
                const newDescKey = `descriptions/${newSongKey}.txt`;
                
                // Copy and delete old files
                const audioObj = await env.media.get(oldAudioKey);
                if (audioObj) {
                  await env.media.put(newAudioKey, audioObj.body);
                  await env.media.delete(oldAudioKey);
                }
                
                // Copy description
                const descObj = await env.media.get(oldDescKey);
                if (descObj) {
                  await env.media.put(newDescKey, descObj.body);
                  await env.media.delete(oldDescKey);
                }
                
                // Copy images
                const oldJpgKey = `images/${songId}.jpg`;
                const newJpgKey = `images/${newSongKey}.jpg`;
                const jpgObj = await env.media.get(oldJpgKey);
                if (jpgObj) {
                  await env.media.put(newJpgKey, jpgObj.body);
                  await env.media.delete(oldJpgKey);
                }
                
                const oldPngKey = `images/${songId}.png`;
                const newPngKey = `images/${newSongKey}.png`;
                const pngObj = await env.media.get(oldPngKey);
                if (pngObj) {
                  await env.media.put(newPngKey, pngObj.body);
                  await env.media.delete(oldPngKey);
                }
                
                // Update album references
                const albums = await getAlbums();
                let albumsModified = false;
                
                for (const albumId in albums) {
                  const index = albums[albumId].songs.indexOf(songId);
                  if (index !== -1) {
                    albums[albumId].songs[index] = newSongKey;
                    albumsModified = true;
                  }
                }
                
                if (albumsModified) {
                  await saveAlbums(albums);
                }
                
                // Update artist's songs list with new key
                const newIndex = artists[artistId].songs.indexOf(songId);
                if (newIndex !== -1) {
                  artists[artistId].songs[newIndex] = newSongKey;
                }
                
                // Remove old key from other artists
                for (const otherArtistId in artists) {
                  if (otherArtistId !== artistId) {
                    const otherIndex = artists[otherArtistId].songs.indexOf(songId);
                    if (otherIndex !== -1) {
                      artists[otherArtistId].songs.splice(otherIndex, 1);
                    }
                  }
                }
              }
            }
          } else if (!shouldBeAssigned && songIndex !== -1) {
            // Remove song from artist
            artists[artistId].songs.splice(songIndex, 1);
            modified = true;
          }
        }
        
        if (modified) {
          await saveArtists(artists);
          // Clear homepage cache
          homepageCache = null;
          cacheTimestamp = 0;
        }
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    // =========================
    // ARTIST MANAGEMENT PAGE (GET)
    // =========================
    if (path === "/manage-artist" && req.method === "GET") {
      const artists = await getAllArtistsWithSongs(env);
      const allSongs = await getAllSongs(env);
      
      const artistRows = artists.map(artist => {
        const availableSongsOptions = artist.availableSongs.map(song => {
          return `
            <option value="${song.id}">${song.title} (by ${song.artist})</option>
          `;
        }).join("");
        
        const assignedSongsList = artist.songDetails.map(song => {
          return `
            <div class="assigned-song" style="display:flex; justify-content:space-between; align-items:center; padding:5px 10px; margin-bottom:5px; background:#f8f9fa; border-radius:4px;">
              <span>${song.title}</span>
              <button type="button" onclick="removeSongFromArtist('${artist.id}', '${song.id}')" 
                      class="btn btn-remove" style="padding:2px 8px; font-size:0.8rem;">Remove</button>
            </div>
          `;
        }).join("");
        
        return `
          <div class="artist-row" style="border:1px solid #ddd; border-radius:8px; padding:15px; margin-bottom:15px; background:#fff;">
            <div style="display:flex; flex-wrap:wrap; gap:15px; align-items:flex-start;">
              <div style="flex:1; min-width:200px; text-align:center;">
                <img src="${artist.thumbnailUrl}" alt="${artist.name}" 
                     style="width:150px; height:150px; object-fit:cover; border-radius:50%; margin-bottom:10px;">
                <h3 style="margin:0 0 5px 0;">${artist.name}</h3>
                <p style="margin:0 0 10px 0; color:#666; font-size:0.9em;">
                  ${artist.songCount} song${artist.songCount !== 1 ? 's' : ''}
                </p>
                <div style="margin-top:10px;">
                  <button onclick="editArtist('${artist.id}')" class="btn btn-edit">Edit</button>
                  <button onclick="deleteArtist('${artist.id}')" class="btn btn-delete">Delete</button>
                  <a href="/artist/${artist.id}" target="_blank" class="btn btn-view">View</a>
                </div>
              </div>
              
              <div style="flex:2; min-width:300px;">
                <div style="margin-bottom:15px;">
                  <strong>Description:</strong>
                  <p style="margin:5px 0; font-size:0.9em; color:#555; max-height:100px; overflow-y:auto; padding:5px; background:#f9f9f9; border-radius:4px;">
                    ${artist.description || '<em>No description</em>'}
                  </p>
                </div>
                
                <div style="margin-bottom:15px;">
                  <strong>Assigned Songs:</strong>
                  <div style="margin-top:5px; padding:10px; background:#f9f9f9; border-radius:4px; max-height:200px; overflow-y:auto;">
                    ${assignedSongsList || '<p style="margin:0; color:#888;"><em>No songs assigned</em></p>'}
                  </div>
                </div>
                
                <div>
                  <strong>Assign New Song:</strong>
                  <div style="display:flex; gap:10px; margin-top:5px;">
                    <select id="songSelect_${artist.id}" class="song-select" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:4px;">
                      <option value="">-- Select a song --</option>
                      ${availableSongsOptions}
                    </select>
                    <button onclick="assignSongToArtist('${artist.id}')" class="btn btn-assign">Assign</button>
                  </div>
                  <p style="margin:5px 0 0 0; font-size:0.8em; color:#666;">
                    Assign existing songs to this artist
                  </p>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");
      
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Manage Artists</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
          }
          
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          
          h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 2rem;
          }
          
          .subtitle {
            color: #7f8c8d;
            margin-bottom: 20px;
          }
          
          .nav-links {
            display: flex;
            justify-content: center;
            gap: 15px;
            flex-wrap: wrap;
            margin-top: 15px;
          }
          
          .nav-links a {
            color: #3498db;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 5px;
            transition: background-color 0.2s;
          }
          
          .nav-links a:hover {
            background-color: #f0f7ff;
          }
          
          .stats {
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
            margin: 20px 0;
          }
          
          .stat-card {
            background: #fff;
            padding: 15px 25px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            min-width: 150px;
          }
          
          .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #3498db;
            margin-bottom: 5px;
          }
          
          .stat-label {
            font-size: 0.9rem;
            color: #7f8c8d;
          }
          
          .artists-container {
            margin-top: 20px;
          }
          
          .controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 20px;
            padding: 15px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          }
          
          .search-box {
            flex: 1;
            min-width: 200px;
            padding: 10px 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 1rem;
          }
          
          .filter-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          
          .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
            text-align: center;
          }
          
          .btn-edit {
            background: #3498db;
            color: white;
          }
          
          .btn-delete {
            background: #e74c3c;
            color: white;
          }
          
          .btn-view {
            background: #2ecc71;
            color: white;
          }
          
          .btn-assign {
            background: #9b59b6;
            color: white;
          }
          
          .btn-remove {
            background: #e67e22;
            color: white;
          }
          
          .btn-save {
            background: #2ecc71;
            color: white;
          }
          
          .btn-cancel {
            background: #95a5a6;
            color: white;
          }
          
          .btn:hover {
            opacity: 0.9;
            transform: translateY(-1px);
          }
          
          .btn:active {
            transform: translateY(0);
          }
          
          .loading {
            text-align: center;
            padding: 40px;
            color: #7f8c8d;
          }
          
          .empty-state {
            text-align: center;
            padding: 40px;
            background: #fff;
            border-radius: 10px;
            color: #7f8c8d;
          }
          
          .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
          }
          
          .modal-content {
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
          }
          
          .modal h2 {
            margin-bottom: 20px;
            color: #2c3e50;
          }
          
          .form-group {
            margin-bottom: 20px;
          }
          
          .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #2c3e50;
          }
          
          .form-group input,
          .form-group textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 1rem;
          }
          
          .form-group textarea {
            min-height: 100px;
            resize: vertical;
          }
          
          .modal-buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 20px;
          }
          
          .song-select {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 0.9rem;
          }
          
          .assigned-song {
            transition: background-color 0.2s;
          }
          
          .assigned-song:hover {
            background-color: #e9ecef;
          }
          
          @media (max-width: 768px) {
            .header {
              padding: 15px;
            }
            
            h1 {
              font-size: 1.5rem;
            }
            
            .stat-card {
              min-width: 120px;
              padding: 12px 15px;
            }
            
            .stat-number {
              font-size: 1.5rem;
            }
            
            .controls {
              flex-direction: column;
              align-items: stretch;
            }
            
            .search-box {
              width: 100%;
            }
            
            .filter-buttons {
              justify-content: center;
            }
            
            .artist-row > div {
              flex-direction: column;
            }
            
            .modal-content {
              padding: 20px;
              width: 95%;
            }
          }
          
          @media (max-width: 480px) {
            body {
              padding: 10px;
            }
            
            .nav-links {
              flex-direction: column;
              align-items: center;
            }
            
            .nav-links a {
              width: 100%;
              text-align: center;
            }
            
            .stats {
              gap: 10px;
            }
            
            .stat-card {
              min-width: 100px;
              padding: 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Artist Management</h1>
          <p class="subtitle">Edit, delete, and assign songs to artists</p>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-number">${artists.length}</div>
              <div class="stat-label">Total Artists</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${allSongs.length}</div>
              <div class="stat-label">Total Songs</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${artists.reduce((sum, artist) => sum + artist.songCount, 0)}</div>
              <div class="stat-label">Assigned Songs</div>
            </div>
          </div>
          
          <div class="nav-links">
            <a href="/">← Home</a>
            <a href="/manage">Manage Songs</a>
            <a href="/artist/create">Create New Artist</a>
            <a href="/artist">View All Artists</a>
            <a href="/upload">Upload New Song</a>
          </div>
        </div>
        
        <div class="controls">
          <input type="text" id="searchInput" class="search-box" placeholder="Search artists by name..." 
             onkeyup="filterArtists()">
          <div class="filter-buttons">
            <button onclick="filterArtists('all')" class="btn">All Artists</button>
            <button onclick="filterArtists('mostSongs')" class="btn">Most Songs First</button>
            <button onclick="filterArtists('recent')" class="btn">Recent First</button>
          </div>
        </div>
        
        <div class="artists-container" id="artistsList">
          ${artists.length > 0 ? artistRows : `
            <div class="empty-state">
              <h3>No artists found</h3>
              <p>Create your first artist to get started!</p>
              <a href="/artist/create" class="btn" style="margin-top:15px;">Create Artist</a>
            </div>
          `}
        </div>
        
        <div id="editModal" class="modal">
          <div class="modal-content">
            <h2>Edit Artist</h2>
            <form id="editForm" onsubmit="saveArtistChanges(event)">
              <div class="form-group">
                <label for="editName">Artist Name</label>
                <input type="text" id="editName" required>
              </div>
              
              <div class="form-group">
                <label for="editDescription">Description</label>
                <textarea id="editDescription"></textarea>
              </div>
              
              <input type="hidden" id="editArtistId">
              
              <div class="modal-buttons">
                <button type="submit" class="btn btn-save">Save Changes</button>
                <button type="button" onclick="closeEditModal()" class="btn btn-cancel">Cancel</button>
              </div>
            </form>
          </div>
        </div>
        
        <script>
          let currentArtists = ${JSON.stringify(artists.map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            created: a.created,
            songCount: a.songCount
          })))};
          
          function filterArtists(filter = '') {
            const searchInput = document.getElementById('searchInput');
            const searchTerm = searchInput.value.toLowerCase();
            const artistRows = document.querySelectorAll('.artist-row');
            
            artistRows.forEach(row => {
              const name = row.querySelector('h3').textContent.toLowerCase();
              const matchesSearch = name.includes(searchTerm) || searchTerm === '';
              
              row.style.display = matchesSearch ? '' : 'none';
            });
            
            // If filter is specified, sort the artists
            if (filter === 'mostSongs') {
              sortArtists('mostSongs');
            } else if (filter === 'recent') {
              sortArtists('recent');
            }
          }
          
          function sortArtists(order) {
            const container = document.getElementById('artistsList');
            const rows = Array.from(container.querySelectorAll('.artist-row'));
            
            rows.sort((a, b) => {
              const aId = a.querySelector('button').getAttribute('onclick').split("'")[1];
              const bId = b.querySelector('button').getAttribute('onclick').split("'")[1];
              
              const aArtist = currentArtists.find(artist => artist.id === aId);
              const bArtist = currentArtists.find(artist => artist.id === bId);
              
              if (order === 'mostSongs') {
                return bArtist.songCount - aArtist.songCount;
              } else if (order === 'recent') {
                return bArtist.created - aArtist.created;
              } else {
                return aArtist.name.localeCompare(bArtist.name);
              }
            });
            
            rows.forEach(row => container.appendChild(row));
          }
          
          function editArtist(artistId) {
            const artist = currentArtists.find(a => a.id === artistId);
            if (!artist) return;
            
            document.getElementById('editName').value = artist.name;
            document.getElementById('editDescription').value = artist.description || '';
            document.getElementById('editArtistId').value = artistId;
            
            document.getElementById('editModal').style.display = 'flex';
          }
          
          function closeEditModal() {
            document.getElementById('editModal').style.display = 'none';
            document.getElementById('editForm').reset();
          }
          
          async function saveArtistChanges(event) {
            event.preventDefault();
            
            const artistId = document.getElementById('editArtistId').value;
            const name = document.getElementById('editName').value;
            const description = document.getElementById('editDescription').value;
            
            const response = await fetch('/manage-artist/update', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                artistId,
                name,
                description
              })
            });
            
            const result = await response.json();
            
            if (result.success) {
              alert('Artist updated successfully!');
              location.reload();
            } else {
              alert('Error: ' + result.error);
            }
          }
          
          async function deleteArtist(artistId) {
            if (!confirm('Are you sure you want to delete this artist? Songs will need to be reassigned first.')) {
              return;
            }
            
            const response = await fetch('/manage-artist/delete', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ artistId })
            });
            
            const result = await response.json();
            
            if (result.success) {
              alert('Artist deleted successfully!');
              location.reload();
            } else {
              alert('Error deleting artist: ' + result.error);
            }
          }
          
          async function assignSongToArtist(artistId) {
            const select = document.getElementById('songSelect_' + artistId);
            const songId = select.value;
            
            if (!songId) {
              alert('Please select a song first');
              return;
            }
            
            const response = await fetch('/manage-artist/assign-song', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                artistId,
                songId
              })
            });
            
            const result = await response.json();
            
            if (result.success) {
              alert('Song assigned to artist successfully!');
              location.reload();
            } else {
              alert('Error assigning song: ' + result.error);
            }
          }
          
          async function removeSongFromArtist(artistId, songId) {
            if (!confirm('Are you sure you want to remove this song from the artist?')) {
              return;
            }
            
            const response = await fetch('/manage-artist/remove-song', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                artistId,
                songId
              })
            });
            
            const result = await response.json();
            
            if (result.success) {
              alert('Song removed from artist successfully!');
              location.reload();
            } else {
              alert('Error removing song: ' + result.error);
            }
          }
          
          // Close modal when clicking outside
          document.getElementById('editModal').addEventListener('click', function(e) {
            if (e.target === this) {
              closeEditModal();
            }
          });
          
          // Initialize
          filterArtists();
        </script>
      </body>
      </html>
      `;
      
      return new Response(html, { 
        headers: { 
          ...CORS_HEADERS, 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300" // Cache for 5 minutes
        } 
      });
    }

    // =========================
    // UPDATE ARTIST HANDLER (POST)
    // =========================
    if (path === "/manage-artist/update" && req.method === "POST") {
      try {
        const data = await req.json();
        const { artistId, name, description } = data;
        
        if (!artistId || !name) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing required fields" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
        
        const result = await updateArtist(artistId, { name, description });
        
        return new Response(JSON.stringify(result), { 
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
    // DELETE ARTIST HANDLER (POST)
    // =========================
    if (path === "/manage-artist/delete" && req.method === "POST") {
      try {
        const data = await req.json();
        const { artistId } = data;
        
        if (!artistId) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing artist ID" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
        
        const result = await deleteArtist(artistId);
        
        return new Response(JSON.stringify(result), { 
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
    // ASSIGN SONG TO ARTIST HANDLER (POST)
    // =========================
    if (path === "/manage-artist/assign-song" && req.method === "POST") {
      try {
        const data = await req.json();
        const { artistId, songId } = data;
        
        if (!artistId || !songId) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing required data" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
        
        const result = await updateArtistSongs(artistId, { [songId]: true });
        
        return new Response(JSON.stringify(result), { 
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
    // REMOVE SONG FROM ARTIST HANDLER (POST)
    // =========================
    if (path === "/manage-artist/remove-song" && req.method === "POST") {
      try {
        const data = await req.json();
        const { artistId, songId } = data;
        
        if (!artistId || !songId) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Missing required data" 
          }), { 
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
          });
        }
        
        const result = await updateArtistSongs(artistId, { [songId]: false });
        
        return new Response(JSON.stringify(result), { 
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
    // === ENHANCED ARTIST MANAGEMENT FEATURE END ===

    return new Response("Not found", { status: 404 });
  }
};