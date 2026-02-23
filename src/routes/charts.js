// ==================== CHARTS ROUTES ====================
import { incrementPageView } from '../helpers/pageViews.js';
import { getArtists } from '../helpers/storage.js';
import { 
  getTopAlbums, 
  getTopSongs, 
  getTopArtists, 
  getTopPlaylists, 
  getNewReleases 
} from '../helpers/charts.js';

import { 
  getAlbumThumbnailUrl,
  getSongThumbnailUrl,
  getArtistThumbnailUrl,
  getPlaylistThumbnailUrl
} from '../helpers/thumbnails.js';

import {
  generateAlbumChartItem,
  generateSongChartItem,
  generateArtistChartItem,
  generatePlaylistChartItem,
  generateNewReleaseAlbumItem,
  generateNewReleaseSongItem
} from '../helpers/renderers.js';

export async function handleCharts(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const subPath = path.replace("/charts", "") || "/";

  // Track chart page views
  let chartType = 'charts-overview';
  if (subPath === '/albums') chartType = 'charts-albums';
  else if (subPath === '/songs') chartType = 'charts-songs';
  else if (subPath === '/artists') chartType = 'charts-artists';
  else if (subPath === '/playlists') chartType = 'charts-playlists';
  else if (subPath === '/new-releases') chartType = 'charts-new-releases';
  
  ctx.waitUntil(incrementPageView(env, 'chart', chartType));
  
  let templateFile = "charts/index.html";
  let title = "Charts";
  let dataFunction = null;
  let renderFunction = null;
  
  if (subPath === "/" || subPath === "") {
    templateFile = "charts/index.html";
    title = "Charts Overview";
    dataFunction = async () => ({
      topAlbums: await getTopAlbums(env, 5),
      topSongs: await getTopSongs(env, 5),
      topArtists: await getTopArtists(env, 5),
      topPlaylists: await getTopPlaylists(env, 3),
      newReleases: await getNewReleases(env, 3)
    });
    renderFunction = renderChartsOverview;
  } else if (subPath === "/albums") {
    templateFile = "charts/albums.html";
    title = "Top Albums Chart";
    dataFunction = async () => ({ items: await getTopAlbums(env, 50) });
    renderFunction = renderAlbumsChart;
  } else if (subPath === "/songs") {
    templateFile = "charts/songs.html";
    title = "Top Songs Chart";
    dataFunction = async () => ({ items: await getTopSongs(env, 100) });
    renderFunction = renderSongsChart;
  } else if (subPath === "/artists") {
    templateFile = "charts/artists.html";
    title = "Top Artists Chart";
    dataFunction = async () => ({ items: await getTopArtists(env, 50) });
    renderFunction = renderArtistsChart;
  } else if (subPath === "/playlists") {
    templateFile = "charts/playlists.html";
    title = "Top Playlists Chart";
    dataFunction = async () => ({ items: await getTopPlaylists(env, 50) });
    renderFunction = renderPlaylistsChart;
  } else if (subPath === "/new-releases") {
    templateFile = "charts/new-releases.html";
    title = "New Releases";
    dataFunction = async () => ({ items: await getNewReleases(env, 50) });
    renderFunction = renderNewReleases;
  } else {
    return new Response("Chart page not found", { status: 404 });
  }

  const templateObj = await env.media.get(templateFile);
  if (!templateObj) {
    return new Response(`Template ${templateFile} not found in R2`, { status: 500 });
  }
  let html = await templateObj.text();

  const chartData = await dataFunction();
  html = await renderFunction(html, chartData, env);  // Pass env to renderer

  html = html.replace(/<title>.*?<\/title>/, `<title>${title} - ZEDALBUMS</title>`);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=300"
    }
  });
}

