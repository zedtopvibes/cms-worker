// src/helpers/genreManager.js
import { getStorage } from './storage.js';
import { getArtists, getAlbums, getPlaylists, getMetadata } from './storage.js';

export class GenreManager {
  constructor(env) {
    this.env = env;
    this.storage = getStorage(env);
    this.genresCache = null;
  }

  // ===== GENRE CRUD OPERATIONS =====

  async getGenres() {
    if (this.genresCache) return this.genresCache;
    
    try {
      const obj = await this.storage.get('genres.json');
      if (obj) {
        const text = await obj.text();
        this.genresCache = JSON.parse(text);
        return this.genresCache;
      }
    } catch (e) {
      // File doesn't exist, return default genres
    }
    
    // Default genres with Zambian music focus
    const defaultGenres = {
      genres: [
        { id: 'dancehall', name: 'Dancehall', color: '#28a745', icon: 'fa-bolt', description: 'Zambian Dancehall & Reggae fusion' },
        { id: 'hip-hop', name: 'Hip Hop', color: '#ff5500', icon: 'fa-microphone', description: 'Zambian Hip Hop & Rap' },
        { id: 'rnb', name: 'R&B', color: '#9b59b6', icon: 'fa-heart', description: 'Contemporary R&B' },
        { id: 'afrobeats', name: 'Afrobeats', color: '#ffc107', icon: 'fa-drum', description: 'Afrobeats & Afrofusion' },
        { id: 'reggae', name: 'Reggae', color: '#1e90ff', icon: 'fa-leaf', description: 'Reggae & Roots' },
        { id: 'soul', name: 'Soul', color: '#dc3545', icon: 'fa-heart', description: 'Soul & Neo-soul' },
        { id: 'gospel', name: 'Gospel', color: '#20c997', icon: 'fa-church', description: 'Gospel & Inspirational' },
        { id: 'pop', name: 'Pop', color: '#ff6b6b', icon: 'fa-star', description: 'Pop Music' },
        { id: 'traditional', name: 'Traditional', color: '#8B4513', icon: 'fa-drumstick-bite', description: 'Traditional Zambian Music' },
        { id: 'kalindula', name: 'Kalindula', color: '#CD5C5C', icon: 'fa-guitar', description: 'Kalindula & Traditional Fusion' }
      ],
      lastUpdated: Date.now()
    };
    
    await this.saveGenres(defaultGenres);
    return defaultGenres;
  }

  async saveGenres(genresData) {
    genresData.lastUpdated = Date.now();
    await this.storage.put('genres.json', JSON.stringify(genresData, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    });
    this.genresCache = genresData;
    return genresData;
  }

  async addGenre(genre) {
    const data = await this.getGenres();
    
    // Check if genre with same ID exists
    if (data.genres.find(g => g.id === genre.id)) {
      throw new Error('Genre with this ID already exists');
    }
    
    data.genres.push(genre);
    return this.saveGenres(data);
  }

  async updateGenre(genreId, updates) {
    const data = await this.getGenres();
    const index = data.genres.findIndex(g => g.id === genreId);
    
    if (index === -1) {
      throw new Error('Genre not found');
    }
    
    data.genres[index] = { ...data.genres[index], ...updates, id: genreId };
    return this.saveGenres(data);
  }

  async deleteGenre(genreId) {
    const data = await this.getGenres();
    data.genres = data.genres.filter(g => g.id !== genreId);
    return this.saveGenres(data);
  }

  // ===== GENRE STATISTICS =====

  async getGenreStats() {
    const genres = await this.getGenres();
    const artists = await getArtists(this.env);
    const albums = await getAlbums(this.env);
    const playlists = await getPlaylists(this.env);
    
    // Get all songs
    const songList = await this.env.media.list({ prefix: "songs/" });
    const songs = songList.objects || [];
    
    // Initialize stats for each genre
    const stats = {};
    genres.genres.forEach(g => {
      stats[g.id] = {
        id: g.id,
        name: g.name,
        color: g.color,
        icon: g.icon,
        songCount: 0,
        artistCount: 0,
        albumCount: 0,
        playlistCount: 0,
        totalPlays: 0
      };
    });

    // Count artists by genre
    for (const [id, artist] of Object.entries(artists)) {
      if (artist.genre && stats[artist.genre]) {
        stats[artist.genre].artistCount++;
      }
    }

    // Count albums by genre
    for (const [id, album] of Object.entries(albums)) {
      if (album.genre && stats[album.genre]) {
        stats[album.genre].albumCount++;
      }
    }

    // Count playlists by genre
    for (const [id, playlist] of Object.entries(playlists)) {
      if (playlist.genres) {
        playlist.genres.forEach(g => {
          if (stats[g]) stats[g].playlistCount++;
        });
      }
    }

    // Count songs by genre
    for (const song of songs) {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const meta = await getMetadata(this.env, baseName);
      
      if (meta?.genre && stats[meta.genre]) {
        stats[meta.genre].songCount++;
      }
      
      if (meta?.genres) {
        meta.genres.forEach(g => {
          if (stats[g]) stats[g].songCount++;
        });
      }
    }

    return Object.values(stats).sort((a, b) => b.songCount - a.songCount);
  }

  // ===== GENRE SUGGESTIONS =====

  async suggestGenre(title, artistName) {
    // Simple keyword-based genre suggestion
    const titleLower = title.toLowerCase();
    const artistLower = artistName.toLowerCase();
    
    const keywords = {
      'dancehall': ['dancehall', 'riddim', 'bashment', 'gal', 'gyal'],
      'hip-hop': ['hip hop', 'rap', 'trap', 'beatz', 'bars', 'flow'],
      'rnb': ['rnb', 'r&b', 'rhythm', 'blues', 'smooth'],
      'afrobeats': ['afro', 'afrobeats', 'afrobeat', 'wiz kid', 'burna'],
      'reggae': ['reggae', 'roots', 'jah', 'irie', 'one love'],
      'gospel': ['gospel', 'worship', 'praise', 'hymn', 'lord', 'jesus'],
      'kalindula': ['kalindula', 'masaku', 'amayenge']
    };
    
    for (const [genre, words] of Object.entries(keywords)) {
      for (const word of words) {
        if (titleLower.includes(word) || artistLower.includes(word)) {
          return genre;
        }
      }
    }
    
    return null;
  }

  // ===== GENRE COLOR PALETTE =====

  getColorPalette() {
    return [
      '#ff5500', '#28a745', '#9b59b6', '#ffc107', '#1e90ff',
      '#dc3545', '#20c997', '#ff6b6b', '#8B4513', '#CD5C5C',
      '#00b894', '#f39c12', '#e74c3c', '#3498db', '#2c3e50'
    ];
  }

  // ===== GENRE ICONS =====

  getIconOptions() {
    return [
      'fa-music', 'fa-microphone', 'fa-headphones', 'fa-drum', 'fa-guitar',
      'fa-heart', 'fa-star', 'fa-bolt', 'fa-leaf', 'fa-church',
      'fa-compact-disc', 'fa-record-vinyl', 'fa-volume-up', 'fa-drumstick-bite',
      'fa-cloud', 'fa-sun', 'fa-moon', 'fa-fire', 'fa-water'
    ];
  }
}