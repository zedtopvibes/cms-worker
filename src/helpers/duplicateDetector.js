// src/helpers/duplicateDetector.js
import { getArtists, getAlbums, getPlaylists, getMetadata, saveArtists, saveAlbums, savePlaylists } from './storage.js';
import { logAdminActivity } from './dashboardStats.js';
import { moveToTrash } from './trash.js';

export class DuplicateDetector {
  constructor(env) {
    this.env = env;
  }

  // ==================== ARTIST DUPLICATE DETECTION ====================

  async findDuplicateArtists(options = {}) {
    const {
      threshold = 0.85,
      includeDeleted = false,
      checkNameVariations = true
    } = options;

    const artists = await getArtists(this.env);
    const artistsList = Object.entries(artists).map(([id, artist]) => ({
      id,
      name: artist.name,
      bio: artist.bio || '',
      image: artist.image,
      songCount: artist.songCount || 0,
      albumCount: artist.albumCount || 0,
      created: artist.created
    }));

    const duplicates = [];
    const processed = new Set();

    // Common name variations
    const variations = {
      '&': ['and', 'n'],
      'feat.': ['featuring', 'ft.', 'ft'],
      'vs.': ['versus', 'vs'],
      'pres.': ['presents', 'present'],
      'the': [''],
      'dj': ['deejay'],
      'mc': ['emcee'],
      'dr.': ['doctor', 'dr'],
      'mr.': ['mister', 'mr']
    };

    for (let i = 0; i < artistsList.length; i++) {
      if (processed.has(artistsList[i].id)) continue;

      const artist = artistsList[i];
      const matches = [];

      for (let j = i + 1; j < artistsList.length; j++) {
        if (processed.has(artistsList[j].id)) continue;

        const other = artistsList[j];
        
        // Direct name similarity
        let score = this.calculateSimilarity(artist.name, other.name);
        const reasons = [{ factor: 'name', score }];

        // Check name variations
        if (checkNameVariations && score < threshold) {
          const normalizedName = this.normalizeArtistName(artist.name, variations);
          const normalizedOther = this.normalizeArtistName(other.name, variations);
          
          if (normalizedName !== artist.name || normalizedOther !== other.name) {
            const variationScore = this.calculateSimilarity(normalizedName, normalizedOther);
            if (variationScore > score) {
              score = variationScore;
              reasons.push({ factor: 'normalized', score: variationScore });
            }
          }
        }

        if (score >= threshold) {
          matches.push({
            ...other,
            similarityScore: score,
            reasons: reasons.filter(r => r.score < 1)
          });
        }
      }

      if (matches.length > 0) {
        duplicates.push({
          primary: artist,
          duplicates: matches.sort((a, b) => b.similarityScore - a.similarityScore)
        });
        matches.forEach(m => processed.add(m.id));
      }
      processed.add(artist.id);
    }

    return duplicates;
  }

  // ==================== ALBUM DUPLICATE DETECTION ====================

  async findDuplicateAlbums(options = {}) {
    const {
      threshold = 0.8,
      includeDeleted = false,
      sameArtist = true
    } = options;

    const albums = await getAlbums(this.env);
    const artists = await getArtists(this.env);
    
    const albumsList = await Promise.all(
      Object.entries(albums).map(async ([id, album]) => {
        // Get artist names
        const artistNames = album.artists?.map(aid => artists[aid]?.name || aid).join(', ') || 'Various';
        const primaryArtist = album.artists?.[0] ? artists[album.artists[0]]?.name || album.artists[0] : 'Various';
        
        return {
          id,
          title: album.title,
          description: album.description || '',
          thumbnail: album.thumbnail,
          primaryArtist,
          artistNames,
          artists: album.artists || [],
          songs: album.songs || [],
          songCount: album.songs?.length || 0,
          created: album.created
        };
      })
    );

    const duplicates = [];
    const processed = new Set();

    for (let i = 0; i < albumsList.length; i++) {
      if (processed.has(albumsList[i].id)) continue;

      const album = albumsList[i];
      const matches = [];

      for (let j = i + 1; j < albumsList.length; j++) {
        if (processed.has(albumsList[j].id)) continue;

        const other = albumsList[j];
        
        // Title similarity
        const titleScore = this.calculateSimilarity(album.title, other.title);
        if (titleScore < 0.5) continue;
        
        let score = titleScore * 0.5;
        const reasons = [{ factor: 'title', score: titleScore }];

        // Artist match
        if (sameArtist) {
          // Check if they share at least one artist
          const commonArtists = album.artists.filter(aid => other.artists.includes(aid));
          let artistScore = 0;
          
          if (commonArtists.length > 0) {
            artistScore = 0.8 + (commonArtists.length * 0.1);
          } else {
            // Compare artist names
            const artistSim = this.calculateSimilarity(album.artistNames, other.artistNames);
            artistScore = artistSim * 0.5;
          }
          
          score += artistScore * 0.3;
          reasons.push({ factor: 'artist', score: artistScore });
        }

        // Track count similarity
        if (album.songCount > 0 && other.songCount > 0) {
          const trackDiff = Math.abs(album.songCount - other.songCount);
          const trackScore = Math.max(0, 1 - (trackDiff / Math.max(album.songCount, other.songCount)));
          score += trackScore * 0.2;
          reasons.push({ factor: 'tracks', score: trackScore });
        }

        if (score >= threshold) {
          matches.push({
            ...other,
            similarityScore: score,
            reasons: reasons.filter(r => r.score < 1)
          });
        }
      }

      if (matches.length > 0) {
        duplicates.push({
          primary: album,
          duplicates: matches.sort((a, b) => b.similarityScore - a.similarityScore)
        });
        matches.forEach(m => processed.add(m.id));
      }
      processed.add(album.id);
    }

    return duplicates;
  }

