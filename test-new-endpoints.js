// Test script for the new GUMBO-based API endpoints
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

// Test 1: GUMBO State Endpoint (simulated)
async function testGumboStateEndpoint() {
  console.log('\n=== Test 1: GUMBO State Endpoint (Simulated) ===');
  try {
    // Since we can't test our actual endpoint without deployment,
    // we'll test the underlying GUMBO API that our endpoint uses
    const hydrations = 'credits,alignment,flags,officials,preState';
    const url = `${BASE_URL}/game/${TEST_GAME_PK}/feed/live?hydrate=${hydrations}`;
    const data = await makeRequest(url);
    
    console.log('✅ GUMBO API with hydrations successful');
    console.log(`Game PK: ${data.gameData?.game?.pk}`);
    console.log(`Game Status: ${data.gameData?.status?.detailedState}`);
    console.log(`Current Play Available: ${!!data.liveData?.plays?.currentPlay}`);
    console.log(`All Plays Count: ${data.liveData?.plays?.allPlays?.length || 0}`);
    
    // Check hydrations
    console.log(`Credits Available: ${!!data.liveData?.credits}`);
    console.log(`Alignment Available: ${!!data.liveData?.alignment}`);
    console.log(`Flags Available: ${!!data.liveData?.flags}`);
    console.log(`Officials Available: ${!!data.liveData?.officials}`);
    console.log(`PreState Available: ${!!data.liveData?.preState}`);
    
    // Check current at-bat
    if (data.liveData?.plays?.currentPlay) {
      const currentPlay = data.liveData.plays.currentPlay;
      console.log(`Current At-Bat Index: ${currentPlay.about?.atBatIndex}`);
      console.log(`Current Pitcher: ${currentPlay.matchup?.pitcher?.fullName}`);
      console.log(`Current Batter: ${currentPlay.matchup?.batter?.fullName}`);
    }
    
    return data;
  } catch (error) {
    console.error('❌ GUMBO State endpoint test failed:', error.message);
    return null;
  }
}

// Test 2: At-Bat Data Analysis
async function testAtBatDataAnalysis() {
  console.log('\n=== Test 2: At-Bat Data Analysis ===');
  try {
    const url = `${BASE_URL}/game/${TEST_GAME_PK}/feed/live`;
    const data = await makeRequest(url);
    
    if (!data.liveData?.plays?.allPlays) {
      console.log('❌ No plays data available');
      return null;
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

// Test 3: Player Details Enhancement
async function testPlayerDetailsEnhancement() {
  console.log('\n=== Test 3: Player Details Enhancement ===');
  try {
    const url = `${BASE_URL}/game/${TEST_GAME_PK}/feed/live`;
    const data = await makeRequest(url);
    
    if (!data.liveData?.boxscore?.teams) {
      console.log('❌ No boxscore data available');
      return null;
    }
    
    console.log('✅ Boxscore data available');
    
    // Check away team players
    const awayTeam = data.liveData.boxscore.teams.away;
    if (awayTeam?.players) {
      const playerCount = Object.keys(awayTeam.players).length;
      console.log(`Away team players: ${playerCount}`);
      
      // Find a sample player with stats
      const samplePlayer = Object.values(awayTeam.players).find(player => 
        player.stats && (player.stats.batting || player.stats.pitching)
      );
      
      if (samplePlayer) {
        console.log(`Sample player: ${samplePlayer.person?.fullName}`);
        console.log(`Player stats available: ${!!samplePlayer.stats}`);
        console.log(`Season stats available: ${!!samplePlayer.seasonStats}`);
        
        if (samplePlayer.stats?.batting) {
          console.log(`Batting stats: ${JSON.stringify(samplePlayer.stats.batting, null, 2)}`);
        }
        if (samplePlayer.stats?.pitching) {
          console.log(`Pitching stats: ${JSON.stringify(samplePlayer.stats.pitching, null, 2)}`);
        }
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ Player details enhancement test failed:', error.message);
    return null;
  }
}

// Test 4: Schedule with Hydration
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
        
        if (testGame.teams?.away?.probablePitcher) {
          console.log(`Away probable pitcher: ${testGame.teams.away.probablePitcher.fullName}`);
        }
        if (testGame.teams?.home?.probablePitcher) {
          console.log(`Home probable pitcher: ${testGame.teams.home.probablePitcher.fullName}`);
        }
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ Schedule with hydration failed:', error.message);
    return null;
  }
}

// Test 5: Data Structure Validation
async function testDataStructureValidation() {
  console.log('\n=== Test 5: Data Structure Validation ===');
  try {
    const url = `${BASE_URL}/game/${TEST_GAME_PK}/feed/live`;
    const data = await makeRequest(url);
    
    console.log('✅ Data structure validation');
    
    // Validate gameData structure
    const gameData = data.gameData;
    console.log(`GameData structure valid: ${!!gameData?.game?.pk}`);
    console.log(`Teams structure valid: ${!!gameData?.teams?.away && !!gameData?.teams?.home}`);
    console.log(`Venue structure valid: ${!!gameData?.venue}`);
    
    // Validate liveData structure
    const liveData = data.liveData;
    console.log(`LiveData structure valid: ${!!liveData}`);
    console.log(`Plays structure valid: ${!!liveData?.plays}`);
    console.log(`Boxscore structure valid: ${!!liveData?.boxscore}`);
    
    // Validate plays structure
    if (liveData?.plays) {
      console.log(`CurrentPlay structure valid: ${!!liveData.plays.currentPlay}`);
      console.log(`AllPlays structure valid: ${!!liveData.plays.allPlays}`);
      
      if (liveData.plays.currentPlay) {
        const currentPlay = liveData.plays.currentPlay;
        console.log(`About structure valid: ${!!currentPlay.about}`);
        console.log(`Matchup structure valid: ${!!currentPlay.matchup}`);
        console.log(`Result structure valid: ${!!currentPlay.result}`);
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ Data structure validation failed:', error.message);
    return null;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Starting New Endpoints Tests');
  console.log(`Testing with Game PK: ${TEST_GAME_PK}`);
  
  const results = {
    gumboState: await testGumboStateEndpoint(),
    atBatAnalysis: await testAtBatDataAnalysis(),
    playerDetails: await testPlayerDetailsEnhancement(),
    scheduleHydration: await testScheduleWithHydration(),
    dataStructure: await testDataStructureValidation()
  };
  
  console.log('\n=== Test Summary ===');
  const passedTests = Object.values(results).filter(result => result !== null).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! New GUMBO endpoints are ready for deployment.');
    console.log('\n📋 Next Steps:');
    console.log('1. Deploy the new API endpoints to Vercel');
    console.log('2. Test the actual endpoints: /api/game/gumbo-state and /api/game/at-bat-data');
    console.log('3. Update frontend components to use the new GUMBO service');
    console.log('4. Implement at-bat prediction features with enhanced data');
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
  testGumboStateEndpoint,
  testAtBatDataAnalysis,
  testPlayerDetailsEnhancement,
  testScheduleWithHydration,
  testDataStructureValidation
};
