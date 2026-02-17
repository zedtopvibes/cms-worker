// ==================== TEST STATS FUNCTIONS ====================
// Run this to verify everything is working

export async function testStats(env) {
  console.log('\n🧪 ========== TESTING STATS FUNCTIONS ==========');
  
  const results = {
    pageViews: { success: false, message: '' },
    plays: { success: false, message: '' },
    downloads: { success: false, message: '' },
    dashboard: { success: false, message: '' }
  };
  
  try {
    // Test 1: Record a page view
    console.log('\n📝 Test 1: Recording page view');
    const { incrementPageView } = await import('./helpers/pageViews.js');
    
    const testPageId = `test_page_${Date.now()}`;
    const viewResult = await incrementPageView(env, 'test', testPageId);
    
    results.pageViews = {
      success: viewResult,
      message: viewResult ? '✅ Page view recorded' : '❌ Failed to record page view'
    };
    console.log(results.pageViews.message);
    
    // Test 2: Record a play
    console.log('\n📝 Test 2: Recording play');
    const { incrementPlay } = await import('./helpers/db.js');
    
    const testSongKey = `test_song_${Date.now()}`;
    const playResult = await incrementPlay(testSongKey, env);
    
    results.plays = {
      success: playResult,
      message: playResult ? '✅ Play recorded' : '❌ Failed to record play'
    };
    console.log(results.plays.message);
    
    // Test 3: Record a download
    console.log('\n📝 Test 3: Recording download');
    const { incrementDownload } = await import('./helpers/db.js');
    
    const downloadResult = await incrementDownload(testSongKey, env);
    
    results.downloads = {
      success: downloadResult,
      message: downloadResult ? '✅ Download recorded' : '❌ Failed to record download'
    };
    console.log(results.downloads.message);
    
    // Wait a moment for data to be written
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 4: Get today's stats
    console.log('\n📝 Test 4: Getting today\'s stats');
    const { getTodayViews } = await import('./helpers/pageViews.js');
    const { getTodayPlays, getTodayDownloads } = await import('./helpers/db.js');
    
    const views = await getTodayViews(env);
    const plays = await getTodayPlays(env);
    const downloads = await getTodayDownloads(env);
    
    console.log('📊 Today\'s Stats:');
    console.log(`   Views: ${views}`);
    console.log(`   Plays: ${plays}`);
    console.log(`   Downloads: ${downloads}`);
    
    // Test 5: Get dashboard stats
    console.log('\n📝 Test 5: Getting dashboard stats');
    const { getDashboardStats } = await import('./helpers/dashboardStats.js');
    const dashboardStats = await getDashboardStats(env);
    
    console.log('📊 Dashboard Stats:');
    console.log(`   Views Today: ${dashboardStats.viewsToday}`);
    console.log(`   Plays Today: ${dashboardStats.playsToday}`);
    console.log(`   Downloads Today: ${dashboardStats.downloadsToday}`);
    console.log(`   New Songs: ${dashboardStats.newSongs}`);
    console.log(`   New Albums: ${dashboardStats.newAlbums}`);
    console.log(`   New Artists: ${dashboardStats.newArtists}`);
    
    if (dashboardStats.topContent && dashboardStats.topContent.length > 0) {
      console.log('\n📊 Top Content:');
      dashboardStats.topContent.slice(0, 3).forEach((item, i) => {
        console.log(`   ${i+1}. ${item.title} - ${item.views} views`);
      });
    }
    
    results.dashboard = {
      success: true,
      message: '✅ Dashboard stats retrieved successfully',
      data: {
        viewsToday: dashboardStats.viewsToday,
        playsToday: dashboardStats.playsToday,
        downloadsToday: dashboardStats.downloadsToday
      }
    };
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    results.error = error.message;
  }
  
  console.log('\n📋 ========== TEST SUMMARY ==========');
  console.log(`Page Views: ${results.pageViews.success ? '✅' : '❌'} ${results.pageViews.message}`);
  console.log(`Plays: ${results.plays.success ? '✅' : '❌'} ${results.plays.message}`);
  console.log(`Downloads: ${results.downloads.success ? '✅' : '❌'} ${results.downloads.message}`);
  console.log(`Dashboard: ${results.dashboard.success ? '✅' : '❌'} ${results.dashboard.message}`);
  console.log('=====================================\n');
  
  return results;
}

// For running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running tests directly...');
  // This would need proper env setup
  testStats(process.env).then(console.log);
}