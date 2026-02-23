// ==================== SLUG MANAGER - PURE IMPLEMENTATION ====================
// Strict slug generation with NO backward compatibility
// Only lowercase letters, numbers, and hyphens allowed
// No dots, underscores, or special characters

export class SlugManager {
  constructor(env) {
    this.env = env;
    this.slugsCache = null;
    this.reverseCache = null;
    this.cacheTimestamp = 0;
    const CACHE_DURATION = 60000; // 1 minute
  }

  // ===== PUBLIC METHODS =====

  /**
   * Generate a slug from a song title and artist
   * Format: "artist-name-song-title"
   */
  generateSongSlug(title, artistId) {
    // Artist ID might already have underscores, clean it
    const cleanArtist = this._slugify(artistId.replace(/_/g, ' '));
    const cleanTitle = this._slugify(title);
    
    // Handle empty results
    if (!cleanArtist && !cleanTitle) return 'untitled-song';
    if (!cleanArtist) return cleanTitle || 'untitled-song';
    if (!cleanTitle) return cleanArtist || 'untitled-song';
    
    return `${cleanArtist}-${cleanTitle}`;
  }

  /**
   * Generate a slug from an artist name
   */
  generateArtistSlug(name) {
    const slug = this._slugify(name);
    return slug || 'untitled-artist';
  }

  /**
   * Generate a slug from an album title
   */
  generateAlbumSlug(title) {
    const slug = this._slugify(title);
    return slug || 'untitled-album';
  }

  /**
   * Generate a slug from a playlist title
   */
  generatePlaylistSlug(title) {
    const slug = this._slugify(title);
    return slug || 'untitled-playlist';
  }

  /**
   * Register a slug in the database with forward/reverse lookups
   */
  async registerSlug(type, id, slug, metadata = {}) {
    const slugKey = `slugs:${type}:${slug}`;
    const idKey = `slugs:${type}:id:${id}`;
    
    // Check if slug already exists (shouldn't happen if generateUniqueSlug was used)
    const existing = await this.env.media.get(slugKey);
    if (existing) {
      throw new Error(`Slug "${slug}" already exists for ${type}`);
    }
    
    // Store forward lookup (slug -> id)
    await this.env.media.put(slugKey, JSON.stringify({
      id,
      type,
      slug,
      metadata,
      created: Date.now()
    }), {
      httpMetadata: { contentType: 'application/json' }
    });
    
    // Store reverse lookup (id -> slug)
    await this.env.media.put(idKey, JSON.stringify({
      slug,
      type,
      metadata,
      updated: Date.now()
    }), {
      httpMetadata: { contentType: 'application/json' }
    });
    
    // Clear cache
    this.slugsCache = null;
    this.reverseCache = null;
    
    return slug;
  }

