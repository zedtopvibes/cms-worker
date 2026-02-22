// ==================== PLAYLISTS ROUTES ====================
// ALL IMPORTS AT THE TOP
import { incrementPageView } from '../helpers/pageViews.js';
import { getPlaylists, getAlbums, getArtists, getMetadata, savePlaylists } from '../helpers/storage.js';
import { getAggregatedStats } from '../helpers/db.js';
import { sanitize, formatDuration } from '../helpers/formatting.js';
// REMOVE: import { SlugManager } from '../helpers/slug.js';

export async function handlePlaylists(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  // REMOVE: const slugManager = new SlugManager(env);

  // Playlists list page
  if (path === "/playlists") {
    const templateObj = await env.media.get("playlists.html");
    if (!templateObj) {
      return new Response("playlists.html template not found in R2", { status: 500 });
    }
    let html = await templateObj.text();

    const playlists = await getPlaylists(env);
    const albums = await getAlbums(env);
    const artists = await getArtists(env);

    let playlistList = Object.values(playlists).sort((a, b) => b.created - a.created);
    
    const artistId = url.searchParams.get("artist");
    let filterArtistName = "";
    let filteredPlaylists = playlistList;
    
    if (artistId) {
      const artist = artists[artistId];
      if (artist) {
        filterArtistName = artist.name;
        
        filteredPlaylists = [];
        
        for (const playlist of playlistList) {
          if (!playlist.songs) continue;
          
          for (const songKey of playlist.songs) {
            const meta = await getMetadata(env, songKey);
            if (meta) {
              if (meta.primaryArtist === artistId || meta.featuredArtists.includes(artistId)) {
                filteredPlaylists.push(playlist);
                break;
              }
            } else if (songKey.startsWith(artistId + "_")) {
              filteredPlaylists.push(playlist);
              break;
            }
          }
        }
      }
    }
    
    const displayPlaylists = filteredPlaylists;

    const ITEMS_PER_PAGE = 10;
    const page = parseInt(url.searchParams.get("page")) || 1;
    const totalPlaylists = displayPlaylists.length;
    const totalPages = Math.ceil(totalPlaylists / ITEMS_PER_PAGE);
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const pagePlaylists = displayPlaylists.slice(startIdx, startIdx + ITEMS_PER_PAGE);

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

      // REMOVE slug lookup - use pl.id directly
      // const playlistSlug = await slugManager.getSlugFromId('playlists', pl.id) || pl.id;

      const songCount = pl.songs?.length || 0;
      const date = new Date(pl.created);
      const formattedDate = date.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      const thumbnailClass = hasImage ? '' : 'playlist-thumbnail';
      const thumbnailContent = hasImage
        ? `<img src="${thumbUrl}" alt="${pl.title}" loading="lazy">`
        : '';

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
            <span class="album-date">${formattedDate}</span>
          </div>
        </div>
      `;
    }));

    let paginationHtmlPlaylists = '';
    if (totalPages > 1) {
      let baseUrl = '/playlists';
      if (artistId) {
        baseUrl += `?artist=${artistId}&`;
      } else {
        baseUrl += '?';
      }
      
      paginationHtmlPlaylists = `<div class="pagination-container"><div class="pagination">`;
      paginationHtmlPlaylists += `<a href="${baseUrl}page=${page-1}" class="pagination-item pagination-prev ${page === 1 ? 'disabled' : ''}"><i class="fas fa-chevron-left"></i> Prev</a>`;
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page-2 && i <= page+2)) {
          paginationHtmlPlaylists += `<a href="${baseUrl}page=${i}" class="pagination-item ${i === page ? 'active' : ''}">${i}</a>`;
        } else if (i === page-3 || i === page+3) {
          paginationHtmlPlaylists += `<span class="pagination-ellipsis">...</span>`;
        }
      }
      paginationHtmlPlaylists += `<a href="${baseUrl}page=${page+1}" class="pagination-item pagination-next ${page === totalPages ? 'disabled' : ''}">Next <i class="fas fa-chevron-right"></i></a>`;
      paginationHtmlPlaylists += `</div></div>`;
    }

    let filterHeaderHtml = '';
    if (artistId && filterArtistName) {
      filterHeaderHtml = `
        <div class="filter-header" style="padding: 15px; background: #f0f7ff; border-radius: 3px; margin-bottom: 15px; border-left: 4px solid #4a90e2;">
          <i class="fas fa-filter" style="color: #4a90e2;"></i>
          <strong>Showing playlists featuring ${filterArtistName}</strong>
          <a href="/playlists" style="margin-left: 15px; color: #ff5500; text-decoration: none;">Clear filter ✕</a>
        </div>
      `;
    }

    const featured = playlistList
      .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
      .slice(0, 3);

    const featuredHtml = await Promise.all(featured.map(async pl => {
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
      
      // REMOVE slug lookup - use pl.id directly
      // const playlistSlug = await slugManager.getSlugFromId('playlists', pl.id) || pl.id;
      
      const songCount = pl.songs?.length || 0;
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
              <span class="album-genre">Editor's Pick</span>
            </div>
            <span class="album-date">Featured</span>
          </div>
        </div>
      `;
    }));

    const topArtistsPlaylist = Object.values(artists)
      .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
      .slice(0, 3);

    const topArtistsHtmlPlaylist = await Promise.all(topArtistsPlaylist.map(async artist => {
      let thumbUrl = "/images/placeholder.jpg";
      let hasImage = false;
      if (artist.thumbnail) {
        try {
          const thumbObj = await env.media.get(artist.thumbnail);
          if (thumbObj) {
            const ext = artist.thumbnail.split(".").pop();
            thumbUrl = `/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}`;
            hasImage = true;
          }
        } catch (e) {}
      }
      
      // REMOVE slug lookup - use artist.id directly
      // const artistSlug = await slugManager.getSlugFromId('artists', artist.id) || artist.id;
      
      const bgStyle = hasImage
        ? `style="background-image:url('${thumbUrl}');background-size:cover;background-position:center;"`
        : '';
      const songCount = artist.songs?.length || 0;
      return `
        <div class="album-item" onclick="window.location='/artist/${artist.id}'">
          <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
          <div class="album-info">
            <span class="album-title">${artist.name}</span>
            <div class="album-meta">
              <span class="album-artist artist-songs">${songCount} Songs</span>
              <span class="album-genre">${artist.genre || 'Artist'}</span>
            </div>
            <span class="album-date">Top artist</span>
          </div>
        </div>
      `;
    }));

    const recent = playlistList
      .sort((a, b) => b.created - a.created)
      .slice(0, 3);

    const recentHtml = await Promise.all(recent.map(async pl => {
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
      
      // REMOVE slug lookup - use pl.id directly
      // const playlistSlug = await slugManager.getSlugFromId('playlists', pl.id) || pl.id;
      
      const songCount = pl.songs?.length || 0;
      const date = new Date(pl.created);
      const now = new Date();
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      const timeAgo = diffDays === 0 ? 'Today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
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
            <span class="album-date">${timeAgo}</span>
          </div>
        </div>
      `;
    }));

    const genresHtmlPlaylist = `
      <div class="album-item">
        <div class="album-thumbnail placeholder"></div>
        <div class="album-info">
          <span class="album-title">Zam Hip Hop</span>
          <div class="album-meta">
            <span class="album-artist">24 Playlists</span>
            <span class="album-genre">Popular</span>
          </div>
          <span class="album-date">Most active</span>
        </div>
      </div>
      <div class="album-item">
        <div class="album-thumbnail placeholder"></div>
        <div class="album-info">
          <span class="album-title">Zam Pop</span>
          <div class="album-meta">
            <span class="album-artist">18 Playlists</span>
            <span class="album-genre">Trending</span>
          </div>
          <span class="album-date">+5 this week</span>
        </div>
      </div>
      <div class="album-item">
        <div class="album-thumbnail placeholder"></div>
        <div class="album-info">
          <span class="album-title">Gospel</span>
          <div class="album-meta">
            <span class="album-artist">12 Playlists</span>
            <span class="album-genre">Spiritual</span>
          </div>
          <span class="album-date">Rising</span>
        </div>
      </div>
    `;

    html = html.replace(
      /<!-- FILTER_HEADER_START -->[\s\S]*?<!-- FILTER_HEADER_END -->/g,
      `<!-- FILTER_HEADER_START -->${filterHeaderHtml}<!-- FILTER_HEADER_END -->`
    );
    
    html = html.replace(
      /<!-- PLAYLISTS_START -->[\s\S]*?<!-- PLAYLISTS_END -->/g,
      `<!-- PLAYLISTS_START -->${playlistsHtml.join('')}<!-- PLAYLISTS_END -->`
    );
    
    html = html.replace(
      /<!-- PAGINATION_START -->[\s\S]*?<!-- PAGINATION_END -->/g,
      `<!-- PAGINATION_START -->${paginationHtmlPlaylists}<!-- PAGINATION_END -->`
    );
    
    html = html.replace(
      /<!-- FEATURED_PLAYLISTS_START -->[\s\S]*?<!-- FEATURED_PLAYLISTS_END -->/g,
      `<!-- FEATURED_PLAYLISTS_START -->${featuredHtml.join('')}<!-- FEATURED_PLAYLISTS_END -->`
    );
    
    html = html.replace(
      /<!-- TOP_ARTISTS_START -->[\s\S]*?<!-- TOP_ARTISTS_END -->/g,
      `<!-- TOP_ARTISTS_START -->${topArtistsHtmlPlaylist.join('')}<!-- TOP_ARTISTS_END -->`
    );
    
    html = html.replace(
      /<!-- GENRES_START -->[\s\S]*?<!-- GENRES_END -->/g,
      `<!-- GENRES_START -->${genresHtmlPlaylist}<!-- GENRES_END -->`
    );
    
    html = html.replace(
      /<!-- RECENT_PLAYLISTS_START -->[\s\S]*?<!-- RECENT_PLAYLISTS_END -->/g,
      `<!-- RECENT_PLAYLISTS_START -->${recentHtml.join('')}<!-- RECENT_PLAYLISTS_END -->`
    );
    
    if (artistId && filterArtistName) {
      html = html.replace(
        /<title>.*?<\/title>/,
        `<title>Playlists featuring ${filterArtistName} - ZEDALBUMS</title>`
      );
    }

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300"
      }
    });
  }

  // Playlist detail page
  if (path.startsWith("/playlist/") && !path.startsWith("/playlist/create")) {
    // Get ID from URL
    const playlistId = decodeURIComponent(path.replace("/playlist/", ""));
    
    // REMOVE slug lookup - use playlistId directly
    // const playlistId = await slugManager.getIdFromSlug('playlists', slug);
    
    if (!playlistId) {
      return new Response("Playlist not found", { status: 404 });
    }

    const playlists = await getPlaylists(env);
    const playlist = playlists[playlistId];
    if (!playlist) return new Response("Playlist not found", { status: 404 });

    // TRACK PAGE VIEW
    ctx.waitUntil(incrementPageView(env, 'playlist', playlistId));

    const playlistStats = await getAggregatedStats(playlist.songs || [], env);

    const templateObj = await env.media.get("playlist.html");
    if (!templateObj) {
      return new Response("playlist.html template not found in R2", { status: 500 });
    }
    let html = await templateObj.text();

    const albums = await getAlbums(env);
    const artists = await getArtists(env);

    const songCount = playlist.songs?.length || 0;
    const createdDate = new Date(playlist.created);
    const formattedDate = createdDate.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    // Calculate total duration
    let totalSeconds = 0;
    if (playlist.songs) {
      const durations = await Promise.all(playlist.songs.map(async songKey => {
        const meta = await getMetadata(env, songKey);
        return meta?.duration || 0;
      }));
      totalSeconds = durations.reduce((acc, dur) => acc + dur, 0);
    }
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
    const totalDuration = totalHours > 0 ? `${totalHours} hr ${totalMinutes} min` : `${totalMinutes} min`;

    let hasCover = false;
    let coverHtml = `<i class="fas fa-music"></i>`;
    if (playlist.thumbnail) {
      try {
        const thumbObj = await env.media.get(playlist.thumbnail);
        if (thumbObj) {
          const ext = playlist.thumbnail.split(".").pop();
          const thumbUrl = `/playlists/thumbnails/${encodeURIComponent(playlist.id)}.${ext}`;
          hasCover = true;
          coverHtml = `<img src="${thumbUrl}" alt="${playlist.title}">`;
        }
      } catch (e) {}
    }

    const songsHtml = await Promise.all((playlist.songs || []).map(async (songKey, index) => {
      const meta = await getMetadata(env, songKey);
      // REMOVE slug lookup - use songKey directly
      // const songSlug = await slugManager.getSlugFromId('songs', songKey) || songKey;
      
      let title = meta ? meta.title : songKey.split("_").slice(1).join(" ");
      let artistDisplay = "";
      if (meta) {
        const primary = artists[meta.primaryArtist]?.name || meta.primaryArtist;
        const featured = meta.featuredArtists.map(fid => artists[fid]?.name || fid).join(', ');
        artistDisplay = featured ? `${primary} feat. ${featured}` : primary;
      } else {
        const [artistId] = songKey.split("_");
        const artist = artists[artistId];
        artistDisplay = artist ? artist.name : artistId;
      }

      let thumbUrl = "/images/placeholder.jpg";
      let hasImage = false;
      try {
        const jpgObj = await env.media.get(`images/${songKey}.jpg`);
        if (jpgObj) {
          thumbUrl = `/images/${encodeURIComponent(songKey)}.jpg`;
          hasImage = true;
        } else {
          const pngObj = await env.media.get(`images/${songKey}.png`);
          if (pngObj) {
            thumbUrl = `/images/${encodeURIComponent(songKey)}.png`;
            hasImage = true;
          }
        }
      } catch (e) {}

      const durationSeconds = meta?.duration || 0;
      const durationFormatted = formatDuration(durationSeconds);
      const trackNumber = (index + 1).toString().padStart(2, '0');

      return `
        <div class="album-item" onclick="window.location='/song/${songKey}?playlist=${playlistId}'">
          <div class="album-thumbnail ${hasImage ? '' : 'song-thumbnail placeholder'}">
            ${hasImage ? `<img src="${thumbUrl}" alt="${title}" loading="lazy">` : ''}
          </div>
          <div class="album-info">
            <span class="album-title">${artistDisplay} - ${title}</span>
            <div class="album-meta">
              <span class="album-artist">${artistDisplay}</span>
              <span class="song-duration">${durationFormatted}</span>
              <span class="album-genre">Track ${trackNumber}</span>
            </div>
            <span class="album-date">Track ${trackNumber}</span>
          </div>
        </div>
      `;
    })).then(results => results.join(''));

    let paginationHtmlPlaylist = '';
    if (songCount > 12) {
      const totalPages = Math.ceil(songCount / 12);
      paginationHtmlPlaylist = `<div class="pagination-container"><div class="pagination">
        <a href="#" class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</a>
        <a href="#" class="pagination-item active">1</a>
        <a href="#" class="pagination-item">2</a>
        <span class="pagination-ellipsis">...</span>
        <a href="#" class="pagination-item">${totalPages}</a>
        <a href="#" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>
      </div></div>`;
    }

    let mainArtistId = null;
    let mainArtistName = null;
    if (playlist.songs && playlist.songs.length > 0) {
      const firstSongKey = playlist.songs[0];
      const meta = await getMetadata(env, firstSongKey);
      if (meta) {
        mainArtistId = meta.primaryArtist;
      } else {
        const [aid] = firstSongKey.split("_");
        mainArtistId = aid;
      }
      const artist = artists[mainArtistId];
      if (artist) {
        mainArtistName = artist.name;
      }
    }

    let moreByArtistHtml = '';
    if (mainArtistId) {
      const artistAlbums = Object.values(albums)
        .filter(a => a.artists?.includes(mainArtistId))
        .sort((a, b) => b.created - a.created)
        .slice(0, 3);
      moreByArtistHtml = await Promise.all(artistAlbums.map(async album => {
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
        // REMOVE slug lookup - use album.id directly
        // const albumSlug = await slugManager.getSlugFromId('albums', album.id) || album.id;
        
        const date = new Date(album.created).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
        return `
          <div class="album-item" onclick="window.location='/album/${album.id}'">
            <div class="album-thumbnail ${hasImage ? '' : 'placeholder'}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${album.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${mainArtistName} - ${album.title}</span>
              <div class="album-meta">
                <span class="album-artist">${mainArtistName}</span>
                <span class="album-genre">Album</span>
              </div>
              <span class="album-date">${date}</span>
            </div>
          </div>
        `;
      })).then(results => results.join(''));
      if (artistAlbums.length === 0) {
        moreByArtistHtml = `<div style="padding: 20px; text-align: center; color: #666;">No albums by this artist</div>`;
      }
    } else {
      moreByArtistHtml = `<div style="padding: 20px; text-align: center; color: #666;">No artist found</div>`;
    }

    const similarPlaylists = Object.values(playlists)
      .filter(p => p.id !== playlistId && p.songs && p.songs.length > 0)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const similarHtml = await Promise.all(similarPlaylists.map(async pl => {
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
      
      // REMOVE slug lookup - use pl.id directly
      // const playlistSlug = await slugManager.getSlugFromId('playlists', pl.id) || pl.id;
      
      const songCount = pl.songs?.length || 0;
      const date = new Date(pl.created).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
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
    })).then(results => results.join(''));

    const featuredArtistsPlaylist = Object.values(artists)
      .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
      .slice(0, 3);
    
    const featuredArtistsHtmlPlaylist = await Promise.all(featuredArtistsPlaylist.map(async artist => {
      let thumbUrl = "/images/placeholder.jpg";
      let hasImage = false;
      if (artist.thumbnail) {
        try {
          const thumbObj = await env.media.get(artist.thumbnail);
          if (thumbObj) {
            const ext = artist.thumbnail.split(".").pop();
            thumbUrl = `/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}`;
            hasImage = true;
          }
        } catch (e) {}
      }
      
      // REMOVE slug lookup - use artist.id directly
      // const artistSlug = await slugManager.getSlugFromId('artists', artist.id) || artist.id;
      
      const bgStyle = hasImage
        ? `style="background-image:url('${thumbUrl}');background-size:cover;background-position:center;"`
        : '';
      const songCount = artist.songs?.length || 0;
      return `
        <div class="album-item" onclick="window.location='/artist/${artist.id}'">
          <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
          <div class="album-info">
            <span class="album-title">${artist.name}</span>
            <div class="album-meta">
              <span class="album-artist">${songCount} Songs</span>
              <span class="album-genre">${artist.genre || 'Artist'}</span>
            </div>
            <span class="album-date">Featured</span>
          </div>
        </div>
      `;
    }));

    const playlistInfoHtml = `
      <div style="padding: 15px; font-size: 0.9rem; color: #555;">
        <p><strong>Created:</strong> ${formattedDate}</p>
        <p><strong>Songs:</strong> ${songCount}</p>
        <p><strong>Total duration:</strong> ${totalDuration}</p>
        <p><strong>Total Plays:</strong> ${playlistStats.plays.toLocaleString()}</p>
        <p><strong>Total Downloads:</strong> ${playlistStats.downloads.toLocaleString()}</p>
        <p><strong>Curator:</strong> ${playlist.curator || 'ZEDALBUMS'}</p>
        ${playlist.description ? `<p><strong>Description:</strong> ${playlist.description}</p>` : ''}
        <div style="margin-top: 10px; padding: 8px; background: #f8f9fa; border-radius: 3px;">
          <i class="fas fa-info-circle" style="color: #00b894;"></i>
          <span style="margin-left: 5px;">Updated regularly</span>
        </div>
      </div>
    `;

    html = html.replace(/<title>.*?<\/title>/, `<title>${playlist.title} - Playlist - ZEDALBUMS</title>`);
    html = html.replace(
      /<span class="breadcrumb-current">.*?<\/span>/,
      `<span class="breadcrumb-current"><i class="fas fa-music"></i>${playlist.title}</span>`
    );
    html = html.replace(
      /<!-- PLAYLIST_COVER_HTML -->[\s\S]*?<!-- \/PLAYLIST_COVER_HTML -->/,
      `<!-- PLAYLIST_COVER_HTML -->${coverHtml}<!-- /PLAYLIST_COVER_HTML -->`
    );
    html = html.replace(
      /<!-- PLAYLIST_META -->[\s\S]*?<!-- \/PLAYLIST_META -->/,
      `<!-- PLAYLIST_META -->
      <div class="playlist-stats"><i class="fas fa-music"></i> ${songCount} Songs</div>
      <div class="playlist-stats"><i class="fas fa-clock"></i> ${totalDuration}</div>
      <div class="playlist-stats"><i class="fas fa-calendar"></i> Created: ${formattedDate}</div>
      <div class="playlist-stats"><i class="fas fa-headphones"></i> ${playlistStats.plays.toLocaleString()} Plays</div>
      <div class="playlist-stats"><i class="fas fa-download"></i> ${playlistStats.downloads.toLocaleString()} Downloads</div>
      <!-- /PLAYLIST_META -->`
    );
    html = html.replace(
      /<h1 class="playlist-title">Playlist Title<\/h1>/,
      `<h1 class="playlist-title">${playlist.title}</h1>`
    );
    html = html.replace(
      /<p class="playlist-description">Playlist description<\/p>/,
      `<p class="playlist-description">${playlist.description || 'No description available.'}</p>`
    );
    html = html.replace(
      /(<div class="latest-albums-list">)([\s\S]*?)(<\/div>)/,
      `$1${songsHtml}$3`
    );
    html = html.replace(
      /<!-- PAGINATION_HTML -->[\s\S]*?<!-- \/PAGINATION_HTML -->/,
      `<!-- PAGINATION_HTML -->${paginationHtmlPlaylist}<!-- /PAGINATION_HTML -->`
    );
    html = html.replace(
      /<!-- MORE_BY_ARTIST_START -->[\s\S]*?<!-- MORE_BY_ARTIST_END -->/g,
      `<!-- MORE_BY_ARTIST_START -->${moreByArtistHtml}<!-- MORE_BY_ARTIST_END -->`
    );
    html = html.replace(
      /<!-- SIMILAR_PLAYLISTS_START -->[\s\S]*?<!-- SIMILAR_PLAYLISTS_END -->/g,
      `<!-- SIMILAR_PLAYLISTS_START -->${similarHtml}<!-- SIMILAR_PLAYLISTS_END -->`
    );
    html = html.replace(
      /<!-- FEATURED_ARTISTS_START -->[\s\S]*?<!-- FEATURED_ARTISTS_END -->/g,
      `<!-- FEATURED_ARTISTS_START -->${featuredArtistsHtmlPlaylist.join('')}<!-- FEATURED_ARTISTS_END -->`
    );
    html = html.replace(
      /<!-- PLAYLIST_INFO_START -->[\s\S]*?<!-- PLAYLIST_INFO_END -->/g,
      `<!-- PLAYLIST_INFO_START -->${playlistInfoHtml}<!-- PLAYLIST_INFO_END -->`
    );

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300"
      }
    });
  }

  // Playlist create page
  if (path === "/playlist/create" && req.method === "GET") {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Create Playlist - ZEDALBUMS</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: system-ui; padding: 20px; background: #f4f4f9; margin: 0; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #333; border-left: 4px solid #4a90e2; padding-left: 15px; margin-top: 0; }
        label { display: block; margin-top: 15px; font-weight: bold; color: #555; }
        input, textarea, select { width: 100%; padding: 12px; margin-top: 5px; border: 2px solid #e0e0e0; border-radius: 8px; box-sizing: border-box; font-size: 16px; }
        input:focus, textarea:focus { outline: none; border-color: #4a90e2; }
        button { margin-top: 25px; padding: 14px; background: #4a90e2; color: #fff; border: none; border-radius: 8px; cursor: pointer; width: 100%; font-size: 16px; font-weight: bold; }
        button:hover { background: #3a7bc8; }
        .back-link { margin-top: 20px; text-align: center; }
        .back-link a { color: #666; text-decoration: none; }
        .back-link a:hover { color: #4a90e2; }
        .url-preview { margin-top: 10px; background: #f0f0f0; padding: 12px; border-radius: 8px; }
        .url-preview small { display: block; margin-bottom: 5px; color: #666; }
        .url-preview code { background: white; padding: 8px; border-radius: 4px; display: block; word-break: break-all; font-size: 0.9rem; border: 1px solid #e0e0e0; }
        .note { background: #f8f9fa; padding: 12px; border-radius: 8px; margin-top: 20px; font-size: 0.9rem; color: #666; border-left: 3px solid #4a90e2; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Create New Playlist</h1>
        <form action="/playlist/create" method="POST" enctype="multipart/form-data">
          <label>Playlist Title</label>
          <input type="text" name="title" id="playlistTitle" placeholder="e.g. Zambian Hits 2024" required>
          
          <div class="url-preview">
            <small>Playlist page will be:</small>
            <code id="urlPreview">/playlist/...</code>
          </div>
          
          <label>Description (Optional)</label>
          <textarea name="description" rows="3" placeholder="Describe your playlist..."></textarea>
          
          <label>Curator Name (Optional)</label>
          <input type="text" name="curator" placeholder="e.g. ZEDALBUMS" value="ZEDALBUMS">
          
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
      
      <script>
        const titleInput = document.getElementById('playlistTitle');
        const urlPreview = document.getElementById('urlPreview');
        
        function generateSlug(text) {
          if (!text) return 'untitled';
          return text
            .toLowerCase()
            .replace(/[^\\w\\s-]/g, ' ')
            .replace(/\\s+/g, ' ')
            .replace(/ /g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'untitled';
        }
        
        function updatePreview() {
          const slug = generateSlug(titleInput.value);
          urlPreview.textContent = '/playlist/' + slug;
        }
        
        titleInput.addEventListener('input', updatePreview);
        updatePreview();
      </script>
    </body>
    </html>
    `;
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }

  if (path === "/playlist/create" && req.method === "POST") {
    try {
      const formData = await req.formData();
      const title = formData.get("title");
      const description = formData.get("description") || "";
      const curator = formData.get("curator") || "ZEDALBUMS";
      const thumbnailFile = formData.get("thumbnail");

      if (!title) {
        return new Response("Missing playlist title", { status: 400 });
      }

      const playlistId = sanitize(title) + "_" + Date.now();
      const playlists = await getPlaylists(env);

      // Check if playlist already exists (optional)
      if (playlists[playlistId]) {
        return new Response("A playlist with this title already exists", { status: 400 });
      }

      let thumbnailKey = null;
      if (thumbnailFile && thumbnailFile.size > 0) {
        const imgType = thumbnailFile.type.includes("png") ? "png" : "jpg";
        thumbnailKey = `playlists/thumbnails/${playlistId}.${imgType}`;
        await env.media.put(thumbnailKey, thumbnailFile.stream());
      }

      // REMOVE slug generation
      // const slug = slugManager.generatePlaylistSlug(title);

      // Create playlist object
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

      await savePlaylists(env, playlists);

      // REMOVE slug registration
      // await slugManager.registerSlug('playlists', playlistId, slug, {
      //   title: title,
      //   curator: curator,
      //   created: Date.now()
      // });

      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Playlist Created - ZEDALBUMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui; padding: 20px; background: #f4f4f9; margin: 0; }
          .success { background: white; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h1 { color: #4a90e2; }
          .url { background: #f0f0f0; padding: 12px; border-radius: 8px; word-break: break-all; font-family: monospace; margin: 20px 0; border: 1px solid #e0e0e0; }
          .btn { display: inline-block; margin: 10px; padding: 12px 24px; background: #4a90e2; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
          .btn:hover { background: #3a7bc8; }
          .btn-upload { background: #ff5500; }
          .btn-upload:hover { background: #e64c00; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✅ Playlist Created!</h1>
          <p style="font-size: 1.2rem; margin: 20px 0;">"${title}"</p>
          <div class="url">/playlist/${playlistId}</div>
          <a href="/playlist/${playlistId}" class="btn">View Playlist</a>
          <a href="/upload" class="btn btn-upload">Upload Songs</a>
          <p style="margin-top: 30px;">
            <a href="/playlist/create">Create Another Playlist</a> | 
            <a href="/playlists">All Playlists</a> | 
            <a href="/">Home</a>
          </p>
        </div>
      </body>
      </html>
    `;
      
      return new Response(html, { 
        headers: { "Content-Type": "text/html" } 
      });
    } catch (error) {
      return new Response(`Error creating playlist: ${error.message}`, { status: 500 });
    }
  }

  // API endpoint for getting all playlists
  if (path === "/api/playlists/list" && req.method === "GET") {
    const playlists = await getPlaylists(env);
    const playlistArray = Object.values(playlists).map(p => ({
      id: p.id,
      // REMOVE slug from API response
      // slug: playlistSlug,
      title: p.title,
      songs: p.songs || [],
      created: p.created,
      songCount: (p.songs || []).length
    }));
    
    return new Response(JSON.stringify(playlistArray), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response("Not found", { status: 404 });
}