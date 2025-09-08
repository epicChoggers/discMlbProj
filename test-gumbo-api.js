// Test script for the new GUMBO-based at-bat data system
const https = require('https');

// Test configuration
const BASE_URL = 'https://statsapi.mlb.com/api/v1.1';
const TEST_GAME_PK = 775345; // Detroit vs Houston playoff game

// Helper function to make HTTP requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Test 1: Basic GUMBO feed
async function testBasicGumboFeed() {
  console.log('\n=== Test 1: Basic GUMBO Feed ===');
  try {
    const url = `${BASE_URL}/game/${TEST_GAME_PK}/feed/live`;
    const data = await makeRequest(url);
    
    console.log('✅ Basic GUMBO feed successful');
    console.log(`Game PK: ${data.gameData?.game?.pk}`);
    console.log(`Game Status: ${data.gameData?.status?.detailedState}`);
    console.log(`Current Play Available: ${!!data.liveData?.plays?.currentPlay}`);
    console.log(`All Plays Count: ${data.liveData?.plays?.allPlays?.length || 0}`);
    
    if (data.liveData?.plays?.currentPlay) {
      const currentPlay = data.liveData.plays.currentPlay;
      console.log(`Current At-Bat Index: ${currentPlay.about?.atBatIndex}`);
      console.log(`Current Pitcher: ${currentPlay.matchup?.pitcher?.fullName}`);
      console.log(`Current Batter: ${currentPlay.matchup?.batter?.fullName}`);
    }
    
    return data;
  } catch (error) {
    console.error('❌ Basic GUMBO feed failed:', error.message);
    return null;
  }
}

// Test 2: GUMBO with hydrations
async function testGumboWithHydrations() {
  console.log('\n=== Test 2: GUMBO with Hydrations ===');
  try {
    const hydrations = 'credits,alignment,flags,officials,preState';
    const url = `${BASE_URL}/game/${TEST_GAME_PK}/feed/live?hydrate=${hydrations}`;
    const data = await makeRequest(url);
    
    console.log('✅ GUMBO with hydrations successful');
    console.log(`Credits Available: ${!!data.liveData?.credits}`);
    console.log(`Alignment Available: ${!!data.liveData?.alignment}`);
    console.log(`Flags Available: ${!!data.liveData?.flags}`);
    console.log(`Officials Available: ${!!data.liveData?.officials}`);
    console.log(`PreState Available: ${!!data.liveData?.preState}`);
    
    // Check credits data
    if (data.liveData?.credits) {
      console.log(`Credits Count: ${data.liveData.credits.length}`);
    }
    
    return data;
  } catch (error) {
    console.error('❌ GUMBO with hydrations failed:', error.message);
    return null;
  }
}

// Test 3: At-bat data analysis
async function testAtBatDataAnalysis() {
  console.log('\n=== Test 3: At-Bat Data Analysis ===');
  try {
    const url = `${BASE_URL}/game/${TEST_GAME_PK}/feed/live`;
    const data = await makeRequest(url);
    
    if (!data.liveData?.plays?.allPlays) {
      console.log('❌ No plays data available');
      return;
    }
    
    const allPlays = data.liveData.plays.allPlays;
    console.log(`✅ Total plays: ${allPlays.length}`);
    
    // Analyze at-bat indices
    const atBatIndices = allPlays.map(play => play.about?.atBatIndex).filter(index => index !== undefined);
    console.log(`At-bat indices: ${atBatIndices.slice(0, 10).join(', ')}${atBatIndices.length > 10 ? '...' : ''}`);
    
    // Find current at-bat
    const currentPlay = data.liveData.plays.currentPlay;
    if (currentPlay) {
      console.log(`Current at-bat index: ${currentPlay.about?.atBatIndex}`);
      
      // Find previous at-bat
      const previousIndex = currentPlay.about?.atBatIndex - 1;
      const previousAtBat = allPlays.find(play => 
        play.about?.atBatIndex === previousIndex && 
        play.about?.isComplete && 
        play.result?.event
      );
      
      if (previousAtBat) {
        console.log(`Previous at-bat index: ${previousAtBat.about?.atBatIndex}`);
        console.log(`Previous pitcher: ${previousAtBat.matchup?.pitcher?.fullName}`);
        console.log(`Previous batter: ${previousAtBat.matchup?.batter?.fullName}`);
        console.log(`Previous result: ${previousAtBat.result?.event}`);
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ At-bat data analysis failed:', error.message);
    return null;
  }
}

// Test 4: Schedule with hydration
async function testScheduleWithHydration() {
  console.log('\n=== Test 4: Schedule with Hydration ===');
  try {
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=10/01/2024&hydrate=probablePitcher,team`;
    const data = await makeRequest(url);
    
    console.log('✅ Schedule with hydration successful');
    console.log(`Total games: ${data.totalGames}`);
    
    if (data.dates && data.dates.length > 0 && data.dates[0].games) {
      const games = data.dates[0].games;
      console.log(`Games on date: ${games.length}`);
      
      // Find our test game
      const testGame = games.find(game => game.gamePk === TEST_GAME_PK);
      if (testGame) {
        console.log(`Test game found: ${testGame.teams?.away?.team?.name} vs ${testGame.teams?.home?.team?.name}`);
        console.log(`Probable pitchers available: ${!!testGame.teams?.away?.probablePitcher || !!testGame.teams?.home?.probablePitcher}`);
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ Schedule with hydration failed:', error.message);
    return null;
  }
}

// Test 5: Player details in boxscore
async function testPlayerDetails() {
  console.log('\n=== Test 5: Player Details in Boxscore ===');
  try {
    const url = `${BASE_URL}/game/${TEST_GAME_PK}/feed/live`;
    const data = await makeRequest(url);
    
    if (!data.liveData?.boxscore?.teams) {
      console.log('❌ No boxscore data available');
      return;
    }
    
    console.log('✅ Boxscore data available');
    
    // Check away team players
    const awayTeam = data.liveData.boxscore.teams.away;
    if (awayTeam?.players) {
      const playerCount = Object.keys(awayTeam.players).length;
      console.log(`Away team players: ${playerCount}`);
      
      // Find a sample player
      const samplePlayer = Object.values(awayTeam.players)[0];
      if (samplePlayer) {
        console.log(`Sample player: ${samplePlayer.person?.fullName}`);
        console.log(`Player stats available: ${!!samplePlayer.stats}`);
        console.log(`Season stats available: ${!!samplePlayer.seasonStats}`);
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ Player details test failed:', error.message);
    return null;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Starting GUMBO API Tests');
  console.log(`Testing with Game PK: ${TEST_GAME_PK}`);
  
  const results = {
    basicGumbo: await testBasicGumboFeed(),
    gumboWithHydrations: await testGumboWithHydrations(),
    atBatAnalysis: await testAtBatDataAnalysis(),
    scheduleHydration: await testScheduleWithHydration(),
    playerDetails: await testPlayerDetails()
  };
  
  console.log('\n=== Test Summary ===');
  const passedTests = Object.values(results).filter(result => result !== null).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! GUMBO API is ready for implementation.');
  } else {
    console.log('⚠️  Some tests failed. Check the output above for details.');
  }
  
  return results;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testBasicGumboFeed,
  testGumboWithHydrations,
  testAtBatDataAnalysis,
  testScheduleWithHydration,
  testPlayerDetails
};
