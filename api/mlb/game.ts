import { VercelRequest, VercelResponse } from '@vercel/node'

const MLB_BASE_URL = 'https://statsapi.mlb.com/api/v1'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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
    const { gamePk, hydrate } = req.query

    if (!gamePk) {
      res.status(400).json({ error: 'gamePk parameter is required' })
      return
    }

    // Build the MLB API URL
    const params = new URLSearchParams()
    if (hydrate) params.append('hydrate', hydrate as string)

    const mlbUrl = `${MLB_BASE_URL}/game/${gamePk}?${params.toString()}`
    
    console.log('Fetching MLB game details:', mlbUrl)

    const response = await fetch(mlbUrl, {
      headers: {
        'User-Agent': 'MLB-Prediction-App/1.0',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`MLB API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    res.status(200).json(data)

  } catch (error) {
    console.error('Error fetching MLB game details:', error)
    res.status(500).json({ 
      error: 'Failed to fetch MLB game details',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
