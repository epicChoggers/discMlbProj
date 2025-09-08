import { VercelRequest, VercelResponse } from '@vercel/node'
import { gumboGameDataService } from '../lib/gumboGameDataService'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    })
  }

  try {
    console.log('[GumboState] Processing request for comprehensive game state')
    
    // Get gamePk from query params if provided
    const gamePk = req.query.gamePk ? parseInt(req.query.gamePk as string) : undefined
    const forceRefresh = req.query.forceRefresh === 'true'
    
    console.log(`[GumboState] Request parameters:`, { gamePk, forceRefresh })
    
    // Get comprehensive game state using GUMBO
    const gameState = await gumboGameDataService.getComprehensiveGameState(gamePk)
    
    if (!gameState.success) {
      console.error('[GumboState] Failed to get game state:', gameState.error)
      return res.status(500).json({
        success: false,
        error: gameState.error,
        lastUpdated: gameState.lastUpdated
      })
    }

    console.log('[GumboState] Successfully retrieved comprehensive game state')
    console.log(`[GumboState] Game: ${gameState.game?.gamePk || 'N/A'}`)
    console.log(`[GumboState] Current at-bat: ${gameState.currentAtBat?.about?.atBatIndex || 'N/A'}`)
    console.log(`[GumboState] Previous at-bat: ${gameState.previousAtBat?.about?.atBatIndex || 'N/A'}`)
    console.log(`[GumboState] Game live: ${gumboGameDataService.isGameLive(gameState.game)}`)

    // Return comprehensive game state
    res.status(200).json({
      success: true,
      game: gameState.game,
      currentAtBat: gameState.currentAtBat,
      previousAtBat: gameState.previousAtBat,
      isGameLive: gumboGameDataService.isGameLive(gameState.game),
      lastUpdated: gameState.lastUpdated,
      // Additional metadata
      metaData: {
        apiVersion: 'gumbo-v1.1',
        hydrations: ['credits', 'alignment', 'flags', 'officials', 'preState'],
        atBatTracking: 'index-based',
        dataSource: 'MLB Stats API GUMBO'
      }
    })

  } catch (error) {
    console.error('[GumboState] Unexpected error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      lastUpdated: new Date().toISOString()
    })
  }
}
