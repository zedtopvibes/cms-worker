// ==================== ALBUMS ROUTES ====================
// ALL IMPORTS AT THE TOP
import { getAlbums, getArtists, getMetadata, saveAlbums } from '../helpers/storage.js';
import { getAggregatedStats } from '../helpers/db.js';
import { formatDuration } from '../helpers/formatting.js';
import { incrementPageView } from '../helpers/pageViews.js';
import { SlugManager } from '../helpers/slug.js';  // ADDED

export async function handleAlbums(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const slugManager = new SlugManager(env);  // ADDED
  
  // Albums list page
  if (path === "/albums") {
    const templateObj = await env.media.get("albums.html");
    if (!templateObj) {
      return new Response("albums.html template not found in R2", { status: 500 });
    }
    let html = await templateObj.text();

    const albums = await getAlbums(env);
    const artists = await getArtists(env);
    
    // Sort albums by created date (newest first)
    const albumList = Object.values(albums).sort((a, b) => b.created - a.created);
    
    // Generate HTML for each album with slug-based links
    const albumsHtml = await Promise.all(albumList.map(async album => {
      // Get artist names
      const artistNames = (album.artists || [])
        .map(aid => artists[aid]?.name || aid)
        .join(', ');
      
      // Get slug for linking
      const albumSlug = await slugManager.getSlugFromId('albums', album.id) || album.id;
      
      // Format date
      const date = album.created ? new Date(album.created) : new Date();
      const formattedDate = date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      
      // Get song count
      const songCount = album.songs?.length || 0;
      
      return `
        <div class="album-item" onclick="window.location='/album/${albumSlug}'">
          <div class="album-thumbnail">
            ${album.thumbnail ? `<img src="${album.thumbnail}" alt="${album.title}">` : '<i class="fas fa-compact-disc"></i>'}
          </div>
          <div class="album-info">
            <span class="album-title">${album.title}</span>
            <div class="album-meta">
              <span class="album-artist">${artistNames}</span>
              <span class="album-songs">${songCount} songs</span>
            </div>
            <span class="album-date">${formattedDate}</span>
          </div>
        </div>
      `;
    }));
    
    // Replace placeholder in template
    html = html.replace('<!-- ALBUMS_LIST -->', albumsHtml.join(''));
    
    return new Response(html, { 
      headers: { 
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300"
      } 
    });
  }
  
  // Album detail page - Strict slug-only lookup
  if (path.startsWith("/album/") && !path.startsWith("/album/create")) {
    // Get slug from URL
    const slug = decodeURIComponent(path.replace("/album/", ""));
    
    // Get album ID from slug - if null, album doesn't exist (404)
    const albumId = await slugManager.getIdFromSlug('albums', slug);
    
    if (!albumId) {
      return new Response("Album not found", { status: 404 });
    }
    
    const albums = await getAlbums(env);
    const album = albums[albumId];
    const artists = await getArtists(env);
    
    if (!album) {
      return new Response("Album not found", { status: 404 });
    }

    // TRACK PAGE VIEW
    ctx.waitUntil(incrementPageView(env, 'album', albumId));

    const albumStats = await getAggregatedStats(album.songs || [], env);

    const templateObj = await env.media.get("album.html");
    if (!templateObj) {
      return new Response("album.html template not found in R2", { status: 500 });
    }
    let html = await templateObj.text();

    // Get artist names
    const artistNames = (album.artists || [])
      .map(aid => artists[aid]?.name || aid)
      .join(', ');
    
    // Get primary artist for display
    const primaryArtistId = album.artists?.[0] || '';
    const primaryArtistName = artists[primaryArtistId]?.name || primaryArtistId;
    
    // Format date
    const releaseDate = album.created ? new Date(album.created) : new Date();
    const formattedDate = releaseDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    
    // Get song count
    const songCount = album.songs?.length || 0;
    const totalPlays = albumStats.plays.toLocaleString();
    const totalDownloads = albumStats.downloads.toLocaleString();
    
    // Calculate total duration
    let totalDuration = 0;
    const songsWithDetails = await Promise.all((album.songs || []).map(async (songKey, index) => {
      const meta = await getMetadata(env, songKey);
      const songSlug = await slugManager.getSlugFromId('songs', songKey) || songKey;
      
      const duration = meta?.duration || 0;
      totalDuration += duration;
      
      // Get song title
      let songTitle = meta?.title || songKey.split("_").slice(1).join(" ");
      
      // Get artist display
      let artistDisplay = '';
      if (meta) {
        const primary = artists[meta.primaryArtist]?.name || meta.primaryArtist;
        const featured = (meta.featuredArtists || []).map(fid => artists[fid]?.name || fid).join(', ');
        artistDisplay = featured ? `${primary} feat. ${featured}` : primary;
      } else {
        const [sid] = songKey.split("_");
        artistDisplay = artists[sid]?.name || sid;
      }
      
      // Get thumbnail
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
      } catch (e) {}
      
      const durationFormatted = formatDuration(duration);
      const trackNum = (index + 1).toString().padStart(2, '0');
      
      return {
        html: `
          <div class="album-item" onclick="window.location='/song/${songSlug}'">
            <div class="album-thumbnail">
              <img src="${thumbUrl}" alt="${songTitle}" loading="lazy">
            </div>
            <div class="album-info">
              <span class="album-title">${songTitle}</span>
              <div class="album-meta">
                <span class="album-artist">${artistDisplay}</span>
                <span class="song-duration">${durationFormatted}</span>
              </div>
              <span class="album-date">Track ${trackNum}</span>
            </div>
          </div>
        `,
        duration
      };
    }));
    
    const songsHtml = songsWithDetails.map(s => s.html).join('');
    const totalDurationFormatted = formatDuration(totalDuration);
    
    // Get similar albums (by same artists or same genre)
    const similarAlbums = Object.values(albums)
      .filter(a => a.id !== albumId)
      .filter(a => {
        // Check if shares any artists
        const sharesArtists = (a.artists || []).some(aid => album.artists?.includes(aid));
        // Check if same genre
        const sameGenre = a.genre && a.genre === album.genre;
        return sharesArtists || sameGenre;
      })
      .sort((a, b) => b.created - a.created)
      .slice(0, 3);
    
    const similarAlbumsHtml = await Promise.all(similarAlbums.map(async a => {
      const albumSlug = await slugManager.getSlugFromId('albums', a.id) || a.id;
      
      const artistName = a.artists?.map(aid => artists[aid]?.name || aid).join(', ') || 'Various Artists';
      const songCount = a.songs?.length || 0;
      const date = a.created ? new Date(a.created) : new Date();
      const year = date.getFullYear();
      
      return `
        <div class="album-item" onclick="window.location='/album/${albumSlug}'">
          <div class="album-thumbnail">
            ${a.thumbnail ? `<img src="${a.thumbnail}" alt="${a.title}">` : '<i class="fas fa-compact-disc"></i>'}
          </div>
          <div class="album-info">
            <span class="album-title">${a.title}</span>
            <div class="album-meta">
              <span class="album-artist">${artistName}</span>
              <span class="album-songs">${songCount} songs</span>
            </div>
            <span class="album-date">${year}</span>
          </div>
        </div>
      `;
    }));
    
    const artistSlug = await slugManager.getSlugFromId('artists', primaryArtistId) || primaryArtistId;
    
    // Replace template placeholders
    html = html
      .replace(/<title>.*?<\/title>/, `<title>${album.title} by ${artistNames} - ZEDALBUMS</title>`)
      .replace('<!-- ALBUM_TITLE -->', album.title)
      .replace('<!-- ALBUM_ARTIST -->', artistNames)
      .replace('<!-- ALBUM_RELEASE_DATE -->', formattedDate)
      .replace('<!-- ALBUM_SONG_COUNT -->', songCount.toString())
      .replace('<!-- ALBUM_TOTAL_PLAYS -->', totalPlays)
      .replace('<!-- ALBUM_TOTAL_DOWNLOADS -->', totalDownloads)
      .replace('<!-- ALBUM_TOTAL_DURATION -->', totalDurationFormatted)
      .replace('<!-- ALBUM_DESCRIPTION -->', album.description || `${album.title} album by ${artistNames}. Released ${formattedDate}.`)
      .replace('<!-- SONGS_LIST -->', songsHtml)
      .replace('<!-- SIMILAR_ALBUMS_LIST -->', similarAlbumsHtml.length ? similarAlbumsHtml.join('') : '<div style="padding: 20px; text-align: center; color: #666;">No similar albums found</div>')
      .replace(
        /<a href="\/artist\/[^"]*" class="view-all">/g,
        `<a href="/artist/${artistSlug}" class="view-all">`
      );
    
    // Update breadcrumb
    html = html.replace(
      /<a href="\/" class="breadcrumb-link">/g,
      '<a href="/" class="breadcrumb-link">Home</a>'
    );
    html = html.replace(
      /<a href="\/albums" class="breadcrumb-link">/g,
      '<a href="/albums" class="breadcrumb-link">Albums</a>'
    );
    html = html.replace(
      /<span class="breadcrumb-current">.*?<\/span>/,
      `<span class="breadcrumb-current">${album.title}</span>`
    );
    
    return new Response(html, { 
      headers: { 
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300"
      } 
    });
  }
  
  // Album create page (GET)
  if (path === "/album/create" && req.method === "GET") {
    const artists = await getArtists(env);
    
    const artistOptions = Object.values(artists)
      .map(artist => `<option value="${artist.id}">${artist.name}</option>`)
      .join('');
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Create Album - ZEDALBUMS</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: system-ui; max-width: 600px; margin: 2rem auto; padding: 1rem; background: #f4f4f9; }
        .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #333; border-left: 4px solid #ff5500; padding-left: 15px; margin-top: 0; }
        label { display: block; margin-top: 15px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 12px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
        button { margin-top: 25px; padding: 14px; background: #ff5500; color: #fff; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-size: 16px; }
        button:hover { background: #e64c00; }
        .back-link { margin-top: 20px; text-align: center; }
        .back-link a { color: #666; text-decoration: none; }
        .back-link a:hover { color: #ff5500; }
        .url-preview { margin-top: 10px; background: #f0f0f0; padding: 10px; border-radius: 6px; font-size: 0.9rem; }
        .url-preview code { background: white; padding: 4px 8px; border-radius: 4px; display: block; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Create New Album</h1>
        <form action="/album/create" method="POST" enctype="multipart/form-data">
          <label>Album Title</label>
          <input type="text" name="title" id="albumTitle" required>
          
          <div class="url-preview">
            <small>Album URL will be:</small>
            <code id="urlPreview">/album/...</code>
          </div>
          
          <label>Artists (select multiple)</label>
          <select name="artists" multiple size="5">
            ${artistOptions}
          </select>
          <small style="color: #666;">Hold Ctrl/Cmd to select multiple</small>
          
          <label>Genre</label>
          <input type="text" name="genre" placeholder="e.g. Hip Hop, R&B">
          
          <label>Release Date</label>
          <input type="date" name="releaseDate">
          
          <label>Description</label>
          <textarea name="description" rows="3"></textarea>
          
          <label>Album Cover (Optional)</label>
          <input type="file" name="thumbnail" accept="image/*">
          
          <button type="submit">Create Album</button>
        </form>
        <div class="back-link">
          <a href="/admin">← Back to Admin</a>
        </div>
      </div>
      
      <script>
        const titleInput = document.getElementById('albumTitle');
        const urlPreview = document.getElementById('urlPreview');
        
        function generateSlug(text) {
          if (!text) return 'untitled';
          return text
            .toLowerCase()
            .replace(/[^a-z0-9\\s-]/g, '')
            .replace(/\\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'untitled';
        }
        
        function updatePreview() {
          const slug = generateSlug(titleInput.value);
          urlPreview.textContent = '/album/' + slug;
        }
        
        titleInput.addEventListener('input', updatePreview);
        updatePreview();
      </script>
    </body>
    </html>
    `;
    
    return new Response(html, { 
      headers: { "Content-Type": "text/html" } 
    });
  }

  // Album create handler (POST)
  if (path === "/album/create" && req.method === "POST") {
    try {
      const formData = await req.formData();
      const title = formData.get('title');
      const artistsSelected = formData.getAll('artists');
      const genre = formData.get('genre') || '';
      const releaseDate = formData.get('releaseDate');
      const description = formData.get('description') || '';
      const thumbnailFile = formData.get('thumbnail');
      
      if (!title || artistsSelected.length === 0) {
        return new Response("Missing required fields", { status: 400 });
      }
      
      // Generate album ID from title
      const albumId = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      
      // Get existing albums
      const albums = await getAlbums(env);
      
      // Check if album already exists
      if (albums[albumId]) {
        return new Response("Album with this title already exists", { status: 400 });
      }
      
      // Handle thumbnail upload
      let thumbnailKey = null;
      if (thumbnailFile && thumbnailFile.size > 0) {
        const ext = thumbnailFile.type.includes('png') ? 'png' : 'jpg';
        thumbnailKey = `albums/thumbnails/${albumId}.${ext}`;
        await env.media.put(thumbnailKey, thumbnailFile.stream());
      }

      // Create album object
      albums[albumId] = {
        id: albumId,
        title: title,
        artists: artistsSelected,
        genre: genre,
        releaseDate: releaseDate || null,
        description: description,
        thumbnail: thumbnailKey,
        created: Date.now(),
        songs: []
      };
      
      // Save albums
      await saveAlbums(env, albums);

      // Generate and register slug
      const slugManager = new SlugManager(env);
      const baseSlug = slugManager.generateAlbumSlug(title);
      const finalSlug = await slugManager.generateUniqueSlug('albums', baseSlug);
      await slugManager.registerSlug('albums', albumId, finalSlug, {
        title,
        artists: artistsSelected,
        genre,
        created: Date.now()
      });
      
      // Success page
      const successHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Album Created - ZEDALBUMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui; max-width: 500px; margin: 2rem auto; padding: 1rem; background: #f4f4f9; text-align: center; }
          .success { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h1 { color: #28a745; }
          .url { background: #f0f0f0; padding: 10px; border-radius: 6px; word-break: break-all; font-family: monospace; margin: 20px 0; }
          .btn { display: inline-block; margin: 10px; padding: 12px 24px; background: #ff5500; color: white; text-decoration: none; border-radius: 6px; }
          .btn:hover { background: #e64c00; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✅ Album Created!</h1>
          <p style="font-size: 1.2rem;">${title}</p>
          <div class="url">/album/${finalSlug}</div>
          <a href="/album/${finalSlug}" class="btn">View Album</a>
          <a href="/album/create" class="btn" style="background: #6c757d;">Create Another</a>
        </div>
      </body>
      </html>
      `;
      
      return new Response(successHtml, { 
        headers: { "Content-Type": "text/html" } 
      });
      
    } catch (error) {
      return new Response(`Error creating album: ${error.message}`, { status: 500 });
    }
  }

  return new Response("Not found", { status: 404 });
}