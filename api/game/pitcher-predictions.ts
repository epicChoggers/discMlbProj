import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../lib/supabase.js'
import { gameDataService } from '../lib/gameDataService.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    const { action } = req.query

    if (req.method === 'GET') {
      if (action === 'info') {
        await handleGetPitcherInfo(req, res)
      } else {
        await handleGetPitcherPredictions(req, res)
      }
    } else if (req.method === 'POST') {
      await handleCreatePitcherPrediction(req, res)
    } else if (req.method === 'PUT') {
      await handleUpdatePitcherPrediction(req, res)
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Error in pitcher predictions API:', error)
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    })
  }
}

async function handleGetPitcherInfo(req: VercelRequest, res: VercelResponse) {
  const { gamePk } = req.query

  try {
    let game: any = null

    if (gamePk) {
      // If gamePk is provided, get that specific game
      game = await gameDataService.getGameWithProbablePitcher(parseInt(gamePk as string))
    } else {
      // If no gamePk provided, get today's Mariners game
      game = await gameDataService.getTodaysMarinersGameWithPitcher()
    }
    
    if (!game) {
      res.status(404).json({ error: 'Game not found' })
      return
    }

    // Extract pitcher information from the game data
    const marinersTeamId = parseInt(process.env.VITE_TEAM_ID || '136')
    
    // Find the Mariners team in the game
    const homeTeam = game.teams?.home
    const awayTeam = game.teams?.away
    
    const homeTeamId = (homeTeam as any)?.team?.id || (homeTeam as any)?.id
    const awayTeamId = (awayTeam as any)?.team?.id || (awayTeam as any)?.id
    
    const isMarinersHome = homeTeamId === marinersTeamId
    const marinersTeam = isMarinersHome ? homeTeam : awayTeam
    
    // Log team info for debugging
    console.log('Team IDs:', { homeTeamId, awayTeamId, marinersTeamId, isMarinersHome })

    if (!marinersTeam) {
      res.status(404).json({ error: 'Mariners team not found in game' })
      return
    }

    // Get the probable pitcher from the schedule data
    const probablePitcher = marinersTeam.probablePitcher

    if (!probablePitcher) {
      res.status(404).json({ error: 'No probable pitcher found for Mariners in this game' })
      return
    }

    // Format the pitcher data
    const pitcherInfo = {
      id: probablePitcher.id,
      fullName: probablePitcher.fullName,
      firstName: probablePitcher.firstName,
      lastName: probablePitcher.lastName,
      primaryNumber: probablePitcher.primaryNumber,
      currentTeam: {
        id: marinersTeamId,
        name: marinersTeam.team?.name || 'Seattle Mariners'
      },
      primaryPosition: {
        code: 'P',
        name: 'Pitcher',
        type: 'Pitcher'
      },
      headshotUrl: `https://midfield.mlbstatic.com/v1/people/${probablePitcher.id}/spots/240`
    }

    res.status(200).json({
      success: true,
      pitcher: pitcherInfo,
      game: {
        gamePk: game.gamePk,
        gameDate: game.gameDate,
        status: game.status,
        teams: {
          home: homeTeam,
          away: awayTeam
        },
        venue: game.venue
      }
    })

  } catch (error) {
    console.error('Error fetching pitcher info:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch pitcher information'
    })
  }
}

