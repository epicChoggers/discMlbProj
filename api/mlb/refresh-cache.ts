import { VercelRequest, VercelResponse } from '@vercel/node'

const MARINERS_TEAM_ID = 136
const MLB_BASE_URL = 'https://statsapi.mlb.com/api/v1'
const MLB_GAME_FEED_URL = 'https://statsapi.mlb.com/api/v1.1'

// In-memory cache for game state (shared with game-state.ts)
declare global {
  var gameStateCache: {
    data: any
    lastUpdated: string
    isLive: boolean
  } | null
}

// Helper function to get Pacific Time date string
function getPacificDateString(): string {
  const now = new Date()
  const pacificYear = now.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", year: "numeric"})
  const pacificMonth = now.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", month: "2-digit"})
  const pacificDay = now.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", day: "2-digit"})
  
  return `${pacificYear}-${pacificMonth}-${pacificDay}`
}

// Fetch current games from MLB API
async function fetchCurrentGames(): Promise<any[]> {
  const today = getPacificDateString()
  const url = `${MLB_BASE_URL}/schedule?sportId=1&teamId=${MARINERS_TEAM_ID}&startDate=${today}&endDate=${today}`
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`MLB API error: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  return data.dates?.flatMap((date: any) => date.games || []) || []
}

// Get today's Mariners game
async function getTodaysMarinersGame(): Promise<any | null> {
  const currentGames = await fetchCurrentGames()
  
  // Find Mariners games
  const marinersGames = currentGames.filter((game: any) => 
    (game.teams?.away?.team?.id === MARINERS_TEAM_ID) || 
    (game.teams?.home?.team?.id === MARINERS_TEAM_ID)
  )

  if (marinersGames.length === 0) {
    return null
  }

  // Sort by date (most recent first)
  marinersGames.sort((a: any, b: any) => 
    new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()
  )

  const marinersGame = marinersGames[0]

  // Get detailed game data if game is live or completed
  if (marinersGame.status.abstractGameState === 'Live' || 
      marinersGame.status.abstractGameState === 'Final') {
    return await getGameDetails(marinersGame.gamePk)
  }

  return marinersGame
}

// Get detailed game data
async function getGameDetails(gamePk: number): Promise<any | null> {
  const url = `${MLB_GAME_FEED_URL}/game/${gamePk}/feed/live`
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`MLB API error: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  
  return {
    ...data.gameData,
    gamePk: gamePk,
    liveData: data.liveData
  }
}

// Get current at-bat from game data
function getCurrentAtBat(game: any): any | null {
  if (!game.liveData?.plays) {
    return null
  }

  const { allPlays, currentPlay } = game.liveData.plays
  
  // If there's a current play, use it
  if (currentPlay) {
    return currentPlay
  }

  // Otherwise, find the most recent at-bat
  const completedPlays = allPlays.filter((play: any) => 
    play.result.type && play.result.type !== 'at_bat'
  )
  
  return completedPlays.length > 0 ? completedPlays[completedPlays.length - 1] : null
}

// Check if game is currently live
function isGameLive(game: any): boolean {
  return game.status?.abstractGameState === 'Live'
}

// Fetch fresh game state from MLB API
async function fetchGameState(): Promise<any> {
  try {
    const game = await getTodaysMarinersGame()
    
    if (!game) {
      return {
        game: null,
        currentAtBat: null,
        isLoading: false,
        error: 'No Mariners game found for today',
        lastUpdated: new Date().toISOString()
      }
    }

    const currentAtBat = getCurrentAtBat(game)
    const isLive = isGameLive(game)

    return {
      game,
      currentAtBat,
      isLoading: false,
      error: isLive ? undefined : 'Game is not currently live',
      lastUpdated: new Date().toISOString(),
      isLive
    }
  } catch (error) {
    return {
      game: null,
      currentAtBat: null,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Failed to fetch game data',
      lastUpdated: new Date().toISOString(),
      isLive: false
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    // Force refresh the cache
    console.log('Background job: Refreshing game state cache')
    const gameState = await fetchGameState()
    
    // Update global cache
    global.gameStateCache = {
      data: gameState,
      lastUpdated: gameState.lastUpdated,
      isLive: gameState.isLive
    }

    res.status(200).json({
      success: true,
      message: 'Cache refreshed successfully',
      lastUpdated: gameState.lastUpdated,
      isLive: gameState.isLive
    })

  } catch (error) {
    console.error('Error refreshing cache:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh cache'
    })
  }
}
