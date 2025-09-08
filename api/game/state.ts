import { VercelRequest, VercelResponse } from '@vercel/node'

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
    // dynamic import to catch import-time errors explicitly
    let gameDataService: any
    try {
      const mod = await import('../lib/gameDataService')
      gameDataService = mod.gameDataService
    } catch (importErr) {
      console.error('Failed to import gameDataService:', importErr)
      res.status(500).json({
        success: false,
        error: 'ImportError: gameDataService',
        details: process.env.NODE_ENV !== 'production' ? String(importErr) : undefined
      })
      return
    }

    const apiBase = gameDataService.getApiBaseUrl()
    console.log('Fetching fresh game state from MLB API', { fetchType: typeof fetch, apiBase })

    if (ping) {
      res.status(200).json({ ok: true, apiBase, fetchType: typeof fetch, now: new Date().toISOString() })
      return
    }
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

    const currentAtBat = gameDataService.getCurrentAtBat(game)
    const isLive = gameDataService.isGameLive(game)

    const gameState = {
      game,
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
