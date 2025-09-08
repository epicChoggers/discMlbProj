import { NextApiRequest, NextApiResponse } from 'next'
import { GameDataService } from '../lib/gameDataService'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { gamePk } = req.query

  if (!gamePk || typeof gamePk !== 'string') {
    return res.status(400).json({ 
      error: 'gamePk parameter is required',
      example: '/api/game/generic-state?gamePk=776413'
    })
  }

  const gamePkNumber = parseInt(gamePk, 10)
  if (isNaN(gamePkNumber)) {
    return res.status(400).json({ 
      error: 'gamePk must be a valid number',
      example: '/api/game/generic-state?gamePk=776413'
    })
  }

  try {
    console.log(`[Generic State API] Fetching state for game ${gamePkNumber}`)
    
    const gameDataService = new GameDataService()
    
    // Fetch detailed game data directly
    const detailedGame = await gameDataService.getGameDetails(gamePkNumber)
    
    if (!detailedGame) {
      return res.status(404).json({ 
        error: 'Game not found',
        gamePk: gamePkNumber
      })
    }

    // Check if game is live
    const isLive = gameDataService.isGameLive(detailedGame)
    
    // Get current at-bat
    let currentAtBat = null
    if (isLive) {
      console.log(`[Generic State API] Game is live, fetching current at-bat`)
      currentAtBat = gameDataService.getCurrentAtBat(detailedGame)
      console.log(`[Generic State API] Current at-bat result:`, currentAtBat ? `At-bat ${currentAtBat.about?.atBatIndex}` : 'No current at-bat')
    } else {
      console.log(`[Generic State API] Game is not live (status: ${detailedGame.status?.detailedState})`)
    }

    // Get all at-bats
    const allAtBats = gameDataService.getAllAtBats(detailedGame)
    
    // Extract key game information
    const gameInfo = {
      gamePk: detailedGame.gamePk,
      teams: {
        home: {
          id: detailedGame.teams?.home?.team?.id,
          name: detailedGame.teams?.home?.team?.name,
          abbreviation: detailedGame.teams?.home?.team?.abbreviation
        },
        away: {
          id: detailedGame.teams?.away?.team?.id,
          name: detailedGame.teams?.away?.team?.name,
          abbreviation: detailedGame.teams?.away?.team?.abbreviation
        }
      },
      status: {
        abstractGameState: detailedGame.status?.abstractGameState,
        detailedState: detailedGame.status?.detailedState,
        inning: detailedGame.liveData?.linescore?.currentInning,
        inningState: detailedGame.liveData?.linescore?.inningState
      },
      isLive,
      currentAtBat,
      allAtBats: {
        count: allAtBats.length,
        atBats: allAtBats.map(atBat => ({
          atBatIndex: atBat.about?.atBatIndex,
          batter: atBat.matchup?.batter?.fullName,
          pitcher: atBat.matchup?.pitcher?.fullName,
          isComplete: atBat.about?.isComplete,
          result: atBat.result?.event,
          inning: atBat.about?.inning,
          halfInning: atBat.about?.halfInning
        }))
      },
      // Include raw GUMBO data for debugging
      debug: {
        hasLiveData: !!detailedGame.liveData,
        hasPlays: !!detailedGame.liveData?.plays,
        hasCurrentPlay: !!detailedGame.liveData?.plays?.currentPlay,
        allPlaysCount: detailedGame.liveData?.plays?.allPlays?.length || 0,
        currentPlayAtBatIndex: detailedGame.liveData?.plays?.currentPlay?.about?.atBatIndex
      }
    }

    console.log(`[Generic State API] Successfully processed game ${gamePkNumber}`)
    console.log(`[Generic State API] Game: ${gameInfo.teams.away.name} @ ${gameInfo.teams.home.name}`)
    console.log(`[Generic State API] Status: ${gameInfo.status.detailedState}`)
    console.log(`[Generic State API] At-bats: ${gameInfo.allAtBats.count}`)
    console.log(`[Generic State API] Current at-bat: ${currentAtBat ? `At-bat ${currentAtBat.about?.atBatIndex}` : 'None'}`)

    res.status(200).json(gameInfo)

  } catch (error) {
    console.error('[Generic State API] Error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      gamePk: gamePkNumber
    })
  }
}
