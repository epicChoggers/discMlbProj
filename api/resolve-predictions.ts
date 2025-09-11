import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../api-shared/lib/supabase.js'
import { gameDataService } from '../api-shared/lib/gameDataService.js'
import { predictionServiceNew } from '../api-shared/lib/predictionService.js'

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

    // Get fresh game data - first get basic game info, then detailed data if live
    const basicGame = await gameDataService.getTodaysMarinersGame()
    
    if (!basicGame) {
      res.status(200).json({ 
        success: true, 
        message: 'No game found for today',
        resolved: 0,
        pointsAwarded: 0
      })
      return
    }

    const gamePk = basicGame.gamePk
    console.log(`Found game ${gamePk}, resolving predictions for completed at-bats...`)

    // Get detailed game data with live plays for resolution
    let game = basicGame
    if (gameDataService.isGameLive(basicGame)) {
      console.log(`Game ${gamePk} is live, fetching detailed game data for resolution...`)
      const detailedGame = await gameDataService.getGameDetails(gamePk)
      if (detailedGame) {
        game = detailedGame
        console.log(`Detailed game data fetched successfully, has ${game.liveData?.plays?.allPlays?.length || 0} plays`)
      } else {
        console.log(`Failed to fetch detailed game data, using basic game data`)
      }
    } else {
      console.log(`Game ${gamePk} is not live, skipping detailed data fetch`)
    }

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

    // Debug: Also check total predictions for this game
    const { data: allPredictions } = await supabase
      .from('at_bat_predictions')
      .select('id, at_bat_index, prediction, resolved_at')
      .eq('game_pk', gamePk)
    
    console.log(`Total predictions for game ${gamePk}:`, allPredictions?.length || 0)
    if (allPredictions && allPredictions.length > 0) {
      console.log(`Prediction breakdown:`, allPredictions.map(p => ({
        atBatIndex: p.at_bat_index,
        prediction: p.prediction,
        resolved: !!p.resolved_at
      })))
    }

    if (pendingCount === 0) {
      res.status(200).json({ 
        success: true, 
        message: 'No pending predictions found',
        resolved: 0,
        pointsAwarded: 0
      })
      return
    }

    // Debug: Log game data structure for troubleshooting
    console.log(`Game data structure:`, {
      hasLiveData: !!game.liveData,
      hasPlays: !!game.liveData?.plays,
      hasAllPlays: !!game.liveData?.plays?.allPlays,
      allPlaysCount: game.liveData?.plays?.allPlays?.length || 0,
      gameStatus: game.status?.abstractGameState,
      gameDetailedState: game.status?.detailedState
    })

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
