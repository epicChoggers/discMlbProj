import { VercelRequest, VercelResponse } from '@vercel/node'

const MARINERS_TEAM_ID = 147
const MLB_BASE_URL = 'https://statsapi.mlb.com/api/v1'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { teamId, startDate, endDate } = req.query
    const targetTeamId = teamId || MARINERS_TEAM_ID
    const today = new Date().toISOString().split('T')[0]
    const targetStartDate = startDate || today
    const targetEndDate = endDate || today

    const url = `${MLB_BASE_URL}/schedule?sportId=1&teamId=${targetTeamId}&startDate=${targetStartDate}&endDate=${targetEndDate}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`MLB API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const games = data.dates?.flatMap((date: any) => date.games || []) || []

    res.status(200).json({
      success: true,
      games,
      totalGames: games.length
    })

  } catch (error) {
    console.error('Error fetching MLB schedule:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch schedule',
      games: []
    })
  }
}
