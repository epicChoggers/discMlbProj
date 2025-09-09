import { VercelRequest, VercelResponse } from '@vercel/node'
import { gameDataService } from '../lib/gameDataService.js'
import { gameCacheService } from '../lib/gameCacheService.js'

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
    // Allow GET for testing
    res.status(200).json({ 
      message: 'Use POST to initialize game data',
      example: 'POST /api/game/initialize'
    })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    console.log('Initializing game data...')

    // Get today's Mariners game
    const game = await gameDataService.getTodaysMarinersGame()
    if (!game) {
      res.status(404).json({ 
        success: false, 
        error: 'No Mariners game found for today' 
      })
      return
    }

    console.log(`Found game: ${game.teams.away.team.name} vs ${game.teams.home.team.name}`)

    // Get detailed game data to access plays
    const detailedGame = await gameDataService.getGameDetails(game.gamePk)
    if (!detailedGame) {
      res.status(404).json({ 
        success: false, 
        error: 'Could not fetch detailed game data' 
      })
      return
    }

    // Cache the game state
    const gameState = {
      game: detailedGame,
      currentAtBat: gameDataService.getCurrentAtBat(detailedGame),
      isLoading: false,
      lastUpdated: new Date().toISOString()
    }
    
    await gameCacheService.cacheGameState(gameState)
    console.log('Game state cached successfully')

    // Get all plays and cache them
    const plays = gameDataService.getGamePlays(detailedGame)
    let cachedAtBats = 0
    
    if (plays && plays.length > 0) {
      console.log(`Found ${plays.length} plays, caching at-bats...`)
      for (const play of plays) {
        if (play.about?.atBatIndex !== undefined) {
          try {
            await gameCacheService.cacheAtBat(game.gamePk, play.about.atBatIndex, play)
            cachedAtBats++
            console.log(`Cached at-bat ${play.about.atBatIndex}`)
          } catch (error) {
            console.error(`Failed to cache at-bat ${play.about.atBatIndex}:`, error)
          }
        }
      }
    } else {
      console.log('No plays found in game data')
    }

    res.status(200).json({
      success: true,
      message: 'Game data initialized successfully',
      game: {
        gamePk: detailedGame.gamePk,
        awayTeam: detailedGame.teams.away.team.name,
        homeTeam: detailedGame.teams.home.team.name,
        status: detailedGame.status.detailedState
      },
      cachedAtBats,
      totalPlays: plays?.length || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error initializing game data:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}