async function handleGetPitcherPredictions(req: VercelRequest, res: VercelResponse) {
  const { gamePk, pitcherId, userId } = req.query

  try {
    let actualGamePk = gamePk

    // If no gamePk provided, get today's Mariners game
    if (!gamePk) {
      console.log('No gamePk provided, fetching today\'s Mariners game')
      const game = await gameDataService.getTodaysMarinersGameWithPitcher()
      if (!game) {
        console.log('No Mariners game found for today')
        res.status(404).json({ error: 'No Mariners game found for today' })
        return
      }
      actualGamePk = game.gamePk.toString()
      console.log('Using today\'s gamePk:', actualGamePk)
    } else {
      console.log('Using provided gamePk:', actualGamePk)
    }

    let query = supabase
      .from('pitcher_predictions')
      .select('*')
      .eq('game_pk', actualGamePk)

    if (pitcherId) {
      query = query.eq('pitcher_id', pitcherId)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase query error:', error)
      throw error
    }

    console.log('Query result:', { dataCount: data?.length || 0, actualGamePk, pitcherId, userId })

    // Get user profiles for all unique user IDs
    const userIds = [...new Set(data?.map(row => row.user_id) || [])]
    let userProfiles: any = {}
    
    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', userIds)
      
      if (profileError) {
        console.error('Error fetching user profiles:', profileError)
        // Continue without user profiles rather than failing
      } else {
        userProfiles = profiles?.reduce((acc, profile) => {
          acc[profile.id] = profile
          return acc
        }, {} as any) || {}
      }
    }

    // Transform the data to match our TypeScript interface
    const predictions = data?.map(row => ({
      id: row.id,
      userId: row.user_id,
      gamePk: row.game_pk,
      pitcherId: row.pitcher_id,
      pitcherName: row.pitcher_name,
      predictedIp: parseFloat(row.predicted_ip),
      predictedHits: row.predicted_hits,
      predictedEarnedRuns: row.predicted_earned_runs,
      predictedWalks: row.predicted_walks,
      predictedStrikeouts: row.predicted_strikeouts,
      actualIp: row.actual_ip ? parseFloat(row.actual_ip) : undefined,
      actualHits: row.actual_hits,
      actualEarnedRuns: row.actual_earned_runs,
      actualWalks: row.actual_walks,
      actualStrikeouts: row.actual_strikeouts,
      pointsEarned: row.points_earned,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      user: userProfiles[row.user_id] ? {
        id: userProfiles[row.user_id].id,
        username: userProfiles[row.user_id].username,
        avatar_url: userProfiles[row.user_id].avatar_url
      } : {
        id: row.user_id,
        username: 'Unknown User',
        avatar_url: null
      }
    })) || []

    res.status(200).json({
      success: true,
      predictions,
      count: predictions.length
    })
  } catch (error) {
    console.error('Error fetching pitcher predictions:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch pitcher predictions'
    })
  }
}