  // ==================== PLAYLIST DUPLICATE DETECTION ====================

  async findDuplicatePlaylists(options = {}) {
    const {
      threshold = 0.75,
      includeDeleted = false,
      minSongOverlap = 0.5
    } = options;

    const playlists = await getPlaylists(this.env);
    
    const playlistsList = Object.entries(playlists).map(([id, playlist]) => ({
      id,
      title: playlist.title,
      description: playlist.description || '',
      curator: playlist.curator || 'ZEDALBUMS',
      thumbnail: playlist.thumbnail,
      songs: playlist.songs || [],
      songCount: playlist.songs?.length || 0,
      created: playlist.created,
      updated: playlist.updated
    }));

    const duplicates = [];
    const processed = new Set();

    for (let i = 0; i < playlistsList.length; i++) {
      if (processed.has(playlistsList[i].id)) continue;

      const playlist = playlistsList[i];
      const matches = [];

      for (let j = i + 1; j < playlistsList.length; j++) {
        if (processed.has(playlistsList[j].id)) continue;

        const other = playlistsList[j];
        
        // Title similarity
        const titleScore = this.calculateSimilarity(playlist.title, other.title);
        if (titleScore < 0.5) continue;
        
        let score = titleScore * 0.3;
        const reasons = [{ factor: 'title', score: titleScore }];

        // Song overlap
        if (playlist.songCount > 0 && other.songCount > 0) {
          const overlap = this.calculatePlaylistOverlap(playlist.songs, other.songs);
          
          if (overlap >= minSongOverlap) {
            score += overlap * 0.7;
            reasons.push({ factor: 'songs', score: overlap });
          }
        }

        // Curator similarity
        if (playlist.curator && other.curator) {
          const curatorScore = this.calculateSimilarity(playlist.curator, other.curator);
          score = (score + curatorScore) / 2;
          reasons.push({ factor: 'curator', score: curatorScore });
        }

        if (score >= threshold) {
          matches.push({
            ...other,
            similarityScore: score,
            reasons: reasons.filter(r => r.score < 1)
          });
        }
      }

      if (matches.length > 0) {
        duplicates.push({
          primary: playlist,
          duplicates: matches.sort((a, b) => b.similarityScore - a.similarityScore)
        });
        matches.forEach(m => processed.add(m.id));
      }
      processed.add(playlist.id);
    }

    return duplicates;
  }

  // ==================== SONG DUPLICATE DETECTION ====================

