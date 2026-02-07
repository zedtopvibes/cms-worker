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
    // Helper to sanitize filenames
    // -----------------------------
    const sanitize = str => str.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");

    // === NEW FEATURE START ===
    // Album storage helper functions
    const getAlbums = async () => {
      try {
        const albumsObj = await env.media.get("albums/index.json");
        if (!albumsObj) return {};
        const text = await albumsObj.text();
        return JSON.parse(text || "{}");
      } catch (e) {
        return {};
      }
    };

    const saveAlbums = async (albums) => {
      await env.media.put("albums/index.json", JSON.stringify(albums));
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
      const getArtists = async () => {
        try {
          const artistsObj = await env.media.get("artists/index.json");
          if (!artistsObj) return {};
          const text = await artistsObj.text();
          return JSON.parse(text || "{}");
        } catch (e) {
          return {};
        }
      };
      
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
        const getArtists = async () => {
          try {
            const artistsObj = await env.media.get("artists/index.json");
            if (!artistsObj) return {};
            const text = await artistsObj.text();
            return JSON.parse(text || "{}");
          } catch (e) {
            return {};
          }
        };
        
        const saveArtists = async (artists) => {
          await env.media.put("artists/index.json", JSON.stringify(artists));
        };
        
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
      const getArtists = async () => {
        try {
          const artistsObj = await env.media.get("artists/index.json");
          if (!artistsObj) return {};
          const text = await artistsObj.text();
          return JSON.parse(text || "{}");
        } catch (e) {
          return {};
        }
      };
      
      const saveArtists = async (artists) => {
        await env.media.put("artists/index.json", JSON.stringify(artists));
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
      
      await addSongToArtist(artistId, baseName);
      // === ARTISTS FEATURE END ===

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
        return new Response(html, { headers: { "Content-Type": "text/html" } });
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
        const pngObj = await env.media.get(`images/${songKey}.png`);
        if (jpgObj) thumbUrl = `/images/${encodeURIComponent(songKey)}.jpg`;
        else if (pngObj) thumbUrl = `/images/${encodeURIComponent(songKey)}.png`;

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
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }
    // === NEW FEATURE END ===

    // === ARTISTS FEATURE START ===
    // =========================
    // ARTISTS HELPER FUNCTIONS
    // =========================
    const getArtists = async () => {
      try {
        const artistsObj = await env.media.get("artists/index.json");
        if (!artistsObj) return {};
        const text = await artistsObj.text();
        return JSON.parse(text || "{}");
      } catch (e) {
        return {};
      }
    };

    const saveArtists = async (artists) => {
      await env.media.put("artists/index.json", JSON.stringify(artists));
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
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      }

      // Single artist page
      const artists = await getArtists();
      const artist = artists[artistId];
      
      if (!artist) {
        return new Response("Artist not found", { status: 404 });
      }

      // Get artist songs
      const songList = await Promise.all(artist.songs.map(async songKey => {
        const audioObj = await env.media.get(`songs/${songKey}.mp3`);
        if (!audioObj) return null;

        const [songArtist, ...titleParts] = songKey.split("_");
        const title = titleParts.join(" ");

        let thumbUrl = "/images/placeholder.jpg";
        const jpgObj = await env.media.get(`images/${songKey}.jpg`);
        const pngObj = await env.media.get(`images/${songKey}.png`);
        if (jpgObj) thumbUrl = `/images/${encodeURIComponent(songKey)}.jpg`;
        else if (pngObj) thumbUrl = `/images/${encodeURIComponent(songKey)}.png`;

        return `
          <div class="song" style="display:flex;align-items:center;margin-bottom:10px; padding:10px; background:#fff; border-radius:8px;">
            <img src="${thumbUrl}" alt="${title}" style="width:60px;height:60px;object-fit:cover;margin-right:10px;border-radius:8px;">
            <div style="flex-grow:1;">
              <a href="/song/${encodeURIComponent(songKey + ".mp3")}" style="font-weight:bold;">${title}</a>
              <br>
              <small>${songArtist}</small>
            </div>
          </div>
        `;
      }));

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
          .songs-list { max-width:600px; margin:0 auto; }
          img { max-width:100%; height:auto; border-radius:8px; }
        </style>
      </head>
      <body>
        <div class="artist-header">
          <h1>${artist.name}</h1>
          ${artistThumb}
          <p>${artist.description}</p>
          <p><small>Created: ${new Date(artist.created).toLocaleDateString()}</small></p>
          <p>
            <a href="/artist">← All Artists</a> | 
            <a href="/">Home</a> | 
            <a href="/upload">Upload</a>
          </p>
        </div>
        
        <div class="songs-list">
          <h2>Songs (${artist.songs.length})</h2>
          ${songList.filter(s => s).join("")}
          ${artist.songs.length === 0 ? '<p>No songs by this artist yet.</p>' : ''}
        </div>
      </body>
      </html>
      `;
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    // =========================
    // SERVE ARTIST THUMBNAILS
    // =========================
    if (path.startsWith("/artists/thumbnails/")) {
      const fileName = decodeURIComponent(path.slice(1));
      const obj = await env.media.get(fileName);
      if (!obj) return new Response("Artist thumbnail not found", { status: 404 });

      let contentType = "application/octet-stream";
      if (fileName.endsWith(".jpg")) contentType = "image/jpeg";
      else if (fileName.endsWith(".png")) contentType = "image/png";

      return new Response(obj.body, { headers: { "Content-Type": contentType } });
    }
    // === ARTISTS FEATURE END ===

    // =========================
    // HOMEPAGE
    // =========================
    if (path === "/") {
      const file = await env.media.get("index.html");
      if (!file) return new Response("index.html not found", { status: 500 });

      let html = await file.text();

      const list = await env.media.list({ prefix: "songs/", limit: 1000 });
      const files = list.objects || [];
      files.sort((a,b) => b.uploaded - a.uploaded);
      const latest = files.slice(0,10);

      const fmHtml = await Promise.all(latest.map(async f => {
        const fileName = f.key.split("/")[1];
        const baseName = fileName.replace(".mp3",""); // Remove .mp3 extension
        const [artist, ...titleParts] = baseName.split("_");
        const title = titleParts.join(" ");

        let thumbUrl = "/images/placeholder.jpg";
        // Look for images using the baseName (without .mp3)
        const jpgObj = await env.media.get(`images/${baseName}.jpg`);
        const pngObj = await env.media.get(`images/${baseName}.png`);
        if (jpgObj) thumbUrl = `/images/${encodeURIComponent(baseName)}.jpg`;
        else if (pngObj) thumbUrl = `/images/${encodeURIComponent(baseName)}.png`;

        return `<div class="song" style="display:flex;align-items:center;margin-bottom:10px;">
          <img src="${thumbUrl}" alt="${title}" style="width:80px;height:auto;margin-right:10px;border-radius:8px;">
          <a href="/song/${encodeURIComponent(fileName)}">${title}<br><small>${artist}</small></a>
        </div>`;
      }));

      html = html.replace(/\[fm\].*?\[\/fm\]/gs, fmHtml.join(""));

      // === NEW FEATURE START ===
      // Add albums section to homepage
      const albums = await getAlbums();
      const albumList = Object.values(albums).sort((a, b) => b.created - a.created).slice(0, 6); // Show latest 6 albums
      
      const albumsHtml = await Promise.all(albumList.map(async album => {
        let thumbUrl = "/images/placeholder.jpg";
        const thumbObj = await env.media.get(album.thumbnail);
        if (thumbObj) {
          const ext = album.thumbnail.split(".").pop();
          thumbUrl = `/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}`;
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

      // If there are albums, add the albums section after the latest songs section
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
        
        // Insert albums section before the footer
        html = html.replace('</section>', `</section>${albumsSection}`);
      }
      // === NEW FEATURE END ===

      // === ARTISTS FEATURE START ===
      // Add artists section to homepage
      const artists = await getArtists();
      const artistList = Object.values(artists).sort((a, b) => b.created - a.created).slice(0, 6); // Show latest 6 artists
      
      const artistsHtml = await Promise.all(artistList.map(async artist => {
        let thumbUrl = "/images/placeholder.jpg";
        if (artist.thumbnail) {
          const thumbObj = await env.media.get(artist.thumbnail);
          if (thumbObj) {
            const ext = artist.thumbnail.split(".").pop();
            thumbUrl = `/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}`;
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

      // If there are artists, add the artists section
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
        
        // Insert artists section after albums section
        html = html.replace('</section>', `</section>${artistsSection}`);
      }
      // === ARTISTS FEATURE END ===

      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    // =========================
    // SONG PAGE
    // =========================
    if (path.startsWith("/song/")) {
      const fileName = decodeURIComponent(path.replace("/song/",""));
      const baseName = fileName.replace(".mp3",""); // Remove .mp3 extension
      
      const audioObj = await env.media.get(`songs/${fileName}`);
      if (!audioObj) return new Response("Song not found", { status: 404 });

      const [artist, ...titleParts] = baseName.split("_");
      const title = titleParts.join(" ");

      let description = "";
      const descObj = await env.media.get(`descriptions/${baseName}.txt`);
      if (descObj) description = await descObj.text();

      let imgTag = "";
      // Look for images using the baseName (without .mp3)
      const jpgObj = await env.media.get(`images/${baseName}.jpg`);
      const pngObj = await env.media.get(`images/${baseName}.png`);
      if (jpgObj) imgTag = `<img src="/images/${encodeURIComponent(baseName)}.jpg" alt="${title}" style="max-width:300px;margin:10px 0;">`;
      else if (pngObj) imgTag = `<img src="/images/${encodeURIComponent(baseName)}.png" alt="${title}" style="max-width:300px;margin:10px 0;">`;

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
      return new Response(html, { headers: { "Content-Type": "text/html" } });
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
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    // =========================
    // SERVE SONGS AND IMAGES
    // =========================
    if (path.startsWith("/songs/") || path.startsWith("/images/")) {
      const fileName = decodeURIComponent(path.slice(1));
      const obj = await env.media.get(fileName);
      if (!obj) return new Response("File not found", { status: 404 });

      let contentType = "application/octet-stream";
      if (fileName.endsWith(".mp3")) contentType = "audio/mpeg";
      else if (fileName.endsWith(".jpg")) contentType = "image/jpeg";
      else if (fileName.endsWith(".png")) contentType = "image/png";

      return new Response(obj.body, { headers: { "Content-Type": contentType } });
    }

    // === NEW FEATURE START ===
    // =========================
    // SERVE ALBUM THUMBNAILS
    // =========================
    if (path.startsWith("/albums/thumbnails/")) {
      const fileName = decodeURIComponent(path.slice(1));
      const obj = await env.media.get(fileName);
      if (!obj) return new Response("Album thumbnail not found", { status: 404 });

      let contentType = "application/octet-stream";
      if (fileName.endsWith(".jpg")) contentType = "image/jpeg";
      else if (fileName.endsWith(".png")) contentType = "image/png";

      return new Response(obj.body, { headers: { "Content-Type": contentType } });
    }
    // === NEW FEATURE END ===

    // === ARTISTS FEATURE START ===
    // =========================
    // SERVE ARTIST THUMBNAILS (already added above)
    // =========================
    // This route handler is already defined above in the artists section
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
          
          return { success: true, newId: newBaseName };
        } else {
          // Only update description
          await env.media.put(`descriptions/${songId}.txt`, description || "");
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
      
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
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

    return new Response("Not found", { status: 404 });
  }
};