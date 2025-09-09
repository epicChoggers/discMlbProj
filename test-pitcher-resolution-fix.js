// Test script to verify pitcher prediction resolution fix
const { dataSyncService } = require('./src/lib/services/DataSyncService.ts')

async function testPitcherResolution() {
  console.log('Testing pitcher prediction resolution...')
  
  try {
    // Test with a known game (you can replace with actual game PK)
    const testGamePk = 12345 // Replace with actual game PK
    
    console.log(`Testing resolution for game ${testGamePk}...`)
    const result = await dataSyncService.resolvePredictions(testGamePk)
    
    console.log('Resolution result:', result)
    console.log('✅ Pitcher resolution test completed successfully')
  } catch (error) {
    console.error('❌ Error testing pitcher resolution:', error)
  }
}

// Run the test
testPitcherResolution()
