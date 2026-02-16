// ==================== ADMIN ARTISTS MANAGEMENT ====================
import { getArtists, saveArtists, getAlbums } from '../../helpers/storage.js';
import { getAggregatedStats } from '../../helpers/db.js';
import { getPageViews } from '../../helpers/pageViews.js';
import { sanitize, formatNumber } from '../../helpers/formatting.js';

export async function handleAdminArtists(req, env, ctx, auth) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page')) || 1;
  const search = url.searchParams.get('search') || '';
  const sort = url.searchParams.get('sort') || 'name';
  const ITEMS_PER_PAGE = 20;

  // Get all artists
  const artists = await getArtists(env);
  const albums = await getAlbums(env);
  
  // Get detailed artist data with views
  let artistsData = await Promise.all(
    Object.entries(artists).map(async ([id, artist]) => {
      const stats = await getAggregatedStats(artist.songs || [], env);
      const pageViews = await getPageViews(env, 'artist', id);
      
      // Get album count
      const albumCount = artist.albums?.length || 0;
      
      // Get monthly listeners (estimate based on plays)
      const monthlyListeners = Math.floor(stats.plays * 0.3);
      
      return {
        id,
        name: artist.name,
        description: artist.description || '',
        genre: artist.genre || 'Various',
        thumbnail: artist.thumbnail,
        songCount: artist.songs?.length || 0,
        albumCount,
        plays: stats.plays,
        downloads: stats.downloads,
        views: pageViews,
        monthlyListeners,
        created: artist.created,
        hasImage: !!artist.thumbnail
      };
    })
  );

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    artistsData = artistsData.filter(artist => 
      artist.name.toLowerCase().includes(searchLower) ||
      artist.genre.toLowerCase().includes(searchLower) ||
      artist.description.toLowerCase().includes(searchLower)
    );
  }

  // Apply sorting with views
  artistsData.sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'songs':
        return b.songCount - a.songCount;
      case 'albums':
        return b.albumCount - a.albumCount;
      case 'plays':
        return b.plays - a.plays;
      case 'listeners':
        return b.monthlyListeners - a.monthlyListeners;
      case 'views':
        return (b.views || 0) -