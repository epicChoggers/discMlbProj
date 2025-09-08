import { VercelRequest, VercelResponse } from '@vercel/node'

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
    res.status(200).json({
      success: true,
      message: 'Test API endpoint working',
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform
      }
    })
  } catch (error) {
    console.error('Error in test endpoint:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Test endpoint failed',
      timestamp: new Date().toISOString()
    })
  }
}
