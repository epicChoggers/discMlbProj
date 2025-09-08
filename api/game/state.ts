import { VercelRequest, VercelResponse } from '@vercel/node'
import { gameCacheService } from '../../src/lib/services/GameCacheService'
import { gameDataService } from '../../src/lib/services/GameDataService'

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
    const { gamePk, forceRefresh } = req.query
    const targetGamePk = gamePk ? parseInt(gamePk as string) : undefined
    const shouldForceRefresh = forceRefresh === 'true'

    console.log(`Game state request: gamePk=${targetGamePk}, forceRefresh=${shouldForceRefresh}`)

    // Try to get cached data first (unless force refresh is requested)
    if (!shouldForceRefresh) {
      const cachedState = await gameCacheService.getCachedGameState(targetGamePk)
      if (cachedState) {
        console.log('Serving cached game state')
        res.status(200).json({
          success: true,
          ...cachedState,
          source: 'cache'
        })
        return
      }
    }

    // If no cached data or force refresh, fetch fresh data
    console.log('Fetching fresh game state from MLB API')
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

    // Cache the fresh data for future requests
    try {
      await gameCacheService.cacheGameState(gameState)
      console.log('Cached fresh game state')
    } catch (cacheError) {
      console.warn('Failed to cache game state:', cacheError)
      // Don't fail the request if caching fails
    }

    res.status(200).json({
      success: true,
      ...gameState,
      source: 'api'
    })

  } catch (error) {
    console.error('Error fetching game state:', error)
    
    // Try to serve stale cached data as fallback
    try {
      const staleState = await gameCacheService.getCachedGameState()
      if (staleState) {
        console.log('Serving stale cached data due to error')
        res.status(200).json({
          success: true,
          ...staleState,
          source: 'stale_cache',
          error: 'Using cached data due to API error'
        })
        return
      }
    } catch (fallbackError) {
      console.error('Fallback to stale cache also failed:', fallbackError)
    }
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch game state',
      game: null,
      currentAtBat: null,
      isLoading: false,
      lastUpdated: new Date().toISOString(),
      source: 'error'
    })
  }
}
