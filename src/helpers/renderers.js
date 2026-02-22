// ==================== HTML RENDERER FUNCTIONS ====================
// Functions for generating HTML for charts and lists

import { formatNumber } from './formatting.js';

export function generateAlbumChartItem(album, thumbUrl, artists, isPreview = false) {
  const primaryArtist = (album.artists?.length && artists[album.artists[0]]) 
    ? artists[album.artists[0]].name 
    : "Various";
  
  const rankClass = album.rank === 1 ? 'top1' : (album.rank === 2 ? 'silver' : (album.rank === 3 ? 'bronze' : ''));
  const trendIcon = album.rankChange > 0 ? 'arrow-up' : (album.rankChange < 0 ? 'arrow-down' : 'minus');
  const trendColor = album.rankChange > 0 ? '#27ae60' : (album.rankChange < 0 ? '#e74c3c' : '#999');
  
  // Use ID only - slug removed
  const albumUrl = `/album/${album.id}`;
  
  return `
    <div class="album-item" onclick="window.location='${albumUrl}'">
      <div class="album-thumbnail">
        <div class="rank-overlay ${rankClass}">${album.rank}</div>
        <img src="${thumbUrl}" alt="${album.title}" loading="lazy">
      </div>
      <div class="album-info">
        <span class="album-title">${album.title}</span>
        <div class="album-meta">
          <span class="album-artist">${primaryArtist}</span>
          <span class="album-tracks">${album.songs?.length || 0} Tracks</span>
          <span class="download-badge"><i class="fas fa-download"></i> ${formatNumber(album.totalDownloads)}</span>
        </div>
        ${!isPreview ? `
        <div class="album-meta">
          <span class="rank-change"><i class="fas fa-${trendIcon}" style="color: ${trendColor}"></i> ${Math.abs(album.rankChange)} from last week</span>
          <span class="peak-rank">Peak: #${album.peakRank}</span>
        </div>
        ` : ''}
        <span class="album-date">Released: ${new Date(album.created).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </div>
    </div>
  `;
}