  /**
   * Get ID from slug - returns null if not found (strict - no fallbacks)
   */
  async getIdFromSlug(type, slug) {
    // Validate slug format first (strict check)
    if (!this._isValidSlug(slug)) {
      return null;
    }
    
    const slugKey = `slugs:${type}:${slug}`;
    try {
      const obj = await this.env.media.get(slugKey);
      if (!obj) return null;
      
      const data = JSON.parse(await obj.text());
      return data.id;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get slug from ID - returns null if not found
   */
  async getSlugFromId(type, id) {
    // Check cache first
    if (this.reverseCache && this.reverseCache[type] && this.reverseCache[type][id]) {
      return this.reverseCache[type][id];
    }
    
    const idKey = `slugs:${type}:id:${id}`;
    try {
      const obj = await this.env.media.get(idKey);
      if (!obj) return null;
      
      const data = JSON.parse(await obj.text());
      
      // Update cache
      if (!this.reverseCache) this.reverseCache = {};
      if (!this.reverseCache[type]) this.reverseCache[type] = {};
      this.reverseCache[type][id] = data.slug;
      
      return data.slug;
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if a slug already exists
   */
  async slugExists(type, slug) {
    const slugKey = `slugs:${type}:${slug}`;
    try {
      const obj = await this.env.media.head(slugKey);
      return !!obj;
    } catch (e) {
      return false;
    }
  }

  /**
   * Generate a unique slug by adding -1, -2, etc. if needed
   */
  async generateUniqueSlug(type, baseSlug) {
    if (!baseSlug) baseSlug = 'untitled';
    
    let slug = baseSlug;
    let counter = 1;
    
    // Keep trying until we find an unused slug
    while (await this.slugExists(type, slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
      
      // Safety valve - prevent infinite loops
      if (counter > 100) {
        slug = `${baseSlug}-${Date.now()}`;
        break;
      }
    }
    
    return slug;
  }

  /**
   * Delete a slug (when content is deleted)
   */
  async deleteSlug(type, id) {
    // Get the slug first
    const slug = await this.getSlugFromId(type, id);
    if (slug) {
      const slugKey = `slugs:${type}:${slug}`;
      await this.env.media.delete(slugKey).catch(() => {});
    }
    
    const idKey = `slugs:${type}:id:${id}`;
    await this.env.media.delete(idKey).catch(() => {});
    
    // Clear cache
    this.slugsCache = null;
    this.reverseCache = null;
  }

  /**
   * Update slug when content changes (title/name)
   */
  async updateSlug(type, id, newTitle, oldMetadata = {}) {
    // Get the appropriate generator based on type
    let baseSlug;
    switch (type) {
      case 'songs':
        baseSlug = this.generateSongSlug(newTitle, oldMetadata.artistId || '');
        break;
      case 'artists':
        baseSlug = this.generateArtistSlug(newTitle);
        break;
      case 'albums':
        baseSlug = this.generateAlbumSlug(newTitle);
        break;
      case 'playlists':
        baseSlug = this.generatePlaylistSlug(newTitle);
        break;
      default:
        throw new Error(`Unknown type: ${type}`);
    }
    
    // Generate unique slug
    const newSlug = await this.generateUniqueSlug(type, baseSlug);
    
    // Delete old slug
    await this.deleteSlug(type, id);
    
    // Register new slug
    await this.registerSlug(type, id, newSlug, { 
      title: newTitle,
      ...oldMetadata 
    });
    
    return newSlug;
  }

  /**
   * Get all slugs for a type (for admin display)
   */
  async getAllSlugs(type) {
    const list = await this.env.media.list({ prefix: `slugs:${type}:id:` });
    const slugs = [];
    
    for (const item of list.objects || []) {
      try {
        const obj = await this.env.media.get(item.key);
        if (obj) {
          const data = JSON.parse(await obj.text());
          const id = item.key.split(':').pop();
          slugs.push({
            id,
            slug: data.slug,
            ...data.metadata
          });
        }
      } catch (e) {}
    }
    
    return slugs;
  }

  // ===== PRIVATE METHODS =====

  /**
   * Balanced slugify - preserves words but removes special chars
   * Only lowercase letters, numbers, and hyphens allowed
   */
  _slugify(text) {
    if (!text) return '';
    
    // Convert to string and lowercase
    let str = String(text).toLowerCase();
    
    // STEP 1: Replace common separators with spaces
    // This handles underscores, hyphens, commas, etc.
    str = str.replace(/[_,\-/\s]+/g, ' ');
    
    // STEP 2: Remove all special characters EXCEPT spaces
    // This keeps letters, numbers, and spaces only
    str = str.replace(/[^a-z0-9\s]/g, '');
    
    // STEP 3: Replace multiple spaces with single space
    str = str.replace(/\s+/g, ' ');
    
    // STEP 4: Trim spaces
    str = str.trim();
    
    // STEP 5: Replace spaces with hyphens
    str = str.replace(/\s+/g, '-');
    
    // STEP 6: Remove multiple hyphens (just in case)
    str = str.replace(/-+/g, '-');
    
    // If result is empty, return empty string
    if (!str) return '';
    
    return str;
  }

  /**
   * Validate slug format - strict check
   * Must match: ^[a-z0-9]+(?:-[a-z0-9]+)*$
   */
  _isValidSlug(slug) {
    if (!slug) return false;
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return slugRegex.test(slug);
  }

  /**
   * Load all slugs into cache (for performance)
   */
  async _loadCache() {
    if (this.slugsCache && Date.now() - this.cacheTimestamp < 60000) {
      return;
    }
    
    this.slugsCache = { songs: {}, artists: {}, albums: {}, playlists: {} };
    this.reverseCache = { songs: {}, artists: {}, artists: {}, playlists: {} };
    
    const types = ['songs', 'artists', 'albums', 'playlists'];
    
    for (const type of types) {
      const list = await this.env.media.list({ prefix: `slugs:${type}:` });
      
      for (const item of list.objects || []) {
        try {
          const obj = await this.env.media.get(item.key);
          if (obj) {
            const data = JSON.parse(await obj.text());
            
            if (item.key.includes(':id:')) {
              // Reverse lookup
              const id = item.key.split(':').pop();
              this.reverseCache[type][id] = data.slug;
            } else {
              // Forward lookup
              const slug = item.key.split(':').pop();
              this.slugsCache[type][slug] = data.id;
            }
          }
        } catch (e) {}
      }
    }
    
    this.cacheTimestamp = Date.now();
  }
}