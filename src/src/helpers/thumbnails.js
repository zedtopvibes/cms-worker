// ==================== THUMBNAIL HELPER FUNCTIONS ====================

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

export async function getSongThumbnailUrl(baseName, env) {
  try {
    const jpgObj = await env.media.get(`images/${baseName}.jpg`);
    if (jpgObj) return `/images/${encodeURIComponent(baseName)}.jpg`;
    const pngObj = await env.media.get(`images/${baseName}.png`);
    if (pngObj) return `/images/${encodeURIComponent(baseName)}.png`;
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