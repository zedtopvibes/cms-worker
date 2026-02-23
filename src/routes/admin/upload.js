// ===== POST HANDLER WITH SLUG GENERATION =====
export async function handleAdminUploadPost(req, env, ctx, auth) {
  try {
    const formData = await req.formData();
    const rawTitle = formData.get('title');           // Use raw for display
    const rawArtist = formData.get('artist');         // Use raw for display
    const description = formData.get('description');
    const audioFile = formData.get('audio');
    const imageFile = formData.get('image');
    const albumId = formData.get('album');
    const playlistId = formData.get('playlist');
    const featuredJson = formData.get('featured');
    const browserDuration = formData.get('duration');
    const genreInput = formData.get('genre');

    if (!rawTitle || !audioFile || !imageFile) {
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

    let artistName = rawArtist;        // Keep raw for display
    let artistId = rawArtist;

    // Process new primary artist
    if (rawArtist && rawArtist.startsWith('new_')) {
      artistName = rawArtist.replace('new_', '');  // Keep raw for display
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

    // SANITIZED VERSIONS - for internal storage only
    const safeTitle = sanitize(rawTitle);
    const safeArtist = sanitize(artistName);
    const baseName = `${safeArtist}_${safeTitle}`;

    // R2 storage keys (use sanitized versions for filesystem safety)
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

    // ===== ID3 TAGGING SECTION - USING RAW VALUES =====
    const SITENAME = "ZEDALBUMS";
    
    // Primary artist ONLY for ID3 artist field (no featured artists)
    const primaryArtistOnly = artistName;  // Raw artist name
    
    // Full title with featured artists for display (already includes "ft. Rihanna" etc.)
    const fullTitleWithFeatured = rawTitle;  // Raw title
    
    // ID3 Tags - Clean separation with RAW values (no underscores)
    const taggedTitle = `${fullTitleWithFeatured} (${SITENAME})`;  // Title with featured artists
    const taggedArtist = `${primaryArtistOnly} | ${SITENAME}`;     // Primary artist only
    
    // Convert duration to milliseconds for ID3 tag
    const durationMs = Math.floor(duration * 1000);
    
    // Run through ID3 tagger
    const taggedMp3 = addID3Tags(audioBuffer, {
      title: taggedTitle,
      artist: taggedArtist,
      duration: durationMs
    });
    
    // Generate filename with site name - Using RAW values (no underscores)
    const finalFilename = `${rawTitle} (${SITENAME}).mp3`;
    
    // Store the TAGGED file
    await env.media.put(audioKey, taggedMp3, {
      httpMetadata: { 
        contentType: 'audio/mpeg',
        contentDisposition: `inline; filename="${finalFilename}"`  // Raw filename for download
      }
    });

    // Store image and description
    await env.media.put(imageKey, imageFile.stream());
    await env.media.put(descKey, description);

    // ===== SLUG GENERATION AND REGISTRATION =====
    const slugManager = new SlugManager(env);
    
    // Generate clean slug from title ONLY (using raw title)
    const baseSlug = slugManager.generateSongSlug(rawTitle, ''); // Empty artist to prevent duplication
    
    // Ensure uniqueness
    const finalSlug = await slugManager.generateUniqueSlug('songs', baseSlug);
    
    // Register in database
    await slugManager.registerSlug('songs', baseName, finalSlug, {
      title: rawTitle,  // Store raw title in metadata
      artist: artistId,
      artistName: artistName,  // Store raw artist name
      duration,
      genre,
      featured: processedFeatured,
      uploadedAt: Date.now()
    });

    // Store metadata (using raw values for display)
    const metadata = {
      title: rawTitle,
      primaryArtist: artistId,
      featuredArtists: processedFeatured,
      description,
      duration,
      genre,
      filename: finalFilename  // Raw filename for display
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
    await logAdminActivity(env, auth.session.id, 'upload', 'song', baseName, rawTitle);

    return {
      success: true,
      baseName,
      slug: finalSlug,
      title: rawTitle,           // Return raw title
      artistName: artistName,    // Return raw artist name
      duration,
      albumId,
      playlistId,
      filename: finalFilename    // Raw filename
    };
    
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}