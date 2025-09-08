// Server-side GameDataService for API functions
export class GameDataService {
  private apiBaseUrl: string
  private teamId: string

  constructor() {
    this.apiBaseUrl = process.env.VITE_MLB_API_BASE_URL || 'https://statsapi.mlb.com/api/v1'
    this.teamId = process.env.VITE_TEAM_ID || '136'
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl
  }

  getTeamId(): string {
    return this.teamId
  }

  // Get today's Mariners game
  async getTodaysMarinersGame(): Promise<any | null> {
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      const url = `${this.apiBaseUrl}/schedule?sportId=1&teamId=${this.teamId}&date=${today}`
      console.log('[GameDataService] Requesting schedule URL:', url)
      const response = await fetch(url)
      
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        console.error('[GameDataService] Non-OK response', { status: response.status, text })
        throw new Error(`HTTP error ${response.status}`)
      }
      
      const data = await response.json().catch((err) => {
        console.error('[GameDataService] JSON parse failed:', err)
        throw new Error('Failed to parse MLB API response')
      })
      
      if (data.dates && data.dates.length > 0 && data.dates[0].games) {
        const games = data.dates[0].games
        // Return the first Mariners game found (there should only be one per day)
        if (games.length > 0) {
          return games[0]
        }
      }
      
      return null
    } catch (error) {
      console.error("[GameDataService] Error fetching today's Mariners game:", error)
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

  // Get game details by gamePk
  async getGameDetails(gamePk: number): Promise<any | null> {
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
