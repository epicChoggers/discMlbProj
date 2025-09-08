import { VercelRequest, VercelResponse } from '@vercel/node'
import { gameDataService } from '../lib/gameDataService.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

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

    // Get all at-bats if we have detailed game data
    let allAtBats = null
    if (detailedGame && detailedGame.liveData) {
      allAtBats = gameDataService.getAllAtBats(detailedGame)
      console.log(`[State API] Found ${allAtBats.length} at-bats`)
    }

    const gameState = {
      game: detailedGame,
      currentAtBat,
      allAtBats: allAtBats ? {
        count: allAtBats.length,
        atBats: allAtBats.map(atBat => ({
          atBatIndex: atBat.about?.atBatIndex,
          batter: atBat.matchup?.batter?.fullName,
          pitcher: atBat.matchup?.pitcher?.fullName,
          isComplete: atBat.about?.isComplete,
          result: atBat.result?.event,
          inning: atBat.about?.inning,
          halfInning: atBat.about?.halfInning
        }))
      } : null,
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
