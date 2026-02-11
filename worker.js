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

    // === NEW: ALBUM-ARTIST ASSIGNMENT FUNCTIONS ===
    const addAlbumToArtist = async (artistId, albumId) => {
      const artists = await getArtists();
      if (artists[artistId]) {
        // Initialize albums array if it doesn't exist
        if (!artists[artistId].albums) {
          artists[artistId].albums = [];
        }
        // Add album if not already present
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

    // === FIXED: getArtistAlbumsAndSingles with CORRECT stats ===
    const getArtistAlbumsAndSingles = async (artistId) => {
      const artists = await getArtists();
      const albums = await getAlbums();
      const artist = artists[artistId];
      
      if (!artist) {
        return { albums: [], singles: [], totalSongs: 0, totalAlbums: 0, totalSingles: 0 };
      }
      
      // Get albums explicitly assigned to this artist
      const assignedAlbums = artist.albums || [];
      const artistAlbums = [];
      const albumSongIds = new Set();
      let totalSongsInAlbums = 0; // NEW: Track artist's songs in albums
      
      // Process explicitly assigned albums FIRST
      for (const albumId of assignedAlbums) {
        const album = albums[albumId];
        if (album) {
          const albumSongsByArtist = [];
          
          // Check each song in the album
          for (const songKey of album.songs) {
            const [songArtistId] = songKey.split("_");
            if (songArtistId === artistId) {
              albumSongsByArtist.push(songKey);
              albumSongIds.add(songKey);
            }
          }
          
          // Get album thumbnail
          let thumbUrl = "/images/placeholder.jpg";
          if (album.thumbnail) {
            try {
              const thumbObj = await env.media.get(album.thumbnail);
              if (thumbObj) {
                const ext = album.thumbnail.split(".").pop();
                thumbUrl = `/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}`;
              }
            } catch (e) {
              // Use placeholder if thumbnail not found or error
            }
          }
          
          // FIX: Count artist's songs in this album
          const artistSongCount = albumSongsByArtist.length;
          totalSongsInAlbums += artistSongCount;
          
          artistAlbums.push({
            id: albumId,
            title: album.title,
            description: album.description,
            thumbnail: thumbUrl,
            songCount: album.songs.length, // FIXED: Show TOTAL songs in album
            artistSongCount: artistSongCount, // NEW: Artist's songs count
            songs: albumSongsByArtist,
            created: album.created,
            explicitlyAssigned: true
          });
        }
      }
      
      // Also include albums that have this artist's songs (inferred albums)
      for (const albumId in albums) {
        // Skip if already in assigned albums
        if (assignedAlbums.includes(albumId)) continue;
        
        const album = albums[albumId];
        const albumSongsByArtist = [];
        
        // Check each song in the album
        for (const songKey of album.songs) {
          const [songArtistId] = songKey.split("_");
          if (songArtistId === artistId) {
            albumSongsByArtist.push(songKey);
            albumSongIds.add(songKey);
          }
        }
        
        if (albumSongsByArtist.length > 0) {
          // Get album thumbnail
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
          
          // FIX: Count artist's songs in this album
          const artistSongCount = albumSongsByArtist.length;
          totalSongsInAlbums += artistSongCount;
          
          artistAlbums.push({
            id: albumId,
            title: album.title,
            description: album.description,
            thumbnail: thumbUrl,
            songCount: album.songs.length, // FIXED: Show TOTAL songs in album
            artistSongCount: artistSongCount, // NEW: Artist's songs count
            songs: albumSongsByArtist,
            created: album.created,
            explicitlyAssigned: false
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
      
      // Sort singles by upload date
      const sortedSingles = await Promise.all(singles.map(async songKey => {
        try {
          const audioObj = await env.media.get(`songs/${songKey}.mp3`);
          const uploaded = audioObj ? audioObj.uploaded : Date.now();
          return {
            key: songKey,
            uploaded: uploaded
          };
        } catch (e) {
          return {
            key: songKey,
            uploaded: Date.now()
          };
        }
      }));
      
      sortedSingles.sort((a, b) => b.uploaded - a.uploaded);
      const singleKeys = sortedSingles.map(s => s.key);
      
      // FIXED: Calculate correct totals
      const totalSingles = singleKeys.length;
      const totalSongs = totalSingles + totalSongsInAlbums; // TRUE total
      
      return {
        albums: artistAlbums,
        singles: singleKeys,
        totalSongs: totalSongs, // FIXED: Includes both singles and album songs
        totalSongsInAlbums: totalSongsInAlbums, // NEW: For detailed stats
        totalSingles: totalSingles,
        totalAlbums: artistAlbums.length,
        assignedAlbumsCount: assignedAlbums.length
      };
    };

    // =========================
    // UPLOAD PAGE (GET)
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
        <title>Upload Song</title>
        <style>
          body { font-family: Arial,sans-serif; padding:50px; background:#f0f0f0; }
          form { display:flex; flex-direction:column; max-width:400px; margin:auto; }
          label { margin-top:10px; font-weight:bold; }
          input, textarea, select { padding:8px; margin-top:5px; }
          button { margin-top:20px; padding:10px; background:#28a745; color:#fff; border:none; cursor:pointer; border-radius:5px; }
          button:hover { background:#218838; }
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
          ${artistSection}
          <label>Description</label>
          <textarea name="description" rows="3" required></textarea>
          ${albumSection}
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
    // UPLOAD HANDLER (POST) - UPDATED
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
            albums: [] // NEW: Initialize albums array
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
        
        // === FIX: Automatically assign album to artist ===
        await addAlbumToArtist(artistId, albumId);
      }
      
      // Add song to artist
      await addSongToArtist(artistId, baseName);

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
        artists: [] // NEW: Initialize artists array
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
        albums: [] // NEW: Initialize albums array
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
    // ARTISTS PAGE WITH FIXED STATS
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

      // Single artist page with FIXED STATS
      const artists = await getArtists();
      const artist = artists[artistId];
      
      if (!artist) {
        return new Response("Artist not found", { status: 404 });
      }

      // Get artist's albums and singles WITH CORRECT STATS
      const { albums: artistAlbums, singles, totalSongs, totalSongsInAlbums, totalSingles, totalAlbums, assignedAlbumsCount } = await getArtistAlbumsAndSingles(artistId);

      // Get artist thumbnail
      let artistThumb = "";
      if (artist.thumbnail) {
        const thumbObj = await env.media.get(artist.thumbnail);
        if (thumbObj) {
          const ext = artist.thumbnail.split(".").pop();
          artistThumb = `<img src="/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}" alt="${artist.name}" style="width:200px; height:200px; object-fit:cover; border-radius:50%; margin:10px 0;">`;
        }
      }

      // Generate albums section with FIXED song counts
      let albumsSection = '';
      if (artistAlbums.length > 0) {
        const albumCards = artistAlbums.map(album => {
          const assignmentBadge = album.explicitlyAssigned ? 
            '<span style="background:#2ecc71; color:white; padding:2px 8px; border-radius:12px; font-size:0.7em; margin-left:5px;">Assigned</span>' : 
            '<span style="background:#95a5a6; color:white; padding:2px 8px; border-radius:12px; font-size:0.7em; margin-left:5px;">Inferred</span>';
          
          // Show total songs vs artist's songs
          const songCountText = album.artistSongCount === album.songCount ? 
            `${album.songCount} songs` :
            `${album.songCount} songs (${album.artistSongCount} by ${artist.name})`;
          
          return `
            <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin:10px; background:#fff; display:inline-block; width:180px; vertical-align:top;">
              <a href="/album/${album.id}">
                <img src="${album.thumbnail}" alt="${album.title}" style="width:100%; height:150px; object-fit:cover; border-radius:4px;">
              </a>
              <h3 style="margin:10px 0 5px 0; font-size:1rem;">
                <a href="/album/${album.id}" style="text-decoration:none; color:#333;">${album.title}</a>
                ${assignmentBadge}
              </h3>
              <p style="font-size:0.9em; color:#666; margin:0 0 5px 0;">${songCountText}</p>
            </div>
          `;
        }).join('');
        
        albumsSection = `
          <div style="margin-top:30px;">
            <h2>Albums (${totalAlbums}) 
              <small style="font-size:0.7em; color:#666;">
                (${assignedAlbumsCount || 0} explicitly assigned)
              </small>
            </h2>
            <div style="margin-top:15px; display:flex; flex-wrap:wrap; gap:15px; justify-content:center;">
              ${albumCards}
            </div>
            <p style="font-size:0.9em; color:#666; text-align:center; margin-top:10px;">
              <span style="background:#2ecc71; color:white; padding:2px 8px; border-radius:12px; font-size:0.8em;">Assigned</span> = Directly assigned to artist
              <span style="margin-left:15px; background:#95a5a6; color:white; padding:2px 8px; border-radius:12px; font-size:0.8em;">Inferred</span> = Contains artist's songs
            </p>
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

      // HTML with FIXED STATS
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
          .stat-subtext { font-size:0.7rem; color:#666; margin-top:3px; }
          img { max-width:100%; height:auto; border-radius:8px; }
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
              <div class="stat-subtext">${totalSongsInAlbums} in albums<br>${totalSingles} singles</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${totalAlbums}</div>
              <div class="stat-label">Albums</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${totalSingles}</div>
              <div class="stat-label">Singles</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${assignedAlbumsCount || 0}</div>
              <div class="stat-label">Assigned Albums</div>
            </div>
          </div>
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
          "Cache-Control": "public, max-age=300"
        } 
      });
    }

    // =========================
    // NEW DESIGN HOMEPAGE (ADDED FEATURE)
    // =========================
    if (path === "/new-design") {
      const now = Date.now();
      
      // Use cache if available
      if (homepageCache && (now - cacheTimestamp < CACHE_DURATION)) {
        return new Response(homepageCache, { 
          headers: { 
            "Content-Type": "text/html",
            "Cache-Control": "public, max-age=300"
          } 
        });
      }

      try {
        // Get latest albums
        const albums = await getAlbums();
        const albumList = Object.values(albums).sort((a, b) => b.created - a.created);
        
        // Get latest songs
        const list = await env.media.list({ prefix: "songs/", limit: 50 });
        const files = list.objects || [];
        files.sort((a,b) => b.uploaded - a.uploaded);
        const latestSongs = files.slice(0, 20);
        
        // Process latest songs for Latest Updates section
        const latestUpdatesHtml = await Promise.all(latestSongs.map(async (f, index) => {
          const fileName = f.key.split("/")[1];
          const baseName = fileName.replace(".mp3","");
          const [artist, ...titleParts] = baseName.split("_");
          const title = titleParts.join(" ");
          
          // Format date
          const date = new Date(f.uploaded);
          const formattedDate = date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
          
          return `
            <div class="update-item">
              <div class="update-content">
                <strong>${artist} - ${title}</strong>
                <span class="update-date">© ${formattedDate}</span>
              </div>
            </div>
          `;
        }));
        
        // Process albums for Latest 2024 Albums section
        const currentYear = new Date().getFullYear();
        const albums2024 = albumList.filter(album => {
          const albumYear = new Date(album.created).getFullYear();
          return albumYear === 2024 || albumYear === currentYear;
        }).slice(0, 8);
        
        const albums2024Html = await Promise.all(albums2024.map(async album => {
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
          
          // Format date
          const date = new Date(album.created);
          const formattedDate = date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
          
          return `
            <div class="album-card">
              <div class="album-thumbnail">
                <img src="${thumbUrl}" alt="${album.title}" loading="lazy">
              </div>
              <div class="album-info">
                <strong>${album.title}</strong>
                <span class="album-date">© ${formattedDate}</span>
              </div>
            </div>
          `;
        }));

        // HTML for the new design
        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>ZEDALBUMS.TOP</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              background-color: #0a0a0a;
              color: #ffffff;
              line-height: 1.6;
              padding: 20px;
              max-width: 1200px;
              margin: 0 auto;
            }
            
            .site-header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 1px solid #333;
            }
            
            .site-title {
              font-size: 2.5rem;
              font-weight: 800;
              letter-spacing: 1px;
              margin-bottom: 10px;
              background: linear-gradient(45deg, #ff5500, #ffaa00);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
            
            .site-subtitle {
              color: #888;
              font-size: 1rem;
              letter-spacing: 3px;
              text-transform: uppercase;
            }
            
            .search-container {
              max-width: 600px;
              margin: 30px auto 50px;
            }
            
            .search-box {
              width: 100%;
              padding: 15px 20px;
              font-size: 1.1rem;
              background: #1a1a1a;
              border: 2px solid #333;
              border-radius: 25px;
              color: white;
              transition: all 0.3s ease;
            }
            
            .search-box:focus {
              outline: none;
              border-color: #ff5500;
              box-shadow: 0 0 0 3px rgba(255, 85, 0, 0.1);
            }
            
            .search-box::placeholder {
              color: #666;
              letter-spacing: 1px;
            }
            
            .section {
              margin-bottom: 50px;
            }
            
            .section-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #ff5500;
            }
            
            .section-title {
              font-size: 1.5rem;
              font-weight: 600;
              color: #ffffff;
            }
            
            .view-all {
              color: #ff5500;
              text-decoration: none;
              font-size: 0.9rem;
              font-weight: 500;
              transition: color 0.3s ease;
            }
            
            .view-all:hover {
              color: #ffaa00;
              text-decoration: underline;
            }
            
            .updates-list {
              background: #1a1a1a;
              border-radius: 10px;
              overflow: hidden;
            }
            
            .update-item {
              padding: 15px 20px;
              border-bottom: 1px solid #333;
              transition: background 0.3s ease;
            }
            
            .update-item:hover {
              background: #252525;
            }
            
            .update-item:last-child {
              border-bottom: none;
            }
            
            .update-content {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .update-date {
              color: #888;
              font-size: 0.9rem;
              font-weight: 500;
            }
            
            .albums-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
              gap: 20px;
              margin-top: 20px;
            }
            
            .album-card {
              background: #1a1a1a;
              border-radius: 10px;
              overflow: hidden;
              transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            
            .album-card:hover {
              transform: translateY(-5px);
              box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
            }
            
            .album-thumbnail {
              height: 150px;
              overflow: hidden;
            }
            
            .album-thumbnail img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              transition: transform 0.5s ease;
            }
            
            .album-card:hover .album-thumbnail img {
              transform: scale(1.05);
            }
            
            .album-info {
              padding: 15px;
            }
            
            .album-info strong {
              display: block;
              margin-bottom: 5px;
              font-size: 0.95rem;
              line-height: 1.4;
            }
            
            .album-date {
              color: #888;
              font-size: 0.8rem;
              font-weight: 500;
            }
            
            .site-footer {
              text-align: center;
              margin-top: 60px;
              padding-top: 20px;
              border-top: 1px solid #333;
              color: #666;
              font-size: 0.9rem;
            }
            
            .nav-links {
              display: flex;
              justify-content: center;
              gap: 20px;
              margin-top: 30px;
            }
            
            .nav-link {
              color: #ff5500;
              text-decoration: none;
              padding: 8px 16px;
              border: 1px solid #333;
              border-radius: 20px;
              transition: all 0.3s ease;
              font-size: 0.9rem;
            }
            
            .nav-link:hover {
              background: #ff5500;
              color: white;
              border-color: #ff5500;
            }
            
            @media (max-width: 768px) {
              .site-title {
                font-size: 2rem;
              }
              
              .albums-grid {
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
              }
              
              .update-content {
                flex-direction: column;
                align-items: flex-start;
                gap: 5px;
              }
              
              .nav-links {
                flex-direction: column;
                align-items: center;
              }
              
              .nav-link {
                width: 200px;
                text-align: center;
              }
            }
            
            @media (max-width: 480px) {
              .albums-grid {
                grid-template-columns: 1fr;
              }
              
              body {
                padding: 15px;
              }
              
              .section-title {
                font-size: 1.3rem;
              }
            }
            
            .album-thumbnail img[src="/images/placeholder.jpg"] {
              filter: grayscale(100%) brightness(0.3);
            }
            
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            
            .section {
              animation: fadeIn 0.6s ease-out;
            }
            
            ::-webkit-scrollbar {
              width: 10px;
            }
            
            ::-webkit-scrollbar-track {
              background: #1a1a1a;
            }
            
            ::-webkit-scrollbar-thumb {
              background: #ff5500;
              border-radius: 5px;
            }
            
            ::-webkit-scrollbar-thumb:hover {
              background: #ffaa00;
            }
          </style>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const searchBox = document.querySelector('.search-box');
              
              if (searchBox) {
                searchBox.addEventListener('keypress', function(e) {
                  if (e.key === 'Enter') {
                    const query = this.value.trim();
                    if (query) {
                      sessionStorage.setItem('searchQuery', query);
                      window.location.href = '/?search=' + encodeURIComponent(query);
                    }
                  }
                });
              }
              
              const storedQuery = sessionStorage.getItem('searchQuery');
              if (storedQuery && searchBox) {
                searchBox.value = storedQuery;
                sessionStorage.removeItem('searchQuery');
              }
              
              const albumCards = document.querySelectorAll('.album-card');
              albumCards.forEach(card => {
                card.addEventListener('mouseenter', function() {
                  this.style.zIndex = '10';
                });
                
                card.addEventListener('mouseleave', function() {
                  this.style.zIndex = '1';
                });
              });
            });
            
            function viewAllAlbums() {
              window.location.href = '/album';
            }
            
            function viewAllUpdates() {
              window.location.href = '/';
            }
          </script>
        </head>
        <body>
          <header class="site-header">
            <h1 class="site-title">ZEDALBUMS.TOP</h1>
            <div class="site-subtitle">Zambian Music Library</div>
          </header>
          
          <div class="search-container">
            <input 
              type="text" 
              class="search-box" 
              placeholder="SEARCH ALBUMS..." 
              aria-label="Search albums"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
            >
          </div>
          
          <main>
            <section class="section">
              <div class="section-header">
                <h2 class="section-title">Latest Updates</h2>
                <a href="/" class="view-all" onclick="viewAllUpdates(); return false;">
                  View All →
                </a>
              </div>
              <div class="updates-list">
                ${latestUpdatesHtml.join('')}
                ${latestUpdatesHtml.length === 0 ? 
                  '<div class="update-item"><div class="update-content"><em>No updates yet</em></div></div>' : ''}
              </div>
            </section>
            
            <section class="section">
              <div class="section-header">
                <h2 class="section-title">Latest ${new Date().getFullYear()} Albums</h2>
                <a href="/album" class="view-all" onclick="viewAllAlbums(); return false;">
                  View All →
                </a>
              </div>
              <div class="albums-grid">
                ${albums2024Html.join('')}
                ${albums2024Html.length === 0 ? 
                  '<div class="album-card"><div class="album-info"><em>No albums yet</em></div></div>' : ''}
              </div>
            </section>
            
            <div class="nav-links">
              <a href="/" class="nav-link">← Back to Main Site</a>
              <a href="/upload" class="nav-link">Upload New Music</a>
              <a href="/artist" class="nav-link">Browse Artists</a>
              <a href="/album" class="nav-link">Browse All Albums</a>
            </div>
          </main>
          
          <footer class="site-footer">
            <p>© ${new Date().getFullYear()} ZEDALBUMS.TOP - Zambian Music Archive</p>
            <p style="margin-top: 10px; font-size: 0.8rem; color: #555;">
              <a href="/new-design" style="color: #666; text-decoration: none;">New Design</a> • 
              <a href="/" style="color: #666; text-decoration: none;">Classic Design</a>
            </p>
          </footer>
        </body>
        </html>
        `;
        
        // Cache the generated HTML
        homepageCache = html;
        cacheTimestamp = now;
        
        return new Response(html, { 
          headers: { 
            "Content-Type": "text/html",
            "Cache-Control": "public, max-age=300"
          } 
        });
      } catch (error) {
        // If new design fails, fall back to main homepage
        console.error("New design error:", error);
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>ZEDALBUMS.TOP - Design Unavailable</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 50px; text-align: center; background: #0a0a0a; color: white; }
              a { color: #ff5500; text-decoration: none; }
              a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <h1>Design Temporarily Unavailable</h1>
            <p>The new design is experiencing issues. Please try the main site.</p>
            <p><a href="/">← Go to Main Site</a></p>
          </body>
          </html>
        `, { 
          headers: { "Content-Type": "text/html" } 
        });
      }
    }

    // =========================
    // HOMEPAGE
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
        <p><a href="/download/${encodeURIComponent(fileName)}">Download</a></p>
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
          
          async function loadCurrentAssignments() {
            // This would need additional endpoints to work fully
            // For now, just a placeholder
          }
          
          document.addEventListener('DOMContentLoaded', loadCurrentAssignments);
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