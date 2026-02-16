// ==================== STORAGE HELPERS ====================
// Handles all R2 storage operations for albums, artists, playlists, and metadata

// Cache variables
let albumsCache = null;
let artistsCache = null;
let playlistsCache = null;
let metadataCache = {};
let dataCacheTimestamp = 0;
const DATA_CACHE_DURATION = 60000;

// === ALBUMS FUNCTIONS ===
export async function getAlbums(env) {
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
}

export async function saveAlbums(env, albums) {
  await env.media.put("albums/index.json", JSON.stringify(albums));
  albumsCache = albums;
  dataCacheTimestamp = Date.now();
}

export async function addSongToAlbum(env, albumId, songKey) {
  const albums = await getAlbums(env);
  if (albums[albumId]) {
    if (!albums[albumId].songs.includes(songKey)) {
      albums[albumId].songs.push(songKey);
      await saveAlbums(env, albums);
    }
  }
}

export async function getAlbumSongs(env, albumId) {
  const albums = await getAlbums(env);
  return albums[albumId] ? albums[albumId].songs || [] : [];
}

export async function addArtistToAlbum(env, artistId, albumId) {
  const albums = await getAlbums(env);
  const album = albums[albumId];
  if (album) {
    if (!album.artists) album.artists = [];
    if (!album.artists.includes(artistId)) {
      album.artists.push(artistId);
      await saveAlbums(env, albums);
    }
  }
}

export async function removeArtistFromAlbum(env, artistId, albumId) {
  const albums = await getAlbums(env);
  const album = albums[albumId];
  if (album && album.artists) {
    const index = album.artists.indexOf(artistId);
    if (index !== -1) {
      album.artists.splice(index, 1);
      await saveAlbums(env, albums);
    }
  }
}

// === ARTISTS FUNCTIONS ===
export async function getArtists(env) {
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
}

export async function saveArtists(env, artists) {
  await env.media.put("artists/index.json", JSON.stringify(artists));
  artistsCache = artists;
  dataCacheTimestamp = Date.now();
}

export async function addSongToArtist(env, artistId, songKey) {
  const artists = await getArtists(env);
  if (artists[artistId]) {
    if (!artists[artistId].songs.includes(songKey)) {
      artists[artistId].songs.push(songKey);
      await saveArtists(env, artists);
    }
  }
}

export async function getArtistSongs(env, artistId) {
  const artists = await getArtists(env);
  return artists[artistId] ? artists[artistId].songs || [] : [];
}

export async function addAlbumToArtist(env, artistId, albumId) {
  const artists = await getArtists(env);
  if (artists[artistId]) {
    if (!artists[artistId].albums) {
      artists[artistId].albums = [];
    }
    if (!artists[artistId].albums.includes(albumId)) {
      artists[artistId].albums.push(albumId);
      await saveArtists(env, artists);
    }
  }
}

export async function removeAlbumFromArtist(env, artistId, albumId) {
  const artists = await getArtists(env);
  if (artists[artistId] && artists[artistId].albums) {
    const index = artists[artistId].albums.indexOf(albumId);
    if (index !== -1) {
      artists[artistId].albums.splice(index, 1);
      await saveArtists(env, artists);
    }
  }
}

export async function getArtistAlbums(env, artistId) {
  const artists = await getArtists(env);
  return artists[artistId] ? artists[artistId].albums || [] : [];
}

export async function getArtistAlbumsAndSingles(env, artistId) {
  const artists = await getArtists(env);
  const albums = await getAlbums(env);
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
}

// === PLAYLIST FUNCTIONS ===
export async function getPlaylists(env) {
  const now = Date.now();
  if (playlistsCache && (now - dataCacheTimestamp < DATA_CACHE_DURATION)) {
    return playlistsCache;
  }
  try {
    const playlistsObj = await env.media.get("playlists/index.json");
    if (!playlistsObj) {
      playlistsCache = {};
      dataCacheTimestamp = now;
      return {};
    }
    const text = await playlistsObj.text();
    playlistsCache = JSON.parse(text || "{}");
    dataCacheTimestamp = now;
    return playlistsCache;
  } catch (e) {
    playlistsCache = {};
    dataCacheTimestamp = now;
    return {};
  }
}

export async function savePlaylists(env, playlists) {
  await env.media.put("playlists/index.json", JSON.stringify(playlists));
  playlistsCache = playlists;
  dataCacheTimestamp = Date.now();
}

export async function addSongToPlaylist(env, playlistId, songKey) {
  const playlists = await getPlaylists(env);
  if (playlists[playlistId]) {
    if (!playlists[playlistId].songs) playlists[playlistId].songs = [];
    if (!playlists[playlistId].songs.includes(songKey)) {
      playlists[playlistId].songs.push(songKey);
      playlists[playlistId].updated = Date.now();
      await savePlaylists(env, playlists);
    }
  }
}

export async function removeSongFromPlaylist(env, playlistId, songKey) {
  const playlists = await getPlaylists(env);
  if (playlists[playlistId] && playlists[playlistId].songs) {
    const index = playlists[playlistId].songs.indexOf(songKey);
    if (index !== -1) {
      playlists[playlistId].songs.splice(index, 1);
      playlists[playlistId].updated = Date.now();
      await savePlaylists(env, playlists);
    }
  }
}

export async function getPlaylistSongs(env, playlistId) {
  const playlists = await getPlaylists(env);
  return playlists[playlistId] ? playlists[playlistId].songs || [] : [];
}

// === METADATA FUNCTIONS ===
export async function getMetadata(env, songKey) {
  const now = Date.now();
  if (metadataCache[songKey] && (now - dataCacheTimestamp < DATA_CACHE_DURATION)) {
    return metadataCache[songKey];
  }
  try {
    const metaObj = await env.media.get(`metadata/${songKey}.json`);
    if (!metaObj) {
      metadataCache[songKey] = null;
      dataCacheTimestamp = now;
      return null;
    }
    const text = await metaObj.text();
    const metadata = JSON.parse(text);
    metadataCache[songKey] = metadata;
    dataCacheTimestamp = now;
    return metadata;
  } catch (e) {
    metadataCache[songKey] = null;
    dataCacheTimestamp = now;
    return null;
  }
}

export async function saveMetadata(env, songKey, metadata) {
  await env.media.put(`metadata/${songKey}.json`, JSON.stringify(metadata));
  metadataCache[songKey] = metadata;
  dataCacheTimestamp = Date.now();
}