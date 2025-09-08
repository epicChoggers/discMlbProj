import { MLBGame, GameState } from '../types'

export class GameDataService {
  private apiBaseUrl: string
  // private isDevelopment: boolean

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_MLB_API_BASE_URL || 'https://statsapi.mlb.com/api/v1'
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

  // Get today's Mariners game (placeholder implementation)
  async getTodaysMarinersGame(): Promise<MLBGame | null> {
    // This would typically fetch today's Mariners game
    // For now, return null as this is a placeholder
    return null
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
