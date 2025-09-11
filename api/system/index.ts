import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { action, debug } = req.query

  try {
    if (debug === 'true') {
      res.status(200).json({ ok: true, message: 'system handler alive', node: process.version })
      return
    }
    switch (action) {
      case 'startup':
        await handleStartup(req, res)
        break
      case 'sync':
        await handleSync(req, res)
        break
      case 'events':
        await handleEvents(req, res)
        break
      case 'stats':
        await handleStats(req, res)
        break
      default:
        res.status(400).json({ error: 'Invalid action. Supported actions: startup, sync, events, stats' })
    }
  } catch (error) {
    console.error('Error in system API:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

// Startup handler
async function handleStartup(req: VercelRequest, res: VercelResponse) {
  // Accept POST for production; allow GET for quick health/debug
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  console.log('Starting sync service on startup...')
  try {
    const { eventService } = await import('../lib/EventService.js')
    await eventService.start()
    console.log('EventService started with automatic prediction resolution')
  } catch (e) {
    res.status(500).json({ success: false, error: 'ImportError: EventService', message: (e as any)?.message, stack: (e as any)?.stack })
    return
  }

  res.status(200).json({
    success: true,
    message: 'Sync service started successfully',
    timestamp: new Date().toISOString()
  })
}
 
// Sync handler
async function handleSync(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    await handleGetSyncStatus(req, res)
  } else if (req.method === 'POST') {
    await handleTriggerSync(req, res)
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}

async function handleGetSyncStatus(req: VercelRequest, res: VercelResponse) {
  try {
    const { detailed } = req.query
    const includeDetails = detailed === 'true'

    console.log('Sync status request:', { includeDetails })

    const { eventService } = await import('../lib/EventService.ts')
    const jobStatus = eventService.getJobStatus()
    const systemHealth = await eventService.getSystemHealthSummary()

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      jobs: jobStatus,
      systemHealth: includeDetails ? systemHealth : {
        total_services: systemHealth.total_services,
        healthy_services: systemHealth.healthy_services,
        error_services: systemHealth.error_services
      }
    }

    res.status(200).json(response)

  } catch (error) {
    console.error('Error getting sync status:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sync status',
      timestamp: new Date().toISOString()
    })
  }
}

async function handleTriggerSync(req: VercelRequest, res: VercelResponse) {
  try {
    const { syncType } = req.body

    console.log('Sync trigger request:', { syncType })

    let result: any

    switch (syncType) {
      case 'game_state':
        result = await (await import('../lib/EventService.js')).eventService.triggerGameStateSync()
        break

      case 'predictions':
        result = await (await import('../lib/EventService.js')).eventService.triggerPredictionResolution()
        break

      case 'all':
        result = await (await import('../lib/EventService.js')).eventService.triggerAllEventDrivenJobs()
        break

      default:
        res.status(400).json({ 
          error: 'Invalid sync type. Supported types: game_state, predictions, all' 
        })
        return
    }

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      syncType,
      result
    })

  } catch (error) {
    console.error('Error triggering sync:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger sync',
      timestamp: new Date().toISOString()
    })
  }
}

// Events handler
async function handleEvents(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    await handleGetEventStatus(req, res)
  } else if (req.method === 'POST') {
    await handleTriggerEvent(req, res)
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}

async function handleGetEventStatus(req: VercelRequest, res: VercelResponse) {
  try {
    const { detailed } = req.query
    const includeDetails = detailed === 'true'

    console.log('Event status request:', { includeDetails })

    const { eventService } = await import('../lib/EventService.ts')
    const jobStatus = eventService.getJobStatus()
    const systemHealth = await eventService.getSystemHealthSummary()

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      jobs: jobStatus,
      systemHealth: includeDetails ? systemHealth : {
        total_services: systemHealth.total_services,
        healthy_services: systemHealth.healthy_services,
        error_services: systemHealth.error_services
      }
    }

    res.status(200).json(response)

  } catch (error) {
    console.error('Error getting event status:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get event status',
      timestamp: new Date().toISOString()
    })
  }
}

async function handleTriggerEvent(req: VercelRequest, res: VercelResponse) {
  try {
    const { jobId, action } = req.body

    if (!jobId || !action) {
      res.status(400).json({ error: 'jobId and action are required' })
      return
    }

    console.log('Event trigger request:', { jobId, action })

    let result: any

    const { eventService } = await import('../lib/EventService.ts')
    switch (action) {
      case 'start':
        await eventService.start()
        result = { message: 'Event-driven service started', jobs: eventService.getJobStatus() }
        break

      case 'stop':
        eventService.stop()
        result = { message: 'Event-driven service stopped' }
        break

      case 'enable':
        eventService.setJobEnabled(jobId, true)
        result = { message: `Job ${jobId} enabled` }
        break

      case 'disable':
        eventService.setJobEnabled(jobId, false)
        result = { message: `Job ${jobId} disabled` }
        break

      case 'trigger':
        // Manually trigger event-driven jobs
        if (jobId === 'all') {
          result = await eventService.triggerAllEventDrivenJobs()
        } else if (jobId === 'game_state_sync') {
          result = await eventService.triggerGameStateSync()
        } else if (jobId === 'prediction_resolution') {
          result = await eventService.triggerPredictionResolution()
        } else {
          res.status(400).json({ error: `Cannot trigger job: ${jobId}. Supported jobs: all, game_state_sync, prediction_resolution` })
          return
        }
        break

      case 'status':
        result = {
          jobs: eventService.getJobStatus(),
          systemHealth: await eventService.getSystemHealthSummary()
        }
        break

      default:
        res.status(400).json({ error: 'Invalid action. Supported actions: start, stop, enable, disable, trigger, status' })
        return
    }

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      action,
      jobId,
      result
    })

  } catch (error) {
    console.error('Error triggering event:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger event',
      timestamp: new Date().toISOString()
    })
  }
}

// Stats handler
async function handleStats(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { detailed } = req.query
    const includeDetails = detailed === 'true'

    console.log('Stats request:', { includeDetails })

    // Get basic stats
    const stats: any = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    }

    if (includeDetails) {
      // Get detailed system health
      const { eventService } = await import('../lib/EventService.ts')
      const systemHealth = await eventService.getSystemHealthSummary()
      
      // Get prediction counts
      const { data: predictionStats, error: predError } = await supabase
        .from('at_bat_predictions')
        .select('id, is_correct, points_earned, created_at')

      if (!predError && predictionStats) {
        const totalPredictions = predictionStats.length
        const correctPredictions = predictionStats.filter(p => p.is_correct === true).length
        const totalPoints = predictionStats.reduce((sum, p) => sum + (p.points_earned || 0), 0)
        
        stats.predictionStats = {
          totalPredictions,
          correctPredictions,
          accuracy: totalPredictions > 0 ? (correctPredictions / totalPredictions * 100).toFixed(2) : 0,
          totalPoints
        }
      }

      stats.systemHealth = systemHealth
    }

    res.status(200).json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Error getting stats:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
      timestamp: new Date().toISOString()
    })
  }
}
