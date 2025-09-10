import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './lib/supabase.js'
import { gameDataService } from './lib/gameDataService.js'
import { predictionServiceNew } from './lib/predictionService.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    console.log('Manual prediction resolution triggered...')

    // Get fresh game data
    const game = await gameDataService.getTodaysMarinersGame()
    
    if (!game) {
      res.status(200).json({ 
        success: true, 
        message: 'No game found for today',
        resolved: 0,
        pointsAwarded: 0
      })
      return
    }

    const gamePk = game.gamePk
    console.log(`Found game ${gamePk}, resolving predictions for completed at-bats...`)

    // Get count of pending predictions before resolution
    const { data: pendingPredictions, error: fetchError } = await supabase
      .from('at_bat_predictions')
      .select('id')
      .eq('game_pk', gamePk)
      .is('resolved_at', null)

    if (fetchError) {
      console.error('Error fetching pending predictions:', fetchError)
      res.status(500).json({ success: false, error: fetchError.message })
      return
    }

    const pendingCount = pendingPredictions?.length || 0
    console.log(`Found ${pendingCount} pending predictions for game ${gamePk}`)

    if (pendingCount === 0) {
      res.status(200).json({ 
        success: true, 
        message: 'No pending predictions found',
        resolved: 0,
        pointsAwarded: 0
      })
      return
    }

    // Use the proper prediction resolution service
    await predictionServiceNew.autoResolveAllCompletedAtBats(gamePk, game)

    // Get statistics about resolved predictions (last minute)
    const { data: resolvedPredictions } = await supabase
      .from('at_bat_predictions')
      .select('points_earned')
      .eq('game_pk', gamePk)
      .not('resolved_at', 'is', null)
      .gte('resolved_at', new Date(Date.now() - 60000).toISOString()) // Last minute

    const predictionsResolved = resolvedPredictions?.length || 0
    const pointsAwarded = resolvedPredictions?.reduce((sum, p) => sum + (p.points_earned || 0), 0) || 0

    console.log(`Resolution complete: ${predictionsResolved} predictions resolved, ${pointsAwarded} points awarded`)

    res.status(200).json({
      success: true,
      message: `Resolved ${predictionsResolved} predictions`,
      resolved: predictionsResolved,
      pointsAwarded: pointsAwarded
    })

  } catch (error) {
    console.error('Error in manual prediction resolution:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}
