import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './lib/supabase.js'
import { gameDataService } from './lib/gameDataService.js'
import { AtBatPrediction } from '../src/lib/types'

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

    switch (action) {
      case 'state':
        await handleGameState(req, res)
        break
      case 'predictions':
        await handlePredictions(req, res)
        break
      case 'leaderboard':
        await handleLeaderboard(req, res)
        break
      case 'pitcher-info':
        await handlePitcherInfo(req, res)
        break
      case 'pitcher-predictions':
        await handlePitcherPredictions(req, res)
        break
      default:
        res.status(400).json({ error: 'Invalid action. Supported actions: state, predictions, leaderboard, pitcher-info, pitcher-predictions' })
    }
  } catch (error) {
    console.error('Error in game API:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

// Game State Handler
async function handleGameState(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const debug = req.query?.debug === 'true'
    const ping = req.query?.ping === 'true'
    const apiBase = gameDataService.getApiBaseUrl()
    console.log('Fetching fresh game state from MLB API', { fetchType: typeof fetch, apiBase })

    if (ping) {
      res.status(200).json({ ok: true, apiBase, fetchType: typeof fetch, now: new Date().toISOString() })
      return
    }
    
    // First get the basic game info from schedule
    const game = await gameDataService.getTodaysMarinersGame()
    
    if (!game) {
      res.status(200).json({
        success: true,
        game: null,
        currentAtBat: null,
        isLoading: false,
        error: 'No Mariners game found for today',
        lastUpdated: new Date().toISOString(),
        source: 'api'
      })
      return
    }

    const isLive = gameDataService.isGameLive(game)
    console.log(`[State API] Game status check:`, {
      status: game.status,
      detailedState: game.status?.detailedState,
      abstractGameState: game.status?.abstractGameState,
      isLive: isLive
    })
    
    let currentAtBat = null
    let detailedGame = game

    // If the game is live, fetch detailed game data to get current at-bat
    if (isLive && game.gamePk) {
      console.log(`[State API] Game is live (${game.gamePk}), fetching detailed game data for current at-bat`)
      detailedGame = await gameDataService.getGameDetails(game.gamePk)
      if (detailedGame) {
        console.log(`[State API] Detailed game data fetched successfully`)
        console.log(`[State API] Game has liveData:`, !!detailedGame.liveData)
        console.log(`[State API] Game has plays:`, !!detailedGame.liveData?.plays)
        console.log(`[State API] Game has currentPlay:`, !!detailedGame.liveData?.plays?.currentPlay)
        console.log(`[State API] Game has allPlays:`, !!detailedGame.liveData?.plays?.allPlays)
        console.log(`[State API] AllPlays count:`, detailedGame.liveData?.plays?.allPlays?.length || 0)
        
        currentAtBat = gameDataService.getCurrentAtBat(detailedGame)
        console.log(`[State API] Current at-bat result:`, currentAtBat ? `At-bat ${currentAtBat.about?.atBatIndex}` : 'No current at-bat')
        if (currentAtBat) {
          console.log(`[State API] Current at-bat details:`, {
            atBatIndex: currentAtBat.about?.atBatIndex,
            batter: currentAtBat.matchup?.batter?.fullName,
            pitcher: currentAtBat.matchup?.pitcher?.fullName,
            count: currentAtBat.count
          })
        }
      } else {
        console.log('[State API] Failed to fetch detailed game data, using schedule data')
        detailedGame = game
      }
    } else {
      console.log(`[State API] Game is not live (isLive: ${isLive}, gamePk: ${game.gamePk})`)
    }

    const gameState = {
      game: detailedGame,
      currentAtBat,
      isLoading: false,
      error: isLive ? undefined : 'Game is not currently live',
      lastUpdated: new Date().toISOString()
    }

    res.status(200).json({
      success: true,
      ...gameState,
      source: 'api',
      debug: debug ? { fetchType: typeof fetch, now: new Date().toISOString() } : undefined
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch game state'
    console.error('Error fetching game state:', message, error)
    
    res.status(500).json({
      success: false,
      error: message,
      details: process.env.NODE_ENV !== 'production' ? String(error) : undefined,
      game: null,
      currentAtBat: null,
      isLoading: false,
      lastUpdated: new Date().toISOString(),
      source: 'error'
    })
  }
}

// Predictions Handler
async function handlePredictions(req: VercelRequest, res: VercelResponse) {
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
      console.log(`Filtering by at_bat_index = ${targetAtBatIndex}`)
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

    console.log(`Found ${data?.length || 0} predictions for gamePk=${targetGamePk}, atBatIndex=${targetAtBatIndex}`)
    if (data && data.length > 0) {
      console.log('Prediction details:', data.map(p => ({
        id: p.id,
        at_bat_index: p.at_bat_index,
        prediction: p.prediction,
        user_id: p.user_id
      })))
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
      isPartialCredit: prediction.is_partial_credit,
      pointsEarned: prediction.points_earned,
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
    if (!gamePk || atBatIndex === null || atBatIndex === undefined || atBatIndex < 0 || !prediction) {
      res.status(400).json({ error: 'gamePk, atBatIndex (must be non-negative), and prediction are required' })
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
      const gameStateResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/game?action=state`)
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

    // Check if at-bat is complete and count validation - prevent predictions
    try {
      const gameStateResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/game?action=state`)
      const gameStateData = await gameStateResponse.json()
      
      if (gameStateData.success && gameStateData.currentAtBat) {
        const currentAtBat = gameStateData.currentAtBat
        
        // Check if this is the current at-bat
        if (currentAtBat.about?.atBatIndex === atBatIndex) {
          // Check if at-bat is already complete
          if (currentAtBat.about?.isComplete === true) {
            res.status(400).json({ 
              error: 'This at-bat has already been completed. Predictions are no longer accepted.' 
            })
            return
          }
          
          // Check if count is too advanced (2+ balls or 2+ strikes)
          const balls = currentAtBat.count?.balls || 0
          const strikes = currentAtBat.count?.strikes || 0
          if (balls >= 2 || strikes >= 2) {
            res.status(400).json({ 
              error: `Predictions are no longer accepted after the count reaches 2+ balls or 2+ strikes. Current count: ${balls}-${strikes}` 
            })
            return
          }
        }
      }
    } catch (error) {
      console.warn('Error checking count validation:', error)
      // Continue without count validation rather than failing
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

// Leaderboard Handler
async function handleLeaderboard(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { gamePk, limit } = req.query
    const targetGamePk = gamePk ? parseInt(gamePk as string) : undefined
    const targetLimit = limit ? parseInt(limit as string) : 10

    console.log(`Getting leaderboard: gamePk=${targetGamePk}, limit=${targetLimit}`)

    // Get predictions data
    let predictionsQuery = supabase
      .from('at_bat_predictions')
      .select('user_id, prediction, prediction_category, actual_outcome, actual_category, is_correct, points_earned')
      .not('is_correct', 'is', null)

    if (targetGamePk) {
      predictionsQuery = predictionsQuery.eq('game_pk', targetGamePk)
    }

    const { data: predictionsData, error: predictionsError } = await predictionsQuery

    if (predictionsError) {
      throw predictionsError
    }

    if (!predictionsData || predictionsData.length === 0) {
      res.status(200).json({
        success: true,
        leaderboard: {
          entries: [],
          total_users: 0,
          last_updated: new Date().toISOString()
        }
      })
      return
    }

    // Process the data to calculate stats per user
    const userStats = new Map<string, {
      user_id: string
      total_predictions: number
      correct_predictions: number
      total_outcomes: number
      correct_outcomes: number
      total_exact_outcomes: number
      correct_exact_outcomes: number
      total_points: number
    }>()

    predictionsData.forEach(prediction => {
      const userId = prediction.user_id

      if (!userStats.has(userId)) {
        userStats.set(userId, {
          user_id: userId,
          total_predictions: 0,
          correct_predictions: 0,
          total_outcomes: 0,
          correct_outcomes: 0,
          total_exact_outcomes: 0,
          correct_exact_outcomes: 0,
          total_points: 0
        })
      }

      const stats = userStats.get(userId)!
      stats.total_predictions++
      
      // Count outcomes (category-based predictions)
      if (prediction.prediction_category && prediction.actual_category) {
        stats.total_outcomes++
        if (prediction.prediction_category === prediction.actual_category) {
          stats.correct_outcomes++
        }
      }
      
      // Count exact outcomes (specific prediction matches)
      if (prediction.prediction && prediction.actual_outcome) {
        stats.total_exact_outcomes++
        if (prediction.prediction === prediction.actual_outcome) {
          stats.correct_exact_outcomes++
        }
      }
      
      // Count correct predictions and points
      if (prediction.is_correct) {
        stats.correct_predictions++
      }
      
      // Add points earned
      if (prediction.points_earned) {
        stats.total_points += prediction.points_earned
      }
    })

    // Get user profiles for the users with predictions
    const userIds = Array.from(userStats.keys())
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .in('id', userIds)

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError)
    }

    // Create a map of user profiles
    const profileMap = new Map()
    profiles?.forEach(profile => {
      profileMap.set(profile.id, profile)
    })

    // Convert to leaderboard entries
    const entries = Array.from(userStats.values())
      .map((stats, index) => {
        const profile = profileMap.get(stats.user_id)
        return {
          user_id: stats.user_id,
          username: profile?.username || 'Unknown User',
          avatar_url: profile?.avatar_url || null,
          total_predictions: stats.total_predictions,
          correct_predictions: stats.correct_predictions,
          accuracy: stats.total_predictions > 0 ? (stats.correct_predictions / stats.total_predictions) * 100 : 0,
          streak: 0, // TODO: Calculate streak
          best_streak: 0, // TODO: Calculate best streak
          rank: index + 1,
          total_outcomes: stats.total_outcomes,
          correct_outcomes: stats.correct_outcomes,
          total_exact_outcomes: stats.total_exact_outcomes,
          correct_exact_outcomes: stats.correct_exact_outcomes,
          total_points: stats.total_points
        }
      })
      .sort((a, b) => b.total_points - a.total_points || b.accuracy - a.accuracy)
      .slice(0, targetLimit)

    const leaderboard = {
      entries,
      total_users: entries.length,
      last_updated: new Date().toISOString()
    }

    res.status(200).json({
      success: true,
      leaderboard,
      gamePk: targetGamePk,
      limit: targetLimit
    })

  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch leaderboard',
      leaderboard: {
        entries: [],
        total_users: 0,
        last_updated: new Date().toISOString()
      }
    })
  }
}

// Pitcher Info Handler
async function handlePitcherInfo(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

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

// Pitcher Predictions Handler
async function handlePitcherPredictions(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    await handleGetPitcherPredictions(req, res)
  } else if (req.method === 'POST') {
    await handleCreatePitcherPrediction(req, res)
  } else if (req.method === 'PUT') {
    await handleUpdatePitcherPrediction(req, res)
  } else {
    res.status(405).json({ error: 'Method not allowed' })
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
