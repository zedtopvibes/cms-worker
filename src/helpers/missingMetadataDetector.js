// src/helpers/missingMetadataDetector.js
import { getArtists, getAlbums, getPlaylists, getMetadata } from './storage.js';

export class MissingMetadataDetector {
  constructor(env) {
    this.env = env;
  }

  // ==================== SCAN FOR MISSING METADATA ====================

  async scanAll() {
    const [
      songsMissingInfo,
      songsMissingThumbnails,
      emptyAlbums,
      emptyPlaylists,
      playlistsMissingThumbnails,
      orphanedFiles
    ] = await Promise.all([
      this.findSongsMissingInfo(),
      this.findSongsMissingThumbnails(),
      this.findEmptyAlbums(),
      this.findEmptyPlaylists(),
      this.findPlaylistsMissingThumbnails(),
      this.findOrphanedFiles()
    ]);

    return {
      songsMissingInfo,
      songsMissingThumbnails,
      emptyAlbums,
      emptyPlaylists,
      playlistsMissingThumbnails,
      orphanedFiles,
      totals: {
        songsMissingInfo: songsMissingInfo.length,
        songsMissingThumbnails: songsMissingThumbnails.length,
        emptyAlbums: emptyAlbums.length,
        emptyPlaylists: emptyPlaylists.length,
        playlistsMissingThumbnails: playlistsMissingThumbnails.length,
        orphanedFiles: orphanedFiles.total,
        orphanedSize: orphanedFiles.totalSize
      }
    };
  }

  // ===== 1. Songs without proper artist/album info =====
  async findSongsMissingInfo() {
    const songList = await this.env.media.list({ prefix: "songs/" });
    const songs = songList.objects || [];
    const artists = await getArtists(this.env);
    const albums = await getAlbums(this.env);
    
    const missing = [];

    for (const song of songs) {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const meta = await getMetadata(this.env, baseName);
      const [artistId] = baseName.split('_');
      
      const issues = [];
      
      // Check title
      if (!meta?.title && !baseName.includes('_')) {
        issues.push('missing title');
      }
      
      // Check artist
      const artistExists = artists[meta?.primaryArtist || artistId];
      if (!artistExists) {
        issues.push('artist not found in database');
      }
      
      // Check album reference
      let inAlbum = false;
      for (const [id, album] of Object.entries(albums)) {
        if (album.songs?.includes(baseName)) {
          inAlbum = true;
          break;
        }
      }
      
      if (!inAlbum && issues.length === 0) {
        issues.push('not in any album');
      }
      
      if (issues.length > 0) {
        missing.push({
          baseName,
          fileName: song.key,
          title: meta?.title || baseName,
          artistId: meta?.primaryArtist || artistId,
          issues,
          size: song.size,
          uploaded: song.uploaded
        });
      }
    }

    return missing;
  }

  // ===== 2. Songs missing thumbnails =====
  async findSongsMissingThumbnails() {
    const songList = await this.env.media.list({ prefix: "songs/" });
    const songs = songList.objects || [];
    
    const missing = [];

    for (const song of songs) {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      
      // Check for thumbnail
      let hasThumbnail = false;
      try {
        const jpgObj = await this.env.media.get(`images/${baseName}.jpg`);
        if (jpgObj) hasThumbnail = true;
        else {
          const pngObj = await this.env.media.get(`images/${baseName}.png`);
          if (pngObj) hasThumbnail = true;
        }
      } catch (e) {}
      
      if (!hasThumbnail) {
        const meta = await getMetadata(this.env, baseName);
        missing.push({
          baseName,
          fileName: song.key,
          title: meta?.title || baseName,
          size: song.size
        });
      }
    }

    return missing;
  }

  // ===== 3. Empty albums =====
  async findEmptyAlbums() {
    const albums = await getAlbums(this.env);
    const empty = [];

    for (const [id, album] of Object.entries(albums)) {
      if (!album.songs || album.songs.length === 0) {
        empty.push({
          id,
          title: album.title,
          description: album.description || '',
          thumbnail: album.thumbnail,
          created: album.created
        });
      }
    }

    return empty;
  }

  // ===== 4. Empty playlists =====
  async findEmptyPlaylists() {
    const playlists = await getPlaylists(this.env);
    const empty = [];

    for (const [id, playlist] of Object.entries(playlists)) {
      if (!playlist.songs || playlist.songs.length === 0) {
        empty.push({
          id,
          title: playlist.title,
          curator: playlist.curator || 'ZEDALBUMS',
          description: playlist.description || '',
          thumbnail: playlist.thumbnail,
          created: playlist.created
        });
      }
    }

    return empty;
  }

