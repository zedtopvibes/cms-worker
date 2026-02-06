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
          });
        </script>
      </head>
      <body>
        <h1>Upload Song</h1>
        <form action="/upload" method="POST" enctype="multipart/form-data">
          <label>Song Title</label>
          <input type="text" name="title" required>

          <label>Artist Name</label>
          <input type="text" name="artist" required>

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

      if (!title || !artist || !audioFile || !imageFile) {
        return new Response("Missing fields", { status: 400 });
      }

      const safeTitle = sanitize(title);
      const safeArtist = sanitize(artist);
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

    return new Response("Not found", { status: 404 });
  }
};