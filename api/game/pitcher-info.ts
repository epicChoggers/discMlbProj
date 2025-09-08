import { VercelRequest, VercelResponse } from '@vercel/node'
import { gameDataService } from '../lib/gameDataService.js'

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
    const { gamePk } = req.query

    if (!gamePk) {
      res.status(400).json({ error: 'gamePk is required' })
      return
    }

    // Get the game data to find the projected starting pitcher
    const game = await gameDataService.getGameDetails(parseInt(gamePk as string))
    
    if (!game) {
      res.status(404).json({ error: 'Game not found' })
      return
    }

    // Extract pitcher information from the game data
    const marinersTeamId = parseInt(process.env.VITE_TEAM_ID || '136')
    
    // Find the Mariners team in the game
    const homeTeam = game.teams?.home
    const awayTeam = game.teams?.away
    
    const homeTeamId = (homeTeam as any)?.team?.id || (homeTeam as any)?.id
    const awayTeamId = (awayTeam as any)?.team?.id || (awayTeam as any)?.id
    
    const isMarinersHome = homeTeamId === marinersTeamId
    const marinersTeam = isMarinersHome ? homeTeam : awayTeam

    if (!marinersTeam) {
      res.status(404).json({ error: 'Mariners team not found in game' })
      return
    }

    // Get the projected starting pitcher
    let projectedPitcher = null
    
    // Try to get pitcher from gameData.players
    if (game.gameData?.players) {
      // Look for pitchers in the Mariners roster
      const players = Object.values(game.gameData.players) as any[]
      const marinersPitchers = players.filter(player => 
        player.currentTeam?.id === marinersTeamId && 
        player.primaryPosition?.type === 'Pitcher'
      )
      
      if (marinersPitchers.length > 0) {
        // For now, just return the first pitcher found
        // In a real implementation, you'd want to determine the starting pitcher
        projectedPitcher = marinersPitchers[0]
      }
    }

    // If no pitcher found in gameData, try to get from liveData
    if (!projectedPitcher && game.liveData?.boxscore?.teams) {
      const marinersBoxscore = isMarinersHome ? 
        game.liveData.boxscore.teams.home : 
        game.liveData.boxscore.teams.away
      
      // Look for pitchers in the boxscore
      if (marinersBoxscore?.players) {
        const players = Object.values(marinersBoxscore.players) as any[]
        const pitchers = players.filter(player => 
          player.person?.primaryPosition?.type === 'Pitcher'
        )
        
        if (pitchers.length > 0) {
          projectedPitcher = pitchers[0].person
        }
      }
    }

    if (!projectedPitcher) {
      res.status(404).json({ error: 'No Mariners pitcher found for this game' })
      return
    }

    // Format the pitcher data
    const pitcherInfo = {
      id: projectedPitcher.id,
      fullName: projectedPitcher.fullName,
      firstName: projectedPitcher.firstName,
      lastName: projectedPitcher.lastName,
      primaryNumber: projectedPitcher.primaryNumber,
      currentTeam: {
        id: projectedPitcher.currentTeam?.id || marinersTeamId,
        name: projectedPitcher.currentTeam?.name || 'Seattle Mariners'
      },
      primaryPosition: {
        code: projectedPitcher.primaryPosition?.code || 'P',
        name: projectedPitcher.primaryPosition?.name || 'Pitcher',
        type: projectedPitcher.primaryPosition?.type || 'Pitcher'
      }
    }

    res.status(200).json({
      success: true,
      pitcher: pitcherInfo,
      game: {
        gamePk: game.gamePk,
        gameDate: game.gameDate,
        status: game.status,
        teams: {
          home: homeTeam,
          away: awayTeam
        },
        venue: game.venue
      }
    })

  } catch (error) {
    console.error('Error fetching pitcher info:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch pitcher information'
    })
  }
}
