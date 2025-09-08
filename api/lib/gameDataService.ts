// Server-side GameDataService for API functions
export class GameDataService {
  private apiBaseUrl: string

  constructor() {
    this.apiBaseUrl = process.env.VITE_MLB_API_BASE_URL || 'https://statsapi.mlb.com/api/v1'
  }

  // Get today's Mariners game
  async getTodaysMarinersGame(): Promise<any | null> {
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      const response = await fetch(`${this.apiBaseUrl}/schedule?sportId=1&teamId=136&date=${today}`)
      
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

  // Check if game is live
  isGameLive(game: any): boolean {
    return game.status?.detailedState === 'In Progress'
  }

  // Get current at-bat from game
  getCurrentAtBat(game: any): any {
    return game.liveData?.plays?.currentPlay || null
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
