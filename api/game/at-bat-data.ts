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
    console.log('[AtBatData] Processing request for at-bat data')
    
    // Get parameters from query
    const gamePk = req.query.gamePk ? parseInt(req.query.gamePk as string) : undefined
    const atBatIndex = req.query.atBatIndex ? parseInt(req.query.atBatIndex as string) : undefined
    const type = req.query.type as string || 'current' // 'current', 'previous', 'specific'
    
    console.log(`[AtBatData] Request parameters:`, { gamePk, atBatIndex, type })
    
    if (!gamePk) {
      return res.status(400).json({
        success: false,
        error: 'gamePk parameter is required'
      })
    }

    // Get comprehensive game data
    const gameState = await gumboGameDataService.getComprehensiveGameState(gamePk)
    
    if (!gameState.success || !gameState.game) {
      console.error('[AtBatData] Failed to get game data:', gameState.error)
      return res.status(500).json({
        success: false,
        error: gameState.error || 'Failed to get game data',
        lastUpdated: new Date().toISOString()
      })
    }

    let atBatData = null
    let atBatType = type

    switch (type) {
      case 'current':
        atBatData = gameState.currentAtBat
        break
      case 'previous':
        atBatData = gameState.previousAtBat
        break
      case 'specific':
        if (atBatIndex === undefined) {
          return res.status(400).json({
            success: false,
            error: 'atBatIndex parameter is required for specific at-bat requests'
          })
        }
        atBatData = gumboGameDataService.getAtBatByIndex(gameState.game, atBatIndex)
        atBatType = `specific-${atBatIndex}`
        break
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid type parameter. Must be "current", "previous", or "specific"'
        })
    }

    if (!atBatData) {
      return res.status(404).json({
        success: false,
        error: `No ${type} at-bat data found`,
        lastUpdated: new Date().toISOString()
      })
    }

    console.log(`[AtBatData] Successfully retrieved ${type} at-bat data`)
    console.log(`[AtBatData] At-bat index: ${atBatData.about?.atBatIndex || 'N/A'}`)
    console.log(`[AtBatData] Pitcher: ${atBatData.matchup?.pitcher?.fullName || 'N/A'}`)
    console.log(`[AtBatData] Batter: ${atBatData.matchup?.batter?.fullName || 'N/A'}`)

    // Return at-bat data with comprehensive details
    res.status(200).json({
      success: true,
      gamePk: gamePk,
      atBatType: atBatType,
      atBatData: atBatData,
      gameInfo: {
        gamePk: gameState.game.gamePk,
        status: gameState.game.status,
        teams: {
          away: gameState.game.teams?.away?.team,
          home: gameState.game.teams?.home?.team
        },
        venue: gameState.game.venue
      },
      lastUpdated: new Date().toISOString(),
      metaData: {
        apiVersion: 'gumbo-v1.1',
        hydrations: ['credits', 'alignment', 'flags', 'officials', 'preState'],
        atBatTracking: 'index-based',
        dataSource: 'MLB Stats API GUMBO'
      }
    })

  } catch (error) {
    console.error('[AtBatData] Unexpected error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      lastUpdated: new Date().toISOString()
    })
  }
}