  // ===== 5. Playlists missing thumbnails =====
  async findPlaylistsMissingThumbnails() {
    const playlists = await getPlaylists(this.env);
    const missing = [];

    for (const [id, playlist] of Object.entries(playlists)) {
      if (!playlist.thumbnail && playlist.songs?.length > 0) {
        missing.push({
          id,
          title: playlist.title,
          curator: playlist.curator || 'ZEDALBUMS',
          songCount: playlist.songs.length,
          created: playlist.created
        });
      }
    }

    return missing;
  }

  // ===== 6. Orphaned files in R2 =====
  async findOrphanedFiles() {
    // Get all files in R2
    const allFiles = [];
    let cursor = undefined;
    
    do {
      const list = await this.env.media.list({ 
        prefix: "",
        cursor,
        limit: 1000 
      });
      allFiles.push(...list.objects);
      cursor = list.cursor;
    } while (cursor);

    // Get all valid references
    const songs = await this.env.media.list({ prefix: "songs/" });
    const validSongBaseNames = new Set(
      songs.objects?.map(s => s.key.split('/')[1].replace('.mp3', '')) || []
    );

    const albums = await getAlbums(this.env);
    const playlists = await getPlaylists(this.env);
    const artists = await getArtists(this.env);

    const orphaned = {
      images: [],
      metadata: [],
      descriptions: [],
      other: [],
      total: 0,
      totalSize: 0
    };

    for (const file of allFiles) {
      const key = file.key;
      const size = file.size;
      
      // Skip song files (they're handled separately)
      if (key.startsWith('songs/')) continue;
      
      let isOrphaned = false;
      let category = 'other';

      // Check images
      if (key.startsWith('images/')) {
        category = 'images';
        const baseName = key.split('/')[1].replace(/\.(jpg|png)$/, '');
        // Check if corresponding song exists
        if (!validSongBaseNames.has(baseName)) {
          isOrphaned = true;
        }
      }
      
      // Check metadata
      else if (key.startsWith('metadata/')) {
        category = 'metadata';
        const baseName = key.split('/')[1].replace('.json', '');
        if (!validSongBaseNames.has(baseName)) {
          isOrphaned = true;
        }
      }
      
      // Check descriptions
      else if (key.startsWith('descriptions/')) {
        category = 'descriptions';
        const baseName = key.split('/')[1].replace('.txt', '');
        if (!validSongBaseNames.has(baseName)) {
          isOrphaned = true;
        }
      }
      
      // Check album thumbnails
      else if (key.startsWith('albums/thumbnails/')) {
        category = 'images';
        const albumId = key.split('/')[2].replace(/\.(jpg|png)$/, '');
        if (!albums[albumId]) {
          isOrphaned = true;
        }
      }
      
      // Check artist thumbnails
      else if (key.startsWith('artists/thumbnails/')) {
        category = 'images';
        const artistId = key.split('/')[2].replace(/\.(jpg|png)$/, '');
        if (!artists[artistId]) {
          isOrphaned = true;
        }
      }
      
      // Check playlist thumbnails
      else if (key.startsWith('playlists/thumbnails/')) {
        category = 'images';
        const playlistId = key.split('/')[2].replace(/\.(jpg|png)$/, '');
        if (!playlists[playlistId]) {
          isOrphaned = true;
        }
      }

      if (isOrphaned) {
        orphaned[category].push({
          key,
          size,
          lastModified: file.uploaded
        });
        orphaned.total++;
        orphaned.totalSize += size;
      }
    }

    return orphaned;
  }

  // ===== CLEANUP FUNCTIONS =====

  async deleteOrphanedFiles(fileKeys) {
    const results = {
      success: [],
      failed: []
    };

    for (const key of fileKeys) {
      try {
        await this.env.media.delete(key);
        results.success.push(key);
      } catch (error) {
        results.failed.push({ key, error: error.message });
      }
    }

    return results;
  }

  async fixSongMetadata(baseName, updates) {
    try {
      const meta = await getMetadata(this.env, baseName);
      const updatedMeta = { ...meta, ...updates };
      await this.env.media.put(`metadata/${baseName}.json`, JSON.stringify(updatedMeta, null, 2), {
        httpMetadata: { contentType: 'application/json' }
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async generateThumbnail(baseName) {
    // This would call a service to generate thumbnail from audio
    // For now, return placeholder
    return { success: false, message: 'Auto-generation not implemented' };
  }
}