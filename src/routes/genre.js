// src/routes/genre.js
import { GenreManager } from '../helpers/genreManager.js';
import { getArtists, getAlbums, getPlaylists, getMetadata } from '../helpers/storage.js';
import { formatDuration } from '../helpers/formatting.js';

export async function handleGenre(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/genre', '') || '/';
  
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  
  // List all genres
  if (path === '/' || path === '') {
    const stats = await genreManager.getGenreStats();
    
    const content = `
      <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
        <h1 style="font-size: 2rem; margin-bottom: 30px;">Browse by Genre</h1>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px;">
          ${stats.map(genre => `
            <a href="/genre/${genre.id}" style="text-decoration: none; color: inherit;">
              <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <div style="height: 100px; background: ${genre.color}; display: flex; align-items: center; justify-content: center;">
                  <i class="fas ${genre.icon}" style="font-size: 3rem; color: white; opacity: 0.8;"></i>
                </div>
                <div style="padding: 15px;">
                  <h3 style="margin: 0 0 5px;">${genre.name}</h3>
                  <p style="font-size: 0.8rem; color: #666;">${genre.songCount} songs • ${genre.artistCount} artists</p>
                </div>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    `;
    
    return new Response(layout('Genres', content), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  // Show specific genre
  const genreId = path.slice(1);
  const genre = genresData.genres.find(g => g.id === genreId);
  
  if (!genre) {
    return new Response('Genre not found', { status: 404 });
  }
  
  // Get content for this genre
  const artists = await getArtists(env);
  const albums = await getAlbums(env);
  const playlists = await getPlaylists(env);
  
  // Filter by genre
  const genreArtists = Object.entries(artists)
    .filter(([id, a]) => a.genre === genreId)
    .map(([id, a]) => ({ id, ...a }));
  
  const genreAlbums = Object.entries(albums)
    .filter(([id, a]) => a.genre === genreId)
    .map(([id, a]) => ({ id, ...a }));
  
  const genrePlaylists = Object.entries(playlists)
    .filter(([id, p]) => p.genres?.includes(genreId))
    .map(([id, p]) => ({ id, ...p }));
  
  // Get songs
  const songList = await env.media.list({ prefix: "songs/" });
  const songs = songList.objects || [];
  const genreSongs = [];
  
  for (const song of songs) {
    const fileName = song.key.split('/')[1];
    const baseName = fileName.replace('.mp3', '');
    const meta = await getMetadata(env, baseName);
    
    if (meta?.genre === genreId || meta?.genres?.includes(genreId)) {
      genreSongs.push({
        id: baseName,
        title: meta?.title || baseName,
        artist: artists[meta?.primaryArtist]?.name || meta?.primaryArtist,
        duration: meta?.duration,
        genre: meta?.genre
      });
    }
  }
  
  const content = `
    <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
      <div style="background: ${genre.color}; padding: 40px 20px; border-radius: 16px; color: white; margin-bottom: 30px;">
        <i class="fas ${genre.icon}" style="font-size: 3rem; margin-bottom: 15px;"></i>
        <h1 style="font-size: 2.5rem; margin: 0 0 10px;">${genre.name}</h1>
        <p style="font-size: 1.1rem; opacity: 0.9;">${genre.description || ''}</p>
      </div>
      
      ${genreSongs.length > 0 ? `
        <section style="margin-bottom: 40px;">
          <h2 style="font-size: 1.5rem; margin-bottom: 20px;">Songs</h2>
          <div style="display: grid; gap: 10px;">
            ${genreSongs.slice(0, 10).map(song => `
              <div style="background: white; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between;">
                <div>
                  <strong>${song.title}</strong>
                  <span style="color: #666;"> • ${song.artist}</span>
                </div>
                <span>${formatDuration(song.duration)}</span>
              </div>
            `).join('')}
          </div>
        </section>
      ` : ''}
      
      ${genreArtists.length > 0 ? `
        <section style="margin-bottom: 40px;">
          <h2 style="font-size: 1.5rem; margin-bottom: 20px;">Artists</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;">
            ${genreArtists.map(artist => `
              <a href="/artist/${artist.id}" style="text-decoration: none; color: inherit;">
                <div style="text-align: center;">
                  <div style="width: 100px; height: 100px; background: #f0f0f0; border-radius: 50%; margin: 0 auto 10px;"></div>
                  <strong>${artist.name}</strong>
                </div>
              </a>
            `).join('')}
          </div>
        </section>
      ` : ''}
    </div>
  `;
  
  return new Response(layout(genre.name, content), {
    headers: { 'Content-Type': 'text/html' }
  });
}