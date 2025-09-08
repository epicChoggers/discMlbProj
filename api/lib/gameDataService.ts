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
      console.log('[GameDataService] Requesting schedule URL with probable pitcher:', url)
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
      console.error("[GameDataService] Error fetching today's Mariners game with pitcher:", error)
      return null
    }
  }

  // Get today's Mariners game (legacy method for backward compatibility)
  async getTodaysMarinersGame(): Promise<any | null> {
    return this.getTodaysMarinersGameWithPitcher()
  }

  // Check if game is live
  isGameLive(game: any): boolean {
    return game.status?.detailedState === 'In Progress'
  }

  // Get current at-bat from game
  getCurrentAtBat(game: any): any {
    // Try different possible paths for current at-bat data
    if (game.liveData?.plays?.currentPlay) {
      return game.liveData.plays.currentPlay
    }
    
    // If no current play, try to get the last play from allPlays
    if (game.liveData?.plays?.allPlays && game.liveData.plays.allPlays.length > 0) {
      const allPlays = game.liveData.plays.allPlays
      const lastPlay = allPlays[allPlays.length - 1]
      
      // Check if the last play is still in progress (no result yet)
      if (lastPlay && !lastPlay.result?.event) {
        return lastPlay
      }
    }
    
    return null
  }

  // Get game details by gamePk
  async getGameDetails(gamePk: number): Promise<any | null> {
    try {
      console.log(`[GameDataService] Fetching detailed game data for game ${gamePk}`)
      const response = await fetch(`${this.apiBaseUrl}/game/${gamePk}/feed/live`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      
      // Structure the data properly - combine gameData and liveData from MLB API response
      const structuredData = {
        ...data.gameData,
        gamePk: gamePk,
        liveData: data.liveData
      }
      
      console.log(`[GameDataService] Successfully fetched detailed game data for game ${gamePk}`)
      console.log(`[GameDataService] Live data available:`, !!data.liveData)
      console.log(`[GameDataService] Current play available:`, !!data.liveData?.plays?.currentPlay)
      console.log(`[GameDataService] All plays count:`, data.liveData?.plays?.allPlays?.length || 0)
      
      return structuredData
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