  async findDuplicateSongs(options = {}) {
    const {
      threshold = 0.85,
      includeDeleted = false,
      sameArtist = true,
      checkDuration = true,
      durationTolerance = 5 // seconds
    } = options;

    // Get all songs from R2
    const songList = await this.env.media.list({ prefix: "songs/" });
    const songs = songList.objects || [];
    const artists = await getArtists(this.env);
    const albums = await getAlbums(this.env);
    
    const songsList = await Promise.all(
      songs.map(async (song) => {
        const fileName = song.key.split('/')[1];
        const baseName = fileName.replace('.mp3', '');
        const meta = await getMetadata(this.env, baseName);
        const [artistId] = baseName.split('_');
        
        // Find album
        let albumInfo = null;
        for (const [id, album] of Object.entries(albums)) {
          if (album.songs?.includes(baseName)) {
            albumInfo = { id, title: album.title };
            break;
          }
        }

        return {
          id: baseName,
          title: meta?.title || baseName.split('_').slice(1).join(' '),
          artistId: meta?.primaryArtist || artistId,
          artistName: artists[meta?.primaryArtist || artistId]?.name || meta?.primaryArtist || artistId,
          featuredArtists: meta?.featuredArtists || [],
          album: albumInfo,
          duration: meta?.duration || 0,
          created: song.uploaded
        };
      })
    );

    const duplicates = [];
    const processed = new Set();

    for (let i = 0; i < songsList.length; i++) {
      if (processed.has(songsList[i].id)) continue;

      const song = songsList[i];
      const matches = [];

      for (let j = i + 1; j < songsList.length; j++) {
        if (processed.has(songsList[j].id)) continue;

        const other = songsList[j];
        
        // Title similarity
        const titleScore = this.calculateSimilarity(song.title, other.title);
        if (titleScore < 0.5) continue;
        
        let score = titleScore * 0.5;
        const reasons = [{ factor: 'title', score: titleScore }];

        // Artist match
        if (sameArtist) {
          let artistScore = 0;
          if (song.artistId === other.artistId) {
            artistScore = 1;
          } else {
            artistScore = this.calculateSimilarity(song.artistName, other.artistName);
          }
          score += artistScore * 0.3;
          reasons.push({ factor: 'artist', score: artistScore });
        }

        // Duration check
        if (checkDuration && song.duration > 0 && other.duration > 0) {
          const durationDiff = Math.abs(song.duration - other.duration);
          const durationScore = Math.max(0, 1 - (durationDiff / durationTolerance));
          score += durationScore * 0.2;
          reasons.push({ factor: 'duration', score: durationScore });
        }

        if (score >= threshold) {
          matches.push({
            ...other,
            similarityScore: score,
            reasons: reasons.filter(r => r.score < 1)
          });
        }
      }

      if (matches.length > 0) {
        duplicates.push({
          primary: song,
          duplicates: matches.sort((a, b) => b.similarityScore - a.similarityScore)
        });
        matches.forEach(m => processed.add(m.id));
      }
      processed.add(song.id);
    }

    return duplicates;
  }

  // ==================== UTILITY METHODS ====================

  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    str1 = str1.toLowerCase().trim();
    str2 = str2.toLowerCase().trim();
    
    if (str1 === str2) return 1;
    
    // Remove common words
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    const words1 = str1.split(/\s+/).filter(w => !commonWords.includes(w));
    const words2 = str2.split(/\s+/).filter(w => !commonWords.includes(w));
    
    if (words1.length === 0 || words2.length === 0) {
      // Fall back to character-based similarity
      return this.charSimilarity(str1, str2);
    }
    
    // Jaccard similarity
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  charSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;
    
    // Simple character-based similarity
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return matches / maxLen;
  }

  normalizeArtistName(name, variations) {
    let normalized = name.toLowerCase().trim();
    
    // Apply variations
    for (const [pattern, replacements] of Object.entries(variations)) {
      for (const replacement of replacements) {
        normalized = normalized.replace(
          new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          replacement
        );
      }
    }
    
    // Remove parenthetical content
    normalized = normalized.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    normalized = normalized.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
    
    // Remove extra spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }

  calculatePlaylistOverlap(songs1, songs2) {
    if (!songs1 || !songs2 || songs1.length === 0 || songs2.length === 0) return 0;
    
    const set1 = new Set(songs1);
    const set2 = new Set(songs2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  // ==================== STATISTICS ====================

  async getDuplicateStats() {
    try {
      const [artists, albums, playlists, songs] = await Promise.all([
        this.findDuplicateArtists({ threshold: 0.85 }).catch(() => []),
        this.findDuplicateAlbums({ threshold: 0.8 }).catch(() => []),
        this.findDuplicatePlaylists({ threshold: 0.75 }).catch(() => []),
        this.findDuplicateSongs({ threshold: 0.85 }).catch(() => [])
      ]);

      return {
        total: {
          artists: artists.length,
          albums: albums.length,
          playlists: playlists.length,
          songs: songs.length
        },
        items: {
          artists: artists.reduce((sum, g) => sum + g.duplicates.length, 0),
          albums: albums.reduce((sum, g) => sum + g.duplicates.length, 0),
          playlists: playlists.reduce((sum, g) => sum + g.duplicates.length, 0),
          songs: songs.reduce((sum, g) => sum + g.duplicates.length, 0)
        }
      };
    } catch (error) {
      console.error('Error getting duplicate stats:', error);
      return {
        total: { artists: 0, albums: 0, playlists: 0, songs: 0 },
        items: { artists: 0, albums: 0, playlists: 0, songs: 0 }
      };
    }
  }
}