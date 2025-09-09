import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../lib/supabase.js'
import { AtBatPrediction } from '../../src/lib/types'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method === 'GET') {
    await handleGetPredictions(req, res)
  } else if (req.method === 'POST') {
    await handleCreatePrediction(req, res)
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}

async function handleGetPredictions(req: VercelRequest, res: VercelResponse) {
  try {
    const { gamePk, atBatIndex, userId } = req.query
    
    if (!gamePk) {
      res.status(400).json({ error: 'gamePk is required' })
      return
    }

    const targetGamePk = parseInt(gamePk as string)
    const targetAtBatIndex = atBatIndex ? parseInt(atBatIndex as string) : undefined
    const targetUserId = userId as string

    console.log(`Getting predictions: gamePk=${targetGamePk}, atBatIndex=${targetAtBatIndex}, userId=${targetUserId}`)

    let query = supabase
      .from('predictions_with_users')
      .select('*')
      .eq('game_pk', targetGamePk)

    if (targetAtBatIndex !== undefined) {
      query = query.eq('at_bat_index', targetAtBatIndex)
    }

    if (targetUserId) {
      query = query.eq('user_id', targetUserId)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      throw error
    }

    // Transform the data to match our AtBatPrediction interface
    const predictions: AtBatPrediction[] = (data || []).map(prediction => ({
      id: prediction.id,
      userId: prediction.user_id,
      gamePk: prediction.game_pk,
      atBatIndex: prediction.at_bat_index,
      prediction: prediction.prediction,
      predictionCategory: prediction.prediction_category,
      actualOutcome: prediction.actual_outcome,
      actualCategory: prediction.actual_category,
      isCorrect: prediction.is_correct,
      pointsEarned: prediction.points_earned,
      streakCount: prediction.streak_count || 0,
      streakBonus: prediction.streak_bonus || 0,
      createdAt: prediction.created_at,
      resolvedAt: prediction.resolved_at,
      // Add batter and pitcher data
      batter: prediction.batter_name ? {
        id: prediction.batter_id,
        name: prediction.batter_name,
        position: prediction.batter_position,
        batSide: prediction.batter_bat_side
      } : null,
      pitcher: prediction.pitcher_name ? {
        id: prediction.pitcher_id,
        name: prediction.pitcher_name,
        hand: prediction.pitcher_hand
      } : null,
      user: {
        id: prediction.user_id,
        email: prediction.email || '',
        raw_user_meta_data: prediction.raw_user_meta_data || {}
      }
    }))

    res.status(200).json({
      success: true,
      predictions,
      count: predictions.length,
      gamePk: targetGamePk,
      atBatIndex: targetAtBatIndex
    })

  } catch (error) {
    console.error('Error fetching predictions:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch predictions',
      predictions: []
    })
  }
}

async function handleCreatePrediction(req: VercelRequest, res: VercelResponse) {
  try {
    const { gamePk, atBatIndex, prediction, predictionCategory } = req.body

    // Validate required fields
    if (!gamePk || atBatIndex === null || atBatIndex === undefined || atBatIndex < 1 || !prediction) {
      res.status(400).json({ error: 'gamePk, atBatIndex (must be positive), and prediction are required' })
      return
    }

    // Get user from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization header required' })
      return
    }

    const token = authHeader.substring(7)
    
    // Verify the token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    console.log(`Creating prediction: user=${user.id}, gamePk=${gamePk}, atBatIndex=${atBatIndex}, prediction=${prediction}`)

    // Get batter and pitcher information from game state data
    let batterData = null
    let pitcherData = null
    
    try {
      // Get current game state to find the at-bat data
      const gameStateResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/game/state`)
      const gameStateData = await gameStateResponse.json()
      
      if (gameStateData.success && gameStateData.game?.liveData?.plays?.allPlays) {
        const allPlays = gameStateData.game.liveData.plays.allPlays
        const play = allPlays.find((p: any) => p.about?.atBatIndex === atBatIndex)
        
        if (play && play.matchup) {
          // Extract batter data
          if (play.matchup.batter) {
            batterData = {
              id: play.matchup.batter.id,
              name: play.matchup.batter.fullName,
              position: play.matchup.batter.primaryPosition?.abbreviation || 'Unknown',
              bat_side: play.matchup.batSide?.code || 'Unknown'
            }
          }
          
          // Extract pitcher data
          if (play.matchup.pitcher) {
            pitcherData = {
              id: play.matchup.pitcher.id,
              name: play.matchup.pitcher.fullName,
              hand: play.matchup.pitchHand?.code || 'Unknown'
            }
          }
          
          console.log('Extracted player data from game state:', { batterData, pitcherData })
        } else {
          console.warn('No play found for atBatIndex:', atBatIndex)
        }
      } else {
        console.warn('No game state data available')
      }
    } catch (error) {
      console.warn('Error fetching game state data:', error)
      // Continue without batter/pitcher data rather than failing
    }

    // Check if user has already made a prediction for this at-bat
    const { data: existingPrediction } = await supabase
      .from('at_bat_predictions')
      .select('id')
      .eq('user_id', user.id)
      .eq('game_pk', gamePk)
      .eq('at_bat_index', atBatIndex)
      .maybeSingle()

    if (existingPrediction) {
      res.status(409).json({ error: 'You have already made a prediction for this at-bat' })
      return
    }

    // Create the prediction with batter and pitcher data
    const predictionData = {
      user_id: user.id,
      game_pk: gamePk,
      at_bat_index: atBatIndex,
      prediction,
      prediction_category: predictionCategory,
      // Add batter data if available
      ...(batterData && {
        batter_id: batterData.id,
        batter_name: batterData.name,
        batter_position: batterData.position,
        batter_bat_side: batterData.bat_side
      }),
      // Add pitcher data if available
      ...(pitcherData && {
        pitcher_id: pitcherData.id,
        pitcher_name: pitcherData.name,
        pitcher_hand: pitcherData.hand
      }),
      created_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('at_bat_predictions')
      .insert([predictionData])
      .select()
      .single()

    if (error) {
      throw error
    }

    res.status(201).json({
      success: true,
      prediction: data,
      message: 'Prediction created successfully'
    })

  } catch (error) {
    console.error('Error creating prediction:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create prediction'
    })
  }
}
