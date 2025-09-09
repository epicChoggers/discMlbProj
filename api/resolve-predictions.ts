import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    console.log('Manual prediction resolution triggered...')

    // Get all pending predictions
    const { data: pendingPredictions, error: fetchError } = await supabase
      .from('at_bat_predictions')
      .select('*')
      .is('resolved_at', null)
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('Error fetching pending predictions:', fetchError)
      res.status(500).json({ success: false, error: fetchError.message })
      return
    }

    if (!pendingPredictions || pendingPredictions.length === 0) {
      res.status(200).json({ 
        success: true, 
        message: 'No pending predictions found',
        resolved: 0
      })
      return
    }

    console.log(`Found ${pendingPredictions.length} pending predictions`)

    // Group predictions by at-bat
    const predictionsByAtBat = pendingPredictions.reduce((acc, prediction) => {
      const key = `${prediction.game_pk}_${prediction.at_bat_index}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(prediction)
      return acc
    }, {} as Record<string, any[]>)

    let totalResolved = 0
    let totalPoints = 0

    // Process each at-bat
    for (const [atBatKey, predictions] of Object.entries(predictionsByAtBat)) {
      const [gamePk, atBatIndex] = atBatKey.split('_').map(Number)
      
      console.log(`Processing at-bat ${atBatIndex} for game ${gamePk} with ${predictions.length} predictions`)

      // For now, let's resolve them as "field_out" to test the system
      // In a real implementation, we'd fetch the actual game data
      const actualOutcome = 'field_out'
      
      for (const prediction of predictions) {
        const isCorrect = prediction.prediction === actualOutcome
        const pointsEarned = isCorrect ? 1 : 0

        const { error: updateError } = await supabase
          .from('at_bat_predictions')
          .update({
            actual_outcome: actualOutcome,
            is_correct: isCorrect,
            points_earned: pointsEarned,
            resolved_at: new Date().toISOString()
          })
          .eq('id', prediction.id)

        if (updateError) {
          console.error(`Error updating prediction ${prediction.id}:`, updateError)
        } else {
          totalResolved++
          totalPoints += pointsEarned
          console.log(`Resolved prediction ${prediction.id}: ${prediction.prediction} -> ${actualOutcome} (${isCorrect ? 'correct' : 'incorrect'})`)
        }
      }
    }

    console.log(`Resolution complete: ${totalResolved} predictions resolved, ${totalPoints} points awarded`)

    res.status(200).json({
      success: true,
      message: `Resolved ${totalResolved} predictions`,
      resolved: totalResolved,
      pointsAwarded: totalPoints
    })

  } catch (error) {
    console.error('Error in manual prediction resolution:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}
