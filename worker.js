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

    // === NEW: Add artist to album's artists array ===
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

    // === NEW: Remove artist from album ===
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

    // === FIXED: getArtistAlbumsAndSingles with CORRECT stats ===
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
    // UPLOAD HANDLER (POST) - UPDATED with bidirectional linking
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

      if (albumId && albumId !== "" && albumId !== "__create_new__") {
        await addSongToAlbum(albumId, baseName);
        await addAlbumToArtist(artistId, albumId);
        await addArtistToAlbum(artistId, albumId);
      }
      
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
    // ALBUMS PAGE - DYNAMIC FROM TEMPLATE
    // =========================
    if (path === "/albums") {
      // Get the template from R2
      const templateObj = await env.media.get("albums.html");
      if (!templateObj) {
        return new Response("albums.html template not found in R2", { status: 500 });
      }
      let html = await templateObj.text();

      // Get all albums and artists data
      const albums = await getAlbums();
      const artists = await getArtists();
      
      // Sort albums by creation date (newest first)
      const albumList = Object.values(albums).sort((a, b) => b.created - a.created);
      
      // Pagination
      const ALBUMS_PER_PAGE = 12;
      const page = parseInt(url.searchParams.get("page")) || 1;
      const totalAlbums = albumList.length;
      const totalPages = Math.ceil(totalAlbums / ALBUMS_PER_PAGE);
      const startIdx = (page - 1) * ALBUMS_PER_PAGE;
      const pageAlbums = albumList.slice(startIdx, startIdx + ALBUMS_PER_PAGE);

      // Generate albums HTML
      const albumsHtml = await Promise.all(pageAlbums.map(async album => {
        let thumbUrl = "/images/placeholder.jpg";
        let hasImage = false;
        
        if (album.thumbnail) {
          try {
            const thumbObj = await env.media.get(album.thumbnail);
            if (thumbObj) {
              const ext = album.thumbnail.split(".").pop();
              thumbUrl = `/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}`;
              hasImage = true;
            }
          } catch (e) {}
        }

        // Get primary artist
        let primaryArtist = "Various Artists";
        if (album.artists && album.artists.length > 0) {
          const artistObj = artists[album.artists[0]];
          if (artistObj) primaryArtist = artistObj.name;
        }

        const trackCount = album.songs?.length || 0;
        const date = new Date(album.created);
        const formattedDate = date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        });

        // Determine if we should use album-style or image
        const thumbnailClass = hasImage ? '' : 'album-style';
        
        return `
          <div class="album-item" onclick="window.location='/album/${album.id}'">
            <div class="album-thumbnail ${thumbnailClass}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${album.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${primaryArtist} - ${album.title}</span>
              <div class="album-meta">
                <span class="album-artist">${primaryArtist}</span>
                <span class="album-tracks">${trackCount} Tracks</span>
                <span class="album-genre">Album</span>
              </div>
              <span class="album-date">${formattedDate}</span>
            </div>
          </div>
        `;
      }));

      // Generate pagination HTML
      let paginationHtml = '';
      if (totalPages > 1) {
        paginationHtml = `<div class="pagination-container"><div class="pagination">`;
        
        // Previous button
        paginationHtml += `<a href="/albums?page=${page-1}" class="pagination-item pagination-prev ${page === 1 ? 'disabled' : ''}"><i class="fas fa-chevron-left"></i> Prev</a>`;
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
          if (i === 1 || i === totalPages || (i >= page-2 && i <= page+2)) {
            paginationHtml += `<a href="/albums?page=${i}" class="pagination-item ${i === page ? 'active' : ''}">${i}</a>`;
          } else if (i === page-3 || i === page+3) {
            paginationHtml += `<span class="pagination-ellipsis">...</span>`;
          }
        }
        
        // Next button
        paginationHtml += `<a href="/albums?page=${page+1}" class="pagination-item pagination-next ${page === totalPages ? 'disabled' : ''}">Next <i class="fas fa-chevron-right"></i></a>`;
        paginationHtml += `</div></div>`;
      }

      // ---------- RIGHT SIDEBAR CONTENT ----------
      
      // 1. FEATURED ALBUMS (3 random or top albums)
      const featuredAlbums = Object.values(albums)
        .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
        .slice(0, 3);
      
      const featuredAlbumsHtml = await Promise.all(featuredAlbums.map(async album => {
        let thumbUrl = "/images/placeholder.jpg";
        let hasImage = false;
        
        if (album.thumbnail) {
          try {
            const thumbObj = await env.media.get(album.thumbnail);
            if (thumbObj) {
              const ext = album.thumbnail.split(".").pop();
              thumbUrl = `/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}`;
              hasImage = true;
            }
          } catch (e) {}
        }

        let primaryArtist = "Various";
        if (album.artists && album.artists.length > 0) {
          const artistObj = artists[album.artists[0]];
          if (artistObj) primaryArtist = artistObj.name;
        }

        const thumbnailClass = hasImage ? '' : 'album-style';
        
        return `
          <div class="album-item" onclick="window.location='/album/${album.id}'">
            <div class="album-thumbnail ${thumbnailClass}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${album.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${primaryArtist} - ${album.title}</span>
              <div class="album-meta">
                <span class="album-artist">${primaryArtist}</span>
                <span class="album-genre">Editor's Pick</span>
              </div>
              <span class="album-date">${album.songs?.length || 0} songs</span>
            </div>
          </div>
        `;
      }));

      // 2. TOP ARTISTS (by song count)
      const topArtists = Object.values(artists)
        .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
        .slice(0, 3);
      
      const topArtistsHtml = await Promise.all(topArtists.map(async artist => {
        const albumCount = artist.albums?.length || 0;
        const songCount = artist.songs?.length || 0;
        
        return `
          <div class="album-item" onclick="window.location='/artists/${artist.id}'">
            <div class="album-thumbnail artist-thumbnail"></div>
            <div class="album-info">
              <span class="album-title">${artist.name}</span>
              <div class="album-meta">
                <span class="album-artist">${albumCount} Albums</span>
                <span class="album-genre">Artist</span>
              </div>
              <span class="album-date">${songCount} Songs</span>
            </div>
          </div>
        `;
      }));

      // 3. GENRES (static for now - can be dynamic later)
      const genresHtml = `
        <div class="album-item">
          <div class="album-thumbnail placeholder"></div>
          <div class="album-info">
            <span class="album-title">Zam Pop</span>
            <div class="album-meta">
              <span class="album-artist">${Object.values(albums).filter(a => a.title?.toLowerCase().includes('pop')).length || 8} Albums</span>
              <span class="album-genre">Popular</span>
            </div>
            <span class="album-date">Most played</span>
          </div>
        </div>
        <div class="album-item">
          <div class="album-thumbnail placeholder"></div>
          <div class="album-info">
            <span class="album-title">Zam Hip Hop</span>
            <div class="album-meta">
              <span class="album-artist">${Object.values(albums).filter(a => a.title?.toLowerCase().includes('hip hop') || a.title?.toLowerCase().includes('rap')).length || 12} Albums</span>
              <span class="album-genre">Urban</span>
            </div>
            <span class="album-date">Trending</span>
          </div>
        </div>
        <div class="album-item">
          <div class="album-thumbnail placeholder"></div>
          <div class="album-info">
            <span class="album-title">Gospel</span>
            <div class="album-meta">
              <span class="album-artist">${Object.values(albums).filter(a => a.title?.toLowerCase().includes('gospel')).length || 6} Albums</span>
              <span class="album-genre">Spiritual</span>
            </div>
            <span class="album-date">Rising</span>
          </div>
        </div>
      `;

      // 4. NEW RELEASES (latest 2 albums)
      const newReleases = Object.values(albums)
        .sort((a, b) => b.created - a.created)
        .slice(0, 2);
      
      const newReleasesHtml = await Promise.all(newReleases.map(async album => {
        let thumbUrl = "/images/placeholder.jpg";
        let hasImage = false;
        
        if (album.thumbnail) {
          try {
            const thumbObj = await env.media.get(album.thumbnail);
            if (thumbObj) {
              const ext = album.thumbnail.split(".").pop();
              thumbUrl = `/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}`;
              hasImage = true;
            }
          } catch (e) {}
        }

        let primaryArtist = "Various";
        if (album.artists && album.artists.length > 0) {
          const artistObj = artists[album.artists[0]];
          if (artistObj) primaryArtist = artistObj.name;
        }

        const date = new Date(album.created);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const timeAgo = diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;

        const thumbnailClass = hasImage ? '' : 'album-style';
        
        return `
          <div class="album-item" onclick="window.location='/album/${album.id}'">
            <div class="album-thumbnail ${thumbnailClass}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${album.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${primaryArtist} - ${album.title}</span>
              <div class="album-meta">
                <span class="album-artist">${primaryArtist}</span>
                <span class="album-genre">Album</span>
              </div>
              <span class="album-date">${timeAgo}</span>
            </div>
          </div>
        `;
      }));

      // Replace all placeholders
      html = html.replace(
        /<!-- ALBUM 1 - Artist - Album Title format -->[\s\S]*?<!-- ALBUM 12 -->/g,
        albumsHtml.join('')
      );
      
      html = html.replace(
        /<div class="pagination-container">[\s\S]*?<\/div>/,
        paginationHtml
      );
      
      html = html.replace(
        /<!-- FEATURED ALBUMS -->[\s\S]*?<div class="album-item">[\s\S]*?<\/div>\s*<\/section>/,
        `<!-- FEATURED ALBUMS -->\n${featuredAlbumsHtml.join('')}\n            </section>`
      );
      
      html = html.replace(
        /<!-- TOP ARTISTS -->[\s\S]*?<div class="album-item">[\s\S]*?<\/div>\s*<\/section>/,
        `<!-- TOP ARTISTS -->\n${topArtistsHtml.join('')}\n            </section>`
      );
      
      html = html.replace(
        /<!-- GENRES -->[\s\S]*?<div class="album-item">[\s\S]*?<\/div>\s*<\/section>/,
        `<!-- GENRES -->\n${genresHtml}\n            </section>`
      );
      
      html = html.replace(
        /<!-- NEW RELEASES -->[\s\S]*?<div class="album-item">[\s\S]*?<\/div>\s*<\/section>/,
        `<!-- NEW RELEASES -->\n${newReleasesHtml.join('')}\n            </section>`
      );

      // Update breadcrumb link
      html = html.replace(
        /<a href="index\.html" class="breadcrumb-link">/g,
        '<a href="/" class="breadcrumb-link">'
      );

      // Update mobile nav active state and links
      html = html.replace(
        /<a href="#" class="nav-item active">Albums<\/a>/,
        '<a href="/albums" class="nav-item active">Albums</a>'
      );
      
      html = html.replace(
        /<a href="#" class="nav-item">Home<\/a>/,
        '<a href="/" class="nav-item">Home</a>'
      );
      
      html = html.replace(
        /<a href="#" class="nav-item">Artists<\/a>/,
        '<a href="/artists" class="nav-item">Artists</a>'
      );

      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300"
        } 
      });
    }

    // =========================
    // ALBUM PAGE (SINGLE)
    // =========================
    if (path.startsWith("/album/") && !path.startsWith("/album/create")) {
      const albumId = decodeURIComponent(path.replace("/album/", ""));
      
      const albums = await getAlbums();
      const album = albums[albumId];
      
      if (!album) {
        return new Response("Album not found", { status: 404 });
      }

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

      let albumThumb = "";
      const thumbObj = await env.media.get(album.thumbnail);
      if (thumbObj) {
        const ext = album.thumbnail.split(".").pop();
        albumThumb = `<img src="/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}" alt="${album.title}" style="max-width:300px;margin:10px 0;border-radius:8px;">`;
      }

      const artists = await getArtists();
      const albumArtists = album.artists || [];
      const artistLinks = albumArtists.map(artistId => {
        const artist = artists[artistId];
        if (artist) {
          return `<a href="/artists/${artistId}" style="display:inline-block; margin:5px; padding:5px 10px; background:#3498db; color:white; border-radius:15px; text-decoration:none;">${artist.name}</a>`;
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
            <a href="/albums">← All Albums</a> | 
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
        <p><a href="/artists/${artistId}">View Artist Page</a></p>
        <p><a href="/upload">← Back to Upload</a></p>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // ARTISTS PAGE
    // =========================
    if (path === "/artists") {
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
            <h3 style="margin:10px 0 5px 0;"><a href="/artists/${artist.id}">${artist.name}</a></h3>
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

    // =========================
    // ARTIST PAGE (SINGLE)
    // =========================
    if (path.startsWith("/artists/") && !path.startsWith("/artists/create")) {
      const artistId = decodeURIComponent(path.replace("/artists/", ""));
      
      const artists = await getArtists();
      const artist = artists[artistId];
      
      if (!artist) {
        return new Response("Artist not found", { status: 404 });
      }

      return Response.redirect(`/artist/${artistId}`, 301);
    }

    // =========================
    // ARTIST PAGE (SINGLE) - LEGACY ROUTE
    // =========================
    if (path.startsWith("/artist/") && !path.startsWith("/artist/create")) {
      const artistId = decodeURIComponent(path.replace("/artist/", ""));
      
      const artists = await getArtists();
      const artist = artists[artistId];
      
      if (!artist) {
        return new Response("Artist not found", { status: 404 });
      }

      const { albums: artistAlbums, singles, totalSongs, totalSongsInAlbums, totalSingles, totalAlbums, assignedAlbumsCount } = await getArtistAlbumsAndSingles(artistId);

      let artistThumb = "";
      if (artist.thumbnail) {
        const thumbObj = await env.media.get(artist.thumbnail);
        if (thumbObj) {
          const ext = artist.thumbnail.split(".").pop();
          artistThumb = `<img src="/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}" alt="${artist.name}" style="width:200px; height:200px; object-fit:cover; border-radius:50%; margin:10px 0;">`;
        }
      }

      let albumsSection = '';
      if (artistAlbums.length > 0) {
        const albumCards = artistAlbums.map(album => {
          const assignmentBadge = album.explicitlyAssigned ? 
            '<span style="background:#2ecc71; color:white; padding:2px 8px; border-radius:12px; font-size:0.7em; margin-left:5px;">Assigned</span>' : 
            '<span style="background:#95a5a6; color:white; padding:2px 8px; border-radius:12px; font-size:0.7em; margin-left:5px;">Inferred</span>';
          
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
            <a href="/artists">← All Artists</a> | 
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
    // HOMEPAGE - DYNAMIC WITH LATEST SONGS
    // =========================
    if (path === "/") {
      const now = Date.now();
      
      if (homepageCache && (now - cacheTimestamp < CACHE_DURATION)) {
        return new Response(homepageCache, { 
          headers: { 
            "Content-Type": "text/html",
            "Cache-Control": "public, max-age=30"
          } 
        });
      }

      const templateObj = await env.media.get("index.html");
      if (!templateObj) {
        return new Response("Template index.html not found in R2", { status: 500 });
      }
      let html = await templateObj.text();

      const albums = await getAlbums();
      const artists = await getArtists();
      const albumList = Object.values(albums).sort((a, b) => b.created - a.created);
      const artistList = Object.values(artists).sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0));

      // ---------- LATEST ALBUMS with Pagination ----------
      const ALBUMS_PER_PAGE = 6;
      const page = parseInt(url.searchParams.get("page")) || 1;
      const totalAlbums = albumList.length;
      const totalPages = Math.ceil(totalAlbums / ALBUMS_PER_PAGE);
      const startIdx = (page - 1) * ALBUMS_PER_PAGE;
      const pageAlbums = albumList.slice(startIdx, startIdx + ALBUMS_PER_PAGE);

      const latestAlbumsHtml = await Promise.all(pageAlbums.map(async album => {
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
        
        let primaryArtist = "Various";
        if (album.artists && album.artists.length > 0) {
          const artistObj = artists[album.artists[0]];
          if (artistObj) primaryArtist = artistObj.name;
        }
        
        const date = new Date(album.created);
        const formattedDate = date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        });

        const hasImage = thumbUrl !== '/images/placeholder.jpg';
        const thumbnailClass = hasImage ? '' : ' placeholder';
        
        return `
          <div class="album-item" onclick="window.location='/album/${album.id}'">
            <div class="album-thumbnail${thumbnailClass}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${album.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${album.title}</span>
              <div class="album-meta">
                <span class="album-artist">${primaryArtist}</span>
                <span class="album-genre">Album</span>
              </div>
              <span class="album-date">${formattedDate}</span>
            </div>
          </div>
        `;
      }));

      let paginationHtml = '';
      if (totalPages > 1) {
        paginationHtml = `<div class="pagination-container show"><div class="pagination">`;
        paginationHtml += `<a href="/?page=${page-1}" class="pagination-item pagination-prev ${page === 1 ? 'disabled' : ''}"><i class="fas fa-chevron-left"></i> Prev</a>`;
        
        for (let i = 1; i <= totalPages; i++) {
          if (i === 1 || i === totalPages || (i >= page-1 && i <= page+1)) {
            paginationHtml += `<a href="/?page=${i}" class="pagination-item ${i === page ? 'active' : ''}">${i}</a>`;
          } else if (i === page-2 || i === page+2) {
            paginationHtml += `<span class="pagination-ellipsis">...</span>`;
          }
        }
        
        paginationHtml += `<a href="/?page=${page+1}" class="pagination-item pagination-next ${page === totalPages ? 'disabled' : ''}">Next <i class="fas fa-chevron-right"></i></a>`;
        paginationHtml += `</div></div>`;
      }

      // ---------- LATEST SONGS ----------
      const songsList = await env.media.list({ prefix: "songs/", limit: 50 });
      const songFiles = songsList.objects || [];
      songFiles.sort((a, b) => b.uploaded - a.uploaded);
      const latestSongs = songFiles.slice(0, 3);
      
      const latestSongsHtml = await Promise.all(latestSongs.map(async f => {
        const fileName = f.key.split("/")[1];
        const baseName = fileName.replace(".mp3", "");
        const [artistId, ...titleParts] = baseName.split("_");
        const title = titleParts.join(" ");
        
        let artistName = artistId;
        const artist = artists[artistId];
        if (artist) artistName = artist.name;
        
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
        
        const date = new Date(f.uploaded);
        const formattedDate = date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        });
        
        const hasImage = thumbUrl !== '/images/placeholder.jpg';
        
        return `
          <div class="album-item" onclick="window.location='/song/${encodeURIComponent(fileName)}'">
            <div class="album-thumbnail song-thumbnail" ${hasImage ? `style="background-image:url('${thumbUrl}');background-size:cover;background-position:center;"` : ''}>
              ${hasImage ? '' : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${title}</span>
              <div class="album-meta">
                <span class="album-artist">${artistName}</span>
                <span class="song-stats">Single</span>
              </div>
              <span class="album-date">${formattedDate}</span>
            </div>
          </div>
        `;
      }));

      // ---------- FEATURED ARTISTS (top 4 by song count) ----------
      const featuredArtists = artistList.slice(0, 4);
      const featuredArtistsHtml = await Promise.all(featuredArtists.map(async artist => {
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
        
        const albumCount = artist.albums?.length || 0;
        const songCount = artist.songs?.length || 0;
        
        const bgStyle = thumbUrl !== '/images/placeholder.jpg' 
          ? `style="background-image:url('${thumbUrl}');background-size:cover;background-position:center;"`
          : '';
        
        return `
          <div class="album-item" onclick="window.location='/artists/${artist.id}'">
            <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
            <div class="album-info">
              <span class="album-title">${artist.name}</span>
              <div class="album-meta">
                <span class="artist-stats">${albumCount} Albums</span>
                <span class="album-genre">Artist</span>
              </div>
              <span class="album-date">${songCount} songs</span>
            </div>
          </div>
        `;
      }));

      // ---------- TOP RATED (top 3 albums by song count) ----------
      const topRated = Object.values(albums)
        .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
        .slice(0, 3);
      
      const topRatedHtml = await Promise.all(topRated.map(async album => {
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
        
        const primaryArtist = (album.artists?.length && artists[album.artists[0]]) 
          ? artists[album.artists[0]].name 
          : "Various";
        
        const date = new Date(album.created).toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        });

        const hasImage = thumbUrl !== '/images/placeholder.jpg';
        const thumbnailClass = hasImage ? '' : ' placeholder';
        
        return `
          <div class="album-item" onclick="window.location='/album/${album.id}'">
            <div class="album-thumbnail${thumbnailClass}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${album.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${album.title}</span>
              <div class="album-meta">
                <span class="album-artist">${primaryArtist}</span>
                <span class="album-genre">${album.songs?.length || 0} songs</span>
              </div>
              <span class="album-date">${date}</span>
            </div>
          </div>
        `;
      }));

      // ---------- PLAYLISTS (virtual collections) ----------
      const totalSongs = (await env.media.list({ prefix: "songs/" })).objects?.length || 0;
      
      const playlistsHtml = `
        <div class="album-item" onclick="window.location='/albums'">
          <div class="album-thumbnail playlist-thumbnail"></div>
          <div class="album-info">
            <span class="album-title">All Albums</span>
            <div class="album-meta">
              <span class="playlist-songs">${Object.keys(albums).length} Albums</span>
              <span class="album-genre">Collection</span>
            </div>
            <span class="album-date">Updated recently</span>
          </div>
        </div>
        <div class="album-item" onclick="window.location='/artists'">
          <div class="album-thumbnail playlist-thumbnail"></div>
          <div class="album-info">
            <span class="album-title">All Artists</span>
            <div class="album-meta">
              <span class="playlist-songs">${Object.keys(artists).length} Artists</span>
              <span class="album-genre">Collection</span>
            </div>
            <span class="album-date">Updated recently</span>
          </div>
        </div>
        <div class="album-item" onclick="window.location='/'">
          <div class="album-thumbnail playlist-thumbnail"></div>
          <div class="album-info">
            <span class="album-title">All Songs</span>
            <div class="album-meta">
              <span class="playlist-songs">${totalSongs} Songs</span>
              <span class="album-genre">Master Playlist</span>
            </div>
            <span class="album-date">Updated recently</span>
          </div>
        </div>
      `;

      // ---------- TRENDING ALBUMS (top 3 by song count) ----------
      const trending = Object.values(albums)
        .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
        .slice(0, 3);
      
      const trendingHtml = await Promise.all(trending.map(async album => {
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
        
        const primaryArtist = (album.artists?.length && artists[album.artists[0]]) 
          ? artists[album.artists[0]].name 
          : "Various";
        
        const date = new Date(album.created).toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        });

        const hasImage = thumbUrl !== '/images/placeholder.jpg';
        const thumbnailClass = hasImage ? '' : ' placeholder';
        
        return `
          <div class="album-item" onclick="window.location='/album/${album.id}'">
            <div class="album-thumbnail${thumbnailClass}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${album.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${album.title}</span>
              <div class="album-meta">
                <span class="album-artist">${primaryArtist}</span>
                <span class="album-genre">${album.songs?.length || 0} songs</span>
              </div>
              <span class="album-date">${date}</span>
            </div>
          </div>
        `;
      }));

      // ---------- REPLACE ALL PLACEHOLDERS ----------
      html = html.replace(
        /<!-- LATEST_ALBUMS_START -->[\s\S]*?<!-- LATEST_ALBUMS_END -->/g,
        `<!-- LATEST_ALBUMS_START -->${latestAlbumsHtml.join('')}<!-- LATEST_ALBUMS_END -->`
      );
      
      html = html.replace(
        /<!-- PAGINATION_START -->[\s\S]*?<!-- PAGINATION_END -->/g,
        `<!-- PAGINATION_START -->${paginationHtml}<!-- PAGINATION_END -->`
      );
      
      html = html.replace(
        /<!-- LATEST_SONGS_START -->[\s\S]*?<!-- LATEST_SONGS_END -->/g,
        `<!-- LATEST_SONGS_START -->${latestSongsHtml.join('')}<!-- LATEST_SONGS_END -->`
      );
      
      html = html.replace(
        /<!-- FEATURED_ARTISTS_START -->[\s\S]*?<!-- FEATURED_ARTISTS_END -->/g,
        `<!-- FEATURED_ARTISTS_START -->${featuredArtistsHtml.join('')}<!-- FEATURED_ARTISTS_END -->`
      );
      
      html = html.replace(
        /<!-- TOP_RATED_START -->[\s\S]*?<!-- TOP_RATED_END -->/g,
        `<!-- TOP_RATED_START -->${topRatedHtml.join('')}<!-- TOP_RATED_END -->`
      );
      
      html = html.replace(
        /<!-- PLAYLISTS_START -->[\s\S]*?<!-- PLAYLISTS_END -->/g,
        `<!-- PLAYLISTS_START -->${playlistsHtml}<!-- PLAYLISTS_END -->`
      );
      
      html = html.replace(
        /<!-- TRENDING_ALBUMS_START -->[\s\S]*?<!-- TRENDING_ALBUMS_END -->/g,
        `<!-- TRENDING_ALBUMS_START -->${trendingHtml.join('')}<!-- TRENDING_ALBUMS_END -->`
      );

      homepageCache = html;
      cacheTimestamp = now;

      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=30"
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
    // REDIRECT OLD ROUTES TO NEW ONES
    // =========================
    if (path === "/album") {
      return Response.redirect("/albums", 301);
    }
    
    if (path === "/artist") {
      return Response.redirect("/artists", 301);
    }

    // =========================
    // NEW DESIGN ROUTE (keeping for backward compatibility)
    // =========================
    if (path === "/new-design") {
      return Response.redirect("/", 301);
    }

    return new Response("Not found", { status: 404 });
  }
};