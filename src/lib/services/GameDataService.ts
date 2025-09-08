import { MLBGame, GameState } from '../types'

export class GameDataService {
  private apiBaseUrl: string
  private teamId: string
  // private isDevelopment: boolean

  constructor() {
    // Use process.env for server-side, import.meta.env for client-side
    this.apiBaseUrl = typeof process !== 'undefined' && process.env ? 
      process.env.VITE_MLB_API_BASE_URL || 'https://statsapi.mlb.com/api/v1' :
      import.meta.env.VITE_MLB_API_BASE_URL || 'https://statsapi.mlb.com/api/v1'
    
    this.teamId = typeof process !== 'undefined' && process.env ? 
      process.env.VITE_TEAM_ID || '136' :
      import.meta.env.VITE_TEAM_ID || '136'
    // this.isDevelopment = import.meta.env.DEV
  }

  // Get current game data
  async getCurrentGame(): Promise<MLBGame | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/games/live`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      
      if (data.games && data.games.length > 0) {
        return data.games[0]
      }
      
      return null
    } catch (error) {
      console.error('Error fetching current game:', error)
      return null
    }
  }

  // Get game state
  async getGameState(): Promise<GameState> {
    try {
      const game = await this.getCurrentGame()
      
      if (!game) {
        return {
          game: null,
          currentAtBat: null,
          isLoading: false,
          lastUpdated: new Date().toISOString()
        }
      }

      // Extract current at-bat information
      const currentAtBat = game.liveData?.plays?.currentPlay || null

      return {
        game,
        currentAtBat,
        isLoading: false,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error getting game state:', error)
      return {
        game: null,
        currentAtBat: null,
        isLoading: false,
        lastUpdated: new Date().toISOString()
      }
    }
  }

  // Check if game is live
  isGameLive(game: MLBGame): boolean {
    return game.status?.detailedState === 'In Progress'
  }

  // Get team ID
  getTeamId(): string {
    return this.teamId
  }

  // Get today's Mariners game
  async getTodaysMarinersGame(): Promise<MLBGame | null> {
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      const response = await fetch(`${this.apiBaseUrl}/schedule?sportId=1&teamId=${this.teamId}&date=${today}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.dates && data.dates.length > 0 && data.dates[0].games) {
        const games = data.dates[0].games
        // Return the first Mariners game found (there should only be one per day)
        if (games.length > 0) {
          return games[0]
        }
      }
      
      return null
    } catch (error) {
      console.error('Error fetching today\'s Mariners game:', error)
      return null
    }
  }

  // Get current at-bat from game
  getCurrentAtBat(game: MLBGame): any {
    return game.liveData?.plays?.currentPlay || null
  }

  // Get game details by gamePk
  async getGameDetails(gamePk: number): Promise<MLBGame | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/game/${gamePk}/feed/live`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      return data.gameData || null
    } catch (error) {
      console.error('Error fetching game details:', error)
      return null
    }
  }

  // Get cache statistics (placeholder)
  getCacheStats(): any {
    return {
      hits: 0,
      misses: 0,
      size: 0
    }
  }
}

export const gameDataService = new GameDataService()
