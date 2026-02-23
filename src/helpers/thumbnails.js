// ==================== THUMBNAIL HELPERS ====================
// No changes needed for Phase 3 - these functions don't generate URLs
// They just return image paths which are used by renderers

export async function getAlbumThumbnailUrl(album, env) {
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

export async function getSongThumbnailUrl(songId, env) {
  try {
    const jpgObj = await env.media.get(`images/${songId}.jpg`);
    if (jpgObj) {
      return `/images/${encodeURIComponent(songId)}.jpg`;
    } else {
      const pngObj = await env.media.get(`images/${songId}.png`);
      if (pngObj) {
        return `/images/${encodeURIComponent(songId)}.png`;
      }
    }
  } catch (e) {}
  return "/images/placeholder.jpg";
}

export async function getArtistThumbnailUrl(artist, env) {
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

export async function getPlaylistThumbnailUrl(playlist, env) {
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