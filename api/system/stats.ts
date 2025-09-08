import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../src/supabaseClient'
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
    const { timeframe } = req.query
    const targetTimeframe = timeframe as string || '24h'

    console.log('System stats request:', { timeframe: targetTimeframe })

    const stats = await Promise.allSettled([
      getCacheStats(),
      getPredictionStats(targetTimeframe),
      getSyncStats(targetTimeframe),
      getSystemHealthStats(targetTimeframe),
      getGameDataServiceStats()
    ])

    const results = stats.map((result, index) => {
      const statNames = ['cache', 'predictions', 'sync', 'systemHealth', 'gameDataService']
      const statName = statNames[index]
      
      if (result.status === 'fulfilled') {
        return {
          category: statName,
          ...result.value
        }
      } else {
        return {
          category: statName,
          error: result.reason?.message || 'Unknown error'
        }
      }
    })

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      timeframe: targetTimeframe,
      stats: results.reduce((acc, stat) => {
        acc[stat.category] = stat
        return acc
      }, {} as any)
    }

    res.status(200).json(response)

  } catch (error) {
    console.error('Error getting system stats:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get system stats',
      timestamp: new Date().toISOString()
    })
  }
}

async function getCacheStats(): Promise<any> {
  try {
    const cacheStats = await gameCacheService.getCacheStats()
    
    return {
      gameStates: cacheStats.gameStates,
      atBats: cacheStats.atBats,
      oldestGameState: cacheStats.oldestGameState,
      newestGameState: cacheStats.newestGameState
    }
  } catch (error) {
    throw new Error(`Cache stats failed: ${error}`)
  }
}

async function getPredictionStats(timeframe: string): Promise<any> {
  try {
    const timeFilter = getTimeFilter(timeframe)
    
    const { data: predictions, error } = await supabase
      .from('at_bat_predictions')
      .select('id, created_at, is_correct, points_earned')
      .gte('created_at', timeFilter)

    if (error) {
      throw error
    }

    const totalPredictions = predictions.length
    const correctPredictions = predictions.filter(p => p.is_correct).length
    const totalPoints = predictions.reduce((sum, p) => sum + (p.points_earned || 0), 0)

    return {
      totalPredictions,
      correctPredictions,
      accuracy: totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0,
      totalPoints,
      averagePoints: totalPredictions > 0 ? totalPoints / totalPredictions : 0
    }
  } catch (error) {
    throw new Error(`Prediction stats failed: ${error}`)
  }
}

async function getSyncStats(timeframe: string): Promise<any> {
  try {
    const timeFilter = getTimeFilter(timeframe)
    
    const { data: syncLogs, error } = await supabase
      .from('game_sync_log')
      .select('sync_type, status, sync_duration_ms, data_size')
      .gte('created_at', timeFilter)

    if (error) {
      throw error
    }

    const totalSyncs = syncLogs.length
    const successfulSyncs = syncLogs.filter(s => s.status === 'success').length
    const averageDuration = syncLogs.length > 0 
      ? syncLogs.reduce((sum, s) => sum + (s.sync_duration_ms || 0), 0) / syncLogs.length 
      : 0
    const totalDataSize = syncLogs.reduce((sum, s) => sum + (s.data_size || 0), 0)

    return {
      totalSyncs,
      successfulSyncs,
      successRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0,
      averageDuration,
      totalDataSize
    }
  } catch (error) {
    throw new Error(`Sync stats failed: ${error}`)
  }
}

async function getSystemHealthStats(timeframe: string): Promise<any> {
  try {
    const timeFilter = getTimeFilter(timeframe)
    
    const { data: healthRecords, error } = await supabase
      .from('system_health')
      .select('service_name, status, response_time_ms, created_at')
      .gte('created_at', timeFilter)

    if (error) {
      throw error
    }

    const services = [...new Set(healthRecords.map(h => h.service_name))]
    const healthyServices = services.filter(service => {
      const serviceRecords = healthRecords.filter(h => h.service_name === service)
      const latestRecord = serviceRecords.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      return latestRecord?.status === 'healthy'
    })

    const averageResponseTime = healthRecords.length > 0
      ? healthRecords.reduce((sum, h) => sum + (h.response_time_ms || 0), 0) / healthRecords.length
      : 0

    return {
      totalServices: services.length,
      healthyServices: healthyServices.length,
      healthRate: services.length > 0 ? (healthyServices.length / services.length) * 100 : 0,
      averageResponseTime
    }
  } catch (error) {
    throw new Error(`System health stats failed: ${error}`)
  }
}

async function getGameDataServiceStats(): Promise<any> {
  try {
    const cacheStats = gameDataService.getCacheStats()
    
    return {
      cacheSize: cacheStats.size,
      cacheEntries: cacheStats.entries.length,
      cacheHitRate: 'N/A' // Would need to track hits/misses
    }
  } catch (error) {
    throw new Error(`Game data service stats failed: ${error}`)
  }
}

function getTimeFilter(timeframe: string): string {
  const now = new Date()
  let hoursBack = 24 // Default to 24 hours

  switch (timeframe) {
    case '1h':
      hoursBack = 1
      break
    case '6h':
      hoursBack = 6
      break
    case '12h':
      hoursBack = 12
      break
    case '24h':
      hoursBack = 24
      break
    case '7d':
      hoursBack = 24 * 7
      break
    case '30d':
      hoursBack = 24 * 30
      break
  }

  const filterDate = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000))
  return filterDate.toISOString()
}
