// Debug script to test pitcher prediction resolution
const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugPitcherPredictions() {
  console.log('🔍 Debugging pitcher predictions...')
  
  try {
    // Get all unresolved pitcher predictions
    const { data: predictions, error } = await supabase
      .from('pitcher_predictions')
      .select('*')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('❌ Error fetching predictions:', error)
      return
    }

    console.log(`📊 Found ${predictions.length} unresolved pitcher predictions:`)
    
    predictions.forEach((pred, index) => {
      console.log(`${index + 1}. Game ${pred.game_pk}, Pitcher ${pred.pitcher_id}`)
      console.log(`   Predicted: ${pred.predicted_ip} IP, ${pred.predicted_hits} H, ${pred.predicted_earned_runs} ER`)
      console.log(`   Created: ${pred.created_at}`)
      console.log(`   Resolved: ${pred.resolved_at || 'Not resolved'}`)
      console.log('')
    })

    // Get game data for the most recent prediction
    if (predictions.length > 0) {
      const latestPrediction = predictions[0]
      console.log(`🎮 Getting game data for game ${latestPrediction.game_pk}...`)
      
      // Try to get game data from MLB API
      const gameResponse = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${latestPrediction.game_pk}/feed/live`)
      if (gameResponse.ok) {
        const gameData = await gameResponse.json()
        console.log('Game status:', gameData?.gameData?.status?.abstractGameState)
        console.log('Game detailed status:', gameData?.gameData?.status?.detailedState)
        
        // Test the resolution logic
        const { pitcherSubstitutionService } = require('./src/lib/services/PitcherSubstitutionService.ts')
        const shouldResolve = pitcherSubstitutionService.shouldResolveStartingPitcherPredictions(gameData)
        console.log('Should resolve predictions:', shouldResolve)
      } else {
        console.log('❌ Could not fetch game data')
      }
    }

  } catch (error) {
    console.error('❌ Error in debug script:', error)
  }
}

// Run the debug
debugPitcherPredictions()
