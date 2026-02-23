// src/routes/genre.js
import { GenreManager } from '../helpers/genreManager.js';
import { getArtists, getAlbums, getPlaylists, getMetadata } from '../helpers/storage.js';
import { formatDuration } from '../helpers/formatting.js';
import { SlugManager } from '../helpers/slug.js';  // ADDED

export async function handleGenre(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/genre', '') || '/';
  
  const genreManager = new GenreManager(env);
  const genresData = await genreManager.getGenres();
  const slugManager = new SlugManager(env);  // ADDED
  
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
  const genreArtists = await Promise.all(
    Object.entries(artists)
      .filter(([id, a]) => a.genre === genreId)
      .map(async ([id, a]) => {
        const slug = await slugManager.getSlugFromId('artists', id) || id;
        return { id, slug, ...a };
      })
  );
  
  const genreAlbums = await Promise.all(
    Object.entries(albums)
      .filter(([id, a]) => a.genre === genreId)
      .map(async ([id, a]) => {
        const slug = await slugManager.getSlugFromId('albums', id) || id;
        return { id, slug, ...a };
      })
  );
  
  const genrePlaylists = await Promise.all(
    Object.entries(playlists)
      .filter(([id, p]) => p.genres?.includes(genreId))
      .map(async ([id, p]) => {
        const slug = await slugManager.getSlugFromId('playlists', id) || id;
        return { id, slug, ...p };
      })
  );
  
  // Get songs
  const songList = await env.media.list({ prefix: "songs/" });
  const songs = songList.objects || [];
  const genreSongs = [];
  
  for (const song of songs) {
    const fileName = song.key.split('/')[1];
    const baseName = fileName.replace('.mp3', '');
    const meta = await getMetadata(env, baseName);
    
    if (meta?.genre === genreId || meta?.genres?.includes(genreId)) {
      const slug = await slugManager.getSlugFromId('songs', baseName) || baseName;
      genreSongs.push({
        id: baseName,
        slug,
        title: meta?.title || baseName,
        artist: artists[meta?.primaryArtist]?.name || meta?.primaryArtist,
        artistId: meta?.primaryArtist,
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
              <a href="/song/${song.slug}" style="text-decoration: none; color: inherit;">
                <div style="background: white; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e8e8e8; transition: transform 0.2s;">
                  <div>
                    <strong>${song.title}</strong>
                    <span style="color: #666;"> • ${song.artist}</span>
                  </div>
                  <span>${formatDuration(song.duration)}</span>
                </div>
              </a>
            `).join('')}
          </div>
        </section>
      ` : ''}
      
      ${genreArtists.length > 0 ? `
        <section style="margin-bottom: 40px;">
          <h2 style="font-size: 1.5rem; margin-bottom: 20px;">Artists</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;">
            ${genreArtists.map(artist => `
              <a href="/artist/${artist.slug}" style="text-decoration: none; color: inherit;">
                <div style="text-align: center;">
                  <div style="width: 100px; height: 100px; background: linear-gradient(135deg, ${genre.color}40, #f0f0f0); border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-user" style="font-size: 2rem; color: ${genre.color};"></i>
                  </div>
                  <strong>${artist.name}</strong>
                  <p style="font-size: 0.8rem; color: #666;">${artist.songs?.length || 0} songs</p>
                </div>
              </a>
            `).join('')}
          </div>
        </section>
      ` : ''}
      
      ${genreAlbums.length > 0 ? `
        <section style="margin-bottom: 40px;">
          <h2 style="font-size: 1.5rem; margin-bottom: 20px;">Albums</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">
            ${genreAlbums.slice(0, 6).map(album => `
              <a href="/album/${album.slug}" style="text-decoration: none; color: inherit;">
                <div style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e8e8e8;">
                  <div style="height: 150px; background: linear-gradient(135deg, ${genre.color}20, #f0f0f0); display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-compact-disc" style="font-size: 3rem; color: ${genre.color};"></i>
                  </div>
                  <div style="padding: 10px;">
                    <strong style="display: block; margin-bottom: 5px;">${album.title}</strong>
                    <span style="font-size: 0.8rem; color: #666;">${album.songs?.length || 0} songs</span>
                  </div>
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

// Helper layout function
function layout(title, content) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - ZEDALBUMS</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          margin: 0; 
          padding: 20px; 
          background: #f4f4f9; 
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${content}
      </div>
    </body>
    </html>
  `;
}