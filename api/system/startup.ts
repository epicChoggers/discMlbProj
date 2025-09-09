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

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    console.log('Starting sync service on startup...')
    
    // Start the event service which will start the data sync service
    await eventService.start()
    
    res.status(200).json({
      success: true,
      message: 'Sync service started successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error starting sync service:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start sync service',
      timestamp: new Date().toISOString()
    })
  }
}
