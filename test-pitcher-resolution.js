// Test script for pitcher prediction resolution system
// This script tests the pitcher resolution logic with sample MLB API data

const { pitcherStatsService } = require('./src/lib/services/PitcherStatsService.ts')
const { pitcherSubstitutionService } = require('./src/lib/services/PitcherSubstitutionService.ts')

// Sample MLB game data structure for testing
const sampleGameData = {
  gameData: {
    status: {
      abstractGameState: 'Final',
      codedGameState: 'F',
      detailedState: 'Final'
    }
  },
  liveData: {
    boxscore: {
      teams: {
        home: {
          team: { id: 136, name: 'Seattle Mariners' },
          players: {
            'ID123456': {
              person: {
                id: 123456,
                fullName: 'Logan Gilbert'
              },
              stats: {
                pitching: {
                  inningsPitched: '7.1',
                  hits: 5,
                  earnedRuns: 2,
                  baseOnBalls: 1,
                  strikeOuts: 8
                }
              }
            },
            'ID789012': {
              person: {
                id: 789012,
                fullName: 'Paul Sewald'
              },
              stats: {
                pitching: {
                  inningsPitched: '1.0',
                  hits: 0,
                  earnedRuns: 0,
                  baseOnBalls: 0,
                  strikeOuts: 2
                }
              }
            }
          }
        },
        away: {
          team: { id: 117, name: 'Houston Astros' },
          players: {
            'ID345678': {
              person: {
                id: 345678,
                fullName: 'Framber Valdez'
              },
              stats: {
                pitching: {
                  inningsPitched: '6.0',
                  hits: 7,
                  earnedRuns: 3,
                  baseOnBalls: 2,
                  strikeOuts: 6
                }
              }
            }
          }
        }
      }
    },
    plays: {
      allPlays: [
        {
          about: {
            inning: 8,
            startTime: '2024-01-15T20:30:00Z'
          },
          playEvents: [
            {
              type: 'pitching_substitution',
              player: {
                id: 123456,
                fullName: 'Logan Gilbert'
              },
              details: {
                event: 'Pitching Substitution',
                description: 'Paul Sewald replaces Logan Gilbert'
              }
            }
          ]
        }
      ]
    }
  }
}

// Test pitcher statistics extraction
function testPitcherStatsExtraction() {
  console.log('=== Testing Pitcher Statistics Extraction ===')
  
  try {
    const pitcherStats = pitcherStatsService.extractPitcherStats(sampleGameData)
    console.log('Extracted pitcher stats:', pitcherStats)
    
    const marinersStartingPitcher = pitcherStatsService.getMarinersStartingPitcherStats(sampleGameData)
    console.log('Mariners starting pitcher stats:', marinersStartingPitcher)
    
    if (marinersStartingPitcher) {
      console.log('✅ Successfully extracted Mariners starting pitcher stats')
      console.log(`   Pitcher: ${marinersStartingPitcher.pitcherName}`)
      console.log(`   IP: ${marinersStartingPitcher.ip}`)
      console.log(`   Hits: ${marinersStartingPitcher.hits}`)
      console.log(`   ER: ${marinersStartingPitcher.earnedRuns}`)
      console.log(`   BB: ${marinersStartingPitcher.walks}`)
      console.log(`   K: ${marinersStartingPitcher.strikeouts}`)
    } else {
      console.log('❌ Failed to extract Mariners starting pitcher stats')
    }
  } catch (error) {
    console.error('❌ Error testing pitcher stats extraction:', error)
  }
}

// Test pitcher substitution detection
function testPitcherSubstitutionDetection() {
  console.log('\n=== Testing Pitcher Substitution Detection ===')
  
  try {
    const substitutions = pitcherSubstitutionService.analyzePitcherSubstitutions(sampleGameData)
    console.log('Detected substitutions:', substitutions)
    
    const startingPitcher = pitcherSubstitutionService.getMarinersStartingPitcher(sampleGameData)
    console.log('Mariners starting pitcher:', startingPitcher)
    
    const pitcherStatus = pitcherSubstitutionService.hasStartingPitcherBeenRemoved(sampleGameData)
    console.log('Starting pitcher status:', pitcherStatus)
    
    const shouldResolve = pitcherSubstitutionService.shouldResolveStartingPitcherPredictions(sampleGameData)
    console.log('Should resolve predictions:', shouldResolve)
    
    if (shouldResolve) {
      console.log('✅ System correctly determined that pitcher predictions should be resolved')
    } else {
      console.log('❌ System incorrectly determined that pitcher predictions should not be resolved')
    }
  } catch (error) {
    console.error('❌ Error testing pitcher substitution detection:', error)
  }
}

// Test points calculation
function testPointsCalculation() {
  console.log('\n=== Testing Points Calculation ===')
  
  try {
    // Sample prediction vs actual stats
    const predictedStats = {
      ip: 7.0,
      hits: 4,
      earnedRuns: 2,
      walks: 1,
      strikeouts: 7
    }
    
    const actualStats = {
      ip: 7.1,
      hits: 5,
      earnedRuns: 2,
      walks: 1,
      strikeouts: 8
    }
    
    // This would need to be imported from the actual service
    // const points = pitcherPredictionService.calculatePoints(
    //   predictedStats.ip, predictedStats.hits, predictedStats.earnedRuns,
    //   predictedStats.walks, predictedStats.strikeouts,
    //   actualStats.ip, actualStats.hits, actualStats.earnedRuns,
    //   actualStats.walks, actualStats.strikeouts
    // )
    
    console.log('Predicted stats:', predictedStats)
    console.log('Actual stats:', actualStats)
    console.log('✅ Points calculation test would need actual service import')
  } catch (error) {
    console.error('❌ Error testing points calculation:', error)
  }
}

// Run all tests
function runAllTests() {
  console.log('🧪 Starting Pitcher Resolution System Tests\n')
  
  testPitcherStatsExtraction()
  testPitcherSubstitutionDetection()
  testPointsCalculation()
  
  console.log('\n🏁 All tests completed!')
}

// Export for use in other test files
module.exports = {
  testPitcherStatsExtraction,
  testPitcherSubstitutionDetection,
  testPointsCalculation,
  runAllTests,
  sampleGameData
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
}
