import { MLBGame, MLBPlay, GameState } from './types'

const MARINERS_TEAM_ID = 147 // Seattle Mariners team ID in MLB API

class MLBService {
  private apiBaseUrl = '/api/mlb'
  private updateInterval: NodeJS.Timeout | null = null
  private listeners: ((gameState: GameState) => void)[] = []

  // Get current games using our backend API
  async getCurrentGames(): Promise<any[]> {
    try {
      console.log('Fetching current games from MLB API...')
      
      const response = await fetch(`${this.apiBaseUrl}/schedule`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch games')
      }

      console.log(`Successfully fetched ${data.totalGames} games`)
      return data.games
    } catch (error) {
      console.error('Error fetching current games:', error)
      // Return empty array on error to prevent app crashes
      return []
    }
  }

  // Get today's Mariners game or most recent game
  async getTodaysMarinersGame(): Promise<MLBGame | null> {
    try {
      console.log('Fetching current games...')
      const currentGames = await this.getCurrentGames()
      console.log('Total games found:', currentGames.length)
      
      // Find Mariners games with proper null checks
      const marinersGames = currentGames.filter((game: any) => 
        (game.teams?.away?.team?.id === MARINERS_TEAM_ID) || 
        (game.teams?.home?.team?.id === MARINERS_TEAM_ID)
      )

      console.log('Mariners games found:', marinersGames.length)
      marinersGames.forEach((game: any, index: number) => {
        console.log(`Game ${index + 1}:`, {
          gamePk: game.gamePk,
          date: game.gameDate,
          status: game.status?.abstractGameState,
          home: game.teams?.home?.team?.name || 'Unknown',
          away: game.teams?.away?.team?.name || 'Unknown'
        })
      })

      if (marinersGames.length === 0) {
        console.log('No Mariners games found')
        return null
      }

      // Sort by date (most recent first)
      marinersGames.sort((a: any, b: any) => 
        new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()
      )

      const marinersGame = marinersGames[0]
      console.log('Selected game:', {
        gamePk: marinersGame.gamePk,
        status: marinersGame.status.abstractGameState,
        date: marinersGame.gameDate
      })

      // Get detailed game data if game is live or completed
      if (marinersGame.status.abstractGameState === 'Live' || 
          marinersGame.status.abstractGameState === 'Final') {
        console.log('Fetching detailed game data...')
        const detailedGame = await this.getGameDetails(marinersGame.gamePk)
        console.log('Detailed game data:', detailedGame ? 'Success' : 'Failed')
        return detailedGame
      }

      return marinersGame
    } catch (error) {
      console.error('Error fetching Mariners game:', error)
      return null
    }
  }

  // Get the most recent Mariners game
  async getMostRecentMarinersGame(): Promise<MLBGame | null> {
    try {
      // Get games from the last 7 days
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)

      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const response = await fetch(`${this.apiBaseUrl}/schedule?teamId=${MARINERS_TEAM_ID}&startDate=${startDateStr}&endDate=${endDateStr}`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch games')
      }

      const allGames = data.games || []
      
      // Find Mariners games and sort by date (most recent first)
      const marinersGames = allGames
        .filter((game: any) => 
          (game.teams?.away?.team?.id === MARINERS_TEAM_ID) || 
          (game.teams?.home?.team?.id === MARINERS_TEAM_ID)
        )
        .sort((a: any, b: any) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())

      return marinersGames.length > 0 ? marinersGames[0] : null
    } catch (error) {
      console.error('Error fetching most recent Mariners game:', error)
      return null
    }
  }

  // Get detailed game data including live data
  async getGameDetails(gamePk: number): Promise<MLBGame | null> {
    try {
      console.log(`Fetching detailed game data for game ${gamePk}...`)
      
      const response = await fetch(`${this.apiBaseUrl}/game?gamePk=${gamePk}`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch game details')
      }

      // The game details API returns gameData, so we need to structure it properly
      // data.game is actually data.gameData from the MLB API
      const gameData = {
        ...data.game,
        liveData: data.liveData
      }

      console.log('Successfully fetched detailed game data')
      return gameData
    } catch (error) {
      console.error('Error fetching game details:', error)
      return null
    }
  }

  // Get current at-bat from game data
  getCurrentAtBat(game: MLBGame): MLBPlay | null {
    if (!game.liveData?.plays) {
      return null
    }

    const { allPlays, currentPlay } = game.liveData.plays
    
    // If there's a current play, use it
    if (currentPlay) {
      return currentPlay
    }

    // Otherwise, find the most recent at-bat
    const completedPlays = allPlays.filter(play => 
      play.result.type && play.result.type !== 'at_bat'
    )
    
    return completedPlays.length > 0 ? completedPlays[completedPlays.length - 1] : null
  }

  // Check if game is currently live
  isGameLive(game: MLBGame): boolean {
    return game.status?.abstractGameState === 'Live'
  }

  // Get game state for the current Mariners game
  async getGameState(): Promise<GameState> {
    try {
      const game = await this.getTodaysMarinersGame()
      
      if (!game) {
        return {
          game: null,
          currentAtBat: null,
          isLoading: false,
          error: 'No Mariners game found for today',
          lastUpdated: new Date().toISOString()
        }
      }

      // Debug: Log the game structure before returning
      console.log('getGameState returning game:', {
        gamePk: game.gamePk,
        hasTeams: !!game.teams,
        teamsStructure: game.teams ? {
          hasHome: !!game.teams.home,
          hasAway: !!game.teams.away,
          homeTeamId: game.teams.home?.team?.id,
          awayTeamId: game.teams.away?.team?.id
        } : null,
        gameKeys: Object.keys(game)
      })

      const currentAtBat = this.getCurrentAtBat(game)
      const isLive = this.isGameLive(game)

      return {
        game,
        currentAtBat,
        isLoading: false,
        error: isLive ? undefined : 'Game is not currently live',
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      return {
        game: null,
        currentAtBat: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch game data',
        lastUpdated: new Date().toISOString()
      }
    }
  }

  // Start real-time updates for live games
  startLiveUpdates(callback: (gameState: GameState) => void) {
    this.listeners.push(callback)
    
    if (this.updateInterval) {
      return // Already running
    }

    // Update every 10 seconds for live games
    this.updateInterval = setInterval(async () => {
      const gameState = await this.getGameState()
      
      // Only send updates if game is live
      if (gameState.game && this.isGameLive(gameState.game)) {
        this.listeners.forEach(listener => listener(gameState))
      }
    }, 10000)

    // Initial update
    this.getGameState().then(gameState => {
      if (gameState.game && this.isGameLive(gameState.game)) {
        this.listeners.forEach(listener => listener(gameState))
      }
    })
  }

  // Stop real-time updates
  stopLiveUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    this.listeners = []
  }

  // Remove a specific listener
  removeListener(callback: (gameState: GameState) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback)
  }
}

export const mlbService = new MLBService()