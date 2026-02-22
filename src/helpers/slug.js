// src/helpers/slug.js
export class SlugManager {
  constructor(env) {
    this.env = env;
    this.slugsCache = null;
  }

  // ===== CLEAN TEXT FOR SLUG =====
  cleanTextForSlug(text) {
    if (!text) return '';
    
    let cleaned = text;
    
    // Replace parentheses and brackets with spaces
    cleaned = cleaned
      .replace(/[()\[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned;
  }

  // ===== GENERATE SLUG FROM TITLE ONLY =====
  generateSlug(text, options = {}) {
    const {
      maxLength = 100,
      separator = '-',
      lowercase = true
    } = options;

    if (!text) return '';

    let slug = String(text);

    // Clean the text (remove brackets but keep content)
    slug = this.cleanTextForSlug(slug);

    // Convert to lowercase
    if (lowercase) {
      slug = slug.toLowerCase();
    }

    // Replace "ft." with "ft" (remove dot)
    slug = slug
      .replace(/ft\./g, 'ft')
      .replace(/feat\./g, 'feat')
      .replace(/ featuring /g, ' feat ');

    // Remove all other punctuation and special characters
    // Keep letters, numbers, spaces, and hyphens
    slug = slug
      .replace(/[^\w\s-]/g, ' ')     // Remove all punctuation
      .replace(/\s+/g, separator)    // Replace spaces with separator
      .replace(/-+/g, separator)     // Replace multiple separators
      .replace(/^-|-$/g, '');        // Remove leading/trailing separators

    // Truncate if too long
    if (slug.length > maxLength) {
      slug = slug.substring(0, maxLength).replace(/-+$/, '');
    }

    // If slug is empty after processing, generate a fallback
    if (!slug) {
      slug = `song-${Date.now()}`;
    }

    return slug;
  }

  // ===== SLUG GENERATORS FOR DIFFERENT ENTITIES =====
  generateSongSlug(title) {
    if (!title) return '';
    return this.generateSlug(title, { maxLength: 80 });
  }

  generateArtistSlug(artistName) {
    return this.generateSlug(artistName, { maxLength: 50 });
  }

  generateAlbumSlug(albumTitle) {
    return this.generateSlug(albumTitle, { maxLength: 80 });
  }

  generatePlaylistSlug(playlistTitle) {
    return this.generateSlug(playlistTitle, { maxLength: 60 });
  }

  generateGenreSlug(genreName) {
    return this.generateSlug(genreName, { maxLength: 30 });
  }

  // ===== SLUG INDEX MANAGEMENT =====
  async getSlugIndex() {
    try {
      const obj = await this.env.media.get('slug-index.json');
      if (obj) {
        const text = await obj.text();
        return JSON.parse(text);
      }
    } catch (e) {
      // File doesn't exist
    }

    // Create empty index
    const defaultIndex = {
      songs: {},
      artists: {},
      albums: {},
      playlists: {},
      genres: {},
      by_id: {
        songs: {},
        artists: {},
        albums: {},
        playlists: {},
        genres: {}
      },
      lastUpdated: Date.now()
    };

    await this.saveSlugIndex(defaultIndex);
    return defaultIndex;
  }

  async saveSlugIndex(index) {
    index.lastUpdated = Date.now();
    await this.env.media.put('slug-index.json', JSON.stringify(index, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    });
    this.slugsCache = index;
    return index;
  }

  // ===== REGISTER SLUG =====
  async registerSlug(type, id, slug, metadata = {}) {
    const index = await this.getSlugIndex();

    // Check if slug already exists
    if (index[type] && index[type][slug]) {
      // If it exists and points to the same ID, it's fine
      if (index[type][slug].id === id) {
        return slug;
      }
      
      // Otherwise, append a number to make it unique
      let counter = 1;
      let newSlug = slug;
      while (index[type] && index[type][newSlug]) {
        newSlug = `${slug}-${counter}`;
        counter++;
      }
      slug = newSlug;
    }

    // Add to forward index (slug -> id)
    if (!index[type]) index[type] = {};
    index[type][slug] = {
      id,
      slug,
      createdAt: Date.now(),
      ...metadata
    };

    // Add to reverse index (id -> slug)
    if (!index.by_id) index.by_id = {};
    if (!index.by_id[type]) index.by_id[type] = {};
    index.by_id[type][id] = slug;

    await this.saveSlugIndex(index);
    return slug;
  }

  // ===== LOOKUP METHODS =====
  async getIdFromSlug(type, slug) {
    const index = await this.getSlugIndex();
    return index[type]?.[slug]?.id;
  }

  async getSlugFromId(type, id) {
    const index = await this.getSlugIndex();
    return index.by_id?.[type]?.[id];
  }

  // ===== URL GENERATION =====
  getUrl(type, slug) {
    return `/${type}/${slug}`;
  }

  async getUrlFromId(type, id) {
    const slug = await this.getSlugFromId(type, id);
    return slug ? this.getUrl(type, slug) : null;
  }
}