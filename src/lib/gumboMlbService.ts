import { MLBGame, MLBPlay, GameState } from './types'

// Enhanced types for GUMBO-based data
export interface GumboAtBatData {
  about: {
    atBatIndex: number
    inning: number
    halfInning: string
    isComplete: boolean
    isScoringPlay: boolean
    hasReview: boolean
    hasOut: boolean
    captivatingIndex: number
  }
  matchup: {
    batter: {
      id: number
      fullName: string
      link: string
    }
    pitcher: {
      id: number
      fullName: string
      link: string
    }
    batSide: {
      code: string
      description: string
    }
    pitchHand: {
      code: string
      description: string
    }
  }
  result: {
    type: string
    event: string
    eventType: string
    description: string
    rbi: number
    awayScore: number
    homeScore: number
  }
  pitcherDetails?: any
  batterDetails?: any
  credits?: any
  alignment?: any
}

export interface GumboGameState {
  success: boolean
  game: MLBGame
  currentAtBat: GumboAtBatData | null
  previousAtBat: GumboAtBatData | null
  isGameLive: boolean
  lastUpdated: string
  metaData: {
    apiVersion: string
    hydrations: string[]
    atBatTracking: string
    dataSource: string
  }
}

class GumboMLBService {
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
    console.log(`GUMBO MLB Service initialized in ${this.isDevelopment ? 'development' : 'production'} mode with API base: ${this.apiBaseUrl}`)
  }

  // Get comprehensive game state using GUMBO
  async getGumboGameState(gamePk?: number): Promise<GumboGameState> {
    try {
      console.log('Fetching GUMBO game state...')
      
      const url = gamePk 
        ? `${this.apiBaseUrl}/gumbo-state?gamePk=${gamePk}`
        : `${this.apiBaseUrl}/gumbo-state`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch GUMBO game state')
      }

      console.log('Successfully fetched GUMBO game state')
      return data
    } catch (error) {
      console.error('Error fetching GUMBO game state:', error)
      return {
        success: false,
        game: null as any,
        currentAtBat: null,
        previousAtBat: null,
        isGameLive: false,
        lastUpdated: new Date().toISOString(),
        metaData: {
          apiVersion: 'gumbo-v1.1',
          hydrations: [],
          atBatTracking: 'index-based',
          dataSource: 'MLB Stats API GUMBO'
        }
      }
    }
  }

  // Get specific at-bat data
  async getAtBatData(gamePk: number, type: 'current' | 'previous' | 'specific', atBatIndex?: number): Promise<any> {
    try {
      console.log(`Fetching ${type} at-bat data for game ${gamePk}...`)
      
      let url = `${this.apiBaseUrl}/at-bat-data?gamePk=${gamePk}&type=${type}`
      if (type === 'specific' && atBatIndex !== undefined) {
        url += `&atBatIndex=${atBatIndex}`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch at-bat data')
      }

      console.log(`Successfully fetched ${type} at-bat data`)
      return data
    } catch (error) {
      console.error(`Error fetching ${type} at-bat data:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch at-bat data',
        lastUpdated: new Date().toISOString()
      }
    }
  }

  // Convert GUMBO game state to legacy GameState format for backward compatibility
  convertToLegacyGameState(gumboState: GumboGameState): GameState {
    return {
      game: gumboState.game,
      currentAtBat: gumboState.currentAtBat as any, // Cast to legacy type
      isLoading: false,
      error: gumboState.success ? undefined : 'Failed to fetch game state',
      lastUpdated: gumboState.lastUpdated
    }
  }

  // Get game state (backward compatibility)
  async getGameState(): Promise<GameState> {
    try {
      const gumboState = await this.getGumboGameState()
      return this.convertToLegacyGameState(gumboState)
    } catch (error) {
      console.error('Error getting game state:', error)
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
      const gumboState = await this.getGumboGameState()
      return gumboState.success ? gumboState.game : null
    } catch (error) {
      console.error('Error fetching today\'s Mariners game:', error)
      return null
    }
  }

  // Get the most recent Mariners game (backward compatibility)
  async getMostRecentMarinersGame(): Promise<MLBGame | null> {
    try {
      const gumboState = await this.getGumboGameState()
      return gumboState.success ? gumboState.game : null
    } catch (error) {
      console.error('Error fetching most recent Mariners game:', error)
      return null
    }
  }

  // Get detailed game data (backward compatibility)
  async getGameDetails(gamePk: number): Promise<MLBGame | null> {
    try {
      const gumboState = await this.getGumboGameState(gamePk)
      return gumboState.success ? gumboState.game : null
    } catch (error) {
      console.error('Error fetching game details:', error)
      return null
    }
  }

  // Get current at-bat from game data (backward compatibility)
  getCurrentAtBat(_game: MLBGame): MLBPlay | null {
    // This method is now handled by the API, but kept for backward compatibility
    return null
  }

  // Get the most recent completed at-bat (backward compatibility)
  getMostRecentCompletedAtBat(_game: MLBGame): MLBPlay | null {
    // This method is now handled by the API, but kept for backward compatibility
    return null
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
      const gumboState = await this.getGumboGameState()
      
      // Only send updates if game is live
      if (gumboState.success && gumboState.isGameLive) {
        const legacyState = this.convertToLegacyGameState(gumboState)
        this.listeners.forEach(listener => listener(legacyState))
      }
    }, 10000)

    // Initial update
    this.getGumboGameState().then(gumboState => {
      if (gumboState.success && gumboState.isGameLive) {
        const legacyState = this.convertToLegacyGameState(gumboState)
        this.listeners.forEach(listener => listener(legacyState))
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
      console.log('Force refreshing GUMBO game state...')
      
      const response = await fetch(`${this.apiBaseUrl}/gumbo-state?forceRefresh=true`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to refresh GUMBO game state')
      }

      console.log('Successfully force refreshed GUMBO game state')
      return this.convertToLegacyGameState(data)
    } catch (error) {
      console.error('Error force refreshing GUMBO game state:', error)
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
      const response = await fetch(`/api/system/stats?timeframe=${timeframe}`)
      
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

  // New GUMBO-specific methods

  // Get comprehensive at-bat data for prediction game
  async getAtBatPredictionData(gamePk?: number): Promise<{
    currentAtBat: GumboAtBatData | null
    previousAtBat: GumboAtBatData | null
    pitcher: any
    batter: any
    gameInfo: any
  }> {
    try {
      const gumboState = await this.getGumboGameState(gamePk)
      
      if (!gumboState.success) {
        throw new Error('Failed to get GUMBO game state')
      }

      const currentAtBat = gumboState.currentAtBat
      const previousAtBat = gumboState.previousAtBat

      return {
        currentAtBat,
        previousAtBat,
        pitcher: currentAtBat?.pitcherDetails || currentAtBat?.matchup?.pitcher,
        batter: currentAtBat?.batterDetails || currentAtBat?.matchup?.batter,
        gameInfo: {
          gamePk: gumboState.game?.gamePk,
          status: gumboState.game?.status,
          teams: gumboState.game?.teams,
          venue: gumboState.game?.venue
        }
      }
    } catch (error) {
      console.error('Error getting at-bat prediction data:', error)
      return {
        currentAtBat: null,
        previousAtBat: null,
        pitcher: null,
        batter: null,
        gameInfo: null
      }
    }
  }

  // Get at-bat by specific index
  async getAtBatByIndex(gamePk: number, atBatIndex: number): Promise<GumboAtBatData | null> {
    try {
      const response = await this.getAtBatData(gamePk, 'specific', atBatIndex)
      return response.success ? response.atBatData : null
    } catch (error) {
      console.error(`Error getting at-bat by index ${atBatIndex}:`, error)
      return null
    }
  }
}

export const gumboMlbService = new GumboMLBService()
