// ==================== ARTISTS  ROUTES ====================
// ALL IMPORTS AT THE TOP 
import { incrementPageView } from '../helpers/pageViews.js';
import { 
  getArtists, 
  getAlbums, 
  getPlaylists, 
  getMetadata, 
  saveArtists,
  getArtistAlbumsAndSingles 
} from '../helpers/storage.js';
import { getAggregatedStats } from '../helpers/db.js';
import { sanitize, formatDuration } from '../helpers/formatting.js';

export async function handleArtists(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Artists list page
  if (path === "/artists") {
    const templateObj = await env.media.get("artists.html");
    if (!templateObj) {
      return new Response("artists.html template not found in R2", { status: 500 });
    }
    let html = await templateObj.text();

    const artists = await getArtists(env);
    const albums = await getAlbums(env);
    
    const artistList = Object.values(artists).sort((a, b) => b.created - a.created);
    
    const ARTISTS_PER_PAGE = 12;
    const page = parseInt(url.searchParams.get("page")) || 1;
    const totalArtists = artistList.length;
    const totalPages = Math.ceil(totalArtists / ARTISTS_PER_PAGE);
    const startIdx = (page - 1) * ARTISTS_PER_PAGE;
    const pageArtists = artistList.slice(startIdx, startIdx + ARTISTS_PER_PAGE);

    const artistsHtml = await Promise.all(pageArtists.map(async artist => {
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

      const songCount = artist.songs?.length || 0;
      const sinceYear = new Date(artist.created).getFullYear();
      const bgStyle = hasImage 
        ? `style="background-image:url('${thumbUrl}');background-size:cover;background-position:center;"`
        : '';

      return `
        <div class="album-item" onclick="window.location='/artist/${artist.id}'">
          <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
          <div class="album-info">
            <span class="album-title">${artist.name}</span>
            <div class="album-meta">
              <span class="album-artist artist-songs">${songCount} Songs</span>
              <span class="album-genre">${artist.genre || 'Various'}</span>
            </div>
            <span class="album-date">Since ${sinceYear}</span>
          </div>
        </div>
      `;
    }));

    let paginationHtml = '';
    if (totalPages > 1) {
      paginationHtml = `<div class="pagination-container"><div class="pagination">`;
      paginationHtml += `<a href="/artists?page=${page-1}" class="pagination-item pagination-prev ${page === 1 ? 'disabled' : ''}"><i class="fas fa-chevron-left"></i> Prev</a>`;
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page-2 && i <= page+2)) {
          paginationHtml += `<a href="/artists?page=${i}" class="pagination-item ${i === page ? 'active' : ''}">${i}</a>`;
        } else if (i === page-3 || i === page+3) {
          paginationHtml += `<span class="pagination-ellipsis">...</span>`;
        }
      }
      paginationHtml += `<a href="/artists?page=${page+1}" class="pagination-item pagination-next ${page === totalPages ? 'disabled' : ''}">Next <i class="fas fa-chevron-right"></i></a>`;
      paginationHtml += `</div></div>`;
    }

    const topArtists = Object.values(artists)
      .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
      .slice(0, 3);
    
    const topArtistsHtml = await Promise.all(topArtists.map(async artist => {
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
      const songCount = artist.songs?.length || 0;
      const bgStyle = hasImage 
        ? `style="background-image:url('${thumbUrl}');background-size:cover;background-position:center;"`
        : '';
      return `
        <div class="album-item" onclick="window.location='/artist/${artist.id}'">
          <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
          <div class="album-info">
            <span class="album-title">${artist.name}</span>
            <div class="album-meta">
              <span class="album-artist artist-songs">${songCount} Songs</span>
              <span class="album-genre">${artist.genre || 'Various'}</span>
            </div>
            <span class="album-date">${songCount >= 100 ? 'Most Songs' : 'Popular'}</span>
          </div>
        </div>
      `;
    }));

    const newArtists = Object.values(artists)
      .sort((a, b) => b.created - a.created)
      .slice(0, 3);
    
    const newArtistsHtml = await Promise.all(newArtists.map(async artist => {
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
      const songCount = artist.songs?.length || 0;
      const sinceYear = new Date(artist.created).getFullYear();
      const bgStyle = hasImage 
        ? `style="background-image:url('${thumbUrl}');background-size:cover;background-position:center;"`
        : '';
      return `
        <div class="album-item" onclick="window.location='/artist/${artist.id}'">
          <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
          <div class="album-info">
            <span class="album-title">${artist.name}</span>
            <div class="album-meta">
              <span class="album-artist artist-songs">${songCount} Songs</span>
              <span class="album-genre">${artist.genre || 'Various'}</span>
            </div>
            <span class="album-date">Since ${sinceYear}</span>
          </div>
        </div>
      `;
    }));

    const totalSongs = (await env.media.list({ prefix: "songs/" })).objects?.length || 0;
    const totalArtistsCount = Object.keys(artists).length;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const newArtistsThisMonth = Object.values(artists).filter(a => a.created > thirtyDaysAgo).length;

    const statsHtml = `
      <div style="padding: 15px; font-size: 0.9rem; color: #555;">
        <p><strong>Total Artists:</strong> ${totalArtistsCount}+</p>
        <p><strong>Total Songs:</strong> ${totalSongs}+</p>
        <p><strong>New This Month:</strong> ${newArtistsThisMonth} Artists</p>
        <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 3px;">
          <i class="fas fa-info-circle" style="color: #ff5500;"></i>
          <span style="margin-left: 5px;">All Zambian artists included</span>
        </div>
      </div>
    `;

    html = html.replace(
      /<!-- ARTISTS_START -->[\s\S]*?<!-- ARTISTS_END -->/g,
      `<!-- ARTISTS_START -->${artistsHtml.join('')}<!-- ARTISTS_END -->`
    );
    
    html = html.replace(
      /<!-- PAGINATION_START -->[\s\S]*?<!-- PAGINATION_END -->/g,
      `<!-- PAGINATION_START -->${paginationHtml}<!-- PAGINATION_END -->`
    );
    
    html = html.replace(
      /<!-- TOP_ARTISTS_START -->[\s\S]*?<!-- TOP_ARTISTS_END -->/g,
      `<!-- TOP_ARTISTS_START -->${topArtistsHtml.join('')}<!-- TOP_ARTISTS_END -->`
    );
    
    html = html.replace(
      /<!-- NEW_ARTISTS_START -->[\s\S]*?<!-- NEW_ARTISTS_END -->/g,
      `<!-- NEW_ARTISTS_START -->${newArtistsHtml.join('')}<!-- NEW_ARTISTS_END -->`
    );
    
    html = html.replace(
      /<!-- ARTIST_STATS_START -->[\s\S]*?<!-- ARTIST_STATS_END -->/g,
      `<!-- ARTIST_STATS_START -->${statsHtml}<!-- ARTIST_STATS_END -->`
    );

    return new Response(html, { 
      headers: { 
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300"
      } 
    });
  }

  // Artist detail page
  if (path.startsWith("/artist/") && !path.startsWith("/artist/create")) {
    const artistId = decodeURIComponent(path.replace("/artist/", ""));
    const artists = await getArtists(env);
    const artist = artists[artistId];
    if (!artist) return new Response("Artist not found", { status: 404 });

    // ✅ TRACK PAGE VIEW
    ctx.waitUntil(incrementPageView(env, 'artist', artistId));

    const albums = await getAlbums(env);
    const playlists = await getPlaylists(env);
    
    // Get artist's albums and singles
    const artistData = await getArtistAlbumsAndSingles(env, artistId);
    const { albums: artistAlbums, singles } = artistData;

    const allSongKeys = artist.songs || [];
    const artistStats = await getAggregatedStats(allSongKeys, env);

    // Find playlists featuring this artist
    const artistPlaylists = [];
    const playlistsList = Object.values(playlists);
    
    for (const playlist of playlistsList) {
      if (!playlist.songs) continue;
      
      for (const songKey of playlist.songs) {
        const meta = await getMetadata(env, songKey);
        if (meta) {
          if (meta.primaryArtist === artistId || meta.featuredArtists.includes(artistId)) {
            const artistSongCount = playlist.songs.filter(s => {
              return s.startsWith(artistId + "_");
            }).length;
            
            artistPlaylists.push({
              id: playlist.id,
              title: playlist.title,
              thumbnail: playlist.thumbnail,
              songCount: playlist.songs.length,
              artistSongCount: artistSongCount,
              curator: playlist.curator || 'ZEDALBUMS',
              created: playlist.created
            });
            break;
          }
        } else {
          if (songKey.startsWith(artistId + "_")) {
            const artistSongCount = playlist.songs.filter(s => {
              return s.startsWith(artistId + "_");
            }).length;
            
            artistPlaylists.push({
              id: playlist.id,
              title: playlist.title,
              thumbnail: playlist.thumbnail,
              songCount: playlist.songs.length,
              artistSongCount: artistSongCount,
              curator: playlist.curator || 'ZEDALBUMS',
              created: playlist.created
            });
            break;
          }
        }
      }
    }

    artistPlaylists.sort((a, b) => b.created - a.created);

    const templateObj = await env.media.get("artist.html");
    if (!templateObj) {
      return new Response("artist.html template not found in R2", { status: 500 });
    }
    let html = await templateObj.text();

    const formatDate = (ts) =>
      new Date(ts).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

    const artistName = artist.name || artistId;
    const sinceYear = artist.created ? new Date(artist.created).getFullYear() : "N/A";
    const description = artist.description || `All songs by ${artistName}.`;
    const genre = artist.genre || "Zam Pop / R&B";
    const songCount = artistData.totalSongs || artist.songs?.length || 0;
    const plays = artistStats.plays.toLocaleString();
    const downloads = artistStats.downloads.toLocaleString();

    const breadcrumbHtml = `<span class="breadcrumb-current"><i class="fas fa-microphone"></i>${artistName}</span>`;

    let artistCoverHtml = `<i class="fas fa-microphone"></i>`;
    if (artist.thumbnail) {
      try {
        const thumbObj = await env.media.get(artist.thumbnail);
        if (thumbObj) {
          const ext = artist.thumbnail.split(".").pop();
          const thumbUrl = `/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}`;
          artistCoverHtml = `<img src="${thumbUrl}" alt="${artistName}">`;
        }
      } catch (e) {}
    }

    // Collect all songs
    const allSongs = [];

    for (const alb of artistAlbums) {
      for (const songKey of alb.songs) {
        const [sid] = songKey.split("_");
        if (sid !== artistId) continue;
        const meta = await getMetadata(env, songKey);
        const title = meta ? meta.title : songKey.split("_").slice(1).join(" ");
        const uploaded = alb.created;
        allSongs.push({
          key: songKey,
          title,
          artistName,
          artists: [artistName],
          albumId: alb.id,
          albumTitle: alb.title,
          uploaded,
          role: 'primary'
        });
      }
    }

    for (const songKey of singles) {
      const audioObj = await env.media.get(`songs/${songKey}.mp3`);
      const uploaded = audioObj?.uploaded || Date.now();
      const meta = await getMetadata(env, songKey);
      const title = meta ? meta.title : songKey.split("_").slice(1).join(" ");
      allSongs.push({
        key: songKey,
        title,
        artistName,
        artists: [artistName],
        albumId: null,
        albumTitle: null,
        uploaded,
        role: 'primary'
      });
    }

    const processedKeys = new Set(allSongs.map(s => s.key));
    for (const songKey of artist.songs) {
      if (processedKeys.has(songKey)) continue;
      const meta = await getMetadata(env, songKey);
      if (meta && meta.featuredArtists.includes(artistId)) {
        const audioObj = await env.media.get(`songs/${songKey}.mp3`);
        const uploaded = audioObj?.uploaded || Date.now();
        const primaryArtistName = artists[meta.primaryArtist]?.name || meta.primaryArtist;
        const title = meta.title;
        allSongs.push({
          key: songKey,
          title,
          artistName: primaryArtistName,
          artists: [primaryArtistName, ...meta.featuredArtists.map(fid => artists[fid]?.name || fid)],
          albumId: null,
          albumTitle: null,
          uploaded,
          role: 'featured'
        });
      }
    }

    allSongs.sort((a, b) => b.uploaded - a.uploaded);

    const songsHtml = await Promise.all(
      allSongs.slice(0, 10).map(async (song, idx) => {
        let thumbUrl = "/images/placeholder.jpg";
        let hasImage = false;
        try {
          const jpg = await env.media.get(`images/${song.key}.jpg`);
          if (jpg) {
            thumbUrl = `/images/${encodeURIComponent(song.key)}.jpg`;
            hasImage = true;
          } else {
            const png = await env.media.get(`images/${song.key}.png`);
            if (png) {
              thumbUrl = `/images/${encodeURIComponent(song.key)}.png`;
              hasImage = true;
            }
          }
        } catch (e) {}

        const date = formatDate(song.uploaded);
        const meta = await getMetadata(env, song.key);
        const durationSeconds = meta?.duration || 0;
        const durationFormatted = formatDuration(durationSeconds);
        const artistDisplay = song.artists.join(', ');
        const roleBadge = song.role === 'featured' ? '<span class="featured-badge">Featured</span>' : '';

        return `
          <div class="album-item" onclick="window.location='/song/${encodeURIComponent(
            song.key + ".mp3"
          )}'">
            <div class="album-thumbnail ${hasImage ? "" : "placeholder"}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${song.title}" loading="lazy">` : ""}
            </div>
            <div class="album-info">
              <span class="album-title">${song.title}</span>
              <div class="album-meta">
                <span class="album-artist">${artistDisplay}</span>
                <span class="song-duration">${durationFormatted}</span>
                <span class="album-genre">${song.role === 'featured' ? 'Featured' : 'Song'}</span>
              </div>
              <span class="album-date">${date} ${roleBadge}</span>
            </div>
          </div>
        `;
      })
    );

    const albumsHtml = await Promise.all(
      artistAlbums.slice(0, 3).map(async (alb) => {
        let thumbUrl = "/images/placeholder.jpg";
        let hasImage = false;
        if (alb.thumbnail && alb.thumbnail !== "/images/placeholder.jpg") {
          try {
            const ext = alb.thumbnail.split(".").pop();
            thumbUrl = `/albums/thumbnails/${encodeURIComponent(alb.id)}.${ext}`;
            hasImage = true;
          } catch (e) {}
        }
        const date = formatDate(alb.created);
        return `
          <div class="album-item" onclick="window.location='/album/${alb.id}'">
            <div class="album-thumbnail ${hasImage ? "" : "placeholder"}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${alb.title}" loading="lazy">` : ""}
            </div>
            <div class="album-info">
              <span class="album-title">${artistName} - ${alb.title}</span>
              <div class="album-meta">
                <span class="album-artist">${artistName}</span>
                <span class="album-genre">Album</span>
              </div>
              <span class="album-date">${date}</span>
            </div>
          </div>
        `;
      })
    );

    // Collaborations
    const collabMap = new Map();
    for (const alb of artistAlbums) {
      if (alb.artists) {
        for (const aid of alb.artists) {
          if (aid !== artistId && artists[aid]) {
            const count = collabMap.get(aid) || 0;
            collabMap.set(aid, count + 1);
          }
        }
      }
    }
    for (const songKey of artist.songs) {
      const meta = await getMetadata(env, songKey);
      if (meta && meta.primaryArtist !== artistId && meta.featuredArtists.includes(artistId)) {
        const primaryId = meta.primaryArtist;
        if (primaryId && artists[primaryId]) {
          const count = collabMap.get(primaryId) || 0;
          collabMap.set(primaryId, count + 1);
        }
      }
    }
    const collabArtists = Array.from(collabMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const collabHtml =
      collabArtists.length > 0
        ? await Promise.all(
            collabArtists.map(async ([aid, count]) => {
              const a = artists[aid];
              let thumbUrl = "/images/placeholder.jpg";
              let hasImage = false;
              if (a.thumbnail) {
                try {
                  const ext = a.thumbnail.split(".").pop();
                  thumbUrl = `/artists/thumbnails/${encodeURIComponent(a.id)}.${ext}`;
                  hasImage = true;
                } catch (e) {}
              }
              const bgStyle = hasImage
                ? `style="background-image:url('${thumbUrl}');background-size:cover;"`
                : "";
              return `
                <div class="album-item" onclick="window.location='/artist/${a.id}'">
                  <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
                  <div class="album-info">
                    <span class="album-title">${a.name}</span>
                    <div class="album-meta">
                      <span class="album-artist">${count} Songs</span>
                      <span class="album-genre">${a.genre || "Artist"}</span>
                    </div>
                    <span class="album-date">${count} collaboration${count > 1 ? "s" : ""}</span>
                  </div>
                </div>
              `;
            })
          ).then((r) => r.join(""))
        : `<div style="padding: 20px; text-align: center; color: #666;">No collaborations yet</div>`;

    // Artist playlists HTML
    const artistPlaylistsHtml = artistPlaylists.length > 0 
      ? await Promise.all(artistPlaylists.slice(0, 3).map(async pl => {
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
                  <span class="album-artist playlist-songs">${pl.songCount} Songs</span>
                  <span class="album-genre">${pl.artistSongCount} by ${artistName}</span>
                </div>
                <span class="album-date">Curated by ${pl.curator}</span>
              </div>
            </div>
          `;
        })).then(results => results.join(''))
      : `<div style="padding: 20px; text-align: center; color: #666;">No playlists featuring ${artistName} yet</div>`;

    // Similar artists
    const otherArtists = Object.values(artists).filter((a) => a.id !== artistId);
    let similar = [];
    if (artist.genre) {
      similar = otherArtists
        .filter((a) => a.genre === artist.genre)
        .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))
        .slice(0, 3);
    }
    if (similar.length < 3) {
      const needed = 3 - similar.length;
      const randomOthers = otherArtists
        .filter((a) => !similar.includes(a))
        .sort(() => 0.5 - Math.random())
        .slice(0, needed);
      similar = [...similar, ...randomOthers];
    }

    const similarHtml =
      similar.length > 0
        ? await Promise.all(
            similar.slice(0, 3).map(async (a) => {
              let thumbUrl = "/images/placeholder.jpg";
              let hasImage = false;
              if (a.thumbnail) {
                try {
                  const ext = a.thumbnail.split(".").pop();
                  thumbUrl = `/artists/thumbnails/${encodeURIComponent(a.id)}.${ext}`;
                  hasImage = true;
                } catch (e) {}
              }
              const bgStyle = hasImage
                ? `style="background-image:url('${thumbUrl}');background-size:cover;"`
                : "";
              const songCount = a.songs?.length || 0;
              const since = a.created ? new Date(a.created).getFullYear() : "N/A";
              return `
                <div class="album-item" onclick="window.location='/artist/${a.id}'">
                  <div class="album-thumbnail artist-thumbnail" ${bgStyle}></div>
                  <div class="album-info">
                    <span class="album-title">${a.name}</span>
                    <div class="album-meta">
                      <span class="album-artist">${songCount} Songs</span>
                      <span class="album-genre">${a.genre || "Artist"}</span>
                    </div>
                    <span class="album-date">Since ${since}</span>
                  </div>
                </div>
              `;
            })
          ).then((r) => r.join(""))
        : `<div style="padding: 20px; text-align: center; color: #666;">No similar artists</div>`;

    const infoHtml = `
      <p><strong>Genre:</strong> ${genre}</p>
      <p><strong>Active Since:</strong> ${sinceYear}</p>
      <p><strong>Label:</strong> ${artist.label || "Independent"}</p>
      <p><strong>Origin:</strong> ${artist.origin || "Zambia"}</p>
      <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 3px;">
        <i class="fas fa-info-circle" style="color: #ff6b6b;"></i>
        <span style="margin-left: 5px;">All songs available for download</span>
      </div>
    `;

    html = html
      .replace(/<title>.*?<\/title>/, `<title>${artistName} - ZEDALBUMS</title>`)
      .replace(/<!-- ARTIST_BREADCRUMB -->/, breadcrumbHtml)
      .replace(/<h1 class="artist-title">.*?<\/h1>/, `<h1 class="artist-title">${artistName}</h1>`)
      .replace(/<div class="artist-genre">.*?<\/div>/, `<div class="artist-genre">${genre}</div>`)
      .replace(/<!-- ARTIST_DESCRIPTION -->/, description)
      .replace(/<!-- ARTIST_COVER -->/, artistCoverHtml)
      .replace(/<!-- ARTIST_SONGS_COUNT -->/, songCount.toString())
      .replace(/<!-- ARTIST_SINCE -->/, sinceYear.toString())
      .replace(/<!-- ARTIST_PLAYS -->/, plays)
      .replace(/<!-- ARTIST_DOWNLOADS -->/, downloads)
      .replace(/<!-- SONGS_LIST -->/, songsHtml.join(""))
      .replace(/<!-- ALBUMS_BY_ARTIST -->/, albumsHtml.join(""))
      .replace(/<!-- COLLABORATIONS_LIST -->/, collabHtml)
      .replace(/<!-- ARTIST_PLAYLISTS_START -->[\s\S]*?<!-- ARTIST_PLAYLISTS_END -->/g,
        `<!-- ARTIST_PLAYLISTS_START -->
        <section class="section-block">
          <div class="section-header">
            <h2 class="section-title">Playlists featuring ${artistName}</h2>
            <a href="/playlists?artist=${artistId}" class="view-all">View All ➔</a>
          </div>
          <div class="playlists-list">
            ${artistPlaylistsHtml}
          </div>
        </section>
        <!-- ARTIST_PLAYLISTS_END -->`
      )
      .replace(/<!-- SIMILAR_ARTISTS_LIST -->/, similarHtml)
      .replace(/<!-- ARTIST_INFO_CONTENT -->/, infoHtml)
      .replace(
        /<a href="#" class="view-all">View All ➔<\/a>/g,
        `<a href="/artist/${artistId}?view=albums" class="view-all">View All ➔</a>`
      )
      .replace(
        /<a href="#" class="breadcrumb-link"><i class="fas fa-user"><\/i>Artists<\/a>/,
        '<a href="/artists" class="breadcrumb-link"><i class="fas fa-user"></i>Artists</a>'
      )
      .replace(
        /<a href="\/" class="breadcrumb-link"><i class="fas fa-home"><\/i>Home<\/a>/,
        '<a href="/" class="breadcrumb-link"><i class="fas fa-home"></i>Home</a>'
      );

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  // Artist create page
  if (path === "/artist/create" && req.method === "GET") {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Create Artist - ZEDALBUMS</title>
      <style>
        body { font-family: Arial,sans-serif; padding:50px; background:#f0f0f0; }
        .container { max-width:500px; margin:0 auto; background:white; padding:30px; border-radius:8px; }
        h1 { color:#333; border-left:4px solid #9b59b6; padding-left:15px; }
        label { display:block; margin-top:15px; font-weight:bold; }
        input, textarea { width:100%; padding:12px; margin-top:5px; border:1px solid #ddd; border-radius:4px; }
        button { margin-top:25px; padding:14px; background:#9b59b6; color:#fff; border:none; border-radius:4px; cursor:pointer; width:100%; font-size:16px; }
        button:hover { background:#8e44ad; }
        .back-link { margin-top:20px; text-align:center; }
        .back-link a { color:#666; text-decoration:none; }
        .back-link a:hover { color:#9b59b6; }
      </style>
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          const urlParams = new URLSearchParams(window.location.search);
          const fromUpload = urlParams.get('from') === 'upload';
          
          const backLink = document.querySelector('.back-link a');
          if (fromUpload && backLink) {
            backLink.href = '/upload';
            backLink.innerHTML = '← Back to Upload';
          }
          
          const newArtistName = sessionStorage.getItem('newArtistName');
          if (newArtistName) {
            document.querySelector('input[name="name"]').value = newArtistName;
            sessionStorage.removeItem('newArtistName');
          }
        });
      </script>
    </head>
    <body>
      <div class="container">
        <h1>Create New Artist</h1>
        <form action="/artist/create" method="POST" enctype="multipart/form-data">
          <label>Artist Name</label>
          <input type="text" name="name" required>
          <label>Artist Bio (Optional)</label>
          <textarea name="description" rows="3"></textarea>
          <label>Genre (Optional)</label>
          <input type="text" name="genre" placeholder="e.g. Zam Pop, Gospel, Hip Hop">
          <label>Artist Image (Optional)</label>
          <input type="file" name="thumbnail" accept="image/*">
          <button type="submit">Create Artist</button>
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

  if (path === "/artist/create" && req.method === "POST") {
    const formData = await req.formData();
    const name = formData.get("name");
    const description = formData.get("description") || "";
    const genre = formData.get("genre") || "";
    const thumbnailFile = formData.get("thumbnail");

    if (!name) {
      return new Response("Missing artist name", { status: 400 });
    }

    const artistId = sanitize(name);
    const artists = await getArtists(env);

    let thumbnailKey = null;
    if (thumbnailFile && thumbnailFile.size > 0) {
      const imgType = thumbnailFile.type.includes("png") ? "png" : "jpg";
      thumbnailKey = `artists/thumbnails/${artistId}.${imgType}`;
      await env.media.put(thumbnailKey, thumbnailFile.stream());
    }

    if (!artists[artistId]) {
      artists[artistId] = {
        id: artistId,
        name: name,
        description: description,
        genre: genre,
        thumbnail: thumbnailKey,
        created: Date.now(),
        songs: [],
        albums: []
      };
      await saveArtists(env, artists);
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Artist Created - ZEDALBUMS</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; text-align: center; }
          .success { background: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
          h1 { color: #9b59b6; }
          .btn { display: inline-block; margin: 10px; padding: 12px 24px; background: #9b59b6; color: white; text-decoration: none; border-radius: 4px; }
          .btn:hover { background: #8e44ad; }
          .btn-upload { background: #ff5500; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✅ Artist Created!</h1>
          <p style="font-size: 1.2rem;">${name}</p>
          <a href="/artist/${artistId}" class="btn">View Artist</a>
          <a href="/upload" class="btn btn-upload">Upload Songs</a>
          <p style="margin-top: 20px;"><a href="/artist/create">Create Another Artist</a></p>
        </div>
      </body>
      </html>
    `;
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }

  return new Response("Not found", { status: 404 });
}