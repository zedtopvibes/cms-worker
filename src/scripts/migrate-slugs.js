// src/scripts/migrate-slugs.js
import { SlugManager } from '../helpers/slug.js';
import { getArtists, getAlbums, getPlaylists, getMetadata } from '../helpers/storage.js';
import { GenreManager } from '../helpers/genreManager.js';

export async function migrateSlugs(env) {
  console.log('Starting slug migration...');
  
  const slugManager = new SlugManager(env);
  
  // Migrate artists
  const artists = await getArtists(env);
  for (const [id, artist] of Object.entries(artists)) {
    const slug = slugManager.generateArtistSlug(artist.name);
    await slugManager.registerSlug('artists', id, slug, { name: artist.name });
    console.log(`Artist: ${artist.name} -> ${slug}`);
  }
  
  // Migrate albums
  const albums = await getAlbums(env);
  for (const [id, album] of Object.entries(albums)) {
    const slug = slugManager.generateAlbumSlug(album.title);
    await slugManager.registerSlug('albums', id, slug, { title: album.title });
    console.log(`Album: ${album.title} -> ${slug}`);
  }
  
  // Migrate playlists
  const playlists = await getPlaylists(env);
  for (const [id, playlist] of Object.entries(playlists)) {
    const slug = slugManager.generatePlaylistSlug(playlist.title);
    await slugManager.registerSlug('playlists', id, slug, { title: playlist.title });
    console.log(`Playlist: ${playlist.title} -> ${slug}`);
  }
  
  // Migrate genres
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  for (const genre of genresData.genres) {
    const slug = slugManager.generateGenreSlug(genre.name);
    await slugManager.registerSlug('genres', genre.id, slug, { name: genre.name });
    console.log(`Genre: ${genre.name} -> ${slug}`);
  }
  
  // Migrate songs
  const songList = await env.media.list({ prefix: 'songs/' });
  for (const song of songList.objects || []) {
    const fileName = song.key.split('/')[1];
    const baseName = fileName.replace('.mp3', '');
    
    try {
      const metaObj = await env.media.get(`metadata/${baseName}.json`);
      if (metaObj) {
        const metaText = await metaObj.text();
        const meta = JSON.parse(metaText);
        
        if (meta.title) {
          const slug = slugManager.generateSongSlug(meta.title);
          await slugManager.registerSlug('songs', baseName, slug, { 
            title: meta.title,
            artist: meta.primaryArtist 
          });
          console.log(`Song: ${meta.title} -> ${slug}`);
        }
      }
    } catch (e) {
      console.error(`Error processing ${baseName}:`, e.message);
    }
  }
  
  console.log('✅ Migration complete!');
}