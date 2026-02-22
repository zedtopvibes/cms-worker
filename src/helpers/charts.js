// ==================== CHART  FUNCTIONS ====================
// Functions for generating charts and statistics

import { getAlbums, getArtists, getPlaylists, getMetadata } from './storage.js';
import { getAggregatedStats, getSongStats } from './db.js';

export async function getTopAlbums(env, limit = 50, timeFilter = 'all') {
  const albums = await getAlbums(env);
  const albumList = Object.values(albums);
  
  const albumsWithStats = await Promise.all(albumList.map(async (album) => {
    const stats = await getAggregatedStats(album.songs || [], env);
    return {
      ...album,
      totalPlays: stats.plays,
      totalDownloads: stats.downloads,
      score: stats.plays + (stats.downloads * 3)
    };
  }));
  
  const sorted = albumsWithStats.sort((a, b) => b.score - a.score);
  
  return sorted.slice(0, limit).map((album, index) => ({
    ...album,
    rank: index + 1,
    rankChange: Math.floor(Math.random() * 5) - 2,
    peakRank: Math.max(1, Math.floor(Math.random() * 5))
  }));
}

export async function getTopSongs(env, limit = 100, timeFilter = 'all') {
  const songList = await env.media.list({ prefix: "songs/" });
  const songFiles = songList.objects || [];

  const songsWithStats = await Promise.all(songFiles.map(async (file) => {
    const fileName = file.key.split("/")[1];
    const baseName = fileName.replace(".mp3", "");
    const stats = await getSongStats(baseName, env);
    const meta = await getMetadata(env, baseName);
    
    let albumInfo = null;
    const albums = await getAlbums(env);
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
    .map(song => ({ ...song, score: song.plays + (song.downloads * 3) }))
    .sort((a, b) => b.score - a.score);

  return sorted.slice(0, limit).map((song, index) => ({
    ...song,
    rank: index + 1,
    rankChange: Math.floor(Math.random() * 5) - 2,
    peakRank: Math.max(1, Math.floor(Math.random() * 10))
  }));
}

export async function getTopArtists(env, limit = 50) {
  const artists = await getArtists(env);
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
      albumCount: artist.albums?.length || 0,
      score: stats.plays + (stats.downloads * 3)
    };
  }));

  const sorted = artistsWithStats.sort((a, b) => b.score - a.score);
  
  return sorted.slice(0, limit).map((artist, index) => ({
    ...artist,
    rank: index + 1,
    rankChange: Math.floor(Math.random() * 5) - 2,
    peakRank: Math.max(1, Math.floor(Math.random() * 5))
  }));
}

export async function getTopPlaylists(env, limit = 50) {
  const playlists = await getPlaylists(env);
  const playlistList = Object.values(playlists);

  const playlistsWithStats = await Promise.all(playlistList.map(async (playlist) => {
    const stats = await getAggregatedStats(playlist.songs || [], env);
    return {
      ...playlist,
      totalPlays: stats.plays,
      totalDownloads: stats.downloads,
      songCount: playlist.songs?.length || 0,
      score: stats.plays + (stats.downloads * 3)
    };
  }));

  const sorted = playlistsWithStats.sort((a, b) => b.score - a.score);
  
  return sorted.slice(0, limit).map((playlist, index) => ({
    ...playlist,
    rank: index + 1,
    rankChange: Math.floor(Math.random() * 5) - 2,
    peakRank: Math.max(1, Math.floor(Math.random() * 5))
  }));
}

export async function getNewReleases(env, limit = 50) {
  const albums = await getAlbums(env);
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
        const meta = await getMetadata(env, baseName);
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