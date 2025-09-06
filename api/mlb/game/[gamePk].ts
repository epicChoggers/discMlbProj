import { VercelRequest, VercelResponse } from '@vercel/node'

const MLB_BASE_URL = 'https://statsapi.mlb.com/api/v1'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
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
    const { gamePk } = req.query
    
    if (!gamePk || typeof gamePk !== 'string') {
      res.status(400).json({ error: 'Game PK is required' })
      return
    }

    // Get detailed game data including live data
    const url = `${MLB_BASE_URL}/game/${gamePk}/feed/live`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`MLB API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    res.status(200).json({
      success: true,
      game: data.gameData,
      liveData: data.liveData,
      gamePk: parseInt(gamePk)
    })

  } catch (error) {
    console.error('Error fetching MLB game details:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch game details',
      game: null,
      liveData: null
    })
  }
}