export function generateSongChartItem(song, thumbUrl, artists, isPreview = false) {
  const primaryArtistName = artists[song.primaryArtist]?.name || song.primaryArtist;
  const rankClass = song.rank === 1 ? 'top1' : (song.rank === 2 ? 'silver' : (song.rank === 3 ? 'bronze' : ''));
  const trendIcon = song.rankChange > 0 ? 'arrow-up' : (song.rankChange < 0 ? 'arrow-down' : 'minus');
  const trendColor = song.rankChange > 0 ? '#27ae60' : (song.rankChange < 0 ? '#e74c3c' : '#999');
  
  // Use fileName only - slug removed
  const songUrl = `/song/${encodeURIComponent(song.fileName)}`;
  
  return `
    <div class="album-item" onclick="window.location='${songUrl}'">
      <div class="album-thumbnail">
        <div class="rank-overlay ${rankClass}">${song.rank}</div>
        <img src="${thumbUrl}" alt="${song.title}" loading="lazy">
        <div class="play-btn-mini"><i class="fas fa-play"></i></div>
      </div>
      <div class="album-info">
        <span class="album-title">${song.title}</span>
        <div class="album-meta">
          <span class="album-artist">${primaryArtistName}</span>
          ${song.album ? `<span class="from-album">from "${song.album.title}"</span>` : ''}
        </div>
        <div class="album-meta">
          <span class="play-badge"><i class="fas fa-play"></i> ${formatNumber(song.plays)}</span>
          <span class="download-badge"><i class="fas fa-download"></i> ${formatNumber(song.downloads)}</span>
        </div>
        ${!isPreview ? `
        <div class="album-meta">
          <span class="rank-change"><i class="fas fa-${trendIcon}" style="color: ${trendColor}"></i> ${Math.abs(song.rankChange)} from last week</span>
          <span class="peak-rank">Peak: #${song.peakRank}</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

export function generateArtistChartItem(artist, thumbUrl, isPreview = false) {
  const rankClass = artist.rank === 1 ? 'top1' : (artist.rank === 2 ? 'silver' : (artist.rank === 3 ? 'bronze' : ''));
  const trendIcon = artist.rankChange > 0 ? 'arrow-up' : (artist.rankChange < 0 ? 'arrow-down' : 'minus');
  const trendColor = artist.rankChange > 0 ? '#27ae60' : (artist.rankChange < 0 ? '#e74c3c' : '#999');
  
  // Use ID only - slug removed
  const artistUrl = `/artist/${artist.id}`;
  
  return `
    <div class="album-item" onclick="window.location='${artistUrl}'">
      <div class="album-thumbnail artist-thumbnail">
        <div class="rank-overlay ${rankClass}">${artist.rank}</div>
        ${thumbUrl !== "/images/placeholder.jpg" ? `<img src="${thumbUrl}" alt="${artist.name}" loading="lazy">` : ''}
      </div>
      <div class="album-info">
        <span class="album-title">${artist.name}</span>
        <div class="artist-stats">
          <span class="play-badge"><i class="fas fa-play"></i> ${formatNumber(artist.monthlyListeners)} monthly listeners</span>
          <span class="monthly-listeners">${artist.albumCount} albums</span>
          <span class="monthly-listeners">${artist.songCount} songs</span>
        </div>
        ${!isPreview ? `
        <div class="album-meta">
          <span class="rank-change"><i class="fas fa-${trendIcon}" style="color: ${trendColor}"></i> ${Math.abs(artist.rankChange)} from last week</span>
          <span class="peak-rank">Peak: #${artist.peakRank}</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

export function generatePlaylistChartItem(playlist, thumbUrl, isPreview = false) {
  const rankClass = playlist.rank === 1 ? 'top1' : (playlist.rank === 2 ? 'silver' : (playlist.rank === 3 ? 'bronze' : ''));
  const trendIcon = playlist.rankChange > 0 ? 'arrow-up' : (playlist.rankChange < 0 ? 'arrow-down' : 'minus');
  const trendColor = playlist.rankChange > 0 ? '#27ae60' : (playlist.rankChange < 0 ? '#e74c3c' : '#999');
  const date = new Date(playlist.updated || playlist.created);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  const timeAgo = diffDays === 0 ? 'Today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  
  // Use ID only - slug removed
  const playlistUrl = `/playlist/${playlist.id}`;
  
  return `
    <div class="album-item" onclick="window.location='${playlistUrl}'">
      <div class="album-thumbnail playlist-thumbnail">
        <div class="rank-overlay ${rankClass}">${playlist.rank}</div>
        ${thumbUrl !== "/images/placeholder.jpg" ? `<img src="${thumbUrl}" alt="${playlist.title}" loading="lazy">` : ''}
      </div>
      <div class="album-info">
        <span class="album-title">${playlist.title}</span>
        <div class="playlist-stats">
          <span class="playlist-badge"><i class="fas fa-list"></i> ${playlist.songCount} songs</span>
          <span class="download-badge"><i class="fas fa-download"></i> ${formatNumber(playlist.totalDownloads)} downloads</span>
        </div>
        <div class="album-meta">
          <span class="curator-info"><i class="fas fa-user"></i> Curated by ${playlist.curator || 'ZEDALBUMS'}</span>
          <span class="album-date">Updated: ${timeAgo}</span>
        </div>
        ${!isPreview ? `
        <div class="album-meta">
          <span class="rank-change"><i class="fas fa-${trendIcon}" style="color: ${trendColor}"></i> ${Math.abs(playlist.rankChange)} from last week</span>
          <span class="peak-rank">Peak: #${playlist.peakRank}</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

export function generateNewReleaseAlbumItem(album, thumbUrl, artists) {
  const primaryArtist = (album.artists?.length && artists[album.artists[0]]) 
    ? artists[album.artists[0]].name 
    : "Various";
  const date = new Date(album.created);
  const now = new Date();
  const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
  const timeAgo = diffHours < 24 
    ? `${diffHours} hours ago` 
    : `${Math.floor(diffHours / 24)} days ago`;
  
  // Use ID only - slug removed
  const albumUrl = `/album/${album.id}`;
  
  return `
    <div class="album-item" onclick="window.location='${albumUrl}'">
      <div class="album-thumbnail">
        <img src="${thumbUrl}" alt="${album.title}" loading="lazy">
      </div>
      <div class="album-info">
        <span class="album-title">${album.title} <span class="new-badge">NEW</span></span>
        <div class="album-meta">
          <span class="album-artist">${primaryArtist}</span>
          <span class="album-tracks">${album.songs?.length || 0} Tracks</span>
          <span class="album-genre">Album</span>
        </div>
        <span class="album-date">Released: ${timeAgo}</span>
      </div>
    </div>
  `;
}

export function generateNewReleaseSongItem(song, thumbUrl, artists) {
  const primaryArtistName = artists[song.artistId]?.name || song.artistId;
  const date = new Date(song.created);
  const now = new Date();
  const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
  const timeAgo = diffHours < 24 
    ? `${diffHours} hours ago` 
    : `${Math.floor(diffHours / 24)} days ago`;
  
  // FIXED: Removed .mp3 extension
  const songUrl = `/song/${encodeURIComponent(song.id)}`;
  
  return `
    <div class="album-item" onclick="window.location='${songUrl}'">
      <div class="album-thumbnail">
        <img src="${thumbUrl}" alt="${song.title}" loading="lazy">
        <div class="play-btn-mini"><i class="fas fa-play"></i></div>
      </div>
      <div class="album-info">
        <span class="album-title">${song.title} <span class="new-badge">SINGLE</span></span>
        <div class="album-meta">
          <span class="album-artist">${primaryArtistName}</span>
          <span class="album-genre">Single</span>
        </div>
        <span class="album-date">Released: ${timeAgo}</span>
      </div>
    </div>
  `;
}