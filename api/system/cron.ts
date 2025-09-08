import { VercelRequest, VercelResponse } from '@vercel/node'
import { cronService } from '../../src/lib/services/CronService'

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
    await handleGetCronStatus(req, res)
  } else if (req.method === 'POST') {
    await handleTriggerCronJob(req, res)
  } else {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
}

async function handleGetCronStatus(req: VercelRequest, res: VercelResponse) {
  try {
    const { detailed } = req.query
    const includeDetails = detailed === 'true'

    console.log('Cron status request:', { includeDetails })

    const jobStatus = cronService.getJobStatus()
    const systemHealth = await cronService.getSystemHealthSummary()

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
    console.error('Error getting cron status:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cron status',
      timestamp: new Date().toISOString()
    })
  }
}

async function handleTriggerCronJob(req: VercelRequest, res: VercelResponse) {
  try {
    const { jobId, action } = req.body

    if (!jobId || !action) {
      res.status(400).json({ error: 'jobId and action are required' })
      return
    }

    console.log('Cron job trigger request:', { jobId, action })

    let result: any

    switch (action) {
      case 'start':
        await cronService.start()
        result = { message: 'Cron service started', jobs: cronService.getJobStatus() }
        break

      case 'stop':
        cronService.stop()
        result = { message: 'Cron service stopped' }
        break

      case 'enable':
        cronService.setJobEnabled(jobId, true)
        result = { message: `Job ${jobId} enabled` }
        break

      case 'disable':
        cronService.setJobEnabled(jobId, false)
        result = { message: `Job ${jobId} disabled` }
        break

      case 'status':
        result = {
          jobs: cronService.getJobStatus(),
          systemHealth: await cronService.getSystemHealthSummary()
        }
        break

      default:
        res.status(400).json({ error: 'Invalid action. Supported actions: start, stop, enable, disable, status' })
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
    console.error('Error triggering cron job:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger cron job',
      timestamp: new Date().toISOString()
    })
  }
}
