// src/helpers/contentQualityAnalyzer.js
import { getArtists, getAlbums, getPlaylists, getMetadata } from './storage.js';

export class ContentQualityAnalyzer {
  constructor(env) {
    this.env = env;
  }

  // ==================== MAIN SCAN ====================

  async scanAll() {
    const [
      lowBitrateSongs,
      missingDescriptions,
      incompleteArtistBios,
      albumsMissingYears,
      songsNoGenre,
      songsNoDuration,
      artistsNoImage,
      albumsNoThumbnail
    ] = await Promise.all([
      this.findLowBitrateSongs(),
      this.findMissingDescriptions(),
      this.findIncompleteArtistBios(),
      this.findAlbumsMissingYears(),
      this.findSongsNoGenre(),
      this.findSongsNoDuration(),
      this.findArtistsNoImage(),
      this.findAlbumsNoThumbnail()
    ]);

    return {
      lowBitrateSongs,
      missingDescriptions,
      incompleteArtistBios,
      albumsMissingYears,
      songsNoGenre,
      songsNoDuration,
      artistsNoImage,
      albumsNoThumbnail,
      totals: {
        lowBitrateSongs: lowBitrateSongs.length,
        missingDescriptions: missingDescriptions.length,
        incompleteArtistBios: incompleteArtistBios.length,
        albumsMissingYears: albumsMissingYears.length,
        songsNoGenre: songsNoGenre.length,
        songsNoDuration: songsNoDuration.length,
        artistsNoImage: artistsNoImage.length,
        albumsNoThumbnail: albumsNoThumbnail.length,
        total: lowBitrateSongs.length + missingDescriptions.length + 
                incompleteArtistBios.length + albumsMissingYears.length +
                songsNoGenre.length + songsNoDuration.length +
                artistsNoImage.length + albumsNoThumbnail.length
      }
    };
  }

  // ===== 1. Low Bitrate Audio (< 128kbps) =====
  async findLowBitrateSongs(threshold = 128) {
    const songList = await this.env.media.list({ prefix: "songs/" });
    const songs = songList.objects || [];
    
    const lowBitrate = [];

    for (const song of songs) {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const meta = await getMetadata(this.env, baseName);
      
      // Estimate bitrate from file size and duration
      if (meta?.duration && song.size) {
        const estimatedBitrate = Math.round((song.size * 8) / meta.duration / 1000);
        
        if (estimatedBitrate < threshold) {
          lowBitrate.push({
            baseName,
            fileName: song.key,
            title: meta?.title || baseName,
            size: song.size,
            duration: meta.duration,
            estimatedBitrate,
            threshold,
            needsAttention: estimatedBitrate < 96 ? 'critical' : 'warning'
          });
        }
      }
    }

    return lowBitrate;
  }

  // ===== 2. Missing Descriptions =====
  async findMissingDescriptions() {
    const songList = await this.env.media.list({ prefix: "songs/" });
    const songs = songList.objects || [];
    const albums = await getAlbums(this.env);
    const playlists = await getPlaylists(this.env);
    
    const missing = {
      songs: [],
      albums: [],
      playlists: []
    };

    // Check songs for descriptions
    for (const song of songs) {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      
      try {
        const descObj = await this.env.media.get(`descriptions/${baseName}.txt`);
        if (!descObj) {
          const meta = await getMetadata(this.env, baseName);
          missing.songs.push({
            id: baseName,
            title: meta?.title || baseName,
            type: 'song'
          });
        }
      } catch (e) {
        // Description doesn't exist
        const meta = await getMetadata(this.env, baseName);
        missing.songs.push({
          id: baseName,
          title: meta?.title || baseName,
          type: 'song'
        });
      }
    }

    // Check albums for descriptions
    for (const [id, album] of Object.entries(albums)) {
      if (!album.description || album.description.trim() === '') {
        missing.albums.push({
          id,
          title: album.title,
          type: 'album'
        });
      }
    }

    // Check playlists for descriptions
    for (const [id, playlist] of Object.entries(playlists)) {
      if (!playlist.description || playlist.description.trim() === '') {
        missing.playlists.push({
          id,
          title: playlist.title,
          type: 'playlist'
        });
      }
    }

    return missing;
  }

  // ===== 3. Incomplete Artist Bios =====
  async findIncompleteArtistBios() {
    const artists = await getArtists(this.env);
    const incomplete = [];

    for (const [id, artist] of Object.entries(artists)) {
      const issues = [];
      
      // Check bio
      if (!artist.bio || artist.bio.trim() === '') {
        issues.push('missing bio');
      } else if (artist.bio.length < 100) {
        issues.push('bio too short');
      }

      // Check social links
      if (!artist.website && !artist.twitter && !artist.instagram) {
        issues.push('no social links');
      }

      // Check genre
      if (!artist.genre) {
        issues.push('missing genre');
      }

      // Check image
      if (!artist.image) {
        issues.push('no profile image');
      }

      if (issues.length > 0) {
        incomplete.push({
          id,
          name: artist.name,
          songCount: artist.songCount || 0,
          albumCount: artist.albumCount || 0,
          issues,
          score: this.calculateCompletenessScore(artist)
        });
      }
    }

    return incomplete.sort((a, b) => a.score - b.score);
  }

