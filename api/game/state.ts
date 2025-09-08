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
    let currentAtBat = null
    let detailedGame = game

    // If the game is live, fetch detailed game data to get current at-bat
    if (isLive && game.gamePk) {
      console.log(`Game is live (${game.gamePk}), fetching detailed game data for current at-bat`)
      detailedGame = await gameDataService.getGameDetails(game.gamePk)
      if (detailedGame) {
        currentAtBat = gameDataService.getCurrentAtBat(detailedGame)
        console.log('Current at-bat:', currentAtBat ? `At-bat ${currentAtBat.about?.atBatIndex}` : 'No current at-bat')
      } else {
        console.log('Failed to fetch detailed game data, using schedule data')
        detailedGame = game
      }
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
