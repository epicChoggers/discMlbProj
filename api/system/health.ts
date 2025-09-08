import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../lib/supabase'
import { gameDataService } from '../lib/gameDataService'
import { gameCacheService } from '../lib/gameCacheService'

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
    const { detailed } = req.query
    const includeDetails = detailed === 'true'

    console.log('Health check request:', { includeDetails })

    const healthChecks = await Promise.allSettled([
      checkDatabaseHealth(),
      checkGameDataServiceHealth(),
      checkGameCacheServiceHealth(),
      checkSystemHealthRecords()
    ])

    const results = healthChecks.map((result, index) => {
      const serviceNames = ['database', 'gameDataService', 'gameCacheService', 'systemHealth']
      const serviceName = serviceNames[index]
      
      if (result.status === 'fulfilled') {
        return {
          service: serviceName,
          status: 'healthy',
          ...result.value
        }
      } else {
        return {
          service: serviceName,
          status: 'error',
          error: result.reason?.message || 'Unknown error'
        }
      }
    })

    const overallStatus = results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded'
    const healthyServices = results.filter(r => r.status === 'healthy').length
    const totalServices = results.length

    const response = {
      success: true,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        healthy: healthyServices,
        total: totalServices,
        details: includeDetails ? results : undefined
      },
      uptime: process.uptime(),
      version: '1.0.0'
    }

    // Include detailed service information if requested
    if (includeDetails) {
      response.services.details = results
    }

    res.status(200).json(response)

  } catch (error) {
    console.error('Error in health check:', error)
    res.status(500).json({
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString()
    })
  }
}

async function checkDatabaseHealth(): Promise<any> {
  const startTime = Date.now()
  
  try {
    // Test basic database connectivity
    const { data, error } = await supabase
      .from('system_health')
      .select('id')
      .limit(1)
    
    const responseTime = Date.now() - startTime

    if (error) {
      throw error
    }

    return {
      responseTime,
      message: 'Database connection successful'
    }
  } catch (error) {
    throw new Error(`Database health check failed: ${error}`)
  }
}

async function checkGameDataServiceHealth(): Promise<any> {
  const startTime = Date.now()
  
  try {
    // Test MLB API connectivity
    const game = await gameDataService.getTodaysMarinersGame()
    const responseTime = Date.now() - startTime

    return {
      responseTime,
      hasGame: !!game,
      gamePk: game?.gamePk || null,
      cacheStats: gameDataService.getCacheStats(),
      message: 'Game data service operational'
    }
  } catch (error) {
    throw new Error(`Game data service health check failed: ${error}`)
  }
}

async function checkGameCacheServiceHealth(): Promise<any> {
  try {
    const stats = await gameCacheService.getCacheStats()
    
    return {
      stats,
      message: 'Game cache service operational'
    }
  } catch (error) {
    throw new Error(`Game cache service health check failed: ${error}`)
  }
}

async function checkSystemHealthRecords(): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('system_health')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      throw error
    }

    const summary = {
      total_records: data.length,
      healthy_services: data.filter(s => s.status === 'healthy').length,
      error_services: data.filter(s => s.status === 'error').length,
      last_update: data[0]?.created_at || null
    }

    return {
      summary,
      message: 'System health records accessible'
    }
  } catch (error) {
    throw new Error(`System health records check failed: ${error}`)
  }
}