  // ===== 4. Albums Missing Release Years =====
  async findAlbumsMissingYears() {
    const albums = await getAlbums(this.env);
    const missing = [];

    for (const [id, album] of Object.entries(albums)) {
      if (!album.release_year && album.songs?.length > 0) {
        // Try to guess year from songs
        let guessedYear = null;
        for (const songId of album.songs) {
          const meta = await getMetadata(this.env, songId);
          if (meta?.year) {
            guessedYear = meta.year;
            break;
          }
        }

        missing.push({
          id,
          title: album.title,
          artist: album.artists?.[0] || 'Unknown',
          songCount: album.songs?.length || 0,
          guessedYear,
          created: album.created
        });
      }
    }

    return missing;
  }

  // ===== 5. Songs with No Genre Tags =====
  async findSongsNoGenre() {
    const songList = await this.env.media.list({ prefix: "songs/" });
    const songs = songList.objects || [];
    
    const noGenre = [];

    for (const song of songs) {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const meta = await getMetadata(this.env, baseName);
      
      if (!meta?.genre || meta.genre.trim() === '') {
        noGenre.push({
          baseName,
          title: meta?.title || baseName,
          artist: meta?.primaryArtist || baseName.split('_')[0],
          duration: meta?.duration || 0,
          size: song.size
        });
      }
    }

    return noGenre;
  }

  // ===== 6. Songs with No Duration =====
  async findSongsNoDuration() {
    const songList = await this.env.media.list({ prefix: "songs/" });
    const songs = songList.objects || [];
    
    const noDuration = [];

    for (const song of songs) {
      const fileName = song.key.split('/')[1];
      const baseName = fileName.replace('.mp3', '');
      const meta = await getMetadata(this.env, baseName);
      
      if (!meta?.duration || meta.duration === 0) {
        noDuration.push({
          baseName,
          title: meta?.title || baseName,
          artist: meta?.primaryArtist || baseName.split('_')[0],
          size: song.size,
          // Estimate duration from file size (rough estimate: 1MB ≈ 1min at 128kbps)
          estimatedDuration: Math.round(song.size / (128 * 1000 / 8) / 60)
        });
      }
    }

    return noDuration;
  }

  // ===== 7. Artists with No Profile Image =====
  async findArtistsNoImage() {
    const artists = await getArtists(this.env);
    const noImage = [];

    for (const [id, artist] of Object.entries(artists)) {
      if (!artist.image) {
        noImage.push({
          id,
          name: artist.name,
          songCount: artist.songCount || 0,
          albumCount: artist.albumCount || 0
        });
      }
    }

    return noImage;
  }

  // ===== 8. Albums with No Thumbnail =====
  async findAlbumsNoThumbnail() {
    const albums = await getAlbums(this.env);
    const noThumbnail = [];

    for (const [id, album] of Object.entries(albums)) {
      if (!album.thumbnail && album.songs?.length > 0) {
        noThumbnail.push({
          id,
          title: album.title,
          artist: album.artists?.[0] || 'Unknown',
          songCount: album.songs.length
        });
      }
    }

    return noThumbnail;
  }

  // ===== UTILITY: Calculate Artist Completeness Score =====
  calculateCompletenessScore(artist) {
    let score = 0;
    const maxScore = 100;

    // Bio (40 points)
    if (artist.bio) {
      score += Math.min(40, artist.bio.length / 5);
    }

    // Social links (20 points)
    if (artist.website) score += 7;
    if (artist.twitter) score += 7;
    if (artist.instagram) score += 6;

    // Genre (20 points)
    if (artist.genre) score += 20;

    // Image (20 points)
    if (artist.image) score += 20;

    return Math.min(100, Math.round(score));
  }

  // ===== FIX FUNCTIONS =====

  async updateSongGenre(baseName, genre) {
    try {
      const meta = await getMetadata(this.env, baseName);
      const updatedMeta = { ...meta, genre };
      await this.env.media.put(`metadata/${baseName}.json`, JSON.stringify(updatedMeta, null, 2), {
        httpMetadata: { contentType: 'application/json' }
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateAlbumYear(albumId, year) {
    try {
      const albums = await getAlbums(this.env);
      if (albums[albumId]) {
        albums[albumId].release_year = year;
        await saveAlbums(this.env, albums);
        return { success: true };
      }
      return { success: false, error: 'Album not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addArtistBio(artistId, bio) {
    try {
      const artists = await getArtists(this.env);
      if (artists[artistId]) {
        artists[artistId].bio = bio;
        await saveArtists(this.env, artists);
        return { success: true };
      }
      return { success: false, error: 'Artist not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}