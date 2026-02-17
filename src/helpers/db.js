// ==================== D1 DATABASE FUNCTIONS ====================
// Handles all database operations for stats

export async function incrementPlay(songKey, env) {
  await env.DB.prepare(
    `INSERT INTO song_stats (song_key, plays, downloads, last_played)
     VALUES (?, 1, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(song_key) DO UPDATE SET 
       plays = plays + 1,
       last_played = CURRENT_TIMESTAMP`
  ).bind(songKey).run();
}

export async function incrementDownload(songKey, env) {
  await env.DB.prepare(
    `INSERT INTO song_stats (song_key, plays, downloads, last_downloaded, last_downloaded_date)
     VALUES (?, 0, 1, CURRENT_TIMESTAMP, date('now'))
     ON CONFLICT(song_key) DO UPDATE SET 
       downloads = downloads + 1,
       last_downloaded = CURRENT_TIMESTAMP,
       last_downloaded_date = date('now')`  // This line fixes it!
  ).bind(songKey).run();
}

export async function getSongStats(songKey, env) {
  const { results } = await env.DB.prepare(
    `SELECT plays, downloads FROM song_stats WHERE song_key = ?`
  ).bind(songKey).all();
  return results[0] || { plays: 0, downloads: 0 };
}

export async function getAggregatedStats(songKeys, env) {
  if (songKeys.length === 0) return { plays: 0, downloads: 0 };
  const placeholders = songKeys.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT SUM(plays) as total_plays, SUM(downloads) as total_downloads
     FROM song_stats
     WHERE song_key IN (${placeholders})`
  ).bind(...songKeys).all();
  return {
    plays: results[0]?.total_plays || 0,
    downloads: results[0]?.total_downloads || 0
  };
}