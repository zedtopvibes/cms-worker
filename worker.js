export default {
  async fetch(req, env, ctx) {
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

    // --- Playlists cache ---
    let playlistsCache = null;
    let playlistsCacheTimestamp = 0;
    const PLAYLISTS_CACHE_DURATION = 60000;

    // --- Metadata cache (for song metadata) ---
    let metadataCache = {};
    let metadataCacheTimestamp = 0;
    const METADATA_CACHE_DURATION = 60000; // 1 minute

    // -----------------------------
    // Helper to sanitize filenames
    // -----------------------------
    const sanitize = str => str.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");

// -----------------------------
// Helper to format numbers (0-999 = full number, 1000+ = 1K, 1.2K, etc)
// -----------------------------
const formatNumber = (num) => {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
};

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

    // === Add artist to album's artists array ===
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

    // === Remove artist from album ===
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

    // === getArtistAlbumsAndSingles with CORRECT stats ===
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

    // ========== NEW: PLAYLIST FUNCTIONS ==========
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
        if (!playlists[playlistId].songs) playlists[playlistId].songs = [];
        if (!playlists[playlistId].songs.includes(songKey)) {
          playlists[playlistId].songs.push(songKey);
          playlists[playlistId].updated = Date.now();
          await savePlaylists(playlists);
        }
      }
    };

    const removeSongFromPlaylist = async (playlistId, songKey) => {
      const playlists = await getPlaylists();
      if (playlists[playlistId] && playlists[playlistId].songs) {
        const index = playlists[playlistId].songs.indexOf(songKey);
        if (index !== -1) {
          playlists[playlistId].songs.splice(index, 1);
          playlists[playlistId].updated = Date.now();
          await savePlaylists(playlists);
        }
      }
    };

    const getPlaylistSongs = async (playlistId) => {
      const playlists = await getPlaylists();
      return playlists[playlistId] ? playlists[playlistId].songs || [] : [];
    };
    // ========== END PLAYLIST FUNCTIONS ==========

    // ========== NEW: METADATA FUNCTIONS (for song-level artist details) ==========
    const getMetadata = async (songKey) => {
      const now = Date.now();
      // Check cache
      if (metadataCache[songKey] && (now - metadataCacheTimestamp < METADATA_CACHE_DURATION)) {
        return metadataCache[songKey];
      }
      try {
        const metaObj = await env.media.get(`metadata/${songKey}.json`);
        if (!metaObj) {
          metadataCache[songKey] = null;
          metadataCacheTimestamp = now;
          return null;
        }
        const text = await metaObj.text();
        const metadata = JSON.parse(text);
        metadataCache[songKey] = metadata;
        metadataCacheTimestamp = now;
        return metadata;
      } catch (e) {
        metadataCache[songKey] = null;
        metadataCacheTimestamp = now;
        return null;
      }
    };

    const saveMetadata = async (songKey, metadata) => {
      await env.media.put(`metadata/${songKey}.json`, JSON.stringify(metadata));
      metadataCache[songKey] = metadata;
      metadataCacheTimestamp = Date.now();
    };
    // ========== END METADATA FUNCTIONS ==========

    // ==================== STATS FUNCTIONS (D1) ====================
    async function incrementPlay(songKey, env) {
      await env.DB.prepare(
        `INSERT INTO song_stats (song_key, plays, downloads, last_played)
         VALUES (?, 1, 0, CURRENT_TIMESTAMP)
         ON CONFLICT(song_key) DO UPDATE SET 
           plays = plays + 1,
           last_played = CURRENT_TIMESTAMP`
      ).bind(songKey).run();
    }

    async function incrementDownload(songKey, env) {
      await env.DB.prepare(
        `INSERT INTO song_stats (song_key, plays, downloads, last_downloaded)
         VALUES (?, 0, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(song_key) DO UPDATE SET 
           downloads = downloads + 1,
           last_downloaded = CURRENT_TIMESTAMP`
      ).bind(songKey).run();
    }

    async function getSongStats(songKey, env) {
      const { results } = await env.DB.prepare(
        `SELECT plays, downloads FROM song_stats WHERE song_key = ?`
      ).bind(songKey).all();
      return results[0] || { plays: 0, downloads: 0 };
    }

    async function getAggregatedStats(songKeys, env) {
      if (songKeys.length === 0) return { plays: 0, downloads: 0 };
      const placeholders = songKeys.map(() => '?').join(',');
      const { results } = await env.DB.prepare(
        `SELECT SUM(plays) as total_plays, SUM(downloads) as total_downloads
         FROM song_stats
         WHERE song_key IN (${placeholders})`
      ).bind(...songKeys).all();
      return {
        plays: results[0]?.total_plays || 0,
        downloads: results[0]?.total_downloads || 0
      };
    }
    // ==================== END STATS FUNCTIONS ====================

    // ==================== CHART DATA FUNCTIONS ====================
    async function getTopAlbums(env, limit = 50, timeFilter = 'all') {
      const albums = await getAlbums();
      const albumList = Object.values(albums);
      
      const albumsWithStats = await Promise.all(albumList.map(async (album) => {
        const stats = await getAggregatedStats(album.songs || [], env);
        return {
          ...album,
          totalPlays: stats.plays,
          totalDownloads: stats.downloads
        };
      }));
      
      const sorted = albumsWithStats.sort((a, b) => b.totalPlays - a.totalPlays);
      
      return sorted.slice(0, limit).map((album, index) => ({
        ...album,
        rank: index + 1,
        rankChange: Math.floor(Math.random() * 5) - 2,
        peakRank: Math.max(1, Math.floor(Math.random() * 5))
      }));
    }

    async function getTopSongs(env, limit = 100, timeFilter = 'all') {
      const songList = await env.media.list({ prefix: "songs/" });
      const songFiles = songList.objects || [];

      const songsWithStats = await Promise.all(songFiles.map(async (file) => {
        const fileName = file.key.split("/")[1];
        const baseName = fileName.replace(".mp3", "");
        const stats = await getSongStats(baseName, env);
        const meta = await getMetadata(baseName);
        
        let albumInfo = null;
        const albums = await getAlbums();
        for (const [id, album] of Object.entries(albums)) {
          if (album.songs.includes(baseName)) {
            albumInfo = { id, title: album.title };
            break;
          }
        }

        return {
          key: baseName,
          fileName: fileName,
          title: meta?.title || baseName.split("_").slice(1).join(" "),
          primaryArtist: meta?.primaryArtist || baseName.split("_")[0],
          featuredArtists: meta?.featuredArtists || [],
          plays: stats.plays,
          downloads: stats.downloads,
          uploaded: file.uploaded,
          album: albumInfo
        };
      }));

      const sorted = songsWithStats
        .map(song => ({ ...song, score: song.plays + (song.downloads * 2) }))
        .sort((a, b) => b.score - a.score);

      return sorted.slice(0, limit).map((song, index) => ({
        ...song,
        rank: index + 1,
        rankChange: Math.floor(Math.random() * 5) - 2,
        peakRank: Math.max(1, Math.floor(Math.random() * 10))
      }));
    }

    async function getTopArtists(env, limit = 50) {
      const artists = await getArtists();
      const artistList = Object.values(artists);

      const artistsWithStats = await Promise.all(artistList.map(async (artist) => {
        const stats = await getAggregatedStats(artist.songs || [], env);
        const monthlyListeners = Math.floor(stats.plays * 0.3);

        return {
          ...artist,
          totalPlays: stats.plays,
          totalDownloads: stats.downloads,
          monthlyListeners: monthlyListeners,
          songCount: artist.songs?.length || 0,
          albumCount: artist.albums?.length || 0
        };
      }));

      const sorted = artistsWithStats.sort((a, b) => b.totalPlays - a.totalPlays);
      
      return sorted.slice(0, limit).map((artist, index) => ({
        ...artist,
        rank: index + 1,
        rankChange: Math.floor(Math.random() * 5) - 2,
        peakRank: Math.max(1, Math.floor(Math.random() * 5))
      }));
    }

    async function getTopPlaylists(env, limit = 50) {
      const playlists = await getPlaylists();
      const playlistList = Object.values(playlists);

      const playlistsWithStats = await Promise.all(playlistList.map(async (playlist) => {
        const stats = await getAggregatedStats(playlist.songs || [], env);
        return {
          ...playlist,
          totalPlays: stats.plays,
          totalDownloads: stats.downloads,
          songCount: playlist.songs?.length || 0
        };
      }));

      const sorted = playlistsWithStats.sort((a, b) => b.totalDownloads - a.totalDownloads);
      
      return sorted.slice(0, limit).map((playlist, index) => ({
        ...playlist,
        rank: index + 1,
        rankChange: Math.floor(Math.random() * 5) - 2,
        peakRank: Math.max(1, Math.floor(Math.random() * 5))
      }));
    }

    async function getNewReleases(env, limit = 50) {
      const albums = await getAlbums();
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      const recentAlbums = Object.values(albums)
        .filter(album => album.created > thirtyDaysAgo)
        .map(album => ({ ...album, type: 'album' }));

      const songList = await env.media.list({ prefix: "songs/" });
      const recentSongs = await Promise.all(
        (songList.objects || [])
          .filter(file => file.uploaded > thirtyDaysAgo)
          .slice(0, limit - recentAlbums.length)
          .map(async (file) => {
            const fileName = file.key.split("/")[1];
            const baseName = fileName.replace(".mp3", "");
            const meta = await getMetadata(baseName);
            return {
              id: baseName,
              title: meta?.title || baseName.split("_").slice(1).join(" "),
              type: 'single',
              artistId: meta?.primaryArtist || baseName.split("_")[0],
              created: file.uploaded,
              thumbnail: null
            };
          })
      );

      return [...recentAlbums, ...recentSongs]
        .sort((a, b) => b.created - a.created)
        .slice(0, limit);
    }

    async function getAlbumThumbnailUrl(album, env) {
      if (album.thumbnail) {
        try {
          const thumbObj = await env.media.get(album.thumbnail);
          if (thumbObj) {
            const ext = album.thumbnail.split(".").pop();
            return `/albums/thumbnails/${encodeURIComponent(album.id)}.${ext}`;
          }
        } catch (e) {}
      }
      return "/images/placeholder.jpg";
    }

    async function getSongThumbnailUrl(baseName, env) {
      try {
        const jpgObj = await env.media.get(`images/${baseName}.jpg`);
        if (jpgObj) return `/images/${encodeURIComponent(baseName)}.jpg`;
        const pngObj = await env.media.get(`images/${baseName}.png`);
        if (pngObj) return `/images/${encodeURIComponent(baseName)}.png`;
      } catch (e) {}
      return "/images/placeholder.jpg";
    }

    async function getArtistThumbnailUrl(artist, env) {
      if (artist.thumbnail) {
        try {
          const thumbObj = await env.media.get(artist.thumbnail);
          if (thumbObj) {
            const ext = artist.thumbnail.split(".").pop();
            return `/artists/thumbnails/${encodeURIComponent(artist.id)}.${ext}`;
          }
        } catch (e) {}
      }
      return "/images/placeholder.jpg";
    }

    async function getPlaylistThumbnailUrl(playlist, env) {
      if (playlist.thumbnail) {
        try {
          const thumbObj = await env.media.get(playlist.thumbnail);
          if (thumbObj) {
            const ext = playlist.thumbnail.split(".").pop();
            return `/playlists/thumbnails/${encodeURIComponent(playlist.id)}.${ext}`;
          }
        } catch (e) {}
      }
      return "/images/placeholder.jpg";
    }

    function generateAlbumChartItem(album, thumbUrl, artists, isPreview = false) {
      const primaryArtist = (album.artists?.length && artists[album.artists[0]]) 
        ? artists[album.artists[0]].name 
        : "Various";
      
      const rankClass = album.rank === 1 ? 'top1' : (album.rank === 2 ? 'silver' : (album.rank === 3 ? 'bronze' : ''));
      const trendIcon = album.rankChange > 0 ? 'arrow-up' : (album.rankChange < 0 ? 'arrow-down' : 'minus');
      const trendColor = album.rankChange > 0 ? '#27ae60' : (album.rankChange < 0 ? '#e74c3c' : '#999');
      
      return `
        <div class="album-item" onclick="window.location='/album/${album.id}'">
          <div class="album-thumbnail">
            <div class="rank-overlay ${rankClass}">${album.rank}</div>
            <img src="${thumbUrl}" alt="${album.title}" loading="lazy">
          </div>
          <div class="album-info">
            <span class="album-title">${album.title}</span>
            <div class="album-meta">
              <span class="album-artist">${primaryArtist}</span>
              <span class="album-tracks">${album.songs?.length || 0} Tracks</span>
              <span class="download-badge"><i class="fas fa-download"></i> ${formatNumber(album.totalDownloads)}</span>            </div>
            ${!isPreview ? `
            <div class="album-meta">
              <span class="rank-change"><i class="fas fa-${trendIcon}" style="color: ${trendColor}"></i> ${Math.abs(album.rankChange)} from last week</span>
              <span class="peak-rank">Peak: #${album.peakRank}</span>
            </div>
            ` : ''}
            <span class="album-date">Released: ${new Date(album.created).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      `;
    }

    function generateSongChartItem(song, thumbUrl, artists, isPreview = false) {
      const primaryArtistName = artists[song.primaryArtist]?.name || song.primaryArtist;
      const rankClass = song.rank === 1 ? 'top1' : (song.rank === 2 ? 'silver' : (song.rank === 3 ? 'bronze' : ''));
      const trendIcon = song.rankChange > 0 ? 'arrow-up' : (song.rankChange < 0 ? 'arrow-down' : 'minus');
      const trendColor = song.rankChange > 0 ? '#27ae60' : (song.rankChange < 0 ? '#e74c3c' : '#999');
      
      return `
        <div class="album-item" onclick="window.location='/song/${encodeURIComponent(song.fileName)}'">
          <div class="album-thumbnail">
            <div class="rank-overlay ${rankClass}">${song.rank}</div>
            <img src="${thumbUrl}" alt="${song.title}" loading="lazy">
            <div class="play-btn-mini"><i class="fas fa-play"></i></div>
          </div>
          <div class="album-info">
            <span class="album-title">${song.title}</span>
            <div class="album-meta">
              <span class="album-artist">${primaryArtistName}</span>
              ${song.album ? `<span class="from-album">from "${song.album.title}"</span>` : ''}
            </div>
            <div class="album-meta">
              <span class="play-badge"><i class="fas fa-play"></i> ${formatNumber(song.plays)}</span>
<span class="download-badge"><i class="fas fa-download"></i> ${formatNumber(song.downloads)}</span>
            </div>
            ${!isPreview ? `
            <div class="album-meta">
              <span class="rank-change"><i class="fas fa-${trendIcon}" style="color: ${trendColor}"></i> ${Math.abs(song.rankChange)} from last week</span>
              <span class="peak-rank">Peak: #${song.peakRank}</span>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    function generateArtistChartItem(artist, thumbUrl, isPreview = false) {
      const rankClass = artist.rank === 1 ? 'top1' : (artist.rank === 2 ? 'silver' : (artist.rank === 3 ? 'bronze' : ''));
      const trendIcon = artist.rankChange > 0 ? 'arrow-up' : (artist.rankChange < 0 ? 'arrow-down' : 'minus');
      const trendColor = artist.rankChange > 0 ? '#27ae60' : (artist.rankChange < 0 ? '#e74c3c' : '#999');
      
      return `
        <div class="album-item" onclick="window.location='/artist/${artist.id}'">
          <div class="album-thumbnail artist-thumbnail">
            <div class="rank-overlay ${rankClass}">${artist.rank}</div>
            ${thumbUrl !== "/images/placeholder.jpg" ? `<img src="${thumbUrl}" alt="${artist.name}" loading="lazy">` : ''}
          </div>
          <div class="album-info">
            <span class="album-title">${artist.name}</span>
            <div class="artist-stats">
              <span class="play-badge"><i class="fas fa-play"></i> ${formatNumber(artist.monthlyListeners)} monthly listeners</span>
              <span class="monthly-listeners">${artist.albumCount} albums</span>
              <span class="monthly-listeners">${artist.songCount} songs</span>
            </div>
            ${!isPreview ? `
            <div class="album-meta">
              <span class="rank-change"><i class="fas fa-${trendIcon}" style="color: ${trendColor}"></i> ${Math.abs(artist.rankChange)} from last week</span>
              <span class="peak-rank">Peak: #${artist.peakRank}</span>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    function generatePlaylistChartItem(playlist, thumbUrl, isPreview = false) {
      const rankClass = playlist.rank === 1 ? 'top1' : (playlist.rank === 2 ? 'silver' : (playlist.rank === 3 ? 'bronze' : ''));
      const trendIcon = playlist.rankChange > 0 ? 'arrow-up' : (playlist.rankChange < 0 ? 'arrow-down' : 'minus');
      const trendColor = playlist.rankChange > 0 ? '#27ae60' : (playlist.rankChange < 0 ? '#e74c3c' : '#999');
      const date = new Date(playlist.updated || playlist.created);
      const now = new Date();
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      const timeAgo = diffDays === 0 ? 'Today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
      
      return `
        <div class="album-item" onclick="window.location='/playlist/${playlist.id}'">
          <div class="album-thumbnail playlist-thumbnail">
            <div class="rank-overlay ${rankClass}">${playlist.rank}</div>
            ${thumbUrl !== "/images/placeholder.jpg" ? `<img src="${thumbUrl}" alt="${playlist.title}" loading="lazy">` : ''}
          </div>
          <div class="album-info">
            <span class="album-title">${playlist.title}</span>
            <div class="playlist-stats">
              <span class="playlist-badge"><i class="fas fa-list"></i> ${playlist.songCount} songs</span>
              <span class="download-badge"><i class="fas fa-download"></i> ${formatNumber(playlist.totalDownloads)} downloads</span>
            </div>
            <div class="album-meta">
              <span class="curator-info"><i class="fas fa-user"></i> Curated by ${playlist.curator || 'ZEDALBUMS'}</span>
              <span class="album-date">Updated: ${timeAgo}</span>
            </div>
            ${!isPreview ? `
            <div class="album-meta">
              <span class="rank-change"><i class="fas fa-${trendIcon}" style="color: ${trendColor}"></i> ${Math.abs(playlist.rankChange)} from last week</span>
              <span class="peak-rank">Peak: #${playlist.peakRank}</span>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    function generateNewReleaseAlbumItem(album, thumbUrl, artists) {
      const primaryArtist = (album.artists?.length && artists[album.artists[0]]) 
        ? artists[album.artists[0]].name 
        : "Various";
      const date = new Date(album.created);
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
      const timeAgo = diffHours < 24 
        ? `${diffHours} hours ago` 
        : `${Math.floor(diffHours / 24)} days ago`;
      
      return `
        <div class="album-item" onclick="window.location='/album/${album.id}'">
          <div class="album-thumbnail">
            <img src="${thumbUrl}" alt="${album.title}" loading="lazy">
          </div>
          <div class="album-info">
            <span class="album-title">${album.title} <span class="new-badge">NEW</span></span>
            <div class="album-meta">
              <span class="album-artist">${primaryArtist}</span>
              <span class="album-tracks">${album.songs?.length || 0} Tracks</span>
              <span class="album-genre">Album</span>
            </div>
            <span class="album-date">Released: ${timeAgo}</span>
          </div>
        </div>
      `;
    }

    function generateNewReleaseSongItem(song, thumbUrl, artists) {
      const primaryArtistName = artists[song.artistId]?.name || song.artistId;
      const date = new Date(song.created);
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
      const timeAgo = diffHours < 24 
        ? `${diffHours} hours ago` 
        : `${Math.floor(diffHours / 24)} days ago`;
      
      return `
        <div class="album-item" onclick="window.location='/song/${encodeURIComponent(song.id + ".mp3")}'">
          <div class="album-thumbnail">
            <img src="${thumbUrl}" alt="${song.title}" loading="lazy">
            <div class="play-btn-mini"><i class="fas fa-play"></i></div>
          </div>
          <div class="album-info">
            <span class="album-title">${song.title} <span class="new-badge">SINGLE</span></span>
            <div class="album-meta">
              <span class="album-artist">${primaryArtistName}</span>
              <span class="album-genre">Single</span>
            </div>
            <span class="album-date">Released: ${timeAgo}</span>
          </div>
        </div>
      `;
    }

    async function renderChartsOverview(html, data, env) {
      const artists = await getArtists();
      
      const albumsHtml = await Promise.all(data.topAlbums.map(async (item) => {
        let thumbUrl = await getAlbumThumbnailUrl(item, env);
        return generateAlbumChartItem(item, thumbUrl, artists, true);
      }));
      html = html.replace(/<!-- TOP_ALBUMS_START -->[\s\S]*?<!-- TOP_ALBUMS_END -->/, 
        `<!-- TOP_ALBUMS_START -->${albumsHtml.join('')}<!-- TOP_ALBUMS_END -->`);

      const songsHtml = await Promise.all(data.topSongs.map(async (item) => {
        let thumbUrl = await getSongThumbnailUrl(item.key, env);
        return generateSongChartItem(item, thumbUrl, artists, true);
      }));
      html = html.replace(/<!-- TOP_SONGS_START -->[\s\S]*?<!-- TOP_SONGS_END -->/, 
        `<!-- TOP_SONGS_START -->${songsHtml.join('')}<!-- TOP_SONGS_END -->`);

      const artistsHtml = await Promise.all(data.topArtists.map(async (item) => {
        let thumbUrl = await getArtistThumbnailUrl(item, env);
        return generateArtistChartItem(item, thumbUrl, true);
      }));
      html = html.replace(/<!-- TOP_ARTISTS_START -->[\s\S]*?<!-- TOP_ARTISTS_END -->/, 
        `<!-- TOP_ARTISTS_START -->${artistsHtml.join('')}<!-- TOP_ARTISTS_END -->`);

      const playlistsHtml = await Promise.all(data.topPlaylists.map(async (item) => {
        let thumbUrl = await getPlaylistThumbnailUrl(item, env);
        return generatePlaylistChartItem(item, thumbUrl, true);
      }));
      html = html.replace(/<!-- TOP_PLAYLISTS_START -->[\s\S]*?<!-- TOP_PLAYLISTS_END -->/, 
        `<!-- TOP_PLAYLISTS_START -->${playlistsHtml.join('')}<!-- TOP_PLAYLISTS_END -->`);

      const newReleasesHtml = await Promise.all(data.newReleases.map(async (item) => {
        if (item.type === 'album') {
          let thumbUrl = await getAlbumThumbnailUrl(item, env);
          return generateNewReleaseAlbumItem(item, thumbUrl, artists);
        } else {
          let thumbUrl = await getSongThumbnailUrl(item.id, env);
          return generateNewReleaseSongItem(item, thumbUrl, artists);
        }
      }));
      html = html.replace(/<!-- NEW_RELEASES_START -->[\s\S]*?<!-- NEW_RELEASES_END -->/, 
        `<!-- NEW_RELEASES_START -->${newReleasesHtml.join('')}<!-- NEW_RELEASES_END -->`);

      return html;
    }

    async function renderAlbumsChart(html, items, env) {
      const artists = await getArtists();
      const albumsHtml = await Promise.all(items.map(async (item) => {
        let thumbUrl = await getAlbumThumbnailUrl(item, env);
        return generateAlbumChartItem(item, thumbUrl, artists, false);
      }));
      return html.replace(/<!-- ITEMS_START -->[\s\S]*?<!-- ITEMS_END -->/, 
        `<!-- ITEMS_START -->${albumsHtml.join('')}<!-- ITEMS_END -->`);
    }

    async function renderSongsChart(html, items, env) {
      const artists = await getArtists();
      const songsHtml = await Promise.all(items.map(async (item) => {
        let thumbUrl = await getSongThumbnailUrl(item.key, env);
        return generateSongChartItem(item, thumbUrl, artists, false);
      }));
      return html.replace(/<!-- ITEMS_START -->[\s\S]*?<!-- ITEMS_END -->/, 
        `<!-- ITEMS_START -->${songsHtml.join('')}<!-- ITEMS_END -->`);
    }

    async function renderArtistsChart(html, items, env) {
      const artistsHtml = await Promise.all(items.map(async (item) => {
        let thumbUrl = await getArtistThumbnailUrl(item, env);
        return generateArtistChartItem(item, thumbUrl, false);
      }));
      return html.replace(/<!-- ITEMS_START -->[\s\S]*?<!-- ITEMS_END -->/, 
        `<!-- ITEMS_START -->${artistsHtml.join('')}<!-- ITEMS_END -->`);
    }

    async function renderPlaylistsChart(html, items, env) {
      const playlistsHtml = await Promise.all(items.map(async (item) => {
        let thumbUrl = await getPlaylistThumbnailUrl(item, env);
        return generatePlaylistChartItem(item, thumbUrl, false);
      }));
      return html.replace(/<!-- ITEMS_START -->[\s\S]*?<!-- ITEMS_END -->/, 
        `<!-- ITEMS_START -->${playlistsHtml.join('')}<!-- ITEMS_END -->`);
    }

    async function renderNewReleases(html, items, env) {
      const artists = await getArtists();
      const releasesHtml = await Promise.all(items.map(async (item) => {
        if (item.type === 'album') {
          let thumbUrl = await getAlbumThumbnailUrl(item, env);
          return generateNewReleaseAlbumItem(item, thumbUrl, artists);
        } else {
          let thumbUrl = await getSongThumbnailUrl(item.id, env);
          return generateNewReleaseSongItem(item, thumbUrl, artists);
        }
      }));
      return html.replace(/<!-- ITEMS_START -->[\s\S]*?<!-- ITEMS_END -->/, 
        `<!-- ITEMS_START -->${releasesHtml.join('')}<!-- ITEMS_END -->`);
    }
    // ==================== END CHART FUNCTIONS ====================

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
      
      const playlists = await getPlaylists();
      const playlistOptions = Object.keys(playlists).map(id => {
        const playlist = playlists[id];
        return `<option value="${id}">${playlist.title}</option>`;
      }).join("");
      
      const playlistSection = `
        <label>Add to Playlist (Optional)</label>
        <select name="playlist" style="padding:8px; margin-top:5px; border-color: #4a90e2;">
          <option value="">-- Select Playlist --</option>
          ${playlistOptions}
          <option value="__create_new__">[Create New Playlist]</option>
        </select>
        <p style="margin-top:5px; font-size:0.9em;">
          Or <a href="/playlist/create" style="color:#4a90e2; text-decoration:none;">create a new playlist</a>
        </p>
      `;
      
      const artistSection = `
        <label>Primary Artist</label>
        <select name="artist" id="artistSelect" required style="padding:8px; margin-top:5px;">
          <option value="">-- Select Primary Artist --</option>
          ${artistOptions}
          <option value="__create_new__">[Create New Artist]</option>
        </select>
        <p style="margin-top:5px; font-size:0.9em;">
          <a href="/artist/create" id="createArtistLink" style="color:#007bff; text-decoration:none; display:none;">Create New Artist</a>
          <span id="existingArtistNote" style="display:none;">Or select existing artist above</span>
        </p>
        <input type="text" name="artist_name" id="artistNameInput" placeholder="Enter new artist name" style="padding:8px; margin-top:5px; display:none;">

        <label>Featured Artists (Optional, multi-select)</label>
        <select name="featured" multiple size="4" style="padding:8px; margin-top:5px;">
          <option value="">-- None --</option>
          ${artistOptions}
        </select>
        <p style="margin-top:5px; font-size:0.9em; color:#666;">Hold Ctrl/Cmd to select multiple</p>
      `;

      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Upload Song - ZEDALBUMS.TOP</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; margin-bottom: 20px; border-left: 4px solid #ff5500; padding-left: 15px; }
          label { display: block; margin-top: 15px; font-weight: 600; color: #555; }
          input, textarea, select { width: 100%; padding: 12px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; }
          button { margin-top: 25px; padding: 14px; background: #ff5500; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 600; width: 100%; }
          button:hover { background: #ff6a1a; }
          .back-link { margin-top: 20px; text-align: center; }
          .back-link a { color: #666; text-decoration: none; }
          .back-link a:hover { color: #ff5500; }
          .section-title { margin-top: 25px; margin-bottom: 10px; font-size: 1.1rem; font-weight: 600; color: #444; border-bottom: 1px solid #eee; padding-bottom: 8px; }
          select[multiple] { height: auto; min-height: 100px; }
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
            
            const playlistSelect = document.querySelector('select[name="playlist"]');
            if (playlistSelect) {
              playlistSelect.addEventListener('change', function() {
                if (this.value === '__create_new__') {
                  window.location.href = '/playlist/create';
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
        <div class="container">
          <h1>Upload New Song</h1>
          <form action="/upload" method="POST" enctype="multipart/form-data">
            <label>Song Title</label>
            <input type="text" name="title" placeholder="e.g. My Song" required>
            
            ${artistSection}
            
            <label>Description</label>
            <textarea name="description" rows="3" placeholder="Song description..." required></textarea>
            
            <div class="section-title">Album Information</div>
            ${albumSection}
            
            <div class="section-title" style="border-bottom-color: #4a90e2;">Playlist Information</div>
            ${playlistSection}
            
            <label>Audio File (.mp3)</label>
            <input type="file" name="audio" accept=".mp3" required>
            
            <label>Thumbnail Image</label>
            <input type="file" name="image" accept="image/*" required>
            
            <button type="submit">Upload Song</button>
          </form>
          
          <div class="back-link">
            <a href="/">← Back to Home</a> | 
            <a href="/playlists">View Playlists</a>
          </div>
        </div>
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
      const albumId = formData.get("album");
      const playlistId = formData.get("playlist");
      const artistNameInput = formData.get("artist_name");
      const featured = formData.getAll("featured");

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

      const featuredArtists = featured.filter(id => id && id !== "");
      const metadata = {
        title,
        primaryArtist: artistId,
        featuredArtists,
        description
      };
      await saveMetadata(baseName, metadata);

      if (albumId && albumId !== "" && albumId !== "__create_new__") {
        await addSongToAlbum(albumId, baseName);
        await addAlbumToArtist(artistId, albumId);
        await addArtistToAlbum(artistId, albumId);
      }
      
      if (playlistId && playlistId !== "" && playlistId !== "__create_new__") {
        await addSongToPlaylist(playlistId, baseName);
      }
      
      await addSongToArtist(artistId, baseName);
      for (const fid of featuredArtists) {
        await addSongToArtist(fid, baseName);
      }

      homepageCache = null;
      cacheTimestamp = 0;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Upload Successful - ZEDALBUMS.TOP</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; text-align: center; }
            .success { background: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
            h1 { color: #28a745; }
            .btn { display: inline-block; margin: 10px; padding: 12px 24px; background: #ff5500; color: white; text-decoration: none; border-radius: 4px; }
            .btn:hover { background: #ff6a1a; }
            .btn-playlist { background: #4a90e2; }
            .btn-playlist:hover { background: #3a7bc8; }
            .btn-album { background: #28a745; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ Upload Successful!</h1>
            <p style="font-size: 1.2rem; margin: 20px 0;">${title} by ${artistName}</p>
            <a href="/song/${encodeURIComponent(baseName + ".mp3")}" class="btn">View Song</a>
            ${playlistId ? `<a href="/playlist/${playlistId}" class="btn btn-playlist">View Playlist</a>` : ''}
            ${albumId && albumId !== "" && albumId !== "__create_new__" ? `<a href="/album/${albumId}" class="btn btn-album">View Album</a>` : ''}
            <p style="margin-top: 30px;">
              <a href="/upload">Upload Another Song</a> | 
              <a href="/">Back to Home</a>
            </p>
          </div>
        </body>
        </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // CREATE PLAYLIST PAGE (GET)
    // =========================
    if (path === "/playlist/create" && req.method === "GET") {
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Create Playlist - ZEDALBUMS.TOP</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; margin-bottom: 20px; border-left: 4px solid #4a90e2; padding-left: 15px; }
          label { display: block; margin-top: 15px; font-weight: 600; color: #555; }
          input, textarea, select { width: 100%; padding: 12px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; }
          button { margin-top: 25px; padding: 14px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 600; width: 100%; }
          button:hover { background: #3a7bc8; }
          .back-link { margin-top: 20px; text-align: center; }
          .back-link a { color: #666; text-decoration: none; }
          .back-link a:hover { color: #4a90e2; }
          .note { background: #f8f9fa; padding: 12px; border-radius: 4px; margin-top: 20px; font-size: 0.9rem; color: #666; border-left: 3px solid #4a90e2; }
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
          });
        </script>
      </head>
      <body>
        <div class="container">
          <h1>Create New Playlist</h1>
          <form action="/playlist/create" method="POST" enctype="multipart/form-data">
            <label>Playlist Title</label>
            <input type="text" name="title" placeholder="e.g. Zambian Hits 2024" required>
            
            <label>Description (Optional)</label>
            <textarea name="description" rows="3" placeholder="Describe your playlist..."></textarea>
            
            <label>Curator Name (Optional)</label>
            <input type="text" name="curator" placeholder="e.g. ZEDALBUMS.TOP" value="ZEDALBUMS.TOP">
            
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
      </body>
      </html>
      `;
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // CREATE PLAYLIST HANDLER (POST)
    // =========================
    if (path === "/playlist/create" && req.method === "POST") {
      const formData = await req.formData();
      const title = formData.get("title");
      const description = formData.get("description") || "";
      const curator = formData.get("curator") || "ZEDALBUMS.TOP";
      const thumbnailFile = formData.get("thumbnail");

      if (!title) {
        return new Response("Missing playlist title", { status: 400 });
      }

      const playlistId = sanitize(title) + "_" + Date.now();
      const playlists = await getPlaylists();

      let thumbnailKey = null;
      if (thumbnailFile && thumbnailFile.size > 0) {
        const imgType = thumbnailFile.type.includes("png") ? "png" : "jpg";
        thumbnailKey = `playlists/thumbnails/${playlistId}.${imgType}`;
        await env.media.put(thumbnailKey, thumbnailFile.stream());
      }

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

      await savePlaylists(playlists);
      
      homepageCache = null;
      cacheTimestamp = 0;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Playlist Created - ZEDALBUMS.TOP</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 50px; background: #f0f0f0; text-align: center; }
            .success { background: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto; }
            h1 { color: #4a90e2; }
            .btn { display: inline-block; margin: 10px; padding: 12px 24px; background: #4a90e2; color: white; text-decoration: none; border-radius: 4px; }
            .btn:hover { background: #3a7bc8; }
            .btn-upload { background: #ff5500; }
            .btn-upload:hover { background: #ff6a1a; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ Playlist Created!</h1>
            <p style="font-size: 1.2rem; margin: 20px 0;">"${title}"</p>
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
        headers: { ...CORS_HEADERS, "Content-Type": "text/html" } 
      });
    }

    // =========================
    // API: GET ALL PLAYLISTS (for dropdowns)
    // =========================
    if (path === "/api/playlists/list" && req.method === "GET") {
      const playlists = await getPlaylists();
      const playlistArray = Object.values(playlists).map(p => ({
        id: p.id,
        title: p.title,
        songs: p.songs || [],
        created: p.created,
        songCount: (p.songs || []).length
      }));
      
      return new Response(JSON.stringify(playlistArray), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
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
        <title>Create Album - ZEDALBUMS.TOP</title>
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
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const urlParams = new URLSearchParams(window.location.search);
            const fromUpload = urlParams.get('from') === 'upload';
            
            const backLink = document.querySelector('.back-link a');
            if (fromUpload && backLink) {
              backLink.href = '/upload';
              backLink.innerHTML = '← Back to Upload';
            }
          });
        </script>
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
        <!DOCTYPE html>
        <html>
        <head>
          <title>Album Created - ZEDALBUMS.TOP</title>
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
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
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
        <title>Create Artist - ZEDALBUMS.TOP</title>
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
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // CREATE ARTIST HANDLER (POST)
    // =========================
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
      const artists = await getArtists();

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
        await saveArtists(artists);
      }

      homepageCache = null;
      cacheTimestamp = 0;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Artist Created - ZEDALBUMS.TOP</title>
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
      return new Response(html, { headers: { ...CORS_HEADERS, "Content-Type": "text/html" } });
    }

    // =========================
    // ALBUMS PAGE - DYNAMIC FROM TEMPLATE
    // =========================
    if (path === "/albums") {
      const templateObj = await env.media.get("albums.html");
      if (!templateObj) {
        return new Response("albums.html template not found in R2", { status: 500 });
      }
      let html = await templateObj.text();

      const albums = await getAlbums();
      const artists = await getArtists();
      
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

      const genreCounts = {};
      Object.values(albums).forEach(album => {
        const title = album.title.toLowerCase();
        let genre = "Other";
        if (title.includes('pop')) genre = "Zam Pop";
        else if (title.includes('hip hop') || title.includes('rap')) genre = "Zam Hip Hop";
        else if (title.includes('gospel')) genre = "Gospel";
        else if (title.includes('r&b') || title.includes('rnb')) genre = "Zam R&B";
        else if (title.includes('traditional') || title.includes('kalimba')) genre = "Traditional";
        else genre = "Zam Music";
        
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
      
      const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      const genresHtml = topGenres.map(([genre, count], index) => {
        let badge = "Popular";
        let dateText = "Most played";
        
        if (index === 0) {
          badge = "Popular";
          dateText = "Most played";
        } else if (index === 1) {
          badge = "Urban";
          dateText = "Trending";
        } else {
          badge = "Spiritual";
          dateText = "Rising";
        }
        
        return `
          <div class="album-item">
            <div class="album-thumbnail placeholder"></div>
            <div class="album-info">
              <span class="album-title">${genre}</span>
              <div class="album-meta">
                <span class="album-artist">${count} Albums</span>
                <span class="album-genre">${badge}</span>
              </div>
              <span class="album-date">${dateText}</span>
            </div>
          </div>
        `;
      }).join('');

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
        /<!-- GENRES_START -->[\s\S]*?<!-- GENRES_END -->/g,
        `<!-- GENRES_START -->${genresHtml}<!-- GENRES_END -->`
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

    // =========================
    // ALBUM DETAIL PAGE - DYNAMIC FROM TEMPLATE (WITH STATS)
    // =========================
    if (path.startsWith("/album/") && !path.startsWith("/album/create")) {
      const albumId = decodeURIComponent(path.replace("/album/", ""));
      
      const albums = await getAlbums();
      const album = albums[albumId];
      const artists = await getArtists();
      
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
      const totalMinutes = trackCount * 4;
      const totalHours = Math.floor(totalMinutes / 60);
      const totalMins = totalMinutes % 60;
      const totalDuration = totalHours > 0 ? `${totalHours} hr ${totalMins} min` : `${totalMins} min`;

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
        const meta = await getMetadata(songKey);
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
        
        const duration = `${Math.floor(Math.random() * 2) + 3}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
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
                <span class="track-duration">${duration}</span>
                <span class="album-genre">Track ${trackNumber}</span>
              </div>
              <span class="album-date">Track ${trackNumber}</span>
            </div>
          </div>
        `;
      })).then(results => results.join(''));

      let paginationHtml = '';
      if (trackCount > 12) {
        const totalPages = Math.ceil(trackCount / 12);
        paginationHtml = `<div class="pagination-container"><div class="pagination">
          <a href="#" class="pagination-item pagination-prev disabled"><i class="fas fa-chevron-left"></i> Prev</a>
          <a href="#" class="pagination-item active">1</a>
          <a href="#" class="pagination-item">2</a>
          <span class="pagination-ellipsis">...</span>
          <a href="#" class="pagination-item">${totalPages}</a>
          <a href="#" class="pagination-item pagination-next">Next <i class="fas fa-chevron-right"></i></a>
        </div></div>`;
      }

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

      const albumInfoHtml = `
        <div style="padding: 15px; font-size: 0.85rem; color: #555;">
          <p><strong>Label:</strong> ${album.label || 'Independent'}</p>
          <p><strong>Producer:</strong> ${album.producer || primaryArtist}</p>
          <p><strong>Format:</strong> Digital, Streaming</p>
          <p><strong>Total Tracks:</strong> ${trackCount}</p>
          <p><strong>Total Plays:</strong> ${albumStats.plays.toLocaleString()}</p>
          <p><strong>Total Downloads:</strong> ${albumStats.downloads.toLocaleString()}</p>
          <p><strong>℗ ${new Date(album.created).getFullYear()}</strong> ${album.copyright || 'ZEDALBUMS.TOP'}</p>
          ${album.awards ? `
            <div style="margin-top: 10px; padding: 8px; background: #f8f9fa; border-radius: 3px; font-size: 0.8rem;">
              <i class="fas fa-award" style="color: #f39c12;"></i>
              <span style="margin-left: 5px;">${album.awards}</span>
            </div>
          ` : ''}
        </div>
      `;

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

      html = html.replace(/<title>.*?<\/title>/, `<title>${primaryArtist} - ${album.title} - ZEDALBUMS.TOP</title>`);
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
      html = html.replace(/<!-- PAGINATION_START -->[\s\S]*?<!-- PAGINATION_END -->/g, 
        `<!-- PAGINATION_START -->${paginationHtml}<!-- PAGINATION_END -->`
      );
      html = html.replace(/<!-- MORE_BY_ARTIST_TITLE_START -->[\s\S]*?<!-- MORE_BY_ARTIST_TITLE_END -->/g, 
        `<!-- MORE_BY_ARTIST_TITLE_START --><h2 class="section-title">More by ${primaryArtist}</h2><!-- MORE_BY_ARTIST_TITLE_END -->`
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
      if (primaryArtistId) {
        html = html.replace(/<a href="\/artists\/yo-maps" class="view-all">View All ➔<\/a>/, 
          `<a href="/artist/${primaryArtistId}" class="view-all">View All ➔</a>`
        );
      }
      html = html.replace(/<a href="#" class="nav-item active">Albums<\/a>/, '<a href="/albums" class="nav-item active">Albums</a>');
      html = html.replace(/<a href="#" class="nav-item">Home<\/a>/, '<a href="/" class="nav-item">Home</a>');
      html = html.replace(/<a href="#" class="nav-item">Artists<\/a>/, '<a href="/artists" class="nav-item">Artists</a>');

      return new Response(html, { 
        headers: { 
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300"
        } 
      });
    }

    // =========================
    // SONG DETAIL PAGE - DYNAMIC FROM TEMPLATE (UPDATED WITH PLAYLIST CONTEXT AND STATS)
    // =========================
    if (path.startsWith("/song/")) {
      const fileName = decodeURIComponent(path.replace("/song/", ""));
      const baseName = fileName.replace(".mp3", "");
      
      const audioObj = await env.media.get(`songs/${fileName}`);
      if (!audioObj) {
        return new Response("Song not found", { status: 404 });
      }

      const stats = await getSongStats(baseName, env);

      const playlistId = url.searchParams.get("playlist");
      let contextPlaylist = null;
      if (playlistId) {
        const playlists = await getPlaylists();
        contextPlaylist = playlists[playlistId];
      }

      const templateObj = await env.media.get("song.html");
      if (!templateObj) {
        return new Response("song.html template not found in R2", { status: 500 });
      }
      let html = await templateObj.text();

      const meta = await getMetadata(baseName);
      let songTitle, primaryArtistId, featuredArtists = [], description = "";
      if (meta) {
        songTitle = meta.title;
        primaryArtistId = meta.primaryArtist;
        featuredArtists = meta.featuredArtists || [];
        description = meta.description || "";
      } else {
        const [artistId, ...titleParts] = baseName.split("_");
        songTitle = titleParts.join(" ");
        primaryArtistId = artistId;
      }

      const artists = await getArtists();
      const albums = await getAlbums();

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

      const duration = `${Math.floor(Math.random() * 2) + 3}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
      const durationSeconds = parseInt(duration.split(':')[0]) * 60 + parseInt(duration.split(':')[1]);

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
              const m = await getMetadata(songKey);
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
              const sduration = `${Math.floor(Math.random() * 2) + 3}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
              const trackNum = (index + 1).toString().padStart(2, '0');
              return `
                <div class="album-item" onclick="window.location='/song/${encodeURIComponent(songKey + ".mp3")}?playlist=${playlistId}'">
                  <div class="album-thumbnail ${shasImage ? '' : 'placeholder'}">
                    ${shasImage ? `<img src="${sthumbUrl}" alt="${stitle}" loading="lazy">` : ''}
                  </div>
                  <div class="album-info">
                    <span class="album-title">${sartistDisplay} - ${stitle}</span>
                    <div class="album-meta">
                      <span class="album-artist">${sartistDisplay}</span>
                      <span class="song-duration">${sduration}</span>
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
          const m = await getMetadata(songKey);
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
          const sduration = `${Math.floor(Math.random() * 2) + 3}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
          const trackNum = (index + 1).toString().padStart(2, '0');
          const isCurrentSong = songKey === baseName;
          const activeClass = isCurrentSong ? ' style="background: rgba(255, 85, 0, 0.05); border-left: 4px solid #ff5500;"' : '';
          return `
            <div class="album-item" onclick="window.location='/song/${encodeURIComponent(songKey + ".mp3")}'"${activeClass}>
              <div class="album-thumbnail ${shasImage ? '' : 'placeholder'}">
                ${shasImage ? `<img src="${sthumbUrl}" alt="${stitle}" loading="lazy">` : ''}
              </div>
              <div class="album-info">
                <span class="album-title">${sartistDisplay} - ${stitle}</span>
                <div class="album-meta">
                  <span class="album-artist">${sartistDisplay}</span>
                  <span class="song-duration">${sduration}</span>
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
        const m = await getMetadata(fBaseName);
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
        const fDuration = `${Math.floor(Math.random() * 2) + 3}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
        return `
          <div class="album-item" onclick="window.location='/song/${encodeURIComponent(fName)}'">
            <div class="album-thumbnail ${fHasImage ? '' : 'placeholder'}">
              ${fHasImage ? `<img src="${fThumbUrl}" alt="${fTitle}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${fArtistDisplay} - ${fTitle}</span>
              <div class="album-meta">
                <span class="album-artist">${fArtistDisplay}</span>
                <span class="song-duration">${fDuration}</span>
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
            <p><strong>Curator:</strong> ${contextPlaylist.curator || 'ZEDALBUMS.TOP'}</p>
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
            <p><strong>Duration:</strong> ${duration}</p>
            <p><strong><i class="fas fa-play"></i> Plays:</strong> ${stats.plays.toLocaleString()}</p>
            <p><strong><i class="fas fa-download"></i> Downloads:</strong> ${stats.downloads.toLocaleString()}</p>
            <div class="info-note">
              <i class="fas fa-info-circle" style="color: #ff5500;"></i>
              <span>No registration required for download</span>
            </div>
          </div>
        `;
      }

      html = html.replace(/<title>.*?<\/title>/, `<title>${artistDisplay} - ${songTitle} - ZEDALBUMS.TOP</title>`);
      
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
      html = html.replace(/<div class="song-stats"><i class="fas fa-clock"><\/i> Duration: [^<]+<\/div>/, `<div class="song-stats"><i class="fas fa-clock"></i> Duration: ${duration}</div>`);
      html = html.replace(/<div class="song-stats"><i class="fas fa-calendar"><\/i> Released: [^<]+<\/div>/, `<div class="song-stats"><i class="fas fa-calendar"></i> Released: ${formattedDate}</div>`);
      html = html.replace('<!-- SONG_PLAYS -->', stats.plays.toLocaleString());
      html = html.replace('<!-- SONG_DOWNLOADS -->', stats.downloads.toLocaleString());
      
      html = html.replace(/<p class="playlist-description">[\s\S]*?<\/p>/, `<p class="playlist-description">${description || `"${songTitle}" is a song by ${artistDisplay}.`}</p>`);
      html = html.replace(/<span id="compactTotalTime">[^<]+<\/span>/, `<span id="compactTotalTime">${duration}</span>`);
      html = html.replace(/<a href="\/download\/[^"]*" class="download-mini-btn"/, `<a href="/download/${encodeURIComponent(fileName)}" class="download-mini-btn"`);
      html = html.replace(/\/songs\/[^"]*\.mp3/g, `/songs/${encodeURIComponent(fileName)}`);

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

    // =========================
    // ARTISTS PAGE - DYNAMIC FROM TEMPLATE
    // =========================
    if (path === "/artists") {
      const templateObj = await env.media.get("artists.html");
      if (!templateObj) {
        return new Response("artists.html template not found in R2", { status: 500 });
      }
      let html = await templateObj.text();

      const artists = await getArtists();
      const albums = await getAlbums();
      
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
        paginationHtml = `<div class="pagination-container" id="paginationContainer"><div class="pagination">`;
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

      const genreCounts = {};
      Object.values(artists).forEach(artist => {
        let genre = artist.genre || 'Other';
        if (!artist.genre && artist.albums && artist.albums.length > 0) {
          genre = 'Zam Music';
        }
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });

      if (Object.keys(genreCounts).length === 0) {
        genreCounts['Zam Hip Hop'] = 12;
        genreCounts['Zam Pop'] = 8;
        genreCounts['Zam R&B'] = 5;
      }

      const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const genresHtml = topGenres.map(([genre, count], index) => {
        let badge = index === 0 ? 'Most Artists' : index === 1 ? 'Popular' : 'Growing';
        return `
          <div class="album-item">
            <div class="album-thumbnail placeholder"></div>
            <div class="album-info">
              <span class="album-title">${genre}</span>
              <div class="album-meta">
                <span class="album-artist">${count} Artists</span>
                <span class="album-genre">${badge}</span>
              </div>
              <span class="album-date">${index === 0 ? 'Top Genre' : index === 1 ? 'Trending' : 'Rising'}</span>
            </div>
          </div>
        `;
      }).join('');

      const totalSongs = (await env.media.list({ prefix: "songs/" })).objects?.length || 0;
      const totalArtistsCount = Object.keys(artists).length;
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const newArtistsThisMonth = Object.values(artists).filter(a => a.created > thirtyDaysAgo).length;

      const statsHtml = `
        <div style="padding: 15px; font-size: 0.9rem; color: #555;">
          <p><strong>Total Artists:</strong> ${totalArtistsCount}+</p>
          <p><strong>Total Songs:</strong> ${totalSongs}+</p>
          <p><strong>Top Genre:</strong> ${topGenres[0]?.[0] || 'Zam Hip Hop'}</p>
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
        /<!-- TOP_GENRES_START -->[\s\S]*?<!-- TOP_GENRES_END -->/g,
        `<!-- TOP_GENRES_START -->${genresHtml}<!-- TOP_GENRES_END -->`
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

    // =========================
    // ARTIST DETAIL PAGE - DYNAMIC FROM TEMPLATE (WITH REAL STATS)
    // =========================
    if (path.startsWith("/artist/") && !path.startsWith("/artist/create")) {
      const artistId = decodeURIComponent(path.replace("/artist/", ""));
      const artists = await getArtists();
      const artist = artists[artistId];
      if (!artist) return new Response("Artist not found", { status: 404 });

      const albums = await getAlbums();
      const playlists = await getPlaylists();
      const { albums: artistAlbums, singles, totalSongs, totalSingles } =
        await getArtistAlbumsAndSingles(artistId);

      const allSongKeys = artist.songs || [];
      const artistStats = await getAggregatedStats(allSongKeys, env);

      const artistPlaylists = [];

      for (const [playlistId, playlist] of Object.entries(playlists)) {
        if (!playlist.songs) continue;
        
        for (const songKey of playlist.songs) {
          const meta = await getMetadata(songKey);
          if (meta) {
            if (meta.primaryArtist === artistId || meta.featuredArtists.includes(artistId)) {
              const artistSongCount = playlist.songs.filter(s => {
                return s.startsWith(artistId + "_");
              }).length;
              
              artistPlaylists.push({
                id: playlistId,
                title: playlist.title,
                thumbnail: playlist.thumbnail,
                songCount: playlist.songs.length,
                artistSongCount: artistSongCount,
                curator: playlist.curator || 'ZEDALBUMS.TOP',
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
                id: playlistId,
                title: playlist.title,
                thumbnail: playlist.thumbnail,
                songCount: playlist.songs.length,
                artistSongCount: artistSongCount,
                curator: playlist.curator || 'ZEDALBUMS.TOP',
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
      const songCount = totalSongs || artist.songs?.length || 0;
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

      const allSongs = [];

      for (const alb of artistAlbums) {
        for (const songKey of alb.songs) {
          const [sid] = songKey.split("_");
          if (sid !== artistId) continue;
          const meta = await getMetadata(songKey);
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
        const meta = await getMetadata(songKey);
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
        const meta = await getMetadata(songKey);
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
          const duration = `${3 + Math.floor(Math.random() * 2)}:${Math.floor(
            Math.random() * 60
          )
            .toString()
            .padStart(2, "0")}`;
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
                  <span class="song-duration">${duration}</span>
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
        const meta = await getMetadata(songKey);
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
        .replace(/<title>.*?<\/title>/, `<title>${artistName} - ZEDALBUMS.TOP</title>`)
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

    // =========================
    // CHARTS PAGES - DYNAMIC FROM TEMPLATE
    // =========================
    if (path.startsWith("/charts")) {
      const subPath = path.replace("/charts", "") || "/";
      
      let templateFile = "charts/index.html";
      let title = "Charts";
      let dataFunction = null;
      
      if (subPath === "/" || subPath === "") {
        templateFile = "charts/index.html";
        title = "Charts Overview";
        dataFunction = async () => ({
          topAlbums: await (await getTopAlbums(env, 5)),
          topSongs: await (await getTopSongs(env, 5)),
          topArtists: await (await getTopArtists(env, 5)),
          topPlaylists: await (await getTopPlaylists(env, 3)),
          newReleases: await getNewReleases(env, 3)
        });
      } else if (subPath === "/albums") {
        templateFile = "charts/albums.html";
        title = "Top Albums Chart";
        dataFunction = async () => ({ items: await getTopAlbums(env, 50) });
      } else if (subPath === "/songs") {
        templateFile = "charts/songs.html";
        title = "Top Songs Chart";
        dataFunction = async () => ({ items: await getTopSongs(env, 100) });
      } else if (subPath === "/artists") {
        templateFile = "charts/artists.html";
        title = "Top Artists Chart";
        dataFunction = async () => ({ items: await getTopArtists(env, 50) });
      } else if (subPath === "/playlists") {
        templateFile = "charts/playlists.html";
        title = "Top Playlists Chart";
        dataFunction = async () => ({ items: await getTopPlaylists(env, 50) });
      } else if (subPath === "/new-releases") {
        templateFile = "charts/new-releases.html";
        title = "New Releases";
        dataFunction = async () => ({ items: await getNewReleases(env, 50) });
      } else {
        return new Response("Chart page not found", { status: 404 });
      }

      const templateObj = await env.media.get(templateFile);
      if (!templateObj) {
        return new Response(`Template ${templateFile} not found in R2`, { status: 500 });
      }
      let html = await templateObj.text();

      const chartData = await dataFunction();

      if (subPath === "/" || subPath === "") {
        html = await renderChartsOverview(html, chartData, env);
      } else if (subPath === "/albums") {
        html = await renderAlbumsChart(html, chartData.items, env);
      } else if (subPath === "/songs") {
        html = await renderSongsChart(html, chartData.items, env);
      } else if (subPath === "/artists") {
        html = await renderArtistsChart(html, chartData.items, env);
      } else if (subPath === "/playlists") {
        html = await renderPlaylistsChart(html, chartData.items, env);
      } else if (subPath === "/new-releases") {
        html = await renderNewReleases(html, chartData.items, env);
      }

      html = html.replace(/<title>.*?<\/title>/, `<title>${title} - ZEDALBUMS.TOP</title>`);

      return new Response(html, {
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300"
        }
      });
    }

    // =========================
    // HOMEPAGE - DYNAMIC WITH LATEST SONGS AND TRACK COUNTS
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
      const playlists = await getPlaylists();
      const albumList = Object.values(albums).sort((a, b) => b.created - a.created);
      const artistList = Object.values(artists).sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0));

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

      const songsList = await env.media.list({ prefix: "songs/", limit: 50 });
      const songFiles = songsList.objects || [];
      songFiles.sort((a, b) => b.uploaded - a.uploaded);
      const latestSongs = songFiles.slice(0, 3);
      
      const latestSongsHtml = await Promise.all(latestSongs.map(async f => {
        const fileName = f.key.split("/")[1];
        const baseName = fileName.replace(".mp3", "");
        const meta = await getMetadata(baseName);
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
    // PLAYLISTS LIST PAGE - DYNAMIC FROM TEMPLATE (WITH ARTIST FILTER)
    // =========================
    if (path === "/playlists") {
      const templateObj = await env.media.get("playlists.html");
      if (!templateObj) {
        return new Response("playlists.html template not found in R2", { status: 500 });
      }
      let html = await templateObj.text();

      const playlists = await getPlaylists();
      const albums = await getAlbums();
      const artists = await getArtists();

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
              const meta = await getMetadata(songKey);
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
          `<title>Playlists featuring ${filterArtistName} - ZEDALBUMS.TOP</title>`
        );
      }

      return new Response(html, {
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300"
        }
      });
    }

    // =========================
    // PLAYLIST DETAIL PAGE - DYNAMIC FROM TEMPLATE (WITH STATS)
    // =========================
    if (path.startsWith("/playlist/") && !path.startsWith("/playlist/create")) {
      const playlistId = decodeURIComponent(path.replace("/playlist/", ""));

      const playlists = await getPlaylists();
      const playlist = playlists[playlistId];
      if (!playlist) return new Response("Playlist not found", { status: 404 });

      const playlistStats = await getAggregatedStats(playlist.songs || [], env);

      const templateObj = await env.media.get("playlist.html");
      if (!templateObj) {
        return new Response("playlist.html template not found in R2", { status: 500 });
      }
      let html = await templateObj.text();

      const albums = await getAlbums();
      const artists = await getArtists();

      const songCount = playlist.songs?.length || 0;
      const createdDate = new Date(playlist.created);
      const formattedDate = createdDate.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      let totalMinutes = 0;
      if (playlist.songs) {
        for (const songKey of playlist.songs) {
          totalMinutes += Math.floor(Math.random() * 2) + 3;
        }
      }
      const totalHours = Math.floor(totalMinutes / 60);
      const totalMins = totalMinutes % 60;
      const totalDuration = totalHours > 0 ? `${totalHours} hr ${totalMins} min` : `${totalMins} min`;

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
        const meta = await getMetadata(songKey);
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

        const duration = `${Math.floor(Math.random() * 2) + 3}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
        const trackNumber = (index + 1).toString().padStart(2, '0');

        return `
          <div class="album-item" onclick="window.location='/song/${encodeURIComponent(songKey + ".mp3")}?playlist=${playlistId}'">
            <div class="album-thumbnail ${hasImage ? '' : 'song-thumbnail placeholder'}">
              ${hasImage ? `<img src="${thumbUrl}" alt="${title}" loading="lazy">` : ''}
            </div>
            <div class="album-info">
              <span class="album-title">${artistDisplay} - ${title}</span>
              <div class="album-meta">
                <span class="album-artist">${artistDisplay}</span>
                <span class="song-duration">${duration}</span>
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
        const meta = await getMetadata(firstSongKey);
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
          <p><strong>Curator:</strong> ${playlist.curator || 'ZEDALBUMS.TOP'}</p>
          ${playlist.description ? `<p><strong>Description:</strong> ${playlist.description}</p>` : ''}
          <div style="margin-top: 10px; padding: 8px; background: #f8f9fa; border-radius: 3px;">
            <i class="fas fa-info-circle" style="color: #00b894;"></i>
            <span style="margin-left: 5px;">Updated regularly</span>
          </div>
        </div>
      `;

      html = html.replace(/<title>.*?<\/title>/, `<title>${playlist.title} - Playlist - ZEDALBUMS.TOP</title>`);
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

    // =========================
    // DOWNLOAD PAGE (updated with counter)
    // =========================
    if (path.startsWith("/download/")) {
      const fileName = decodeURIComponent(path.replace("/download/",""));
      const songKey = fileName.replace(".mp3", "");
      
      ctx.waitUntil(incrementDownload(songKey, env));

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Downloading...</title>
          <meta http-equiv="refresh" content="0;url=/songs/${encodeURIComponent(fileName)}">
        </head>
        <body>
          <p>Download started. <a href="/songs/${encodeURIComponent(fileName)}">Click here</a> if download doesn't start automatically.</p>
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
    // API: INCREMENT PLAY COUNT
    // =========================
    if (path.startsWith("/api/play/") && req.method === "POST") {
      const songKey = decodeURIComponent(path.replace("/api/play/", ""));
      ctx.waitUntil(incrementPlay(songKey, env));
      return new Response("OK", { status: 200, headers: CORS_HEADERS });
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

    if (path.startsWith("/playlists/thumbnails/")) {
      const fileName = decodeURIComponent(path.slice(1));
      const obj = await env.media.get(fileName);
      if (!obj) return new Response("Playlist thumbnail not found", { status: 404 });

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

    if (path === "/playlist") {
      return Response.redirect("/playlists", 301);
    }

    if (path === "/new-design") {
      return Response.redirect("/", 301);
    }

    // =========================
    // 404 NOT FOUND
    // =========================
    return new Response("Not found", { status: 404 });
  }
};