// ==================== SONGS ROUTES ====================
// ALL IMPORTS AT THE TOP
import { incrementPageView } from '../helpers/pageViews.js';
import { incrementPlays, incrementDownloads } from '../helpers/playsDownloadsEnhanced.js';
import { getArtists, getAlbums, getPlaylists, getMetadata } from '../helpers/storage.js';
import { getSongStats } from '../helpers/db.js';
import { formatDuration } from '../helpers/formatting.js';
import { SlugManager } from '../helpers/slug.js';  // ADDED

export async function handleSongs(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const slugManager = new SlugManager(env);  // ADDED

  // Song detail page
  if (path.startsWith("/song/")) {
    // Get slug from URL (strict - no .mp3 handling)
    const slug = decodeURIComponent(path.replace("/song/", ""));
    
    // Get baseName from slug - if null, song doesn't exist (404)
    const baseName = await slugManager.getIdFromSlug('songs', slug);
    
    if (!baseName) {
      return new Response("Song not found", { status: 404 });
    }
    
    // Now get the audio file using baseName
    const fileName = baseName + ".mp3";
    const audioObj = await env.media.get(`songs/${fileName}`);
    if (!audioObj) {
      return new Response("Song file missing", { status: 404 });
    }

    // TRACK PAGE VIEW
    ctx.waitUntil(incrementPageView(env, 'song', baseName));

    const stats = await getSongStats(baseName, env);

    const playlistId = url.searchParams.get("playlist");
    let contextPlaylist = null;
    if (playlistId) {
      const playlists = await getPlaylists(env);
      contextPlaylist = playlists[playlistId];
    }

    const templateObj = await env.media.get("song.html");
    if (!templateObj) {
      return new Response("song.html template not found in R2", { status: 500 });
    }
    let html = await templateObj.text();

    const meta = await getMetadata(env, baseName);
    let songTitle, primaryArtistId, featuredArtists = [], description = "", durationSeconds = 0;
    if (meta) {
      songTitle = meta.title;
      primaryArtistId = meta.primaryArtist;
      featuredArtists = meta.featuredArtists || [];
      description = meta.description || "";
      durationSeconds = meta.duration || 0;
    } else {
      const [artistId, ...titleParts] = baseName.split("_");
      songTitle = titleParts.join(" ");
      primaryArtistId = artistId;
    }

    const artists = await getArtists(env);
    const albums = await getAlbums(env);

    let primaryArtistName = primaryArtistId;
    let primaryArtistObj = artists[primaryArtistId];
    if (primaryArtistObj) {
      primaryArtistName = primaryArtistObj.name;
    }

    const featuredNames = featuredArtists.map(fid => artists[fid]?.name || fid).join(', ');
    const artistDisplay = featuredNames ? `${primaryArtistName} feat. ${featuredNames}` : primaryArtistName;

    if (!meta) {
      const descObj = await env.media.get(`descriptions/${baseName}.txt`);
      if (descObj) {
        description = await descObj.text();
      }
    }

    let hasImage = false;
    let thumbUrl = "/images/placeholder.jpg";
    let songCoverHtml = `<i class="fas fa-music"></i>`;
    
    try {
      const jpgObj = await env.media.get(`images/${baseName}.jpg`);
      if (jpgObj) {
        thumbUrl = `/images/${encodeURIComponent(baseName)}.jpg`;
        hasImage = true;
        songCoverHtml = `<img src="${thumbUrl}" alt="${songTitle}">`;
      } else {
        const pngObj = await env.media.get(`images/${baseName}.png`);
        if (pngObj) {
          thumbUrl = `/images/${encodeURIComponent(baseName)}.png`;
          hasImage = true;
          songCoverHtml = `<img src="${thumbUrl}" alt="${songTitle}">`;
        }
      }
    } catch (e) {}

    const uploaded = audioObj.uploaded ? new Date(audioObj.uploaded) : new Date();
    const formattedDate = uploaded.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });

    const durationFormatted = formatDuration(durationSeconds);

    let albumInfo = null;
    let albumId = null;
    let trackNumber = null;
    
    for (const [id, album] of Object.entries(albums)) {
      const songIndex = album.songs.indexOf(baseName);
      if (songIndex !== -1) {
        albumId = id;
        albumInfo = album;
        trackNumber = (songIndex + 1).toString().padStart(2, '0');
        break;
      }
    }

    let playlistHtml = '';
    let sidebarTitle = '';
    let viewAllLink = '';

    if (contextPlaylist && contextPlaylist.songs) {
      const playlistSongs = await Promise.all(
        contextPlaylist.songs
          .filter(songKey => songKey !== baseName)
          .slice(0, 10)
          .map(async (songKey, index) => {
            const m = await getMetadata(env, songKey);
            const songSlug = await slugManager.getSlugFromId('songs', songKey) || songKey;  // Get slug for linking
            let stitle = m ? m.title : songKey.split("_").slice(1).join(" ");
            let sartistDisplay = "";
            if (m) {
              const primary = artists[m.primaryArtist]?.name || m.primaryArtist;
              const featured = m.featuredArtists.map(fid => artists[fid]?.name || fid).join(', ');
              sartistDisplay = featured ? `${primary} feat. ${featured}` : primary;
            } else {
              const [sid] = songKey.split("_");
              const sartist = artists[sid];
              sartistDisplay = sartist ? sartist.name : sid;
            }
            let sthumbUrl = "/images/placeholder.jpg";
            let shasImage = false;
            try {
              const sjpgObj = await env.media.get(`images/${songKey}.jpg`);
              if (sjpgObj) {
                sthumbUrl = `/images/${encodeURIComponent(songKey)}.jpg`;
                shasImage = true;
              } else {
                const spngObj = await env.media.get(`images/${songKey}.png`);
                if (spngObj) {
                  sthumbUrl = `/images/${encodeURIComponent(songKey)}.png`;
                  shasImage = true;
                }
              }
            } catch (e) {}
            const sdurationSeconds = m?.duration || 0;
            const sdurationFormatted = formatDuration(sdurationSeconds);
            const trackNum = (index + 1).toString().padStart(2, '0');
            return `
              <div class="album-item" onclick="window.location='/song/${songSlug}?playlist=${playlistId}'">
                <div class="album-thumbnail ${shasImage ? '' : 'placeholder'}">
                  ${shasImage ? `<img src="${sthumbUrl}" alt="${stitle}" loading="lazy">` : ''}
                </div>
                <div class="album-info">
                  <span class="album-title">${sartistDisplay} - ${stitle}</span>
                  <div class="album-meta">
                    <span class="album-artist">${sartistDisplay}</span>
                    <span class="song-duration">${sdurationFormatted}</span>
                  </div>
                  <span class="album-date">Track ${trackNum}</span>
                </div>
              </div>
            `;
          })
      );
      playlistHtml = playlistSongs.join('');
      sidebarTitle = `More from "${contextPlaylist.title}" Playlist`;
      viewAllLink = contextPlaylist.songs.length > 10 ? `<a href="/playlist/${playlistId}" class="view-all">View All</a>` : '';
    } else if (albumInfo && albumId) {
      const albumSongs = await Promise.all(albumInfo.songs.map(async (songKey, index) => {
        const m = await getMetadata(env, songKey);
        const songSlug = await slugManager.getSlugFromId('songs', songKey) || songKey;  // Get slug for linking
        let stitle = m ? m.title : songKey.split("_").slice(1).join(" ");
        let sartistDisplay = "";
        if (m) {
          const primary = artists[m.primaryArtist]?.name || m.primaryArtist;
          const featured = m.featuredArtists.map(fid => artists[fid]?.name || fid).join(', ');
          sartistDisplay = featured ? `${primary} feat. ${featured}` : primary;
        } else {
          const [sid] = songKey.split("_");
          const sartist = artists[sid];
          sartistDisplay = sartist ? sartist.name : sid;
        }
        let sthumbUrl = "/images/placeholder.jpg";
        let shasImage = false;
        try {
          const sjpgObj = await env.media.get(`images/${songKey}.jpg`);
          if (sjpgObj) {
            sthumbUrl = `/images/${encodeURIComponent(songKey)}.jpg`;
            shasImage = true;
          } else {
            const spngObj = await env.media.get(`images/${songKey}.png`);
            if (spngObj) {
              sthumbUrl = `/images/${encodeURIComponent(songKey)}.png`;
              shasImage = true;
            }
          }
        } catch (e) {}
        const sdurationSeconds = m?.duration || 0;
        const sdurationFormatted = formatDuration(sdurationSeconds);
        const trackNum = (index + 1).toString().padStart(2, '0');
        const isCurrentSong = songKey === baseName;
        const activeClass = isCurrentSong ? ' style="background: rgba(255, 85, 0, 0.05); border-left: 4px solid #ff5500;"' : '';
        return `
          <div class="album-item" onclick="window.location='/song/${songSlug}'"${activeClass}>
            <div class="album-thumbnail ${shasImage ? '' : 'placeholder'}">
              ${shasImage ? `<img src="${sthumbUrl}" alt="${stitle}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${sartistDisplay} - ${stitle}</span>
              <div class="album-meta">
                <span class="album-artist">${sartistDisplay}</span>
                <span class="song-duration">${sdurationFormatted}</span>
              </div>
              <span class="album-date">Track ${trackNum}</span>
            </div>
          </div>
        `;
      }));
      playlistHtml = albumSongs.join('');
      sidebarTitle = `More from "${albumInfo.title}" Album`;
      viewAllLink = `<a href="/album/${albumId}" class="view-all">View Album</a>`;
    } else {
      playlistHtml = '<div style="padding: 20px; text-align: center; color: #666;">No other songs found</div>';
      sidebarTitle = 'More Songs';
      viewAllLink = '';
    }

    let moreByArtistHtml = '';
    if (primaryArtistId) {
      const artistAlbums = Object.values(albums)
        .filter(a => a.artists?.includes(primaryArtistId))
        .sort((a, b) => b.created - a.created)
        .slice(0, 2);
      
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
        const date = new Date(album.created);
        const formattedDate = date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        });
        return `
          <div class="album-item" onclick="window.location='/album/${album.id}'">
            <div class="album-thumbnail ${hasImage ? '' : 'placeholder'}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${album.title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${primaryArtistName} - ${album.title}</span>
              <div class="album-meta">
                <span class="album-artist">${primaryArtistName}</span>
                <span class="album-genre">Album</span>
              </div>
              <span class="album-date">${formattedDate}</span>
            </div>
          </div>
        `;
      })).then(results => results.join(''));
      
      if (artistAlbums.length === 0) {
        moreByArtistHtml = `<div style="padding: 15px; text-align: center; color: #666;">No albums by this artist</div>`;
      }
    }

    const allSongs = await env.media.list({ prefix: "songs/", limit: 20 });
    const songFiles = allSongs.objects || [];
    const similarSongs = songFiles
      .filter(f => !f.key.includes(fileName))
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);
    
    const similarSongsHtml = await Promise.all(similarSongs.map(async f => {
      const fName = f.key.split("/")[1];
      const fBaseName = fName.replace(".mp3", "");
      const m = await getMetadata(env, fBaseName);
      const fSlug = await slugManager.getSlugFromId('songs', fBaseName) || fBaseName;  // Get slug for linking
      let fTitle = m ? m.title : fBaseName.split("_").slice(1).join(" ");
      let fArtistDisplay = "";
      if (m) {
        const primary = artists[m.primaryArtist]?.name || m.primaryArtist;
        const featured = m.featuredArtists.map(fid => artists[fid]?.name || fid).join(', ');
        fArtistDisplay = featured ? `${primary} feat. ${featured}` : primary;
      } else {
        const [fArtistId] = fBaseName.split("_");
        const fArtist = artists[fArtistId];
        fArtistDisplay = fArtist ? fArtist.name : fArtistId;
      }
      let fThumbUrl = "/images/placeholder.jpg";
      let fHasImage = false;
      try {
        const fJpgObj = await env.media.get(`images/${fBaseName}.jpg`);
        if (fJpgObj) {
          fThumbUrl = `/images/${encodeURIComponent(fBaseName)}.jpg`;
          fHasImage = true;
        } else {
          const fPngObj = await env.media.get(`images/${fBaseName}.png`);
          if (fPngObj) {
            fThumbUrl = `/images/${encodeURIComponent(fBaseName)}.png`;
            fHasImage = true;
          }
        }
      } catch (e) {}
      const fDate = new Date(f.uploaded);
      const fFormattedDate = fDate.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
      const fDurationSeconds = m?.duration || 0;
      const fDurationFormatted = formatDuration(fDurationSeconds);
      return `
        <div class="album-item" onclick="window.location='/song/${fSlug}'">
          <div class="album-thumbnail ${fHasImage ? '' : 'placeholder'}">
            ${fHasImage ? `<img src="${fThumbUrl}" alt="${fTitle}" loading="lazy">` : ''}
          </div>
          <div class="album-info">
            <span class="album-title">${fArtistDisplay} - ${fTitle}</span>
            <div class="album-meta">
              <span class="album-artist">${fArtistDisplay}</span>
              <span class="song-duration">${fDurationFormatted}</span>
            </div>
            <span class="album-date">${fFormattedDate}</span>
          </div>
        </div>
      `;
    })).then(results => results.join(''));

    let quickInfoHtml = '';
    if (contextPlaylist) {
      const playlistSongCount = contextPlaylist.songs?.length || 0;
      const playlistCreated = new Date(contextPlaylist.created).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      quickInfoHtml = `
        <div class="quick-info-section">
          <h3 style="margin-bottom: 10px; color: #4a90e2;">Playlist Info</h3>
          <p><strong>${contextPlaylist.title}</strong></p>
          <p><strong>Songs:</strong> ${playlistSongCount}</p>
          <p><strong>Curator:</strong> ${contextPlaylist.curator || 'ZEDALBUMS'}</p>
          <p><strong>Created:</strong> ${playlistCreated}</p>
          ${contextPlaylist.description ? `<p><strong>Description:</strong> ${contextPlaylist.description}</p>` : ''}
          <div class="info-note">
            <i class="fas fa-info-circle" style="color: #4a90e2;"></i>
            <span>Viewing in playlist context</span>
          </div>
          <p style="margin-top: 10px;"><a href="/playlist/${playlistId}" class="view-all" style="color: #4a90e2;">View Full Playlist →</a></p>
        </div>
      `;
    } else {
      quickInfoHtml = `
        <div class="quick-info-section">
          <p><strong>Format:</strong> MP3</p>
          <p><strong>Bitrate:</strong> 320 kbps</p>
          <p><strong>Quality:</strong> High Quality</p>
          <p><strong>Release Date:</strong> ${formattedDate}</p>
          <p><strong>Genre:</strong> ${albumInfo?.genre || 'Zam Pop'}</p>
          <p><strong>Duration:</strong> ${durationFormatted}</p>
          <p><strong><i class="fas fa-play"></i> Plays:</strong> ${stats.plays.toLocaleString()}</p>
          <p><strong><i class="fas fa-download"></i> Downloads:</strong> ${stats.downloads.toLocaleString()}</p>
          <div class="info-note">
            <i class="fas fa-info-circle" style="color: #ff5500;"></i>
            <span>No registration required for download</span>
          </div>
        </div>
      `;
    }

    html = html.replace(/<title>.*?<\/title>/, `<title>${artistDisplay} - ${songTitle} - ZEDALBUMS</title>`);
    
    if (contextPlaylist) {
      html = html.replace(
        /<a href="index\.html" class="breadcrumb-link">/g,
        '<a href="/" class="breadcrumb-link">'
      );
      html = html.replace(
        /<a href="songs\.html" class="breadcrumb-link">/g,
        '<a href="/playlists" class="breadcrumb-link">Playlists</a>'
      );
      html = html.replace(
        /<a href="artists\.html" class="breadcrumb-link">/g,
        `<a href="/playlist/${playlistId}" class="breadcrumb-link">${contextPlaylist.title}</a>`
      );
      html = html.replace(
        /<span class="breadcrumb-current">.*?<\/span>/,
        `<span class="breadcrumb-current"><i class="fas fa-headphones"></i>${songTitle}</span>`
      );
    } else {
      html = html.replace(/<a href="index\.html" class="breadcrumb-link">/g, '<a href="/" class="breadcrumb-link">');
      html = html.replace(/<a href="songs\.html" class="breadcrumb-link">/g, '<a href="/" class="breadcrumb-link">');
      html = html.replace(/<a href="artists\.html" class="breadcrumb-link">/g, '<a href="/artists" class="breadcrumb-link">');
      html = html.replace(/<a href="artist-yo-maps\.html" class="breadcrumb-link">/g, `<a href="/artist/${primaryArtistId}" class="breadcrumb-link">${primaryArtistName}</a>`);
      html = html.replace(/<span class="breadcrumb-current">.*?<\/span>/, `<span class="breadcrumb-current"><i class="fas fa-headphones"></i>${songTitle}</span>`);
    }

    html = html.replace(/<div class="song-cover">[\s\S]*?<\/div>/, `<div class="song-cover">${songCoverHtml}</div>`);
    html = html.replace(/<h1 class="song-title">.*?<\/h1>/, `<h1 class="song-title">${songTitle}</h1>`);
    html = html.replace(/<div class="song-artist">.*?<\/div>/, `<div class="song-artist">${artistDisplay}</div>`);
    html = html.replace(/<div class="song-stats"><i class="fas fa-clock"><\/i> Duration: [^<]+<\/div>/, `<div class="song-stats"><i class="fas fa-clock"></i> Duration: ${durationFormatted}</div>`);
    html = html.replace(/<div class="song-stats"><i class="fas fa-calendar"><\/i> Released: [^<]+<\/div>/, `<div class="song-stats"><i class="fas fa-calendar"></i> Released: ${formattedDate}</div>`);
    html = html.replace('<!-- SONG_PLAYS -->', stats.plays.toLocaleString());
    html = html.replace('<!-- SONG_DOWNLOADS -->', stats.downloads.toLocaleString());
    
    html = html.replace(/<p class="playlist-description">[\s\S]*?<\/p>/, `<p class="playlist-description">${description || `"${songTitle}" is a song by ${artistDisplay}.`}</p>`);
    html = html.replace(/<span id="compactTotalTime">[^<]+<\/span>/, `<span id="compactTotalTime">${durationFormatted}</span>`);
    
    // Get slug for download link
    const songSlug = await slugManager.getSlugFromId('songs', baseName) || baseName;
    html = html.replace(/<a href="\/download\/[^"]*" class="download-mini-btn"/, `<a href="/download/${songSlug}" class="download-mini-btn"`);

    html = html.replace(
      /<h2 class="section-title">.*?<\/h2>/,
      `<h2 class="section-title">${sidebarTitle}</h2>`
    );
    html = html.replace(
      /<a href="[^"]*" class="view-all">.*?<\/a>/,
      viewAllLink
    );

    html = html.replace(
      /(<div class="latest-albums-list">)([\s\S]*?)(<\/div>\s*<\/div>\s*<\/aside>)/,
      `$1${playlistHtml}$3`
    );

    html = html.replace(
      /<!-- MORE_BY_ARTIST_START -->[\s\S]*?<!-- MORE_BY_ARTIST_END -->/g,
      `<!-- MORE_BY_ARTIST_START -->${moreByArtistHtml}<!-- MORE_BY_ARTIST_END -->`
    );
    
    html = html.replace(
      /<!-- SIMILAR_SONGS_START -->[\s\S]*?<!-- SIMILAR_SONGS_END -->/g,
      `<!-- SIMILAR_SONGS_START -->${similarSongsHtml}<!-- SIMILAR_SONGS_END -->`
    );
    
    html = html.replace(
      /<!-- QUICK_INFO_START -->[\s\S]*?<!-- QUICK_INFO_END -->/g,
      `<!-- QUICK_INFO_START -->${quickInfoHtml}<!-- QUICK_INFO_END -->`
    );

    html = html.replace(/<a href="#" class="nav-item active">Playlists<\/a>/, '<a href="/playlists" class="nav-item">Playlists</a>');
    html = html.replace(/<a href="#" class="nav-item">Home<\/a>/, '<a href="/" class="nav-item">Home</a>');
    html = html.replace(/<a href="#" class="nav-item">Albums<\/a>/, '<a href="/albums" class="nav-item">Albums</a>');
    html = html.replace(/<a href="#" class="nav-item">Artists<\/a>/, '<a href="/artists" class="nav-item">Artists</a>');

    // Script for tracking plays (unchanged - still uses baseName)
    const script = `
<script>
  (function() {
    const audio = document.querySelector('audio');
    const songKey = '${baseName}';
    if (audio) {
      let played = false;
      audio.addEventListener('play', function() {
        if (!played) {
          played = true;
          fetch('/api/play/' + encodeURIComponent(songKey), { 
            method: 'POST',
            keepalive: true 
          }).catch(err => console.error('Failed to record play:', err));
        }
      });
    }
  })();
</script>
`;
    html = html.replace('</body>', script + '</body>');

    return new Response(html, { 
      headers: { 
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300"
      } 
    });
  }

  // Download endpoint - Strict slug-only lookup
  if (path.startsWith("/download/")) {
    // Get slug from URL
    const slug = decodeURIComponent(path.replace("/download/", ""));
    
    // Get baseName from slug - if null, song doesn't exist (404)
    const baseName = await slugManager.getIdFromSlug('songs', slug);
    
    if (!baseName) {
      return new Response("Song not found", { status: 404 });
    }
    
    const fileName = baseName + ".mp3";
    const songKey = baseName;

    // Track download
    ctx.waitUntil(incrementDownloads(env, 'song', songKey));

    // Fetch the audio file from R2
    const obj = await env.media.get(`songs/${fileName}`);
    if (!obj) {
      return new Response("File not found", { status: 404 });
    }

    // Serve the file as a download
    const headers = {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "public, max-age=604800",
      "Accept-Ranges": "bytes",
    };

    return new Response(obj.body, { headers });
  }

  return new Response("Not found", { status: 404 });
}