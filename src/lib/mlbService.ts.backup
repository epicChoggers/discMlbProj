import { MLBGame, MLBPlay, GameState } from './types'

const MARINERS_TEAM_ID = 136 // Seattle Mariners team ID in MLB API

class MLBService {
  private apiBaseUrl: string
  private mlbDirectApiUrl = 'https://statsapi.mlb.com/api/v1'
  private mlbGameFeedUrl = 'https://statsapi.mlb.com/api/v1.1'
  private isDevelopment: boolean
  private updateInterval: NodeJS.Timeout | null = null
  private listeners: ((gameState: GameState) => void)[] = []

  constructor() {
    // Check if we're in development mode
    this.isDevelopment = import.meta.env.DEV
    // Allow forcing production mode locally for testing
    const forceProduction = import.meta.env.VITE_FORCE_PRODUCTION_MODE === 'true'
    
    if (forceProduction) {
      this.isDevelopment = false
      console.log('🚀 Production mode forced locally for testing')
    }
    
    this.apiBaseUrl = this.isDevelopment ? this.mlbDirectApiUrl : '/api/mlb'
    console.log(`MLB Service initialized in ${this.isDevelopment ? 'development' : 'production'} mode`)
  }

  // Helper method to get Pacific Time date string to avoid timezone issues
  private getPacificDateString(): string {
    const now = new Date()
    // Get Pacific Time components directly
    const pacificYear = now.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", year: "numeric"})
    const pacificMonth = now.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", month: "2-digit"})
    const pacificDay = now.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", day: "2-digit"})
    
    return `${pacificYear}-${pacificMonth}-${pacificDay}`
  }

  // Helper method to get Pacific Time date string for a specific date
  private getPacificDateStringForDate(date: Date): string {
    // Get Pacific Time components directly
    const pacificYear = date.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", year: "numeric"})
    const pacificMonth = date.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", month: "2-digit"})
    const pacificDay = date.toLocaleDateString("en-US", {timeZone: "America/Los_Angeles", day: "2-digit"})
    
    return `${pacificYear}-${pacificMonth}-${pacificDay}`
  }

  // Get current games using our backend API or direct MLB API
  async getCurrentGames(): Promise<any[]> {
    try {
      console.log('Fetching current games from MLB API...')
      
      let url: string
      if (this.isDevelopment) {
        // Direct MLB API call in development
        // Use Pacific Time for Mariners games to avoid timezone issues
        const today = this.getPacificDateString()
        const utcToday = new Date().toISOString().split('T')[0]
        console.log(`Using Pacific Time date: ${today} (UTC would be: ${utcToday})`)
        url = `${this.apiBaseUrl}/schedule?sportId=1&teamId=${MARINERS_TEAM_ID}&startDate=${today}&endDate=${today}`
      } else {
        // Server rerouting in production
        url = `${this.apiBaseUrl}/schedule`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (this.isDevelopment) {
        // Direct API returns different structure
        const games = data.dates?.flatMap((date: any) => date.games || []) || []
        console.log(`Successfully fetched ${games.length} games`)
        if (games.length > 0) {
          games.forEach((game: any, index: number) => {
            console.log(`Game ${index + 1}: ${game.teams?.away?.team?.name} @ ${game.teams?.home?.team?.name} on ${game.gameDate}`)
          })
        }
        return games
      } else {
        // Server API returns wrapped response
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch games')
        }
        console.log(`Successfully fetched ${data.totalGames} games`)
        return data.games
      }
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

      let startDateStr: string
      let endDateStr: string
      
      if (this.isDevelopment) {
        // Use Pacific Time for direct API calls
        startDateStr = this.getPacificDateStringForDate(startDate)
        endDateStr = this.getPacificDateStringForDate(endDate)
      } else {
        // Use UTC for server API calls
        startDateStr = startDate.toISOString().split('T')[0]
        endDateStr = endDate.toISOString().split('T')[0]
      }

      let url: string
      if (this.isDevelopment) {
        // Direct MLB API call in development
        url = `${this.apiBaseUrl}/schedule?sportId=1&teamId=${MARINERS_TEAM_ID}&startDate=${startDateStr}&endDate=${endDateStr}`
      } else {
        // Server rerouting in production
        url = `${this.apiBaseUrl}/schedule?teamId=${MARINERS_TEAM_ID}&startDate=${startDateStr}&endDate=${endDateStr}`
      }

      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      let allGames: any[]
      if (this.isDevelopment) {
        // Direct API returns different structure
        allGames = data.dates?.flatMap((date: any) => date.games || []) || []
      } else {
        // Server API returns wrapped response
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch games')
        }
        allGames = data.games || []
      }
      
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
      
      let url: string
      if (this.isDevelopment) {
        // Direct MLB API call in development - use GUMBO v1.1 endpoint
        url = `${this.mlbGameFeedUrl}/game/${gamePk}/feed/live`
      } else {
        // Server rerouting in production
        url = `${this.apiBaseUrl}/game?gamePk=${gamePk}`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      let gameData: any
      if (this.isDevelopment) {
        // Direct API returns the full MLB API response
        gameData = {
          ...data.gameData,
          gamePk: gamePk,
          liveData: data.liveData
        }
      } else {
        // Server API returns wrapped response
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch game details')
        }
        // The game details API returns gameData, so we need to structure it properly
        // data.game is actually data.gameData from the MLB API
        gameData = {
          ...data.game,
          gamePk: data.gamePk, // Add the gamePk from the API response
          liveData: data.liveData
        }
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

  // Get the most recent completed at-bat that should be resolved
  getMostRecentCompletedAtBat(game: MLBGame): MLBPlay | null {
    if (!game.liveData?.plays) {
      return null
    }

    const { allPlays } = game.liveData.plays
    
    // Find all completed plays (those with a result type other than 'at_bat')
    const completedPlays = allPlays.filter(play => 
      play.result.type && play.result.type !== 'at_bat'
    )
    
    if (completedPlays.length === 0) {
      return null
    }

    // Return the most recent completed play
    return completedPlays[completedPlays.length - 1]
  }

  // Check if game is currently live
  isGameLive(game: MLBGame): boolean {
    return game.status?.abstractGameState === 'Live'
  }

  // Get game state from cached server endpoint (production only)
  async getCachedGameState(): Promise<GameState> {
    try {
      console.log('Fetching cached game state from server...')
      
      const response = await fetch(`${this.apiBaseUrl}/game-state`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch cached game state')
      }

      console.log('Successfully fetched cached game state')
      return data
    } catch (error) {
      console.error('Error fetching cached game state:', error)
      return {
        game: null,
        currentAtBat: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch cached game state',
        lastUpdated: new Date().toISOString()
      }
    }
  }

  // Get game state for the current Mariners game
  async getGameState(): Promise<GameState> {
    // In production, use the cached endpoint
    if (!this.isDevelopment) {
      return this.getCachedGameState()
    }

    // In development, use the original method
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