import { MLBGame, MLBPlay, GameState } from './types'

// const MARINERS_TEAM_ID = 136 // Seattle Mariners team ID in MLB API

class MLBServiceNew {
  private apiBaseUrl: string
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
    
    // Use full URL in production, relative URL in development
    this.apiBaseUrl = this.isDevelopment ? '/api/game' : `${window.location.origin}/api/game`
    console.log(`MLB Service (New) initialized in ${this.isDevelopment ? 'development' : 'production'} mode with API base: ${this.apiBaseUrl}`)
  }

  // Get game state from the unified API
  async getGameState(): Promise<GameState> {
    try {
      console.log('Fetching game state from unified API...')
      
      const response = await fetch(`${this.apiBaseUrl}/state`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch game state')
      }

      console.log('Successfully fetched game state from unified API')
      return {
        game: data.game,
        currentAtBat: data.currentAtBat,
        isLoading: false,
        error: data.error,
        lastUpdated: data.lastUpdated
      }
    } catch (error) {
      console.error('Error fetching game state:', error)
      return {
        game: null,
        currentAtBat: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch game state',
        lastUpdated: new Date().toISOString()
      }
    }
  }

  // Get today's Mariners game (backward compatibility)
  async getTodaysMarinersGame(): Promise<MLBGame | null> {
    try {
      const gameState = await this.getGameState()
      return gameState.game
    } catch (error) {
      console.error('Error fetching today\'s Mariners game:', error)
      return null
    }
  }

  // Get the most recent Mariners game (backward compatibility)
  async getMostRecentMarinersGame(): Promise<MLBGame | null> {
    try {
      const gameState = await this.getGameState()
      return gameState.game
    } catch (error) {
      console.error('Error fetching most recent Mariners game:', error)
      return null
    }
  }

  // Get detailed game data (backward compatibility)
  async getGameDetails(_gamePk: number): Promise<MLBGame | null> {
    try {
      const gameState = await this.getGameState()
      return gameState.game
    } catch (error) {
      console.error('Error fetching game details:', error)
      return null
    }
  }

  // Get current at-bat from game data (backward compatibility)
  getCurrentAtBat(game: MLBGame): MLBPlay | null {
    if (!game.liveData?.plays) {
      return null
    }

    const { allPlays, currentPlay } = game.liveData.plays
    
    // If there's a current play, use it
    if (currentPlay) {
      return currentPlay
    }

    // If no current play, we need to determine the next at-bat
    // Find all completed plays (those with a result type other than 'at_bat')
    const completedPlays = allPlays.filter(play => 
      play.result.type && play.result.type !== 'at_bat'
    )
    
    if (completedPlays.length === 0) {
      return null
    }

    // Get the most recent completed at-bat
    const mostRecentCompleted = completedPlays[completedPlays.length - 1]
    
    // Check if the game is still live and we should advance to the next at-bat
    if (game.status?.abstractGameState === 'Live') {
      // Create a simulated next at-bat based on the most recent completed at-bat
      const nextAtBatIndex = mostRecentCompleted.about.atBatIndex + 1
      
      // Create a simulated at-bat for the next at-bat
      const simulatedAtBat: MLBPlay = {
        ...mostRecentCompleted,
        about: {
          ...mostRecentCompleted.about,
          atBatIndex: nextAtBatIndex
        },
        result: {
          type: 'at_bat', // This indicates it's an ongoing at-bat
          event: 'at_bat',
          description: 'At-bat in progress',
          rbi: 0,
          awayScore: mostRecentCompleted.result.awayScore,
          homeScore: mostRecentCompleted.result.homeScore
        }
      }
      
      return simulatedAtBat
    }
    
    // For non-live games, return the most recent completed at-bat
    return mostRecentCompleted
  }

  // Get the most recent completed at-bat (backward compatibility)
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

  // Check if game is currently live (backward compatibility)
  isGameLive(game: MLBGame): boolean {
    return game.status?.abstractGameState === 'Live'
  }

  // Get cached game state (backward compatibility)
  async getCachedGameState(): Promise<GameState> {
    return await this.getGameState()
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

  // Force refresh game state (useful for testing)
  async forceRefresh(): Promise<GameState> {
    try {
      console.log('Force refreshing game state...')
      
      const response = await fetch(`${this.apiBaseUrl}/state?forceRefresh=true`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to refresh game state')
      }

      console.log('Successfully force refreshed game state')
      return {
        game: data.game,
        currentAtBat: data.currentAtBat,
        isLoading: false,
        error: data.error,
        lastUpdated: data.lastUpdated
      }
    } catch (error) {
      console.error('Error force refreshing game state:', error)
      return {
        game: null,
        currentAtBat: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh game state',
        lastUpdated: new Date().toISOString()
      }
    }
  }

  // Get API health status
  async getHealthStatus(): Promise<any> {
    try {
      const response = await fetch('/api/system/health')
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error checking health status:', error)
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Health check failed'
      }
    }
  }

  // Get system statistics
  async getSystemStats(timeframe: string = '24h'): Promise<any> {
    try {
      const response = await fetch(`/api/system?action=stats&timeframe=${timeframe}`)
      
      if (!response.ok) {
        throw new Error(`Stats request failed: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error getting system stats:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats'
      }
    }
  }
}

export const mlbServiceNew = new MLBServiceNew()