// Chart rendering functions - Pass env to all renderers
async function renderChartsOverview(html, data, env) {
  const artists = await getArtists(env);
  
  const albumsHtml = await Promise.all(data.topAlbums.map(async (item) => {
    let thumbUrl = await getAlbumThumbnailUrl(item, env);
    return generateAlbumChartItem(item, thumbUrl, artists, env, true);  // Pass env
  }));
  html = html.replace(/<!-- TOP_ALBUMS_START -->[\s\S]*?<!-- TOP_ALBUMS_END -->/, 
    `<!-- TOP_ALBUMS_START -->${albumsHtml.join('')}<!-- TOP_ALBUMS_END -->`);

  const songsHtml = await Promise.all(data.topSongs.map(async (item) => {
    let thumbUrl = await getSongThumbnailUrl(item.key, env);
    return generateSongChartItem(item, thumbUrl, artists, env, true);  // Pass env
  }));
  html = html.replace(/<!-- TOP_SONGS_START -->[\s\S]*?<!-- TOP_SONGS_END -->/, 
    `<!-- TOP_SONGS_START -->${songsHtml.join('')}<!-- TOP_SONGS_END -->`);

  const artistsHtml = await Promise.all(data.topArtists.map(async (item) => {
    let thumbUrl = await getArtistThumbnailUrl(item, env);
    return generateArtistChartItem(item, thumbUrl, env, true);  // Pass env
  }));
  html = html.replace(/<!-- TOP_ARTISTS_START -->[\s\S]*?<!-- TOP_ARTISTS_END -->/, 
    `<!-- TOP_ARTISTS_START -->${artistsHtml.join('')}<!-- TOP_ARTISTS_END -->`);

  const playlistsHtml = await Promise.all(data.topPlaylists.map(async (item) => {
    let thumbUrl = await getPlaylistThumbnailUrl(item, env);
    return generatePlaylistChartItem(item, thumbUrl, env, true);  // Pass env
  }));
  html = html.replace(/<!-- TOP_PLAYLISTS_START -->[\s\S]*?<!-- TOP_PLAYLISTS_END -->/, 
    `<!-- TOP_PLAYLISTS_START -->${playlistsHtml.join('')}<!-- TOP_PLAYLISTS_END -->`);

  const newReleasesHtml = await Promise.all(data.newReleases.map(async (item) => {
    if (item.type === 'album') {
      let thumbUrl = await getAlbumThumbnailUrl(item, env);
      return generateNewReleaseAlbumItem(item, thumbUrl, artists, env);  // Pass env
    } else {
      let thumbUrl = await getSongThumbnailUrl(item.id, env);
      return generateNewReleaseSongItem(item, thumbUrl, artists, env);  // Pass env
    }
  }));
  html = html.replace(/<!-- NEW_RELEASES_START -->[\s\S]*?<!-- NEW_RELEASES_END -->/, 
    `<!-- NEW_RELEASES_START -->${newReleasesHtml.join('')}<!-- NEW_RELEASES_END -->`);

  return html;
}

async function renderAlbumsChart(html, data, env) {
  const artists = await getArtists(env);
  const albumsHtml = await Promise.all(data.items.map(async (item) => {
    let thumbUrl = await getAlbumThumbnailUrl(item, env);
    return generateAlbumChartItem(item, thumbUrl, artists, env, false);  // Pass env
  }));
  return html.replace(/<!-- ITEMS_START -->[\s\S]*?<!-- ITEMS_END -->/, 
    `<!-- ITEMS_START -->${albumsHtml.join('')}<!-- ITEMS_END -->`);
}

async function renderSongsChart(html, data, env) {
  const artists = await getArtists(env);
  const songsHtml = await Promise.all(data.items.map(async (item) => {
    let thumbUrl = await getSongThumbnailUrl(item.key, env);
    return generateSongChartItem(item, thumbUrl, artists, env, false);  // Pass env
  }));
  return html.replace(/<!-- ITEMS_START -->[\s\S]*?<!-- ITEMS_END -->/, 
    `<!-- ITEMS_START -->${songsHtml.join('')}<!-- ITEMS_END -->`);
}

async function renderArtistsChart(html, data, env) {
  const artistsHtml = await Promise.all(data.items.map(async (item) => {
    let thumbUrl = await getArtistThumbnailUrl(item, env);
    return generateArtistChartItem(item, thumbUrl, env, false);  // Pass env
  }));
  return html.replace(/<!-- ITEMS_START -->[\s\S]*?<!-- ITEMS_END -->/, 
    `<!-- ITEMS_START -->${artistsHtml.join('')}<!-- ITEMS_END -->`);
}

async function renderPlaylistsChart(html, data, env) {
  const playlistsHtml = await Promise.all(data.items.map(async (item) => {
    let thumbUrl = await getPlaylistThumbnailUrl(item, env);
    return generatePlaylistChartItem(item, thumbUrl, env, false);  // Pass env
  }));
  return html.replace(/<!-- ITEMS_START -->[\s\S]*?<!-- ITEMS_END -->/, 
    `<!-- ITEMS_START -->${playlistsHtml.join('')}<!-- ITEMS_END -->`);
}

async function renderNewReleases(html, data, env) {
  const artists = await getArtists(env);
  const releasesHtml = await Promise.all(data.items.map(async (item) => {
    if (item.type === 'album') {
      let thumbUrl = await getAlbumThumbnailUrl(item, env);
      return generateNewReleaseAlbumItem(item, thumbUrl, artists, env);  // Pass env
    } else {
      let thumbUrl = await getSongThumbnailUrl(item.id, env);
      return generateNewReleaseSongItem(item, thumbUrl, artists, env);  // Pass env
    }
  }));
  return html.replace(/<!-- ITEMS_START -->[\s\S]*?<!-- ITEMS_END -->/, 
    `<!-- ITEMS_START -->${releasesHtml.join('')}<!-- ITEMS_END -->`);
}