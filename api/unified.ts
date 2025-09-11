import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './lib/supabase.js'
import { gameDataService } from './lib/gameDataService.js'
import { mlbCacheService } from './lib/MLBCacheService.js'

// Unified API handler for all endpoints
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
    const { action, type } = req.query

    // Route based on action and type
    switch (action) {
      // Game-related actions
      case 'game':
        await handleGameAction(req, res)
        break
      
      // Prediction-related actions
      case 'predictions':
        await handlePredictionAction(req, res)
        break
      
      // System-related actions
      case 'system':
        await handleSystemAction(req, res)
        break
      
      // Cache-related actions
      case 'cache':
        await handleCacheAction(req, res)
        break
      
      default:
        res.status(400).json({ 
          error: 'Invalid action. Supported actions: game, predictions, system, cache',
          availableActions: {
            game: ['state', 'leaderboard', 'pitcher-info', 'pitcher-predictions', 'recent-games'],
            predictions: ['resolve', 'stats', 'submit'],
            system: ['health', 'stats', 'startup', 'sync', 'events'],
            cache: ['stats', 'clear', 'cleanup']
          }
        })
    }
  } catch (error) {
    console.error('Error in unified API:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

// Game-related actions
async function handleGameAction(req: VercelRequest, res: VercelResponse) {
  const { type } = req.query

  switch (type) {
    case 'state':
      await handleGameState(req, res)
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
    case 'recent-games':
      await handleRecentGames(req, res)
      break
    default:
      res.status(400).json({ 
        error: 'Invalid game action. Supported types: state, leaderboard, pitcher-info, pitcher-predictions, recent-games' 
      })
  }
}

// Prediction-related actions
async function handlePredictionAction(req: VercelRequest, res: VercelResponse) {
  const { type } = req.query

  switch (type) {
    case 'resolve':
      await handleResolvePredictions(req, res)
      break
    case 'stats':
      await handlePredictionStats(req, res)
      break
    case 'submit':
      await handleSubmitPrediction(req, res)
      break
    default:
      res.status(400).json({ 
        error: 'Invalid prediction action. Supported types: resolve, stats, submit' 
      })
  }
}

// System-related actions
async function handleSystemAction(req: VercelRequest, res: VercelResponse) {
  const { type } = req.query

  switch (type) {
    case 'health':
      await handleHealth(req, res)
      break
    case 'stats':
      await handleSystemStats(req, res)
      break
    case 'startup':
      await handleStartup(req, res)
      break
    case 'sync':
      await handleSync(req, res)
      break
    case 'events':
      await handleEvents(req, res)
      break
    default:
      res.status(400).json({ 
        error: 'Invalid system action. Supported types: health, stats, startup, sync, events' 
      })
  }
}

// Cache-related actions
async function handleCacheAction(req: VercelRequest, res: VercelResponse) {
  const { type } = req.query

  switch (type) {
    case 'stats':
      await handleCacheStats(req, res)
      break
    case 'clear':
      await handleCacheClear(req, res)
      break
    case 'cleanup':
      await handleCacheCleanup(req, res)
      break
    default:
      res.status(400).json({ 
        error: 'Invalid cache action. Supported types: stats, clear, cleanup' 
      })
  }
}

// Import all the handler functions from existing files
// Game handlers
async function handleGameState(req: VercelRequest, res: VercelResponse) {
  // Import from existing game.ts
  const { handleGameState } = await import('./game.js')
  return handleGameState(req, res)
}

async function handleLeaderboard(req: VercelRequest, res: VercelResponse) {
  const { handleLeaderboard } = await import('./game.js')
  return handleLeaderboard(req, res)
}

async function handlePitcherInfo(req: VercelRequest, res: VercelResponse) {
  const { handlePitcherInfo } = await import('./game.js')
  return handlePitcherInfo(req, res)
}

async function handlePitcherPredictions(req: VercelRequest, res: VercelResponse) {
  const { handlePitcherPredictions } = await import('./game.js')
  return handlePitcherPredictions(req, res)
}

async function handleRecentGames(req: VercelRequest, res: VercelResponse) {
  const { handleRecentGames } = await import('./game.js')
  return handleRecentGames(req, res)
}

// Prediction handlers
async function handleResolvePredictions(req: VercelRequest, res: VercelResponse) {
  const { default: resolveHandler } = await import('./resolve-predictions.js')
  return resolveHandler(req, res)
}

async function handlePredictionStats(req: VercelRequest, res: VercelResponse) {
  // Implementation for prediction stats
  res.status(200).json({ success: true, message: 'Prediction stats endpoint' })
}

async function handleSubmitPrediction(req: VercelRequest, res: VercelResponse) {
  // Implementation for submitting predictions
  res.status(200).json({ success: true, message: 'Submit prediction endpoint' })
}

// System handlers
async function handleHealth(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    success: true, 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown'
  })
}

async function handleSystemStats(req: VercelRequest, res: VercelResponse) {
  const { handleStats } = await import('./system/index.js')
  return handleStats(req, res)
}

async function handleStartup(req: VercelRequest, res: VercelResponse) {
  const { handleStartup } = await import('./system/index.js')
  return handleStartup(req, res)
}

async function handleSync(req: VercelRequest, res: VercelResponse) {
  const { handleSync } = await import('./system/index.js')
  return handleSync(req, res)
}

async function handleEvents(req: VercelRequest, res: VercelResponse) {
  const { handleEvents } = await import('./system/index.js')
  return handleEvents(req, res)
}

// Cache handlers
async function handleCacheStats(req: VercelRequest, res: VercelResponse) {
  try {
    const stats = await mlbCacheService.getCacheStats()
    res.status(200).json({ success: true, stats })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get cache stats' })
  }
}

async function handleCacheClear(req: VercelRequest, res: VercelResponse) {
  try {
    await mlbCacheService.cleanupExpiredCache()
    res.status(200).json({ success: true, message: 'Cache cleared successfully' })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to clear cache' })
  }
}

async function handleCacheCleanup(req: VercelRequest, res: VercelResponse) {
  try {
    await mlbCacheService.cleanupExpiredCache()
    res.status(200).json({ success: true, message: 'Cache cleanup completed' })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to cleanup cache' })
  }
}
