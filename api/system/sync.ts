import { VercelRequest, VercelResponse } from '@vercel/node'
import { eventService } from '../../src/lib/services/EventService'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method === 'GET') {
    await handleGetSyncStatus(req, res)
  } else if (req.method === 'POST') {
    await handleTriggerSync(req, res)
  } else {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
}

async function handleGetSyncStatus(req: VercelRequest, res: VercelResponse) {
  try {
    const { detailed } = req.query
    const includeDetails = detailed === 'true'

    console.log('Sync status request:', { includeDetails })

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
        result = await eventService.triggerGameStateSync()
        break

      case 'predictions':
        result = await eventService.triggerPredictionResolution()
        break

      case 'all':
        result = await eventService.triggerAllEventDrivenJobs()
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
