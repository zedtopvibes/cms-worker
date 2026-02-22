// ==================== PREVIEW HELPER ====================
import { getMetadata } from './storage.js';
import { getArtists, getAlbums, getPlaylists } from './storage.js';
import { getSongStats } from './db.js';
import { getPageViews } from './pageViews.js';
import { formatDuration, formatNumber } from './formatting.js';

export async function getPreviewData(env, type, id) {
  try {
    switch (type) {
      case 'song':
        return await getSongPreview(env, id);
      case 'album':
        return await getAlbumPreview(env, id);
      case 'artist':
        return await getArtistPreview(env, id);
      case 'playlist':
        return await getPlaylistPreview(env, id);
      default:
        return null;
    }
  } catch (error) {
    console.error('Preview error:', error);
    return null;
  }
}

async function getSongPreview(env, id) {
  const meta = await getMetadata(env, id);
  const stats = await getSongStats(id, env);
  const artists = await getArtists(env);
  const views = await getPageViews(env, 'song', id);
  
  // Get thumbnail URL
  let thumbUrl = null;
  try {
    const jpgObj = await env.media.get(`images/${id}.jpg`);
    if (jpgObj) thumbUrl = `/images/${encodeURIComponent(id)}.jpg`;
    else {
      const pngObj = await env.media.get(`images/${id}.png`);
      if (pngObj) thumbUrl = `/images/${encodeURIComponent(id)}.png`;
    }
  } catch (e) {}
  
  // Get artist name
  let artistName = id.split('_')[0];
  if (meta?.primaryArtist) {
    artistName = artists[meta.primaryArtist]?.name || meta.primaryArtist;
  }
  
  // Get featured artists
  let featuredText = '';
  if (meta?.featuredArtists?.length) {
    const featured = meta.featuredArtists.map(fid => artists[fid]?.name || fid).join(', ');
    featuredText = `feat. ${featured}`;
  }
  
  return {
    type: 'song',
    id,
    title: meta?.title || id.split('_').slice(1).join(' ') || id,
    artist: artistName,
    featured: featuredText,
    thumbnail: thumbUrl,
    duration: formatDuration(meta?.duration || 0),
    plays: formatNumber(stats.plays),
    downloads: formatNumber(stats.downloads),
    views: formatNumber(views),
    description: meta?.description || 'No description available',
    url: `/song/${encodeURIComponent(id)}`
  };
}

async function getAlbumPreview(env, id) {
  const albums = await getAlbums(env);
  const album = albums[id];
  const artists = await getArtists(env);
  const views = await getPageViews(env, 'album', id);
  
  if (!album) return null;
  
  // Get thumbnail URL
  let thumbUrl = null;
  if (album.thumbnail) {
    const ext = album.thumbnail.split('.').pop();
    thumbUrl = `/albums/thumbnails/${id}.${ext}`;
  }
  
  // Get primary artist
  let primaryArtist = 'Various';
  if (album.artists?.length) {
    const artistObj = artists[album.artists[0]];
    primaryArtist = artistObj?.name || album.artists[0];
  }
  
  // Get all artists
  const artistNames = album.artists?.map(aid => artists[aid]?.name || aid).join(', ') || 'Various';
  
  return {
    type: 'album',
    id,
    title: album.title,
    artist: primaryArtist,
    allArtists: artistNames,
    thumbnail: thumbUrl,
    songCount: album.songs?.length || 0,
    views: formatNumber(views),
    description: album.description || 'No description available',
    created: new Date(album.created).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    }),
    url: `/album/${id}`
  };
}

async function getArtistPreview(env, id) {
  const artists = await getArtists(env);
  const artist = artists[id];
  const views = await getPageViews(env, 'artist', id);
  
  if (!artist) return null;
  
  // Get thumbnail URL
  let thumbUrl = null;
  if (artist.thumbnail) {
    const ext = artist.thumbnail.split('.').pop();
    thumbUrl = `/artists/thumbnails/${id}.${ext}`;
  }
  
  return {
    type: 'artist',
    id,
    name: artist.name,
    thumbnail: thumbUrl,
    genre: artist.genre || 'Various',
    origin: artist.origin || 'Unknown',
    songCount: artist.songs?.length || 0,
    albumCount: artist.albums?.length || 0,
    views: formatNumber(views),
    description: artist.description || 'No description available',
    created: new Date(artist.created).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    }),
    url: `/artist/${id}`
  };
}

async function getPlaylistPreview(env, id) {
  const playlists = await getPlaylists(env);
  const playlist = playlists[id];
  const views = await getPageViews(env, 'playlist', id);
  
  if (!playlist) return null;
  
  // Get thumbnail URL
  let thumbUrl = null;
  if (playlist.thumbnail) {
    const ext = playlist.thumbnail.split('.').pop();
    thumbUrl = `/playlists/thumbnails/${id}.${ext}`;
  }
  
  return {
    type: 'playlist',
    id,
    title: playlist.title,
    curator: playlist.curator || 'ZEDALBUMS',
    thumbnail: thumbUrl,
    songCount: playlist.songs?.length || 0,
    views: formatNumber(views),
    description: playlist.description || 'No description available',
    created: new Date(playlist.created).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    }),
    url: `/playlist/${id}`
  };
}