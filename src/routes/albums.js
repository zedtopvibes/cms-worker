// ==================== ALBUMS ROUTES ====================
import { getAlbums, getArtists, getMetadata } from '../helpers/storage.js';
import { getAggregatedStats } from '../helpers/db.js';
import { formatDuration } from '../helpers/formatting.js';

export async function handleAlbums(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  
  // Albums list page
  if (path === "/albums") {
    const templateObj = await env.media.get("albums.html");
    if (!templateObj) {
      return new Response("albums.html template not found in R2", { status: 500 });
    }
    let html = await templateObj.text();

    const albums = await getAlbums(env);
    const artists = await getArtists(env);
    
    const albumList = Object.values(albums).sort((a, b) => b.created - a.created);
    
    const ALBUMS_PER_PAGE = 12;
    const page = parseInt(url.searchParams.get("page")) || 1;
    const totalAlbums = albumList.length;
    const totalPages = Math.ceil(totalAlbums / ALBUMS_PER_PAGE);
    const startIdx = (page - 1) * ALBUMS_PER_PAGE;
    const pageAlbums = albumList.slice(startIdx, startIdx + ALBUMS_PER_PAGE);

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

    let paginationHtml = '';
    if (totalPages > 1) {
      paginationHtml = `<div class="pagination-container"><div class="pagination">`;
      
      paginationHtml += `<a href="/albums?page=${page-1}" class="pagination-item pagination-prev ${page === 1 ? 'disabled' : ''}"><i class="fas fa-chevron-left"></i> Prev</a>`;
      
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page-2 && i <= page+2)) {
          paginationHtml += `<a href="/albums?page=${i}" class="pagination-item ${i === page ? 'active' : ''}">${i}</a>`;
        } else if (i === page-3 || i === page+3) {
          paginationHtml += `<span class="pagination-ellipsis">...</span>`;
        }
      }
      
      paginationHtml += `<a href="/albums?page=${page+1}" class="pagination-item pagination-next ${page === totalPages ? 'disabled' : ''}">Next <i class="fas fa-chevron-right"></i></a>`;
      paginationHtml += `</div></div>`;
    }

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

    const topArtists = Object.values(artists)
      .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
      .slice(0, 3);
    
    const topArtistsHtml = await Promise.all(topArtists.map(async artist => {
      const albumCount = artist.albums?.length || 0;
      const songCount = artist.songs?.length || 0;
      
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
      
      const bgStyle = hasImage 
        ? `style="background-image:url('${thumbUrl}');background-size:cover;background-position:center;"`
        : '';
      
      return `
        <div class="album-item" onclick="window.location='/artist/${artist.id}'">
          <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
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
      const timeAgo = diffDays === 0 ? 'Today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;

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

    html = html.replace(
      /<!-- ALBUMS_START -->[\s\S]*?<!-- ALBUMS_END -->/g,
      `<!-- ALBUMS_START -->${albumsHtml.join('')}<!-- ALBUMS_END -->`
    );
    
    html = html.replace(
      /<!-- PAGINATION_START -->[\s\S]*?<!-- PAGINATION_END -->/g,
      `<!-- PAGINATION_START -->${paginationHtml}<!-- PAGINATION_END -->`
    );
    
    html = html.replace(
      /<!-- FEATURED_ALBUMS_START -->[\s\S]*?<!-- FEATURED_ALBUMS_END -->/g,
      `<!-- FEATURED_ALBUMS_START -->${featuredAlbumsHtml.join('')}<!-- FEATURED_ALBUMS_END -->`
    );
    
    html = html.replace(
      /<!-- TOP_ARTISTS_START -->[\s\S]*?<!-- TOP_ARTISTS_END -->/g,
      `<!-- TOP_ARTISTS_START -->${topArtistsHtml.join('')}<!-- TOP_ARTISTS_END -->`
    );
    
    html = html.replace(
      /<!-- NEW_RELEASES_START -->[\s\S]*?<!-- NEW_RELEASES_END -->/g,
      `<!-- NEW_RELEASES_START -->${newReleasesHtml.join('')}<!-- NEW_RELEASES_END -->`
    );

    return new Response(html, { 
      headers: { 
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300"
      } 
    });
  }
  
  // Album detail page
  if (path.startsWith("/album/") && !path.startsWith("/album/create")) {
    const albumId = decodeURIComponent(path.replace("/album/", ""));
    
    const albums = await getAlbums(env);
    const album = albums[albumId];
    const artists = await getArtists(env);
    
    if (!album) {
      return new Response("Album not found", { status: 404 });
    }

    const albumStats = await getAggregatedStats(album.songs || [], env);

    const templateObj = await env.media.get("album.html");
    if (!templateObj) {
      return new Response("album.html template not found in R2", { status: 500 });
    }
    let html = await templateObj.text();

    let primaryArtist = "Various Artists";
    let primaryArtistId = "";
    if (album.artists && album.artists.length > 0) {
      primaryArtistId = album.artists[0];
      const artistObj = artists[primaryArtistId];
      if (artistObj) primaryArtist = artistObj.name;
    }

    const releaseDate = new Date(album.created);
    const formattedDate = releaseDate.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });

    const trackCount = album.songs?.length || 0;

    // Calculate total duration
    let totalSeconds = 0;
    const songDurations = await Promise.all(album.songs.map(async (songKey) => {
      const meta = await getMetadata(env, songKey);
      return meta?.duration || 0;
    }));
    totalSeconds = songDurations.reduce((acc, dur) => acc + dur, 0);
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
    const totalDuration = totalHours > 0 
      ? `${totalHours} hr ${totalMinutes} min` 
      : `${totalMinutes} min`;

    let hasImage = false;
    let thumbUrl = "/images/placeholder.jpg";
    let albumCoverHtml = `<i class="fas fa-compact-disc"></i>`;
    
    if (album.thumbnail) {
      try {
        const thumbObj = await env.media.get(album.thumbnail);
        if (thumbObj) {
          const ext = album.thumbnail.split(".").pop();
          thumbUrl = `/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}`;
          hasImage = true;
          albumCoverHtml = `<img src="${thumbUrl}" alt="${album.title}">`;
        }
      } catch (e) {}
    }

    const tracksHtml = await Promise.all(album.songs.map(async (songKey, index) => {
      const meta = await getMetadata(env, songKey);
      let artistName = "";
      let artistDisplay = "";
      if (meta) {
        const primary = artists[meta.primaryArtist]?.name || meta.primaryArtist;
        const featured = meta.featuredArtists.map(fid => artists[fid]?.name || fid).join(', ');
        artistDisplay = featured ? `${primary} feat. ${featured}` : primary;
        artistName = primary;
      } else {
        const [artistId] = songKey.split("_");
        const artist = artists[artistId];
        artistName = artist ? artist.name : artistId;
        artistDisplay = artistName;
      }
      
      const title = meta ? meta.title : songKey.split("_").slice(1).join(" ");
      
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
      const thumbnailClass = hasImage ? '' : 'track-placeholder';
      const thumbnailContent = hasImage ? `<img src="${thumbUrl}" alt="${title}" loading="lazy">` : '';
      
      return `
        <div class="album-item" onclick="window.location='/song/${encodeURIComponent(songKey + ".mp3")}'">
          <div class="album-thumbnail ${thumbnailClass}">
            ${thumbnailContent}
          </div>
          <div class="album-info">
            <span class="album-title">${title}</span>
            <div class="album-meta">
              <span class="album-artist">${artistDisplay}</span>
              <span class="track-duration">${durationFormatted}</span>
              <span class="album-genre">Track ${trackNumber}</span>
            </div>
            <span class="album-date">Track ${trackNumber}</span>
          </div>
        </div>
      `;
    })).then(results => results.join(''));

    // More by this artist
    let moreByArtistHtml = '';
    if (primaryArtistId) {
      const artistAlbums = Object.values(albums)
        .filter(a => a.artists?.includes(primaryArtistId) && a.id !== albumId)
        .sort((a, b) => b.created - a.created)
        .slice(0, 3);
      
      moreByArtistHtml = await Promise.all(artistAlbums.map(async a => {
        let thumbUrl = "/images/placeholder.jpg";
        let hasImage = false;
        if (a.thumbnail) {
          try {
            const thumbObj = await env.media.get(a.thumbnail);
            if (thumbObj) {
              const ext = a.thumbnail.split(".").pop();
              thumbUrl = `/albums/thumbnails/${encodeURIComponent(a.id)}.${ext}`;
              hasImage = true;
            }
          } catch (e) {}
        }
        const date = new Date(a.created);
        const formattedDate = date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        });
        const thumbnailClass = hasImage ? '' : 'album-style';
        const thumbnailContent = hasImage ? `<img src="${thumbUrl}" alt="${a.title}" loading="lazy">` : '';
        return `
          <div class="album-item" onclick="window.location='/album/${a.id}'">
            <div class="album-thumbnail ${thumbnailClass}">
              ${thumbnailContent}
            </div>
            <div class="album-info">
              <span class="album-title">${primaryArtist} - ${a.title}</span>
              <div class="album-meta">
                <span class="album-artist">${primaryArtist}</span>
                <span class="album-genre">Album</span>
              </div>
              <span class="album-date">${formattedDate}</span>
            </div>
          </div>
        `;
      })).then(results => results.join(''));
      
      if (artistAlbums.length === 0) {
        moreByArtistHtml = `<div style="padding: 20px; text-align: center; color: #666;">No other albums by this artist</div>`;
      }
    } else {
      moreByArtistHtml = `<div style="padding: 20px; text-align: center; color: #666;">No other albums available</div>`;
    }

    // Similar albums
    const similarAlbums = Object.values(albums)
      .filter(a => a.id !== albumId && a.artists && a.artists.length > 0)
      .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
      .slice(0, 3);
    
    const similarAlbumsHtml = await Promise.all(similarAlbums.map(async a => {
      let thumbUrl = "/images/placeholder.jpg";
      let hasImage = false;
      if (a.thumbnail) {
        try {
          const thumbObj = await env.media.get(a.thumbnail);
          if (thumbObj) {
            const ext = a.thumbnail.split(".").pop();
            thumbUrl = `/albums/thumbnails/${encodeURIComponent(a.id)}.${ext}`;
            hasImage = true;
          }
        } catch (e) {}
      }
      let artistName = "Various";
      if (a.artists && a.artists.length > 0) {
        const artistObj = artists[a.artists[0]];
        if (artistObj) artistName = artistObj.name;
      }
      const date = new Date(a.created);
      const formattedDate = date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
      const thumbnailClass = hasImage ? '' : 'album-style';
      const thumbnailContent = hasImage ? `<img src="${thumbUrl}" alt="${a.title}" loading="lazy">` : '';
      return `
        <div class="album-item" onclick="window.location='/album/${a.id}'">
          <div class="album-thumbnail ${thumbnailClass}">
            ${thumbnailContent}
          </div>
          <div class="album-info">
            <span class="album-title">${artistName} - ${a.title}</span>
            <div class="album-meta">
              <span class="album-artist">${artistName}</span>
              <span class="album-genre">Album</span>
            </div>
            <span class="album-date">${formattedDate}</span>
          </div>
        </div>
      `;
    })).then(results => results.join(''));

    // Album info HTML
    const albumInfoHtml = `
      <div style="padding: 15px; font-size: 0.85rem; color: #555;">
        <p><strong>Label:</strong> ${album.label || 'Independent'}</p>
        <p><strong>Producer:</strong> ${album.producer || primaryArtist}</p>
        <p><strong>Format:</strong> Digital, Streaming</p>
        <p><strong>Total Tracks:</strong> ${trackCount}</p>
        <p><strong>Total Duration:</strong> ${totalDuration}</p>
        <p><strong>Total Plays:</strong> ${albumStats.plays.toLocaleString()}</p>
        <p><strong>Total Downloads:</strong> ${albumStats.downloads.toLocaleString()}</p>
        <p><strong>℗ ${new Date(album.created).getFullYear()}</strong> ${album.copyright || 'ZEDALBUMS'}</p>
        ${album.awards ? `
          <div style="margin-top: 10px; padding: 8px; background: #f8f9fa; border-radius: 3px; font-size: 0.8rem;">
            <i class="fas fa-award" style="color: #f39c12;"></i>
            <span style="margin-left: 5px;">${album.awards}</span>
          </div>
        ` : ''}
      </div>
    `;

    // Featured artists
    let featuredArtistsHtml = '';
    if (album.artists && album.artists.length > 1) {
      const featuredArtistsList = await Promise.all(album.artists.slice(1).map(async artistId => {
        const artist = artists[artistId];
        if (artist) {
          const trackCountOnAlbum = album.songs.filter(song => song.startsWith(artistId)).length;
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
          const bgStyle = hasImage 
            ? `style="background-image:url('${thumbUrl}');background-size:cover;background-position:center;"`
            : '';
          return `
            <div class="album-item" onclick="window.location='/artist/${artistId}'">
              <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
              <div class="album-info">
                <span class="album-title">${artist.name}</span>
                <div class="album-meta">
                  <span class="album-artist">Featured Artist</span>
                  <span class="album-genre">${trackCountOnAlbum} track${trackCountOnAlbum !== 1 ? 's' : ''}</span>
                </div>
                <span class="album-date">${trackCountOnAlbum} tracks</span>
              </div>
            </div>
          `;
        }
        return '';
      }));
      featuredArtistsHtml = featuredArtistsList.join('') || `<div style="padding: 20px; text-align: center; color: #666;">No featured artists</div>`;
    } else {
      featuredArtistsHtml = `<div style="padding: 20px; text-align: center; color: #666;">No featured artists</div>`;
    }

    // Replace all placeholders
    html = html.replace(/<title>.*?<\/title>/, `<title>${primaryArtist} - ${album.title} - ZEDALBUMS</title>`);
    html = html.replace(/<a href="index\.html" class="breadcrumb-link">/g, '<a href="/" class="breadcrumb-link">');
    html = html.replace(/<a href="albums\.html" class="breadcrumb-link">/g, '<a href="/albums" class="breadcrumb-link">');
    html = html.replace(/<!-- ARTIST_BREADCRUMB_START -->[\s\S]*?<!-- ARTIST_BREADCRUMB_END -->/g, 
      primaryArtistId 
        ? `<!-- ARTIST_BREADCRUMB_START --><a href="/artist/${primaryArtistId}" class="breadcrumb-link"><i class="fas fa-user"></i>${primaryArtist}</a><!-- ARTIST_BREADCRUMB_END -->`
        : `<!-- ARTIST_BREADCRUMB_START --><a href="/artists" class="breadcrumb-link"><i class="fas fa-user"></i>Artists</a><!-- ARTIST_BREADCRUMB_END -->`
    );
    html = html.replace(/<!-- ALBUM_BREADCRUMB_START -->[\s\S]*?<!-- ALBUM_BREADCRUMB_END -->/g, 
      `<!-- ALBUM_BREADCRUMB_START --><span class="breadcrumb-current"><i class="fas fa-compact-disc"></i>${album.title}</span><!-- ALBUM_BREADCRUMB_END -->`
    );
    html = html.replace(/<!-- ALBUM_COVER_START -->[\s\S]*?<!-- ALBUM_COVER_END -->/g, 
      `<!-- ALBUM_COVER_START --><div class="album-cover-large">${albumCoverHtml}</div><!-- ALBUM_COVER_END -->`
    );
    html = html.replace(/<!-- ALBUM_TITLE_START -->[\s\S]*?<!-- ALBUM_TITLE_END -->/g, 
      `<!-- ALBUM_TITLE_START --><h1 class="album-title-detail">${primaryArtist} - ${album.title}</h1><!-- ALBUM_TITLE_END -->`
    );
    html = html.replace(/<!-- ARTIST_NAME_START -->[\s\S]*?<!-- ARTIST_NAME_END -->/g, 
      `<!-- ARTIST_NAME_START --><div class="album-artist-detail">${primaryArtist}</div><!-- ARTIST_NAME_END -->`
    );
    html = html.replace(/<!-- TRACK_COUNT_START -->[\s\S]*?<!-- TRACK_COUNT_END -->/g, 
      `<!-- TRACK_COUNT_START --><div class="album-stats"><i class="fas fa-music"></i>${trackCount} Songs</div><!-- TRACK_COUNT_END -->`
    );
    html = html.replace(/<!-- DURATION_START -->[\s\S]*?<!-- DURATION_END -->/g, 
      `<!-- DURATION_START --><div class="album-stats"><i class="fas fa-clock"></i>${totalDuration}</div><!-- DURATION_END -->`
    );
    html = html.replace(/<!-- RELEASE_DATE_START -->[\s\S]*?<!-- RELEASE_DATE_END -->/g, 
      `<!-- RELEASE_DATE_START --><div class="album-stats"><i class="fas fa-calendar"></i>Released: ${formattedDate}</div><!-- RELEASE_DATE_END -->`
    );
    html = html.replace('<!-- ALBUM_PLAYS -->', albumStats.plays.toLocaleString());
    html = html.replace('<!-- ALBUM_DOWNLOADS -->', albumStats.downloads.toLocaleString());
    html = html.replace(/<!-- ALBUM_DESCRIPTION_START -->[\s\S]*?<!-- ALBUM_DESCRIPTION_END -->/g, 
      `<!-- ALBUM_DESCRIPTION_START --><p class="album-description">${album.description || 'No description available.'}</p><!-- ALBUM_DESCRIPTION_END -->`
    );
    html = html.replace(/<!-- TRACKS_START -->[\s\S]*?<!-- TRACKS_END -->/g, 
      `<!-- TRACKS_START -->${tracksHtml}<!-- TRACKS_END -->`
    );
    html = html.replace(/<!-- MORE_BY_ARTIST_START -->[\s\S]*?<!-- MORE_BY_ARTIST_END -->/g, 
      `<!-- MORE_BY_ARTIST_START -->${moreByArtistHtml}<!-- MORE_BY_ARTIST_END -->`
    );
    html = html.replace(/<!-- SIMILAR_ALBUMS_START -->[\s\S]*?<!-- SIMILAR_ALBUMS_END -->/g, 
      `<!-- SIMILAR_ALBUMS_START -->${similarAlbumsHtml}<!-- SIMILAR_ALBUMS_END -->`
    );
    html = html.replace(/<!-- ALBUM_INFO_START -->[\s\S]*?<!-- ALBUM_INFO_END -->/g, 
      `<!-- ALBUM_INFO_START -->${albumInfoHtml}<!-- ALBUM_INFO_END -->`
    );
    html = html.replace(/<!-- FEATURED_ARTISTS_START -->[\s\S]*?<!-- FEATURED_ARTISTS_END -->/g, 
      `<!-- FEATURED_ARTISTS_START -->${featuredArtistsHtml}<!-- FEATURED_ARTISTS_END -->`
    );

    return new Response(html, { 
      headers: { 
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300"
      } 
    });
  }
  
  // Album create page
  if (path === "/album/create" && req.method === "GET") {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Create Album - ZEDALBUMS</title>
      <style>
        body { font-family: Arial,sans-serif; padding:50px; background:#f0f0f0; }
        .container { max-width:500px; margin:0 auto; background:white; padding:30px; border-radius:8px; }
        h1 { color:#333; border-left:4px solid #28a745; padding-left:15px; }
        label { display:block; margin-top:15px; font-weight:bold; }
        input, textarea { width:100%; padding:12px; margin-top:5px; border:1px solid #ddd; border-radius:4px; }
        button { margin-top:25px; padding:14px; background:#28a745; color:#fff; border:none; border-radius:4px; cursor:pointer; width:100%; font-size:16px; }
        button:hover { background:#218838; }
        .back-link { margin-top:20px; text-align:center; }
        .back-link a { color:#666; text-decoration:none; }
        .back-link a:hover { color:#28a745; }
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
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }

  if (path === "/album/create" && req.method === "POST") {
    const formData = await req.formData();
    const title = formData.get("title");
    const description = formData.get("description");
    const thumbnailFile = formData.get("thumbnail");

    if (!title || !thumbnailFile) {
      return new Response("Missing fields", { status: 400 });
    }

    const sanitize = (str) => str.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");
    const albumId = sanitize(title) + "_" + Date.now();
    const albums = await getAlbums(env);

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

    await saveAlbums(env, albums);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Album Created - ZEDALBUMS</title>
        <style>
          body { font-family: Arial,sans-serif; padding:50px; background:#f0f0f0; text-align:center; }
          .success { background:white; padding:30px; border-radius:8px; max-width:500px; margin:0 auto; }
          h1 { color:#28a745; }
          .btn { display:inline-block; margin:10px; padding:12px 24px; background:#28a745; color:white; text-decoration:none; border-radius:4px; }
          .btn:hover { background:#218838; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✅ Album Created Successfully!</h1>
          <p style="font-size:1.2rem;">${title}</p>
          <a href="/album/${albumId}" class="btn">View Album</a>
          <a href="/upload" class="btn" style="background:#ff5500;">Upload Songs</a>
          <p style="margin-top:20px;"><a href="/album/create">Create Another Album</a></p>
        </div>
      </body>
      </html>
    `;
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }

  return new Response("Not found", { status: 404 });
}

// Need to import saveAlbums
import { saveAlbums } from '../helpers/storage.js';