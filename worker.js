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
    const PLAYLISTS_CACHE_DURATION = 60000; // separate, but can be same

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
        if (!artists[artistId].albums) artists[artistId].albums = [];
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

    // === PLAYLISTS FUNCTIONS (NEW) ===
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
      const html = `...`; // (full HTML omitted for brevity – keep your existing upload page HTML)
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
      const html = `...`; // keep your existing HTML
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
    // CREATE PLAYLIST PAGE (GET) - NEW
    // =========================
    if (path === "/playlist/create" && req.method === "GET") {
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Create Playlist</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; }
          form { display: flex; flex-direction: column; max-width: 400px; margin: auto; }
          label { margin-top: 10px; font-weight: bold; }
          input, textarea { padding: 8px; margin-top: 5px; }
          button { margin-top: 20px; padding: 10px; background: #00b894; color: #fff; border: none; cursor: pointer; border-radius: 5px; }
          button:hover { background: #009874; }
        </style>
      </head>
      <body>
        <h1>Create New Playlist</h1>
        <form action="/playlist/create" method="POST" enctype="multipart/form-data">
          <label>Playlist Title</label>
          <input type="text" name="title" required>
          <label>Description</label>
          <textarea name="description" rows="3"></textarea>
          <label>Thumbnail (optional)</label>
          <input type="file" name="thumbnail" accept="image/*">
          <button type="submit">Create Playlist</button>
        </form>
        <p><a href="/playlists">← Back to Playlists</a></p>
      </body>
      </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // CREATE PLAYLIST HANDLER (POST) - NEW
    // =========================
    if (path === "/playlist/create" && req.method === "POST") {
      const formData = await req.formData();
      const title = formData.get("title");
      const description = formData.get("description") || "";
      const thumbnailFile = formData.get("thumbnail");

      if (!title) return new Response("Missing title", { status: 400 });

      const playlistId = sanitize(title) + "_" + Date.now();
      const playlists = await getPlaylists();

      let thumbnailKey = "";
      if (thumbnailFile) {
        const imgType = thumbnailFile.type.includes("png") ? "png" : "jpg";
        thumbnailKey = `playlists/thumbnails/${playlistId}.${imgType}`;
        await env.media.put(thumbnailKey, thumbnailFile.stream());
      }

      playlists[playlistId] = {
        id: playlistId,
        title: title,
        description: description,
        thumbnail: thumbnailKey,
        created: Date.now(),
        songs: [],
        createdBy: "user",
      };

      await savePlaylists(playlists);
      
      homepageCache = null;
      cacheTimestamp = 0;

      const html = `
        <h1>Playlist Created!</h1>
        <p><a href="/playlist/${playlistId}">View Playlist</a></p>
        <p><a href="/playlists">All Playlists</a></p>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // ALBUMS PAGE - DYNAMIC FROM TEMPLATE
    // =========================
    if (path === "/albums") {
      // ... (keep your existing /albums handler code exactly as is) ...
    }

    // =========================
    // ALBUM DETAIL PAGE - DYNAMIC FROM TEMPLATE
    // =========================
    if (path.startsWith("/album/") && !path.startsWith("/album/create")) {
      // ... (keep your existing album detail handler) ...
    }

    // =========================
    // ARTISTS PAGE - DYNAMIC FROM TEMPLATE
    // =========================
    if (path === "/artists") {
      // ... (keep your existing /artists handler) ...
    }

    // =========================
    // ARTIST DETAIL PAGE - DYNAMIC FROM TEMPLATE
    // =========================
    if (path.startsWith("/artist/") && !path.startsWith("/artist/create")) {
      // ... (keep your existing artist detail handler) ...
    }

    // =========================
    // PLAYLISTS PAGE (LISTING) - NEW
    // =========================
    if (path === "/playlists") {
      const templateObj = await env.media.get("playlists.html");
      if (!templateObj) return new Response("playlists.html template not found in R2", { status: 500 });
      let html = await templateObj.text();

      const playlists = await getPlaylists();
      const artists = await getArtists();

      const playlistList = Object.values(playlists).sort((a, b) => b.created - a.created);

      // Pagination
      const PLAYLISTS_PER_PAGE = 12;
      const page = parseInt(url.searchParams.get("page")) || 1;
      const totalPlaylists = playlistList.length;
      const totalPages = Math.ceil(totalPlaylists / PLAYLISTS_PER_PAGE);
      const startIdx = (page - 1) * PLAYLISTS_PER_PAGE;
      const pagePlaylists = playlistList.slice(startIdx, startIdx + PLAYLISTS_PER_PAGE);

      // Generate playlist HTML for left sidebar
      const playlistsHtml = await Promise.all(pagePlaylists.map(async pl => {
        let thumbUrl = "/images/placeholder.jpg";
        let hasImage = false;
        if (pl.thumbnail) {
          try {
            const thumbObj = await env.media.get(pl.thumbnail);
            if (thumbObj) {
              const ext = pl.thumbnail.split(".").pop();
              thumbUrl = `/playlists/thumbnails/${encodeURIComponent(pl.id)}.${ext}`;
              hasImage = true;
            }
          } catch (e) {}
        }
        const songCount = pl.songs?.length || 0;
        const date = new Date(pl.created).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const thumbnailClass = hasImage ? '' : 'playlist-thumbnail';
        const thumbnailContent = hasImage ? `<img src="${thumbUrl}" alt="${pl.title}" loading="lazy">` : '';
        return `
          <div class="album-item" onclick="window.location='/playlist/${pl.id}'">
            <div class="album-thumbnail ${thumbnailClass}">
              ${thumbnailContent}
            </div>
            <div class="album-info">
              <span class="album-title">${pl.title}</span>
              <div class="album-meta">
                <span class="album-artist playlist-songs">${songCount} Songs</span>
                <span class="album-genre">Playlist</span>
              </div>
              <span class="album-date">${date}</span>
            </div>
          </div>
        `;
      }));

      // Pagination HTML
      let paginationHtml = '';
      if (totalPages > 1) {
        paginationHtml = `<div class="pagination-container"><div class="pagination">`;
        paginationHtml += `<a href="/playlists?page=${page-1}" class="pagination-item pagination-prev ${page === 1 ? 'disabled' : ''}"><i class="fas fa-chevron-left"></i> Prev</a>`;
        for (let i = 1; i <= totalPages; i++) {
          if (i === 1 || i === totalPages || (i >= page-2 && i <= page+2)) {
            paginationHtml += `<a href="/playlists?page=${i}" class="pagination-item ${i === page ? 'active' : ''}">${i}</a>`;
          } else if (i === page-3 || i === page+3) {
            paginationHtml += `<span class="pagination-ellipsis">...</span>`;
          }
        }
        paginationHtml += `<a href="/playlists?page=${page+1}" class="pagination-item pagination-next ${page === totalPages ? 'disabled' : ''}">Next <i class="fas fa-chevron-right"></i></a>`;
        paginationHtml += `</div></div>`;
      }

      // RIGHT SIDEBAR: Featured Playlists (most songs)
      const featuredPlaylists = Object.values(playlists)
        .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
        .slice(0, 3);
      const featuredHtml = await Promise.all(featuredPlaylists.map(async pl => {
        let thumbUrl = "/images/placeholder.jpg";
        if (pl.thumbnail) {
          try {
            const thumbObj = await env.media.get(pl.thumbnail);
            if (thumbObj) {
              const ext = pl.thumbnail.split(".").pop();
              thumbUrl = `/playlists/thumbnails/${encodeURIComponent(pl.id)}.${ext}`;
            }
          } catch (e) {}
        }
        const songCount = pl.songs?.length || 0;
        return `
          <div class="album-item" onclick="window.location='/playlist/${pl.id}'">
            <div class="album-thumbnail playlist-thumbnail">
              ${thumbUrl !== '/images/placeholder.jpg' ? `<img src="${thumbUrl}" alt="${pl.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${pl.title}</span>
              <div class="album-meta">
                <span class="album-artist playlist-songs">${songCount} Songs</span>
                <span class="album-genre">Featured</span>
              </div>
              <span class="album-date">Editor's Pick</span>
            </div>
          </div>
        `;
      }));

      // RIGHT SIDEBAR: Top Artists
      const topArtists = Object.values(artists)
        .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
        .slice(0, 3);
      const topArtistsHtml = await Promise.all(topArtists.map(async artist => {
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
        const bgStyle = thumbUrl !== '/images/placeholder.jpg' 
          ? `style="background-image:url('${thumbUrl}');background-size:cover;background-position:center;"`
          : '';
        const songCount = artist.songs?.length || 0;
        const sinceYear = new Date(artist.created).getFullYear();
        return `
          <div class="album-item" onclick="window.location='/artist/${artist.id}'">
            <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
            <div class="album-info">
              <span class="album-title">${artist.name}</span>
              <div class="album-meta">
                <span class="album-artist artist-songs">${songCount} Songs</span>
                <span class="album-genre">Artist</span>
              </div>
              <span class="album-date">Since ${sinceYear}</span>
            </div>
          </div>
        `;
      }));

      // RIGHT SIDEBAR: Genres (placeholder – you can enhance later)
      const genresHtml = `
        <div class="album-item">
          <div class="album-thumbnail placeholder"></div>
          <div class="album-info">
            <span class="album-title">Zam Pop</span>
            <div class="album-meta">
              <span class="album-artist">150 Playlists</span>
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
              <span class="album-artist">95 Playlists</span>
              <span class="album-genre">Urban</span>
            </div>
            <span class="album-date">Trending</span>
          </div>
        </div>
        <div class="album-item">
          <div class="album-thumbnail placeholder"></div>
          <div class="album-info">
            <span class="album-title">Zam R&B</span>
            <div class="album-meta">
              <span class="album-artist">80 Playlists</span>
              <span class="album-genre">Soulful</span>
            </div>
            <span class="album-date">Classic</span>
          </div>
        </div>
      `;

      // RIGHT SIDEBAR: Recently Added Playlists
      const recentPlaylists = Object.values(playlists)
        .sort((a, b) => b.created - a.created)
        .slice(0, 3);
      const recentHtml = await Promise.all(recentPlaylists.map(async pl => {
        let thumbUrl = "/images/placeholder.jpg";
        if (pl.thumbnail) {
          try {
            const thumbObj = await env.media.get(pl.thumbnail);
            if (thumbObj) {
              const ext = pl.thumbnail.split(".").pop();
              thumbUrl = `/playlists/thumbnails/${encodeURIComponent(pl.id)}.${ext}`;
            }
          } catch (e) {}
        }
        const songCount = pl.songs?.length || 0;
        const date = new Date(pl.created).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        return `
          <div class="album-item" onclick="window.location='/playlist/${pl.id}'">
            <div class="album-thumbnail playlist-thumbnail">
              ${thumbUrl !== '/images/placeholder.jpg' ? `<img src="${thumbUrl}" alt="${pl.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${pl.title}</span>
              <div class="album-meta">
                <span class="album-artist playlist-songs">${songCount} Songs</span>
                <span class="album-genre">New</span>
              </div>
              <span class="album-date">${date}</span>
            </div>
          </div>
        `;
      }));

      // Replace placeholders
      html = html.replace(
        /<!-- PLAYLISTS_START -->[\s\S]*?<!-- PLAYLISTS_END -->/g,
        `<!-- PLAYLISTS_START -->${playlistsHtml.join('')}<!-- PLAYLISTS_END -->`
      );
      html = html.replace(
        /<!-- PAGINATION_START -->[\s\S]*?<!-- PAGINATION_END -->/g,
        `<!-- PAGINATION_START -->${paginationHtml}<!-- PAGINATION_END -->`
      );
      html = html.replace(
        /<!-- FEATURED_PLAYLISTS_START -->[\s\S]*?<!-- FEATURED_PLAYLISTS_END -->/g,
        `<!-- FEATURED_PLAYLISTS_START -->${featuredHtml.join('')}<!-- FEATURED_PLAYLISTS_END -->`
      );
      html = html.replace(
        /<!-- TOP_ARTISTS_START -->[\s\S]*?<!-- TOP_ARTISTS_END -->/g,
        `<!-- TOP_ARTISTS_START -->${topArtistsHtml.join('')}<!-- TOP_ARTISTS_END -->`
      );
      html = html.replace(
        /<!-- GENRES_START -->[\s\S]*?<!-- GENRES_END -->/g,
        `<!-- GENRES_START -->${genresHtml}<!-- GENRES_END -->`
      );
      html = html.replace(
        /<!-- RECENT_PLAYLISTS_START -->[\s\S]*?<!-- RECENT_PLAYLISTS_END -->/g,
        `<!-- RECENT_PLAYLISTS_START -->${recentHtml.join('')}<!-- RECENT_PLAYLISTS_END -->`
      );

      return new Response(html, {
        headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=300" }
      });
    }

    // =========================
    // PLAYLIST DETAIL PAGE - NEW
    // =========================
    if (path.startsWith("/playlist/") && !path.startsWith("/playlist/create")) {
      const playlistId = decodeURIComponent(path.replace("/playlist/", ""));
      const playlists = await getPlaylists();
      const playlist = playlists[playlistId];
      if (!playlist) return new Response("Playlist not found", { status: 404 });

      const artists = await getArtists();
      const albums = await getAlbums();

      const templateObj = await env.media.get("playlist.html");
      if (!templateObj) return new Response("playlist.html template not found in R2", { status: 500 });
      let html = await templateObj.text();

      const formatDate = ts => new Date(ts).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      const playlistTitle = playlist.title;
      const playlistDesc = playlist.description || `A curated playlist by ZEDALBUMS.TOP.`;
      const songCount = playlist.songs?.length || 0;
      const createdDate = formatDate(playlist.created);
      const totalDuration = `${songCount * 4} min`; // placeholder – you can compute real total later

      // Cover image
      let coverHtml = `<i class="fas fa-music"></i>`;
      if (playlist.thumbnail) {
        try {
          const thumbObj = await env.media.get(playlist.thumbnail);
          if (thumbObj) {
            const ext = playlist.thumbnail.split(".").pop();
            const thumbUrl = `/playlists/thumbnails/${encodeURIComponent(playlist.id)}.${ext}`;
            coverHtml = `<img src="${thumbUrl}" alt="${playlistTitle}">`;
          }
        } catch (e) {}
      }

      // Songs list
      const songsHtml = await Promise.all(playlist.songs.map(async (songKey, index) => {
        const [artistId, ...titleParts] = songKey.split("_");
        const title = titleParts.join(" ");
        let artistName = artistId;
        const artist = artists[artistId];
        if (artist) artistName = artist.name;

        let thumbUrl = "/images/placeholder.jpg";
        try {
          const jpg = await env.media.get(`images/${songKey}.jpg`);
          if (jpg) thumbUrl = `/images/${encodeURIComponent(songKey)}.jpg`;
          else {
            const png = await env.media.get(`images/${songKey}.png`);
            if (png) thumbUrl = `/images/${encodeURIComponent(songKey)}.png`;
          }
        } catch (e) {}

        const duration = `${Math.floor(Math.random() * 2) + 3}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
        const trackNum = (index + 1).toString().padStart(2, '0');
        const hasImage = thumbUrl !== '/images/placeholder.jpg';
        return `
          <div class="album-item" onclick="window.location='/song/${encodeURIComponent(songKey + ".mp3")}'">
            <div class="album-thumbnail ${hasImage ? '' : 'song-thumbnail placeholder'}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${artistName} - ${title}</span>
              <div class="album-meta">
                <span class="album-artist">${artistName}</span>
                <span class="song-duration">${duration}</span>
                <span class="album-genre">Track ${trackNum}</span>
              </div>
              <span class="album-date">Track ${trackNum}</span>
            </div>
          </div>
        `;
      })).then(results => results.join(''));

      // Pagination (if needed)
      let paginationHtml = '';
      if (songCount > 12) {
        const totalPages = Math.ceil(songCount / 12);
        paginationHtml = `<div class="pagination-container"><div class="pagination">
          <a href="#" class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</a>
          <a href="#" class="pagination-item active">1</a>
          <span class="pagination-ellipsis">...</span>
          <a href="#" class="pagination-item">${totalPages}</a>
          <a href="#" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>
        </div></div>`;
      }

      // --- RIGHT SIDEBAR: More by primary artist (most frequent in playlist) ---
      const artistCounts = {};
      playlist.songs.forEach(songKey => {
        const [artistId] = songKey.split("_");
        artistCounts[artistId] = (artistCounts[artistId] || 0) + 1;
      });
      let primaryArtistId = Object.keys(artistCounts).sort((a,b) => artistCounts[b] - artistCounts[a])[0] || null;
      let primaryArtistName = primaryArtistId && artists[primaryArtistId] ? artists[primaryArtistId].name : null;

      let moreByArtistHtml = '';
      if (primaryArtistId && primaryArtistName) {
        const artistAlbums = Object.values(albums)
          .filter(a => a.artists?.includes(primaryArtistId))
          .sort((a, b) => b.created - a.created)
          .slice(0, 3);
        moreByArtistHtml = await Promise.all(artistAlbums.map(async a => {
          let thumbUrl = "/images/placeholder.jpg";
          if (a.thumbnail) {
            try {
              const thumbObj = await env.media.get(a.thumbnail);
              if (thumbObj) {
                const ext = a.thumbnail.split(".").pop();
                thumbUrl = `/albums/thumbnails/${encodeURIComponent(a.id)}.${ext}`;
              }
            } catch (e) {}
          }
          const date = formatDate(a.created);
          const hasImage = thumbUrl !== '/images/placeholder.jpg';
          return `
            <div class="album-item" onclick="window.location='/album/${a.id}'">
              <div class="album-thumbnail ${hasImage ? '' : 'placeholder'}">
                ${hasImage ? `<img src="${thumbUrl}" alt="${a.title}" loading="lazy">` : ''}
              </div>
              <div class="album-info">
                <span class="album-title">${primaryArtistName} - ${a.title}</span>
                <div class="album-meta">
                  <span class="album-artist">${primaryArtistName}</span>
                  <span class="album-genre">Album</span>
                </div>
                <span class="album-date">${date}</span>
              </div>
            </div>
          `;
        })).then(r => r.join(''));
        if (artistAlbums.length === 0) {
          moreByArtistHtml = `<div style="padding: 20px; text-align: center; color: #666;">No albums by this artist</div>`;
        }
      } else {
        moreByArtistHtml = `<div style="padding: 20px; text-align: center; color: #666;">No artist information</div>`;
      }

      // --- RIGHT SIDEBAR: Similar Playlists (random 3) ---
      const otherPlaylists = Object.values(playlists).filter(p => p.id !== playlistId).sort(() => 0.5 - Math.random()).slice(0, 3);
      const similarPlaylistsHtml = await Promise.all(otherPlaylists.map(async pl => {
        let thumbUrl = "/images/placeholder.jpg";
        if (pl.thumbnail) {
          try {
            const thumbObj = await env.media.get(pl.thumbnail);
            if (thumbObj) {
              const ext = pl.thumbnail.split(".").pop();
              thumbUrl = `/playlists/thumbnails/${encodeURIComponent(pl.id)}.${ext}`;
            }
          } catch (e) {}
        }
        const songCount = pl.songs?.length || 0;
        const date = formatDate(pl.created);
        const hasImage = thumbUrl !== '/images/placeholder.jpg';
        return `
          <div class="album-item" onclick="window.location='/playlist/${pl.id}'">
            <div class="album-thumbnail playlist-thumbnail">
              ${hasImage ? `<img src="${thumbUrl}" alt="${pl.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${pl.title}</span>
              <div class="album-meta">
                <span class="album-artist playlist-songs">${songCount} Songs</span>
                <span class="album-genre">Playlist</span>
              </div>
              <span class="album-date">${date}</span>
            </div>
          </div>
        `;
      })).then(r => r.join(''));

      // --- RIGHT SIDEBAR: Featured Artists (top 3) ---
      const featuredArtists = Object.values(artists).sort((a,b) => (b.songs?.length || 0) - (a.songs?.length || 0)).slice(0, 3);
      const featuredArtistsHtml = await Promise.all(featuredArtists.map(async a => {
        let thumbUrl = "/images/placeholder.jpg";
        if (a.thumbnail) {
          try {
            const thumbObj = await env.media.get(a.thumbnail);
            if (thumbObj) {
              const ext = a.thumbnail.split(".").pop();
              thumbUrl = `/artists/thumbnails/${encodeURIComponent(a.id)}.${ext}`;
            }
          } catch (e) {}
        }
        const bgStyle = thumbUrl !== '/images/placeholder.jpg'
          ? `style="background-image:url('${thumbUrl}');background-size:cover;background-position:center;"`
          : '';
        const songCount = a.songs?.length || 0;
        const sinceYear = new Date(a.created).getFullYear();
        return `
          <div class="album-item" onclick="window.location='/artist/${a.id}'">
            <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
            <div class="album-info">
              <span class="album-title">${a.name}</span>
              <div class="album-meta">
                <span class="album-artist artist-songs">${songCount} Songs</span>
                <span class="album-genre">Artist</span>
              </div>
              <span class="album-date">Since ${sinceYear}</span>
            </div>
          </div>
        `;
      })).then(r => r.join(''));

      // --- RIGHT SIDEBAR: Playlist Info ---
      const infoHtml = `
        <p><strong>Created:</strong> ${createdDate}</p>
        <p><strong>Songs:</strong> ${songCount}</p>
        <p><strong>Total Duration:</strong> ${totalDuration}</p>
        <p><strong>Genre:</strong> Various</p>
        <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 3px;">
          <i class="fas fa-info-circle" style="color: #00b894;"></i>
          <span style="margin-left: 5px;">All songs available for streaming</span>
        </div>
      `;

      // Replace dynamic parts in the template
      html = html.replace(/<title>.*?<\/title>/, `<title>${playlistTitle} - ZEDALBUMS.TOP</title>`);
      html = html.replace(/<h1 class="playlist-title">.*?<\/h1>/, `<h1 class="playlist-title">${playlistTitle}</h1>`);
      html = html.replace(/<p class="playlist-description">.*?<\/p>/, `<p class="playlist-description">${playlistDesc}</p>`);
      html = html.replace(
        /<div class="playlist-meta">[\s\S]*?<\/div>/,
        `<div class="playlist-meta">
          <div class="playlist-stats"><i class="fas fa-music"></i> ${songCount} Songs</div>
          <div class="playlist-stats"><i class="fas fa-clock"></i> ${totalDuration}</div>
          <div class="playlist-stats"><i class="fas fa-calendar"></i> Created: ${createdDate}</div>
        </div>`
      );
      html = html.replace(/<div class="playlist-cover">[\s\S]*?<\/div>/, `<div class="playlist-cover">${coverHtml}</div>`);
      // Replace the songs list (the whole latest-albums-list inside left sidebar)
      html = html.replace(
        /(<div class="latest-albums-list">)[\s\S]*?(<\/div>\s*<\/aside>)/,
        `$1${songsHtml}$2`
      );
      html = html.replace(/<!-- PAGINATION_HTML -->/, paginationHtml);
      html = html.replace(/<!-- MORE_BY_ARTIST_START -->[\s\S]*?<!-- MORE_BY_ARTIST_END -->/, 
        `<!-- MORE_BY_ARTIST_START -->${moreByArtistHtml}<!-- MORE_BY_ARTIST_END -->`);
      html = html.replace(/<!-- SIMILAR_PLAYLISTS_START -->[\s\S]*?<!-- SIMILAR_PLAYLISTS_END -->/,
        `<!-- SIMILAR_PLAYLISTS_START -->${similarPlaylistsHtml}<!-- SIMILAR_PLAYLISTS_END -->`);
      html = html.replace(/<!-- FEATURED_ARTISTS_START -->[\s\S]*?<!-- FEATURED_ARTISTS_END -->/,
        `<!-- FEATURED_ARTISTS_START -->${featuredArtistsHtml}<!-- FEATURED_ARTISTS_END -->`);
      html = html.replace(/<!-- PLAYLIST_INFO_START -->[\s\S]*?<!-- PLAYLIST_INFO_END -->/,
        `<!-- PLAYLIST_INFO_START -->${infoHtml}<!-- PLAYLIST_INFO_END -->`);

      return new Response(html, {
        headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=300" }
      });
    }

    // =========================
    // SONG DETAIL PAGE - DYNAMIC FROM TEMPLATE
    // =========================
    if (path.startsWith("/song/")) {
      // ... (keep your existing song detail handler) ...
    }

    // =========================
    // HOMEPAGE - DYNAMIC WITH LATEST SONGS AND TRACK COUNTS
    // =========================
    if (path === "/") {
      const now = Date.now();
      if (homepageCache && (now - cacheTimestamp < CACHE_DURATION)) {
        return new Response(homepageCache, {
          headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=30" }
        });
      }

      const templateObj = await env.media.get("index.html");
      if (!templateObj) return new Response("Template index.html not found in R2", { status: 500 });
      let html = await templateObj.text();

      const albums = await getAlbums();
      const artists = await getArtists();
      const playlists = await getPlaylists(); // NEW
      const albumList = Object.values(albums).sort((a, b) => b.created - a.created);
      const artistList = Object.values(artists).sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0));

      // ---------- LATEST ALBUMS with Pagination and TRACK COUNTS ----------
      const ALBUMS_PER_PAGE = 6;
      const page = parseInt(url.searchParams.get("page")) || 1;
      const totalAlbums = albumList.length;
      const totalPages = Math.ceil(totalAlbums / ALBUMS_PER_PAGE);
      const startIdx = (page - 1) * ALBUMS_PER_PAGE;
      const pageAlbums = albumList.slice(startIdx, startIdx + ALBUMS_PER_PAGE);

      const latestAlbumsHtml = await Promise.all(pageAlbums.map(async album => {
        // ... (keep your existing album card generation) ...
      }));

      let paginationHtml = ''; // ... (keep your existing pagination generation) ...

      // ---------- LATEST SONGS ----------
      const songsList = await env.media.list({ prefix: "songs/", limit: 50 });
      const songFiles = songsList.objects || [];
      songFiles.sort((a, b) => b.uploaded - a.uploaded);
      const latestSongs = songFiles.slice(0, 3);
      const latestSongsHtml = await Promise.all(latestSongs.map(async f => {
        // ... (keep your existing latest songs generation) ...
      }));

      // ---------- FEATURED ARTISTS ----------
      const featuredArtists = artistList.slice(0, 4);
      const featuredArtistsHtml = await Promise.all(featuredArtists.map(async artist => {
        // ... (keep your existing featured artists generation) ...
      }));

      // ---------- TOP RATED ----------
      const topRated = Object.values(albums)
        .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
        .slice(0, 3);
      const topRatedHtml = await Promise.all(topRated.map(async album => {
        // ... (keep your existing top rated generation) ...
      }));

      // ---------- QUICK ACCESS (was PLAYLISTS, now renamed) ----------
      const totalSongs = (await env.media.list({ prefix: "songs/" })).objects?.length || 0;
      const quickAccessHtml = `
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

      // ---------- RECENT PLAYLISTS (NEW) ----------
      const recentPlaylists = Object.values(playlists)
        .sort((a, b) => b.created - a.created)
        .slice(0, 3);
      const recentPlaylistsHtml = await Promise.all(recentPlaylists.map(async pl => {
        let thumbUrl = "/images/placeholder.jpg";
        if (pl.thumbnail) {
          try {
            const thumbObj = await env.media.get(pl.thumbnail);
            if (thumbObj) {
              const ext = pl.thumbnail.split(".").pop();
              thumbUrl = `/playlists/thumbnails/${encodeURIComponent(pl.id)}.${ext}`;
            }
          } catch (e) {}
        }
        const songCount = pl.songs?.length || 0;
        const date = new Date(pl.created).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const hasImage = thumbUrl !== '/images/placeholder.jpg';
        return `
          <div class="album-item" onclick="window.location='/playlist/${pl.id}'">
            <div class="album-thumbnail playlist-thumbnail">
              ${hasImage ? `<img src="${thumbUrl}" alt="${pl.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${pl.title}</span>
              <div class="album-meta">
                <span class="album-artist playlist-songs">${songCount} Songs</span>
                <span class="album-genre">Playlist</span>
              </div>
              <span class="album-date">${date}</span>
            </div>
          </div>
        `;
      }));

      // ---------- TRENDING ALBUMS ----------
      const trending = Object.values(albums)
        .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
        .slice(0, 3);
      const trendingHtml = await Promise.all(trending.map(async album => {
        // ... (keep your existing trending generation) ...
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
      // Replace the old PLAYLISTS placeholder with QUICK_ACCESS
      html = html.replace(
        /<!-- PLAYLISTS_START -->[\s\S]*?<!-- PLAYLISTS_END -->/g,
        `<!-- PLAYLISTS_START -->${quickAccessHtml}<!-- PLAYLISTS_END -->`
      );
      // Add new RECENT_PLAYLISTS placeholder (you must add this to your index.html)
      html = html.replace(
        /<!-- RECENT_PLAYLISTS_START -->[\s\S]*?<!-- RECENT_PLAYLISTS_END -->/g,
        `<!-- RECENT_PLAYLISTS_START -->${recentPlaylistsHtml.join('')}<!-- RECENT_PLAYLISTS_END -->`
      );
      html = html.replace(
        /<!-- TRENDING_ALBUMS_START -->[\s\S]*?<!-- TRENDING_ALBUMS_END -->/g,
        `<!-- TRENDING_ALBUMS_START -->${trendingHtml.join('')}<!-- TRENDING_ALBUMS_END -->`
      );

      homepageCache = html;
      cacheTimestamp = now;

      return new Response(html, {
        headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=30" }
      });
    }

    // =========================
    // DOWNLOAD PAGE
    // =========================
    if (path.startsWith("/download/")) {
      const fileName = decodeURIComponent(path.replace("/download/",""));
      const html = `...`; // keep your existing download HTML
      return new Response(html, {
        headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=300" }
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
        headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=604800" }
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
        headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=604800" }
      });
    }

    // NEW: Playlist thumbnails serving
    if (path.startsWith("/playlists/thumbnails/")) {
      const fileName = decodeURIComponent(path.slice(1));
      const obj = await env.media.get(fileName);
      if (!obj) return new Response("Playlist thumbnail not found", { status: 404 });
      let contentType = "application/octet-stream";
      if (fileName.endsWith(".jpg")) contentType = "image/jpeg";
      else if (fileName.endsWith(".png")) contentType = "image/png";
      return new Response(obj.body, {
        headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=604800" }
      });
    }

    // =========================
    // ALBUM-ARTIST ASSIGNMENT ENDPOINT
    // =========================
    if (path === "/assign-album-to-artist" && req.method === "POST") {
      // ... (keep your existing endpoint) ...
    }

    // =========================
    // ADD/REMOVE SONG TO/FROM PLAYLIST (JSON) - NEW
    // =========================
    if (path === "/playlist/add-song" && req.method === "POST") {
      try {
        const { playlistId, songKey } = await req.json();
        await addSongToPlaylist(playlistId, songKey);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }
    }

    if (path === "/playlist/remove-song" && req.method === "POST") {
      try {
        const { playlistId, songKey } = await req.json();
        await removeSongFromPlaylist(playlistId, songKey);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }
    }

    // =========================
    // SIMPLE ALBUM MANAGEMENT PAGE
    // =========================
    if (path === "/manage-album-artists" && req.method === "GET") {
      // ... (keep your existing management page) ...
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
    if (path === "/new-design") {
      return Response.redirect("/", 301);
    }

    return new Response("Not found", { status: 404 });
  }
};