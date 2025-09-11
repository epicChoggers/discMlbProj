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

  // Get today's Mariners game with probable pitcher
  async getTodaysMarinersGameWithPitcher(): Promise<any | null> {
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      const url = `${this.apiBaseUrl}/schedule?sportId=1&teamId=${this.teamId}&hydrate=probablePitcher&date=${today}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }
      const data = await response.json()
      if (data.dates && data.dates.length > 0 && data.dates[0].games && data.dates[0].games.length > 0) {
        return data.dates[0].games[0]
      }
      return null
    } catch (error) {
      console.error("[GameDataService] Error fetching today's Mariners game with pitcher:", error)
      return null
    }
  }

  // Backward compatibility
  async getTodaysMarinersGame(): Promise<any | null> {
    return this.getTodaysMarinersGameWithPitcher()
  }

  // Check if game is live
  isGameLive(game: any): boolean {
    return game.status?.abstractGameState === 'Live' || game.status?.detailedState === 'In Progress'
  }

  // Get current at-bat from game
  getCurrentAtBat(game: any): any {
    return game.liveData?.plays?.currentPlay || null
  }

  // Get full game feed (includes gameData and liveData) by gamePk
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

  async getGameWithProbablePitcher(gamePk: number): Promise<any | null> {
    try {
      // get date from game feed
      const feed = await this.getGameDetails(gamePk)
      const date = feed?.gameData?.datetime?.originalDate?.split('T')[0]
      const scheduleUrl = `${this.apiBaseUrl}/schedule?sportId=1&hydrate=probablePitcher&startDate=${date}&endDate=${date}`
      const response = await fetch(scheduleUrl)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const schedule = await response.json()
      for (const d of schedule.dates || []) {
        const g = (d.games || []).find((g: any) => g.gamePk === gamePk)
        if (g) return g
      }
      return null
    } catch (error) {
      console.error('Error fetching game with probable pitcher:', error)
      return null
    }
  }
}

export const gameDataService = new GameDataService()


