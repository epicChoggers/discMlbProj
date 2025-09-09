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
    await handleGetEventStatus(req, res)
  } else if (req.method === 'POST') {
    await handleTriggerEvent(req, res)
  } else {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
}

async function handleGetEventStatus(req: VercelRequest, res: VercelResponse) {
  try {
    const { detailed } = req.query
    const includeDetails = detailed === 'true'

    console.log('Event status request:', { includeDetails })

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