async function handleCreatePitcherPrediction(req: VercelRequest, res: VercelResponse) {
  const { 
    gamePk, 
    pitcherId, 
    pitcherName, 
    predictedIp, 
    predictedHits, 
    predictedEarnedRuns, 
    predictedWalks, 
    predictedStrikeouts 
  } = req.body

  // Validate required fields
  if (!gamePk || !pitcherId || !pitcherName || 
      predictedIp === undefined || predictedHits === undefined || 
      predictedEarnedRuns === undefined || predictedWalks === undefined || 
      predictedStrikeouts === undefined) {
    res.status(400).json({ 
      error: 'Missing required fields: gamePk, pitcherId, pitcherName, predictedIp, predictedHits, predictedEarnedRuns, predictedWalks, predictedStrikeouts' 
    })
    return
  }

  // Validate numeric values
  if (predictedIp < 0 || predictedIp > 9.2 || 
      predictedHits < 0 || predictedEarnedRuns < 0 || 
      predictedWalks < 0 || predictedStrikeouts < 0) {
    res.status(400).json({ 
      error: 'Invalid prediction values. All values must be non-negative, and IP must be <= 9.2' 
    })
    return
  }

  try {
    // Get the current user from the Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header required' })
      return
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    // Check if the game has started - if so, reject the prediction
    const game = await gameDataService.getGameWithProbablePitcher(gamePk)
    if (!game) {
      res.status(404).json({ error: 'Game not found' })
      return
    }

    // Check if game has started (no longer accepting predictions)
    // Allow predictions during warmup, but not once the game is live, final, or postponed
    const gameStatus = game.status?.abstractGameState
    const detailedStatus = game.status?.detailedState
    
    // Block predictions if game is final or postponed
    if (gameStatus === 'Final' || gameStatus === 'Postponed') {
      res.status(400).json({ 
        error: `Game has ended and pitcher predictions are no longer being accepted. Game status: ${gameStatus}` 
      })
      return
    }
    
    // Block predictions if game is live AND not in warmup
    if (gameStatus === 'Live' && detailedStatus !== 'Warmup') {
      res.status(400).json({ 
        error: `Game has started and pitcher predictions are no longer being accepted. Game status: ${gameStatus}, detailed status: ${detailedStatus}` 
      })
      return
    }

    // Check if user already has a prediction for this pitcher in this game
    const { data: existingPrediction } = await supabase
      .from('pitcher_predictions')
      .select('id')
      .eq('user_id', user.id)
      .eq('game_pk', gamePk)
      .eq('pitcher_id', pitcherId)
      .single()

    if (existingPrediction) {
      res.status(409).json({ 
        error: 'You have already made a prediction for this pitcher in this game' 
      })
      return
    }

    // Insert the new prediction
    const { data, error } = await supabase
      .from('pitcher_predictions')
      .insert({
        user_id: user.id,
        game_pk: gamePk,
        pitcher_id: pitcherId,
        pitcher_name: pitcherName,
        predicted_ip: predictedIp,
        predicted_hits: predictedHits,
        predicted_earned_runs: predictedEarnedRuns,
        predicted_walks: predictedWalks,
        predicted_strikeouts: predictedStrikeouts
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    res.status(201).json({
      success: true,
      prediction: {
        id: data.id,
        userId: data.user_id,
        gamePk: data.game_pk,
        pitcherId: data.pitcher_id,
        pitcherName: data.pitcher_name,
        predictedIp: parseFloat(data.predicted_ip),
        predictedHits: data.predicted_hits,
        predictedEarnedRuns: data.predicted_earned_runs,
        predictedWalks: data.predicted_walks,
        predictedStrikeouts: data.predicted_strikeouts,
        createdAt: data.created_at
      }
    })
  } catch (error) {
    console.error('Error creating pitcher prediction:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create pitcher prediction'
    })
  }
}

async function handleUpdatePitcherPrediction(req: VercelRequest, res: VercelResponse) {
  const { 
    id,
    actualIp, 
    actualHits, 
    actualEarnedRuns, 
    actualWalks, 
    actualStrikeouts,
    pointsEarned 
  } = req.body

  if (!id) {
    res.status(400).json({ error: 'Prediction ID is required' })
    return
  }

  try {
    // Get the current user from the Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header required' })
      return
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    // Build update object
    const updateData: any = {
      resolved_at: new Date().toISOString()
    }

    if (actualIp !== undefined) updateData.actual_ip = actualIp
    if (actualHits !== undefined) updateData.actual_hits = actualHits
    if (actualEarnedRuns !== undefined) updateData.actual_earned_runs = actualEarnedRuns
    if (actualWalks !== undefined) updateData.actual_walks = actualWalks
    if (actualStrikeouts !== undefined) updateData.actual_strikeouts = actualStrikeouts
    if (pointsEarned !== undefined) updateData.points_earned = pointsEarned

    // Update the prediction
    const { data, error } = await supabase
      .from('pitcher_predictions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user can only update their own predictions
      .select()
      .single()

    if (error) {
      throw error
    }

    if (!data) {
      res.status(404).json({ error: 'Prediction not found or you do not have permission to update it' })
      return
    }

    res.status(200).json({
      success: true,
      prediction: {
        id: data.id,
        userId: data.user_id,
        gamePk: data.game_pk,
        pitcherId: data.pitcher_id,
        pitcherName: data.pitcher_name,
        predictedIp: parseFloat(data.predicted_ip),
        predictedHits: data.predicted_hits,
        predictedEarnedRuns: data.predicted_earned_runs,
        predictedWalks: data.predicted_walks,
        predictedStrikeouts: data.predicted_strikeouts,
        actualIp: data.actual_ip ? parseFloat(data.actual_ip) : undefined,
        actualHits: data.actual_hits,
        actualEarnedRuns: data.actual_earned_runs,
        actualWalks: data.actual_walks,
        actualStrikeouts: data.actual_strikeouts,
        pointsEarned: data.points_earned,
        createdAt: data.created_at,
        resolvedAt: data.resolved_at
      }
    })
  } catch (error) {
    console.error('Error updating pitcher prediction:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update pitcher prediction'
    })
  }
}
