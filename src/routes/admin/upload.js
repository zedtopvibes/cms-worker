// ==================== UPLOAD POST HANDLER WITH ID3 TAGGING ====================

export async function handleAdminUploadPost(req, env, ctx, auth) {
  try {
    const formData = await req.formData();
    const title = formData.get('title');
    const artist = formData.get('artist');
    const description = formData.get('description');
    const audioFile = formData.get('audio');
    const imageFile = formData.get('image');
    const albumId = formData.get('album');
    const playlistId = formData.get('playlist');
    const featuredJson = formData.get('featured');
    const browserDuration = formData.get('duration');
    const genreInput = formData.get('genre');

    if (!title || !audioFile || !imageFile) {
      return { success: false, error: 'Missing required fields' };
    }

    // Parse featured artists
    let featuredArtists = [];
    try {
      featuredArtists = featuredJson ? JSON.parse(featuredJson) : [];
    } catch (e) {
      console.error('Error parsing featured artists:', e);
    }

    // Process genre
    let genre = null;
    if (genreInput) {
      if (genreInput.startsWith('new_')) {
        const genreData = JSON.parse(genreInput.replace('new_', ''));
        const genreManager = new GenreManager(env);
        await genreManager.addGenre(genreData);
        genre = genreData.id;
      } else {
        genre = genreInput;
      }
    }

    // Process any new featured artists
    const processedFeatured = [];
    for (const feat of featuredArtists) {
      if (feat.startsWith('new_')) {
        const newArtistName = feat.replace('new_', '');
        const newArtistId = sanitize(newArtistName);
        
        const artists = await getArtists(env);
        if (!artists[newArtistId]) {
          artists[newArtistId] = {
            id: newArtistId,
            name: newArtistName,
            description: '',
            thumbnail: '',
            created: Date.now(),
            songs: [],
            albums: []
          };
          await saveArtists(env, artists);
        }
        processedFeatured.push(newArtistId);
      } else {
        processedFeatured.push(feat);
      }
    }

    let artistName = artist;
    let artistId = artist;

    // Process new primary artist
    if (artist && artist.startsWith('new_')) {
      artistName = artist.replace('new_', '');
      artistId = sanitize(artistName);
      const artists = await getArtists(env);
      if (!artists[artistId]) {
        artists[artistId] = {
          id: artistId,
          name: artistName,
          description: '',
          thumbnail: '',
          created: Date.now(),
          songs: [],
          albums: []
        };
        await saveArtists(env, artists);
      }
    }

    const safeTitle = sanitize(title);
    const safeArtist = sanitize(artistName);
    const baseName = `${safeArtist}_${safeTitle}`;

    const audioKey = `songs/${baseName}.mp3`;
    const descKey = `descriptions/${baseName}.txt`;
    const imgType = imageFile.type.includes('png') ? 'png' : 'jpg';
    const imageKey = `images/${baseName}.${imgType}`;

    const audioBuffer = await audioFile.arrayBuffer();

    let duration;
    if (browserDuration && browserDuration !== '0' && browserDuration !== '0.000') {
      duration = parseFloat(browserDuration);
    } else {
      duration = fallbackDurationParser(audioBuffer);
    }

    // ===== ID3 TAGGING SECTION =====
    const SITENAME = "ZEDALBUMS"; // Your site name for branding
    
    // Construct artist string for ID3 tag
    let id3ArtistString = artistName;
    if (processedFeatured.length > 0) {
      // Get featured artist names
      const artists = await getArtists(env);
      const featuredNames = processedFeatured.map(fid => artists[fid]?.name || fid).join(', ');
      id3ArtistString = `${artistName} feat. ${featuredNames}`;
    }
    
    // Add site name to artist and title (as per ID3 script)
    const taggedTitle = `${title} (${SITENAME})`;
    const taggedArtist = `${id3ArtistString} | ${SITENAME}`;
    
    // Convert duration to milliseconds for ID3 tag
    const durationMs = Math.floor(duration * 1000);
    
    // Run through ID3 tagger
    const taggedMp3 = addID3Tags(audioBuffer, {
      title: taggedTitle,
      artist: taggedArtist,
      duration: durationMs
    });
    
    // Generate filename with site name
    const finalFilename = `${title} - ${artistName} (${SITENAME}).mp3`;
    
    // Store the TAGGED file (overwrites the original upload)
    await env.media.put(audioKey, taggedMp3, {
      httpMetadata: { 
        contentType: 'audio/mpeg',
        contentDisposition: `inline; filename="${finalFilename}"`
      }
    });
    // ===== END ID3 TAGGING =====

    // Store image and description (unchanged)
    await env.media.put(imageKey, imageFile.stream());
    await env.media.put(descKey, description);

    // Generate slug from title
    const slugManager = new SlugManager(env);
    const slug = slugManager.generateSongSlug(title);
    
    // Register slug with metadata
    await slugManager.registerSlug('songs', baseName, slug, {
      title,
      artist: artistId,
      artistName,
      duration,
      genre
    });

    // Store metadata
    const metadata = {
      title,
      primaryArtist: artistId,
      featuredArtists: processedFeatured,
      description,
      duration,
      genre,
      slug,
      filename: finalFilename // Store the branded filename
    };
    await saveMetadata(env, baseName, metadata);

    // Handle album associations
    if (albumId && albumId !== '' && albumId !== '__create_new__') {
      await addSongToAlbum(env, albumId, baseName);
      await addAlbumToArtist(env, artistId, albumId);
      await addArtistToAlbum(env, artistId, albumId);
    }

    // Handle playlist associations
    if (playlistId && playlistId !== '' && playlistId !== '__create_new__') {
      await addSongToPlaylist(env, playlistId, baseName);
    }

    // Add to artist song lists
    await addSongToArtist(env, artistId, baseName);
    for (const fid of processedFeatured) {
      await addSongToArtist(env, fid, baseName);
    }

    // Log admin activity
    await logAdminActivity(env, auth.session.id, 'upload', 'song', baseName, title);

    return {
      success: true,
      baseName,
      title,
      artistName,
      duration,
      albumId,
      playlistId,
      slug,
      filename: finalFilename
    };
    
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// ===== ID3 TAGGING FUNCTIONS =====
function addID3Tags(audioBuffer, tags) {
  const audioBytes = new Uint8Array(audioBuffer);
  const frames = [];
  
  // Add text frames
  if (tags.artist) frames.push(createTextFrame('TPE1', tags.artist));
  if (tags.title) frames.push(createTextFrame('TIT2', tags.title));
  if (tags.duration) frames.push(createTextFrame('TLEN', tags.duration.toString()));
  
  // Calculate total frames size
  const framesSize = frames.reduce((acc, f) => acc + f.length, 0);
  
  // Create ID3 header (10 bytes)
  const header = new Uint8Array(10);
  header.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00], 0); // ID3v2.3.0
  header.set(encodeSynchsafe(framesSize), 6);
  
  // Combine header + frames + original audio
  const final = new Uint8Array(10 + framesSize + audioBytes.length);
  final.set(header, 0);
  
  let offset = 10;
  for (const f of frames) {
    final.set(f, offset);
    offset += f.length;
  }
  
  final.set(audioBytes, offset);
  
  return final;
}

function createTextFrame(type, value) {
  const enc = new TextEncoder().encode(value);
  const frame = new Uint8Array(10 + 1 + enc.length);
  
  // Frame header (10 bytes)
  frame.set(new TextEncoder().encode(type), 0);
  const size = 1 + enc.length;
  frame[4] = (size >> 24) & 0xFF;
  frame[5] = (size >> 16) & 0xFF;
  frame[6] = (size >> 8) & 0xFF;
  frame[7] = size & 0xFF;
  
  // Encoding byte (0x00 = ISO-8859-1)
  frame[10] = 0x00;
  
  // Frame content
  frame.set(enc, 11);
  
  return frame;
}

function encodeSynchsafe(size) {
  return [
    (size >> 21) & 0x7F,
    (size >> 14) & 0x7F,
    (size >> 7) & 0x7F,
    size & 0x7F
  ];
}