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
      return data || null
    } catch (error) {
      console.error('Error fetching game details:', error)
      return null
    }
  }

  // Get game with probable pitcher info using schedule endpoint
  async getGameWithProbablePitcher(gamePk: number): Promise<any | null> {
    try {
      // First get the game date from the game feed
      const gameResponse = await fetch(`${this.apiBaseUrl}/game/${gamePk}/feed/live`)
      if (!gameResponse.ok) {
        throw new Error(`HTTP error! status: ${gameResponse.status}`)
      }
      const gameData = await gameResponse.json()
      
      if (!gameData.gameData?.datetime?.originalDate) {
        throw new Error('Game date not found')
      }

      // Extract the date from the game
      const gameDate = gameData.gameData.datetime.originalDate.split('T')[0] // YYYY-MM-DD format
      
      // Now get the schedule with probable pitcher hydration
      const scheduleUrl = `${this.apiBaseUrl}/schedule?sportId=1&hydrate=probablePitcher&startDate=${gameDate}&endDate=${gameDate}`
      console.log('[GameDataService] Requesting schedule with probable pitcher:', scheduleUrl)
      
      const scheduleResponse = await fetch(scheduleUrl)
      if (!scheduleResponse.ok) {
        throw new Error(`HTTP error! status: ${scheduleResponse.status}`)
      }
      
      const scheduleData = await scheduleResponse.json()
      
      // Find the specific game in the schedule
      if (scheduleData.dates && scheduleData.dates.length > 0) {
        for (const date of scheduleData.dates) {
          if (date.games) {
            const game = date.games.find((g: any) => g.gamePk === gamePk)
            if (game) {
              return game
            }
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('Error fetching game with probable pitcher:', error)
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
