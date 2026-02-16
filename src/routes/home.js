// ==================== HOMEPAGE  ROUTE ====================
import { incrementPageView } from '../helpers/pageViews.js';
import { getAlbums, getArtists, getPlaylists, getMetadata } from '../helpers/storage.js';

// Cache for homepage
let homepageCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000;

export async function handleHomepage(req, env, ctx) {
  const url = new URL(req.url);
  const now = Date.now();

  // Track homepage view
  ctx.waitUntil(incrementPageView(env, 'page', 'homepage'));
  
  // Return cached version if available
  if (homepageCache && (now - cacheTimestamp < CACHE_DURATION)) {
    return new Response(homepageCache, { 
      headers: { 
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=30"
      } 
    });
  }

  // Get template
  const templateObj = await env.media.get("index.html");
  if (!templateObj) {
    return new Response("Template index.html not found in R2", { status: 500 });
  }
  let html = await templateObj.text();

  // Get data
  const albums = await getAlbums(env);
  const artists = await getArtists(env);
  const playlists = await getPlaylists(env);
  const albumList = Object.values(albums).sort((a, b) => b.created - a.created);
  const artistList = Object.values(artists).sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0));

  // Pagination
  const ALBUMS_PER_PAGE = 6;
  const page = parseInt(url.searchParams.get("page")) || 1;
  const totalAlbums = albumList.length;
  const totalPages = Math.ceil(totalAlbums / ALBUMS_PER_PAGE);
  const startIdx = (page - 1) * ALBUMS_PER_PAGE;
  const pageAlbums = albumList.slice(startIdx, startIdx + ALBUMS_PER_PAGE);

  // Generate latest albums HTML
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

    const trackCount = album.songs?.length || 0;
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

  // Get latest songs
  const songsList = await env.media.list({ prefix: "songs/", limit: 50 });
  const songFiles = songsList.objects || [];
  songFiles.sort((a, b) => b.uploaded - a.uploaded);
  const latestSongs = songFiles.slice(0, 3);
  
  const latestSongsHtml = await Promise.all(latestSongs.map(async f => {
    const fileName = f.key.split("/")[1];
    const baseName = fileName.replace(".mp3", "");
    const meta = await getMetadata(env, baseName);
    let title = meta ? meta.title : baseName.split("_").slice(1).join(" ");
    let artistDisplay = "";
    if (meta) {
      const primary = artists[meta.primaryArtist]?.name || meta.primaryArtist;
      const featured = meta.featuredArtists.map(fid => artists[fid]?.name || fid).join(', ');
      artistDisplay = featured ? `${primary} feat. ${featured}` : primary;
    } else {
      const [artistId] = baseName.split("_");
      const artist = artists[artistId];
      artistDisplay = artist ? artist.name : artistId;
    }
    
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
            <span class="album-artist">${artistDisplay}</span>
            <span class="song-stats">Single</span>
          </div>
          <span class="album-date">${formattedDate}</span>
        </div>
      </div>
    `;
  }));

  // Featured artists
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
      <div class="album-item" onclick="window.location='/artist/${artist.id}'">
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

  // Top rated albums
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

    const trackCount = album.songs?.length || 0;
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
            <span class="album-tracks">${trackCount} Tracks</span>
          </div>
          <span class="album-date">${date}</span>
        </div>
      </div>
    `;
  }));

  // Featured playlists
  const featuredPlaylists = Object.values(playlists)
    .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
    .slice(0, 3);
  
  const featuredPlaylistsHtml = await Promise.all(featuredPlaylists.map(async playlist => {
    let thumbUrl = "/images/placeholder.jpg";
    let hasImage = false;
    if (playlist.thumbnail) {
      try {
        const thumbObj = await env.media.get(playlist.thumbnail);
        if (thumbObj) {
          const ext = playlist.thumbnail.split(".").pop();
          thumbUrl = `/playlists/thumbnails/${encodeURIComponent(playlist.id)}.${ext}`;
          hasImage = true;
        }
      } catch (e) {}
    }

    const songCount = playlist.songs?.length || 0;
    const date = new Date(playlist.created);
    const formattedDate = date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });

    const thumbnailClass = hasImage ? '' : 'playlist-thumbnail';
    const thumbnailContent = hasImage ? `<img src="${thumbUrl}" alt="${playlist.title}" loading="lazy">` : '';
    
    return `
      <div class="album-item" onclick="window.location='/playlist/${playlist.id}'">
        <div class="album-thumbnail ${thumbnailClass}">
          ${thumbnailContent}
        </div>
        <div class="album-info">
          <span class="album-title">${playlist.title}</span>
          <div class="album-meta">
            <span class="playlist-songs">${songCount} Songs</span>
            <span class="album-genre">Playlist</span>
          </div>
          <span class="album-date">${formattedDate}</span>
        </div>
      </div>
    `;
  }));

  // Trending albums
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

    const trackCount = album.songs?.length || 0;
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
            <span class="album-tracks">${trackCount} Tracks</span>
          </div>
          <span class="album-date">${date}</span>
        </div>
      </div>
    `;
  }));

  // Replace all placeholders
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
    /<!-- FEATURED_PLAYLISTS_START -->[\s\S]*?<!-- FEATURED_PLAYLISTS_END -->/g,
    `<!-- FEATURED_PLAYLISTS_START -->${featuredPlaylistsHtml.join('')}<!-- FEATURED_PLAYLISTS_END -->`
  );
  
  html = html.replace(
    /<!-- TRENDING_ALBUMS_START -->[\s\S]*?<!-- TRENDING_ALBUMS_END -->/g,
    `<!-- TRENDING_ALBUMS_START -->${trendingHtml.join('')}<!-- TRENDING_ALBUMS_END -->`
  );

  // Update cache
  homepageCache = html;
  cacheTimestamp = now;

  return new Response(html, { 
    headers: { 
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=30"
    } 
  });
}